import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { customerConsentSchema, customerSchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const customerRoutes = new Hono<AppEnv>();
customerRoutes.use("*", authenticate);

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  hair_preference: string | null;
  favorite_barber_id: string | null;
  favorite_barber_name: string | null;
  notes: string | null;
  created_at: string;
  consent_data_processing: boolean;
  consent_whatsapp: boolean;
}

// GET /api/customers -> Daftar pelanggan dengan pencarian nama/telepon
customerRoutes.get("/", async (c) => {
  const tenantId = tenantIdOf(c);
  const search = c.req.query("search")?.trim();

  const rows = await withTenant(tenantId, async (db) => {
    let q = `
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.hair_preference,
        c.favorite_barber_id,
        b.display_name as favorite_barber_name,
        c.notes,
        c.created_at,
        COALESCE((
          SELECT cc.is_granted FROM customer_consents cc
          WHERE cc.customer_id = c.id AND cc.tenant_id = c.tenant_id AND cc.purpose = 'data_processing'
          ORDER BY cc.recorded_at DESC LIMIT 1
        ), false) as consent_data_processing,
        COALESCE((
          SELECT cc.is_granted FROM customer_consents cc
          WHERE cc.customer_id = c.id AND cc.tenant_id = c.tenant_id AND cc.purpose = 'whatsapp_reminder'
          ORDER BY cc.recorded_at DESC LIMIT 1
        ), false) as consent_whatsapp
      FROM customers c
      LEFT JOIN barbers b ON b.id = c.favorite_barber_id AND b.tenant_id = c.tenant_id
      WHERE c.tenant_id = $1
    `;
    const params: unknown[] = [tenantId];

    if (search) {
      params.push(`%${search}%`);
      q += ` AND (c.name ILIKE $2 OR c.phone ILIKE $2)`;
    }

    q += ` ORDER BY c.created_at DESC LIMIT 100`;

    const res = await db.query<CustomerRow>(q, params);
    return res.rows;
  });

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      hairPreference: r.hair_preference,
      favoriteBarberId: r.favorite_barber_id,
      favoriteBarberName: r.favorite_barber_name,
      notes: r.notes,
      createdAt: r.created_at,
      consents: {
        dataProcessing: r.consent_data_processing,
        whatsappReminder: r.consent_whatsapp,
      },
    })),
  });
});

// GET /api/customers/:id/visits -> Riwayat kunjungan pelanggan
customerRoutes.get("/:id/visits", async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));

  const visits = await withTenant(tenantId, async (db) => {
    const q = `
      SELECT 
        t.id,
        t.receipt_number::text,
        t.occurred_at,
        t.total_idr,
        t.payment_method,
        b.display_name as barber_name,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('name', ti.name_snapshot, 'kind', ti.kind, 'quantity', ti.quantity))
          FROM transaction_items ti WHERE ti.transaction_id = t.id AND ti.tenant_id = t.tenant_id
        ), '[]'::jsonb) as items
      FROM transactions t
      LEFT JOIN barbers b ON b.id = t.barber_id AND b.tenant_id = t.tenant_id
      WHERE t.customer_id = $1 AND t.tenant_id = $2
      ORDER BY t.occurred_at DESC
    `;
    const res = await db.query(q, [id, tenantId]);
    return res.rows;
  });

  return c.json({
    items: visits.map((v) => ({
      id: v.id,
      receiptNumber: v.receipt_number,
      occurredAt: v.occurred_at,
      totalIdr: v.total_idr,
      paymentMethod: v.payment_method,
      barberName: v.barber_name,
      items: v.items ?? [],
    })),
  });
});

// POST /api/customers -> Tambah pelanggan baru
customerRoutes.post("/", requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const input = await parseBody(c, customerSchema);

  const row = await withTenant(tenantId, async (db) => {
    const res = await db.query<{ id: string; name: string }>(
      `INSERT INTO customers (tenant_id, name, phone, hair_preference, favorite_barber_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name`,
      [
        tenantId,
        input.name,
        input.phone ?? null,
        input.hairPreference ?? null,
        input.favoriteBarberId ?? null,
        input.notes ?? null,
      ],
    );

    const cust = res.rows[0]!;
    // Default consent data_processing granted saat pendaftaran pelanggan
    await db.query(
      `INSERT INTO customer_consents (tenant_id, customer_id, purpose, is_granted, recorded_by)
       VALUES ($1, $2, 'data_processing', true, $3)`,
      [tenantId, cust.id, auth.userId],
    );

    await writeAudit(db, auth, "customer.create", "customer", cust.id, { name: input.name });
    return cust;
  });

  return c.json(row, 201);
});

// PUT /api/customers/:id -> Edit profil pelanggan
customerRoutes.put("/:id", requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");
  const input = await parseBody(c, customerSchema);

  const row = await withTenant(tenantId, async (db) => {
    const res = await db.query(
      `UPDATE customers
       SET name = $2, phone = $3, hair_preference = $4, favorite_barber_id = $5, notes = $6
       WHERE id = $1 AND tenant_id = $7
       RETURNING id, name`,
      [
        id,
        input.name,
        input.phone ?? null,
        input.hairPreference ?? null,
        input.favoriteBarberId ?? null,
        input.notes ?? null,
        tenantId,
      ],
    );

    const cust = res.rows[0];
    if (cust) {
      await writeAudit(db, auth, "customer.update", "customer", id, { name: input.name });
    }
    return cust;
  });

  if (!row) throw new HTTPException(404, { message: "Pelanggan tidak ditemukan." });
  return c.json(row);
});

// POST /api/customers/:id/consent -> Catat riwayat persetujuan UU PDP (append-only)
customerRoutes.post("/:id/consent", requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const customerId = parseId(c.req.param("id"));
  const auth = c.get("auth");
  const input = await parseBody(c, customerConsentSchema);

  await withTenant(tenantId, async (db) => {
    const custExists = await db.query("SELECT id FROM customers WHERE id = $1 AND tenant_id = $2", [
      customerId,
      tenantId,
    ]);
    if (!custExists.rows[0]) {
      throw new HTTPException(404, { message: "Pelanggan tidak ditemukan." });
    }

    await db.query(
      `INSERT INTO customer_consents (tenant_id, customer_id, purpose, is_granted, recorded_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, customerId, input.purpose, input.isGranted, auth.userId],
    );

    await writeAudit(db, auth, "customer.consent_update", "customer_consent", customerId, {
      purpose: input.purpose,
      isGranted: input.isGranted,
    });
  });

  return c.json({ ok: true, purpose: input.purpose, isGranted: input.isGranted });
});

// DELETE /api/customers/:id -> Hapus data pelanggan (Khusus Owner & Kasir)
customerRoutes.delete("/:id", requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");

  const deleted = await withTenant(tenantId, async (db) => {
    const custRes = await db.query<{ name: string }>(
      `SELECT name FROM customers WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    const cust = custRes.rows[0];
    if (!cust) return false;

    // Hapus customer (customer_consents cascade, queue_entries/transactions/bookings set NULL)
    await db.query(`DELETE FROM customers WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    await writeAudit(db, auth, "customer.delete", "customer", id, { name: cust.name });
    return true;
  });

  if (!deleted) throw new HTTPException(404, { message: "Pelanggan tidak ditemukan." });
  return c.json({ ok: true, message: "Pelanggan berhasil dihapus." });
});

