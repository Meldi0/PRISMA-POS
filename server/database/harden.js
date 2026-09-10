import { pathToFileURL } from 'node:url';
import { pool } from '../config/db.js';

// Versioned, repeatable migration. Never seeds users or resets business records.
export async function hardenDatabase(db = pool) {
  const conn = await db.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(80) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const [[lock]] = await conn.query("SELECT GET_LOCK('prisma-security-migration', 30) AS acquired");
    if (!lock.acquired) throw new Error('Migrasi lain sedang berjalan.');
    const add = async (table, field, definition) => {
      const [columns] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [field]);
      if (!columns.length) await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${field}\` ${definition}`);
    };
    for (const [field, definition] of Object.entries({
      password_reset_required: 'TINYINT NOT NULL DEFAULT 0',
      totp_secret: 'TEXT NULL', totp_pending_secret: 'TEXT NULL', totp_pending_until: 'DATETIME NULL',
      totp_last_step: 'BIGINT NOT NULL DEFAULT 0', mfa_backup_codes: 'JSON NULL'
    })) await add('users', field, definition);
    for (const [field, definition] of Object.entries({
      otp_code: 'VARCHAR(10) NULL',
      otp_hash: 'VARCHAR(64) NULL', remember_me: 'TINYINT NOT NULL DEFAULT 0', method: "VARCHAR(10) NOT NULL DEFAULT 'email'",
      purpose: "VARCHAR(20) NOT NULL DEFAULT 'login'", last_sent_at: 'DATETIME NULL', resend_count: 'INT NOT NULL DEFAULT 0'
    })) await add('mfa_challenges', field, definition);
    await add('tickets', 'requester_id', 'VARCHAR(50) NULL');
    await add('tickets', 'version', 'INT NOT NULL DEFAULT 1');
    await add('tickets', 'resolved_at', 'DATETIME NULL');
    await add('tickets', 'idempotency_key', 'VARCHAR(64) NULL');
    await add('threads', 'idempotency_key', 'VARCHAR(64) NULL');
    const [[statusColumn]] = await conn.query("SHOW COLUMNS FROM tickets LIKE 'status'");
    if (!statusColumn.Type.includes("'resolved'")) await conn.query("ALTER TABLE tickets MODIFY status ENUM('open','in_progress','waiting','resolved','closed') NOT NULL DEFAULT 'open'");
    for (const [table, name, cols, unique] of [
      ['tickets', 'idx_ticket_scope_created', 'office_id, created_at', false],
      ['tickets', 'idx_ticket_requester_created', 'requester_id, created_at', false],
      ['tickets', 'idx_ticket_status_created', 'status, created_at', false],
      ['tickets', 'uk_ticket_request', 'requester_id, idempotency_key', true],
      ['threads', 'uk_thread_request', 'ticket_id, sender_id, idempotency_key', true],
      ['login_sessions', 'idx_sessions_expiry', 'expires_at, is_revoked', false]
    ]) {
      const [indexes] = await conn.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [name]);
      if (!indexes.length) await conn.query(`ALTER TABLE \`${table}\` ADD ${unique ? 'UNIQUE' : ''} INDEX \`${name}\` (${cols})`);
    }
    await conn.query(`CREATE TABLE IF NOT EXISTS request_limits (bucket VARCHAR(64) PRIMARY KEY, hits INT NOT NULL, expires_at DATETIME NOT NULL, INDEX idx_limit_expiry (expires_at))`);
    await conn.query(`CREATE TABLE IF NOT EXISTS trusted_devices (
      device_id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      device_token_hash VARCHAR(64) NOT NULL,
      device_name VARCHAR(255) NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(1000) NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_trusted_user (user_id),
      INDEX idx_trusted_token (device_token_hash),
      INDEX idx_trusted_expiry (expires_at)
    )`);
    const [done] = await conn.query("SELECT version FROM schema_migrations WHERE version = '20260910-security-v1'");
    if (!done.length) {
      await conn.beginTransaction();
      try {
        // Preserve bcrypt hashes and identities; remove only the unsafe plaintext copy.
        const [plain] = await conn.query("SHOW COLUMNS FROM users LIKE 'password_plain'");
        if (plain.length) await conn.query('UPDATE users SET password_reset_required = IF(password_plain IS NOT NULL, 1, password_reset_required), password_plain = NULL');
        await conn.query('UPDATE mfa_challenges SET is_used = 1, otp_code = NULL');
        await conn.query('UPDATE login_sessions SET is_revoked = 1');
        await conn.query(`UPDATE tickets t JOIN users u ON LOWER(t.requester_email) = LOWER(u.email) SET t.requester_id = u.user_id WHERE t.requester_id IS NULL`);
        await conn.query("INSERT INTO schema_migrations (version) VALUES ('20260910-security-v1')");
        await conn.commit();
      } catch (error) { await conn.rollback(); throw error; }
    }
    // Drop the empty plaintext column so future code cannot accidentally reuse it.
    const [plain] = await conn.query("SHOW COLUMNS FROM users LIKE 'password_plain'");
    if (plain.length) await conn.query('ALTER TABLE users DROP COLUMN password_plain');
    console.log('Migrasi keamanan selesai. Data tiket dan hash kata sandi dipertahankan; sesi lama dicabut.');
  } finally {
    await conn.query("SELECT RELEASE_LOCK('prisma-security-migration')").catch(() => {});
    conn.release();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await hardenDatabase(); } catch (error) { console.error('Migrasi gagal:', error.code || error.message); process.exitCode = 1; }
  finally { await pool.end(); }
}
