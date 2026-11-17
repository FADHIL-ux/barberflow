import { Hono } from "hono";
import { resolveFeatures, type Plan } from "@barberflow/shared";
import { withTenant } from "../db.ts";
import { authenticate, tenantIdOf, type AppEnv } from "../middleware.ts";

export const featureRoutes = new Hono<AppEnv>();
featureRoutes.use("*", authenticate);

featureRoutes.get("/", async (c) => {
  const tenantId = tenantIdOf(c);
  const row = await withTenant(tenantId, async (db) => {
    const r = await db.query<{ plan: Plan; feature_flags: Record<string, unknown> }>(
      "SELECT plan, feature_flags FROM tenants WHERE id = $1", [tenantId]);
    return r.rows[0];
  });
  if (!row) throw new Error("Tenant tidak ditemukan");
  return c.json({ plan: row.plan, features: resolveFeatures(row.plan, row.feature_flags) });
});
