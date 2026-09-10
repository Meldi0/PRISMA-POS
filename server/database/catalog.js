export const seedRegions = [
      { region_id: 'REG-PUSAT', code: 'PUSAT', name: 'Kantor Pusat Bandung', description: 'Direktorat Kantor Pusat PT Pos Indonesia' },
      { region_id: 'REG-01', code: 'REG1', name: 'Regional 1 Sumatera Bagian Utara', description: 'Aceh, Sumatera Utara, Riau, Kepri' },
      { region_id: 'REG-02', code: 'REG2', name: 'Regional 2 Sumatera Bagian Barat & Selatan', description: 'Sumbar, Jambi, Sumsel, Bengkulu, Lampung' },
      { region_id: 'REG-03', code: 'REG3', name: 'Regional 3 Jawa Barat & Banten', description: 'Seluruh KCU & KC Wilayah Jawa Barat dan Banten' },
      { region_id: 'REG-04', code: 'REG4', name: 'Regional 4 DKI Jakarta & Jawa Tengah/DIY', description: 'Jabodetabek, Jawa Tengah, DI Yogyakarta' },
      { region_id: 'REG-05', code: 'REG5', name: 'Regional 5 Jawa Timur & Bali Nusra', description: 'Jawa Timur, Bali, NTB, NTT' },
      { region_id: 'REG-06', code: 'REG6', name: 'Regional 6 Kalimantan, Sulawesi & Maluku Papua', description: 'Kalimantan, Sulawesi, Maluku, Papua' },
    ];

export const seedOffices = [
      { office_id: 'OFC-PUSAT', region_id: 'REG-PUSAT', code: '40000', name: 'Kantor Pusat Cilaki Bandung', type: 'PUSAT', address: 'Jl. Cilaki No. 73, Bandung' },
      { office_id: 'OFC-KCU-BDG', region_id: 'REG-03', code: '40100', name: 'KCU Bandung 40000', type: 'KCU', address: 'Jl. Asia Afrika No. 49, Bandung' },
      { office_id: 'OFC-KC-CMH', region_id: 'REG-03', code: '40500', name: 'KC Cimahi 40500', type: 'KC', address: 'Jl. Gatot Subroto No. 1, Cimahi' },
      { office_id: 'OFC-KC-BGR', region_id: 'REG-03', code: '16000', name: 'KCU Bogor 16000', type: 'KCU', address: 'Jl. Ir. H. Juanda No. 5, Bogor' },
      { office_id: 'OFC-KCU-JKT', region_id: 'REG-04', code: '10000', name: 'KCU Jakarta Pusat 10000', type: 'KCU', address: 'Jl. Lapangan Banteng Utara No. 1, Jakarta' },
      { office_id: 'OFC-KCU-SMG', region_id: 'REG-04', code: '50000', name: 'KCU Semarang 50000', type: 'KCU', address: 'Jl. Johar No. 1, Semarang' },
      { office_id: 'OFC-KCU-SBY', region_id: 'REG-05', code: '60000', name: 'KCU Surabaya 60000', type: 'KCU', address: 'Jl. Kebon Rojo No. 10, Surabaya' },
      { office_id: 'OFC-KCU-DPS', region_id: 'REG-05', code: '80000', name: 'KCU Denpasar 80000', type: 'KCU', address: 'Jl. Puputan Renon, Denpasar' },
      { office_id: 'OFC-KCU-MDN', region_id: 'REG-01', code: '20000', name: 'KCU Medan 20000', type: 'KCU', address: 'Jl. Pos No. 1, Medan' },
      { office_id: 'OFC-KCU-PDG', region_id: 'REG-02', code: '25000', name: 'KCU Padang 25000', type: 'KCU', address: 'Jl. Bagindo Aziz Chan No. 7, Padang' },
      { office_id: 'OFC-KCU-MKS', region_id: 'REG-06', code: '90000', name: 'KCU Makassar 90000', type: 'KCU', address: 'Jl. Slamet Riyadi No. 10, Makassar' }
    ];

export const seedRoles = [
      { 
        role_code: 'ADMIN', 
        name: 'Administrator Sistem', 
        description: 'Super Administrator dengan hak akses penuh sistem, manajemen pengguna, konfigurasi role & permission, melihat semua tiket nasional, dan menutup tiket.', 
        default_scope: 'GLOBAL' 
      },
      { 
        role_code: 'PETUGAS_UPT', 
        name: 'Petugas UPT Pusat', 
        description: 'Petugas Helpdesk UPT Pusat untuk triase nasional, disposisi, penanganan kendala, ubah status, penyelesaian, dan penutupan tiket.', 
        default_scope: 'GLOBAL' 
      },
      { 
        role_code: 'UPT_LUAR', 
        name: 'UPT Luar / Pelapor', 
        description: 'Petugas UPT Luar / Kantor Cabang / Regional sebagai pelapor kendala/tiket dan monitoring tiket unit kerjanya.', 
        default_scope: 'OFFICE' 
      }
    ];

export const seedPermissions = [
      // Module: Dashboard
      { code: 'dashboard.view', name: 'Melihat Dashboard Ringkasan', module: 'dashboard', action: 'view', desc: 'Akses halaman dashboard utama' },

      // Module: Ticket
      { code: 'ticket.create', name: 'Membuat Tiket Baru', module: 'ticket', action: 'create', desc: 'Mengajukan tiket permohonan baru' },
      { code: 'ticket.view', name: 'Melihat Daftar & Detail Tiket Global', module: 'ticket', action: 'view', desc: 'Membaca daftar tiket masuk operasional' },
      { code: 'ticket.view_own', name: 'Melihat Tiket Sendiri / Unit Kantor', module: 'ticket', action: 'view_own', desc: 'Melihat tiket yang diajukan oleh akun sendiri atau unit kantornya' },
      { code: 'ticket.view_all', name: 'Melihat Seluruh Tiket Nasional', module: 'ticket', action: 'view_all', desc: 'Melihat seluruh tiket di semua wilayah' },
      { code: 'ticket.update', name: 'Mengubah Tiket', module: 'ticket', action: 'update', desc: 'Mengubah informasi tiket' },
      { code: 'ticket.reply', name: 'Membalas & Kirim Thread Tiket', module: 'ticket', action: 'reply', desc: 'Mengirim tanggapan percakapan tiket' },
      { code: 'ticket.reply_own', name: 'Membalas Tiket Sendiri', module: 'ticket', action: 'reply_own', desc: 'Memberi respon pada tiket milik sendiri' },
      { code: 'ticket.close_own', name: 'Menutup Tiket Sendiri', module: 'ticket', action: 'close_own', desc: 'Pelapor mengonfirmasi dan menutup tiket miliknya' },
      { code: 'ticket.assign', name: 'Mendelegasikan Tiket', module: 'ticket', action: 'assign', desc: 'Menugaskan tiket ke operator / staf penanganan' },
      { code: 'ticket.claim', name: 'Klaim Penanganan Tiket', module: 'ticket', action: 'claim', desc: 'Operator mengambil alih tiket untuk ditangani' },
      { code: 'ticket.change_status', name: 'Mengubah Status Tiket', module: 'ticket', action: 'change_status', desc: 'Mengubah status open, in_progress, waiting' },
      { code: 'ticket.change_priority', name: 'Mengubah Prioritas Tiket', module: 'ticket', action: 'change_priority', desc: 'Eskalasi atau penyesuaian urgensi prioritas' },
      { code: 'ticket.triage', name: 'Triase & Verifikasi Tiket', module: 'ticket', action: 'triage', desc: 'Verifikasi kelengkapan dan klasifikasi tiket baru' },
      { code: 'ticket.request_info', name: 'Meminta Informasi Tambahan', module: 'ticket', action: 'request_info', desc: 'Mengubah status ke WAITING_FEEDBACK dengan catatan info yang dibutuhkan' },
      { code: 'ticket.resolve', name: 'Menyelesaikan Tiket (Resolve)', module: 'ticket', action: 'resolve', desc: 'Menandai solusi penyelesaian pada tiket' },
      { code: 'ticket.reopen', name: 'Membuka Kembali Tiket Ditutup', module: 'ticket', action: 'reopen', desc: 'Reopen tiket closed apabila kendala berulang' },
      { code: 'ticket.delete', name: 'Menghapus Tiket Permanen', module: 'ticket', action: 'delete', desc: 'Menghapus tiket dari database (Super Admin)' },
      { code: 'ticket.export', name: 'Mengekspor Data Tiket', module: 'ticket', action: 'export', desc: 'Mengunduh laporan tiket (CSV/Excel)' },

      // Module: Monitoring & Analytics
      { code: 'monitoring.view', name: 'Melihat Monitoring Kinerja Tiket', module: 'monitoring', action: 'view', desc: 'Akses visual metrik performa tiket, backlog & status' },
      { code: 'analytics.view', name: 'Melihat Analytics & Tren Tiket', module: 'analytics', action: 'view', desc: 'Analisis statistik volume dan kategori tiket' },
      { code: 'sla.view', name: 'Melihat Performa SLA', module: 'sla', action: 'view', desc: 'Pemantauan kepatuhan Service Level Agreement tiket' },
      { code: 'operator.stats_view', name: 'Melihat Rekap Produktivitas Operator', module: 'operator', action: 'view_stats', desc: 'Melihat statistik dan rekap jumlah tiket yang ditangani oleh masing-masing operator (Khusus Manager / Atasan)' },

      // Module: User Management & Access Control
      { code: 'user.view', name: 'Melihat Daftar Pengguna', module: 'user', action: 'view', desc: 'Melihat daftar staf dan pengguna terdaftar' },
      { code: 'user.create', name: 'Menambahkan Pengguna Baru', module: 'user', action: 'create', desc: 'Membuat akun pengguna secara manual oleh Admin' },
      { code: 'user.update', name: 'Mengubah Data Pengguna', module: 'user', action: 'update', desc: 'Mengubah informasi profil & penugasan pengguna' },
      { code: 'user.deactivate', name: 'Menonaktifkan Akun Pengguna', module: 'user', action: 'deactivate', desc: 'Membekukan atau menonaktifkan status akun staf' },
      { code: 'user.assign_role', name: 'Menugaskan Peran Pengguna', module: 'user', action: 'assign_role', desc: 'Menetapkan role ADMIN, PETUGAS_UPT, atau UPT_LUAR' },
      { code: 'approval.view', name: 'Melihat Antrean Approval Pendaftaran', module: 'approval', action: 'view', desc: 'Melihat permohonan akun registrasi baru' },
      { code: 'approval.manage', name: 'Menyetujui / Menolak Registrasi', module: 'approval', action: 'manage', desc: 'Memproses approve atau reject pendaftar baru' },
      { code: 'role.view', name: 'Melihat Daftar Role', module: 'role', action: 'view', desc: 'Melihat katalog role dan cakupan scope' },
      { code: 'role.manage', name: 'Mengelola Role', module: 'role', action: 'manage', desc: 'Konfigurasi konfigurasi peran pengguna' },
      { code: 'permission.view', name: 'Melihat Matriks Permission', module: 'permission', action: 'view', desc: 'Melihat matriks izin per role dan per user' },
      { code: 'permission.manage', name: 'Mengatur Permission Pengguna', module: 'permission', action: 'manage', desc: 'Override izin granular pengguna' },

      // Module: System & Audit
      { code: 'audit.view', name: 'Melihat Log Audit Jejak Rekam Sistem', module: 'audit', action: 'view', desc: 'Melihat riwayat aktivitas keamanan dan sistem' },
      { code: 'system.settings', name: 'Konfigurasi Pengaturan Sistem', module: 'system', action: 'settings', desc: 'Pengaturan global sistem helpdesk POSO' },

      // Backward-compat aliases
      { code: 'audit_log.view', name: 'Melihat Log Audit (Alias)', module: 'audit', action: 'view', desc: 'Alias audit_log.view untuk kompatibilitas' },
      { code: 'ticket.edit', name: 'Mengubah Rincian Tiket (Alias)', module: 'ticket', action: 'edit', desc: 'Alias ticket.edit untuk kompatibilitas' },
      { code: 'ticket.close', name: 'Menutup Tiket (Alias)', module: 'ticket', action: 'close', desc: 'Alias ticket.close untuk kompatibilitas' }
    ];
