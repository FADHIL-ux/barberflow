import { createHash } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createBookingSchema } from "@barberflow/shared";
import { appPool, withTenant } from "../db.ts";
import { parseBody, pgErrorCode } from "../http.ts";

export const publicRoutes = new Hono();

// GET /public/receipt/:token -> Mengambil nota publik
publicRoutes.get("/receipt/:token", async (c) => {
  const token = c.req.param("token");
  if (!token || token.length < 16) {
    throw new HTTPException(400, { message: "Token struk tidak valid." });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { rows } = await appPool.query<{ receipt: any }>(
    "SELECT app_private.get_public_receipt($1) AS receipt",
    [tokenHash],
  );

  const receipt = rows[0]?.receipt;
  if (!receipt) {
    throw new HTTPException(404, { message: "Struk tidak ditemukan atau tautan telah kedaluwarsa." });
  }

  return c.json({ receipt });
});

// GET /public/:slug/info -> Info barbershop, kapster, dan layanan untuk booking publik
publicRoutes.get("/:slug/info", async (c) => {
  const slug = c.req.param("slug");

  const { rows } = await appPool.query<{
    id: string;
    name: string;
    plan: string;
    feature_flags: Record<string, unknown>;
  }>("SELECT * FROM app_private.tenant_by_slug($1)", [slug]);

  const tenant = rows[0];
  if (!tenant) throw new HTTPException(404, { message: "Barbershop tidak ditemukan." });

  // Ambil profil, barbers, dan services menggunakan withTenant
  const data = await withTenant(tenant.id, async (db) => {
    const pRes = await db.query(
      "SELECT address, phone, open_time, close_time FROM tenant_profiles WHERE tenant_id = $1",
      [tenant.id],
    );
    const bRes = await db.query(
      "SELECT id, display_name, skills FROM barbers WHERE tenant_id = $1 AND is_active = true ORDER BY display_name",
      [tenant.id],
    );
    const sRes = await db.query(
      "SELECT id, name, price_idr, duration_minutes, description FROM services WHERE tenant_id = $1 AND is_active = true ORDER BY name",
      [tenant.id],
    );

    return {
      barbershop: {
        id: tenant.id,
        name: tenant.name,
        slug,
        address: pRes.rows[0]?.address ?? "",
        phone: pRes.rows[0]?.phone ?? null,
        openTime: pRes.rows[0]?.open_time ?? "09:00",
        closeTime: pRes.rows[0]?.close_time ?? "21:00",
      },
      barbers: bRes.rows.map((b) => ({ id: b.id, displayName: b.display_name, skills: b.skills })),
      services: sRes.rows.map((s) => ({
        id: s.id,
        name: s.name,
        priceIdr: s.price_idr,
        durationMinutes: s.duration_minutes,
        description: s.description,
      })),
    };
  });

  return c.json(data);
});

// POST /public/:slug/bookings -> Buat janji booking online
publicRoutes.post("/:slug/bookings", async (c) => {
  const slug = c.req.param("slug");
  const input = await parseBody(c, createBookingSchema);

  const { rows } = await appPool.query<{ id: string }>(
    "SELECT id FROM app_private.tenant_by_slug($1)",
    [slug],
  );
  const tenant = rows[0];
  if (!tenant) throw new HTTPException(404, { message: "Barbershop tidak ditemukan." });

  try {
    const booking = await withTenant(tenant.id, async (db) => {
      // 1. Ambil durasi layanan
      const sRes = await db.query<{ duration_minutes: number; name: string }>(
        "SELECT duration_minutes, name FROM services WHERE id = $1 AND tenant_id = $2",
        [input.serviceId, tenant.id],
      );
      const svc = sRes.rows[0];
      if (!svc) throw new HTTPException(400, { message: "Layanan tidak ditemukan." });

      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60000);

      // 2. Insert booking (akan ditolak oleh EXCLUDE USING gist bookings_no_overlap jika bentrok)
      const res = await db.query<{ id: string }>(
        `INSERT INTO bookings (tenant_id, barber_id, service_id, customer_name, customer_phone, starts_at, ends_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'booked')
         RETURNING id`,
        [
          tenant.id,
          input.barberId,
          input.serviceId,
          input.customerName,
          input.customerPhone ?? null,
          startsAt,
          endsAt,
        ],
      );

      return {
        id: res.rows[0]!.id,
        serviceName: svc.name,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      };
    });

    return c.json(booking, 201);
  } catch (err) {
    if (pgErrorCode(err) === "23P01") {
      throw new HTTPException(409, {
        message: "Jadwal pada jam tersebut sudah dipesan orang lain. Silakan pilih jam atau kapster lain.",
      });
    }
    throw err;
  }
});
