# CATATAN PERUBAHAN FITUR — POSO (PRISMA POS)

---

## 🚀 Versi 2.6.0 — Telegram Bot Gateway & Notifikasi Real-Time Helpdesk
**Tanggal Rilis**: 8 September 2026  
**Versi**: 2.6.0  
**Disiapkan oleh**: Tim Pengembang PRISMA POS

### Ringkasan Pembaruan v2.6.0
Pembaruan versi 2.6.0 menghadirkan **Telegram Bot Gateway**, sistem gateway notifikasi eksternal real-time yang menghubungkan sistem PRISMA POS dengan grup/channel Telegram tim helpdesk operasional PT Pos Indonesia. Fitur ini memastikan setiap insiden kritis dan aktivitas tiket tertangani secara tanggap tanpa harus terus-menerus memantau layar dashboard.

### Fitur Utama Telegram Bot Gateway:
1. **Notifikasi Multi-Event Real-Time**:
   - 🎫 **Tiket Baru Masuk**: Notifikasi instan mencakup Nomor Tiket, Badge Prioritas (🚨 URGENT, ⚠️ TINGGI, dll.), Unit Kerja Pelapor, Kategori, Subjek, dan Uraian Kendala.
   - 🔄 **Pembaruan Status Tiket**: Notifikasi otomatis saat tiket berpindah status (`Open` ➔ `In Progress` ➔ `Waiting` ➔ `Closed / Selesai`) disertai nama petugas penindak dan catatan penyelesaian.
   - 🔓 **Permohonan Buka Kembali Tiket (Reopen Request)**: Peringatan ke tim UPT saat staf cabang mengajukan permohonan buka kembali tiket yang telah ditutup beserta alasan kendala berulang.
   - 💬 **Balasan Pesan Baru**: Notifikasi setiap ada respons obrolan baru di dalam thread tiket (membedakan pelapor cabang vs petugas UPT).
   - 🚀 **Pesan Uji Koneksi Diagnostik (Test Ping)**: Pengujian konektivitas bot langsung dari panel admin.

2. **Panel Kontrol Admin Terpadu (`DataSourceConfig.tsx`)**:
   - Kartu panel khusus **Telegram Bot Gateway** di tab **Basis Data & Integrasi**.
   - Indikator status koneksi real-time (**Aktif & Terhubung** / **Belum Dikonfigurasi** / **Dinonaktifkan**).
   - Info Bot Telegram resmi: nama bot (`PRISMAPOS`), username (`@PriposBot`), ID bot, dan Chat ID target dengan masking token aman (`7123***:AAFx***`).
   - Panduan setup langkah-demi-langkah (BotFather, Chat ID, format `.env`).
   - Tombol interaktif **"Kirim Pesan Uji Coba (Test Ping)"** dengan feedback visual seketika.

3. **Arsitektur Tanpa Dependensi Berat & Sanitasi URL**:
   - Menggunakan native `fetch` ke Telegram Bot API resmi (`https://api.telegram.org/bot<TOKEN>/sendMessage`).
   - Fitur **URL Sanitizer** untuk tombol inline keyboard: Telegram menolak URL `localhost` / non-publik pada tombol inline. Gateway otomatis menyaring tautan lokal saat mode pengujian lokal agar pesan tetap terkirim sukses tanpa error `400 Bad Request`.
   - Toggle switch `TELEGRAM_NOTIF_ENABLED` untuk mematikan/menyalakan notifikasi tanpa menghapus kredensial token.

### File yang Dibuat & Dimodifikasi (v2.6.0)
| File | Status | Keterangan Perubahan |
|---|---|---|
| `server/utils/telegram.js` | **BARU** | Layanan lengkap Telegram Bot Gateway: 7 fungsi alert terformat HTML, verifikasi bot, sanitasi inline URL, dan pengujian koneksi. |
| `server/controllers/ticketController.js` | Dimodifikasi | Integrasi trigger alert di 5 siklus tiket (`createTicket`, `updateTicketStatus`, `addThreadMessage`, `requestTicketReopen`, `reviewTicketReopen`). |
| `server/controllers/analyticsController.js` | Dimodifikasi | Endpoint `getTelegramStatus` dan `testTelegramNotification` untuk monitoring status bot dan test ping. |
| `server/routes/api.js` | Dimodifikasi | Rute baru `GET /api/admin/telegram/status` dan `POST /api/admin/telegram/test`. |
| `src/services/api.ts` | Dimodifikasi | Penambahan method API client `getTelegramStatus()` dan `testTelegramNotification()`. |
| `src/components/admin/DataSourceConfig.tsx` | Dimodifikasi | Panel UI Telegram Bot Gateway dengan status badge, bot profile info, petunjuk integrasi, dan tombol test ping. |
| `.env` & `.env.example` | Dimodifikasi | Penambahan variabel `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_NOTIF_ENABLED`, dan `APP_BASE_URL`. |

---

## 📦 Versi 2.5.0 — MFA OTP Email, Produktivitas Operator, Otomasi Regional & Reopen
**Tanggal Rilis**: 7 September 2026  
**Versi**: 2.5.0  
**Disiapkan oleh**: Tim Pengembang PRISMA POS

### Ringkasan Perubahan v2.5.0
Pembaruan ini mencakup **4 peningkatan fitur utama** pada sistem POSO, meliputi keamanan login, transparansi produktivitas operator, otomatisasi data wilayah, dan mekanisme buka kembali tiket yang sudah ditutup.

---

## 1. Multi-Factor Authentication (MFA) pada Login

### Deskripsi
Setelah username dan password berhasil diverifikasi, sistem akan mengirimkan kode OTP 6 digit ke email terdaftar pengguna. Pengguna harus memasukkan kode ini sebelum dapat mengakses dashboard.

### Alur Kerja
1. Pengguna memasukkan email & password → verifikasi sukses.
2. Server membuat MFA challenge dan mengirim OTP via email.
3. Pengguna memasukkan kode OTP di halaman verifikasi MFA.
4. Jika kode valid → pengguna masuk ke dashboard.
5. Jika kode salah / expired → pengguna diminta coba lagi.

### File yang Dimodifikasi
| File | Perubahan |
|------|-----------|
| `server/controllers/authController.js` | Menambah logika generate & kirim OTP setelah verifikasi password; endpoint `verifyMfa` memvalidasi kode |
| `server/database/migrate.js` | Tabel `mfa_challenges` dengan kolom `otp_code` |
| `src/pages/auth/Login.tsx` | Halaman MFA step dengan input OTP, timer countdown, badge fallback testing |

### Catatan Kode OTP & Pengujian
- **OTP Simulasi**: Dihilangkan dari antarmuka login demi standar keamanan dan privasi.
- **Kode Darurat**: Hanya muncul otomatis di layar jika layanan SMTP email belum dikonfigurasi di `.env` (kode darurat: **`123456`**).
- **Jika SMTP Aktif**: Kode OTP hanya dikirimkan ke kotak masuk email/spam pengguna, tidak ada kode yang dibocorkan di UI.
- Akun demo: `admin@poso.local` / `Admin123`

---

## 2. Rekap Aktivitas Operator per Akun Atasan

### Deskripsi
Fitur baru yang menampilkan tabel produktivitas setiap operator: jumlah tiket ditangani, total aksi, tiket diselesaikan, dan waktu aktif terakhir. Hanya dapat diakses oleh akun Manager / Atasan.

### Kriteria Penghitungan Tiket Ditangani
Tiket dihitung **berdasarkan tindakan nyata** yang dicatat di `audit_logs` dan `threads`:
- `STATUS_CHANGE`, `RESOLVE_TICKET`, `CLOSE_TICKET`, `CLAIM_TICKET`, `ASSIGN_TICKET`
- Pesan yang dikirim operator di thread diskusi

> **Hanya melihat tiket TIDAK dihitung** sebagai menangani tiket.

### Akses
- Hanya akun dengan permission `operator.stats_view` atau role `ADMIN`
- Operator biasa tidak dapat mengakses halaman ini

### File yang Dimodifikasi
| File | Perubahan |
|------|-----------|
| `server/controllers/analyticsController.js` | Endpoint `GET /api/analytics/operator-productivity` |
| `server/routes/api.js` | Route baru `/analytics/operator-productivity` |
| `server/database/migrate.js` | Permission `operator.stats_view` ditambahkan |
| `src/services/api.ts` | Fungsi `getOperatorProductivity()` |
| `src/types/index.ts` | Interface `OperatorProductivityItem` |
| `src/components/operator/OperatorProductivityTable.tsx` | Komponen tabel lengkap: KPI cards, ranking, pencarian, export CSV |
| `src/pages/operator/OperatorDashboard.tsx` | Integrasi `OperatorProductivityTable` di tab laporan |

---

## 3. Otomasi Data Regional & Kantor pada Tiket & Login

### Deskripsi
Data "Wilayah Regional Pos" dan "Kantor Cabang / Kantor Pos" tidak lagi perlu diisi manual oleh pelapor saat membuat tiket. Sistem otomatis mengambil data dari profil akun yang sedang login.

### Perubahan pada Form Buat Tiket
- **Sebelumnya**: Pelapor memilih dropdown Wilayah dan Kantor saat mengisi formulir.
- **Sesudahnya**: Sistem menampilkan kartu read-only "Unit Kerja Anda" yang menunjukkan data wilayah & kantor dari akun login. Pelapor tidak dapat mengubahnya.

### Perubahan pada Form Login
- Form login hanya meminta **Email** dan **Password** saja.
- Tidak ada dropdown pemilihan unit kerja saat login.

### File yang Dimodifikasi
| File | Perubahan |
|------|-----------|
| `server/controllers/ticketController.js` | `createTicket` mengambil `region_id` dan `office_id` dari `user` (prioritas), bukan dari payload request |
| `src/pages/public/PublicTicketForm.tsx` | Hapus dropdown manual; tambah kartu informasi unit kerja read-only |

---

## 4. Kunci Chat Tiket Tutup & Mekanisme Buka Kembali

### Deskripsi
Setelah tiket berstatus **Ditutup (Closed)**, pelapor tidak dapat lagi mengirim pesan di kolom percakapan. Pelapor dapat mengajukan permohonan buka kembali tiket disertai alasan. Operator UPT kemudian meninjau dan memutuskan.

### Alur Kerja
```
[Tiket Ditutup]
     |
     └→ Pelapor klik "Ajukan Buka Kembali"
            |
            └→ Isi alasan & kirim
                   |
                   └→ Tiket: reopen_status = 'PENDING'
                          |
                ┌─────────┴─────────┐
           [Setujui]           [Tolak]
                |                   |
        Tiket dibuka kembali    reopen_status = 'REJECTED'
        reopen_status = 'APPROVED'  Chat tetap terkunci
        Chat pelapor aktif kembali
```

### Status `reopen_status`
| Nilai | Keterangan |
|-------|-----------|
| `NONE` | Tidak ada permintaan buka kembali |
| `PENDING` | Menunggu keputusan operator |
| `APPROVED` | Disetujui, tiket dibuka kembali |
| `REJECTED` | Ditolak, tiket tetap tertutup |

### File yang Dimodifikasi
| File | Perubahan |
|------|-----------|
| `server/database/migrate.js` | Tabel `ticket_reopen_requests`; kolom `reopen_status` di tabel `tickets` |
| `server/controllers/ticketController.js` | `addThreadMessage` blokir jika closed; `requestTicketReopen`, `reviewTicketReopen`, `getTicketReopenRequests` |
| `server/routes/api.js` | Routes: `/tickets/:id/request-reopen`, `/tickets/:id/reopen-review`, `/tickets/:id/reopen-requests` |
| `src/types/index.ts` | `reopen_status` di `Ticket`; interface `TicketReopenRequest` |
| `src/services/api.ts` | `requestTicketReopen()`, `reviewTicketReopen()`, `getTicketReopenRequests()` |
| `src/pages/public/PublicTicketTracker.tsx` | Tampilan kunci chat + banner status + modal ajukan buka kembali |
| `src/components/operator/SageTicketDrawer.tsx` | Banner review buka kembali dengan tombol Setujui / Tolak untuk operator |

---

## 5. Konfigurasi Database Aiven MySQL & SSL (`ca.pem`)

### Deskripsi
Integrasi koneksi database cloud Aiven for MySQL dengan keamanan transport layer berbasis sertifikat SSL kustom (`ca.pem`).

### Detail Konfigurasi
1. **Dukungan Sertifikat CA**: [server/config/db.js](file:///c:/Users/user/Documents/PRISMA-POS/server/config/db.js) membaca berkas `ca.pem` di root direktori atau berdasarkan variabel `DB_SSL_CA`.
2. **Kredensial Aiven**:
   - Host: `mysql-1810b125-nugrahaeldi123-5f2b.f.aivencloud.com`
   - Port: `21970`
   - User: `avnadmin`
   - Database: `defaultdb`
   - SSL: Aktif (`REQUIRED`)
3. **Database Migration**: Berhasil dieksekusi 100% via `npm run migrate` untuk seluruh tabel dan relasi keamanan.

---

## Panduan Verifikasi Manual

### MFA Login
1. Login dengan akun valid → halaman MFA muncul.
2. Cek email OTP dikirim **atau** gunakan kode fallback `123456`.
3. Masukkan kode → berhasil masuk ke dashboard.

### Rekap Produktivitas Operator
1. Login sebagai Manager/Admin.
2. Buka **Dashboard Operator → Laporan**.
3. Tabel produktivitas operator muncul dengan KPI cards.
4. Klik **Export CSV** untuk mengunduh data.

### Otomasi Data Regional
1. Login sebagai pengguna dengan `region_id` dan `office_id` yang sudah terisi.
2. Buka form **Buat Tiket Baru**.
3. Kartu "Unit Kerja Anda" tampil dengan data otomatis (tidak ada dropdown).

### Kunci Chat Tiket Tutup + Buka Kembali
1. Buka tiket yang berstatus **Closed** sebagai pelapor.
2. Kolom reply tidak ada → muncul banner "Tiket Ini Telah Ditutup".
3. Klik **Ajukan Buka Kembali** → isi alasan → kirim.
4. Banner berganti menjadi "Sedang Diproses".
5. Login sebagai Operator → buka tiket tersebut di SageTicketDrawer.
6. Banner kuning "Permintaan Buka Kembali" muncul dengan tombol **Setujui** dan **Tolak**.
7. Klik Setujui → tiket kembali aktif, chat pelapor terbuka.

---

## Daftar File yang Dimodifikasi (Lengkap)

### Backend & Konfigurasi
- `server/config/db.js` *(dukungan SSL ca.pem)*
- `server/controllers/authController.js`
- `server/controllers/analyticsController.js`
- `server/controllers/ticketController.js`
- `server/routes/api.js`
- `server/database/migrate.js`
- `.env` *(kredensial Aiven MySQL & SMTP)*

### Frontend
- `src/pages/auth/Login.tsx`
- `src/pages/public/PublicTicketForm.tsx`
- `src/pages/public/PublicTicketTracker.tsx`
- `src/pages/operator/OperatorDashboard.tsx`
- `src/components/operator/OperatorProductivityTable.tsx` *(baru)*
- `src/components/operator/SageTicketDrawer.tsx`
- `src/services/api.ts`
- `src/types/index.ts`

### Dokumentasi
- `POSO_PRD.md` *(diperbarui ke v2.5.0)*
- `README.md` *(diperbarui ke v2.5.0)*
- `CATATAN_PERUBAHAN_FITUR.md` *(baru)*

---

*Dokumen ini dibuat oleh tim pengembang PRISMA POS.*
