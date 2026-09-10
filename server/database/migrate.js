import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { pool } from '../config/db.js';
import { hardenDatabase } from './harden.js';
import { seedRegions, seedOffices, seedRoles, seedPermissions } from './catalog.js';

export async function runMigration() {
  const schema = await fs.readFile(new URL('../../schema.sql', import.meta.url), 'utf8');
  for (const statement of schema.split(';').map(value=>value.trim()).filter(Boolean)) await pool.query(statement);
  await hardenDatabase();
  for (const r of seedRegions) await pool.query('INSERT IGNORE INTO regions (region_id,code,name,description) VALUES (?,?,?,?)',[r.region_id,r.code,r.name,r.description]);
  for (const o of seedOffices) await pool.query('INSERT IGNORE INTO offices (office_id,region_id,code,name,type,address) VALUES (?,?,?,?,?,?)',[o.office_id,o.region_id,o.code,o.name,o.type,o.address]);
  for (const r of seedRoles) await pool.query('INSERT IGNORE INTO roles (role_code,name,description,default_scope) VALUES (?,?,?,?)',[r.role_code,r.name,r.description,r.default_scope]);
  for (const p of seedPermissions) await pool.query('INSERT IGNORE INTO permissions (code,name,module,action,description) VALUES (?,?,?,?,?)',[p.code,p.name,p.module,p.action,p.desc]);
  const [permissions] = await pool.query('SELECT id,code FROM permissions');
  const staff = ['dashboard.view','ticket.view','ticket.create','ticket.update','ticket.reply','ticket.assign','ticket.claim','ticket.change_status','ticket.change_priority','ticket.triage','ticket.request_info','ticket.resolve','ticket.reopen','ticket.close','ticket.export','monitoring.view','analytics.view','sla.view'];
  const reporter = ['dashboard.view','ticket.create','ticket.view_own','ticket.reply_own'];
  for (const role of ['ADMIN','PETUGAS_UPT','UPT_LUAR']) for (const permission of permissions) {
    const effect = role === 'ADMIN' || (role === 'PETUGAS_UPT' ? staff : reporter).includes(permission.code) ? 'ALLOW' : 'DENY';
    await pool.query('INSERT IGNORE INTO role_permissions (role_code,permission_id,effect) VALUES (?,?,?)',[role,permission.id,effect]);
  }
  console.log('Skema dan katalog terverifikasi. Akun, izin khusus, serta tiket existing tidak di-reset.');
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runMigration(); } catch(error) { console.error('Migrasi gagal:',error.code || error.message); process.exitCode=1; }
  finally { await pool.end(); }
}

