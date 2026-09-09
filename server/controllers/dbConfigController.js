import { 
  getCurrentDbConfig, 
  testDbConnection, 
  switchDatabasePool, 
  pool 
} from '../config/db.js';
import { runMigration } from '../database/migrate.js';

/**
 * GET /api/admin/db-config
 * Mengambil konfigurasi database aktif dan preset (Online vs Offline)
 */
export async function getDbConfig(req, res) {
  try {
    const current = getCurrentDbConfig();

    // Default presets for quick one-click switching
    const presets = {
      online: {
        id: 'online',
        label: 'Mode Online (Cloud Aiven MySQL)',
        host: 'mysql-1810b125-nugrahaeldi123-5f2b.f.aivencloud.com',
        port: 21970,
        user: 'avnadmin',
        database: 'defaultdb',
        ssl: true,
        note: 'Klaster cloud MySQL Aiven terenkripsi TLS 1.3 dengan single source of truth online.'
      },
      offline: {
        id: 'offline',
        label: 'Mode Offline (Localhost / XAMPP / MariaDB)',
        host: 'localhost',
        port: 3306,
        user: 'root',
        database: 'poso_helpdesk',
        ssl: false,
        note: 'Server MySQL lokal di komputer Anda (port standar 3306, tanpa SSL). Cocok untuk intranet & offline.'
      }
    };

    return res.status(200).json({
      status: 'success',
      data: {
        current: {
          ...current,
          has_password: Boolean(process.env.DB_PASSWORD),
          password_masked: process.env.DB_PASSWORD ? '••••••••••••••••' : ''
        },
        presets
      }
    });
  } catch (err) {
    console.error('[DB Config] Error in getDbConfig:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal mengambil konfigurasi database.'
    });
  }
}

/**
 * POST /api/admin/db-config/test
 * Menguji parameter koneksi database target tanpa mengubah database aktif
 */
export async function testDbConfig(req, res) {
  try {
    const { host, port, user, password, database, ssl, createDbIfNotExists } = req.body || {};

    if (!host) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Host database wajib diisi.'
      });
    }

    const testResult = await testDbConnection({
      host: host.trim(),
      port: Number(port || 3306),
      user: (user || 'root').trim(),
      password: password !== undefined ? password : process.env.DB_PASSWORD,
      database: (database || 'defaultdb').trim(),
      ssl: Boolean(ssl),
      createDbIfNotExists: Boolean(createDbIfNotExists)
    });

    if (testResult.success) {
      return res.status(200).json({
        status: 'success',
        message: `Koneksi berhasil terhubung! (Latensi: ${testResult.latency_ms}ms)`,
        data: testResult
      });
    } else {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: `Uji koneksi gagal: ${testResult.message}`,
        data: testResult
      });
    }
  } catch (err) {
    console.error('[DB Config] Error in testDbConfig:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: `Terjadi kesalahan saat menguji koneksi: ${err.message}`
    });
  }
}

/**
 * POST /api/admin/db-config/save
 * Menyimpan konfigurasi baru ke .env dan langsung beralih ke database baru (hot-swap)
 */
export async function saveDbConfig(req, res) {
  try {
    const { host, port, user, password, database, ssl, createDbIfNotExists } = req.body || {};

    if (!host) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Host database wajib diisi.'
      });
    }

    const newConfig = {
      host: host.trim(),
      port: Number(port || 3306),
      user: (user || 'root').trim(),
      password: password !== undefined && password !== '' ? password : process.env.DB_PASSWORD,
      database: (database || 'defaultdb').trim(),
      ssl: Boolean(ssl),
      createDbIfNotExists: Boolean(createDbIfNotExists)
    };

    const switchResult = await switchDatabasePool(newConfig);

    // Catat log audit atas pergantian database
    try {
      const userActor = req.user;
      const logId = `LOG-DBCONFIG-${Date.now().toString().slice(-6)}`;
      await pool.query(
        `INSERT INTO audit_logs (
          log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description, ip_address
        ) VALUES (?, ?, ?, ?, 'DATABASE_CONFIG_CHANGED', 'SYSTEM', 'DATABASE', ?, ?, ?)`,
        [
          logId,
          userActor ? userActor.user_id : 'SYSTEM',
          userActor ? userActor.name : 'Administrator',
          userActor ? userActor.role : 'ADMIN',
          JSON.stringify({
            host: newConfig.host,
            port: newConfig.port,
            database: newConfig.database,
            ssl: newConfig.ssl
          }),
          `Administrator mengalihkan database aktif ke ${newConfig.host}:${newConfig.port} (${newConfig.database})`,
          req.ip || '127.0.0.1'
        ]
      );
    } catch (auditErr) {
      console.warn('[DB Config] Notice recording audit log on DB switch:', auditErr.message);
    }

    return res.status(200).json({
      status: 'success',
      message: switchResult.message,
      data: switchResult.details
    });
  } catch (err) {
    console.error('[DB Config] Error in saveDbConfig:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: err.message || 'Gagal menyimpan dan menerapkan konfigurasi database baru.'
    });
  }
}

/**
 * POST /api/admin/db-config/migrate
 * Menjalankan migrasi DDL tabel dan seeding akun master pada database yang sedang aktif
 */
export async function migrateDbSchema(req, res) {
  try {
    const userActor = req.user;
    console.log(`[DB Config] Migrasi skema diminta oleh: ${userActor?.name} (${userActor?.email})`);

    await runMigration();

    // Catat log audit
    try {
      const logId = `LOG-MIGRATE-${Date.now().toString().slice(-6)}`;
      await pool.query(
        `INSERT INTO audit_logs (
          log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description, ip_address
        ) VALUES (?, ?, ?, ?, 'DATABASE_MIGRATION_EXECUTED', 'SYSTEM', 'SCHEMA', 'Eksekusi inisialisasi skema tabel & seed user selesai', 'Inisialisasi tabel helpdesk dan data master organisasi melalui Web Admin', ?)`,
        [
          logId,
          userActor ? userActor.user_id : 'SYSTEM',
          userActor ? userActor.name : 'Administrator',
          userActor ? userActor.role : 'ADMIN',
          req.ip || '127.0.0.1'
        ]
      );
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: 'Inisialisasi skema tabel dan seed akun default berhasil dilakukan pada database aktif!'
    });
  } catch (err) {
    console.error('[DB Config] Error in migrateDbSchema:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: `Gagal menjalankan migrasi skema: ${err.message}`
    });
  }
}
