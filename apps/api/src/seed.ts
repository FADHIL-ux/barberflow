import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { hashPassword } from "./auth.ts";

const DEMO_PASSWORD = "Demo12345!";

function getMigrationsDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "db/migrations"),
    path.resolve(process.cwd(), "../../db/migrations"),
    path.resolve(import.meta.dirname ?? "", "../../../db/migrations"),
    "/app/db/migrations",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export async function runMigrationsAndSeed() {
  const url = process.env["DATABASE_URL_OWNER"] || process.env["DATABASE_URL_APP"];
  if (!url) {
    console.warn("DATABASE_URL tidak diset, melewati migrasi dan seeding.");
    return;
  }

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();

    // 1. Jalankan Migrasi Database jika tabel belum ada
    const dir = getMigrationsDir();
    if (dir) {
      console.log("Menjalankan migrasi database dari:", dir);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
      const doneRows = await client.query("SELECT filename FROM schema_migrations");
      const done = new Set(doneRows.rows.map((r: { filename: string }) => r.filename));

      for (const file of files) {
        if (done.has(file)) continue;
        console.log(`Menerapkan migrasi: ${file}`);
        const sql = fs.readFileSync(path.join(dir, file), "utf8");
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
          await client.query("COMMIT");
        } catch (mErr) {
          await client.query("ROLLBACK");
          console.error(`Gagal menerapkan migrasi ${file}:`, mErr);
          throw mErr;
        }
      }
      console.log("Semua migrasi database berhasil diterapkan!");
    } else {
      console.warn("Direktori db/migrations tidak ditemukan.");
    }

    // 2. Buat Akun Demo jika belum ada
    const exists = await client.query("SELECT 1 FROM tenants WHERE slug = 'demo-barbershop'");
    if (exists.rowCount && exists.rowCount > 0) {
      console.log("Akun demo sudah tersedia di database.");
      return;
    }

    await client.query("BEGIN");
    const hash = await hashPassword(DEMO_PASSWORD);
    const tenantId = randomUUID();
    await client.query("INSERT INTO tenants (id, name, slug, plan) VALUES ($1, 'Demo Barbershop', 'demo-barbershop', 'pro')", [tenantId]);
    await client.query(
      "INSERT INTO tenant_profiles (tenant_id, address, phone) VALUES ($1, 'Jl. Contoh No. 1, Padang', '081234567890')", [tenantId]);
    await client.query("INSERT INTO receipt_counters (tenant_id) VALUES ($1)", [tenantId]);

    await client.query("INSERT INTO users (email, password_hash, full_name, role) VALUES ('admin@barberflow.test', $1, 'Admin BarberFlow', 'super_admin') ON CONFLICT DO NOTHING", [hash]);
    const ownerId = randomUUID(), cashierId = randomUUID(), barberUserId = randomUUID();
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role) VALUES
        ($1, $4, 'owner@demo.test', $5, 'Budi Pemilik', 'owner'),
        ($2, $4, 'kasir@demo.test', $5, 'Sari Kasir', 'cashier'),
        ($3, $4, 'kapster@demo.test', $5, 'Rian Kapster', 'barber') ON CONFLICT DO NOTHING`,
      [ownerId, cashierId, barberUserId, tenantId, hash]);

    await client.query(
      `INSERT INTO barbers (tenant_id, user_id, display_name, skills) VALUES
        ($1, $2, 'Rian', ARRAY['Fade', 'Pompadour']),
        ($1, NULL, 'Dimas', ARRAY['Classic cut', 'Cukur jenggot'])`, [tenantId, barberUserId]);
    await client.query(
      `INSERT INTO services (tenant_id, name, price_idr, duration_minutes, description) VALUES
        ($1, 'Potong Rambut', 50000, 30, 'Potong rambut dan merapikan'),
        ($1, 'Cukur Jenggot', 25000, 15, 'Cukur dan rapikan jenggot'),
        ($1, 'Creambath', 75000, 45, 'Perawatan rambut dan pijat kepala'),
        ($1, 'Potong + Cukur', 70000, 45, 'Paket hemat')`, [tenantId]);
    await client.query(
      `INSERT INTO products (tenant_id, name, price_idr, stock_quantity) VALUES
        ($1, 'Pomade', 85000, 20), ($1, 'Hair Powder', 65000, 12), ($1, 'Sampo', 45000, 15)`, [tenantId]);
    await client.query(
      `INSERT INTO commission_rules (tenant_id, service_id, type, value)
       SELECT $1, id, 'percent', 40 FROM services WHERE tenant_id = $1 AND name IN ('Potong Rambut', 'Potong + Cukur')`, [tenantId]);
    await client.query(
      `INSERT INTO commission_rules (tenant_id, service_id, type, value)
       SELECT $1, id, 'fixed', 5000 FROM services WHERE tenant_id = $1 AND name = 'Cukur Jenggot'`, [tenantId]);

    await client.query("COMMIT");
    console.log("Inisialisasi tabel dan akun demo berhasil!");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Migrasi / Seed error:", err);
  } finally {
    await client.end().catch(() => undefined);
  }
}
