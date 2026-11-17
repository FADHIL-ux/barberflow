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

