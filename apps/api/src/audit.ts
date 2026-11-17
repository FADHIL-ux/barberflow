import type { Db } from "./db.ts";
import type { AuthContext } from "./auth.ts";

export async function writeAudit(
  db: Db,
  auth: AuthContext,
  action: string,
  entity: string,
  entityId: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.query(
    "INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, detail) VALUES ($1, $2, $3, $4, $5, $6)",
    [auth.tenantId, auth.userId, action, entity, entityId, JSON.stringify(detail)],
  );
}
