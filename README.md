# BarberFlow 💈

> **Aplikasi SaaS Manajemen Barbershop Indonesia (Web & PWA Mobile-First)**  
> Dirancang khusus untuk UMKM pangkas rambut dan barbershop di Indonesia dengan model langganan bulanan (*Starter* & *Pro*), fitur kasir offline-ready, isolasi data pelanggan sesuai UU PDP, dan cetak nota termal langsung dari peramban.

---

## 🚀 Fitur Utama

- **Papan Antrean Digital (Kanban)**: Pelacakan antrean langsung (*Menunggu*, *Dilayani*, *Selesai*) untuk kenyamanan kapster dan kasir.
- **Kasir & Cetak Struk POS**:
  - Keranjang layanan cukur dan produk ritel.
  - Perhitungan diskon otomatis (persen & nominal).
  - Metode bayar: Tunai, QRIS, dan Transfer Bank.
  - Cetak struk termal 58mm & 80mm via dialog cetak browser (tanpa driver khusus).
  - Tautan nota digital publik yang aman (`/receipt/:token`).
- **Mode Offline & Sinkronisasi Idempotent**:
  - Transaksi tetap berjalan lancar saat internet mati menggunakan penyimpanan browser **IndexedDB**.
  - Nomor struk sementara unik berbasis perangkat (`OFFLINE-{device_id}-{seq}`).
  - Sinkronisasi otomatis saat kembali online tanpa risiko nomor ganda atau duplikasi komisi.
- **Manajemen Pelanggan & Kepatuhan UU PDP**:
  - Pencatatan persetujuan (*consent*) pelanggan secara eksplisit sebelum pengiriman notifikasi/pengingat.
- **Kalkulasi Komisi Kapster Otomatis (Pro)**:
  - Aturan komisi fleksibel per kapster (persen dari harga bersih atau nominal tetap per layanan/produk).
  - Laporan rekapitulasi komisi periodik.
- **Laporan Keuangan & Kinerja (Pro)**:
  - Ringkasan pendapatan, pengeluaran operasional, total komisi, dan laba bersih.
  - Grafik breakdown metode pembayaran dan peringkat 5 layanan/kapster terlaris.
- **Reservasi / Booking Online Publik (Pro)**:
  - Tautan pemesanan online khusus untuk setiap barbershop: `/{slug}/book`.
  - Pencegahan jadwal bentrok (*double booking*) otomatis di tingkat basis data PostgreSQL menggunakan *exclusion constraint* (`EXCLUDE USING gist`).
  - Dilengkapi generator & pengunduh **QR Code** untuk dipasang di meja kasir atau etalase toko.
  - Halaman internal **Jadwal Booking** untuk owner dan kasir.
- **Panel Platform Super Admin (`/admin/*`)**:
  - Manajemen seluruh tenant barbershop, status aktivasi, pergantian paket *Starter/Pro*, dan *feature flag override*.
  - Terisolasi penuh: Role basis data platform tidak memiliki hak akses membaca data transaksi atau data pribadi pelanggan tenant.
- **Pengingat WhatsApp (Pro, Stub Mode)**:
  - Integrasi stub logger hemat biaya (tidak membebankan tagihan API pihak ketiga kepada UMKM).
  - Kuota 100 pesan/bulan untuk paket Pro dengan pengecekan consent UU PDP.

---

## 🛠️ Arsitektur & Teknologi

| Lapisan | Teknologi | Keterangan |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 | PWA (*Progressive Web App*), mobile-first |
| **Backend API** | Node.js (>=22), Hono, TypeScript, Zod | Ringan, cepat, aman, JWT Cookie session |
| **Basis Data** | PostgreSQL 16 dengan Row-Level Security (RLS) | Multi-tenant kuat, data terisolasi per tenant |
| **Web Server & HTTPS** | Caddy v2, Nginx Alpine | Otomatisasi sertifikat SSL Let's Encrypt |
| **Offline Engine** | IndexedDB, Service Worker (Workbox) | Sinkronisasi batch dengan idempotency key |

### 🔐 Desain Keamanan 3-Role Basis Data

1. **`barberflow_owner`**: Superuser lokal untuk menjalankan skrip migrasi skema tabel.
2. **`barberflow_app`**: Digunakan oleh API aplikasi harian. Setiap transaksi mengeksekusi `set_config('app.tenant_id', ...)` sehingga PostgreSQL RLS otomatis menyaring data agar Tenant A tidak dapat melihat data Tenant B.
3. **`barberflow_platform`**: Digunakan oleh panel Super Admin untuk memantau metrik agregat tenant tanpa hak membaca (*no GRANT*) tabel `customers` dan `transactions`.

---

## 💻 Panduan Instalasi Lokal (Development)

### Prasyarat
- **Node.js** versi 22 atau lebih baru
- **Docker Desktop** (untuk database PostgreSQL lokal)

### Langkah Setup

1. **Clone repositori**:
   ```bash
   git clone https://github.com/your-org/barberflow.git
   cd barberflow
   ```

2. **Siapkan variabel lingkungan**:
   ```bash
   cp .env.example .env
   ```

3. **Instal dependensi workspace**:
   ```bash
   npm install
   ```

4. **Jalankan database lokal**:
   ```bash
   npm run db:up
   ```

5. **Jalankan migrasi skema**:
   ```bash
   npm run db:migrate
   ```

6. **Jalankan seed data demo**:
   ```bash
   npm run seed -w @barberflow/api
   ```
   *Akun Demo yang tersedia:*
   - **Owner**: `owner@demo.com` / Password: `demo1234`
   - **Kasir**: `kasir@demo.com` / Password: `demo1234`
   - **Super Admin**: `admin@platform.local` / Password: `adminpassword123`

7. **Jalankan server pengembangan**:
   ```bash
   # Terminal 1: Backend API (Port 3000)
   npm run dev:api

   # Terminal 2: Frontend Web (Port 5173)
   npm run dev -w @barberflow/web
   ```
   Buka peramban di `http://localhost:5173`.

---

## 🖨️ Panduan Penggunaan Printer Termal

BarberFlow mendukung pencetakan langsung ke printer kasir mini portabel Bluetooth maupun printer kasir USB desktop tanpa memerlukan instalasi aplikasi jembatan (*bridge*):

1. **Format Kertas yang Didukung**:
   - **58 mm**: Printer kasir mini / Bluetooth portabel (disarankan untuk barbershop kecil/hemat ruang).
   - **80 mm**: Printer POS desktop standar.
2. **Pengaturan Format di Aplikasi**:
   - Buka menu **Pengaturan** → **Profil Toko**.
   - Pilih ukuran kertas (58 mm atau 80 mm) dan isi pesan kaki struk (*footer*).
3. **Mencetak Struk**:
   - Setelah checkout di halaman Kasir, klik tombol **Cetak Struk**.
   - Pada dialog cetak peramban:
     - Pilih printer termal Anda pada tujuan (*Destination*).
     - Atur margin ke **None** / **Minimum**.
     - Hapus centang pada opsi *Headers and Footers*.
   - Alternatif: Klik tombol **Unduh PDF** untuk menyimpan salinan digital struk.

---

## 🌐 Panduan Deployment Produksi (VPS Mandiri)

Deployment produksi dikemas lengkap menggunakan Docker Compose dan Caddy yang menangani sertifikat SSL Let's Encrypt otomatis:

1. **Siapkan server VPS** (Ubuntu 22.04+ disarankan, dengan Docker & Docker Compose).
2. **Clone repositori dan siapkan konfigurasi produksi**:
   ```bash
   git clone https://github.com/your-org/barberflow.git /opt/barberflow
   cd /opt/barberflow
   cp .env.prod.example .env.prod
   ```
3. **Sesuaikan `.env.prod`**:
   - Isi `DOMAIN` dengan domain/subdomain Anda (misal: `app.barberflow.id`).
   - Ubah seluruh kata sandi acak untuk basis data dan `JWT_SECRET`.
4. **Jalankan kontainer**:
   ```bash
   docker compose -f docker/compose.prod.yml --env-file .env.prod up -d --build
   ```
5. **Jalankan migrasi di dalam kontainer**:
   ```bash
   docker compose -f docker/compose.prod.yml exec api node dist/migrate.js
   ```

---

## 💾 Pencadangan & Pemulihan Basis Data (*Backup & Restore*)

### 1. Pencadangan Otomatis (*Backup*)
Jalankan skrip pencadangan:
```bash
bash scripts/backup.sh
```
- File arsip terkompresi disimpan di folder `backups/backup_YYYY-MM-DD_HH-MM-SS.sql.gz`.
- Skrip secara otomatis menghapus file cadangan yang berumur lebih dari 30 hari untuk menghemat ruang disk.
- *Tips*: Pasang di crontab VPS untuk eksekusi setiap malam jam 02:00:
  ```cron
  0 2 * * * cd /opt/barberflow && bash scripts/backup.sh >> /var/log/barberflow-backup.log 2>&1
  ```

### 2. Pemulihan Data (*Restore*)
Untuk memulihkan data dari arsip:
```bash
bash scripts/restore.sh backups/backup_2026-11-17_11-00-00.sql.gz
```
> ⚠️ **Catatan Keamanan**: Skrip pemulihan mewajibkan konfirmasi ketik `YA` sebelum mengeksekusi pengembalian data untuk mencegah kehilangan data akibat ketidaksengajaan.

---

## 🧪 Pengujian Kualitas (*Testing*)

Semua modul penting dilindungi oleh pengujian otomatis:

```bash
# Menjalankan seluruh unit test logika bisnis & integrasi keamanan
npm test

# Menjalankan typecheck TypeScript di seluruh monorepo
npm run typecheck

# Membangun bundle produksi frontend PWA
npm run build:web
```

---

## 📄 Lisensi

Hak Cipta © 2026 BarberFlow. Dilisensikan di bawah [MIT License](LICENSE).
