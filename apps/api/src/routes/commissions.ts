import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { commissionRuleSchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId, pgErrorCode } from "../http.ts";
import { authenticate, requireFeature, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const commissionRoutes = new Hono<AppEnv>();
commissionRoutes.use("*", authenticate);
commissionRoutes.use("*", requireFeature("commissions")); // Gatekeeping Pro plan

interface RuleRow {
  id: string;
  service_id: string;
  service_name: string;
  barber_id: string | null;
  barber_name: string | null;
  type: "percent" | "fixed";
  value: string;
}

interface SummaryRow {
  barber_id: string;
  barber_name: string;
  total_commission_idr: string;
  services_done_count: string;
}

// GET /api/commissions/rules -> Daftar aturan komisi
commissionRoutes.get("/rules", requireRole("owner"), async (c) => {
  const tenantId = tenantIdOf(c);
  const rows = await withTenant(tenantId, async (db) => {
    const q = `
      SELECT 
        cr.id,
        cr.service_id,
        s.name as service_name,
        cr.barber_id,
        b.display_name as barber_name,
        cr.type,
        cr.value::text
      FROM commission_rules cr
      JOIN services s ON s.id = cr.service_id AND s.tenant_id = cr.tenant_id
      LEFT JOIN barbers b ON b.id = cr.barber_id AND b.tenant_id = cr.tenant_id
      WHERE cr.tenant_id = $1
      ORDER BY s.name ASC, b.display_name ASC NULLS FIRST
    `;
    const res = await db.query<RuleRow>(q, [tenantId]);
    return res.rows;
  });

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      serviceId: r.service_id,
      serviceName: r.service_name,
      barberId: r.barber_id,
      barberName: r.barber_name,
      type: r.type,
      value: Number(r.value),
    })),
  });
});

// POST /api/commissions/rules -> Tambah / perbarui aturan komisi
commissionRoutes.post("/rules", requireRole("owner"), async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const input = await parseBody(c, commissionRuleSchema);

  try {
    const row = await withTenant(tenantId, async (db) => {
      // Cek apakah aturan untuk (service_id, barber_id) sudah ada -> upsert
      const res = await db.query<{ id: string }>(
        `INSERT INTO commission_rules (tenant_id, service_id, barber_id, type, value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, service_id, COALESCE(barber_id, '00000000-0000-0000-0000-000000000000'::uuid))
         DO UPDATE SET type = EXCLUDED.type, value = EXCLUDED.value
         RETURNING id`,
        [tenantId, input.serviceId, input.barberId ?? null, input.type, input.value],
      );

      const r = res.rows[0]!;
      await writeAudit(db, auth, "commission_rule.set", "commission_rule", r.id, {
        serviceId: input.serviceId,
        barberId: input.barberId,
        type: input.type,
        value: input.value,
      });
      return r;
    });

    return c.json(row, 201);
  } catch (err) {
    if (pgErrorCode(err) === "23503") {
      throw new HTTPException(400, { message: "Layanan atau kapster tidak ditemukan." });
    }
    throw err;
  }
});

// DELETE /api/commissions/rules/:id -> Hapus aturan komisi
commissionRoutes.delete("/rules/:id", requireRole("owner"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");

  const deleted = await withTenant(tenantId, async (db) => {
    const res = await db.query("DELETE FROM commission_rules WHERE id = $1 AND tenant_id = $2", [
      id,
      tenantId,
    ]);
    if (res.rowCount) {
      await writeAudit(db, auth, "commission_rule.delete", "commission_rule", id);
    }
    return (res.rowCount ?? 0) > 0;
  });

  if (!deleted) throw new HTTPException(404, { message: "Aturan komisi tidak ditemukan." });
  return c.json({ ok: true });
});

// GET /api/commissions/summary -> Laporan komisi kapster (rentang tanggal)
commissionRoutes.get("/summary", async (c) => {
  const tenantId = tenantIdOf(c);
  const from = c.req.query("from") || new Date().toISOString().slice(0, 10);
  const to = c.req.query("to") || new Date().toISOString().slice(0, 10);
  const barberId = c.req.query("barberId");

  const rows = await withTenant(tenantId, async (db) => {
    let q = `
      SELECT 
        ce.barber_id,
        b.display_name as barber_name,
        SUM(ce.amount_idr)::text as total_commission_idr,
        COUNT(ce.id)::text as services_done_count
      FROM commission_entries ce
      JOIN barbers b ON b.id = ce.barber_id AND b.tenant_id = ce.tenant_id
      JOIN transactions t ON t.id = ce.transaction_id AND t.tenant_id = ce.tenant_id
      WHERE ce.tenant_id = $1
        AND t.occurred_at >= $2::timestamptz
        AND t.occurred_at <= ($3::date + interval '1 day')::timestamptz
    `;
    const params: unknown[] = [tenantId, from, to];

    if (barberId) {
      params.push(barberId);
      q += ` AND ce.barber_id = $4`;
    }

    q += ` GROUP BY ce.barber_id, b.display_name ORDER BY SUM(ce.amount_idr) DESC`;

    const res = await db.query<SummaryRow>(q, params);
    return res.rows;
  });

  return c.json({
    from,
    to,
    items: rows.map((r) => ({
      barberId: r.barber_id,
      barberName: r.barber_name,
      totalCommissionIdr: Number(r.total_commission_idr || 0),
      servicesDoneCount: Number(r.services_done_count || 0),
    })),
  });
});
