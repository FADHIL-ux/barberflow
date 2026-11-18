import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  adminCreateTenantSchema,
  adminUpdateTenantSchema,
} from "@barberflow/shared";
import { hashPassword } from "../auth.ts";
import { platformPool, withPlatform } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireRole, type AppEnv } from "../middleware.ts";

export const adminRoutes = new Hono<AppEnv>();
adminRoutes.use("*", authenticate);
adminRoutes.use("*", requireRole("super_admin"));

interface PlatformTenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  feature_flags: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  transaction_count: string;
  whatsapp_used_this_month: number;
}

// GET /api/admin/tenants -> Daftar tenant + statistik agregat (tanpa membocorkan data pribadi pelanggan)
adminRoutes.get("/tenants", async (c) => {
  const rows = await withPlatform(async (db) => {
    const q = `
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.plan,
        t.feature_flags,
        t.is_active,
        t.created_at,
        s.transaction_count::text,
        s.whatsapp_used_this_month
      FROM tenants t
      LEFT JOIN app_private.platform_tenant_stats() s ON s.tenant_id = t.id
      ORDER BY t.created_at DESC
    `;
    const res = await db.query<PlatformTenantRow>(q);
    return res.rows;
  });

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      plan: r.plan,
      featureFlags: r.feature_flags,
      isActive: r.is_active,
      createdAt: r.created_at,
      stats: {
        transactionCount: Number(r.transaction_count || 0),
        whatsappUsedThisMonth: r.whatsapp_used_this_month,
      },
    })),
  });
});

// POST /api/admin/tenants -> Buat tenant baru + akun owner pertama via role barberflow_platform
adminRoutes.post("/tenants", async (c) => {
  const input = await parseBody(c, adminCreateTenantSchema);
  const tenantId = randomUUID();
  const userId = randomUUID();
  const passwordHash = await hashPassword(input.ownerPassword);

  try {
    await withPlatform(async (db) => {
      // 1. Insert tenant
      await db.query(
        `INSERT INTO tenants (id, name, slug, plan, feature_flags)
         VALUES ($1, $2, $3, $4, '{}'::jsonb)`,
        [tenantId, input.name, input.slug, input.plan],
      );

      // 2. Insert tenant_profiles
      await db.query(`INSERT INTO tenant_profiles (tenant_id) VALUES ($1)`, [tenantId]);

      // 3. Insert receipt_counters
      await db.query(`INSERT INTO receipt_counters (tenant_id, last_number) VALUES ($1, 0)`, [tenantId]);

      // 4. Insert owner user
      await db.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, created_by_platform)
         VALUES ($1, $2, $3, $4, $5, 'owner', true)`,
        [userId, tenantId, input.ownerEmail, passwordHash, input.ownerName],
      );
    });

    return c.json(
      {
        id: tenantId,
        name: input.name,
        slug: input.slug,
        plan: input.plan,
        owner: { id: userId, email: input.ownerEmail, name: input.ownerName },
      },
      201,
    );
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      throw new HTTPException(409, { message: "Slug atau email owner sudah digunakan." });
    }
    throw err;
  }
});

// PATCH /api/admin/tenants/:id -> Ubah plan, aktifkan/nonaktifkan tenant, atau atur feature flags
adminRoutes.patch("/tenants/:id", async (c) => {
  const id = parseId(c.req.param("id"));
  const input = await parseBody(c, adminUpdateTenantSchema);

  const updated = await withPlatform(async (db) => {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    if (input.plan !== undefined) {
      fields.push(`plan = $${idx++}`);
      values.push(input.plan);
    }
    if (input.featureFlags !== undefined) {
      fields.push(`feature_flags = $${idx++}`);
      values.push(JSON.stringify(input.featureFlags));
    }
    if (input.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(input.isActive);
    }

    if (fields.length === 0) return null;

    const res = await db.query<{
      id: string;
      name: string;
      slug: string;
      plan: string;
      feature_flags: Record<string, unknown>;
      is_active: boolean;
      created_at: string;
    }>(
      `UPDATE tenants SET ${fields.join(", ")} WHERE id = $1
       RETURNING id, name, slug, plan, feature_flags, is_active, created_at`,
      values,
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      plan: r.plan,
      featureFlags: r.feature_flags ?? {},
      isActive: r.is_active,
      createdAt: r.created_at,
    };
  });

  if (!updated) throw new HTTPException(404, { message: "Tenant tidak ditemukan." });
  return c.json(updated);
});

// DELETE /api/admin/tenants/:id -> Hapus tenant beserta seluruh datanya secara aman (Khusus Super Admin)
adminRoutes.delete("/tenants/:id", async (c) => {
  const id = parseId(c.req.param("id"));

  const deleted = await withPlatform(async (db) => {
    const res = await db.query<{ deleted: boolean }>(
      "SELECT app_private.platform_delete_tenant($1) AS deleted",
      [id],
    );
    return res.rows[0]?.deleted ?? false;
  });

  if (!deleted) throw new HTTPException(404, { message: "Tenant tidak ditemukan." });
  return c.json({ ok: true, message: "Tenant berhasil dihapus." });
});

