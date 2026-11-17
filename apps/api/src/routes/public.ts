import { createHash } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { appPool } from "../db.ts";

export const publicRoutes = new Hono();

// GET /public/receipt/:token -> Mengambil nota publik (tanpa autentikasi, tanpa nomor telepon pelanggan)
publicRoutes.get("/receipt/:token", async (c) => {
  const token = c.req.param("token");
  if (!token || token.length < 16) {
    throw new HTTPException(400, { message: "Token struk tidak valid." });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { rows } = await appPool.query<{ receipt: any }>(
    "SELECT app_private.get_public_receipt($1) AS receipt",
    [tokenHash],
  );

  const receipt = rows[0]?.receipt;
  if (!receipt) {
    throw new HTTPException(404, { message: "Struk tidak ditemukan atau tautan telah kedaluwarsa." });
  }

  return c.json({ receipt });
});
