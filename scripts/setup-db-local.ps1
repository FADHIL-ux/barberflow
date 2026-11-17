# BarberFlow — Inisialisasi Database PostgreSQL Lokal Windows (Tanpa Docker)
Param(
  [string]$PostgresPassword = ""
)

$PsqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $PsqlPath)) {
  # Coba cari versi lain jika ada (17, 16, 15)
  $PsqlPath = (Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}

if (-not $PsqlPath) {
  Write-Host "psql.exe tidak ditemukan di C:\Program Files\PostgreSQL." -ForegroundColor Red
  exit 1
}

Write-Host "Menggunakan PostgreSQL dari: $PsqlPath" -ForegroundColor Cyan

if (-not $PostgresPassword) {
  $PostgresPassword = Read-Host "Masukkan kata sandi (password) akun 'postgres' komputer Anda" -AsSecureString
  $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($PostgresPassword)
  $PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
} else {
  $PlainPassword = $PostgresPassword
}

$env:PGPASSWORD = $PlainPassword

Write-Host "Membuat database dan role BarberFlow..." -ForegroundColor Yellow

$SqlCommands = @"
-- Buat database jika belum ada
SELECT 'CREATE DATABASE barberflow' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'barberflow')\gexec

\c barberflow

-- Buat role barberflow_owner jika belum ada
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'barberflow_owner') THEN
    CREATE ROLE barberflow_owner LOGIN PASSWORD 'barberflow_owner_pass' SUPERUSER CREATEDB CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'barberflow_app') THEN
    CREATE ROLE barberflow_app LOGIN PASSWORD 'barberflow_app_pass' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'barberflow_platform') THEN
    CREATE ROLE barberflow_platform LOGIN PASSWORD 'barberflow_platform_pass' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
\$\$;

GRANT ALL ON DATABASE barberflow TO barberflow_owner;
GRANT CONNECT ON DATABASE barberflow TO barberflow_app, barberflow_platform;
GRANT USAGE ON SCHEMA public TO barberflow_app, barberflow_platform;
"@

$SqlCommands | & $PsqlPath -h 127.0.0.1 -p 5432 -U postgres

if ($LASTEXITCODE -eq 0) {
  Write-Host "`n✅ Database dan Role BarberFlow berhasil dibuat di PostgreSQL lokal!" -ForegroundColor Green
  
  # Update .env secara otomatis
  $envContent = @"
POSTGRES_DB=barberflow
POSTGRES_OWNER_USER=barberflow_owner
POSTGRES_OWNER_PASSWORD=barberflow_owner_pass
APP_DB_PASSWORD=barberflow_app_pass
PLATFORM_DB_PASSWORD=barberflow_platform_pass

DATABASE_URL_OWNER=postgres://barberflow_owner:barberflow_owner_pass@localhost:5432/barberflow
DATABASE_URL_APP=postgres://barberflow_app:barberflow_app_pass@localhost:5432/barberflow
DATABASE_URL_PLATFORM=postgres://barberflow_platform:barberflow_platform_pass@localhost:5432/barberflow

JWT_SECRET=super_secret_barberflow_local_jwt_key_2026_xyz
API_PORT=3000
CORS_ORIGIN=http://localhost:5173
"@
  $envContent | Out-File -FilePath "$PSScriptRoot\..\.env" -Encoding utf8
  Write-Host "✅ File .env berhasil diperbarui dengan koneksi database lokal." -ForegroundColor Green
  Write-Host "`nLangkah selanjutnya:`n1. Jalankan migrasi: npm run db:migrate`n2. Jalankan seed demo: npm run seed -w @barberflow/api`n3. Jalankan backend: npm run dev:api`n4. Jalankan frontend: npm run dev -w @barberflow/web" -ForegroundColor Cyan
} else {
  Write-Host "!! Gagal membuat database. Pastikan password akun 'postgres' benar." -ForegroundColor Red
}
