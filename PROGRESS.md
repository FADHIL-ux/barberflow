# Progres BarberFlow

## Selesai
- Batch 1: konfigurasi root, Docker Compose dev, role database, runner migration, `001_core.sql`.
- Batch 2: `002_operations.sql`, `003_tenant_name_update.sql`, `packages/shared` (money, commission, reports, features, schemas Zod),
  `apps/api` (env, db + `withTenant`, auth Argon2 + JWT cookie, middleware role/fitur/rate limit, audit, routes auth/services/barbers/profile, seed).
- Fase 1 Selesai:
  - Backend: Route products (`/api/products`), users (`/api/users`), features (`/api/features`) diimplementasikan dan terhubung ke `app.ts`.
  - Frontend: Scaffold `apps/web` (React 19 + Vite + TypeScript + Tailwind v4 + PWA Workbox).
  - UI Components: Button, Input, Modal, Badge, Spinner, AppShell (mobile bottom nav + desktop sidebar).
  - Pages: Login, Register, Profile Settings, Services Settings, Products Settings, Barbers Settings, Users Settings, dan placeholder page lainnya.
  - Verifikasi: Typecheck 3 workspace (shared, api, web) lulus 100%, Unit test 16 pass, Vite production build berhasil.

## Hasil test aktual
- `npm run test:unit` -> 16 lulus, 0 gagal.
- `npm run typecheck` -> Lulus 100% untuk `@barberflow/shared`, `@barberflow/api`, dan `@barberflow/web`.
- `npm run build:web` -> Berhasil generate bundle production & service worker precache.

## Keputusan
- Nomor struk offline: nomor sementara di perangkat, nomor final dari server saat sinkronisasi (disetujui lewat spesifikasi pengguna).
- Profit = pendapatan - pengeluaran - komisi.

## Berikutnya (batch 3)
Route antrean, pelanggan + consent, transaksi/kasir + nomor struk + idempotency, struk publik, komisi, laporan.
Lalu: integration test RLS, frontend (React/Vite/Tailwind/PWA), sync offline, booking, WhatsApp stub, panel super_admin, Docker produksi, backup/restore, README.
