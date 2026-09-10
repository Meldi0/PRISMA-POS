import { verifyToken } from '../utils/auth.js';
import { pool } from '../config/db.js';
import { resolveUserPermissions } from '../utils/permissions.js';
import { can, isActive, normalizeRole } from '../utils/access.js';
import { digest } from '../utils/security.js';

export async function authenticate(req, res, next) {
  req.user = null;
  const header = req.headers.authorization;
  if (!header) return next();
  const token = /^Bearer ([^\s]+)$/.exec(header)?.[1];
  const decoded = token && verifyToken(token);
  if (!decoded?.user_id || !decoded?.sid) return res.status(401).json({ status: 'error', code: 401, message: 'Sesi tidak valid. Silakan masuk kembali.' });
  try {
    const [rows] = await pool.query(`SELECT u.user_id, u.name, u.email, u.role, u.is_active, u.account_status,
      u.region_id, u.office_id, u.data_scope, u.position, u.mfa_enabled, u.nip, u.department, u.role_title
      FROM users u JOIN login_sessions s ON s.user_id = u.user_id
      WHERE u.user_id = ? AND s.session_id = ? AND s.token_hash = ? AND s.is_revoked = 0 AND s.expires_at > NOW() LIMIT 1`,
    [decoded.user_id, decoded.sid, digest(token)]);
    if (!rows.length) return res.status(401).json({ status: 'error', code: 401, message: 'Sesi telah berakhir. Silakan masuk kembali.' });
    const user = rows[0];
    if (!isActive(user)) return res.status(403).json({ status: 'error', code: 403, message: 'Akun tidak aktif. Hubungi administrator.' });
    const resolution = await resolveUserPermissions(user.user_id, user.role);
    req.user = { ...user, role: normalizeRole(user.role), can: resolution.can, allowedPermissions: resolution.allowedCodes };
    req.sessionId = decoded.sid;
    next();
  } catch (error) { next(error); }
}
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ status: 'error', code: 401, message: 'Silakan masuk untuk mengakses layanan ini.' });
  if (!isActive(req.user)) return res.status(403).json({ status: 'error', code: 403, message: 'Akun Anda tidak aktif.' });
  next();
}
export function requirePermission(permissions) {
  return (req, res, next) => requireAuth(req, res, () => {
    if (![permissions].flat().some(permission => can(req.user, permission))) return res.status(403).json({ status: 'error', code: 403, message: 'Anda tidak memiliki izin untuk tindakan ini.' });
    next();
  });
}
export function requireRole(roles) {
  return (req, res, next) => requireAuth(req, res, () => {
    if (![roles].flat().map(normalizeRole).filter(Boolean).includes(normalizeRole(req.user.role))) return res.status(403).json({ status: 'error', code: 403, message: 'Tindakan ini hanya tersedia bagi peran yang berwenang.' });
    next();
  });
}
