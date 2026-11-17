import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateLineCommission, calculateTransactionCommission } from "./commission.ts";

test("komisi persen dihitung dari nilai setelah diskon", () => {
  const r = calculateTransactionCommission(
    [
      { kind: "service", refId: "A", unitPriceIdr: 50000, quantity: 1 },
      { kind: "service", refId: "B", unitPriceIdr: 30000, quantity: 1 },
      { kind: "product", refId: "P", unitPriceIdr: 20000, quantity: 1 },
    ],
    10000,
    { A: { type: "percent", value: 40 }, B: { type: "fixed", value: 5000 } },
  );
  assert.deepEqual(r.lines, [
    { refId: "A", netAmountIdr: 45000, commissionIdr: 18000 },
    { refId: "B", netAmountIdr: 27000, commissionIdr: 5000 },
  ]);
  assert.equal(r.totalIdr, 23000);
});

test("komisi nominal dikali jumlah dan tidak melebihi nilai bersih", () => {
  assert.equal(calculateLineCommission({ type: "fixed", value: 5000 }, 40000, 2), 10000);
  assert.equal(calculateLineCommission({ type: "fixed", value: 5000 }, 2000, 1), 2000);
});

test("produk dan layanan tanpa aturan tidak menghasilkan komisi", () => {
  const r = calculateTransactionCommission(
    [
      { kind: "service", refId: "X", unitPriceIdr: 40000, quantity: 1 },
      { kind: "product", refId: "P", unitPriceIdr: 20000, quantity: 1 },
    ],
    0,
    { P: { type: "percent", value: 50 } },
  );
  assert.deepEqual(r, { lines: [], totalIdr: 0 });
});

test("pembulatan komisi persen", () => {
  assert.equal(calculateLineCommission({ type: "percent", value: 33 }, 10001, 1), 3300);
  assert.equal(calculateLineCommission({ type: "percent", value: 0 }, 50000, 1), 0);
});

test("aturan komisi tidak valid ditolak", () => {
  assert.throws(() => calculateLineCommission({ type: "percent", value: 101 }, 1000, 1), RangeError);
  assert.throws(() => calculateLineCommission({ type: "fixed", value: -1 }, 1000, 1), RangeError);
  assert.throws(() => calculateLineCommission({ type: "fixed", value: 1.5 }, 1000, 1), RangeError);
});
