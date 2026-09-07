# Panduan Deployment & Arsitektur Cloud (PRISMA POS v3.2)
### Full-Stack Serverless Deployment: Vercel + Aiven for MySQL

Dokumen ini berisi panduan teknis operasional untuk konfigurasi lingkungan produksi, deployment arsitektur serverless ke platform **Vercel**, inisialisasi kluster cloud database **Aiven for MySQL** (dengan 12 tabel master & matriks RBAC), konfigurasi SMTP dinas, serta prosedur verifikasi pasca-deployment.

---

## 1. Arsitektur Deployment

PRISMA POS dirancang dengan arsitektur **Enterprise Full-Stack Serverless**:
- **Frontend SPA**: React 18 + Vite dikompilasi menjadi aset statis optimal (`dist/`) dan disajikan melalui jaringan Vercel Global Edge CDN.
- **Backend REST API**: Node.js + Express 5.x berjalan sebagai **Vercel Serverless Function** via [`api/index.js`](file:///c:/Users/Asus/Documents/POSIND/POSO/api/index.js) yang mengekspor instance aplikasi Express.
- **Routing & Rewrites**: Seluruh permintaan HTTP ke `/api/*` diarahkan secara otomatis ke serverless function oleh [`vercel.json`](file:///c:/Users/Asus/Documents/POSIND/POSO/vercel.json), sementara rute halaman lainnya diarahkan ke `index.html` (SPA fallback).
- **Database Master**: Basis data relasional terkelola **Aiven for MySQL 8.0** (`defaultdb`) dengan enkripsi penuh (TLS 1.3 / SSL Mode: REQUIRED) dan connection pooling otomatis.
- **Layanan Notifikasi Email**: Nodemailer terintegrasi dengan relay SMTP (Gmail App Password atau Corporate SMTP Server) untuk pengiriman kode verifikasi OTP dan notifikasi dinas.

---

## 2. Prasyarat Deployment

Sebelum memulai proses deployment produksi, pastikan telah menyiapkan:
1. Akun **Vercel** ([vercel.com](https://vercel.com)) yang telah terhubung dengan akun repositori Git (GitHub / GitLab).
2. Layanan **Aiven for MySQL** aktif ([aiven.io](https://aiven.io)) dengan Service URI atau rincian: Host, Port, Username, Password, Database (`defaultdb`), dan SSL Mode REQUIRED.
3. Akun SMTP terverifikasi (cth: Akun Google Workspace / Gmail dengan *App Password 16 karakter* aktif, atau Corporate Exchange / Postfix).
4. Node.js versi 18.x atau 20.x LTS pada mesin lokal untuk eksekusi migrasi awal.

---

## 3. Konfigurasi Variabel Lingkungan Produksi (Vercel)

Pada dashboard proyek di **Vercel** (*Settings > Environment Variables*), daftarkan seluruh variabel lingkungan berikut untuk environment **Production** dan **Preview**:

| Variabel | Format / Contoh | Keterangan Wajib |
|---|---|---|
| `DB_HOST` | `your-mysql-host.aivencloud.com` | Host kluster database Aiven MySQL |
| `DB_PORT` | `21970` | Port layanan Aiven MySQL |
| `DB_USER` | `avnadmin` | Pengguna master database |
| `DB_PASSWORD` | `[AIVEN_PASSWORD]` | Kata sandi master database cloud |
| `DB_NAME` | `defaultdb` | Nama database target |
| `DB_SSL` | `true` | **Wajib `true`** (Aiven menolak koneksi tanpa SSL/TLS) |
| `PORT` | `5001` | Port internal Express listener |
| `JWT_SECRET` | `[SECURE_RANDOM_SECRET_KEY]` | String acak panjang aman untuk penandatanganan token JWT |
| `SMTP_HOST` | `smtp.gmail.com` | Host server SMTP email |
| `SMTP_PORT` | `587` | Port server SMTP (587 untuk TLS / STARTTLS) |
| `SMTP_USER` | `poso.kedinasan@gmail.com` | Alamat email akun pengirim SMTP |
| `SMTP_PASS` | `[16_DIGIT_APP_PASSWORD]` | Kata sandi aplikasi / app password SMTP |
| `EMAIL_FROM` | `"PRISMA POS Kedinasan" <noreply@posindonesia.co.id>` | Format nama pengirim dan alamat email dinas |

> [!IMPORTANT]
> Pastikan variabel `DB_SSL` selalu bernilai `true`. Kluster cloud database Aiven for MySQL secara ketat menolak setiap upaya koneksi yang tidak menyertakan enkripsi SSL/TLS.

---

## 4. Langkah-Langkah Deployment ke Vercel

### Metode A: Melalui Vercel Web Dashboard (Sangat Direkomendasikan)
1. **Push Kode ke Repositori**: Pastikan seluruh pembaruan kode terbaru telah di-commit ke branch `main`.
2. **Import Project di Vercel**:
   - Masuk ke dashboard [Vercel](https://vercel.com) > klik tombol **Add New... > Project**.
   - Pilih repositori Git PRISMA POS.
3. **Konfigurasi Project Settings**:
   - **Framework Preset**: Pilih **Vite**.
   - **Build Command**: `npm run build` (atau `tsc && vite build`).
   - **Output Directory**: `dist`.
   - **Install Command**: `npm install`.
4. **Input Environment Variables**: Salin dan tempelkan seluruh daftar variabel lingkungan dari Bagian 3.
5. **Klik Deploy**: Vercel akan otomatis mengompilasi bundel frontend dan mendaftarkan serverless API handler.

---

### Metode B: Menggunakan Vercel CLI
Jika Anda mengelola deployment langsung dari terminal:
```bash
# 1. Login ke Vercel CLI
npx vercel login

# 2. Tautkan direktori lokal ke proyek Vercel
npx vercel link

# 3. Tarik environment variables untuk verifikasi lokal
npx vercel env pull .env.production

# 4. Bangun dan deploy langsung ke lingkungan produksi
npx vercel --prod
```

---

## 5. Inisialisasi Skema Basis Data di Cloud Aiven

Sebelum aplikasi digunakan secara operasional oleh para staf, struktur basis data, tabel master geografis, katalog permission, dan akun resmi harus diinisialisasi pada database Aiven:

```bash
# 1. Pastikan file .env lokal terhubung ke database target Aiven
npm run test:db

# 2. Jalankan skrip migrasi terpusat
npm run migrate
```

Skrip migrasi `server/database/migrate.js` secara otomatis menjalankan:
1. **Pembuatan 12 Tabel Relasional**:
   - Master Organisasi: `regions`, `offices`
   - Otorisasi & Hak Akses: `roles`, `permissions`, `role_permissions`, `user_permissions`
   - Tata Kelola Akun: `registration_approvals`, `users`
   - Operasional Tiket & Komunikasi: `tickets`, `threads`, `audit_logs`, `system_config`
2. **Konfigurasi 3 Peran Bisnis Resmi**:
   - `ADMIN` (Super Administrator — Global Scope)
   - `PETUGAS_UPT` (Petugas Helpdesk UPT Pusat — Global Scope)
   - `UPT_LUAR` (Staf Kantor Cabang/Regional — Office Scope)
3. **Inisialisasi 25+ Katalog Izin Granular**:
   - Modul Tiket: `ticket.view`, `ticket.create`, `ticket.update`, `ticket.reply`, `ticket.claim`, `ticket.assign`, `ticket.change_status`, `ticket.resolve`, `ticket.close`, `ticket.triage`.
   - Modul Pengguna & Akses: `user.view`, `user.create`, `user.update`, `user.deactivate`, `user.assign_role`, `approval.view`, `approval.manage`, `permission.view`, `permission.manage`.
   - Modul Monitoring & Sistem: `monitoring.view`, `analytics.view`, `sla.view`, `audit.view`, `system.settings`.
4. **Penetapan Baseline Role**:
   - `ADMIN`: Memiliki hak penuh pada seluruh permission (`ALLOW`).
   - `PETUGAS_UPT`: Memiliki hak triase, ubah status, resolusi, dan penutupan tiket.
   - `UPT_LUAR`: Hanya memiliki hak `dashboard.view`, `ticket.create`, `ticket.view_own`, dan `ticket.reply_own`. **Sama sekali tidak memiliki izin menutup atau mengubah status tiket**.
5. **Seeding Akun Master & Demo Resmi**:
   - Super Admin: `admin@poso.local` / `Admin123!`
   - Petugas UPT Pusat: `operator@poso.local` / `Operator123!`
   - Petugas UPT TI: `upt.ti@poso.local` / `Poso123!`
   - Petugas UPT Sarpras: `upt.sarpras@poso.local` / `Poso123!`
   - Staf KCU Bandung: `andi.cabang@poso.local` / `Poso123!`
   - Supervisor Regional 3: `budi.regional3@poso.local` / `Poso123!`
   - Pendaftar Pending: `hendra.pending@poso.local` / `Poso123!`

---

## 6. Verifikasi & Pengujian Pasca-Deployment

Setelah proses deployment Vercel dan migrasi basis data Aiven selesai, lakukan serangkaian verifikasi kesehatan sistem:

### 1. Eksekusi Pengujian Alur Kerja Otomatis (E2E Automated Test)
Jalankan skrip pengujian alur kerja terpadu:
```bash
node server/database/test_e2e_workflow.js
```
Skrip ini akan memvalidasi:
- Login langsung akun Administrator.
- Pendaftaran akun baru staf cabang (masuk ke antrean `PENDING`).
- Persetujuan pendaftaran akun oleh Administrator.
- Pembuatan tiket dinas oleh staf kantor cabang.
- Respon tiket dan catatan thread percakapan dua arah.
- Perubahan status tiket ke `in_progress` oleh Admin/Petugas Pusat.
- Penutupan resmi tiket ke status `closed`.
- Verifikasi akhir integritas data tiket dan thread pesan.

### 2. Uji Status Kesehatan Backend (API Health Check)
Akses endpoint health check melalui peramban:
```
https://[domain-aplikasi-anda].vercel.app/api/health
```
Pastikan respons berstatus `success` dan menampilkan latensi database (<100ms).

### 3. Uji Pembatasan Wewenang Penutupan Tiket (Strict Resolution Rule)
- Masuk menggunakan akun staf kantor cabang: `andi.cabang@poso.local`.
- Buka detail tiket di workstation atau portal *Tiket Saya*.
- Pastikan tombol perubahan status dan tombol penutupan tiket **tidak muncul**.
- Jika dicoba via permintaan HTTP PATCH langsung, server wajib mengembalikan kode **HTTP 403 Forbidden**.

### 4. Uji Isolasi Data Antarkantor Cabang (Office Data Isolation)
- Tiket yang dibuat oleh `andi.cabang@poso.local` (KCU Bandung) hanya boleh terlihat oleh rekan satu kantornya, Admin Pusat, dan Petugas UPT Pusat.
- Tiket tersebut tidak boleh tampil di antarmuka staf kantor cabang lain.

### 5. Uji Pemantauan Kluster Basis Data Aiven
- Masuk sebagai Administrator (`admin@poso.local`).
- Buka menu **Database Aiven** pada sidebar workstation.
- Pastikan indikator status koneksi berwarna hijau (*Connected*), latensi ping terpantau, dan tabel-tabel terdeteksi dengan jumlah baris yang akurat.

---

## 7. Prosedur Pemeliharaan & Pemulihan Sistem

### A. Reset Multi-Factor Authentication (MFA) Pengguna
Jika terdapat pegawai atau staf dinas yang kehilangan perangkat atau aplikasi authenticator:
1. Buka menu **Manajemen Staf & Hak Akses** (`/dashboard` > `users`).
2. Cari nama atau NIP staf terkait.
3. Klik tombol aksi **Reset MFA** di sebelah kanan tabel.
4. Sistem akan mengosongkan secret TOTP staf tersebut dan mencatat tindakan reset ke dalam Log Audit Keamanan.
5. Staf dapat masuk kembali hanya menggunakan kata sandinya, kemudian menyusun ulang konfigurasi MFA baru.

### B. Rotasi Kunci Rahasia JWT
Jika diperlukan rotasi kredensial keamanan:
1. Buka Vercel Dashboard > Project Settings > Environment Variables.
2. Perbarui nilai variabel `JWT_SECRET` dengan kunci rahasia baru.
3. Lakukan redeploy proyek (*Redeploy without Cache*). Seluruh sesi login sebelumnya akan otomatis kedaluwarsa demi keamanan.

### C. Pencadangan & Pemulihan Basis Data (Backup & Restore)
Layanan **Aiven for MySQL** secara otomatis menjalankan *automated point-in-time recovery (PITR)* cadangan data harian. Jika diperlukan cadangan manual sebelum pembaruan skema:
```bash
# Dump basis data Aiven ke file lokal
mysqldump -h [AIVEN_HOST] -P [AIVEN_PORT] -u avnadmin -p --ssl-mode=REQUIRED defaultdb > backup_prisma_pos_$(date +%Y%m%d).sql
```
