import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { inviteUserSchema, updateUserSchema } from "@barberflow/shared";
import { hashPassword } from "../auth.ts";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", authenticate);
userRoutes.use("*", requireRole("owner"));

interface UserRow {
  id: string; email: string; full_name: string; role: string; is_active: boolean;
}
const toDto = (r: UserRow) => ({
  id: r.id, email: r.email, fullName: r.full_name, role: r.role, isActive: r.is_active,
});

userRoutes.get("/", async (c) => {
  const rows = await withTenant(tenantIdOf(c), async (db) =>
    (await db.query<UserRow>(
      "SELECT id, email, full_name, role, is_active FROM users WHERE tenant_id = $1 ORDER BY full_name",
      [tenantIdOf(c)],
    )).rows);
  return c.json({ items: rows.map(toDto) });
});

userRoutes.post("/", async (c) => {
  const input = await parseBody(c, inviteUserSchema);
  const auth = c.get("auth");
  const temporaryPassword = randomBytes(8).toString("hex");
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const row = await withTenant(tenantIdOf(c), async (db) => {
      const r = await db.query<UserRow>(
        `INSERT INTO users (tenant_id, email, full_name, role, password_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING id, email, full_name, role, is_active`,
        [auth.tenantId, input.email, input.fullName, input.role, passwordHash]);
      await writeAudit(db, auth, "user.invite", "user", r.rows[0]!.id, { email: input.email, role: input.role });
      return r.rows[0]!;
    });
    return c.json({ ...toDto(row), temporaryPassword }, 201);
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new HTTPException(409, { message: "Email sudah terdaftar." });
    throw err;
  }
});

userRoutes.put("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");
  if (auth.userId === id) throw new HTTPException(403, { message: "Tidak dapat mengubah akun sendiri." });
  const input = await parseBody(c, updateUserSchema);
  const row = await withTenant(tenantIdOf(c), async (db) => {
    const r = await db.query<UserRow>(
      `UPDATE users SET full_name = $2, role = $3, is_active = $4
       WHERE id = $1 AND tenant_id = $5 RETURNING id, email, full_name, role, is_active`,
      [id, input.fullName, input.role, input.isActive, auth.tenantId]);
    if (r.rows[0]) await writeAudit(db, auth, "user.update", "user", id, { fullName: input.fullName, role: input.role });
    return r.rows[0];
  });
  if (!row) throw new HTTPException(404, { message: "Pengguna tidak ditemukan." });
  return c.json(toDto(row));
});

userRoutes.delete("/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");
  if (auth.userId === id) throw new HTTPException(403, { message: "Tidak dapat menghapus akun sendiri." });
  try {
    const deleted = await withTenant(tenantIdOf(c), async (db) => {
      const r = await db.query(
        "DELETE FROM users WHERE id = $1 AND tenant_id = $2",
        [id, auth.tenantId]);
      if (r.rowCount) await writeAudit(db, auth, "user.delete", "user", id);
      return r.rowCount ?? 0;
    });
    if (!deleted) throw new HTTPException(404, { message: "Pengguna tidak ditemukan." });
    return c.json({ ok: true });
  } catch (err) {
    if (pgErrorCode(err) === "23503") {
      throw new HTTPException(409, { message: "Pengguna memiliki riwayat data. Nonaktifkan saja." });
    }
    throw err;
  }
});
