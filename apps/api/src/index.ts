import { serve } from "@hono/node-server";
import { app } from "./app.ts";
import { env } from "./env.ts";
import { seedDemoData } from "./seed.ts";

void seedDemoData().catch(console.error);

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`BarberFlow API berjalan di http://localhost:${info.port}`);
});
