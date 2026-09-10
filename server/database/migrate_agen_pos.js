import { pool } from '../config/db.js';

async function run() {
  try {
    const [cols1] = await pool.query("SHOW COLUMNS FROM users LIKE 'phone'");
    if (cols1.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL AFTER email");
      console.log("[MIGRATION] Added phone column to users table");
    } else {
      console.log("[MIGRATION] phone column already exists");
    }

    const [cols2] = await pool.query("SHOW COLUMNS FROM users LIKE 'nopen'");
    if (cols2.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN nopen VARCHAR(50) NULL AFTER nip");
      console.log("[MIGRATION] Added nopen column to users table");
    } else {
      console.log("[MIGRATION] nopen column already exists");
    }

    const [cols3] = await pool.query("DESCRIBE users");
    console.log("[MIGRATION] Verified columns:", cols3.map(c => c.Field).filter(f => ['phone', 'nopen', 'nip', 'email'].includes(f)));
  } catch (err) {
    console.error("[MIGRATION ERROR]", err);
  }
  process.exit(0);
}

run();
