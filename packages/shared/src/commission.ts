import { allocateDiscount, calculateLineTotal } from "./money.ts";

export interface CommissionRule {
  type: "percent" | "fixed";
  value: number;
}

export interface CommissionLineInput {
  kind: "service" | "product";
  /** serviceId for services, productId for products. */
  refId: string;
  unitPriceIdr: number;
  quantity: number;
}

export interface CommissionLineResult {
  refId: string;
  netAmountIdr: number;
  commissionIdr: number;
}

/**
 * Commission for one service line.
 * - percent: share of the line amount AFTER its proportional discount, rounded to the nearest Rupiah.
 * - fixed: nominal amount per unit, capped so it never exceeds the net line amount.
 */
export function calculateLineCommission(rule: CommissionRule, netAmountIdr: number, quantity: number): number {
  if (rule.value < 0) throw new RangeError("Nilai komisi tidak boleh negatif");
  if (rule.type === "percent") {
    if (rule.value > 100) throw new RangeError("Komisi persen maksimal 100");
    return Math.round((netAmountIdr * rule.value) / 100);
  }
  if (!Number.isInteger(rule.value)) throw new RangeError("Komisi nominal harus bilangan bulat Rupiah");
  return Math.min(rule.value * quantity, netAmountIdr);
}

/** Only service lines earn commission. Products and services without a rule earn nothing. */
export function calculateTransactionCommission(
  lines: readonly CommissionLineInput[],
  discountIdr: number,
  rulesByServiceId: Readonly<Record<string, CommissionRule | undefined>>,
): { lines: CommissionLineResult[]; totalIdr: number } {
  const lineTotals = lines.map((l) => calculateLineTotal(l));
  const discountShares = allocateDiscount(lineTotals, discountIdr);

  const results: CommissionLineResult[] = [];
  lines.forEach((line, i) => {
    if (line.kind !== "service") return;
    const rule = rulesByServiceId[line.refId];
    if (!rule) return;
    const netAmountIdr = (lineTotals[i] ?? 0) - (discountShares[i] ?? 0);
    results.push({
      refId: line.refId,
      netAmountIdr,
      commissionIdr: calculateLineCommission(rule, netAmountIdr, line.quantity),
    });
  });

  return { lines: results, totalIdr: results.reduce((s, r) => s + r.commissionIdr, 0) };
}
