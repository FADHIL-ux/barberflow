import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

export async function parseBody<S extends z.ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Isi permintaan bukan JSON yang valid." });
  }
  return schema.parse(json);
}

const uuidSchema = z.string().uuid("ID tidak valid");

export function parseId(value: string | undefined): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) throw new HTTPException(400, { message: "ID tidak valid." });
  return result.data;
}

export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}

export function clientIp(c: Context): string {
  // Only trust this header when the API sits behind your own reverse proxy (see deployment docs).
  return c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
