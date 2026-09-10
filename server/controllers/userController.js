import { pool } from '../config/db.js';
import { hashPassword } from '../utils/auth.js';
import { resolveUserPermissions } from '../utils/permissions.js';
import { isAdmin, normalizeRole } from '../utils/access.js';
import { HttpError, id, text, email, password, choice, transaction, audit, endpoint, safeUser } from '../utils/security.js';

export async function validateOrganization(db, regionId, officeId) {
  if (!regionId) throw new HttpError(400, 'Regional wajib dipilih.');
  if (!officeId || !String(officeId).trim()) throw new HttpError(400, 'Kantor penempatan wajib diisi.');
  const [[region]] = await db.query('SELECT region_id FROM regions WHERE region_id = ?', [regionId]);
  if (!region) throw new HttpError(400, 'Regional tidak terdaftar pada sistem.');

  const trimmed = String(officeId).trim();
  const [[existing]] = await db.query(
    'SELECT office_id FROM offices WHERE office_id = ? OR LOWER(name) = LOWER(?) LIMIT 1',
    [trimmed, trimmed]
  );
  if (existing) return existing.office_id;

  const newOfficeId = id('OFF');
  const cleanCode = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'KCP';
  await db.query(
    `INSERT INTO offices (office_id, region_id, name, code, type, address)
     VALUES (?, ?, ?, ?, 'KC', 'Input manual')`,
    [newOfficeId, regionId, trimmed.slice(0, 150), cleanCode + '-' + Math.floor(100 + Math.random() * 900)]
  );
  return newOfficeId;
}
async function revoke(db, userId) {
  await db.query('UPDATE login_sessions SET is_revoked = 1 WHERE user_id = ?', [userId]);
  await db.query('UPDATE mfa_challenges SET is_used = 1 WHERE user_id = ?', [userId]);
}
async function protectAdmin(db, target, nextRole, nextStatus) {
  if (!isAdmin(target) || (normalizeRole(nextRole) === 'ADMIN' && nextStatus === 'ACTIVE')) return;
  const [admins] = await db.query("SELECT user_id FROM users WHERE role IN ('ADMIN','ADMIN_PUSAT','admin') AND account_status = 'ACTIVE' AND is_active = 1 FOR UPDATE");
  if (admins.length <= 1) throw new HttpError(409, 'Minimal satu administrator aktif harus tetap tersedia.');
}
export const getUsers = endpoint(async (req, res) => {
  const [rows] = await pool.query(`SELECT u.*, r.name AS region_name, r.code AS region_code, COALESCE(o.name, u.office_id) AS office_name, o.code AS office_code, o.code AS nopen_kc
    FROM users u LEFT JOIN regions r ON u.region_id = r.region_id LEFT JOIN offices o ON u.office_id = o.office_id ORDER BY u.created_at DESC`);
  res.json({ status: 'success', data: rows.map(user => ({ ...safeUser(user), role: normalizeRole(user.role), is_active: Boolean(user.is_active), mfa_enabled: Boolean(user.totp_secret) })) });
});
export const getOperators = endpoint(async (req, res) => {
  const [rows] = await pool.query("SELECT user_id, name, department, region_id, office_id, data_scope FROM users WHERE role IN ('ADMIN','ADMIN_PUSAT','admin','PETUGAS_UPT','OPERATOR','operator') AND account_status = 'ACTIVE' AND is_active = 1 ORDER BY name");
  res.json({ status: 'success', data: rows });
});
export const createUser = endpoint(async (req, res) => {
  const body = req.body;
  const name = text(body.name, 'Nama', { min: 2, max: 150 });
  const address = email(body.email);
  const hashed = await hashPassword(password(body.password));
  const role = normalizeRole(body.role || 'UPT_LUAR');
  if (!role) throw new HttpError(400, 'Peran tidak valid.');
  const scope = choice(body.data_scope || (role === 'UPT_LUAR' ? 'OFFICE' : 'GLOBAL'), ['OWN','OFFICE','REGIONAL','GLOBAL'], 'Cakupan');
  const status = choice(body.account_status || 'ACTIVE', ['ACTIVE','INACTIVE'], 'Status akun');
  const userId = id('USR');
  const phone = text(body.phone || body.phone_number, 'Nomor HP', { max: 30, optional: true });
  const nopen = text(body.nopen || body.nip, 'ID User / Nopen', { max: 50, optional: true });
  await transaction(pool, async db => {
    const resolvedOfficeId = await validateOrganization(db, body.region_id, body.office_id);
    await db.query(`INSERT INTO users (user_id, name, email, phone, password_hash, role, data_scope, account_status, is_active, region_id, office_id, position, nip, nopen, department, role_title, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, name, address, phone || null, hashed, role, scope, status, status === 'ACTIVE' ? 1 : 0, body.region_id, resolvedOfficeId,
      text(body.position, 'Jabatan / Peran', { max: 100, optional: true }), nopen || null, nopen || null, text(body.department, 'Departemen', { max: 150, optional: true }), text(body.role_title, 'Nama jabatan', { max: 150, optional: true }), req.user.email]);
    await audit(db, req.user, 'CREATE_USER', userId, 'Pengguna dibuat dengan role ' + role);
  });
  const [[user]] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);
  res.status(201).json({ status: 'success', message: 'Pengguna berhasil ditambahkan.', data: safeUser(user) });
});
export const updateUserRole = endpoint(async (req, res) => {
  const body = req.body;
  const targetId = req.params.id;
  const result = await transaction(pool, async db => {
    // Serialize administrator mutations before locking the target to prevent last-admin races.
    await db.query("SELECT user_id FROM users WHERE role IN ('ADMIN','ADMIN_PUSAT','admin') ORDER BY user_id FOR UPDATE");
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ? FOR UPDATE', [targetId]);
    if (!user) throw new HttpError(404, 'Pengguna tidak ditemukan.');
    const role = normalizeRole(body.new_role || body.role || user.role);
    if (!role) throw new HttpError(400, 'Peran tidak valid.');
    const status = choice(body.account_status || (body.is_active === false ? 'INACTIVE' : body.is_active === true ? 'ACTIVE' : user.account_status), ['ACTIVE','INACTIVE','SUSPENDED','PENDING','REJECTED'], 'Status akun');
    if (['PENDING','REJECTED'].includes(user.account_status) && status === 'ACTIVE') throw new HttpError(409, 'Aktivasi pendaftaran harus melalui menu Persetujuan Akun.');
    await protectAdmin(db, user, role, status);
    const region = body.region_id === undefined ? user.region_id : body.region_id;
    const office = body.office_id === undefined ? user.office_id : body.office_id;
    const resolvedOfficeId = office ? await validateOrganization(db, region, office) : user.office_id;
    const updates = { role, account_status: status, is_active: status === 'ACTIVE' ? 1 : 0, region_id: region, office_id: resolvedOfficeId };
    if (body.data_scope) updates.data_scope = choice(body.data_scope, ['GLOBAL','REGIONAL','OFFICE','OWN'], 'Cakupan');
    for (const [key,max] of [['name',150],['position',100],['nip',50],['nopen',50],['phone',30],['department',150],['role_title',150]]) {
      if (body[key] !== undefined) updates[key] = text(body[key], key, { max, optional: key !== 'name' });
    }
    if (updates.nopen && !updates.nip) updates.nip = updates.nopen;
    if (updates.nip && !updates.nopen) updates.nopen = updates.nip;
    if (body.reset_password) updates.password_hash = await hashPassword(password(body.reset_password));
    await db.query('UPDATE users SET ' + Object.keys(updates).map(key => key + ' = ?').join(', ') + ', updated_at = NOW() WHERE user_id = ?', [...Object.values(updates), targetId]);
    if (body.reset_password || role !== normalizeRole(user.role) || status !== user.account_status || body.data_scope || region !== user.region_id || office !== user.office_id) await revoke(db, targetId);
    await audit(db, req.user, 'UPDATE_USER', targetId, 'Data atau akses pengguna diperbarui');
    return safeUser({ ...user, ...updates });
  });
  res.json({ status: 'success', message: 'Data pengguna diperbarui.', data: result });
});
export const getUserPermissions = endpoint(async (req, res) => {
  const [[user]] = await pool.query('SELECT user_id, name, email, role FROM users WHERE user_id = ?', [req.params.id]);
  if (!user) throw new HttpError(404, 'Pengguna tidak ditemukan.');
  res.json({ status: 'success', data: { user, ...await resolveUserPermissions(user.user_id, user.role) } });
});
export const updateUserPermissions = endpoint(async (req, res) => {
  const overrides = req.body.overrides;
  if (!Array.isArray(overrides) || overrides.length > 200) throw new HttpError(400, 'Daftar izin tidak valid.');
  await transaction(pool, async db => {
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ? FOR UPDATE', [req.params.id]);
    if (!user) throw new HttpError(404, 'Pengguna tidak ditemukan.');
    if (isAdmin(user)) throw new HttpError(409, 'Administrator selalu memiliki akses penuh. Ubah peran terlebih dahulu untuk membatasi akses.');
    for (const item of overrides) {
      if (!Number.isSafeInteger(item.permission_id)) throw new HttpError(400, 'ID izin tidak valid.');
      choice(item.effect, ['INHERIT','ALLOW','DENY'], 'Efek izin');
      if (item.effect === 'INHERIT') await db.query('DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?', [user.user_id, item.permission_id]);
      else await db.query(`INSERT INTO user_permissions (user_id, permission_id, effect, granted_by) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by)`, [user.user_id, item.permission_id, item.effect, req.user.user_id]);
    }
    await revoke(db, user.user_id);
    await audit(db, req.user, 'MANAGE_PERMISSION', user.user_id, 'Izin pengguna diperbarui; sesi lama diakhiri');
  });
  res.json({ status: 'success', message: 'Hak akses disimpan. Pengguna perlu masuk kembali.' });
});
export const suspendUser = (req,res,next) => { req.body = { account_status: 'SUSPENDED' }; return updateUserRole(req,res,next); };
export const activateUser = (req,res,next) => { req.body = { account_status: 'ACTIVE' }; return updateUserRole(req,res,next); };
export const deleteUser = (req,res,next) => { req.body = { account_status: 'INACTIVE' }; return updateUserRole(req,res,next); };
export const resetUserMfa = endpoint(async (req, res) => {
  await transaction(pool, async db => {
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ? FOR UPDATE', [req.params.id]);
    if (!user) throw new HttpError(404, 'Pengguna tidak ditemukan.');
    await db.query('UPDATE users SET totp_secret = NULL, totp_pending_secret = NULL, mfa_backup_codes = NULL, totp_last_step = 0, mfa_enabled = 0 WHERE user_id = ?', [user.user_id]);
    await revoke(db, user.user_id);
    await audit(db, req.user, 'MFA_RESET', user.user_id, 'Authenticator direset; login berikutnya tetap memerlukan OTP email');
  });
  res.json({ status: 'success', message: 'Authenticator direset. Pengguna tetap wajib memverifikasi OTP email.' });
});
/**
 * Get Master Regions
 */
export async function getRegions(req, res) {
  try {
    const [rows] = await pool.query('SELECT region_id, code, name, description FROM regions ORDER BY code ASC');
    return res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal memuat master regional.' });
  }
}

/**
 * Get Master Offices
 */
export async function getOffices(req, res) {
  try {
    const { region_id } = req.query;
    let query = 'SELECT office_id, region_id, code, name, type, address FROM offices';
    const params = [];

    if (region_id) {
      query += ' WHERE region_id = ?';
      params.push(region_id);
    }
    query += ' ORDER BY type, name ASC';

    const [rows] = await pool.query(query, params);
    return res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal memuat master kantor pos.' });
  }
}

/**
 * Get Official System Roles (ADMIN_PUSAT, OPERATOR, PELAPOR)
 */
export async function getRoles(req, res) {
  try {
    const [rows] = await pool.query('SELECT role_code, name, description, default_scope FROM roles ORDER BY role_code ASC');
    return res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal memuat daftar role resmi.' });
  }
}
