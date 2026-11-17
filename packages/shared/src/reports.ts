export type PaymentMethod = "cash" | "qris" | "transfer";

export interface FinancialSummary {
  revenueIdr: number;
  expensesIdr: number;
  commissionsIdr: number;
  /** Net profit = revenue - expenses - commissions. */
  profitIdr: number;
  transactionCount: number;
  byPaymentMethod: Record<PaymentMethod, number>;
}

export function summarizeFinancials(input: {
  transactions: readonly { totalIdr: number; paymentMethod: PaymentMethod }[];
  expenses: readonly { amountIdr: number }[];
  commissionsIdr?: number;
}): FinancialSummary {
  const byPaymentMethod: Record<PaymentMethod, number> = { cash: 0, qris: 0, transfer: 0 };
  let revenueIdr = 0;
  for (const t of input.transactions) {
    revenueIdr += t.totalIdr;
    byPaymentMethod[t.paymentMethod] += t.totalIdr;
  }
  const expensesIdr = input.expenses.reduce((s, e) => s + e.amountIdr, 0);
  const commissionsIdr = input.commissionsIdr ?? 0;
  return {
    revenueIdr,
    expensesIdr,
    commissionsIdr,
    profitIdr: revenueIdr - expensesIdr - commissionsIdr,
    transactionCount: input.transactions.length,
    byPaymentMethod,
  };
}

export interface RankedEntry {
  key: string;
  name: string;
  quantity: number;
  revenueIdr: number;
}

/** Groups by key and ranks by quantity, then revenue, then name (stable and deterministic). */
export function rankTop(
  rows: readonly { key: string; name: string; quantity: number; revenueIdr: number }[],
  limit = 5,
): RankedEntry[] {
  const map = new Map<string, RankedEntry>();
  for (const row of rows) {
    const existing = map.get(row.key);
    if (existing) {
      existing.quantity += row.quantity;
      existing.revenueIdr += row.revenueIdr;
    } else {
      map.set(row.key, { ...row });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenueIdr - a.revenueIdr || a.name.localeCompare(b.name))
    .slice(0, limit);
}
