import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  rankTop,
  summarizeFinancials,
  type PaymentMethod,
  type RankedEntry,
} from "@barberflow/shared";
import { withTenant } from "../db.ts";
import { authenticate, requireFeature, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const reportRoutes = new Hono<AppEnv>();
reportRoutes.use("*", authenticate);
reportRoutes.use("*", requireRole("owner", "cashier"));
reportRoutes.use("*", requireFeature("financial_reports")); // Gatekeeping Pro plan

// GET /api/reports/daily?date=YYYY-MM-DD
reportRoutes.get("/daily", async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const dateStr = c.req.query("date") || new Date().toISOString().slice(0, 10);

  const report = await withTenant(tenantId, async (db) => {
    // 1. Ambil transaksi tanggal tersebut
    const txRes = await db.query<{
      id: string;
      total_idr: number;
      payment_method: PaymentMethod;
    }>(
      `SELECT id, total_idr, payment_method
       FROM transactions
       WHERE tenant_id = $1
         AND occurred_at::date = $2::date`,
      [tenantId, dateStr],
    );

    // 2. Ambil pengeluaran tanggal tersebut
    const expRes = await db.query<{ amount_idr: number }>(
      `SELECT amount_idr FROM expenses
       WHERE tenant_id = $1 AND expense_date = $2::date`,
      [tenantId, dateStr],
    );

    // 3. Ambil komisi tanggal tersebut (hanya untuk owner)
    let commissionsIdr = 0;
    if (auth.role === "owner") {
      const commRes = await db.query<{ total_comm: string }>(
        `SELECT COALESCE(SUM(ce.amount_idr), 0)::text as total_comm
         FROM commission_entries ce
         JOIN transactions t ON t.id = ce.transaction_id AND t.tenant_id = ce.tenant_id
         WHERE ce.tenant_id = $1 AND t.occurred_at::date = $2::date`,
        [tenantId, dateStr],
      );
      commissionsIdr = Number(commRes.rows[0]?.total_comm || 0);
    }

    const rawFinancials = summarizeFinancials({
      transactions: txRes.rows.map((t) => ({ totalIdr: t.total_idr, paymentMethod: t.payment_method })),
      expenses: expRes.rows.map((e) => ({ amountIdr: e.amount_idr })),
      commissionsIdr,
    });

    // Jika kasir: sembunyikan komisi kapster dan laba bersih rahasia toko
    const financials = auth.role === "cashier"
      ? {
          revenueIdr: rawFinancials.revenueIdr,
          expensesIdr: rawFinancials.expensesIdr,
          commissionsIdr: 0,
          profitIdr: 0,
          transactionCount: rawFinancials.transactionCount,
          byPaymentMethod: rawFinancials.byPaymentMethod,
        }
      : rawFinancials;

    // 4. Layanan terlaris hari ini
    const topServicesRes = await db.query<{
      service_id: string;
      name_snapshot: string;
      quantity: number;
      revenue_idr: number;
    }>(
      `SELECT ti.service_id, ti.name_snapshot, SUM(ti.quantity)::int as quantity, SUM(ti.line_total_idr)::int as revenue_idr
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id AND t.tenant_id = ti.tenant_id
       WHERE ti.tenant_id = $1 AND ti.kind = 'service' AND t.occurred_at::date = $2::date
       GROUP BY ti.service_id, ti.name_snapshot`,
      [tenantId, dateStr],
    );

    const topServices = rankTop(
      topServicesRes.rows.map((s) => ({
        key: s.service_id,
        name: s.name_snapshot,
        quantity: s.quantity,
        revenueIdr: s.revenue_idr,
      })),
      5,
    );

    // 5. Kapster terbaik hari ini (hanya ditampilkan untuk owner)
    let topBarbers: RankedEntry[] = [];
    if (auth.role === "owner") {
      const topBarbersRes = await db.query<{
        barber_id: string;
        barber_name: string;
        quantity: number;
        revenue_idr: number;
      }>(
        `SELECT t.barber_id, b.display_name as barber_name, COUNT(t.id)::int as quantity, SUM(t.total_idr)::int as revenue_idr
         FROM transactions t
         JOIN barbers b ON b.id = t.barber_id AND b.tenant_id = t.tenant_id
         WHERE t.tenant_id = $1 AND t.occurred_at::date = $2::date
         GROUP BY t.barber_id, b.display_name`,
        [tenantId, dateStr],
      );

      topBarbers = rankTop(
        topBarbersRes.rows.map((b) => ({
          key: b.barber_id,
          name: b.barber_name,
          quantity: b.quantity,
          revenueIdr: b.revenue_idr,
        })),
        5,
      );
    }

    return {
      date: dateStr,
      financials,
      topServices,
      topBarbers,
    };
  });

  return c.json(report);
});

// GET /api/reports/monthly?year=YYYY&month=M
reportRoutes.get("/monthly", async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const now = new Date();
  const year = parseInt(c.req.query("year") || String(now.getFullYear()), 10);
  const month = parseInt(c.req.query("month") || String(now.getMonth() + 1), 10);

  const report = await withTenant(tenantId, async (db) => {
    // 1. Transaksi bulan ini
    const txRes = await db.query<{
      total_idr: number;
      payment_method: PaymentMethod;
      day: number;
    }>(
      `SELECT total_idr, payment_method, EXTRACT(DAY FROM occurred_at)::int as day
       FROM transactions
       WHERE tenant_id = $1
         AND EXTRACT(YEAR FROM occurred_at) = $2
         AND EXTRACT(MONTH FROM occurred_at) = $3`,
      [tenantId, year, month],
    );

    // 2. Pengeluaran bulan ini
    const expRes = await db.query<{ amount_idr: number; day: number }>(
      `SELECT amount_idr, EXTRACT(DAY FROM expense_date)::int as day
       FROM expenses
       WHERE tenant_id = $1
         AND EXTRACT(YEAR FROM expense_date) = $2
         AND EXTRACT(MONTH FROM expense_date) = $3`,
      [tenantId, year, month],
    );

    // 3. Komisi bulan ini (hanya untuk owner)
    let commissionsIdr = 0;
    if (auth.role === "owner") {
      const commRes = await db.query<{ total_comm: string }>(
        `SELECT COALESCE(SUM(ce.amount_idr), 0)::text as total_comm
         FROM commission_entries ce
         JOIN transactions t ON t.id = ce.transaction_id AND t.tenant_id = ce.tenant_id
         WHERE ce.tenant_id = $1
           AND EXTRACT(YEAR FROM t.occurred_at) = $2
           AND EXTRACT(MONTH FROM t.occurred_at) = $3`,
        [tenantId, year, month],
      );
      commissionsIdr = Number(commRes.rows[0]?.total_comm || 0);
    }

    const rawFinancials = summarizeFinancials({
      transactions: txRes.rows.map((t) => ({ totalIdr: t.total_idr, paymentMethod: t.payment_method })),
      expenses: expRes.rows.map((e) => ({ amountIdr: e.amount_idr })),
      commissionsIdr,
    });

    const financials = auth.role === "cashier"
      ? {
          revenueIdr: rawFinancials.revenueIdr,
          expensesIdr: rawFinancials.expensesIdr,
          commissionsIdr: 0,
          profitIdr: 0,
          transactionCount: rawFinancials.transactionCount,
          byPaymentMethod: rawFinancials.byPaymentMethod,
        }
      : rawFinancials;

    // 4. Layanan terlaris bulanan
    const topServicesRes = await db.query<{
      service_id: string;
      name_snapshot: string;
      quantity: number;
      revenue_idr: number;
    }>(
      `SELECT ti.service_id, ti.name_snapshot, SUM(ti.quantity)::int as quantity, SUM(ti.line_total_idr)::int as revenue_idr
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id AND t.tenant_id = ti.tenant_id
       WHERE ti.tenant_id = $1 AND ti.kind = 'service'
         AND EXTRACT(YEAR FROM t.occurred_at) = $2
         AND EXTRACT(MONTH FROM t.occurred_at) = $3
       GROUP BY ti.service_id, ti.name_snapshot`,
      [tenantId, year, month],
    );

    const topServices = rankTop(
      topServicesRes.rows.map((s) => ({
        key: s.service_id,
        name: s.name_snapshot,
        quantity: s.quantity,
        revenueIdr: s.revenue_idr,
      })),
      5,
    );

    // 5. Kapster terbaik bulanan (hanya untuk owner)
    let topBarbers: RankedEntry[] = [];
    if (auth.role === "owner") {
      const topBarbersRes = await db.query<{
        barber_id: string;
        barber_name: string;
        quantity: number;
        revenue_idr: number;
      }>(
        `SELECT t.barber_id, b.display_name as barber_name, COUNT(t.id)::int as quantity, SUM(t.total_idr)::int as revenue_idr
         FROM transactions t
         JOIN barbers b ON b.id = t.barber_id AND b.tenant_id = t.tenant_id
         WHERE t.tenant_id = $1
           AND EXTRACT(YEAR FROM t.occurred_at) = $2
           AND EXTRACT(MONTH FROM t.occurred_at) = $3
         GROUP BY t.barber_id, b.display_name`,
        [tenantId, year, month],
      );

      topBarbers = rankTop(
        topBarbersRes.rows.map((b) => ({
          key: b.barber_id,
          name: b.barber_name,
          quantity: b.quantity,
          revenueIdr: b.revenue_idr,
        })),
        5,
      );
    }

    return {
      year,
      month,
      financials,
      topServices,
      topBarbers,
    };
  });

  return c.json(report);
});

