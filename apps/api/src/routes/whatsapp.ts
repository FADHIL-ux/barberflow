import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  WHATSAPP_MONTHLY_QUOTA_PRO,
  sendWhatsAppSchema,
} from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody } from "../http.ts";
import { authenticate, requireFeature, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";
import { messageSender } from "../whatsapp.ts";

export const whatsappRoutes = new Hono<AppEnv>();
whatsappRoutes.use("*", authenticate);
whatsappRoutes.use("*", requireRole("owner", "cashier"));
whatsappRoutes.use("*", requireFeature("whatsapp_reminders")); // Gatekeeping Pro plan

// GET /api/whatsapp/quota -> Cek pemakaian kuota bulan ini (maks 100/bulan untuk Pro)
whatsappRoutes.get("/quota", async (c) => {
  const tenantId = tenantIdOf(c);
  const info = await withTenant(tenantId, async (db) => {
    const res = await db.query<{ sent_count: number }>(
      `SELECT sent_count FROM whatsapp_usage
       WHERE tenant_id = $1 AND month = date_trunc('month', now())::date`,
      [tenantId],
    );
    const used = res.rows[0]?.sent_count ?? 0;
    return {
      used,
      limit: WHATSAPP_MONTHLY_QUOTA_PRO,
      remaining: Math.max(0, WHATSAPP_MONTHLY_QUOTA_PRO - used),
    };
  });
  return c.json(info);
});

// POST /api/whatsapp/send -> Kirim pesan pengingat/notifikasi (hanya jika pelanggan consent)
whatsappRoutes.post("/send", async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const input = await parseBody(c, sendWhatsAppSchema);

  const result = await withTenant(tenantId, async (db) => {
    // 1. Cek idempotency
    const existing = await db.query(
      `SELECT id FROM whatsapp_messages WHERE tenant_id = $1 AND idempotency_key = $2`,
      [tenantId, input.idempotencyKey],
    );
    if (existing.rows[0]) {
      return { ok: true, status: "already_sent" };
    }

    // 2. Ambil data pelanggan & cek persetujuan UU PDP (whatsapp_reminder)
    const custRes = await db.query<{ name: string; phone: string | null }>(
      `SELECT name, phone FROM customers WHERE id = $1 AND tenant_id = $2`,
      [input.customerId, tenantId],
    );
    const customer = custRes.rows[0];
    if (!customer) throw new HTTPException(404, { message: "Pelanggan tidak ditemukan." });
    if (!customer.phone) throw new HTTPException(400, { message: "Pelanggan tidak memiliki nomor telepon." });

    const consentRes = await db.query<{ is_granted: boolean }>(
      `SELECT is_granted FROM customer_consents
       WHERE customer_id = $1 AND tenant_id = $2 AND purpose = 'whatsapp_reminder'
       ORDER BY recorded_at DESC LIMIT 1`,
      [input.customerId, tenantId],
    );

    const hasConsent = consentRes.rows[0]?.is_granted ?? false;
    if (!hasConsent) {
      throw new HTTPException(403, {
        message: "Pelanggan belum memberikan persetujuan penerimaan pesan WhatsApp (UU PDP).",
      });
    }

    // 3. Cek kuota bulanan
    await db.query(
      `INSERT INTO whatsapp_usage (tenant_id, month, sent_count)
       VALUES ($1, date_trunc('month', now())::date, 0)
       ON CONFLICT (tenant_id, month) DO NOTHING`,
      [tenantId],
    );

    const usageRes = await db.query<{ sent_count: number }>(
      `SELECT sent_count FROM whatsapp_usage
       WHERE tenant_id = $1 AND month = date_trunc('month', now())::date
       FOR UPDATE`,
      [tenantId],
    );

    const currentUsed = usageRes.rows[0]?.sent_count ?? 0;
    if (currentUsed >= WHATSAPP_MONTHLY_QUOTA_PRO) {
      throw new HTTPException(429, {
        message: `Kuota WhatsApp bulanan telah habis (${WHATSAPP_MONTHLY_QUOTA_PRO} pesan/bulan).`,
      });
    }

    // 4. Kirim via MessageSender (Stub/Log)
    const sendRes = await messageSender.sendMessage({
      toPhone: customer.phone,
      customerName: customer.name,
      template: input.template,
    });

    // 5. Update kuota & simpan log pesan
    await db.query(
      `UPDATE whatsapp_usage SET sent_count = sent_count + 1
       WHERE tenant_id = $1 AND month = date_trunc('month', now())::date`,
      [tenantId],
    );

    await db.query(
      `INSERT INTO whatsapp_messages (tenant_id, customer_id, template, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, input.customerId, input.template, sendRes.status, input.idempotencyKey],
    );

    await writeAudit(db, auth, "whatsapp.send", "whatsapp_message", input.customerId, {
      template: input.template,
      status: sendRes.status,
    });

    return { ok: true, status: sendRes.status };
  });

  return c.json(result);
});

