import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { productSchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const productRoutes = new Hono<AppEnv>();
productRoutes.use("*", authenticate);

interface ProductRow {
  id: string; name: string; price_idr: number; stock_quantity: number; is_active: boolean;
}
const toDto = (r: ProductRow) => ({
  id: r.id, name: r.name, priceIdr: r.price_idr, stockQuantity: r.stock_quantity, isActive: r.is_active,
});
const COLUMNS = "id, name, price_idr, stock_quantity, is_active";

productRoutes.get("/", async (c) => {
  const rows = await withTenant(tenantIdOf(c), async (db) =>
    (await db.query<ProductRow>(`SELECT ${COLUMNS} FROM products ORDER BY name`)).rows);
  return c.json({ items: rows.map(toDto) });
});

productRoutes.post("/", requireRole("owner"), async (c) => {
  const input = await parseBody(c, productSchema);
  const auth = c.get("auth");
  try {
    const row = await withTenant(tenantIdOf(c), async (db) => {
      const r = await db.query<ProductRow>(
        `INSERT INTO products (tenant_id, name, price_idr, stock_quantity, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
        [auth.tenantId, input.name, input.priceIdr, input.stockQuantity, input.isActive]);
      await writeAudit(db, auth, "product.create", "product", r.rows[0]!.id, { name: input.name });
      return r.rows[0]!;
    });
    return c.json(toDto(row), 201);
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new HTTPException(409, { message: "Nama produk sudah digunakan." });
    throw err;
  }
});

productRoutes.put("/:id", requireRole("owner"), async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseBody(c, productSchema);
  const auth = c.get("auth");
  try {
    const row = await withTenant(tenantIdOf(c), async (db) => {
      const r = await db.query<ProductRow>(
        `UPDATE products SET name = $2, price_idr = $3, stock_quantity = $4, is_active = $5
         WHERE id = $1 RETURNING ${COLUMNS}`,
        [id, input.name, input.priceIdr, input.stockQuantity, input.isActive]);
      if (r.rows[0]) await writeAudit(db, auth, "product.update", "product", id, { name: input.name });
      return r.rows[0];
    });
    if (!row) throw new HTTPException(404, { message: "Produk tidak ditemukan." });
    return c.json(toDto(row));
  } catch (err) {
    if (pgErrorCode(err) === "23505") throw new HTTPException(409, { message: "Nama produk sudah digunakan." });
    throw err;
  }
});

productRoutes.delete("/:id", requireRole("owner"), async (c) => {
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");
  try {
    const deleted = await withTenant(tenantIdOf(c), async (db) => {
      const r = await db.query("DELETE FROM products WHERE id = $1", [id]);
      if (r.rowCount) await writeAudit(db, auth, "product.delete", "product", id);
      return r.rowCount ?? 0;
    });
    if (!deleted) throw new HTTPException(404, { message: "Produk tidak ditemukan." });
    return c.json({ ok: true });
  } catch (err) {
    if (pgErrorCode(err) === "23503") {
      throw new HTTPException(409, { message: "Produk sudah dipakai di transaksi. Nonaktifkan saja." });
    }
    throw err;
  }
});
