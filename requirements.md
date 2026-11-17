# BarberFlow — Dokumen Kebutuhan (Requirements)

> **Versi:** 0.2 | **Tanggal:** 17 November 2026  
> **Status proyek saat ini:** Phase 0 — fondasi backend sudah ada (migrasi DB, shared package, API auth/services/barbers/profile, 16 unit test lulus).

---

## 1. Latar Belakang

BarberFlow adalah aplikasi SaaS manajemen barbershop untuk UMKM Indonesia yang diakses lewat browser (web app only). Satu instalasi melayani banyak barbershop (multi-tenant). Pembayaran berlangganan **di luar scope MVP ini**.

---

## 2. Pengguna & Peran

| Peran | Lingkup | Kemampuan Utama |
|-------|---------|-----------------|
| `super_admin` | Platform | Kelola tenant, atur plan/feature flags, aktifkan/nonaktifkan tenant, lihat statistik agregat. **Tidak boleh membaca data pelanggan tenant.** |
| `owner` | Barbershop | Semua fitur barbershop + pengaturan + laporan keuangan (Pro). |
| `cashier` | Barbershop | Antrean, kasir, cetak struk, lihat riwayat transaksi. |
| `barber` | Barbershop | Lihat antrean sendiri, lihat komisi sendiri. |

---

## 3. Tumpukan Teknologi (Wajib)

| Lapisan | Teknologi |
|---------|-----------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 + PWA (`vite-plugin-pwa` / Workbox) |
| Backend | Node.js ≥22 + Hono + TypeScript, validasi dengan Zod |
| Database | PostgreSQL 16, multi-tenant dengan `tenant_id` + Row-Level Security |
| Auth | Email + password (Argon2id), session via cookie JWT HttpOnly, 8 jam |
| Deployment | Docker Compose (app + postgres + Caddy/Nginx reverse proxy + Let's Encrypt) di satu VPS |
| Shared | `packages/shared` — money, commission, reports, feature flags, Zod schemas |

---

## 4. Desain UI/UX

- **Mobile-first:** layar utama 360px × 780px, tombol sentuh min. 48px.
- **Tema:** background `#101014`, accent `#C6FF3D` (kuning-hijau neon).
- **Bahasa UI:** Bahasa Indonesia.
- **PWA:** manifest, ikon 192/512 px + maskable, service worker, `display: standalone`.
- **Aksesibilitas:** kontras WCAG AA untuk teks penting.

---

## 5. Fitur MVP (Urutan Implementasi)

### Fase 1 — Manajemen Tenant & Master Data ✅ sebagian
- [x] Registrasi barbershop baru (self-registration → paket Starter)
- [x] Login / logout (Argon2id, JWT cookie, rate limit)
- [x] CRUD layanan (services)
- [x] CRUD kapster (barbers)
- [x] Profil barbershop (nama, alamat, telp, footer struk, lebar kertas, jam buka)
- [ ] Manajemen pengguna tambahan (undang kasir/kapster, reset password)
- [ ] Frontend halaman-halaman di atas

### Fase 2 — Antrean Digital & Kasir
- [ ] Antrean: tambah entri, ubah status (waiting → in_service → done / cancelled), tampilan papan antrean real-time (polling / SSE)
- [ ] Kasir: pilih layanan + produk, diskon (persen/nominal), metode bayar (cash / QRIS / transfer — **dicatat saja, tidak ada integrasi**)
- [ ] Nomor transaksi + idempotency key

### Fase 3 — Struk & Cetak
- [ ] **3a.** Struk digital: nomor urut per tenant, nama + alamat barbershop, tanggal/waktu, kapster, item (layanan/produk), subtotal, diskon, total, metode bayar, teks penutup yang bisa dikonfigurasi owner.
- [ ] **3b.** Cetak via `window.print()` dengan stylesheet `@media print` untuk kertas termal 58 mm dan 80 mm (pilihan di pengaturan). Tampilan bersih — tidak ada UI lain yang ikut tercetak.
- [ ] **3c.** Link publik struk (token acak hard-to-guess), tombol bagikan via `wa.me` (manual). Link publik **tidak menampilkan nomor telepon pelanggan**.
- [ ] **3d.** Cetak ulang dari riwayat transaksi, dicatat di audit log (siapa, kapan).
- [ ] **3e.** Struk bisa dibuat dan dicetak dalam kondisi offline.
- [ ] **3f.** ❌ Di luar scope: cetak langsung ke printer Bluetooth/USB — tunggu pengujian perangkat nyata. Dicatat di dokumen ini.

### Fase 4 — Data Pelanggan (UU PDP)
- [ ] CRUD pelanggan: nama, telepon (opsional), preferensi potongan, kapster favorit, catatan.
- [ ] Field persetujuan (consent) sesuai UU PDP: `data_processing` dan `whatsapp_reminder` — append-only, tercatat siapa yang merekam.
- [ ] Riwayat kunjungan per pelanggan.

### Fase 5 — Komisi Kapster (Pro)
- [ ] Aturan komisi: persentase atau nominal per layanan (bisa per-kapster atau default semua kapster).
- [ ] Kalkulasi komisi otomatis saat transaksi selesai.
- [ ] Laporan komisi per kapster.

### Fase 6 — Laporan Harian & Bulanan (Pro)
- [ ] Pendapatan, pengeluaran, laba per hari/bulan.
- [ ] Layanan terlaris, kapster terbaik.
- [ ] Input pengeluaran manual.

### Fase 7 — Offline Mode
- [ ] Transaksi disimpan ke IndexedDB saat offline.
- [ ] Antrian sinkronisasi saat kembali online (idempotency key — tidak ada duplikat).
- [ ] Nomor struk sementara saat offline → nomor final dari server saat sinkronisasi. **Nomor tidak boleh bentrok antar perangkat.**
- [ ] Indikator status online/offline di UI.

### Fase 8 — Feature Flags Starter vs Pro
- [ ] Feature flags per tenant di DB (sudah ada di skema).
- [ ] Server: middleware `requireFeature` sudah ada — sambungkan ke semua endpoint Pro.
- [ ] Frontend: sembunyikan fitur Pro di UI + tampilkan pesan upgrade.

### Fase 9 — Booking Online (Pro)
- [ ] Link/QR booking publik per barbershop.
- [ ] Pilih kapster, layanan, slot waktu (dengan exclusion constraint anti-overlap sudah di DB).
- [ ] Konfirmasi via wa.me (manual).

### Fase 10 — Panel Admin (super_admin)
- [ ] Daftar tenant, buat tenant baru, atur plan + feature flags, aktifkan/nonaktifkan.
- [ ] Statistik: jumlah transaksi, kuota WhatsApp terpakai per tenant.
- [ ] `super_admin` **tidak bisa** membaca data pelanggan atau transaksi tenant (dijamin di DB oleh pemisahan role `barberflow_platform` yang tidak punya grant ke tabel operational).

### WhatsApp (Semua Fase)
- [ ] Interface `MessageSender` dengan implementasi stub/log (tidak memanggil Meta API).
- [ ] Simpan kuota per tenant, opt-in per pelanggan. Hanya kirim ke pelanggan yang sudah consent.

---

## 6. Non-Fungsional

### Keamanan
- Rate limiting pada endpoint login (10x/15 menit) dan register (5x/jam) ✅ sudah ada.
- Audit log untuk semua aksi kritis (login, buat/ubah/hapus data, cetak ulang struk).
- Rahasia di `.env` saja — tidak ada secret di repo (`.env.example` berisi placeholder `CHANGE_ME`).
- Tes membuktikan Tenant A tidak bisa baca data Tenant B — termasuk lewat link struk publik.
- CSP, `X-Frame-Options`, `X-Content-Type-Options` via `hono/secure-headers` ✅ sudah ada.
- Password di-hash dengan Argon2id ✅ sudah ada.
- Session cookie: HttpOnly, SameSite=Lax, Secure (production) ✅ sudah ada.

### Backup & Pemulihan
- `pg_dump` terjadwal (cron) ke direktori terpisah.
- Skrip restore + tes restore terdokumentasi.

### Testing
- Unit test: kalkulasi komisi, total struk, laporan. ✅ 16 test sudah lulus.
- Integration test: isolasi tenant (RLS), nomor struk unik, sinkronisasi offline.
- Verifikasi layout cetak 58 mm dan 80 mm (screenshot print-preview).
- Playwright untuk E2E flow kasir.

### Performa
- API response < 300 ms untuk operasi kasir biasa di VPS entry-level.
- Tailwind purge, Vite code-split, lazy-load per rute.

### PWA
- Lighthouse PWA score ≥ 90 (installable, offline-ready, manifest valid).
- Hasil Lighthouse disertakan di README.

---

## 7. Di Luar Scope MVP

| Item | Alasan |
|------|--------|
| APK / native app | Scope web only |
| Pembayaran berlangganan | Dibangun terpisah |
| Integrasi QRIS/EDC | Metode bayar dicatat saja |
| Multi-cabang | Post-MVP |
| Cetak langsung ke printer Bluetooth/USB | Butuh pengujian perangkat nyata — gunakan `window.print()` dulu |
| Landing page marketing | Dibangun terpisah |

---

## 8. Asumsi yang Dikonfirmasi

| # | Asumsi | Status |
|---|--------|--------|
| 1 | Nomor struk offline: nomor sementara di perangkat, nomor final dari server saat sinkronisasi | ✅ Dikonfirmasi |
| 2 | Profit = pendapatan − pengeluaran − komisi | ✅ Dikonfirmasi |
| 3 | Deployment ke satu VPS dengan Docker Compose | ✅ Dikonfirmasi |
| 4 | Tidak ada integrasi QRIS/EDC nyata — metode bayar dicatat saja | ✅ Dikonfirmasi |
| 5 | WhatsApp: stub/log dulu, tidak memanggil Meta API | ✅ Dikonfirmasi |

