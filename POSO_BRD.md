# Business Requirements Document (BRD)
## Aplikasi: PRISMA POS — Pos Resolution & Integrated Service Management Application (v3.2)
### Sistem Helpdesk & Manajemen Tiket Terpadu PT Pos Indonesia (Persero)

**Versi:** 3.2 (Enterprise Security, 3 Official Roles, Office Scope Isolation, & Governance Release)  
**Status:** Implemented & Production Ready  
**Tipe Dokumen:** Business Requirements Document (BRD)  
**Target Pengguna:** Seluruh Satuan Kerja PT Pos Indonesia (Persero) — Kantor Pusat, Regional, KCU, KC, KCP, dan Unit Pelaksana Teknis  

---

## 1. Latar Belakang (Background)

Sebagai salah satu Badan Usaha Milik Negara (BUMN) logistik dan kurir terbesar di Indonesia, **PT Pos Indonesia (Persero)** mengelola jaringan operasional yang sangat luas, mencakup Kantor Pusat Pengendalian Operasi, 6 Kantor Regional (REG-01 s/d REG-06), Kantor Pos Utama (KCU), Kantor Cabang (KC), Kantor Cabang Pembantu (KCP), Sentral Pengolahan Pos (SPP), hingga agen pos di seluruh pelosok nusantara.

Sebelum adanya sistem terpadu berstandar korporat, penanganan keluhan operasional, gangguan sistem core pos, kerusakan sarana prasarana gedung/armada, serta deviasi mutu layanan sering kali tersebar di berbagai saluran tidak resmi (grup percakapan instan, email sporadis, atau komunikasi lisan). Kondisi ini memicu berbagai masalah bisnis yang signifikan:
1. **Ketidakpastian Status & Hilangnya Jejak Laporan**: Keluhan operasional tidak terdokumentasi dalam satu repositori terpusat dan rawan tercecer tanpa kepastian penanggung jawab.
2. **Ketiadaan Isolasi Data Antarkantor Cabang**: Staf di satu kantor cabang dapat melihat data internal atau kendala operasional kantor cabang lain, yang berpotensi melanggar privasi dan kerahasiaan operasional regional.
3. **Penyalahgunaan Penutupan Tiket (*Premature Closure*)**: Pada sistem lama yang tidak memiliki kontrol peran ketat, staf pelapor di daerah kerap mengubah status atau menutup tiket secara sepihak sebelum perbaikan fisik/teknis benar-benar tuntas diverifikasi oleh tim teknis pusat, sehingga merusak validitas audit SLA.
4. **Pendaftaran Akun Liar Tanpa Verifikasi Dinas**: Tidak adanya proses kurasi pendaftaran mengakibatkan siapa pun dapat mendaftarkan akun tanpa verifikasi identitas pegawai (NIP) dan kantor dinas penempatan.
5. **Ketiadaan Audit Forensik & Otentikasi Berlapis**: Setiap perubahan status atau eskalasi izin tidak tercatat jejak log forensiknya, serta sistem rentan terhadap kompromi kredensial karena ketiadaan Multi-Factor Authentication (MFA).
6. **Beban Bandwidth & Limit API Pihak Ketiga**: Pengunggahan foto bukti kerusakan kamera resolusi tinggi sering kali gagal akibat bandwidth rendah di daerah, serta rentan *rate-limit* jika bergantung pada layanan Google Drive API pihak ketiga.

Untuk menjawab kebutuhan tata kelola operasional skala nasional tersebut, dikembangkan **PRISMA POS** (*Pos Resolution & Integrated Service Management Application* — kode rilis **POSO v3.2**) sebagai sistem helpdesk korporat terpadu berkinerja tinggi yang menghubungkan seluruh unit kerja PT Pos Indonesia dalam arsitektur berbasis cloud yang aman, berintegritas tinggi, dan **100% responsif di perangkat ponsel, tablet, maupun komputer desktop**.

---

## 2. Tujuan Proyek (Business Objectives)

1. **Satu Pintu Layanan Terpadu (*Single Point of Contact / SPOC*)**:
   Menyediakan portal helpdesk dinas resmi berstandar nasional yang dapat diakses oleh seluruh staf operasional kantor cabang, regional, dan kantor pusat dari perangkat mana pun.
2. **Standardisasi 3 Peran Bisnis Utama (*Role Standardization*)**:
   Mengonsolidasikan seluruh hak operasional ke dalam 3 Peran Bisnis Resmi:
   - **ADMIN**: Super Administrator yang memegang kendali penuh atas sistem, manajemen pengguna, persetujuan registrasi, matriks izin granular, audit log, dan konektivitas basis data.
   - **PETUGAS_UPT**: Petugas Helpdesk & Triase di Kantor Pusat yang memverifikasi, mendistribusikan, memproses, mengubah status, serta menuntaskan (*resolve/close*) tiket secara nasional.
   - **UPT_LUAR**: Staf pelapor di Unit Kantor Cabang atau Regional yang mengajukan tiket kendala, memantau perkembangan, dan berkomunikasi dua arah.
3. **Penegakan Aturan Resolusi Tiket (*Strict Ticket Resolution Rule*)**:
   Menegakkan aturan bisnis mutlak bahwa **staf UPT_LUAR sama sekali TIDAK BISA menutup tiket atau mengubah status tiket**. Seluruh kewenangan pengubahan status (`open` -> `in_progress` -> `waiting` -> `closed`) dan penutupan tiket dipusatkan secara eksklusif pada **ADMIN** dan **PETUGAS_UPT** di Kantor Pusat guna menjamin kepatuhan SLA.
4. **Isolasi Data Tingkat Kantor (*Office-Level Data Isolation*)**:
   Menerapkan *Data Scoping* berbasis unit kantor (`OFFICE scope`). Tiket yang diajukan oleh staf di suatu Kantor Cabang (misalnya KCU Bandung) hanya dapat dilihat dan direspons oleh rekan satu kantornya, serta oleh Admin & Petugas UPT Pusat. Staf di kantor cabang lain (misalnya KC Cimahi atau KCU Surabaya) sama sekali tidak dapat melihat tiket tersebut.
5. **Tata Kelola Registrasi Dinas & Alur Persetujuan (*Registration Approval Workflow*)**:
   Mewajibkan setiap staf pendaftar baru melalui alur verifikasi resmi. Akun baru berstatus `PENDING` dan hanya dapat login setelah disetujui (`APPROVED`) oleh Admin Pusat melalui panel *Persetujuan Registrasi*.
6. **Matriks Hak Akses Granular (*Granular Access Control Matrix*)**:
   Menyediakan kemampuan konfigurasi izin individual (*User-Specific Override*) untuk mengizinkan (`ALLOW`) atau menolak (`DENY`) 25+ aksi spesifik pada modul sistem di luar baseline peran standar.
7. **Keamanan & Kepatuhan Audit Forensik**:
   Menerapkan Multi-Factor Authentication (MFA / 2FA TOTP) dengan kapabilitas reset instan oleh admin, pencatatan otomatis jejak audit forensik (`audit_logs`) pada setiap aksi krusial, dan enkripsi koneksi database TLS 1.3 / SSL Mode: REQUIRED.
8. **Pemisahan Papan Kerja Aktif & Arsip Tiket Mandiri**:
   Menyediakan Papan Triase Kanban 3-kolom aktif (`Open`, `In Progress`, `Menunggu`) dan secara otomatis memindahkan tiket yang telah selesai ke modul **Arsip Tiket Selesai** berkecepatan tinggi dengan pencarian instan nomor ID tiket.

---

## 3. Manfaat Bisnis (Business Value)

| Aspek Bisnis | Kondisi Sebelum Sistem PRISMA POS | Manfaat Nyata PRISMA POS (v3.2) |
|---|---|---|
| **Pencatatan Keluhan** | Tersebar di WhatsApp grup dan email pribadi | 100% keluhan terdata dengan ID resmi unik (`#TICK-YYYYMMDD-XXXX`) dan terikat pada unit kantor asal. |
| **Wewenang Penutupan Tiket** | Tiket kerap ditutup sepihak oleh pelapor | **Aturan Ketat**: Staf UPT_LUAR dilarang menutup/mengubah status tiket. Hanya Petugas UPT & Admin Pusat yang berwenang menutup tiket. |
| **Kerahasiaan Data Antarkantor** | Seluruh unit bisa saling melihat tiket unit lain | **Isolasi Office Scope**: Staf cabang hanya melihat tiket kantornya sendiri, mencegah kebocoran data antarcabang. |
| **Tata Kelola Akun Pegawai** | Pendaftaran bebas tanpa verifikasi | **Alur Persetujuan Dinas**: Registrasi berstatus `PENDING` dan wajib disetujui Admin Pusat sebelum aktif. |
| **Fleksibilitas Hak Akses** | Hak akses kaku berbasis peran tunggal | **Matriks Granular**: Admin dapat meng-override izin spesifik staf (25+ granular permissions) per modul. |
| **Kepatuhan Audit & Forensik** | Tidak ada catatan siapa mengubah apa | **Log Audit Forensik**: Seluruh aktivitas login, persetujuan, eskalasi tiket, dan perubahan izin terekam permanen. |
| **Keamanan Otentikasi** | Hanya username dan password biasa | **MFA / 2FA TOTP**: Verifikasi kode dinamis berbasis waktu + fitur Reset MFA terpusat oleh Admin. |
| **Kecepatan Triase Kerja** | Papan kerja menumpuk dengan tiket usang | Papan Kanban bersih berfokus pada 3 status aktif, tiket selesai otomatis pindah ke modul Arsip mandiri. |
| **Keandalan Basis Data** | Berisiko corrupt pada spreadsheet lokal | Basis data cloud **Aiven for MySQL** (SSL Mode: REQUIRED) dengan ACID transaction dan connection pooling. |
| **Pengunggahan Bukti Foto** | Sering gagal upload pada koneksi lambat | Auto-kompresi gambar di peramban hingga 85% lebih ringan (~200KB) sebelum dikirimkan ke server. |

---

## 4. Ruang Lingkup Sistem (Scope of System)

### 4.1 Fitur yang Telah Terimplementasi Penuh (In-Scope)

1. **Portal Dinas & Pelaporan Mandiri**:
   - Formulir pembuatan tiket dinas (`/submit` / `/buat-tiket`) dengan pemetaan otomatis unit kantor, bidang, topik masalah, dan kartu pratinjau langsung (*Live Ticket Preview*).
   - Zona unggah bukti kendala *Drag & Drop* dengan kompresi cerdas di sisi peramban (*Client-side Canvas Image Compression*).
   - Pelacak status tiket mandiri (`/track` / `/cek-tiket`) dengan **Stepper Timeline 4 Tahap Visual**, galeri foto Lightbox, dan percakapan publik dua arah.
   - Portal *Tiket Saya* (`/my-tickets`) untuk staf terdaftar dengan penyaringan tab status, lonceng notifikasi interaktif, dan *Floating Chat Badge*.

2. **Modul Registrasi Dinas & Persetujuan Akun**:
   - Pendaftaran mandiri staf kedinasan (`/register`) dengan pengisian NIP, nomor telepon, jabatan, kantor penempatan, dan wilayah regional.
   - Akun baru otomatis masuk status `PENDING` dengan peran `UPT_LUAR` dan data scope `OFFICE`.
   - Modul **Persetujuan Registrasi (`/admin/approvals`)** di workstation admin untuk meninjau data pemohon, menyetujui (`APPROVED`), menolak (`REJECTED`) disertai alasan, atau mengubah penetapan unit.

3. **Workstation Operator & Staf UPT Pusat (`/dashboard`)**:
   - Navigasi responsif terpadu (*Sage Sidebar*): mode *Desktop Mini-Rail* dan *Mobile Slide Drawer*.
   - **Menu Semua Tiket (`tickets`)**: Papan Triase Kanban 3-kolom aktif (`Open`, `In Progress`, `Menunggu`) dan mode Tampilan Tabel Adaptif.
   - **Menu Arsip Tiket (`archive`)**: Tampilan tabel berdensitas tinggi khusus tiket selesai (`status = 'closed'`) dengan pencarian cepat nomor ID tiket.
   - **Laci Inspeksi Tiket Bertab (`SageTicketDrawer`)**: Percakapan publik, catatan internal staf (🔒), triase tingkat urgensi/SLA, dan penugasan UPT teknis.
   - **Monitoring Tiket & SLA (`reports`)**: Ringkasan performa penyelesaian tiket dan metrik kepatuhan waktu SLA.

4. **Panel Tata Kelola Administrasi & Keamanan (Khusus Admin)**:
   - **Manajemen Staf & Hak Akses (`users`)**: Pembuatan akun manual, aktivasi/penonaktifan akun (*suspend/activate*), reset MFA staf, dan tombol laci *Kelola Hak Akses*.
   - **Laci Matriks Hak Akses Granular (`ManageAccessDrawer`)**: Konfigurasi izin override per user (ALLOW / DENY / INHERIT) terhadap 25+ permission katalog.
   - **Pusat Persetujuan Registrasi (`approvals`)**: Antrean verifikasi permohonan akun staf baru nasional.
   - **Log Audit Keamanan Forensik (`audit_log`)**: Tabel penelusuran aktivitas sistem lengkap dengan pencarian aktor, filter tipe aksi, dan modal detail payload JSON.
   - **Pemantau Kluster Aiven MySQL (`datasource`)**: Pengujian latensi ping real-time, status SSL REQUIRED, dan kapasitas baris tabel basis data.

5. **Subsistem Keamanan & Notifikasi Real-time**:
   - Otentikasi Multi-Faktor (MFA / 2FA) berbasis TOTP QR-Code dan kode darurat (*backup recovery codes*).
   - Layanan pengiriman email notifikasi dan verifikasi berbasis SMTP dinas (`server/utils/email.js`).
   - Notifikasi suara instan tanpa latensi (*Web Audio API*), push notification peramban desktop, serta sinkronisasi multi-tab (*BroadcastChannel* & *Storage Events*).

### 4.2 Ruang Lingkup Pengembangan Masa Depan (Out-of-Scope)
- Pengiriman SMS broadcast berbayar via agregator telco pihak ketiga.
- Penerapan kecerdasan buatan generatif (LLM chatbot) untuk auto-resolution otomatis tanpa verifikasi manusia.

---

## 5. Matriks Peran & Hak Akses Bisnis (Role-Based Access Control)

PRISMA POS menerapkan hierarki otorisasi berbasis 3 Peran Bisnis Resmi:

| Parameter | ADMIN | PETUGAS_UPT | UPT_LUAR |
|---|---|---|---|
| **Sebutan Peran** | Super Administrator Sistem | Petugas Helpdesk UPT Pusat | Staf / Pelapor Kantor Cabang & Regional |
| **Unit Penempatan** | Kantor Pusat Pengendalian Operasi | Kantor Pusat (Helpdesk / UPT Teknis) | Kantor Pos Cabang (KCU/KC/KCP) & Regional |
| **Cakupan Data (*Data Scope*)** | **GLOBAL** (Seluruh Indonesia) | **GLOBAL** (Seluruh Indonesia) | **OFFICE** (Hanya kantor penempatannya) |
| **Mekanisme Akun** | Diinisialisasi saat migrasi sistem | Didaftarkan oleh Administrator | Registrasi mandiri diapprove Admin |
| **Buat Tiket Baru** | Ya | Ya | Ya |
| **Lihat Tiket Nasional** | Ya (Seluruh Tiket Nasional) | Ya (Seluruh Tiket Nasional) | **Tidak** (Hanya tiket satu kantornya) |
| **Kirim Balasan Percakapan** | Ya (Publik & Catatan Internal) | Ya (Publik & Catatan Internal) | Ya (Hanya Balasan Publik) |
| **Ubah Status Tiket** | Ya (`in_progress`, `waiting`, `closed`) | Ya (`in_progress`, `waiting`, `closed`) | **DILARANG KERAS** (Akses diblokir API) |
| **Tutup Tiket (*Close*)** | Ya | Ya | **DILARANG KERAS** (Akses diblokir API) |
| **Triase & Pendelegasian UPT** | Ya | Ya | Tidak |
| **Monitoring & Laporan SLA** | Ya | Ya | Terbatas pada dashboard kantor |
| **Persetujuan Registrasi Baru** | Ya (Penuh di `/admin/approvals`) | Tidak | Tidak |
| **Kelola Akun & Reset MFA** | Ya (Penuh di `/admin/users`) | Tidak | Tidak |
| **Override Izin Granular** | Ya (Laci Hak Akses Granular) | Tidak | Tidak |
| **Akses Log Audit Forensik** | Ya (Penuh di `/admin/audit-logs`) | Tidak | Tidak |
| **Akses Database Aiven** | Ya (Panel Kluster Aiven) | Tidak | Tidak |

---

## 6. Unit Kerja & Struktur Organisasi yang Didukung

### 6.1 Struktur Wilayah Regional & Kantor
Sistem PRISMA POS telah memetakan hierarki geografis operasional PT Pos Indonesia secara relasional:
- **Kantor Pusat**: Regional Pusat (`REG-PUSAT`), Kantor Pusat Pengendalian Operasi (`OFC-PUSAT`).
- **6 Kantor Regional Nasional**:
  - **Regional 1 (Sumatera)**: `REG-01`
  - **Regional 2 (Jakarta & Banten)**: `REG-02`
  - **Regional 3 (Jawa Barat)**: `REG-03`
  - **Regional 4 (Jawa Tengah & DIY)**: `REG-04`
  - **Regional 5 (Jawa Timur, Bali, Nusa Tenggara)**: `REG-05`
  - **Regional 6 (Kalimantan, Sulawesi, Maluku, Papua)**: `REG-06`
- **Tingkatan Unit Kantor**: Kantor Cabang Utama (`KCU`), Kantor Cabang (`KC`), Kantor Cabang Pembantu (`KCP`), dan Unit Pelaksana Teknis Pusat (`PUSAT`).

### 6.2 Enam Unit Pelaksana Teknis (UPT) Triase Nasional
Alur penanganan teknis di tingkat Kantor Pusat dipetakan ke 6 Unit Teknis:
1. **UPT Operasional & Logistik**: Kendala distribusi kiriman, manifes kargo, transit Sentral Pengolahan Pos (SPP), dan pelacakan pos kilat.
2. **UPT Jaringan & Layanan Kurir**: Kendala armada kurir antaran, aplikasi kurir lapangan, pos keliling, dan layanan loket kiriman.
3. **UPT Sarana, Prasarana & Keamanan Fisik (CGS)**: Kerusakan gedung kantor, kelistrikan, AC, armada dinas, dan fasilitas fisik.
4. **UPT Bisnis Keuangan & Finansial**: Layanan Pospay, Giro Pos, Remittance, perbankan kemitraan, dan rekonsiliasi kas loket.
5. **UPT Quality Control & Audit SLA**: Pemeriksaan kepatuhan standar waktu tempuh SLA, audit volumetrik/timbangan, dan investigasi komplain berulang.
6. **UPT TI & Sistem Informasi**: Gangguan jaringan LAN/VPN/Wi-Fi, gangguan aplikasi core pos / PRISMA POS, hardware/printer barcode loket, dan akun email dinas.
