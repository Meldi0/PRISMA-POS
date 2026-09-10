import { pool } from '../config/db.js';
import { hashPassword } from '../utils/auth.js';

async function purgeData() {
  console.log('====================================================');
  console.log('MEMULAI PEMBERSIHAN DATABASE POSO (DATA PURGE)');
  console.log('Target: Siap Publikasi (Hanya Menyisakan 1 Akun Admin)');
  console.log('====================================================\n');

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Hapus riwayat percakapan tiket (threads)
    const [delThreads] = await connection.query('DELETE FROM threads');
    console.log(`✓ Menghapus data tabel threads: ${delThreads.affectedRows} baris`);

    // 2. Hapus permohonan buka kembali tiket (ticket_reopen_requests)
    const [delReopen] = await connection.query('DELETE FROM ticket_reopen_requests');
    console.log(`✓ Menghapus data tabel ticket_reopen_requests: ${delReopen.affectedRows} baris`);

    // 3. Hapus seluruh data tiket (tickets)
    const [delTickets] = await connection.query('DELETE FROM tickets');
    console.log(`✓ Menghapus data tabel tickets: ${delTickets.affectedRows} baris`);

    // 4. Hapus seluruh antrean pendaftaran (registration_approvals)
    const [delApprovals] = await connection.query('DELETE FROM registration_approvals');
    console.log(`✓ Menghapus data tabel registration_approvals: ${delApprovals.affectedRows} baris`);

    // 5. Hapus seluruh sesi login aktif (login_sessions)
    const [delSessions] = await connection.query('DELETE FROM login_sessions');
    console.log(`✓ Menghapus data tabel login_sessions: ${delSessions.affectedRows} baris`);

    // 6. Hapus tantangan MFA (mfa_challenges)
    const [delMfa] = await connection.query('DELETE FROM mfa_challenges');
    console.log(`✓ Menghapus data tabel mfa_challenges: ${delMfa.affectedRows} baris`);

    // 7. Hapus perangkat tepercaya (trusted_devices)
    const [delTrusted] = await connection.query('DELETE FROM trusted_devices');
    console.log(`✓ Menghapus data tabel trusted_devices: ${delTrusted.affectedRows} baris`);

    // 8. Hapus riwayat pembatasan permintaan (request_limits)
    const [delLimits] = await connection.query('DELETE FROM request_limits');
    console.log(`✓ Menghapus data tabel request_limits: ${delLimits.affectedRows} baris`);

    // 9. Hapus user permissions untuk user non-admin
    const [delUserPerms] = await connection.query(`
      DELETE FROM user_permissions 
      WHERE user_id != 'USR-ADMIN01'
    `);
    console.log(`✓ Menghapus data tabel user_permissions non-admin: ${delUserPerms.affectedRows} baris`);

    // 10. Hapus seluruh user KECUALI USR-ADMIN01 / admin@poso.local
    const [delUsers] = await connection.query(`
      DELETE FROM users 
      WHERE user_id != 'USR-ADMIN01' AND email != 'admin@poso.local'
    `);
    console.log(`✓ Menghapus data tabel users (non-admin): ${delUsers.affectedRows} baris`);

    // 11. Pastikan akun Super Admin ada dan aktif dengan password Admin123!
    const adminPassHash = await hashPassword('Admin123!');
    const [updateAdmin] = await connection.query(`
      UPDATE users 
      SET 
        user_id = 'USR-ADMIN01',
        name = 'Administrator POSO (Super Admin)',
        email = 'admin@poso.local',
        password_hash = ?,
        role = 'ADMIN',
        is_active = 1,
        account_status = 'ACTIVE',
        data_scope = 'GLOBAL',
        region_id = 'REG-PUSAT',
        office_id = 'OFC-PUSAT',
        department = 'Direktorat TI & Operasional',
        role_title = 'Super Administrator POSO',
        position = 'Kepala Pusat Pengendalian Operasi',
        failed_attempts = 0,
        locked_until = NULL,
        password_reset_required = 0,
        mfa_enabled = 0,
        totp_secret = NULL,
        totp_pending_secret = NULL,
        totp_pending_until = NULL,
        totp_last_step = 0,
        mfa_backup_codes = NULL
      WHERE user_id = 'USR-ADMIN01' OR email = 'admin@poso.local'
    `, [adminPassHash]);
    console.log(`✓ Memastikan status akun admin@poso.local aktif & terkonfigurasi (Password: Admin123!)`);

    // 12. Bersihkan audit logs lama dan tambahkan log inisialisasi sistem bersih
    await connection.query('DELETE FROM audit_logs');
    await connection.query(`
      INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
      VALUES (?, 'USR-ADMIN01', 'Administrator POSO', 'ADMIN', 'SYSTEM_PURGE', 'DATABASE', 'ALL', 'Reset data transaksi & user untuk public launch', 'Pembersihan database berhasil dilaksanakan. Sistem POSO siap digunakan secara publik.')
    `, [`LOG-${Date.now().toString().slice(-6)}`]);
    console.log(`✓ Membersihkan audit_logs dan mencatat inisialisasi reset sistem.`);

    await connection.commit();
    console.log('\n====================================================');
    console.log('PEMBERSIHAN DATABASE BERHASIL 100%!');
    console.log('====================================================\n');

    // Tampilkan ringkasan isi tabel saat ini
    const [usersRows] = await pool.query('SELECT user_id, email, name, role, account_status FROM users');
    const [ticketsCount] = await pool.query('SELECT COUNT(*) AS total FROM tickets');
    const [threadsCount] = await pool.query('SELECT COUNT(*) AS total FROM threads');
    const [reopenCount] = await pool.query('SELECT COUNT(*) AS total FROM ticket_reopen_requests');
    const [approvalsCount] = await pool.query('SELECT COUNT(*) AS total FROM registration_approvals');
    const [sessionsCount] = await pool.query('SELECT COUNT(*) AS total FROM login_sessions');
    const [auditCount] = await pool.query('SELECT COUNT(*) AS total FROM audit_logs');
    const [regionsCount] = await pool.query('SELECT COUNT(*) AS total FROM regions');
    const [officesCount] = await pool.query('SELECT COUNT(*) AS total FROM offices');

    console.log('Status Terkini Database:');
    console.log(`- Total Users   : ${usersRows.length} (Hanya Admin)`);
    console.log(`- Total Tickets : ${ticketsCount[0].total}`);
    console.log(`- Total Threads : ${threadsCount[0].total}`);
    console.log(`- Total Reopen  : ${reopenCount[0].total}`);
    console.log(`- Total Approvals: ${approvalsCount[0].total}`);
    console.log(`- Total Sessions: ${sessionsCount[0].total}`);
    console.log(`- Total Audit Logs: ${auditCount[0].total}`);
    console.log(`- Total Regions : ${regionsCount[0].total} (Master tetap utuh)`);
    console.log(`- Total Offices : ${officesCount[0].total} (Master tetap utuh)`);
    console.log('\nAkun Pengguna Tersisa:');
    console.table(usersRows);

  } catch (err) {
    await connection.rollback();
    console.error('Pembersihan gagal, transaksi dibatalkan:', err);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

purgeData();
