import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  calculateReceiptTotals,
  calculateTransactionCommission,
  createTransactionSchema,
  type CommissionRule,
} from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const transactionRoutes = new Hono<AppEnv>();
transactionRoutes.use("*", authenticate);

interface TransactionListRow {
  id: string;
  receipt_number: string;
  temp_receipt_ref: string | null;
  customer_name: string | null;
  barber_name: string | null;
  subtotal_idr: number;
  discount_idr: number;
  total_idr: number;
  payment_method: string;
  occurred_at: string;
  items_count: number;
}

// GET /api/transactions -> Daftar transaksi terakhir
transactionRoutes.get("/", async (c) => {
  const tenantId = tenantIdOf(c);
  const rows = await withTenant(tenantId, async (db) => {
    const q = `
      SELECT 
        t.id,
        t.receipt_number::text,
        t.temp_receipt_ref,
        c.name as customer_name,
        b.display_name as barber_name,
        t.subtotal_idr,
        t.discount_idr,
        t.total_idr,
        t.payment_method,
        t.occurred_at,
        COUNT(ti.id)::int as items_count
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id AND c.tenant_id = t.tenant_id
      LEFT JOIN barbers b ON b.id = t.barber_id AND b.tenant_id = t.tenant_id
      LEFT JOIN transaction_items ti ON ti.transaction_id = t.id AND ti.tenant_id = t.tenant_id
      WHERE t.tenant_id = $1
      GROUP BY t.id, c.name, b.display_name
      ORDER BY t.occurred_at DESC
      LIMIT 100
    `;
    const res = await db.query<TransactionListRow>(q, [tenantId]);
    return res.rows;
  });

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      receiptNumber: r.receipt_number,
      tempReceiptRef: r.temp_receipt_ref,
      customerName: r.customer_name,
      barberName: r.barber_name,
      subtotalIdr: r.subtotal_idr,
      discountIdr: r.discount_idr,
      totalIdr: r.total_idr,
      paymentMethod: r.payment_method,
      occurredAt: r.occurred_at,
      itemsCount: r.items_count,
    })),
  });
});

// GET /api/transactions/:id/receipt -> Detail struk transaksi
transactionRoutes.get("/:id/receipt", async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));

  const receipt = await withTenant(tenantId, async (db) => {
    // 1. Ambil transaksi & barbershop profile
    const txQ = `
      SELECT 
        t.id,
        t.receipt_number::text,
        t.occurred_at,
        t.subtotal_idr,
        t.discount_idr,
        t.total_idr,
        t.payment_method,
        b.display_name as barber_name,
        tn.name as barbershop_name,
        tp.address,
        tp.phone as barbershop_phone,
        tp.receipt_footer,
        tp.paper_width_mm
      FROM transactions t
      JOIN tenants tn ON tn.id = t.tenant_id
      JOIN tenant_profiles tp ON tp.tenant_id = t.tenant_id
      LEFT JOIN barbers b ON b.id = t.barber_id AND b.tenant_id = t.tenant_id
      WHERE t.id = $1 AND t.tenant_id = $2
    `;
    const txRes = await db.query(txQ, [id, tenantId]);
    const tx = txRes.rows[0];
    if (!tx) return null;

    // 2. Ambil items
    const itemsRes = await db.query(
      `SELECT name_snapshot, unit_price_idr, quantity, line_total_idr, kind
       FROM transaction_items
       WHERE transaction_id = $1 AND tenant_id = $2
       ORDER BY position ASC`,
      [id, tenantId],
    );

    return {
      id: tx.id,
      receiptNumber: tx.receipt_number,
      occurredAt: tx.occurred_at,
      subtotalIdr: tx.subtotal_idr,
      discountIdr: tx.discount_idr,
      totalIdr: tx.total_idr,
      paymentMethod: tx.payment_method,
      barberName: tx.barber_name,
      barbershopName: tx.barbershop_name,
      address: tx.address,
      phone: tx.barbershop_phone,
      receiptFooter: tx.receipt_footer,
      paperWidthMm: tx.paper_width_mm,
      items: itemsRes.rows.map((i) => ({
        name: i.name_snapshot,
        unitPriceIdr: i.unit_price_idr,
        quantity: i.quantity,
        lineTotalIdr: i.line_total_idr,
        kind: i.kind,
      })),
    };
  });

  if (!receipt) {
    throw new HTTPException(404, { message: "Struk transaksi tidak ditemukan." });
  }

  return c.json(receipt);
});

// POST /api/transactions/:id/reprint -> Catat cetak ulang di audit log
transactionRoutes.post("/:id/reprint", requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");

  await withTenant(tenantId, async (db) => {
    const txRes = await db.query<{ receipt_number: string }>(
      `SELECT receipt_number::text FROM transactions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const tx = txRes.rows[0];
    if (!tx) throw new HTTPException(404, { message: "Transaksi tidak ditemukan." });

    await writeAudit(db, auth, "receipt.reprint", "transaction", id, {
      receiptNumber: tx.receipt_number,
    });
  });

  return c.json({ ok: true });
});

// POST /api/transactions -> Buat transaksi kasir
transactionRoutes.post("/", requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const input = await parseBody(c, createTransactionSchema);

  try {
    const result = await withTenant(tenantId, async (db) => {
      // 1. Cek idempotency key
      const existing = await db.query<{ id: string; receipt_number: string }>(
        `SELECT id, receipt_number::text FROM transactions WHERE tenant_id = $1 AND idempotency_key = $2`,
        [tenantId, input.idempotencyKey],
      );
      if (existing.rows[0]) {
        return {
          id: existing.rows[0].id,
          receiptNumber: existing.rows[0].receipt_number,
          idempotent: true,
        };
      }

      // 2. Resolve items snapshot & validasi harga dari DB
      const resolvedItems: Array<{
        kind: "service" | "product";
        refId: string;
        name: string;
        unitPriceIdr: number;
        quantity: number;
      }> = [];

      for (const item of input.items) {
        if (item.kind === "service") {
          const sRes = await db.query<{ name: string; price_idr: number }>(
            `SELECT name, price_idr FROM services WHERE id = $1 AND tenant_id = $2`,
            [item.refId, tenantId],
          );
          const svc = sRes.rows[0];
          if (!svc) throw new HTTPException(400, { message: `Layanan dengan ID ${item.refId} tidak ditemukan.` });
          resolvedItems.push({
            kind: "service",
            refId: item.refId,
            name: svc.name,
            unitPriceIdr: svc.price_idr,
            quantity: item.quantity,
          });
        } else {
          const pRes = await db.query<{ name: string; price_idr: number; stock_quantity: number }>(
            `SELECT name, price_idr, stock_quantity FROM products WHERE id = $1 AND tenant_id = $2`,
            [item.refId, tenantId],
          );
          const prod = pRes.rows[0];
          if (!prod) throw new HTTPException(400, { message: `Produk dengan ID ${item.refId} tidak ditemukan.` });
          resolvedItems.push({
            kind: "product",
            refId: item.refId,
            name: prod.name,
            unitPriceIdr: prod.price_idr,
            quantity: item.quantity,
          });
        }
      }

      // 3. Kalkulasi total menggunakan modul @barberflow/shared
      const totals = calculateReceiptTotals(
        resolvedItems.map((i) => ({ unitPriceIdr: i.unitPriceIdr, quantity: i.quantity })),
        input.discountType === "none"
          ? { type: "none" }
          : input.discountType === "percent"
            ? { type: "percent", value: input.discountValue }
            : { type: "fixed", value: input.discountValue },
      );

      // 4. Nomor urut struk final dari server (FOR UPDATE pada receipt_counters)
      const counterRes = await db.query<{ last_number: string }>(
        `SELECT last_number::text FROM receipt_counters WHERE tenant_id = $1 FOR UPDATE`,
        [tenantId],
      );
      const nextReceiptNumber = BigInt(counterRes.rows[0]?.last_number ?? 0) + 1n;
      await db.query(`UPDATE receipt_counters SET last_number = $1 WHERE tenant_id = $2`, [
        nextReceiptNumber.toString(),
        tenantId,
      ]);

      // 5. Generate token acak untuk public receipt
      const rawPublicToken = randomBytes(24).toString("hex");
      const publicTokenHash = createHash("sha256").update(rawPublicToken).digest("hex");

      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

      // 6. Insert ke tabel transactions
      const txRes = await db.query<{ id: string }>(
        `INSERT INTO transactions (
          tenant_id, receipt_number, idempotency_key, customer_id, barber_id, queue_entry_id,
          subtotal_idr, discount_type, discount_value, discount_idr, total_idr,
          payment_method, created_by, occurred_at, public_token_hash
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) RETURNING id`,
        [
          tenantId,
          nextReceiptNumber.toString(),
          input.idempotencyKey,
          input.customerId ?? null,
          input.barberId ?? null,
          input.queueEntryId ?? null,
          totals.subtotalIdr,
          input.discountType,
          input.discountValue,
          totals.discountIdr,
          totals.totalIdr,
          input.paymentMethod,
          auth.userId,
          occurredAt,
          publicTokenHash,
        ],
      );
      const txId = txRes.rows[0]!.id;

      // 7. Insert items
      const insertedItemIds: Array<{ id: string; refId: string; kind: string }> = [];
      for (let pos = 0; pos < resolvedItems.length; pos++) {
        const item = resolvedItems[pos]!;
        const lineTotal = item.unitPriceIdr * item.quantity;
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
            item.kind,
            item.kind === "service" ? item.refId : null,
            item.kind === "product" ? item.refId : null,
            item.name,
            item.unitPriceIdr,
            item.quantity,
            lineTotal,
          ],
        );
        insertedItemIds.push({ id: itemRes.rows[0]!.id, refId: item.refId, kind: item.kind });

        // Update stok produk jika retail
        if (item.kind === "product") {
          await db.query(
            `UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - $1)
             WHERE id = $2 AND tenant_id = $3`,
            [item.quantity, item.refId, tenantId],
          );
        }
      }

      // 8. Hitung dan simpan komisi otomatis jika kapster ditentukan
      if (input.barberId) {
        // Ambil aturan komisi untuk layanan ini
        const rulesRes = await db.query<{ service_id: string; type: "percent" | "fixed"; value: string }>(
          `SELECT service_id, type, value::text FROM commission_rules
           WHERE tenant_id = $1 AND (barber_id = $2 OR barber_id IS NULL)`,
          [tenantId, input.barberId],
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
              [
                tenantId,
                txId,
                matchedItem.id,
                input.barberId,
                cl.commissionIdr,
                JSON.stringify(ruleObj),
              ],
            );
          }
        }
      }

      // 9. Jika transaksi terhubung dengan antrean, update status antrean menjadi 'done'
      if (input.queueEntryId) {
        await db.query(
          `UPDATE queue_entries SET status = 'done', updated_at = now()
           WHERE id = $1 AND tenant_id = $2`,
          [input.queueEntryId, tenantId],
        );
      }

      await writeAudit(db, auth, "transaction.create", "transaction", txId, {
        receiptNumber: nextReceiptNumber.toString(),
        totalIdr: totals.totalIdr,
        paymentMethod: input.paymentMethod,
      });

      return {
        id: txId,
        receiptNumber: nextReceiptNumber.toString(),
        publicToken: rawPublicToken,
        totals,
        idempotent: false,
      };
    });

    return c.json(result, 201);
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      throw new HTTPException(409, { message: "Transaksi dengan kunci idempotensi ini telah diproses." });
    }
    throw err;
  }
});

// DELETE /api/transactions/clear-all -> Bersihkan seluruh riwayat transaksi tenant & reset counter nota & antrean selesai (Khusus Owner)
transactionRoutes.delete("/clear-all", requireRole("owner"), async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");

  const count = await withTenant(tenantId, async (db) => {
    // 1. Hapus transaksi
    const res = await db.query(
      `DELETE FROM transactions WHERE tenant_id = $1`,
      [tenantId],
    );
    // 2. Hapus antrean yang sudah selesai ('done') agar kolom "Selesai Hari Ini" ikut bersih
    await db.query(
      `DELETE FROM queue_entries WHERE tenant_id = $1 AND status = 'done'`,
      [tenantId],
    );
    // 3. Reset nomor urut struk kembali ke 0
    await db.query(
      `UPDATE receipt_counters SET last_number = 0 WHERE tenant_id = $1`,
      [tenantId],
    );
    await writeAudit(db, auth, "transaction.clear_all", "tenant", tenantId, {
      deletedCount: res.rowCount,
    });
    return res.rowCount ?? 0;
  });

  return c.json({ ok: true, message: "Seluruh riwayat transaksi dan antrean selesai berhasil dibersihkan.", deletedCount: count });
});

// DELETE /api/transactions/:id -> Hapus transaksi tertentu (Khusus Owner)
transactionRoutes.delete("/:id", requireRole("owner"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");

  const deleted = await withTenant(tenantId, async (db) => {
    const txRes = await db.query<{ receipt_number: string; queue_entry_id: string | null }>(
      `SELECT receipt_number::text, queue_entry_id FROM transactions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const tx = txRes.rows[0];
    if (!tx) return false;

    // Hapus transaksi
    await db.query(`DELETE FROM transactions WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);

    // Jika transaksi terhubung dengan antrean, hapus antrean selesai terkait
    if (tx.queue_entry_id) {
      await db.query(`DELETE FROM queue_entries WHERE id = $1 AND tenant_id = $2`, [tx.queue_entry_id, tenantId]);
    }

    await writeAudit(db, auth, "transaction.delete", "transaction", id, {
      receiptNumber: tx.receipt_number,
    });
    return true;
  });

  if (!deleted) throw new HTTPException(404, { message: "Transaksi tidak ditemukan." });
  return c.json({ ok: true, message: "Transaksi dan antrean terkait berhasil dihapus." });
});

