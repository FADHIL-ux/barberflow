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

## Hasil test terakhir (fase 8-9-10 & MVP Completion)
- `npm test` → 16 unit test + 2 integration security test lulus (0 gagal).
- `npm run typecheck` → 0 error di seluruh monorepo (`@barberflow/shared`, `@barberflow/api`, `@barberflow/web`).
- `npm run build:web` → Berhasil generate bundle production & service worker precache (27 entries, 413 KiB).

## Selesai Lengkap (Seluruh Ruang Lingkup MVP)
- **Produksi & Infrastruktur**:
  - `apps/api/Dockerfile` (Node.js 22 Alpine, non-root user).
  - `apps/web/Dockerfile` & `apps/web/nginx.conf` (Nginx Alpine, SPA routing, gzip, cache control).
  - `docker/compose.prod.yml` (multi-container: db, api, web, caddy dengan jaringan privat terisolasi).
  - `docker/Caddyfile` (HTTPS otomatis via Let's Encrypt).
  - `.env.prod.example` (template konfigurasi produksi).
- **Pencadangan & Pemulihan Basis Data**:
  - `scripts/backup.sh` (pg_dump + gzip terkompresi dengan retensi 30 hari).
  - `scripts/restore.sh` (konfirmasi keamanan interaktif sebelum menimpa data).
- **Manajemen Booking Internal**:
  - `apps/web/src/pages/BookingsPage.tsx` (antarmuka jadwal booking untuk owner & kasir, filter status, auto-refresh 30s).
  - Navigasi & rute `/booking` terintegrasi di `App.tsx` dan `AppShell.tsx`.
- **QR Code Booking Online**:
  - `apps/web/src/components/ui/QrCode.tsx` (generator QR code mandiri berbasis canvas).
  - Terintegrasi di `ProfileSettingsPage.tsx` dengan fitur salin tautan dan unduh QR PNG.
- **Pengujian & Kualitas**:
  - `apps/api/src/tests/security_isolation.test.ts` (uji isolasi data RLS, penolakan akses super admin ke data pelanggan, UU PDP consent).
  - `playwright.config.ts` & `e2e/cashier-flow.spec.ts` (konfigurasi & skenario pengujian E2E kasir & booking).
  - `README.md` (dokumentasi menyeluruh dalam Bahasa Indonesia: instalasi, printer termal, backup, deploy VPS).
