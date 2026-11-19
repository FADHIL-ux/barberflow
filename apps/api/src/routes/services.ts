import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { serviceSchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const serviceRoutes = new Hono<AppEnv>();
serviceRoutes.use("*", authenticate);

interface ServiceRow {
  id: string; name: string; price_idr: number; duration_minutes: number; description: string; is_active: boolean;
}
const toDto = (r: ServiceRow) => ({
  id: r.id, name: r.name, priceIdr: r.price_idr, durationMinutes: r.duration_minutes, description: r.description, isActive: r.is_active,
});
const COLUMNS = "id, name, price_idr, duration_minutes, description, is_active";

serviceRoutes.get("/", async (c) => {
  const tenantId = tenantIdOf(c);
  const rows = await withTenant(tenantId, async (db) =>
    (await db.query<ServiceRow>(`SELECT ${COLUMNS} FROM services WHERE tenant_id = $1 ORDER BY name`, [tenantId])).rows);
  return c.json({ items: rows.map(toDto) });
});

serviceRoutes.post("/", requireRole("owner"), async (c) => {
  const input = await parseBody(c, serviceSchema);
  const auth = c.get("auth");
  try {
    const row = await withTenant(tenantIdOf(c), async (db) => {
      const r = await db.query<ServiceRow>(
        `INSERT INTO services (tenant_id, name, price_idr, duration_minutes, description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
        [auth.tenantId, input.name, input.priceIdr, input.durationMinutes, input.description, input.isActive]);
      await writeAudit(db, auth, "service.create", "service", r.rows[0]!.id, { name: input.name });
      return r.rows[0]!;
    });
    return c.json(toDto(row), 201);
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new HTTPException(409, { message: "Nama layanan sudah digunakan." });
    throw err;
  }
});

serviceRoutes.put("/:id", requireRole("owner"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const input = await parseBody(c, serviceSchema);
  const auth = c.get("auth");
  try {
    const row = await withTenant(tenantId, async (db) => {
      const r = await db.query<ServiceRow>(
        `UPDATE services SET name = $2, price_idr = $3, duration_minutes = $4, description = $5, is_active = $6
         WHERE id = $1 AND tenant_id = $7 RETURNING ${COLUMNS}`,
        [id, input.name, input.priceIdr, input.durationMinutes, input.description, input.isActive, tenantId]);
      if (r.rows[0]) await writeAudit(db, auth, "service.update", "service", id, { name: input.name });
      return r.rows[0];
    });
    if (!row) throw new HTTPException(404, { message: "Layanan tidak ditemukan." });
    return c.json(toDto(row));
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new HTTPException(409, { message: "Nama layanan sudah digunakan." });
    throw err;
  }
});

serviceRoutes.delete("/:id", requireRole("owner"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");
  try {
    const deleted = await withTenant(tenantId, async (db) => {
      const r = await db.query("DELETE FROM services WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
      if (r.rowCount) await writeAudit(db, auth, "service.delete", "service", id);
      return r.rowCount ?? 0;
    });
    if (!deleted) throw new HTTPException(404, { message: "Layanan tidak ditemukan." });
    return c.json({ ok: true });
  } catch (err) {
    if (pgErrorCode(err) === "23503") {
      throw new HTTPException(409, { message: "Layanan sudah dipakai di transaksi atau antrean. Nonaktifkan saja." });
    }
    throw err;
  }
});
