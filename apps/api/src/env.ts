import { z } from "zod";

const schema = z.object({
  DATABASE_URL_APP: z.string().url(),
  DATABASE_URL_PLATFORM: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter"),
  API_PORT: z.coerce.number().int().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Konfigurasi environment tidak valid:");
  for (const issue of parsed.error.issues) console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
