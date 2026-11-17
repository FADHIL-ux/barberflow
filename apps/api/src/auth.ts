import argon2 from "argon2";
import { sign, verify } from "hono/jwt";
import { env } from "./env.ts";

export type Role = "owner" | "cashier" | "barber" | "super_admin";

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  role: Role;
  name: string;
}

export const SESSION_COOKIE = "bf_session";
export const SESSION_SECONDS = 60 * 60 * 8;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

let dummyHash: Promise<string> | undefined;

/** Verifies against a dummy hash when the user does not exist, to keep response time similar. */
export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (!hash) {
    dummyHash ??= hashPassword("barberflow-dummy-password");
    await argon2.verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return argon2.verify(hash, password).catch(() => false);
}

export function createSessionToken(auth: AuthContext): Promise<string> {
  return sign(
    { sub: auth.userId, tid: auth.tenantId, role: auth.role, name: auth.name, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS },
    env.JWT_SECRET,
    "HS256",
  );
}

export async function readSessionToken(token: string): Promise<AuthContext | null> {
  try {
    const payload = await verify(token, env.JWT_SECRET, "HS256");
    const role = payload["role"];
    if (typeof payload.sub !== "string") return null;
    if (role !== "owner" && role !== "cashier" && role !== "barber" && role !== "super_admin") return null;
    const tid = payload["tid"];
    const name = payload["name"];
    return { userId: payload.sub, tenantId: typeof tid === "string" ? tid : null, role, name: typeof name === "string" ? name : "" };
  } catch {
    return null;
  }
}
