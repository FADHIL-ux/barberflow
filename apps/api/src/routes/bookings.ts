import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createBookingSchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { appPool, withTenant } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const bookingRoutes = new Hono<AppEnv>();

// GET /api/bookings -> Daftar booking (Internal untuk owner & kasir)
bookingRoutes.get("/", authenticate, requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const rows = await withTenant(tenantId, async (db) => {
    const q = `
      SELECT 
        bk.id,
        bk.barber_id,
        b.display_name as barber_name,
        bk.service_id,
        s.name as service_name,
        s.duration_minutes,
        bk.customer_name,
        bk.customer_phone,
        bk.starts_at,
        bk.ends_at,
        bk.status,
        bk.created_at
      FROM bookings bk
      JOIN barbers b ON b.id = bk.barber_id AND b.tenant_id = bk.tenant_id
      JOIN services s ON s.id = bk.service_id AND s.tenant_id = bk.tenant_id
      WHERE bk.tenant_id = $1
      ORDER BY bk.starts_at ASC
    `;
    const res = await db.query(q, [tenantId]);
    return res.rows;
  });

  return c.json({ items: rows });
});

// POST /api/bookings -> Buat booking manual (Internal untuk owner & kasir)
bookingRoutes.post("/", authenticate, requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const input = await parseBody(c, createBookingSchema);

  try {
    const booking = await withTenant(tenantId, async (db) => {
      // 1. Ambil durasi layanan
      const sRes = await db.query<{ duration_minutes: number; name: string }>(
        "SELECT duration_minutes, name FROM services WHERE id = $1 AND tenant_id = $2",
        [input.serviceId, tenantId],
      );
      const svc = sRes.rows[0];
      if (!svc) throw new HTTPException(400, { message: "Layanan tidak ditemukan." });

      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60000);

      // 2. Insert booking (overlap constraint bookings_no_overlap akan menolak jika bentrok)
      const res = await db.query<{ id: string }>(
        `INSERT INTO bookings (tenant_id, barber_id, service_id, customer_name, customer_phone, starts_at, ends_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'booked')
         RETURNING id`,
        [
          tenantId,
          input.barberId,
          input.serviceId,
          input.customerName,
          input.customerPhone ?? null,
          startsAt,
          endsAt,
        ],
      );

      const bookingId = res.rows[0]!.id;
      await writeAudit(db, auth, "booking.create_manual", "booking", bookingId, {
        customerName: input.customerName,
        serviceName: svc.name,
        startsAt: startsAt.toISOString(),
      });

      return {
        id: bookingId,
        serviceName: svc.name,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      };
    });

    return c.json(booking, 201);
  } catch (err) {
    if (pgErrorCode(err) === "23P01") {
      throw new HTTPException(409, {
        message: "Jadwal pada jam tersebut sudah dipesan. Silakan pilih jam atau kapster lain.",
      });
    }
    throw err;
  }
});

// PATCH /api/bookings/:id/status -> Ubah status booking (cancelled / done)
bookingRoutes.patch("/:id/status", authenticate, requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");
  const { status } = await c.req.json<{ status: "booked" | "cancelled" | "done" }>();

  const updated = await withTenant(tenantId, async (db) => {
    const res = await db.query(
      `UPDATE bookings SET status = $2 WHERE id = $1 AND tenant_id = $3 RETURNING id, status`,
      [id, status, tenantId],
    );
    if (res.rows[0]) {
      await writeAudit(db, auth, "booking.status_update", "booking", id, { status });
    }
    return res.rows[0];
  });

  if (!updated) throw new HTTPException(404, { message: "Booking tidak ditemukan." });
  return c.json({ ok: true, status: updated.status });
});

// DELETE /api/bookings/:id -> Hapus booking (Khusus owner & kasir)
bookingRoutes.delete("/:id", authenticate, requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");

  const deleted = await withTenant(tenantId, async (db) => {
    const res = await db.query(
      `DELETE FROM bookings WHERE id = $1 AND tenant_id = $2 RETURNING id, customer_name`,
      [id, tenantId],
    );
    if (res.rows[0]) {
      await writeAudit(db, auth, "booking.delete", "booking", id, { customerName: res.rows[0].customer_name });
      return true;
    }
    return false;
  });

  if (!deleted) throw new HTTPException(404, { message: "Booking tidak ditemukan." });
  return c.json({ ok: true, message: "Booking berhasil dihapus." });
});

