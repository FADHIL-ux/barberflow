import { Hono } from "hono";
import { profileSchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const profileRoutes = new Hono<AppEnv>();
profileRoutes.use("*", authenticate);

interface ProfileRow {
  name: string; address: string; phone: string | null; receipt_footer: string; paper_width_mm: number;
  open_time: string; close_time: string;
}
const SELECT = `SELECT t.name, p.address, p.phone, p.receipt_footer, p.paper_width_mm,
                       to_char(p.open_time, 'HH24:MI') AS open_time, to_char(p.close_time, 'HH24:MI') AS close_time
                FROM tenants t JOIN tenant_profiles p ON p.tenant_id = t.id`;
const toDto = (r: ProfileRow) => ({
  name: r.name, address: r.address, phone: r.phone, receiptFooter: r.receipt_footer,
  paperWidthMm: r.paper_width_mm, openTime: r.open_time, closeTime: r.close_time,
});

profileRoutes.get("/", async (c) => {
  const row = await withTenant(tenantIdOf(c), async (db) => (await db.query<ProfileRow>(SELECT)).rows[0]);
  return c.json(row ? toDto(row) : null);
});

profileRoutes.put("/", requireRole("owner"), async (c) => {
  const input = await parseBody(c, profileSchema);
  const auth = c.get("auth");
  const row = await withTenant(tenantIdOf(c), async (db) => {
    await db.query("UPDATE tenants SET name = $1 WHERE id = $2", [input.name, auth.tenantId]);
    await db.query(
      `UPDATE tenant_profiles SET address = $1, phone = $2, receipt_footer = $3, paper_width_mm = $4,
              open_time = $5, close_time = $6, updated_at = now() WHERE tenant_id = $7`,
      [input.address, input.phone, input.receiptFooter, input.paperWidthMm, input.openTime, input.closeTime, auth.tenantId]);
    await writeAudit(db, auth, "profile.update", "tenant", auth.tenantId);
    return (await db.query<ProfileRow>(SELECT)).rows[0];
  });
  return c.json(row ? toDto(row) : null);
});
