import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { addQueueEntrySchema } from "@barberflow/shared";
import { writeAudit } from "../audit.ts";
import { withTenant } from "../db.ts";
import { parseBody, parseId } from "../http.ts";
import { authenticate, requireRole, tenantIdOf, type AppEnv } from "../middleware.ts";

export const queueRoutes = new Hono<AppEnv>();
queueRoutes.use("*", authenticate);

interface QueueRow {
  id: string;
  queue_date: string;
  queue_number: number;
  customer_id: string | null;
  customer_name: string;
  barber_id: string | null;
  barber_name: string | null;
  status: "waiting" | "in_service" | "done" | "cancelled";
  created_at: string;
  services: Array<{ id: string; name: string; priceIdr: number }>;
}

const updateStatusSchema = z.object({
  status: z.enum(["waiting", "in_service", "done", "cancelled"], {
    errorMap: () => ({ message: "Status antrean tidak valid." }),
  }),
});

// GET /api/queue/stream -> Server-Sent Events (SSE) untuk update real-time
queueRoutes.get("/stream", async (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ ok: true, timestamp: new Date().toISOString() }),
    });

    let active = true;
    stream.onAbort(() => {
      active = false;
    });

    while (active) {
      await stream.sleep(10000);
      if (!active) break;
      await stream.writeSSE({
        event: "ping",
        data: JSON.stringify({ time: Date.now() }),
      });
    }
  });
});

// GET /api/queue/today -> daftar antrean hari ini
queueRoutes.get("/today", async (c) => {
  const tenantId = tenantIdOf(c);
  const rows = await withTenant(tenantId, async (db) => {
    const q = `
      SELECT 
        qe.id,
        qe.queue_date::text as queue_date,
        qe.queue_number,
        qe.customer_id,
        qe.customer_name,
        qe.barber_id,
        b.display_name as barber_name,
        qe.status,
        qe.created_at,
        COALESCE(
          jsonb_agg(
            jsonb_build_object('id', s.id, 'name', s.name, 'priceIdr', s.price_idr)
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::jsonb
        ) as services
      FROM queue_entries qe
      LEFT JOIN barbers b ON b.id = qe.barber_id AND b.tenant_id = qe.tenant_id
      LEFT JOIN queue_entry_services qes ON qes.queue_entry_id = qe.id AND qes.tenant_id = qe.tenant_id
      LEFT JOIN services s ON s.id = qes.service_id AND s.tenant_id = qe.tenant_id
      WHERE qe.tenant_id = $1 AND qe.queue_date = CURRENT_DATE
      GROUP BY qe.id, b.display_name
      ORDER BY qe.queue_number ASC
    `;
    const res = await db.query<QueueRow>(q, [tenantId]);
    return res.rows;
  });

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      queueDate: r.queue_date,
      queueNumber: r.queue_number,
      customerId: r.customer_id,
      customerName: r.customer_name,
      barberId: r.barber_id,
      barberName: r.barber_name,
      status: r.status,
      createdAt: r.created_at,
      services: r.services,
    })),
  });
});

// POST /api/queue -> Tambah antrean baru
queueRoutes.post("/", requireRole("owner", "cashier"), async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");
  const input = await parseBody(c, addQueueEntrySchema);

  const entry = await withTenant(tenantId, async (db) => {
    // 1. Ambil nomor antrean urut hari ini secara aman (FOR UPDATE)
    await db.query(
      `INSERT INTO queue_counters (tenant_id, queue_date, last_number)
       VALUES ($1, CURRENT_DATE, 0)
       ON CONFLICT (tenant_id, queue_date) DO NOTHING`,
      [tenantId],
    );

    const counterRes = await db.query<{ last_number: number }>(
      `SELECT last_number FROM queue_counters
       WHERE tenant_id = $1 AND queue_date = CURRENT_DATE
       FOR UPDATE`,
      [tenantId],
    );

    const nextNumber = (counterRes.rows[0]?.last_number ?? 0) + 1;
    await db.query(
      `UPDATE queue_counters SET last_number = $1
       WHERE tenant_id = $2 AND queue_date = CURRENT_DATE`,
      [nextNumber, tenantId],
    );

    // 2. Buat entri antrean
    const qeRes = await db.query<{ id: string; queue_date: string; created_at: string }>(
      `INSERT INTO queue_entries (tenant_id, queue_date, queue_number, customer_id, customer_name, barber_id, status)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 'waiting')
       RETURNING id, queue_date::text, created_at`,
      [tenantId, nextNumber, input.customerId ?? null, input.customerName, input.barberId ?? null],
    );
    const qe = qeRes.rows[0]!;

    // 3. Kaitkan layanan ke queue_entry_services
    for (const serviceId of input.serviceIds) {
      await db.query(
        `INSERT INTO queue_entry_services (tenant_id, queue_entry_id, service_id)
         VALUES ($1, $2, $3)`,
        [tenantId, qe.id, serviceId],
      );
    }

    await writeAudit(db, auth, "queue.create", "queue_entry", qe.id, {
      queueNumber: nextNumber,
      customerName: input.customerName,
      servicesCount: input.serviceIds.length,
    });

    return {
      id: qe.id,
      queueDate: qe.queue_date,
      queueNumber: nextNumber,
      customerName: input.customerName,
      status: "waiting",
      createdAt: qe.created_at,
    };
  });

  return c.json(entry, 201);
});

// PATCH /api/queue/:id/status -> Ubah status antrean
queueRoutes.patch("/:id/status", requireRole("owner", "cashier", "barber"), async (c) => {
  const tenantId = tenantIdOf(c);
  const id = parseId(c.req.param("id"));
  const auth = c.get("auth");
  const input = await parseBody(c, updateStatusSchema);

  const updated = await withTenant(tenantId, async (db) => {
    const res = await db.query<{ id: string; status: string; queue_number: number }>(
      `UPDATE queue_entries
       SET status = $2, updated_at = now()
       WHERE id = $1 AND tenant_id = $3
       RETURNING id, status, queue_number`,
      [id, input.status, tenantId],
    );

    const row = res.rows[0];
    if (row) {
      await writeAudit(db, auth, "queue.status_update", "queue_entry", id, {
        queueNumber: row.queue_number,
        newStatus: row.status,
      });
    }
    return row;
  });

  if (!updated) {
    throw new HTTPException(404, { message: "Antrean tidak ditemukan." });
  }

  return c.json({ ok: true, status: updated.status });
});

// DELETE /api/queue/done -> Bersihkan daftar antrean yang sudah berstatus 'done' (Khusus Owner)
queueRoutes.delete("/done", requireRole("owner"), async (c) => {
  const tenantId = tenantIdOf(c);
  const auth = c.get("auth");

  const count = await withTenant(tenantId, async (db) => {
    const res = await db.query(
      `DELETE FROM queue_entries WHERE tenant_id = $1 AND status = 'done'`,
      [tenantId],
    );
    await writeAudit(db, auth, "queue.clear_done", "tenant", tenantId, {
      deletedCount: res.rowCount,
    });
    return res.rowCount ?? 0;
  });

  return c.json({ ok: true, message: "Daftar antrean selesai berhasil dibersihkan.", deletedCount: count });
});

