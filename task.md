# BarberFlow — Task List (Checklist Bertahap)

> **Konvensi status:** ✅ Selesai · 🔄 Sedang dikerjakan · ⬜ Belum dimulai  
> **Konvensi commit:** `feat(scope): deskripsi` | `test(scope): deskripsi` | `fix(scope): deskripsi`

---

## Fondasi (sudah selesai di Batch 1–2)

| Status | Task |
|--------|------|
| ✅ | Konfigurasi monorepo (npm workspaces, `tsconfig.base.json`) |
| ✅ | Docker Compose dev (PostgreSQL 16) |
| ✅ | Migrasi DB: `001_core.sql` — tenants, users, barbers, services, products, receipt_counters, audit_logs, RLS |
| ✅ | Migrasi DB: `002_operations.sql` — customers/consent, queue, transactions/items, commissions, expenses, WhatsApp, bookings |
| ✅ | Migrasi DB: `003_tenant_name_update.sql` — owner bisa ubah nama barbershop |
| ✅ | `packages/shared`: money, commission, reports, feature flags, Zod schemas |
| ✅ | `apps/api`: env, db (`withTenant`/`withPlatform`), Argon2id auth, JWT session cookie |
| ✅ | `apps/api`: middleware (`authenticate`, `requireRole`, `requireFeature`, `rateLimit`) |
| ✅ | `apps/api`: routes auth (login/register/logout/me), services, barbers, profile |
| ✅ | `apps/api`: audit log, seed data |
| ✅ | Unit tests: 16 test lulus (commission, money, reports) |

---

## Fase 1 — Manajemen Master Data & Frontend Awal

### Backend (sisa)
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Route `GET/POST/PATCH/DELETE /api/users` — undang kasir/barber ke tenant | `feat(api): user management routes` |
| ✅ | Route `POST /api/users/:id/reset-password` — reset password oleh owner | `feat(api): password reset` |
| ✅ | Route `GET /api/products` + `POST/PATCH/DELETE` — CRUD produk | `feat(api): product routes` |
| ✅ | Endpoint `GET /api/features` — kembalikan feature set tenant saat ini | `feat(api): features endpoint` |

### Frontend — Setup
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Scaffold `apps/web` — Vite + React + TypeScript + Tailwind v4 | `feat(web): scaffold vite react tailwind` |
| ✅ | PWA: `manifest.webmanifest`, ikon 192/512 maskable, `vite-plugin-pwa`, service worker | `feat(web): pwa manifest and service worker` |
| ✅ | Tema brand: background `#101014`, accent `#C6FF3D`, font, Tailwind config | `feat(web): brand theme` |
| ✅ | Layout shell: navigasi bawah mobile, sidebar desktop | `feat(web): shell layout` |
| ✅ | React Router v7 — definisi rute + lazy loading | `feat(web): routing` |
| ✅ | API client (`fetch` wrapper, cookie auth, error handling) | `feat(web): api client` |
| ✅ | Halaman Login | `feat(web): login page` |
| ✅ | Halaman Register (buat barbershop baru) | `feat(web): register page` |
| ✅ | Halaman Pengaturan: profil barbershop, layanan, produk, kapster, pengguna | `feat(web): settings pages` |
| ✅ | Komponen tabel + modal reusable | `feat(web): ui components` |

---

## Fase 2 — Antrean Digital & Kasir

### Backend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Route antrean: `POST /api/queue` (tambah), `PATCH /api/queue/:id/status`, `GET /api/queue/today` | `feat(api): queue routes` |
| ⬜ | Server-Sent Events `GET /api/queue/stream` — update real-time | `feat(api): queue SSE` |
| ✅ | Route transaksi: `POST /api/transactions` (dengan idempotency), `GET /api/transactions` | `feat(api): transaction routes` |
| ✅ | Nomor struk: `SELECT ... FOR UPDATE` pada `receipt_counters` dalam satu transaksi DB | `feat(api): sequential receipt numbers` |
| ⬜ | Integration test: nomor struk unik + idempotency (tidak boleh duplikat) | `test(api): receipt number uniqueness` |

### Frontend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Halaman Antrean: papan kanban (Menunggu / Dilayani / Selesai) | `feat(web): queue board` |
| ✅ | Modal tambah antrean: nama pelanggan, kapster, layanan yang akan dikerjakan | `feat(web): add queue entry modal` |
| ✅ | Halaman Kasir: pilih item (layanan+produk), input diskon, pilih metode bayar, konfirmasi | `feat(web): cashier page` |
| ✅ | Polling / SSE untuk update antrean real-time | `feat(web): queue realtime` |

---

## Fase 3 — Struk & Cetak

### Backend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | `GET /api/transactions/:id/receipt` — data struk lengkap | `feat(api): receipt endpoint` |
| ✅ | Generate public token (random 24 byte → SHA-256 disimpan), `GET /public/receipt/:token` | `feat(api): public receipt link` |
| ✅ | `POST /api/transactions/:id/reprint` — catat di audit log | `feat(api): reprint audit` |
| ⬜ | Integration test: link publik tidak bocorkan nomor telepon + tidak bisa akses antar-tenant | `test(api): public receipt security` |

### Frontend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Komponen struk digital (semua field, layout responsif) | `feat(web): receipt component` |
| ✅ | Stylesheet `@media print` — 58 mm dan 80 mm kertas termal | `feat(web): thermal print styles` |
| ✅ | Tombol cetak (`window.print()`), tombol bagikan (wa.me link) | `feat(web): print and share buttons` |
| ✅ | Halaman struk publik (rute tanpa auth, `public_token`) | `feat(web): public receipt page` |
| ✅ | Riwayat transaksi dengan tombol cetak ulang | `feat(web): transaction history` |
| ⬜ | Screenshot print-preview 58 mm dan 80 mm (manual / Playwright) | `test(web): print layout screenshots` |

---

## Fase 4 — Data Pelanggan (UU PDP)

### Backend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Route pelanggan: `GET/POST/PATCH /api/customers`, `GET /api/customers/:id/visits` | `feat(api): customer routes` |
| ✅ | Route consent: `POST /api/customers/:id/consent` | `feat(api): customer consent` |

### Frontend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Halaman daftar pelanggan + pencarian | `feat(web): customer list` |
| ✅ | Detail pelanggan: preferensi, kapster favorit, riwayat kunjungan | `feat(web): customer detail` |
| ✅ | Dialog consent UU PDP saat tambah/edit pelanggan | `feat(web): pdp consent dialog` |

---

## Fase 5 — Komisi Kapster (Pro)

### Backend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Route aturan komisi: `GET/POST/PATCH/DELETE /api/commissions/rules` (behind `requireFeature`) | `feat(api): commission rule routes` |
| ✅ | Kalkulasi komisi otomatis saat `POST /api/transactions` (sudah ada logika di shared) | `feat(api): auto commission on transaction` |
| ✅ | `GET /api/commissions/summary?from=&to=&barber_id=` — laporan komisi | `feat(api): commission report` |
| ✅ | Unit test: semua kasus kalkulasi komisi (persen, nominal, default vs khusus kapster) | `test(shared): commission edge cases` |

### Frontend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Halaman aturan komisi (Pro) | `feat(web): commission rules page` |
| ✅ | Laporan komisi per kapster | `feat(web): commission report page` |

---

## Fase 6 — Laporan Keuangan (Pro)

### Backend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | `GET /api/reports/daily?date=` — pendapatan, pengeluaran, laba, layanan terlaris, kapster terbaik | `feat(api): daily report` |
| ✅ | `GET /api/reports/monthly?year=&month=` — agregasi bulanan | `feat(api): monthly report` |
| ✅ | Route pengeluaran: `GET/POST /api/expenses` | `feat(api): expense routes` |
| ✅ | Unit test: kalkulasi laporan (sudah ada kerangka di shared) | `test(shared): report calculations` |

### Frontend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Halaman laporan harian (Pro) — grafik pendapatan vs pengeluaran | `feat(web): daily report page` |
| ✅ | Halaman laporan bulanan (Pro) | `feat(web): monthly report page` |
| ✅ | Halaman input pengeluaran | `feat(web): expense entry page` |
| ✅ | Gate UI: sembunyikan halaman Pro + tampilkan tombol upgrade | `feat(web): pro feature gating` |

---

## Fase 7 — Offline Mode

### Frontend (terutama)
| Status | Task | Commit |
|--------|------|--------|
| ✅ | IndexedDB schema (Dexie.js / Native IDB): `pending_transactions`, `local_receipts` | `feat(web): indexeddb schema` |
| ✅ | Simpan transaksi ke IndexedDB saat offline + generate nomor struk sementara | `feat(web): offline transaction queue` |
| ✅ | Service worker: background sync saat kembali online | `feat(web): background sync` |
| ✅ | Indikator online/offline di header | `feat(web): online status indicator` |
| ✅ | Nomor struk sementara format: `{device_id}-{local_seq}` — tidak bentrok antar perangkat | `feat(web): offline receipt numbering` |

### Backend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Endpoint `POST /api/sync` — batch submit transaksi offline (idempotency_key sudah ada di DB) | `feat(api): offline sync endpoint` |
| ⬜ | Integration test: 2 perangkat offline → sync → tidak ada nomor struk duplikat | `test(api): offline sync no collision` |

---

## Fase 8 — Feature Flags Starter vs Pro

| Status | Task | Commit |
|--------|------|--------|
| ✅ | Semua endpoint Pro sudah `requireFeature(...)` (commissions, financial_reports, whatsapp_reminders, online_booking) | `feat(phase-8-9-10)` |
| ✅ | `GET /api/features` — endpoint terpisah ada di routes/features.ts | `feat(phase-8-9-10)` |
| ✅ | Frontend: gate UI ReportPage (Pro), CommissionSettingsPage (Pro) dengan banner upgrade | `feat(phase-8-9-10)` |

---

## Fase 9 — Booking Online (Pro)

### Backend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | `GET /public/:slug/info` — info barbershop + barbers + services untuk booking publik | `feat(phase-8-9-10)` |
| ✅ | `POST /public/:slug/bookings` — buat booking (exclusion constraint anti-overlap) | `feat(phase-8-9-10)` |
| ✅ | `GET /api/bookings` — lihat booking (untuk owner/kasir) | `feat(phase-8-9-10)` |
| ✅ | `PATCH /api/bookings/:id/status` — ubah status booking | `feat(phase-8-9-10)` |

### Frontend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Halaman booking publik: `/{slug}/book` (tanpa auth, full form UI) | `feat(phase-8-9-10)` |
| ✅ | QR code untuk link booking (generate di frontend & unduh PNG) | `feat(web): booking qr code` |
| ✅ | Halaman manajemen booking internal (untuk owner/kasir) | `feat(web): booking management` |

---

## Fase 10 — Panel Admin (super_admin)

### Backend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | `GET /api/admin/tenants` — daftar tenant + statistik agregat (via platform_tenant_stats) | `feat(phase-8-9-10)` |
| ✅ | `POST /api/admin/tenants` — buat tenant baru + akun owner pertama | `feat(phase-8-9-10)` |
| ✅ | `PATCH /api/admin/tenants/:id` — ubah plan, feature flags, aktif/nonaktif | `feat(phase-8-9-10)` |
| ✅ | Isolasi data: super_admin menggunakan `withPlatform` (barberflow_platform role, no customer data) | `feat(phase-8-9-10)` |

### Frontend
| Status | Task | Commit |
|--------|------|--------|
| ✅ | Panel admin terpisah (rute `/admin/*`, hanya super_admin) | `feat(phase-8-9-10)` |
| ✅ | Daftar tenant, buat tenant baru, atur plan, aktifkan/nonaktifkan | `feat(phase-8-9-10)` |
| ✅ | Feature flag override per tenant (toggle individual) | `feat(phase-8-9-10)` |
| ✅ | Statistik per tenant (total transaksi, kuota WA bulan ini) | `feat(phase-8-9-10)` |

---

## WhatsApp (lintas fase)

| Status | Task | Commit |
|--------|------|--------|
| ✅ | Interface `MessageSender` + implementasi `StubMessageSender` (log ke console, tidak ada API call) | `feat(phase-8-9-10)` |
| ✅ | `GET /api/whatsapp/quota` — cek pemakaian kuota bulan ini | `feat(phase-8-9-10)` |
| ✅ | `POST /api/whatsapp/send` — cek consent UU PDP + kuota 100/bulan, panggil stub | `feat(phase-8-9-10)` |

---

## Infrastruktur & Kualitas

| Status | Task | Commit |
|--------|------|--------|
| ✅ | `docker/compose.prod.yml` — app + postgres + Caddy (HTTPS otomatis) | `feat(infra): production docker compose` |
| ✅ | Skrip backup: `scripts/backup.sh` (pg_dump terjadwal) + `scripts/restore.sh` | `feat(infra): backup and restore scripts` |
| ✅ | Dokumentasi tes restore di README | `docs: restore test procedure` |
| ✅ | Integration test isolasi tenant (RLS) & UU PDP | `test(api): rls tenant isolation` |
| ✅ | Playwright E2E: konfigurasi & skenario alur kasir & booking (`e2e/cashier-flow.spec.ts`) | `test(e2e): full cashier flow` |
| ✅ | README: setup lokal, deploy VPS, demo seed, panduan printer termal | `docs: readme` |
| ✅ | Typecheck CI (`npm run typecheck`) | `ci: typecheck` |
| ✅ | Update `PROGRESS.md` setelah setiap fase | `docs: update progress` |

