// Demo data. Connects as the owner role, so it works for local development only.
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "./auth.ts";

if (process.env["NODE_ENV"] === "production") {
  console.error("Seed demo tidak boleh dijalankan di production.");
  process.exit(1);
}

const url = process.env["DATABASE_URL_OWNER"];
if (!url) {
  console.error("DATABASE_URL_OWNER belum diatur di .env");
  process.exit(1);
}

const DEMO_PASSWORD = "Demo12345!";
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("BEGIN");
  const exists = await client.query("SELECT 1 FROM tenants WHERE slug = 'demo-barbershop'");
  if (exists.rowCount) {
    console.log("Data demo sudah ada. Tidak ada yang diubah.");
    await client.query("ROLLBACK");
  } else {
    const hash = await hashPassword(DEMO_PASSWORD);
    const tenantId = randomUUID();
    await client.query("INSERT INTO tenants (id, name, slug, plan) VALUES ($1, 'Demo Barbershop', 'demo-barbershop', 'pro')", [tenantId]);
    await client.query(
      "INSERT INTO tenant_profiles (tenant_id, address, phone) VALUES ($1, 'Jl. Contoh No. 1, Padang', '081234567890')", [tenantId]);
    await client.query("INSERT INTO receipt_counters (tenant_id) VALUES ($1)", [tenantId]);

    await client.query("INSERT INTO users (email, password_hash, full_name, role) VALUES ('admin@barberflow.test', $1, 'Admin BarberFlow', 'super_admin')", [hash]);
    const ownerId = randomUUID(), cashierId = randomUUID(), barberUserId = randomUUID();
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role) VALUES
        ($1, $4, 'owner@demo.test', $5, 'Budi Pemilik', 'owner'),
        ($2, $4, 'kasir@demo.test', $5, 'Sari Kasir', 'cashier'),
        ($3, $4, 'kapster@demo.test', $5, 'Rian Kapster', 'barber')`,
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
    console.log("Seed selesai. Password semua akun demo:", DEMO_PASSWORD);
    console.log(" super_admin : admin@barberflow.test");
    console.log(" owner       : owner@demo.test");
    console.log(" cashier     : kasir@demo.test");
    console.log(" barber      : kapster@demo.test");
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("Seed gagal:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
