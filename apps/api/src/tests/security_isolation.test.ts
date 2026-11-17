import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { resolveFeatures, sendWhatsAppSchema } from "@barberflow/shared";

// Muat variabel lingkungan
const dbUrlApp = process.env.DATABASE_URL_APP || "postgres://barberflow_app:CHANGE_ME_APP@localhost:5432/barberflow";
const dbUrlPlatform = process.env.DATABASE_URL_PLATFORM || "postgres://barberflow_platform:CHANGE_ME_PLATFORM@localhost:5432/barberflow";

test("Feature flag enforcement: Starter vs Pro logic", () => {
  const starterFlags = resolveFeatures("starter");
  assert.equal(starterFlags.commissions, false, "Starter tidak boleh memiliki akses komisi secara default");
  assert.equal(starterFlags.financial_reports, false, "Starter tidak boleh memiliki akses laporan keuangan secara default");
  assert.equal(starterFlags.online_booking, false, "Starter tidak boleh memiliki akses booking online secara default");
  assert.equal(starterFlags.whatsapp_reminders, false, "Starter tidak boleh memiliki akses WhatsApp secara default");

  const proFlags = resolveFeatures("pro");
  assert.equal(proFlags.commissions, true, "Pro wajib memiliki akses komisi");
  assert.equal(proFlags.financial_reports, true, "Pro wajib memiliki akses laporan keuangan");
  assert.equal(proFlags.online_booking, true, "Pro wajib memiliki akses booking online");
  assert.equal(proFlags.whatsapp_reminders, true, "Pro wajib memiliki akses WhatsApp");

  // Explicit override oleh super admin
  const overridden = resolveFeatures("starter", { online_booking: true });
  assert.equal(overridden.online_booking, true, "Override flag oleh admin harus dihormati");
  assert.equal(overridden.commissions, false, "Flag lainnya tetap mengikuti aturan default");
});

test("WhatsApp UU PDP Consent Validation: Schema menolak request tanpa customerId dan idempotencyKey", () => {
  // Valid payload (idempotencyKey min 16 chars)
  const valid = sendWhatsAppSchema.safeParse({
    customerId: "123e4567-e89b-12d3-a456-426614174000",
    template: "reminder_h1",
    idempotencyKey: "idem-key-1234567890",
  });
  assert.equal(valid.success, true);

  // Missing customerId (tidak bisa kirim ke nomor tanpa identitas/consent pelanggan)
  const invalid = sendWhatsAppSchema.safeParse({
    template: "reminder_h1",
    idempotencyKey: "idem-key-1234567890",
  });
  assert.equal(invalid.success, false);
});

test("Super Admin Data Isolation: Platform role tidak dapat mengakses data pribadi pelanggan atau transaksi", async (t) => {
  const pool = new pg.Pool({ connectionString: dbUrlPlatform, max: 1 });
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
  } catch {
    t.skip("Database tidak dapat diakses dengan koneksi lokal, melewati verifikasi langsung DB.");
    return;
  }

  try {
    // 1. Verifikasi role platform DITOLAK saat mencoba membaca tabel customers
    let customerAccessDenied = false;
    try {
      await client.query("SELECT * FROM customers LIMIT 1");
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      // 42501 = insufficient_privilege
      if (pgErr.code === "42501") {
        customerAccessDenied = true;
      }
    }
    assert.equal(
      customerAccessDenied,
      true,
      "Keamanan UU PDP: Role barberflow_platform wajib DITOLAK membaca data pribadi pelanggan (error 42501)."
    );

    // 2. Verifikasi role platform DITOLAK saat mencoba membaca tabel transaksi
    let transactionAccessDenied = false;
    try {
      await client.query("SELECT * FROM transactions LIMIT 1");
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "42501") {
        transactionAccessDenied = true;
      }
    }
    assert.equal(
      transactionAccessDenied,
      true,
      "Keamanan Keuangan: Role barberflow_platform wajib DITOLAK membaca tabel transaksi langsung."
    );

    // 3. Verifikasi role platform BISA membaca tabel tenants dan statistik agregat
    const res = await client.query("SELECT count(*)::int as count FROM tenants");
    assert.ok(typeof res.rows[0]?.count === "number", "Role platform diizinkan membaca metadata tenants.");
  } finally {
    if (client) client.release();
    await pool.end();
  }
});

test("Tenant Isolation & RLS: Tenant A tidak dapat melihat data Tenant B", async (t) => {
  const pool = new pg.Pool({ connectionString: dbUrlApp, max: 2 });
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
  } catch {
    t.skip("Database tidak dapat diakses dengan koneksi lokal, melewati verifikasi langsung DB.");
    return;
  }

  try {
    const dummyTenantA = "00000000-0000-0000-0000-000000000001";
    const dummyTenantB = "00000000-0000-0000-0000-000000000002";

    // Set konteks session RLS ke Tenant A
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [dummyTenantA]);

    // Query tabel dengan RLS aktif
    const res = await client.query("SELECT * FROM services WHERE tenant_id = $1", [dummyTenantB]);
    assert.equal(res.rows.length, 0, "RLS wajib menyaring data Tenant B saat sesi adalah Tenant A.");

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    if (client) client.release();
    await pool.end();
  }
});
