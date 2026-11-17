import { randomBytes, randomUUID } from "node:crypto";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { loginSchema, registerSchema, resolveFeatures, type Plan } from "@barberflow/shared";
import { createSessionToken, hashPassword, SESSION_COOKIE, SESSION_SECONDS, verifyPassword, type AuthContext, type Role } from "../auth.ts";
import { writeAudit } from "../audit.ts";
import { appPool, withPlatform, withTenant } from "../db.ts";
import { env } from "../env.ts";
import { clientIp, parseBody, pgErrorCode } from "../http.ts";
import { authenticate, rateLimit, type AppEnv } from "../middleware.ts";

export const authRoutes = new Hono<AppEnv>();

function setSession(c: Parameters<typeof setCookie>[0], token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

function slugify(name: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${base.length >= 3 ? base : "barbershop"}-${randomBytes(2).toString("hex")}`;
}

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, key: (c) => `login:${clientIp(c)}` });
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, max: 5, key: (c) => `register:${clientIp(c)}` });

authRoutes.post("/login", loginLimiter, async (c) => {
  const input = await parseBody(c, loginSchema);
  const { rows } = await appPool.query<{
    id: string; tenant_id: string | null; password_hash: string; full_name: string; role: Role; tenant_active: boolean;
  }>("SELECT * FROM app_private.find_user_for_login($1)", [input.email]);
  const user = rows[0];

  const ok = await verifyPassword(user?.password_hash ?? null, input.password);
  if (!user || !ok) throw new HTTPException(401, { message: "Email atau password salah." });
  if (!user.tenant_active) throw new HTTPException(403, { message: "Barbershop ini sedang dinonaktifkan. Hubungi admin BarberFlow." });

  const auth: AuthContext = { userId: user.id, tenantId: user.tenant_id, role: user.role, name: user.full_name };
  setSession(c, await createSessionToken(auth));
  if (auth.tenantId) await withTenant(auth.tenantId, (db) => writeAudit(db, auth, "auth.login", "user", auth.userId));
  return c.json({ user: { id: user.id, name: user.full_name, role: user.role } });
});

// Self-registration creates a new barbershop (Starter plan) with its owner.
authRoutes.post("/register", registerLimiter, async (c) => {
  const input = await parseBody(c, registerSchema);
  const tenantId = randomUUID();
  const userId = randomUUID();
  const passwordHash = await hashPassword(input.password);

  try {
    await withPlatform(async (db) => {
      await db.query("INSERT INTO tenants (id, name, slug, plan) VALUES ($1, $2, $3, 'starter')", [tenantId, input.barbershopName, slugify(input.barbershopName)]);
      await db.query("INSERT INTO tenant_profiles (tenant_id) VALUES ($1)", [tenantId]);
      await db.query("INSERT INTO receipt_counters (tenant_id) VALUES ($1)", [tenantId]);
      // No RETURNING here: the platform role is not allowed to read users back.
      await db.query(
        "INSERT INTO users (id, tenant_id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5, 'owner')",
        [userId, tenantId, input.email, passwordHash, input.ownerName],
      );
    });
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new HTTPException(409, { message: "Email sudah terdaftar." });
    throw err;
  }

  const auth: AuthContext = { userId, tenantId, role: "owner", name: input.ownerName };
  setSession(c, await createSessionToken(auth));
  await withTenant(tenantId, (db) => writeAudit(db, auth, "tenant.registered", "tenant", tenantId));
  return c.json({ user: { id: userId, name: input.ownerName, role: "owner" } }, 201);
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", authenticate, async (c) => {
  const auth = c.get("auth");
  if (!auth.tenantId) return c.json({ user: { id: auth.userId, name: auth.name, role: auth.role }, tenant: null });

  const tenant = await withTenant(auth.tenantId, async (db) => {
    const r = await db.query<{ name: string; slug: string; plan: Plan; feature_flags: Record<string, unknown> }>(
      "SELECT name, slug, plan, feature_flags FROM tenants WHERE id = $1", [auth.tenantId]);
    return r.rows[0];
  });
  if (!tenant) throw new HTTPException(401, { message: "Sesi tidak valid." });

  return c.json({
    user: { id: auth.userId, name: auth.name, role: auth.role },
    tenant: { name: tenant.name, slug: tenant.slug, plan: tenant.plan, features: resolveFeatures(tenant.plan, tenant.feature_flags) },
  });
});
