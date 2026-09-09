import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

// Load .env from project root
dotenv.config({ path: envPath });

/**
 * Resolve SSL CA configuration
 */
export function resolveSslConfig(isSsl) {
  if (!isSsl) return undefined;

  const possibleCaPaths = [
    process.env.DB_SSL_CA ? path.resolve(process.cwd(), process.env.DB_SSL_CA) : null,
    process.env.DB_SSL_CA ? path.resolve(__dirname, '../../', process.env.DB_SSL_CA) : null,
    path.resolve(__dirname, '../../ca.pem'),
    path.resolve(process.cwd(), 'ca.pem')
  ].filter(Boolean);

  let caContent = null;
  for (const caPath of possibleCaPaths) {
    if (fs.existsSync(caPath)) {
      try {
        caContent = fs.readFileSync(caPath);
        break;
      } catch (err) {
        console.warn(`[DB] Gagal membaca CA cert di ${caPath}:`, err.message);
      }
    }
  }

  if (caContent) {
    return {
      ca: caContent,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true
    };
  }

  return { rejectUnauthorized: false };
}

/**
 * Create a new mysql2 pool instance with given configuration
 */
export function createPoolInstance(config) {
  const isSsl = config.ssl === true || 
                config.ssl === 'true' || 
                config.ssl === 'REQUIRED' || 
                (config.host && String(config.host).includes('aivencloud.com'));

  const sslConfig = resolveSslConfig(isSsl);
  const connLimit = process.env.VERCEL ? 3 : (Number(config.connectionLimit) || 10);

  return mysql.createPool({
    host: config.host,
    port: Number(config.port || (isSsl ? 21970 : 3306)),
    user: config.user,
    password: config.password,
    database: config.database || 'defaultdb',
    waitForConnections: true,
    connectionLimit: connLimit,
    queueLimit: 0,
    ssl: sslConfig,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });
}

/**
 * Get current active database configuration
 */
export function getCurrentDbConfig() {
  const host = process.env.DB_HOST || 'localhost';
  const isAiven = host.includes('aivencloud.com');
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  const isSsl = process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED' || isAiven;

  return {
    host,
    port: Number(process.env.DB_PORT || (isAiven ? 21970 : 3306)),
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'defaultdb',
    ssl: isSsl,
    mode: isLocal ? 'offline' : 'online',
    is_local: isLocal,
    is_online: !isLocal
  };
}

// Initial active pool instance
let currentPool = createPoolInstance({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 21970),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED' || (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com'))
});

/**
 * Dynamic Proxy for pool:
 * Ensures all controllers importing { pool } dynamically execute queries on the currently active pool.
 */
export const pool = new Proxy({}, {
  get(target, prop) {
    if (prop === '_instance') return currentPool;
    const val = currentPool[prop];
    if (typeof val === 'function') {
      return val.bind(currentPool);
    }
    return val;
  }
});

/**
 * Test a database connection with specific configuration parameters
 */
export async function testDbConnection(config = {}) {
  const start = Date.now();
  const host = config.host || process.env.DB_HOST || 'localhost';
  const port = Number(config.port || (host.includes('aivencloud.com') ? 21970 : 3306));
  const user = config.user || process.env.DB_USER || 'root';
  const password = config.password !== undefined ? config.password : (process.env.DB_PASSWORD || '');
  const database = config.database || process.env.DB_NAME || 'defaultdb';
  const isSsl = config.ssl === true || 
                config.ssl === 'true' || 
                config.ssl === 'REQUIRED' || 
                (host && host.includes('aivencloud.com'));

  // If createDbIfNotExists is requested and database is specified, create database first if it doesn't exist
  if (config.createDbIfNotExists && database && !host.includes('aivencloud.com')) {
    let bootstrapConn = null;
    try {
      bootstrapConn = await mysql.createConnection({
        host,
        port,
        user,
        password,
        ssl: resolveSslConfig(isSsl)
      });
      const cleanDb = database.replace(/[`\\]/g, '');
      await bootstrapConn.query(`CREATE DATABASE IF NOT EXISTS \`${cleanDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    } catch (bootstrapErr) {
      console.warn('[DB Config] Notice on create database if not exists:', bootstrapErr.message);
    } finally {
      if (bootstrapConn) await bootstrapConn.end().catch(() => {});
    }
  }

  const testPool = createPoolInstance({
    host,
    port,
    user,
    password,
    database,
    ssl: isSsl,
    connectionLimit: 1
  });

  let connection = null;
  try {
    connection = await testPool.getConnection();
    const [threeRes] = await connection.query('SELECT 1 + 2 AS three, DATABASE() AS current_db, VERSION() AS ver');
    
    // Check tables in this database
    const [tableRows] = await connection.query('SHOW TABLES');
    const tableNames = tableRows.map(r => Object.values(r)[0]);
    const requiredTables = ['users', 'tickets', 'roles', 'permissions'];
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));

    const latency = Date.now() - start;

    return {
      success: true,
      connected: true,
      latency_ms: latency,
      database: threeRes[0]?.current_db || database,
      mysql_version: threeRes[0]?.ver || 'Unknown',
      host,
      port,
      total_tables: tableNames.length,
      has_required_tables: missingTables.length === 0,
      missing_tables: missingTables,
      table_names: tableNames.slice(0, 15)
    };
  } catch (err) {
    return {
      success: false,
      connected: false,
      latency_ms: Date.now() - start,
      code: err.code || 'CONNECTION_ERROR',
      message: err.message || 'Gagal terhubung ke database.',
      host,
      port,
      database
    };
  } finally {
    if (connection) connection.release();
    await testPool.end().catch(() => {});
  }
}

/**
 * Safely persist database environment variables into .env file
 */
export function saveEnvDbConfig(config) {
  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    const updates = {
      DB_HOST: config.host,
      DB_PORT: String(config.port),
      DB_USER: config.user,
      DB_NAME: config.database,
      DB_SSL: String(config.ssl)
    };

    if (config.password !== undefined && config.password !== null && config.password !== '') {
      updates.DB_PASSWORD = config.password;
    }

    let lines = envContent.split('\n');
    const updatedKeys = new Set();

    lines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return line;
      const key = line.substring(0, eqIdx).trim();

      if (key in updates) {
        updatedKeys.add(key);
        return `${key}=${updates[key]}`;
      }
      return line;
    });

    // Append any keys that weren't already present in .env
    for (const [k, v] of Object.entries(updates)) {
      if (!updatedKeys.has(k)) {
        lines.push(`${k}=${v}`);
      }
    }

    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
    return true;
  } catch (err) {
    console.error('[DB Config] Gagal memperbarui file .env:', err);
    return false;
  }
}

/**
 * Switch active database connection pool dynamically (hot-swap)
 */
export async function switchDatabasePool(newConfig) {
  // 1. First test target connection
  const testRes = await testDbConnection(newConfig);
  if (!testRes.success) {
    throw new Error(`Uji koneksi gagal: ${testRes.message} (Kode: ${testRes.code})`);
  }

  // 2. Prepare effective config
  const effectiveConfig = {
    host: newConfig.host,
    port: Number(newConfig.port),
    user: newConfig.user,
    password: newConfig.password !== undefined && newConfig.password !== '' ? newConfig.password : process.env.DB_PASSWORD,
    database: newConfig.database,
    ssl: newConfig.ssl === true || newConfig.ssl === 'true' || newConfig.ssl === 'REQUIRED'
  };

  // 3. Create new pool instance
  const newPool = createPoolInstance(effectiveConfig);

  // 4. Verify connection through new pool
  const conn = await newPool.getConnection();
  conn.release();

  // 5. Swap current pool
  const oldPool = currentPool;
  currentPool = newPool;

  // 6. Gracefully terminate old pool in background
  setTimeout(() => {
    oldPool.end().catch(err => console.warn('[DB Config] Notice closing old pool:', err.message));
  }, 1000);

  // 7. Update process.env runtime variables
  process.env.DB_HOST = effectiveConfig.host;
  process.env.DB_PORT = String(effectiveConfig.port);
  process.env.DB_USER = effectiveConfig.user;
  if (effectiveConfig.password !== undefined && effectiveConfig.password !== '') {
    process.env.DB_PASSWORD = effectiveConfig.password;
  }
  process.env.DB_NAME = effectiveConfig.database;
  process.env.DB_SSL = String(effectiveConfig.ssl);

  // 8. Persist to .env file
  saveEnvDbConfig(effectiveConfig);

  return {
    success: true,
    message: `Koneksi database berhasil dialihkan ke ${effectiveConfig.host}:${effectiveConfig.port} (${effectiveConfig.database})`,
    details: testRes
  };
}

/**
 * Original testConnection function for backward compatibility
 */
export async function testConnection() {
  const connection = await pool.getConnection();
  try {
    const [threeRes] = await connection.query('SELECT 1 + 2 AS three');
    const [dbRes] = await connection.query('SELECT database() AS current_db');
    return {
      connected: true,
      three: threeRes[0].three,
      database: dbRes[0].current_db,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT
    };
  } finally {
    connection.release();
  }
}

export default pool;

