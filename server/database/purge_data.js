import { pool } from '../config/db.js';
import { hashPassword } from '../utils/auth.js';

async function purgeData() {
  console.log('====================================================');
  console.log('MEMULAI PEMBERSIHAN DATABASE POSO (DATA PURGE)');
  console.log('====================================================\n');

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Hapus seluruh riwayat pesan tiket (threads)
    const [delThreads] = await connection.query('DELETE FROM threads');
    console.log(`✓ Menghapus data tabel threads: ${delThreads.affectedRows} baris`);

    // 2. Hapus seluruh data tiket (tickets)
    const [delTickets] = await connection.query('DELETE FROM tickets');
    console.log(`✓ Menghapus data tabel tickets: ${delTickets.affectedRows} baris`);

    // 3. Hapus seluruh antrean pendaftaran (registration_approvals)
    const [delApprovals] = await connection.query('DELETE FROM registration_approvals');
    console.log(`✓ Menghapus data tabel registration_approvals: ${delApprovals.affectedRows} baris`);

    // 4. Hapus seluruh MFA challenge token lama
    const [delMfa] = await connection.query('DELETE FROM mfa_challenges');
    console.log(`✓ Menghapus data tabel mfa_challenges: ${delMfa.affectedRows} baris`);

    // 5. Hapus user permissions untuk user non-admin
    const [delUserPerms] = await connection.query(`
      DELETE FROM user_permissions 
      WHERE user_id NOT IN (SELECT user_id FROM users WHERE email = 'admin@poso.local')
    `);
    console.log(`✓ Menghapus data tabel user_permissions non-admin: ${delUserPerms.affectedRows} baris`);

    // 6. Hapus seluruh user KECUALI admin@poso.local
    const [delUsers] = await connection.query(`
      DELETE FROM users 
      WHERE email != 'admin@poso.local'
    `);
    console.log(`✓ Menghapus data tabel users (non-admin): ${delUsers.affectedRows} baris`);

    // 7. Pastikan akun admin@poso.local dalam keadaan aktif dan password Admin123!
    const adminPassHash = await hashPassword('Admin123!');
    const [updateAdmin] = await connection.query(`
      UPDATE users 
      SET 
        name = 'Administrator POSO (Super Admin)',
        password_hash = ?,
        password_plain = 'Admin123!',
        role = 'ADMIN_PUSAT',
        is_active = 1,
        account_status = 'ACTIVE',
        data_scope = 'GLOBAL',
        region_id = 'REG-00',
        office_id = 'OFC-PUSAT-01',
        department = 'Kantor Pusat PT Pos Indonesia',
        role_title = 'Super Administrator Nasional',
        position = 'Administrator Utama',
        failed_attempts = 0,
        locked_until = NULL
      WHERE email = 'admin@poso.local'
    `, [adminPassHash]);
    console.log(`✓ Memastikan status akun admin@poso.local aktif (Password: Admin123!)`);

    // 8. Bersihkan audit logs lama dan tambahkan log inisialisasi sistem bersih
    await connection.query('DELETE FROM audit_logs');
    await connection.query(`
      INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
      VALUES (?, 'USR-ADMIN01', 'Administrator POSO', 'ADMIN_PUSAT', 'SYSTEM_PURGE', 'DATABASE', 'ALL', 'Reset data transaksi & user non-admin', 'Pembersihan database berhasil dilaksanakan')
    `, [`LOG-${Date.now().toString().slice(-6)}`]);
    console.log(`✓ Membersihkan audit_logs dan mencatat inisialisasi reset sistem.`);

    await connection.commit();
    console.log('\n====================================================');
    console.log('PEMBERSIHAN DATABASE BERHASIL 100%!');
    console.log('====================================================\n');

    // Tampilkan ringkasan isi tabel saat ini
    const [usersCount] = await pool.query('SELECT COUNT(*) AS total FROM users');
    const [ticketsCount] = await pool.query('SELECT COUNT(*) AS total FROM tickets');
    const [threadsCount] = await pool.query('SELECT COUNT(*) AS total FROM threads');
    const [regionsCount] = await pool.query('SELECT COUNT(*) AS total FROM regions');
    const [officesCount] = await pool.query('SELECT COUNT(*) AS total FROM offices');

    console.log('Status Terkini Database:');
    console.log(`- Total Users   : ${usersCount[0].total} (Hanya Admin)`);
    console.log(`- Total Tickets : ${ticketsCount[0].total}`);
    console.log(`- Total Threads : ${threadsCount[0].total}`);
    console.log(`- Total Regions : ${regionsCount[0].total} (Master tetap ada)`);
    console.log(`- Total Offices : ${officesCount[0].total} (Master tetap ada)`);

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
