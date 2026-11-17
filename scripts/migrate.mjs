import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  console.error("File .env tidak ditemukan. Salin .env.example menjadi .env terlebih dahulu.");
  process.exit(1);
}

const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL_OWNER });

await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const dir = join(root, "db", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const done = new Set((await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename));

for (const file of files) {
  if (done.has(file)) continue;
  const sql = await readFile(join(dir, file), "utf8");
  console.log(`Menjalankan migration: ${file}`);
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Migration gagal: ${file}`, err.message);
    process.exit(1);
  }
}

console.log("Semua migration selesai.");
await client.end();
