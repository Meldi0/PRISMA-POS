# PRISMA POS — Pos Resolution & Integrated Service Management Application

> **Sistem Helpdesk & Manajemen Tiket Terpadu Kedinasan PT Pos Indonesia (Persero)**  
> *Versi 2.7.0 — Dynamic Database Switcher (Online & Offline), Telegram Bot Gateway, MFA OTP Email, Rekap Produktivitas Operator, Otomasi Regional, & Reopen Tiket Release*

Aplikasi Helpdesk dan Manajemen Tiket Terpadu modern berbasis web yang dirancang khusus untuk lingkungan kerja **PT Pos Indonesia (Persero)**. Menghubungkan Kantor Pos Cabang (KCU/KC/KCP), Kantor Regional, dan Kantor Pusat Pengendalian Operasi dalam satu ekosistem terpadu berdesain elegan **Ocean Cyan Glassmorphism** yang sepenuhnya responsif di semua ukuran perangkat (desktop, tablet, dan smartphone).

---

## Fitur Utama Sistem

### 1. Tata Kelola Akses & 3 Peran Bisnis Utama
- **ADMIN (Super Administrator — Global Scope)**: Kendali penuh sistem, persetujuan pendaftar baru, manajemen staf dinas, penyesuaian izin granular, pemantauan audit forensik, dan konfigurasi fleksibel basis data (Online & Offline).
- **PETUGAS_UPT (Petugas Helpdesk UPT Pusat — Global Scope)**: Triase tiket nasional, klaim penugasan, investigasi teknis, komunikasi publik & catatan internal staf (🔒), serta perubahan status dan penutupan tiket.
- **UPT_LUAR (Staf Kantor Cabang & Regional — Office Scope)**: Pengajuan tiket kendala operasional, pemantauan status tiket, dan komunikasi dua arah.

### 2. Aturan Ketat Resolusi Tiket (*Strict Resolution Rule*)
- **UPT_LUAR Dilarang Mengubah Status atau Menutup Tiket**: Mencegah penutupan tiket sepihak dan manipulasi progres di daerah.
- Seluruh kewenangan pengubahan status (`open` -> `in_progress` -> `waiting` -> `closed`) dan penutupan resmi tiket dikhususkan hanya untuk **ADMIN** dan **PETUGAS_UPT** di Kantor Pusat demi menjamin akurasi kepatuhan SLA.

### 3. Isolasi Data Tingkat Kantor (*Office-Level Data Isolation*)
- Staf kantor cabang (UPT_LUAR) hanya dapat melihat tiket yang diajukan oleh dirinya dan rekan satu kantor cabangnya.
- Tiket kantor cabang lain terisolasi secara aman di tingkat query database (`WHERE office_id = ?`).
- Kantor Pusat (ADMIN & PETUGAS_UPT) memiliki visibilitas global ke seluruh tiket se-Indonesia.

### 4. Alur Persetujuan Registrasi Pegawai Dinas (*Registration Approval Workflow*)
- Pendaftaran mandiri pegawai baru (`/register`) otomatis berstatus `PENDING`.
- Akun wajib ditinjau dan disetujui (`APPROVED`) oleh Admin Pusat melalui antrean `/admin/approvals` sebelum dapat masuk ke sistem.

### 5. Matriks Hak Akses Granular (*Granular Access Control Matrix*)
- Dukungan penyesuaian izin individual per pengguna (*User Permission Overrides*) terhadap 25+ permission katalog dengan efek `ALLOW`, `DENY`, atau `INHERIT` melalui laci interaktif `ManageAccessDrawer`.

### 6. Keamanan Enterprise & Log Audit Forensik
- **Multi-Factor Authentication (MFA — OTP Email)**: Setelah verifikasi password berhasil, sistem mengirimkan kode OTP 6 digit ke email terdaftar pengguna. Kode wajib dimasukkan sebelum dapat mengakses sistem.
- **Reset MFA oleh Admin**: Fitur pemulihan akun cepat bagi staf yang kehilangan akses.
- **Log Audit Forensik**: Seluruh aktivitas login, persetujuan staf, perubahan hak akses, pergantian database, dan manipulasi tiket tersimpan permanen di tabel `audit_logs`.

### 7. Workstation Triase Cerdas & Modul Arsip
- **Papan Triase Kanban 3-Kolom**: Fokus triase khusus pada tiket aktif (`Open`, `In Progress`, `Menunggu`).
- **Modul Arsip Tiket Selesai Mandiri**: Tiket selesai otomatis berpindah ke modul arsip berformat tabel densitas tinggi dengan pencarian cepat nomor ID tiket.
- **Laci Inspeksi Tiket Bertab**: Tab Diskusi publik & internal, Tab Triase & UPT, serta Tab Informasi SLA.

### 8. Kompresi Foto Cerdas & Notifikasi Real-Time
- **Auto-Kompresi Gambar di Klien**: Reduksi ukuran foto bukti kerusakan hingga 85% (~200KB) langsung di peramban pelapor sebelum dikirimkan ke server.
- **Sistem Notifikasi Berlapis**: Nada denting harmonik Web Audio API tanpa latensi, push notification browser desktop, lonceng notifikasi, widget mengambang *Floating Chat Badge*, dan notifikasi email dinas via SMTP.

### 9. Rekap Produktivitas Operator
- **Dashboard Rekap per Atasan**: Tabel produktivitas tiket yang ditangani setiap operator (berdasarkan aksi nyata, bukan sekadar melihat tiket).
- **Akses Terbatas**: Hanya Manager/Atasan (permission `operator.stats_view`) dapat mengakses laporan ini.
- **Export CSV**: Data produktivitas dapat diunduh untuk keperluan pelaporan.

### 10. Otomasi Data Regional & Kantor
- **Tanpa Dropdown Manual**: Data Wilayah Regional dan Kantor Cabang otomatis terisi dari profil akun login.
- **Read-Only Card**: Pelapor melihat kartu unit kerja yang tidak dapat diubah — mencegah kesalahan input dan manipulasi data.

### 11. Kunci Chat Tiket Tutup & Mekanisme Buka Kembali
- **Chat Dinonaktifkan**: Setelah tiket berstatus Closed, kolom percakapan pelapor terkunci.
- **Ajukan Buka Kembali**: Pelapor dapat mengajukan permohonan buka kembali tiket disertai alasan.
- **Review Operator**: Operator UPT meninjau permohonan dan memutuskan Setujui (tiket aktif kembali) atau Tolak (tiket tetap tertutup).

### 12. Telegram Bot Gateway (Notifikasi Real-Time Helpdesk)
- **Notifikasi Otomatis ke Grup Tim**: Mengirim pesan peringatan instan ke grup/channel Telegram staf operasional saat terjadi tiket baru (terutama prioritas URGENT & HIGH), perubahan status penanganan, balasan baru, dan permohonan buka kembali tiket.
- **Panel Manajemen Admin**: Kartu integrasi di tab Basis Data & Integrasi dengan status koneksi, profil bot `@PriposBot`, masked token, dan tombol *Test Ping*.
- **URL Sanitizer Cerdas**: Memastikan tautan tombol inline keyboard kompatibel secara otomatis di lingkungan development lokal maupun live deployment.

### 13. Konfigurasi Basis Data Dinamis via Web (Online Cloud & Offline Lokal)
- **Manajemen Basis Data Terpadu**: Administrator dapat mengonfigurasi dan beralih koneksi database langsung dari Web Dashboard tanpa perlu menyunting file `.env` secara manual atau mematikan proses backend.
- **Preset 1-Klik**: Tombol preset instan untuk **Mode Online (Cloud Aiven MySQL - SSL ON)** dan **Mode Offline (Localhost:3306 / XAMPP / MariaDB - SSL OFF)**.
- **Uji Koneksi Target Diagnostik**: Pengujian koneksi sementara (latensi ping, versi MySQL, ketersediaan 14 tabel sistem) sebelum konfigurasi diterapkan.
- **Hot-Swap Connection Pool & Persistensi .env**: Pool koneksi beralih dinamis secara transparan dan otomatis tersimpan ke file `.env` root serta tercatat di `audit_logs`.
- **Inisialisasi Skema & Data Master Sekali Klik**: Tombol *One-Click Migration Tool* untuk menginisialisasi seluruh tabel dan akun master saat beralih ke database lokal baru yang masih kosong.

---

## Teknologi & Arsitektur (Tech Stack)

- **Frontend**: React 18.3, TypeScript 5.7, Vite 6.1, Tailwind CSS v3.4, Framer Motion v11, Lucide React Icons
- **Backend API**: Node.js, Express 5.x RESTful API, Vercel Serverless Functions
- **Basis Data Master**: Dual-Mode Database Engine:
  - **Online**: Cloud Managed Relational Database **Aiven for MySQL 8.0** (TLS 1.3 / SSL Mode: REQUIRED)
  - **Offline / On-Premise**: **MySQL 5.7+ / MariaDB 10.3+ / XAMPP** (Localhost / Intranet), didukung Dynamic Proxy Pool Hot-Swap
- **Keamanan & Kriptografi**: BCrypt.js (Salt rounds: 10), JSON Web Token (JWT), RFC 6238 TOTP Engine
- **Layanan Email**: Nodemailer (SMTP Transport Client)
- **Gateway Notifikasi Eksternal**: Telegram Bot API (Native Fetch, Lightweight REST Integration)
- **Sinkronisasi Real-time**: Web Audio API, WebSocket, BroadcastChannel & LocalStorage Event Engine

---

## Panduan Memulai Cepat (Quick Start)

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Konfigurasi Variabel Lingkungan
Salin berkas contoh lingkungan `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Sesuaikan kredensial koneksi Aiven for MySQL, SMTP, dan Telegram Bot Gateway:
```env
DB_HOST=your-mysql-host.aivencloud.com
DB_PORT=21970
DB_USER=avnadmin
DB_PASSWORD=YOUR_AIVEN_PASSWORD
DB_NAME=defaultdb
DB_SSL=true
PORT=5001
JWT_SECRET=your_jwt_secret_key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="PRISMA POS Kedinasan" <noreply@posindonesia.co.id>

# Telegram Bot Gateway (opsional, jika ingin notifikasi grup Telegram)
TELEGRAM_BOT_TOKEN=8826254985:AAE8vrvRcCNs4kJlYEF7CLtKzgYpH6xFuF8
TELEGRAM_CHAT_ID=-5349405519
TELEGRAM_NOTIF_ENABLED=true
APP_BASE_URL=http://localhost:5173
```

### 3. Uji Koneksi & Migrasi Basis Data
```bash
# Uji konektivitas database Aiven
npm run test:db

# Jalankan migrasi 12 tabel master, matriks izin, dan akun demo resmi
npm run migrate
```

### 4. Uji Alur Kerja End-to-End (E2E) Otomatis
Jalankan skrip validasi alur kerja menyeluruh (login admin -> registrasi staf -> approval -> buat tiket -> respon thread -> update status -> penutupan tiket):
```bash
node server/database/test_e2e_workflow.js
```

### 5. Menjalankan Aplikasi
```bash
npm run dev
```
Akses aplikasi melalui peramban: `http://localhost:3000` (atau port yang ditentukan Vite).

---

## Daftar Akun Pengujian Default

| Peran Bisnis | Email | Kata Sandi | Cakupan (*Scope*) | Unit Kerja Penempatan |
|---|---|---|---|---|
| **ADMIN** | `admin@poso.local` | `Admin123!` | GLOBAL | Kantor Pusat Pengendalian Operasi |
| **PETUGAS_UPT** | `operator@poso.local` | `Operator123!` | GLOBAL | Kantor Pusat (Helpdesk Triase) |
| **PETUGAS_UPT** | `upt.ti@poso.local` | `Poso123!` | GLOBAL | UPT TI & Sistem Informasi Pusat |
| **UPT_LUAR** | `andi.cabang@poso.local` | `Poso123!` | OFFICE | KCU Bandung (Regional 3) |
| **UPT_LUAR** | `budi.regional3@poso.local` | `Poso123!` | OFFICE | Kantor Regional 3 Jabar & Banten |
| **UPT_LUAR (Pending)** | `hendra.pending@poso.local` | `Poso123!` | OFFICE | KC Cimahi (Menunggu Approval) |

*Catatan: Semua akun demo memerlukan MFA OTP saat login. Gunakan kode `123456` sebagai fallback testing jika SMTP tidak tersedia.*

---

## Dokumentasi Terkait

Untuk informasi lebih mendalam, silakan merujuk pada dokumen-dokumen resmi proyek:

| Dokumen | Tipe & Deskripsi |
|---|---|
| [AKUN_DEMO_LOGIN.txt](file:///c:/Users/Asus/Documents/POSIND/POSO/AKUN_DEMO_LOGIN.txt) | Kredensial akun demo, aturan resolusi tiket, dan catatan isolasi data |
| [POSO_BRD.md](file:///c:/Users/Asus/Documents/POSIND/POSO/POSO_BRD.md) | Business Requirements Document & analisis nilai bisnis sistem kedinasan |
| [POSO_PRD.md](file:///c:/Users/Asus/Documents/POSIND/POSO/POSO_PRD.md) | Product Requirements Document, spesifikasi 12 tabel database, & katalog API |
| [DEPLOYMENT.md](file:///c:/Users/Asus/Documents/POSIND/POSO/DEPLOYMENT.md) | Panduan deployment serverless Vercel, Aiven MySQL, & konfigurasi produksi |
| [PANDUAN_PENGGUNAAN.md](file:///c:/Users/Asus/Documents/POSIND/POSO/PANDUAN_PENGGUNAAN.md) | Panduan operasional workstation helpdesk untuk masing-masing peran pengguna |
| [CATATAN_PERUBAHAN_FITUR.md](./CATATAN_PERUBAHAN_FITUR.md) | Catatan rilis v2.7.0: Dynamic Database Switcher (Online/Offline), Telegram Bot Gateway, MFA OTP, rekap produktivitas, otomasi regional, reopen tiket |

---

## Lisensi & Hak Cipta

Hak Cipta © 2026 PT Pos Indonesia (Persero). Seluruh hak dilindungi undang-undang.
