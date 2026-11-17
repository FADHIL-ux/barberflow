import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { resolveFeatures, type FeatureKey, type Plan } from "@barberflow/shared";
import { readSessionToken, SESSION_COOKIE, type AuthContext, type Role } from "./auth.ts";
import { appPool, withTenant } from "./db.ts";

export type AppEnv = { Variables: { auth: AuthContext } };

/** Verifies the session cookie, then confirms in the database that user and tenant are still active. */
export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  const auth = token ? await readSessionToken(token) : null;
  if (!auth) throw new HTTPException(401, { message: "Sesi tidak valid. Silakan masuk kembali." });

  const { rows } = await appPool.query<{ ok: boolean }>("SELECT app_private.session_is_valid($1) AS ok", [auth.userId]);
  if (!rows[0]?.ok) throw new HTTPException(401, { message: "Akun atau barbershop tidak aktif." });

  c.set("auth", auth);
  await next();
};

export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!roles.includes(c.get("auth").role)) {
      throw new HTTPException(403, { message: "Anda tidak memiliki izin untuk tindakan ini." });
    }
    await next();
  };
}

/** Returns the tenant id for tenant-scoped routes. super_admin has none and is rejected. */
export function tenantIdOf(c: Context<AppEnv>): string {
  const tenantId = c.get("auth").tenantId;
  if (!tenantId) throw new HTTPException(403, { message: "Akses data barbershop tidak diizinkan." });
  return tenantId;
}

/** Plan gating is enforced here on the server, not only by hiding buttons in the UI. */
export function requireFeature(feature: FeatureKey): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const tenantId = tenantIdOf(c);
    const row = await withTenant(tenantId, async (db) => {
      const r = await db.query<{ plan: Plan; feature_flags: Record<string, unknown> }>(
        "SELECT plan, feature_flags FROM tenants WHERE id = $1",
        [tenantId],
      );
      return r.rows[0];
    });
    if (!row || !resolveFeatures(row.plan, row.feature_flags)[feature]) {
      throw new HTTPException(403, { message: "Fitur ini tersedia di paket Pro." });
    }
    await next();
  };
}

/** Small in-memory fixed-window limiter. Enough for one VPS; use Redis if you ever scale out. */
export function rateLimit(opts: { windowMs: number; max: number; key: (c: Context) => string }): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, opts.windowMs).unref();

  return async (c, next) => {
    const key = opts.key(c);
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
    } else if (++entry.count > opts.max) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new HTTPException(429, { message: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." });
    }
    await next();
  };
}
