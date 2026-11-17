// All money is integer Rupiah. No floating point money is ever stored.

export type DiscountInput =
  | { type: "none" }
  | { type: "percent"; value: number }
  | { type: "fixed"; value: number };

export interface LineInput {
  unitPriceIdr: number;
  quantity: number;
}

export interface ReceiptTotals {
  subtotalIdr: number;
  discountIdr: number;
  totalIdr: number;
}

function assertLine(line: LineInput): void {
  if (!Number.isInteger(line.unitPriceIdr) || line.unitPriceIdr < 0) {
    throw new RangeError("Harga harus berupa bilangan bulat Rupiah >= 0");
  }
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    throw new RangeError("Jumlah harus berupa bilangan bulat >= 1");
  }
}

export function calculateLineTotal(line: LineInput): number {
  assertLine(line);
  return line.unitPriceIdr * line.quantity;
}

export function calculateSubtotal(lines: readonly LineInput[]): number {
  return lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
}

/** Discount in Rupiah, never larger than the subtotal. Percent is rounded to the nearest Rupiah. */
export function calculateDiscount(subtotalIdr: number, discount: DiscountInput): number {
  if (discount.type === "none") return 0;
  if (!Number.isFinite(discount.value) || discount.value < 0) {
    throw new RangeError("Nilai diskon tidak boleh negatif");
  }
  if (discount.type === "percent") {
    if (discount.value > 100) throw new RangeError("Diskon persen maksimal 100");
    return Math.min(subtotalIdr, Math.round((subtotalIdr * discount.value) / 100));
  }
  if (!Number.isInteger(discount.value)) {
    throw new RangeError("Diskon nominal harus berupa bilangan bulat Rupiah");
  }
  return Math.min(subtotalIdr, discount.value);
}

export function calculateReceiptTotals(
  lines: readonly LineInput[],
  discount: DiscountInput = { type: "none" },
): ReceiptTotals {
  const subtotalIdr = calculateSubtotal(lines);
  const discountIdr = calculateDiscount(subtotalIdr, discount);
  return { subtotalIdr, discountIdr, totalIdr: subtotalIdr - discountIdr };
}

/**
 * Splits a discount across lines in proportion to their totals.
 * Uses the largest-remainder method so the shares always add up to exactly `discountIdr`.
 */
export function allocateDiscount(lineTotals: readonly number[], discountIdr: number): number[] {
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  if (discountIdr === 0 || subtotal === 0) return lineTotals.map(() => 0);
  if (discountIdr > subtotal) throw new RangeError("Diskon melebihi subtotal");

  const exact = lineTotals.map((t) => (discountIdr * t) / subtotal);
  const shares = exact.map((x) => Math.floor(x));
  let remainder = discountIdr - shares.reduce((a, b) => a + b, 0);

  const order = exact
    .map((x, index) => ({ index, fraction: x - Math.floor(x) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const { index } of order) {
    if (remainder === 0) break;
    shares[index] = (shares[index] ?? 0) + 1;
    remainder -= 1;
  }
  return shares;
}
