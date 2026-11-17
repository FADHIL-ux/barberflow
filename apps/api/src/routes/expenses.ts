import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { expenseSchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const expenseRoutes = new Hono<AppEnv>();
expenseRoutes.use("*", authenticate);
expenseRoutes.use("*", requireRole("owner"));

interface ExpenseRow {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount_idr: number;
  created_at: string;
}

// GET /api/expenses -> Daftar pengeluaran operasional
expenseRoutes.get("/", async (c) => {
  const tenantId = tenantIdOf(c);
  const rows = await withTenant(tenantId, async (db) => {
    const q = `
      SELECT id, expense_date::text, category, description, amount_idr, created_at
      FROM expenses
      WHERE tenant_id = $1
      ORDER BY expense_date DESC, created_at DESC
      LIMIT 100
    `;
    const res = await db.query<ExpenseRow>(q, [tenantId]);
    return res.rows;
  });

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      expenseDate: r.expense_date,
      category: r.category,
      description: r.description,
      amountIdr: r.amount_idr,
      createdAt: r.created_at,
    })),
  });
});

// POST /api/expenses -> Tambah pengeluaran baru
expenseRoutes.post("/", async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const input = await parseBody(c, expenseSchema);

  const row = await withTenant(tenantId, async (db) => {
    const res = await db.query<ExpenseRow>(
      `INSERT INTO expenses (tenant_id, expense_date, category, description, amount_idr, created_by)
       VALUES ($1, $2::date, $3, $4, $5, $6)
       RETURNING id, expense_date::text, category, description, amount_idr, created_at`,
      [tenantId, input.expenseDate, input.category, input.description, input.amountIdr, auth.userId],
    );

    const exp = res.rows[0]!;
    await writeAudit(db, auth, "expense.create", "expense", exp.id, {
      category: input.category,
      amountIdr: input.amountIdr,
    });
    return exp;
  });

  return c.json(
    {
      id: row.id,
      expenseDate: row.expense_date,
      category: row.category,
      description: row.description,
      amountIdr: row.amount_idr,
      createdAt: row.created_at,
    },
    201,
  );
});

// DELETE /api/expenses/:id -> Hapus pengeluaran
expenseRoutes.delete("/:id", async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");

  const deleted = await withTenant(tenantId, async (db) => {
    const res = await db.query("DELETE FROM expenses WHERE id = $1 AND tenant_id = $2", [
      id,
      tenantId,
    ]);
    if (res.rowCount) {
      await writeAudit(db, auth, "expense.delete", "expense", id);
    }
    return (res.rowCount ?? 0) > 0;
  });

  if (!deleted) throw new HTTPException(404, { message: "Pengeluaran tidak ditemukan." });
  return c.json({ ok: true });
});

