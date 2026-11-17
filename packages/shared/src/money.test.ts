import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateDiscount, calculateDiscount, calculateReceiptTotals } from "./money.ts";

test("subtotal, diskon persen, dan total", () => {
  const r = calculateReceiptTotals([{ unitPriceIdr: 50000, quantity: 1 }, { unitPriceIdr: 25000, quantity: 2 }], { type: "percent", value: 10 });
  assert.deepEqual(r, { subtotalIdr: 100000, discountIdr: 10000, totalIdr: 90000 });
});

test("tanpa diskon", () => {
  const r = calculateReceiptTotals([{ unitPriceIdr: 30000, quantity: 3 }]);
  assert.deepEqual(r, { subtotalIdr: 90000, discountIdr: 0, totalIdr: 90000 });
});

test("diskon persen dibulatkan ke Rupiah terdekat", () => {
  const r = calculateReceiptTotals([{ unitPriceIdr: 33333, quantity: 3 }], { type: "percent", value: 10 });
  assert.deepEqual(r, { subtotalIdr: 99999, discountIdr: 10000, totalIdr: 89999 });
});

test("diskon nominal tidak boleh melebihi subtotal", () => {
  const r = calculateReceiptTotals([{ unitPriceIdr: 100000, quantity: 1 }], { type: "fixed", value: 150000 });
  assert.deepEqual(r, { subtotalIdr: 100000, discountIdr: 100000, totalIdr: 0 });
});

test("input tidak valid ditolak", () => {
  assert.throws(() => calculateReceiptTotals([{ unitPriceIdr: 1000, quantity: 0 }]), RangeError);
  assert.throws(() => calculateReceiptTotals([{ unitPriceIdr: -1, quantity: 1 }]), RangeError);
  assert.throws(() => calculateReceiptTotals([{ unitPriceIdr: 10.5, quantity: 1 }]), RangeError);
  assert.throws(() => calculateDiscount(1000, { type: "percent", value: 101 }), RangeError);
  assert.throws(() => calculateDiscount(1000, { type: "fixed", value: -5 }), RangeError);
  assert.throws(() => calculateDiscount(1000, { type: "fixed", value: 10.5 }), RangeError);
});

test("allocateDiscount selalu berjumlah tepat sama dengan diskon", () => {
  assert.deepEqual(allocateDiscount([50000, 50000], 10001), [5001, 5000]);
  assert.deepEqual(allocateDiscount([10000, 20000, 30000], 1000), [167, 333, 500]);
  assert.deepEqual(allocateDiscount([10000, 20000], 0), [0, 0]);
  for (const d of [1, 7, 999, 12345, 59999]) {
    const shares = allocateDiscount([11111, 22222, 26666], d);
    assert.equal(shares.reduce((a, b) => a + b, 0), d);
  }
});
