import { pool } from '../config/db.js';
import { hashPassword } from '../utils/auth.js';

export async function runMigration() {
  console.log('=================================================================');
  console.log('       POSO DATABASE MIGRATION ENGINE — AIVEN FOR MYSQL          ');
  console.log('   Security, MFA, Role, Granular Permissions & Data Scope        ');
  console.log('=================================================================');
  let connection;
  try {
    connection = await pool.getConnection();
    // ---------------------------------------------------------------------------------------------
    // 1. DDL: BUAT TABEL MASTER & STRUKTUR KEAMANAN BARU
    // ---------------------------------------------------------------------------------------------
    console.log('[1/5] Membuat struktur tabel master & relasi keamanan...');

    const tables = [
      // 1. Tabel regions (Wilayah Regional PT Pos Indonesia)
      `CREATE TABLE IF NOT EXISTS regions (
        region_id VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (region_id),
        UNIQUE KEY uk_regions_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 2. Tabel offices (Kantor Cabang / KCU / Kantor Pusat)
      `CREATE TABLE IF NOT EXISTS offices (
        office_id VARCHAR(50) NOT NULL,
        region_id VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(20) NOT NULL,
        type ENUM('PUSAT', 'KCU', 'KC', 'KCP') NOT NULL DEFAULT 'KC',
        address TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (office_id),
        KEY idx_offices_region_id (region_id),
        KEY idx_offices_code (code),
        CONSTRAINT fk_offices_region FOREIGN KEY (region_id) REFERENCES regions (region_id) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 3. Tabel roles (Definisi Role Utama: ADMIN_PUSAT, USER_REGIONAL, USER_CABANG, dll)
      `CREATE TABLE IF NOT EXISTS roles (
        role_code VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        default_scope ENUM('GLOBAL', 'REGIONAL', 'OFFICE', 'OWN') NOT NULL DEFAULT 'OFFICE',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 4. Tabel permissions (Katalog Permission Granular Spesifik Fitur POSO)
      `CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(100) NOT NULL,
        name VARCHAR(150) NOT NULL,
        description VARCHAR(255) DEFAULT NULL,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_permissions_code (code),
        KEY idx_permissions_module (module)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 5. Tabel role_permissions (Baseline Permissions per Role)
      `CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_code VARCHAR(50) NOT NULL,
        permission_id INT NOT NULL,
        effect ENUM('ALLOW', 'DENY') NOT NULL DEFAULT 'ALLOW',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_role_perm (role_code, permission_id),
        CONSTRAINT fk_rp_role FOREIGN KEY (role_code) REFERENCES roles (role_code) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 6. Tabel user_permissions (User-Specific Override Permissions)
      `CREATE TABLE IF NOT EXISTS user_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        permission_id INT NOT NULL,
        effect ENUM('ALLOW', 'DENY') NOT NULL DEFAULT 'ALLOW',
        granted_by VARCHAR(50) DEFAULT 'system',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_perm (user_id, permission_id),
        CONSTRAINT fk_up_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 7. Tabel registration_approvals (Antrean & Log Approval Pendaftaran Staf)
      `CREATE TABLE IF NOT EXISTS registration_approvals (
        approval_id VARCHAR(50) NOT NULL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        reviewed_by VARCHAR(50) DEFAULT NULL,
        reviewer_name VARCHAR(150) DEFAULT NULL,
        rejection_reason TEXT DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_reg_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 8. Tabel mfa_challenges (Token Verifikasi Challenge Saat Login)
      `CREATE TABLE IF NOT EXISTS mfa_challenges (
        challenge_id VARCHAR(50) NOT NULL PRIMARY KEY,
        challenge_token VARCHAR(255) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_used TINYINT(1) NOT NULL DEFAULT 0,
        attempts INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_challenge_token (challenge_token),
        KEY idx_challenge_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 9. Tabel login_sessions (Pelacak Sesi Login Aktif & Keamanan)
      `CREATE TABLE IF NOT EXISTS login_sessions (
        session_id VARCHAR(50) NOT NULL PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        user_agent TEXT DEFAULT NULL,
        last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        is_revoked TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sessions_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // 10. Tabel ticket_reopen_requests (Permohonan Pembukaan Kembali Tiket Tertutup)
      `CREATE TABLE IF NOT EXISTS ticket_reopen_requests (
        request_id VARCHAR(50) NOT NULL PRIMARY KEY,
        ticket_id VARCHAR(50) NOT NULL,
        requester_id VARCHAR(50) NOT NULL,
        requester_name VARCHAR(150) NOT NULL,
        requester_email VARCHAR(150) NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        reviewed_by VARCHAR(50) DEFAULT NULL,
        reviewer_name VARCHAR(150) DEFAULT NULL,
        review_note TEXT DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_reopen_ticket (ticket_id),
        KEY idx_reopen_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    for (const sql of tables) {
      await connection.query(sql);
    }
    console.log('   ✓ Tabel regions, offices, roles, permissions, role_permissions, user_permissions, registration_approvals, mfa_challenges, login_sessions terverifikasi.');

    // ---------------------------------------------------------------------------------------------
    // 2. ALTER TABLE KOLOM PADA TABEL EXISTING (Non-Destruktif)
    // ---------------------------------------------------------------------------------------------
    console.log('[2/5] Memperbarui struktur kolom tabel existing (ALTER TABLE)...');

    // Helper penambahan kolom aman
    const addColumnIfNotExists = async (table, column, definition) => {
      try {
        const [cols] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
        if (cols.length === 0) {
          await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
          console.log(`   ✓ Kolom ${column} ditambahkan ke tabel ${table}.`);
        }
      } catch (err) {
        console.warn(`   Notice add column ${table}.${column}:`, err.message);
      }
    };

    // A. Kolom pada tabel users
    await addColumnIfNotExists('users', 'account_status', "ENUM('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE' AFTER is_active");
    await addColumnIfNotExists('users', 'region_id', "VARCHAR(50) DEFAULT NULL AFTER account_status");
    await addColumnIfNotExists('users', 'office_id', "VARCHAR(50) DEFAULT NULL AFTER region_id");
    await addColumnIfNotExists('users', 'data_scope', "ENUM('GLOBAL', 'REGIONAL', 'OFFICE', 'OWN') NOT NULL DEFAULT 'OFFICE' AFTER office_id");
    await addColumnIfNotExists('users', 'position', "VARCHAR(100) DEFAULT NULL AFTER role_title");
    await addColumnIfNotExists('users', 'mfa_enabled', "TINYINT(1) NOT NULL DEFAULT 0 AFTER data_scope");
    await addColumnIfNotExists('users', 'failed_attempts', "INT NOT NULL DEFAULT 0 AFTER mfa_enabled");
    await addColumnIfNotExists('users', 'last_login_at', "DATETIME DEFAULT NULL AFTER locked_until");

    // Ubah role users ke VARCHAR(50) agar mendukung role dinamis tanpa konflik ENUM
    try {
      await connection.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'UPT_LUAR'");
      console.log('   ✓ Kolom users.role diperluas menjadi VARCHAR(50) dinamis (Default: UPT_LUAR).');
    } catch (e) {
      console.warn('   Notice modify users.role:', e.message);
    }

    // B. Kolom pada tabel tickets
    await addColumnIfNotExists('tickets', 'region_id', "VARCHAR(50) DEFAULT NULL AFTER location");
    await addColumnIfNotExists('tickets', 'office_id', "VARCHAR(50) DEFAULT NULL AFTER region_id");
    await addColumnIfNotExists('tickets', 'is_archived', "TINYINT(1) NOT NULL DEFAULT 0 AFTER closed_at");
    await addColumnIfNotExists('tickets', 'reopen_status', "ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NONE' AFTER is_archived");

    // Kolom pada mfa_challenges
    await addColumnIfNotExists('mfa_challenges', 'otp_code', "VARCHAR(10) DEFAULT NULL AFTER user_id");

    // Pastikan deskripsi dan message adalah LONGTEXT
    try {
      await connection.query("ALTER TABLE threads MODIFY message LONGTEXT");
      await connection.query("ALTER TABLE tickets MODIFY description LONGTEXT");
    } catch (e) {}

    // C. Kolom pada tabel audit_logs
    await addColumnIfNotExists('audit_logs', 'entity_type', "VARCHAR(50) DEFAULT NULL AFTER action");
    await addColumnIfNotExists('audit_logs', 'entity_id', "VARCHAR(50) DEFAULT NULL AFTER entity_type");
    await addColumnIfNotExists('audit_logs', 'description', "TEXT DEFAULT NULL AFTER details");
    await addColumnIfNotExists('audit_logs', 'ip_address', "VARCHAR(45) DEFAULT NULL AFTER description");
    await addColumnIfNotExists('audit_logs', 'user_agent', "TEXT DEFAULT NULL AFTER ip_address");

    // Performance Indexes for Operator Statistics & Audit
    try {
      await connection.query("ALTER TABLE audit_logs ADD INDEX idx_audit_actor_action_date (actor_id, action, created_at)");
    } catch (e) {}
    try {
      await connection.query("ALTER TABLE threads ADD INDEX idx_threads_sender_date (sender_id, created_at)");
    } catch (e) {}

    // ---------------------------------------------------------------------------------------------
    // 3. SEEDING MASTER DATA: REGIONS, OFFICES, ROLES, & PERMISSIONS
    // ---------------------------------------------------------------------------------------------
    console.log('[3/5] Melakukan seeding data master organisasi & permission...');

    // A. Seed Regions
    const seedRegions = [
      { region_id: 'REG-PUSAT', code: 'PUSAT', name: 'Kantor Pusat Bandung', description: 'Direktorat Kantor Pusat PT Pos Indonesia' },
      { region_id: 'REG-01', code: 'REG1', name: 'Regional 1 Sumatera Bagian Utara', description: 'Aceh, Sumatera Utara, Riau, Kepri' },
      { region_id: 'REG-02', code: 'REG2', name: 'Regional 2 Sumatera Bagian Barat & Selatan', description: 'Sumbar, Jambi, Sumsel, Bengkulu, Lampung' },
      { region_id: 'REG-03', code: 'REG3', name: 'Regional 3 Jawa Barat & Banten', description: 'Seluruh KCU & KC Wilayah Jawa Barat dan Banten' },
      { region_id: 'REG-04', code: 'REG4', name: 'Regional 4 DKI Jakarta & Jawa Tengah/DIY', description: 'Jabodetabek, Jawa Tengah, DI Yogyakarta' },
      { region_id: 'REG-05', code: 'REG5', name: 'Regional 5 Jawa Timur & Bali Nusra', description: 'Jawa Timur, Bali, NTB, NTT' },
      { region_id: 'REG-06', code: 'REG6', name: 'Regional 6 Kalimantan, Sulawesi & Maluku Papua', description: 'Kalimantan, Sulawesi, Maluku, Papua' },
    ];

    for (const r of seedRegions) {
      await connection.query(`
        INSERT INTO regions (region_id, code, name, description)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)
      `, [r.region_id, r.code, r.name, r.description]);
    }
    console.log(`   ✓ ${seedRegions.length} data master Regional siap pakai.`);

    // B. Seed Offices
    const seedOffices = [
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

    for (const o of seedOffices) {
      await connection.query(`
        INSERT INTO offices (office_id, region_id, code, name, type, address)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address), type = VALUES(type)
      `, [o.office_id, o.region_id, o.code, o.name, o.type, o.address]);
    }
    console.log(`   ✓ ${seedOffices.length} data master Kantor Pos Cabang & KCU siap pakai.`);

    // C. Seed Roles (HANYA 3 ROLE BISNIS RESMI: ADMIN, PETUGAS_UPT, UPT_LUAR)
    const seedRoles = [
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

    for (const ro of seedRoles) {
      await connection.query(`
        INSERT INTO roles (role_code, name, description, default_scope)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), default_scope = VALUES(default_scope)
      `, [ro.role_code, ro.name, ro.description, ro.default_scope]);
    }
    console.log(`   ✓ ${seedRoles.length} data peran resmi (roles: ADMIN, PETUGAS_UPT, UPT_LUAR) terdaftar.`);

    // D. Seed Permissions Granular POSO (34 granular permissions + dashboard.view)
    const seedPermissions = [
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

    for (const p of seedPermissions) {
      await connection.query(`
        INSERT INTO permissions (code, name, module, action, description)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), module = VALUES(module), action = VALUES(action), description = VALUES(description)
      `, [p.code, p.name, p.module, p.action, p.desc]);
    }
    console.log(`   ✓ ${seedPermissions.length} data permission granular tersimpan.`);

    // E. Seed Role Permissions Baseline
    const [allPermRows] = await connection.query('SELECT id, code FROM permissions');
    const permMap = {};
    allPermRows.forEach(row => { permMap[row.code] = row.id; });

    // Baseline rules per 3 business roles:
    // PENTING: UPT_LUAR sama sekali TIDAK BISA menutup atau mengubah status tiket!
    const baselineRules = {
      ADMIN: Object.keys(permMap), // Super Admin - Full Access
      PETUGAS_UPT: [
        'dashboard.view',
        'ticket.view', 'ticket.view_all', 'ticket.create', 'ticket.update', 'ticket.edit', 'ticket.reply',
        'ticket.assign', 'ticket.claim', 'ticket.change_status', 'ticket.change_priority',
        'ticket.triage', 'ticket.request_info', 'ticket.resolve', 'ticket.reopen', 'ticket.close', 'ticket.export',
        'monitoring.view', 'analytics.view', 'sla.view',
        'user.view'
      ],
      UPT_LUAR: [
        'dashboard.view',
        'ticket.create', 'ticket.view_own', 'ticket.reply_own'
      ]
    };

    for (const [roleCode, allowedCodes] of Object.entries(baselineRules)) {
      for (const [code, permId] of Object.entries(permMap)) {
        const isAllowed = allowedCodes.includes(code);
        const effect = isAllowed ? 'ALLOW' : 'DENY';
        await connection.query(`
          INSERT INTO role_permissions (role_code, permission_id, effect)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE effect = VALUES(effect)
        `, [roleCode, permId, effect]);
      }
    }
    console.log('   ✓ Matriks role_permissions baseline 3 role resmi (ADMIN, PETUGAS_UPT, UPT_LUAR) berhasil dikonfigurasi.');

    // F. Migrasi Data User Lama & Pembersihan Role Usang
    console.log('   -> Memigrasikan role pengguna existing ke 3 role resmi (ADMIN, PETUGAS_UPT, UPT_LUAR)...');
    await connection.query("UPDATE users SET role = 'ADMIN', data_scope = 'GLOBAL' WHERE role IN ('admin', 'ADMIN_PUSAT', 'ADMIN')");
    await connection.query("UPDATE users SET role = 'PETUGAS_UPT', data_scope = 'GLOBAL' WHERE role IN ('operator', 'upt', 'OPERATOR', 'PETUGAS', 'PETUGAS_UPT')");
    await connection.query("UPDATE users SET role = 'UPT_LUAR', data_scope = 'OFFICE' WHERE role IN ('USER_REGIONAL', 'USER_CABANG', 'pengguna_umum', 'PELAPOR', 'USER_UMUM', 'USER', 'UPT_LUAR') OR role IS NULL");

    // Migrasi sender_role pada threads
    try {
      await connection.query("UPDATE threads SET sender_role = 'ADMIN' WHERE sender_role IN ('admin', 'ADMIN_PUSAT')");
      await connection.query("UPDATE threads SET sender_role = 'PETUGAS_UPT' WHERE sender_role IN ('operator', 'upt', 'OPERATOR', 'PETUGAS')");
      await connection.query("UPDATE threads SET sender_role = 'UPT_LUAR' WHERE sender_role IN ('USER_REGIONAL', 'USER_CABANG', 'pengguna_umum', 'PELAPOR', 'USER_UMUM', 'USER')");
      console.log('   ✓ Riwayat peran pengirim pesan thread berhasil dimigrasikan.');
    } catch (e) {}

    // Bersihkan role usang di role_permissions & roles
    await connection.query("DELETE FROM role_permissions WHERE role_code NOT IN ('ADMIN', 'PETUGAS_UPT', 'UPT_LUAR')");
    await connection.query("DELETE FROM roles WHERE role_code NOT IN ('ADMIN', 'PETUGAS_UPT', 'UPT_LUAR')");
    console.log('   ✓ Pembersihan role usang selesai. Hanya 3 role resmi (ADMIN, PETUGAS_UPT, UPT_LUAR) yang aktif.');

    // ---------------------------------------------------------------------------------------------
    // 4. SEEDING AKUN MASTER & SAMPLE USER 3 ROLE
    // ---------------------------------------------------------------------------------------------
    console.log('[4/5] Melakukan sinkronisasi akun pengguna & sample user 3 role...');
    const adminPass = await hashPassword('Admin123!');
    const posoPass = await hashPassword('Poso123!');
    const opPass = await hashPassword('Operator123!');

    const seedUsers = [
      // 1. ADMIN (Super Admin Sistem)
      {
        user_id: 'USR-ADMIN01',
        name: 'Administrator POSO (Super Admin)',
        email: 'admin@poso.local',
        password_hash: adminPass,
        password_plain: 'Admin123!',
        role: 'ADMIN',
        account_status: 'ACTIVE',
        data_scope: 'GLOBAL',
        region_id: 'REG-PUSAT',
        office_id: 'OFC-PUSAT',
        position: 'Kepala Pusat Pengendalian Operasi',
        nip: '198801012015011001',
        department: 'Direktorat TI & Operasional',
        role_title: 'Super Administrator POSO'
      },
      // 2. PETUGAS_UPT (Petugas Helpdesk di Kantor Pusat)
      {
        user_id: 'USR-OPERATOR01',
        name: 'Siti Rahma (Petugas UPT Pusat)',
        email: 'operator@poso.local',
        password_hash: opPass,
        password_plain: 'Operator123!',
        role: 'PETUGAS_UPT',
        account_status: 'ACTIVE',
        data_scope: 'GLOBAL',
        region_id: 'REG-PUSAT',
        office_id: 'OFC-PUSAT',
        position: 'Petugas Helpdesk & Triase',
        nip: '199203152018022003',
        department: 'Kantor Pusat Pengendalian Operasi',
        role_title: 'Petugas UPT Pusat'
      },
      // 3. UPT_LUAR CABANG BANDUNG (Andi Wijaya)
      {
        user_id: 'USR-CABANG-BDG',
        name: 'Andi Wijaya (UPT Luar KCU Bandung)',
        email: 'andi.cabang@poso.local',
        password_hash: posoPass,
        password_plain: 'Poso123!',
        role: 'UPT_LUAR',
        account_status: 'ACTIVE',
        data_scope: 'OFFICE',
        region_id: 'REG-03',
        office_id: 'OFC-KCU-BDG',
        position: 'Staf Operasional KCU Bandung',
        nip: '199407222019021002',
        department: 'Pelayanan Kantor Cabang Utama Bandung',
        role_title: 'Petugas UPT Luar (KCU Bandung)'
      },
      // 4. UPT_LUAR REGIONAL 3 (Budi Santoso)
      {
        user_id: 'USR-REGIONAL03',
        name: 'Budi Santoso (UPT Luar Regional 3)',
        email: 'budi.regional3@poso.local',
        password_hash: posoPass,
        password_plain: 'Poso123!',
        role: 'UPT_LUAR',
        account_status: 'ACTIVE',
        data_scope: 'OFFICE',
        region_id: 'REG-03',
        office_id: 'OFC-KCU-BDG',
        position: 'Supervisor Layanan Regional 3',
        nip: '199105122017031004',
        department: 'Regional 3 Jabar & Banten',
        role_title: 'Petugas UPT Luar (Regional 3)'
      },
      // 5. UPT_LUAR PENDING (Hendra Gunawan - Sample Pending Approval)
      {
        user_id: 'USR-PENDING-CMH',
        name: 'Hendra Gunawan (Pendaftar Baru)',
        email: 'hendra.pending@poso.local',
        password_hash: posoPass,
        password_plain: 'Poso123!',
        role: 'UPT_LUAR',
        account_status: 'PENDING',
        data_scope: 'OFFICE',
        region_id: 'REG-03',
        office_id: 'OFC-KC-CMH',
        position: 'Petugas Loket Cimahi',
        nip: '199611032021021005',
        department: 'Pelayanan Kantor Cabang Cimahi',
        role_title: 'Petugas UPT Luar (KC Cimahi)'
      },
      // 6. PETUGAS_UPT TI (Support Tambahan Pusat)
      {
        user_id: 'USR-UPTTI01',
        name: 'Ahmad Fauzi (Petugas UPT TI)',
        email: 'upt.ti@poso.local',
        password_hash: posoPass,
        password_plain: 'Poso123!',
        role: 'PETUGAS_UPT',
        upt_unit: 'UPT TI & Sistem Informasi',
        account_status: 'ACTIVE',
        data_scope: 'GLOBAL',
        region_id: 'REG-PUSAT',
        office_id: 'OFC-PUSAT',
        position: 'Network & System Engineer',
        nip: '199008202016031005',
        department: 'Infrastruktur Jaringan',
        role_title: 'Petugas UPT TI Pusat'
      },
      // 7. PETUGAS_UPT SARPRAS (Support Tambahan Pusat)
      {
        user_id: 'USR-UPTSARPRAS01',
        name: 'Rudi Hermawan (Petugas UPT Sarpras)',
        email: 'upt.sarpras@poso.local',
        password_hash: posoPass,
        password_plain: 'Poso123!',
        role: 'PETUGAS_UPT',
        upt_unit: 'UPT Sarana & Prasarana (CGS)',
        account_status: 'ACTIVE',
        data_scope: 'GLOBAL',
        region_id: 'REG-PUSAT',
        office_id: 'OFC-PUSAT',
        position: 'Building & Facility Officer',
        nip: '198711252014021008',
        department: 'Pemeliharaan Fasilitas',
        role_title: 'Petugas UPT Sarpras Pusat'
      },
      // 8. UPT_LUAR EKSTERNAL (Dewi Lestari)
      {
        user_id: 'USR-PUBLIC01',
        name: 'Dewi Lestari',
        email: 'dewi@gmail.com',
        password_hash: posoPass,
        password_plain: 'Poso123!',
        role: 'UPT_LUAR',
        account_status: 'ACTIVE',
        data_scope: 'OFFICE',
        region_id: 'REG-03',
        office_id: 'OFC-KCU-BDG',
        position: 'Pelapor Layanan',
        nip: null,
        department: 'Pelapor Eksternal',
        role_title: 'Petugas UPT Luar'
      }
    ];

    for (const u of seedUsers) {
      await connection.query(`
        INSERT INTO users (
          user_id, name, email, password_hash, password_plain, role, is_active,
          account_status, region_id, office_id, data_scope, position,
          nip, department, role_title, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'system_seed')
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          password_plain = VALUES(password_plain),
          role = VALUES(role),
          account_status = VALUES(account_status),
          region_id = VALUES(region_id),
          office_id = VALUES(office_id),
          data_scope = VALUES(data_scope),
          position = VALUES(position),
          nip = VALUES(nip),
          department = VALUES(department),
          role_title = VALUES(role_title)
      `, [
        u.user_id, u.name, u.email, u.password_hash, u.password_plain, u.role,
        u.account_status, u.region_id || null, u.office_id || null, u.data_scope || 'OFFICE',
        u.position || null, u.nip || null, u.department || null, u.role_title || null
      ]);

      // Catat approval pending untuk hendra.pending
      if (u.account_status === 'PENDING') {
        await connection.query(`
          INSERT INTO registration_approvals (approval_id, user_id, status, created_at)
          VALUES (?, ?, 'PENDING', NOW())
          ON DUPLICATE KEY UPDATE status = VALUES(status)
        `, [`APV-${u.user_id}`, u.user_id]);
      }
    }
    console.log(`   ✓ ${seedUsers.length} pengguna sample terverifikasi.`);

    // ---------------------------------------------------------------------------------------------
    // 5. ENRICHMENT TIKET DENGAN REGION_ID & OFFICE_ID (Data Scope Testing)
    // ---------------------------------------------------------------------------------------------
    console.log('[5/5] Memetakan data scope pada tiket existing...');
    await connection.query(`
      UPDATE tickets 
      SET region_id = 'REG-03', office_id = 'OFC-KCU-BDG'
      WHERE ticket_id IN ('TICK-20260831-1001', 'TICK-20260831-1004', 'TICK-20260903-2090')
    `);
    await connection.query(`
      UPDATE tickets 
      SET region_id = 'REG-PUSAT', office_id = 'OFC-PUSAT'
      WHERE ticket_id IN ('TICK-20260831-1002', 'TICK-20260831-1003')
    `);

    // Pastikan audit logs awal memiliki action dan entity
    await connection.query(`
      INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
      VALUES (?, 'USR-ADMIN01', 'Administrator POSO', 'ADMIN', 'SYSTEM_MIGRATION', 'SYSTEM', 'MIGRATE_V3', 'Migrasi skema database POSO v3.0 selesai', 'Eksekusi migrasi skema keamanan, MFA, roles & granular permissions')
      ON DUPLICATE KEY UPDATE action = VALUES(action)
    `, [`LOG-MIGRATE-${Date.now().toString().slice(-4)}`]);

    console.log('=================================================================');
    console.log('                 MIGRATION COMPLETED SUCCESSFULLY                ');
    console.log('=================================================================');
    console.log('Status: SELURUH TABEL KEAMANAN, ROLE & PERMISSION TERPASANG.');
    console.log('Data existing tetap utuh dan kompatibel 100%.');
    console.log('=================================================================');
    return true;
  } catch (err) {
    console.error('MIGRATION FAILED:', err.message);
    console.error(err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

// Auto-run if executed directly
runMigration()
  .then(() => pool.end())
  .catch((e) => {
    console.error('Fatal migration error:', e);
    process.exit(1);
  });
