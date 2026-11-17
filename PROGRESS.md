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

- Fase 2–3 Selesai: Queue board, kasir checkout, struk publik + cetak, nota digital.
- Fase 4–5 Selesai: Manajemen pelanggan (UU PDP consent), aturan komisi Pro, laporan komisi kapster.
- Fase 6–7 Selesai: Laporan keuangan harian/bulanan (Pro), input pengeluaran, offline mode IndexedDB + sync idempotent.
- Fase 8–9–10 Selesai (commit `1bb604b`):
  - **Phase 8**: Semua endpoint Pro dilindungi `requireFeature(...)`, feature flags enforcement lengkap.
  - **Phase 9 Backend**: `GET /public/:slug/info`, `POST /public/:slug/bookings` (exclusion constraint anti-overlap), `GET/PATCH /api/bookings`.
  - **Phase 9 Frontend**: `PublicBookingPage` — form booking publik tanpa auth (pilih layanan, kapster, waktu).
  - **Phase 10 Backend**: `GET/POST /api/admin/tenants`, `PATCH /api/admin/tenants/:id` via `withPlatform` (platform role, isolasi data).
  - **Phase 10 Frontend**: `AdminLayout` — panel super admin lengkap: daftar tenant, statistik, buat tenant baru (modal), ubah plan, toggle feature flags, aktifkan/nonaktifkan.
  - **WhatsApp**: `StubMessageSender`, `GET /api/whatsapp/quota`, `POST /api/whatsapp/send` (cek consent UU PDP + kuota 100/bulan).

## Hasil test terakhir (fase 8-9-10)
- `npm run test:unit` → 16 lulus, 0 gagal.
- `npm run typecheck` → 0 error (shared, api, web).
- `npm run build -w @barberflow/web` → berhasil (PWA precache 26 entries, 402KB).

## Yang Tersisa (MVP)
- QR code link booking di frontend.
- Halaman manajemen booking internal (owner/kasir).
- Docker Compose produksi (`docker/compose.prod.yml` + Caddy HTTPS).
- Script backup/restore (`scripts/backup.sh`, `scripts/restore.sh`).
- README lengkap (setup lokal, deploy VPS, demo seed, panduan printer termal).
- Integration tests: RLS isolasi tenant, offline sync no-duplicate, WhatsApp consent.
- Playwright E2E: flow kasir penuh.
