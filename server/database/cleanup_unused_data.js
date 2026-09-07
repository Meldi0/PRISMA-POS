import { pool } from '../config/db.js';

async function runCleanup() {
  console.log('=================================================================');
  console.log('       POSO DATABASE SCHEMA CLEANUP ENGINE                       ');
  console.log('   Removing Unused / Redundant Columns & Legacy Tables           ');
  console.log('=================================================================');

  let connection;
  try {
    connection = await pool.getConnection();

    // ---------------------------------------------------------------------------------------------
    // 1. DROP UNUSED / REDUNDANT COLUMNS FROM `users`
    // ---------------------------------------------------------------------------------------------
    console.log('[1/3] Memeriksa dan menghapus kolom-kolom yang tidak terpakai pada tabel users...');
    
    const columnsToDrop = [
      'upt_unit',
      'avatar_url',
      'jabatan_fungsional',
      'kantor_penempatan',
      'phone_number',
      'nopen_kc',
      'nama_kc',
      'nopen_kcu',
      'nama_kcu',
      'regional_code',
      'regional_name'
    ];

    const [existingCols] = await connection.query('SHOW COLUMNS FROM users');
    const existingColNames = existingCols.map(c => c.Field);

    for (const col of columnsToDrop) {
      if (existingColNames.includes(col)) {
        try {
          await connection.query(`ALTER TABLE users DROP COLUMN \`${col}\``);
          console.log(`   ✓ Kolom users.${col} berhasil dihapus.`);
        } catch (err) {
          console.warn(`   Notice gagal menghapus kolom users.${col}:`, err.message);
        }
      } else {
        console.log(`   - Kolom users.${col} sudah tidak ada (skip).`);
      }
    }

    // ---------------------------------------------------------------------------------------------
    // 2. DROP UNUSED / LEGACY TABLES
    // ---------------------------------------------------------------------------------------------
    console.log('[2/3] Memeriksa dan menghapus tabel-tabel yang tidak terpakai...');

    const tablesToDrop = [
      'system_config',
      'mfa_methods'
    ];

    for (const tbl of tablesToDrop) {
      try {
        await connection.query(`DROP TABLE IF EXISTS \`${tbl}\``);
        console.log(`   ✓ Tabel ${tbl} berhasil dihapus (DROP TABLE).`);
      } catch (err) {
        console.warn(`   Notice gagal menghapus tabel ${tbl}:`, err.message);
      }
    }

    // ---------------------------------------------------------------------------------------------
    // 3. VERIFIKASI AKHIR
    // ---------------------------------------------------------------------------------------------
    console.log('[3/3] Melakukan verifikasi struktur akhir database...');

    const [updatedCols] = await connection.query('SHOW COLUMNS FROM users');
    console.log('   Daftar Kolom users saat ini:');
    console.log('  ', updatedCols.map(c => c.Field).join(', '));

    const [remainingTables] = await connection.query('SHOW TABLES');
    const tableNames = remainingTables.map(t => Object.values(t)[0]);
    console.log('\n   Daftar Tabel Database saat ini:');
    console.log('  ', tableNames.join(', '));

    console.log('\n=================================================================');
    console.log('            PEMBERSIHAN DATABASE BERHASIL SELESAI               ');
    console.log('=================================================================');
    process.exit(0);
  } catch (err) {
    console.error('\nCLEANUP FAILED:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

runCleanup();
