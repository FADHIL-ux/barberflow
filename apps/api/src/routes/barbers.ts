import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { barberSchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const barberRoutes = new Hono<AppEnv>();
barberRoutes.use("*", authenticate);

interface BarberRow {
  id: string; display_name: string; phone: string | null; photo_url: string | null; skills: string[]; is_active: boolean;
}
const toDto = (r: BarberRow) => ({
  id: r.id, displayName: r.display_name, phone: r.phone, photoUrl: r.photo_url, skills: r.skills, isActive: r.is_active,
});
const COLUMNS = "id, display_name, phone, photo_url, skills, is_active";

barberRoutes.get("/", async (c) => {
  const rows = await withTenant(tenantIdOf(c), async (db) =>
    (await db.query<BarberRow>(`SELECT ${COLUMNS} FROM barbers ORDER BY display_name`)).rows);
  return c.json({ items: rows.map(toDto) });
});

barberRoutes.post("/", requireRole("owner"), async (c) => {
  const input = await parseBody(c, barberSchema);
  const auth = c.get("auth");
  const row = await withTenant(tenantIdOf(c), async (db) => {
    const r = await db.query<BarberRow>(
      `INSERT INTO barbers (tenant_id, display_name, phone, skills, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
      [auth.tenantId, input.displayName, input.phone, input.skills, input.isActive]);
    await writeAudit(db, auth, "barber.create", "barber", r.rows[0]!.id, { name: input.displayName });
    return r.rows[0]!;
  });
  return c.json(toDto(row), 201);
});

barberRoutes.put("/:id", requireRole("owner"), async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseBody(c, barberSchema);
  const auth = c.get("auth");
  const row = await withTenant(tenantIdOf(c), async (db) => {
    const r = await db.query<BarberRow>(
      `UPDATE barbers SET display_name = $2, phone = $3, skills = $4, is_active = $5
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, input.displayName, input.phone, input.skills, input.isActive]);
    if (r.rows[0]) await writeAudit(db, auth, "barber.update", "barber", id, { name: input.displayName });
    return r.rows[0];
  });
  if (!row) throw new HTTPException(404, { message: "Kapster tidak ditemukan." });
  return c.json(toDto(row));
});

barberRoutes.delete("/:id", requireRole("owner"), async (c) => {
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");
  try {
    const deleted = await withTenant(tenantIdOf(c), async (db) => {
      const r = await db.query("DELETE FROM barbers WHERE id = $1", [id]);
      if (r.rowCount) await writeAudit(db, auth, "barber.delete", "barber", id);
      return r.rowCount ?? 0;
    });
    if (!deleted) throw new HTTPException(404, { message: "Kapster tidak ditemukan." });
    return c.json({ ok: true });
  } catch (err) {
    if (pgErrorCode(err) === "23503") {
      throw new HTTPException(409, { message: "Kapster sudah memiliki riwayat komisi atau booking. Nonaktifkan saja." });
    }
    throw err;
  }
});
