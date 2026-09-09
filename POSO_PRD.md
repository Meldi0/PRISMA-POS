# Product Requirements Document (PRD)
## Aplikasi: PRISMA POS — Pos Resolution & Integrated Service Management Application (v2.7.0)
### Sistem Helpdesk & Manajemen Tiket Terpadu PT Pos Indonesia (Persero)

**Versi:** 2.7.0 (Dynamic Database Switcher, Telegram Bot Gateway, MFA OTP Email, Rekap Produktivitas Operator, Otomasi Regional, Kunci Chat & Reopen Tiket)  
**Status:** Live & Production Ready  
**Tipe Dokumen:** Product Requirements & Technical Specification Document  

---

## 1. Ringkasan Produk

**PRISMA POS** (*Pos Resolution & Integrated Service Management Application* — kode rilis **POSO v3.2**) adalah sistem helpdesk dan manajemen tiket terpadu multi-channel skala enterprise yang dirancang khusus untuk memenuhi standar tata kelola operasional dan kepatuhan layanan **PT Pos Indonesia (Persero)**.

Sistem ini dibangun dengan arsitektur modern **React 18 + TypeScript + Vite** pada sisi frontend dengan antarmuka **Ocean Cyan Glassmorphism**, didukung backend REST API **Node.js / Express 5.x** siap deploy serverless di platform **Vercel**, basis data cloud **Aiven for MySQL 8.0** (dengan enkripsi TLS 1.3 / SSL Mode: REQUIRED), serta subsistem keamanan komprehensif yang mencakup:
1. **3 Peran Bisnis Utama Terstandardisasi**:
   - `ADMIN`: Super Administrator pengendali penuh sistem, persetujuan staf, izin granular, dan jejak forensik.
   - `PETUGAS_UPT`: Petugas Helpdesk & Triase Kantor Pusat yang memproses, mengubah status, dan menyelesaikan tiket secara nasional.
   - `UPT_LUAR`: Staf pelapor di Kantor Cabang/Regional yang memiliki hak mengajukan tiket dan memantau progres dalam lingkup kantornya.
2. **Aturan Ketat Resolusi Tiket (*Strict Resolution Rule*)**: Pengubahan status (`open` -> `in_progress` -> `waiting` -> `closed`) dan penutupan tiket dibatasi secara eksklusif hanya untuk peran `ADMIN` dan `PETUGAS_UPT`. Peran `UPT_LUAR` diblokir di tingkat antarmuka maupun API middleware dari upaya memanipulasi status atau menutup tiket.
3. **Isolasi Data Tingkat Kantor (*Office-Level Data Scoping*)**: Tiket yang diajukan oleh staf UPT Luar terikat pada `office_id` kantornya, sehingga staf di kantor cabang lain tidak dapat melihat tiket tersebut. Hanya staf di kantor yang sama serta petugas di Kantor Pusat yang memiliki visibilitas.
4. **Alur Persetujuan Registrasi Staf Dinas**: Pendaftaran staf baru menghasilkan akun berstatus `PENDING` yang wajib disetujui (`APPROVED`) oleh Admin Pusat di panel `/admin/approvals` sebelum dapat digunakan untuk masuk ke sistem.
5. **Matriks Hak Akses Granular**: Mesin otorisasi dinamis yang memadukan baseline peran (*Role Permissions*) dengan izin override perorangan (*User Permissions*) terhadap 25+ permission katalog.
6. **Multi-Factor Authentication (MFA — OTP Email)**: Setelah email & password terverifikasi, sistem mengirim kode OTP 6 digit ke email terdaftar pengguna. Kode wajib dimasukkan sebelum sesi login aktif.
7. **Jejak Audit Forensik Sistem**: Pencatatan otomatis setiap aksi login, persetujuan pendaftar, override izin, perubahan status tiket, dan manipulasi data pengguna ke dalam tabel `audit_logs`.
8. **Papan Triase Kanban Aktif & Modul Arsip Mandiri**: Pemisahan tegas antara tiket aktif (`open`, `in_progress`, `waiting`) di papan Kanban triase dan tiket selesai (`closed`) di modul Arsip berkecepatan tinggi.
9. **Rekap Produktivitas Operator**: Dashboard statistik per operator yang menampilkan jumlah tiket ditangani, total aksi, dan tiket diselesaikan. Akses terbatas untuk Manager/Atasan (permission `operator.stats_view`).
10. **Otomasi Data Regional & Kantor**: Data Wilayah Regional dan Kantor Cabang otomatis terisi dari profil akun login; tidak ada dropdown manual pada form pengajuan tiket.
11. **Kunci Chat Tiket Tutup & Mekanisme Buka Kembali**: Chat pelapor dinonaktifkan saat tiket berstatus Closed. Pelapor dapat mengajukan permohonan buka kembali. Operator meninjau dan memutuskan (Setujui / Tolak).
12. **Telegram Bot Gateway (Notifikasi Real-Time Helpdesk)**: Gateway pesan instan eksternal ke grup tim helpdesk PT Pos Indonesia untuk respon cepat terhadap tiket darurat (prioritas URGENT & HIGH), perubahan status, balasan tiket, dan permohonan buka kembali tiket.
13. **Dynamic Database Switcher & Web Configuration (Online Cloud & Offline Local)**: Panel konfigurasi dan peralihan database terpadu berbasis web eksklusif bagi Administrator. Memungkinkan transisi instan (*hot-swap*) antara klaster cloud Aiven MySQL (SSL Mode Required) dan database lokal (Localhost/XAMPP/MariaDB/Intranet) tanpa restart server, lengkap dengan uji koneksi target, persistensi otomatis ke file `.env`, serta alat inisialisasi skema tabel sekali klik (*One-Click Migration Tool*).

---

## 2. Arsitektur & Spesifikasi Teknologi (Tech Stack)

| Lapisan (*Layer*) | Komponen / Library | Keterangan & Peran Teknis |
|---|---|---|
| **Frontend Framework** | React 18.3 + TypeScript 5.7 + Vite 6.1 | Single Page Application (SPA) berkecepatan tinggi dengan routing dinamis `react-router-dom` v7 |
| **Styling & Design System** | Tailwind CSS v3.4 + Custom Tokens | Desain Ocean Cyan Glassmorphism, Apple-inspired spring physics, border semi-transparan |
| **Animasi & Interaksi** | Framer Motion v11 | Transisi halaman, modal pop-up, laci geser (*slide-over drawer*), dan efek hover physics |
| **Iconography** | Lucide React Icons v0.475 | Vektor SVG ringan, seragam, dan modern di seluruh antarmuka |
| **Audio Synthesizer** | Web Audio API (Native 0ms Latency) | Nada ganda harmonik C6/G6 tanpa unduhan aset audio eksternal |
| **Notifikasi Browser** | Web Push / Notification API | Pemberitahuan desktop saat tab browser berada di latar belakang (*background*) |
| **Backend Framework** | Node.js + Express 5.x (`server/`) | Arsitektur RESTful modular: JWT auth, RBAC granular middleware, connection pooling |
| **Serverless Engine** | Vercel Serverless Functions (`api/index.js`) | Handler serverless otomatis via `vercel.json` dengan full security headers |
| **Basis Data Master** | Dual-Mode: Aiven for MySQL 8.0 (Online, SSL REQUIRED) / MySQL 5.7+ / MariaDB 10.3+ / XAMPP (Offline) | Relational Database didukung Dynamic Pool Proxy (`server/config/db.js`) untuk peralihan instan (*hot-swap*) tanpa downtime |
| **Keamanan Jaringan** | TLS 1.3 / SSL Mode: REQUIRED (Cloud) & Plaintext (Lokal) | Enkripsi end-to-end koneksi database Aiven dengan validasi sertifikat CA (`ca.pem`), serta opsi non-SSL untuk lokal |
| **Enkripsi Kredensial** | BCrypt.js (Salt rounds: 10) + JWT | Penyimpanan hash kata sandi dan penandatanganan token otentikasi sesi kedinasan |
| **Otentikasi Dua Faktor** | Speakeasy / Native TOTP Engine | Algoritma RFC 6238 TOTP, QR-code provisioning, dan verifikasi OTP 6 digit |
| **Layanan Surat Elektronik** | Nodemailer (SMTP Client) | Pengiriman kode OTP login dan notifikasi dinas via SMTP (Gmail / Corporate Mailer) |
| **Gateway Notifikasi Eksternal** | Telegram Bot API | RESTful bot notification engine via native Node.js fetch, sanitasi inline keyboard URL |
| **Sinkronisasi Real-Time** | WebSocket + BroadcastChannel + Storage Events | Sinkronisasi multi-tab dan pembaruan data real-time (<50ms) |

---

## 3. Sistem Desain & Ergonomi Antarmuka (UI/UX)

### 3.1 Token Warna & Identitas Visual
- **Brand Visual**: Logo resmi PRISMA POS (`/prisma-pos-logo.png`) & Favicon tab bar terintegrasi.
- **Canvas Background**: Light Ice Canvas (`#F4F7F9`).
- **Deep Ocean Slate**: `#083342` (Sidebar workstation & dark card backgrounds).
- **Primary Ocean**: `#0D5C75` (Tombol utama, heading, dan accent aktif).
- **Accent Cyan**: `#199FB1` (Hover state, badge aktif, dan highlight interaktif).
- **Accent Coral**: `#F58A61` (Floating Action Button & penanda tiket urgent).
- **Glassmorphism Styles**: `.apple-glass` dan `.apple-glass-card` dengan backdrop blur 20px dan border semi-transparan (`rgba(255, 255, 255, 0.7)`).
- **Tipografi**: Plus Jakarta Sans (Google Fonts) dari bobot Light (300) hingga Extra Bold (800).

### 3.2 Ergonomi & Fitur Responsivitas
- **Responsive Navigation**: Sidebar dapat diciutkan (*Desktop Mini-Rail*) pada layar besar dan berubah menjadi *Mobile Slide Drawer* dengan tombol hamburger pada smartphone.
- **Searchable Select**: Komponen pemilih dinamis pencarian kantor cabang dan regional tanpa meluap di layar kecil (`SearchableSelect.tsx`).
- **Global Keyboard Shortcuts**: Pintasan `Ctrl+K` / `Cmd+K` untuk Command Palette pencarian instan tiket, navigasi menu, dan `Esc` untuk menutup modal/drawer.
- **Adaptive Data Views**: Penukaran instan antara tampilan Kanban Board dan Tabel Terstruktur, dengan konversi otomatis ke *stacked card list* pada layar ponsel.

---

## 4. Struktur Modul & Spesifikasi Fungsional

### 4.1 Portal Pelapor & Staf Kantor Cabang (`/submit`, `/track`, `/my-tickets`)
1. **Formulir Pengajuan Tiket Mandiri (`/submit`)**:
   - Data Wilayah Regional dan Kantor Penempatan **otomatis terdeteksi dari profil akun login** (`region_id` & `office_id`). Tidak ada dropdown manual yang perlu diisi pelapor.
   - Kartu read-only "Unit Kerja Anda" menampilkan nama wilayah dan kantor secara otomatis.
   - Penentuan otomatis unit penugasan UPT teknis berdasarkan kategori layanan yang dipilih.
   - **Live Ticket Preview Card**: Kartu simulasi real-time di sisi kanan formulir yang memperlihatkan tampilan tiket sebelum dikirimkan.
   - **Client-Side Canvas Image Compression**: Mengompresi foto bukti fisik resolusi tinggi langsung di peramban hingga 85% lebih kecil (~200KB) dengan preservasi rasio aspek (maks. 1600px, quality: 0.82, output: base64 data URL).
   - Pengembalian nomor tiket resmi (`#TICK-YYYYMMDD-XXXX`).
2. **Pelacak Tiket Mandiri (`/track`)**:
   - **Stepper Timeline 4 Tahap Visual**: Laporan Masuk (`open`) -> Triase Helpdesk (`open`) -> Pengerjaan UPT (`in_progress` / `waiting`) -> Selesai (`closed`).
   - Galeri foto Lightbox layar penuh dengan fungsi zoom dan salin tautan.
   - Percakapan dua arah antara staf pelapor dan petugas penanganan.
3. **Portal Tiket Saya (`/my-tickets`)**:
   - Khusus pengguna terautentikasi: daftar riwayat tiket kantor cabang dengan filter tab status, counter badge, dan pencarian cepat.
   - **Floating Chat Badge & Notification Bell**: Indikator balasan baru dengan alert suara sintetis (*Web Audio API*).

### 4.2 Modul Registrasi Dinas & Antrean Persetujuan (`/register`, `/admin/approvals`)
1. **Form Registrasi Dinas (`/register`)**:
   - Input identitas resmi: Nama Lengkap, Email Kedinasan, NIP, Nomor Telepon/WhatsApp, Jabatan, Pilihan Regional, dan Kantor Cabang Penempatan.
   - Akun baru otomatis disimpan dengan:
     - `role = 'UPT_LUAR'`
     - `account_status = 'PENDING'`
     - `data_scope = 'OFFICE'`
   - Entri baru dicatat di tabel `registration_approvals`.
2. **Workstation Persetujuan Registrasi (`/admin/approvals`)**:
   - Hanya dapat diakses oleh pengguna dengan hak `approval.view` / `approval.manage` (khusus Admin Pusat).
   - Menampilkan daftar permohonan berstatus `PENDING` dengan badge counter belum diproses di sidebar.
   - Aksi **Setujui (`Approve`)**: Mengubah status akun menjadi `ACTIVE`, memperbarui data scope/kantor jika diperlukan, dan mencatat log audit.
   - Aksi **Tolak (`Reject`)**: Mengubah status akun menjadi `REJECTED`, menyimpan alasan penolakan, dan mencatat log audit.

### 4.3 Workstation Operator & Helpdesk Pusat (`/dashboard`)
Workstation utama dengan 8 sub-tampilan (*Views*) yang dikontrol oleh otorisasi permission:
1. **Semua Tiket (`tickets`)**:
   - Papan Triase Kanban 3-kolom aktif (`Open`, `In Progress`, `Menunggu`) dan mode Tabel Terstruktur.
   - Filter cepat kategori, pencarian subjek/ID tiket, dan tombol refresh sinkronisasi.
2. **Arsip Tiket Selesai (`archive`)**:
   - Khusus tiket yang telah tuntas ditangani (`status = 'closed'`).
   - Pencarian instan berdasarkan nomor ID tiket dengan indikator jumlah hasil pencarian real-time.
3. **Lacak Tiket (`track`)**:
   - Pencari dan pemeriksa status tiket langsung di dalam antarmuka workstation staf.
4. **Monitoring Tiket & SLA (`reports`)**:
   - Metrik statistik volume tiket, kepatuhan batas waktu SLA, dan pembagian tiket per UPT unit kerja.
5. **Persetujuan Registrasi (`approvals`)**:
   - Antrean persetujuan pendaftar baru dinas PT Pos Indonesia.
6. **Manajemen Staf & Hak Akses (`users`)**:
   - Katalog pengguna sistem, filter per kantor/regional, pembuatan staf baru, tombol pembekuan (*suspend*), pengaktifan (*activate*), tombol **Reset MFA**, dan tombol **Kelola Hak Akses**.
   - **Laci Matriks Hak Akses Granular (`ManageAccessDrawer`)**:
     - Menampilkan seluruh permission terbagi per modul (Dashboard, Tiket, Monitoring & SLA, User & Akses, Sistem & Audit).
     - Pilihan status per izin: `INHERIT` (mengikuti default role), `ALLOW` (izinkan spesifik), `DENY` (larang spesifik).
7. **Log Audit Keamanan Forensik (`audit_log`)**:
   - Jejak rekam seluruh aktivitas sistem: aktor, peran, jenis aksi (*AUTH_LOGIN, USER_APPROVAL, PERMISSION_OVERRIDE, TICKET_STATUS_CHANGE, dll.*), target entitas, waktu, dan modal inspeksi detail JSON.
8. **Basis Data Aiven (`datasource`)**:
   - Pemantau kesehatan kluster Aiven for MySQL: latensi koneksi (ping), status SSL Mode: REQUIRED, jumlah baris tabel basis data, dan panduan environment Vercel.

### 4.4 Penegakan Aturan Resolusi Tiket (*Strict Status & Closure Enforcement*)
- **Frontend Enforcement**:
  - Pada `SageTicketDrawer.tsx` dan `OsTicketDetailView.tsx`, tombol perubahan status dan penutupan tiket disembunyikan jika pengguna memiliki role `UPT_LUAR` atau tidak memiliki permission `ticket.change_status` / `ticket.close`.
- **Backend API Enforcement**:
  - Endpoint `PATCH /api/tickets/:id/status` diproteksi middleware `requirePermission(['ticket.change_status', 'ticket.resolve', 'ticket.close'])`.
  - Jika akun ber-role `UPT_LUAR` mencoba mengirim permintaan HTTP PATCH untuk mengubah status tiket atau menutup tiket, API mengembalikan HTTP 403 Forbidden: *"Akses Ditolak: Staf UPT Luar tidak memiliki wewenang menutup tiket atau mengubah status tiket. Wewenang ini dikhususkan untuk Petugas UPT dan Admin Pusat."*

### 4.5 Multi-Factor Authentication (MFA / 2FA TOTP) & Admin Reset Flow
1. **Penyusunan MFA Mandiri**:
   - Pengguna mengaktifkan MFA melalui form pengaturan profil.
   - Sistem menghasilkan secret TOTP unik, QR-code, dan 5 kode darurat sekali pakai (*recovery backup codes*).
2. **Verifikasi Saat Login**:
   - Pengguna yang mengaktifkan MFA memasukkan email & password terlebih dahulu.
   - Sistem merespons dengan tantangan OTP (`mfa_required: true`).
   - Pengguna memasukkan 6 digit kode dari aplikasi authenticator atau kode backup.
3. **Reset MFA oleh Administrator**:
   - Jika staf kehilangan perangkat atau authenticator, Admin dapat menekan tombol **Reset MFA** di tabel Manajemen Staf (`POST /api/admin/users/:id/reset-mfa`).
   - Secret TOTP dikosongkan dan status MFA dinonaktifkan, sehingga staf dapat masuk kembali dan melakukan konfigurasi ulang.

### 4.6 Telegram Bot Gateway (Notifikasi Real-Time Helpdesk)
1. **Latar Belakang & Tujuan**:
   - Menghubungkan sistem tiket PRISMA POS secara langsung ke grup/saluran komunikasi Telegram tim helpdesk UPT dan manajemen operasional PT Pos Indonesia.
   - Menjamin tanggap insiden (MTTR) cepat untuk kendala operasional cabang berkategori kritis tanpa ketergantungan pada pengecekan berkala antarmuka web.
2. **Siklus Notifikasi & Pemicu (*Event Triggers*)**:
   - **Tiket Baru Terbit (`sendTicketCreatedAlert`)**: Mengirim rincian tiket meliputi Nomor Tiket, Badge Prioritas (🚨 URGENT, ⚠️ TINGGI, 🟡 SEDANG, 🟢 RENDAH), Unit Kerja Pelapor, Kategori Masalah, Judul, dan Ringkasan Kendala.
   - **Pembaruan Status Tiket (`sendTicketStatusAlert`)**: Mengirim pemberitahuan saat status tiket berpindah (`Open` ➔ `In Progress` ➔ `Waiting` ➔ `Closed`) lengkap dengan nama petugas penindak dan catatan penyelesaian.
   - **Permohonan Buka Kembali Tiket (`sendReopenRequestedAlert`)**: Notifikasi darurat saat staf kantor cabang meminta tiket yang sudah ditutup untuk dibuka kembali karena kendala belum tuntas atau berulang.
   - **Balasan Percakapan Tiket (`sendTicketReplyAlert`)**: Notifikasi respons obrolan baru di dalam thread tiket (membedakan pengirim staf cabang vs petugas helpdesk UPT).
   - **Pesan Uji Coba Diagnostik (`sendTestMessage`)**: Fitur uji konektivitas instan dari panel admin untuk memvalidasi token bot dan Chat ID grup.
3. **Panel Kontrol Admin Terpadu (`DataSourceConfig.tsx`)**:
   - Kartu panel **Telegram Bot Gateway** di dalam tab **Basis Data & Integrasi**.
   - Menampilkan status koneksi real-time, informasi bot resmi (`PRISMAPOS` / `@PriposBot`), masked token (`7123***:AAFx***`), Chat ID grup terdaftar, dan instruksi setup.
   - Tombol interaktif **"Kirim Pesan Uji Coba (Test Ping)"** untuk validasi komunikasi bot.
4. **URL Sanitizer & Keamanan**:
   - Telegram Bot API menolak tautan bertipe `localhost` / non-publik pada tombol inline keyboard dengan galat HTTP 400.
   - Sistem dilengkapi mekanisme `sanitizeReplyMarkup` yang otomatis memfilter URL lokal saat pengujian lokal agar pesan teks tetap terkirim sukses ke grup.
   - Saklar `TELEGRAM_NOTIF_ENABLED` memungkinkan penonaktifan notifikasi instan tanpa mengubah kredensial bot.

---

## 5. Spesifikasi Skema Basis Data Relasional Aiven MySQL (`defaultdb`)

### 5.1 Tabel `regions` (Wilayah Regional PT Pos Indonesia)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `region_id` | `VARCHAR(50)` | **Primary Key** (`REG-PUSAT`, `REG-01` s/d `REG-06`) |
| `name` | `VARCHAR(100)` | Nama wilayah regional (cth: *Regional 3 Jabar & Banten*) |
| `code` | `VARCHAR(20)` | **Unique Key** kode wilayah |
| `description` | `VARCHAR(255)` | Keterangan cakupan geografis |
| `created_at` | `DATETIME` | Waktu pembuatan data |

### 5.2 Tabel `offices` (Kantor Pos Cabang & Regional)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `office_id` | `VARCHAR(50)` | **Primary Key** (`OFC-PUSAT`, `OFC-KCU-BDG`, `OFC-KC-CMH`, dll.) |
| `region_id` | `VARCHAR(50)` | **Foreign Key** mereferensi `regions(region_id)` |
| `name` | `VARCHAR(150)` | Nama kantor pos operasional |
| `code` | `VARCHAR(20)` | Kode registrasi kantor |
| `type` | `ENUM('PUSAT', 'KCU', 'KC', 'KCP')` | Tipe unit kantor |
| `address` | `TEXT` | Alamat fisik kantor |
| `created_at` | `DATETIME` | Waktu pembuatan data |

### 5.3 Tabel `roles` (Definisi Peran Bisnis Sistem)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `role_code` | `VARCHAR(50)` | **Primary Key** (`ADMIN`, `PETUGAS_UPT`, `UPT_LUAR`) |
| `name` | `VARCHAR(100)` | Nama formal peran |
| `description` | `VARCHAR(255)` | Deskripsi peran & tanggung jawab |
| `default_scope` | `ENUM('GLOBAL', 'REGIONAL', 'OFFICE', 'OWN')` | Default cakupan data |
| `created_at` | `DATETIME` | Waktu pembuatan data |

### 5.4 Tabel `permissions` (Katalog Izin Granular Sistem)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `INT` | **Primary Key** AUTO_INCREMENT |
| `code` | `VARCHAR(100)` | **Unique Key** kode permission (cth: `ticket.close`, `user.approve`) |
| `name` | `VARCHAR(150)` | Nama deskriptif hak akses |
| `description` | `VARCHAR(255)` | Penjelasan fungsi hak akses |
| `module` | `VARCHAR(50)` | Modul sistem (`dashboard`, `ticket`, `monitoring`, `user`, `audit`) |
| `action` | `VARCHAR(50)` | Aksi operasi (`view`, `create`, `update`, `close`, `manage`, dll.) |
| `created_at` | `DATETIME` | Waktu pembuatan permission |

### 5.5 Tabel `role_permissions` (Baseline Izin Standar Peran)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `INT` | **Primary Key** AUTO_INCREMENT |
| `role_code` | `VARCHAR(50)` | **Foreign Key** mereferensi `roles(role_code)` |
| `permission_id` | `INT` | **Foreign Key** mereferensi `permissions(id)` |
| `effect` | `ENUM('ALLOW', 'DENY')` | Penetapan status izin baseline |
| `created_at` | `DATETIME` | Waktu konfigurasi |

### 5.6 Tabel `user_permissions` (Override Izin Khusus Pengguna)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `id` | `INT` | **Primary Key** AUTO_INCREMENT |
| `user_id` | `VARCHAR(50)` | **Foreign Key** mereferensi `users(user_id)` |
| `permission_id` | `INT` | **Foreign Key** mereferensi `permissions(id)` |
| `effect` | `ENUM('ALLOW', 'DENY')` | Status override izin (menimpa baseline role) |
| `granted_by` | `VARCHAR(50)` | ID administrator yang menetapkan |
| `created_at` | `DATETIME` | Waktu penetapan |
| `updated_at` | `DATETIME` | Waktu pembaruan |

### 5.7 Tabel `registration_approvals` (Antrean & Riwayat Persetujuan Staf)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `approval_id` | `VARCHAR(50)` | **Primary Key** (`APP-YYYYMMDD-XXXX`) |
| `user_id` | `VARCHAR(50)` | ID staf pendaftar baru |
| `status` | `ENUM('PENDING', 'APPROVED', 'REJECTED')` | Status proses persetujuan |
| `reviewed_by` | `VARCHAR(50)` | ID administrator pemeriksa |
| `reviewer_name` | `VARCHAR(150)` | Nama administrator pemeriksa |
| `rejection_reason` | `TEXT` | Catatan alasan penolakan (jika ditolak) |
| `reviewed_at` | `DATETIME` | Waktu proses persetujuan |
| `created_at` | `DATETIME` | Waktu pengajuan pendaftaran |

### 5.8 Tabel `users` (Data Pengguna, Kredensial & Autentikasi)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `user_id` | `VARCHAR(50)` | **Primary Key** (`USR-XXXXXX`) |
| `name` | `VARCHAR(150)` | Nama lengkap staf / pelapor |
| `email` | `VARCHAR(150)` | **Unique Key**, alamat email login |
| `password_hash` | `VARCHAR(255)` | Hash kata sandi aman (BCrypt rounds: 10) |
| `password_plain` | `VARCHAR(255)` | Kata sandi teks murni (untuk inspeksi akun demo) |
| `role` | `VARCHAR(50)` | Peran resmi: `ADMIN`, `PETUGAS_UPT`, `UPT_LUAR` |
| `account_status` | `ENUM('ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED')` | Status operasional akun |
| `data_scope` | `ENUM('GLOBAL', 'REGIONAL', 'OFFICE', 'OWN')` | Cakupan visibilitas data |
| `region_id` | `VARCHAR(50)` | Foreign key wilayah regional penempatan |
| `office_id` | `VARCHAR(50)` | Foreign key kantor cabang penempatan |
| `upt_unit` | `VARCHAR(100)` | Spesifikasi unit UPT teknis (khusus petugas UPT) |
| `position` | `VARCHAR(100)` | Jabatan pegawai dalam dinas |
| `nip` | `VARCHAR(50)` | Nomor Induk Pegawai PT Pos Indonesia |
| `department` | `VARCHAR(150)` | Divisi / Departemen kerja |
| `role_title` | `VARCHAR(150)` | Gelar peran dinas |
| `totp_secret` | `VARCHAR(255)` | Secret key untuk MFA / 2FA TOTP |
| `totp_enabled` | `TINYINT(1)` | Status aktif otentikasi dua faktor (0: mati, 1: aktif) |
| `totp_backup_codes` | `JSON` | Daftar kode darurat recovery TOTP |
| `is_active` | `TINYINT(1)` | Status keaktifan akun (1: aktif, 0: nonaktif) |
| `created_by` | `VARCHAR(50)` | Pembuat akun (`system_seed`, `self_register`, dll.) |
| `created_at` | `DATETIME` | Waktu pendaftaran akun |
| `updated_at` | `DATETIME` | Waktu pembaruan data terakhir |

### 5.9 Tabel `tickets` (Master Data Tiket Helpdesk)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `ticket_id` | `VARCHAR(50)` | **Primary Key** (`TICK-YYYYMMDD-XXXX`) |
| `subject` | `VARCHAR(255)` | Judul ringkasan kendala |
| `category` | `VARCHAR(100)` | Kategori layanan PT Pos Indonesia |
| `department` | `VARCHAR(150)` | Departemen terkait |
| `topic` | `VARCHAR(150)` | Topik spesifik laporan |
| `region_id` | `VARCHAR(50)` | Foreign Key wilayah regional asal tiket |
| `office_id` | `VARCHAR(50)` | Foreign Key kantor cabang asal tiket (untuk isolasi data) |
| `location` | `VARCHAR(150)` | Lokasi spesifik kejadian / aset dinas |
| `description` | `LONGTEXT` | Uraian lengkap kendala & lampiran foto base64 |
| `priority` | `ENUM('Low', 'Medium', 'High', 'Urgent')` | Tingkat urgensi laporan |
| `status` | `ENUM('open', 'in_progress', 'waiting', 'closed')` | Status proses penanganan |
| `channel` | `ENUM('web', 'email')` | Saluran asal tiket |
| `requester_name` | `VARCHAR(150)` | Nama lengkap staf pelapor |
| `requester_email` | `VARCHAR(150)` | Email staf pelapor |
| `requester_nip` | `VARCHAR(50)` | NIP staf pelapor |
| `requester_phone` | `VARCHAR(30)` | Nomor kontak staf pelapor |
| `assigned_upt` | `VARCHAR(100)` | Unit Pelaksana Teknis penerima penugasan |
| `assigned_operator` | `VARCHAR(150)` | Nama operator penanggung jawab triase |
| `created_by` | `VARCHAR(50)` | ID user pembuat tiket |
| `sla_due_at` | `DATETIME` | Batas waktu penyelesaian SLA |
| `closed_at` | `DATETIME` | Waktu penutupan resmi tiket |
| `is_archived` | `TINYINT(1)` | Indikator arsip (otomatis bernilai 1 saat status `closed`) |
| `attachments` | `JSON` | Metadata lampiran berkas |
| `created_at` | `DATETIME` | Waktu pembuatan tiket |
| `updated_at` | `DATETIME` | Waktu perubahan terakhir |

### 5.10 Tabel `threads` (Riwayat Diskusi & Catatan Staf)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `thread_id` | `VARCHAR(50)` | **Primary Key** (`THRD-YYYYMMDD-XXXX`) |
| `ticket_id` | `VARCHAR(50)` | **Foreign Key** mereferensi `tickets(ticket_id)` ON DELETE CASCADE |
| `sender_id` | `VARCHAR(50)` | ID pengguna pengirim pesan |
| `sender_name` | `VARCHAR(150)` | Nama pengguna pengirim pesan |
| `sender_role` | `VARCHAR(50)` | Peran pengirim: `ADMIN`, `PETUGAS_UPT`, `UPT_LUAR` |
| `message` | `LONGTEXT` | Isi pesan balasan / catatan internal |
| `visibility` | `ENUM('public', 'internal')` | Visibilitas (`public`: terlihat pelapor, `internal`: khusus staf) |
| `created_at` | `DATETIME` | Waktu pesan dikirimkan |

### 5.11 Tabel `audit_logs` (Jejak Rekam & Audit Forensik Sistem)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `log_id` | `VARCHAR(50)` | **Primary Key** (`LOG-YYYYMMDD-XXXX`) |
| `ticket_id` | `VARCHAR(50)` | ID tiket terkait (opsional jika event non-tiket) |
| `actor_id` | `VARCHAR(50)` | ID pengguna yang melakukan aksi |
| `actor_name` | `VARCHAR(150)` | Nama pengguna pelaku aksi |
| `actor_role` | `VARCHAR(50)` | Peran pengguna saat aksi terjadi |
| `action` | `VARCHAR(100)` | Tipe aktivitas (`AUTH_LOGIN`, `USER_APPROVAL`, `PERMISSION_OVERRIDE`, `TICKET_STATUS_CHANGE`, `MFA_RESET`, dll.) |
| `details` | `TEXT` | Informasi rincian perubahan data |
| `created_at` | `DATETIME` | Waktu pencatatan log permanen |

### 5.12 Tabel `system_config` (Konfigurasi Global Aplikasi)
| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `config_key` | `VARCHAR(100)` | **Primary Key** (`sla_matrix`, `feature_flags`, dll.) |
| `config_value` | `JSON` | Nilai konfigurasi dalam format JSON terstruktur |
| `description` | `VARCHAR(255)` | Penjelasan kegunaan konfigurasi |
| `updated_at` | `DATETIME` | Waktu pembaruan konfigurasi |

---

## 6. Katalog Endpoint RESTful API Backend

### 6.1 Sistem & Master Data Organisasi
- `GET /api/health`: Uji status kesehatan API & koneksi Aiven MySQL (mengembalikan latency ms).
- `GET /api/regions`: Mengambil katalog seluruh wilayah regional PT Pos Indonesia.
- `GET /api/offices?region_id=...`: Mengambil daftar kantor cabang per wilayah regional.
- `GET /api/roles`: Mengambil katalog 3 peran bisnis resmi dan cakupan datanya.

### 6.2 Otentikasi & Multi-Factor Authentication
- `POST /api/auth/login`: Autentikasi email dan kata sandi. Mengembalikan token JWT atau respons tantangan `mfa_required: true`.
- `POST /api/auth/mfa/verify`: Verifikasi kode OTP TOTP 6 digit untuk menuntaskan login.
- `POST /api/auth/mfa/resend`: Pengiriman ulang kode OTP darurat via email SMTP.
- `POST /api/auth/register`: Pendaftaran mandiri staf kedinasan (status otomatis `PENDING`).
- `GET /api/auth/me` *(Auth Required)*: Mengambil profil lengkap staf, peran, izin terdaftar, dan kantor penempatan.
- `POST /api/auth/mfa/setup` *(Auth Required)*: Menghasilkan secret TOTP dan QR Code konfigurasi.
- `POST /api/auth/mfa/confirm` *(Auth Required)*: Mengonfirmasi kode pertama kali untuk mengaktifkan MFA.

### 6.3 Pengelolaan Tiket & Percakapan
- `GET /api/tickets`: Mengambil daftar tiket. Menerapkan isolasi data otomatis:
  - Akun `UPT_LUAR` hanya menerima tiket yang memiliki `office_id` yang sama dengan akunnya.
  - Akun `ADMIN` dan `PETUGAS_UPT` menerima tiket seluruh Indonesia secara nasional.
- `POST /api/tickets`: Membuat tiket baru dengan penandaan otomatis `office_id` dan `region_id`.
- `GET /api/tickets/:id`: Mengambil detail lengkap tiket beserta riwayat thread percakapan.
- `GET /api/tickets/track/:id`: Endpoint publik untuk pelacakan tiket mandiri.
- `PATCH /api/tickets/:id/status` *(Auth & Permission Required)*:
  - Dilindungi middleware `requirePermission(['ticket.change_status', 'ticket.resolve', 'ticket.close'])`.
  - Mengubah status tiket (`open`, `in_progress`, `waiting`, `closed`).
  - **Akses diblokir untuk UPT_LUAR**.
- `POST /api/tickets/:id/threads`: Mengirim pesan balasan publik atau catatan internal privat (🔒).
- `POST /api/tickets/:id/reopen-request` *(Auth Required)*: Mengajukan permohonan buka kembali tiket yang telah berstatus `closed` disertai alasan kendala.
- `GET /api/tickets/:id/reopen-requests` *(Auth Required)*: Mengambil daftar riwayat permohonan buka kembali untuk tiket tertentu.
- `PATCH /api/tickets/reopen-requests/:id` *(Staff/Admin)*: Menyetujui atau menolak permohonan buka kembali tiket.

### 6.4 Persetujuan Registrasi Staf Dinas
- `GET /api/admin/approvals` *(Admin/Approver)*: Mengambil daftar permohonan pendaftaran berstatus `PENDING`.
- `POST /api/admin/approvals/:id/approve` *(Admin/Approver)*: Menyetujui pendaftaran staf, mengaktifkan akun, dan menugaskan peran serta kantor.
- `POST /api/admin/approvals/:id/reject` *(Admin/Approver)*: Menolak pendaftaran staf disertai pencatatan alasan penolakan.

### 6.5 Tata Kelola Pengguna & Hak Akses Granular
- `GET /api/admin/users` *(Admin)*: Mengambil seluruh daftar pengguna dinas dengan filter status dan kantor.
- `POST /api/admin/users` *(Admin)*: Menambahkan pengguna staf baru secara manual.
- `PATCH /api/admin/users/:id` *(Admin)*: Mengubah informasi profil, jabatan, dan peran staf.
- `DELETE /api/admin/users/:id` *(Super Admin)*: Menghapus akun pengguna dari sistem.
- `GET /api/admin/users/:id/permissions` *(Admin)*: Mengambil matriks izin gabungan (baseline role + user override) untuk pengguna tertentu.
- `PUT /api/admin/users/:id/permissions` *(Admin)*: Menyimpan perubahan izin override granular perorangan.
- `POST /api/admin/users/:id/suspend` *(Admin)*: Membekukan akun pengguna (*status: SUSPENDED*).
- `POST /api/admin/users/:id/activate` *(Admin)*: Mengaktifkan kembali akun pengguna (*status: ACTIVE*).
- `POST /api/admin/users/:id/reset-mfa` *(Admin)*: Menghapus konfigurasi MFA pengguna yang kehilangan authenticator.

### 6.6 Pemantauan, Audit Forensik & Kluster Database
- `GET /api/admin/audit-logs` *(Admin)*: Mengambil riwayat log audit forensik dengan pencarian dan filter tipe aksi.
- `GET /api/admin/features`: Mengambil status fitur dinamis aplikasi (*feature flags*).
- `PUT /api/admin/features` *(Admin)*: Memperbarui konfigurasi saklar fitur aplikasi.
- `GET /api/admin/db-status` *(Admin)*: Mengambil ringkasan kapasitas baris tabel dan kesehatan database Aiven.
- `GET /api/analytics` *(Staff)*: Mengambil data analitik dan metrik SLA sesuai dengan lingkup data staf.
- `GET /api/analytics/operator-productivity` *(Manager/Admin)*: Mengambil rekap produktivitas operator helpdesk berdasarkan aksi nyata penanganan tiket.

### 6.7 Telegram Bot Gateway & Notifikasi Eksternal
- `GET /api/admin/telegram/status` *(Admin)*: Mengambil status konfigurasi Telegram Bot Gateway (apakah token & chat ID terisi, bot info getMe, dan status aktif/nonaktif tanpa membocorkan token).
- `POST /api/admin/telegram/test` *(Admin)*: Mengirimkan pesan uji coba diagnostik (test ping) ke grup Telegram terdaftar untuk validasi konektivitas.

### 6.8 Konfigurasi Basis Data Dinamis & Migrasi Skema
- `GET /api/admin/db-config` *(Admin Only)*: Mengambil konfigurasi database aktif (dengan masking password) dan preset cepat (**Mode Online Aiven** vs **Mode Offline Localhost**).
- `POST /api/admin/db-config/test` *(Admin Only)*: Menguji koneksi sementara ke target host/port MySQL tanpa mengubah database aktif (mengembalikan latensi ms, versi MySQL, dan verifikasi 14 tabel sistem).
- `POST /api/admin/db-config/save` *(Admin Only)*: Memvalidasi target, mengalihkan pool koneksi aktif seketika (*hot-swap*), memperbarui file `.env`, dan mencatat log audit forensik `DATABASE_CONFIG_CHANGED`.
- `POST /api/admin/db-config/migrate` *(Admin Only)*: Menjalankan eksekusi migrasi DDL skema 14 tabel master dan seeding data pengguna dinas bawaan pada database yang sedang aktif.
