import { test } from "node:test";
import assert from "node:assert/strict";
import { rankTop, summarizeFinancials } from "./reports.ts";
import { resolveFeatures } from "./features.ts";

test("ringkasan keuangan: pendapatan, pengeluaran, keuntungan, metode bayar", () => {
  const s = summarizeFinancials({
    transactions: [
      { totalIdr: 90000, paymentMethod: "cash" },
      { totalIdr: 50000, paymentMethod: "qris" },
      { totalIdr: 60000, paymentMethod: "cash" },
    ],
    expenses: [{ amountIdr: 30000 }, { amountIdr: 20000 }],
    commissionsIdr: 25000,
  });
  assert.deepEqual(s, {
    revenueIdr: 200000,
    expensesIdr: 50000,
    commissionsIdr: 25000,
    profitIdr: 125000,
    transactionCount: 3,
    byPaymentMethod: { cash: 150000, qris: 50000, transfer: 0 },
  });
});

test("ringkasan kosong menghasilkan nol", () => {
  const s = summarizeFinancials({ transactions: [], expenses: [] });
  assert.equal(s.revenueIdr, 0);
  assert.equal(s.profitIdr, 0);
  assert.equal(s.transactionCount, 0);
});

test("keuntungan bisa negatif bila pengeluaran lebih besar", () => {
  const s = summarizeFinancials({ transactions: [{ totalIdr: 10000, paymentMethod: "transfer" }], expenses: [{ amountIdr: 50000 }] });
  assert.equal(s.profitIdr, -40000);
});

test("rankTop mengelompokkan lalu mengurutkan", () => {
  const top = rankTop([
    { key: "s1", name: "Potong Rambut", quantity: 2, revenueIdr: 100000 },
    { key: "s2", name: "Cukur Jenggot", quantity: 3, revenueIdr: 60000 },
    { key: "s1", name: "Potong Rambut", quantity: 2, revenueIdr: 100000 },
    { key: "s3", name: "Creambath", quantity: 4, revenueIdr: 120000 },
  ], 2);
  assert.deepEqual(top.map((t) => [t.key, t.quantity, t.revenueIdr]), [["s1", 4, 200000], ["s3", 4, 120000]]);
});

test("feature flag: Starter, Pro, dan override", () => {
  assert.equal(resolveFeatures("starter").commissions, false);
  assert.equal(resolveFeatures("starter").online_booking, false);
  assert.equal(resolveFeatures("pro").financial_reports, true);
  assert.equal(resolveFeatures("pro", { online_booking: false }).online_booking, false);
  assert.equal(resolveFeatures("starter", { commissions: true }).commissions, true);
  assert.equal(resolveFeatures("starter", { commissions: "yes", bogus: true }).commissions, false);
});
