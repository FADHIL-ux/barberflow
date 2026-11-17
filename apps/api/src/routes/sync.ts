import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  calculateReceiptTotals,
  calculateTransactionCommission,
  offlineSyncBatchSchema,
  type CommissionRule,
} from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const syncRoutes = new Hono<AppEnv>();
syncRoutes.use("*", authenticate);
syncRoutes.use("*", requireRole("owner", "cashier"));

interface SyncResultItem {
  tempReceiptRef: string;
  id: string;
  receiptNumber: string;
  publicToken: string;
  status: "synced" | "already_synced";
}

// POST /api/sync -> Batch submit transaksi yang dibuat secara offline
syncRoutes.post("/", async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const input = await parseBody(c, offlineSyncBatchSchema);

  const results: SyncResultItem[] = [];

  await withTenant(tenantId, async (db) => {
    for (const txItem of input.transactions) {
      // 1. Cek apakah transaksi sudah tersinkronkan sebelumnya (idempotency key)
      const existing = await db.query<{ id: string; receipt_number: string }>(
        `SELECT id, receipt_number::text FROM transactions
         WHERE tenant_id = $1 AND idempotency_key = $2`,
        [tenantId, txItem.idempotencyKey],
      );

      if (existing.rows[0]) {
        results.push({
          tempReceiptRef: txItem.tempReceiptRef,
          id: existing.rows[0].id,
          receiptNumber: existing.rows[0].receipt_number,
          publicToken: "",
          status: "already_synced",
        });
        continue;
      }

      // 2. Resolve snapshot data harga item dari DB
      const resolvedItems: Array<{
        kind: "service" | "product";
        refId: string;
        name: string;
        unitPriceIdr: number;
        quantity: number;
      }> = [];

      for (const item of txItem.items) {
        if (item.kind === "service") {
          const sRes = await db.query<{ name: string; price_idr: number }>(
            `SELECT name, price_idr FROM services WHERE id = $1 AND tenant_id = $2`,
            [item.refId, tenantId],
          );
          const svc = sRes.rows[0];
          resolvedItems.push({
            kind: "service",
            refId: item.refId,
            name: svc?.name ?? "Layanan",
            unitPriceIdr: svc?.price_idr ?? 0,
            quantity: item.quantity,
          });
        } else {
          const pRes = await db.query<{ name: string; price_idr: number }>(
            `SELECT name, price_idr FROM products WHERE id = $1 AND tenant_id = $2`,
            [item.refId, tenantId],
          );
          const prod = pRes.rows[0];
          resolvedItems.push({
            kind: "product",
            refId: item.refId,
            name: prod?.name ?? "Produk",
            unitPriceIdr: prod?.price_idr ?? 0,
            quantity: item.quantity,
          });
        }
      }

      // 3. Kalkulasi total
      const totals = calculateReceiptTotals(
        resolvedItems.map((i) => ({ unitPriceIdr: i.unitPriceIdr, quantity: i.quantity })),
        txItem.discountType === "none"
          ? { type: "none" }
          : txItem.discountType === "percent"
            ? { type: "percent", value: txItem.discountValue }
            : { type: "fixed", value: txItem.discountValue },
      );

      // 4. Nomor urut struk final server dari receipt_counters (FOR UPDATE)
      const counterRes = await db.query<{ last_number: string }>(
        `SELECT last_number::text FROM receipt_counters WHERE tenant_id = $1 FOR UPDATE`,
        [tenantId],
      );
      const nextReceiptNumber = BigInt(counterRes.rows[0]?.last_number ?? 0) + 1n;
      await db.query(`UPDATE receipt_counters SET last_number = $1 WHERE tenant_id = $2`, [
        nextReceiptNumber.toString(),
        tenantId,
      ]);

      // 5. Token nota publik
      const rawPublicToken = randomBytes(24).toString("hex");
      const publicTokenHash = createHash("sha256").update(rawPublicToken).digest("hex");

      const occurredAt = new Date(txItem.occurredAt);

      // 6. Simpan transaksi dengan temp_receipt_ref tersimpan untuk rekonsiliasi
      const insertTxRes = await db.query<{ id: string }>(
        `INSERT INTO transactions (
          tenant_id, receipt_number, temp_receipt_ref, idempotency_key, customer_id, barber_id,
          subtotal_idr, discount_type, discount_value, discount_idr, total_idr,
          payment_method, created_by, occurred_at, public_token_hash
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING id`,
        [
          tenantId,
          nextReceiptNumber.toString(),
          txItem.tempReceiptRef,
          txItem.idempotencyKey,
          txItem.customerId ?? null,
          txItem.barberId ?? null,
          totals.subtotalIdr,
          txItem.discountType,
          txItem.discountValue,
          totals.discountIdr,
          totals.totalIdr,
          txItem.paymentMethod,
          auth.userId,
          occurredAt,
          publicTokenHash,
        ],
      );
      const txId = insertTxRes.rows[0]!.id;

      // 7. Simpan items
      const insertedItemIds: Array<{ id: string; refId: string; kind: string }> = [];
      for (let pos = 0; pos < resolvedItems.length; pos++) {
        const i = resolvedItems[pos]!;
        const lineTotal = i.unitPriceIdr * i.quantity;
        const itemRes = await db.query<{ id: string }>(
          `INSERT INTO transaction_items (
            tenant_id, transaction_id, position, kind, service_id, product_id,
            name_snapshot, unit_price_idr, quantity, line_total_idr
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            tenantId,
            txId,
            pos + 1,
            i.kind,
            i.kind === "service" ? i.refId : null,
            i.kind === "product" ? i.refId : null,
            i.name,
            i.unitPriceIdr,
            i.quantity,
            lineTotal,
          ],
        );
        insertedItemIds.push({ id: itemRes.rows[0]!.id, refId: i.refId, kind: i.kind });

        if (i.kind === "product") {
          await db.query(
            `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - $1)
             WHERE id = $2 AND tenant_id = $3`,
            [i.quantity, i.refId, tenantId],
          );
        }
      }

      // 8. Komisi otomatis jika kapster diisi
      if (txItem.barberId) {
        const rulesRes = await db.query<{ service_id: string; type: "percent" | "fixed"; value: string }>(
          `SELECT service_id, type, value::text FROM commission_rules
           WHERE tenant_id = $1 AND (barber_id = $2 OR barber_id IS NULL)`,
          [tenantId, txItem.barberId],
        );

        const rulesMap: Record<string, CommissionRule> = {};
        for (const r of rulesRes.rows) {
          rulesMap[r.service_id] = { type: r.type, value: Number(r.value) };
        }

        const commCalc = calculateTransactionCommission(
          resolvedItems.map((i) => ({
            kind: i.kind,
            refId: i.refId,
            unitPriceIdr: i.unitPriceIdr,
            quantity: i.quantity,
          })),
          totals.discountIdr,
          rulesMap,
        );

        for (const cl of commCalc.lines) {
          const matchedItem = insertedItemIds.find((i) => i.refId === cl.refId && i.kind === "service");
          if (matchedItem && cl.commissionIdr > 0) {
            const ruleObj = rulesMap[cl.refId]!;
            await db.query(
              `INSERT INTO commission_entries (
                tenant_id, transaction_id, transaction_item_id, barber_id, amount_idr, rule_snapshot
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [tenantId, txId, matchedItem.id, txItem.barberId, cl.commissionIdr, JSON.stringify(ruleObj)],
            );
          }
        }
      }

      await writeAudit(db, auth, "sync.offline_transaction", "transaction", txId, {
        tempReceiptRef: txItem.tempReceiptRef,
        receiptNumber: nextReceiptNumber.toString(),
        totalIdr: totals.totalIdr,
      });

      results.push({
        tempReceiptRef: txItem.tempReceiptRef,
        id: txId,
        receiptNumber: nextReceiptNumber.toString(),
        publicToken: rawPublicToken,
        status: "synced",
      });
    }
  });

  return c.json({ syncedCount: results.length, items: results });
});

