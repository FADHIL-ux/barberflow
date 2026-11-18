import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { env } from "./env.ts";
import { runMigrationsAndSeed } from "./seed.ts";

void runMigrationsAndSeed().catch(console.error);

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`BarberFlow API berjalan di http://localhost:${info.port}`);
});
