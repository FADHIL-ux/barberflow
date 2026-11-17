import pg from "pg";
import { env } from "./env.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const appPool = new pg.Pool({ connectionString: env.DATABASE_URL_APP, max: 10 });
export const platformPool = new pg.Pool({ connectionString: env.DATABASE_URL_PLATFORM, max: 4 });

export type Db = pg.PoolClient;

async function inTransaction<T>(pool: pg.Pool, prepare: (db: Db) => Promise<void>, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await prepare(client);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` in a transaction with `app.tenant_id` set (transaction-local), so RLS applies.
 * The tenant id must come from the verified session, never from the request body.
 */
export function withTenant<T>(tenantId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(tenantId)) throw new Error("tenantId tidak valid");
  return inTransaction(appPool, (db) => db.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]).then(() => undefined), fn);
}

/** Platform (super_admin) work. This role has no grants on customer or transaction tables. */
export function withPlatform<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return inTransaction(platformPool, async () => undefined, fn);
}
