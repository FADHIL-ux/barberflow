import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";
import { env } from "./env.ts";
import { authRoutes } from "./routes/auth.ts";
import { barberRoutes } from "./routes/barbers.ts";
import { featureRoutes } from "./routes/features.ts";
import { productRoutes } from "./routes/products.ts";
import { profileRoutes } from "./routes/profile.ts";
import { publicRoutes } from "./routes/public.ts";
import { queueRoutes } from "./routes/queue.ts";
import { serviceRoutes } from "./routes/services.ts";
import { transactionRoutes } from "./routes/transactions.ts";
import { userRoutes } from "./routes/users.ts";

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
app.route("/public", publicRoutes);

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
