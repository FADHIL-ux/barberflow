import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { env } from "./env.ts";
import { serveStatic } from "@hono/node-server/serve-static";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { barberRoutes } from "./routes/barbers.ts";
import { bookingRoutes } from "./routes/bookings.ts";
import { commissionRoutes } from "./routes/commissions.ts";
import { customerRoutes } from "./routes/customers.ts";
import { expenseRoutes } from "./routes/expenses.ts";
import { featureRoutes } from "./routes/features.ts";
import { productRoutes } from "./routes/products.ts";
import { profileRoutes } from "./routes/profile.ts";
import { publicRoutes } from "./routes/public.ts";
import { queueRoutes } from "./routes/queue.ts";
import { reportRoutes } from "./routes/reports.ts";
import { serviceRoutes } from "./routes/services.ts";
import { syncRoutes } from "./routes/sync.ts";
import { transactionRoutes } from "./routes/transactions.ts";
import { userRoutes } from "./routes/users.ts";
import { whatsappRoutes } from "./routes/whatsapp.ts";

export const app = new Hono();

app.use("*", secureHeaders());
app.use("/api/*", cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use("/public/*", cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use("/api/*", bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: "Ukuran data terlalu besar." }, 413) }));

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", authRoutes);
app.route("/api/services", serviceRoutes);
app.route("/api/products", productRoutes);
app.route("/api/barbers", barberRoutes);
app.route("/api/users", userRoutes);
app.route("/api/profile", profileRoutes);
app.route("/api/features", featureRoutes);
app.route("/api/queue", queueRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/customers", customerRoutes);
app.route("/api/commissions", commissionRoutes);
app.route("/api/expenses", expenseRoutes);
app.route("/api/reports", reportRoutes);
app.route("/api/sync", syncRoutes);
app.route("/api/whatsapp", whatsappRoutes);
app.route("/api/bookings", bookingRoutes);
app.route("/api/admin", adminRoutes);
app.route("/public", publicRoutes);

// Static assets from built frontend SPA
const serveDist = serveStatic({ root: "./apps/web/dist" });
const serveIndex = serveStatic({ path: "./apps/web/dist/index.html" });
app.use("/*", async (c, next) => {
  await serveDist(c, next);
  if (c.req.path === "/" || c.req.path === "/index.html" || c.req.path === "/sw.js" || c.req.path === "/registerSW.js") {
    c.res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  } else if (c.req.path.startsWith("/assets/")) {
    c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
});
// SPA fallback for frontend routes (non-API and non-asset)
app.get("*", async (c, next) => {
  const p = c.req.path;
  if (p.startsWith("/api/") || p.startsWith("/public/")) {
    return c.json({ error: "Alamat tidak ditemukan." }, 404);
  }
  // Never serve index.html for missing JS/CSS/image assets — prevents MIME/ChunkLoadError black screens
  if (p.startsWith("/assets/") || p.startsWith("/icons/") || /\.[a-z0-9]+$/i.test(p)) {
    return c.text("Not Found", 404);
  }
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  const res = await serveIndex(c, next);
  return res ?? c.notFound();
});

app.notFound((c) => c.json({ error: "Alamat tidak ditemukan." }, 404));

app.onError((err, c) => {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return c.json({ error: issue?.message ?? "Data tidak valid.", field: issue?.path.join(".") }, 400);
  }
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  // Log details on the server only. Never send stack traces or internals to the client.
  console.error(err);
  return c.json({ error: "Terjadi kesalahan pada server. Silakan coba lagi." }, 500);
});
