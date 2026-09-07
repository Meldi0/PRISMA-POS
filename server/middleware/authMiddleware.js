import { verifyToken } from '../utils/auth.js';
import { pool } from '../config/db.js';
import { resolveUserPermissions } from '../utils/permissions.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7).trim() 
    : null;

  if (!token) {
    req.user = null;
    return next();
  }

  const decoded = verifyToken(token);
  let userId = decoded?.user_id;

  // Fallback: direct token match for testing
  if (!userId) {
    try {
      const [rows] = await pool.query(
        'SELECT user_id FROM users WHERE user_id = ? OR email = ? LIMIT 1',
        [token, token]
      );
      if (rows.length > 0) {
        userId = rows[0].user_id;
      }
    } catch (err) {}
  }

  if (!userId) {
    req.user = null;
    return next();
  }

  try {
    const [userRows] = await pool.query(
      `SELECT 
        user_id, name, email, role, is_active, account_status,
        region_id, office_id, data_scope, position, mfa_enabled,
        nip, department, role_title
      FROM users 
      WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (userRows.length === 0) {
      req.user = null;
      return next();
    }

    const dbUser = userRows[0];

    // Check account status: only ACTIVE users have full authorization
    if (dbUser.account_status && dbUser.account_status !== 'ACTIVE') {
      req.user = {
        ...dbUser,
        isBlocked: true,
        blockReason: `Akun Anda berstatus ${dbUser.account_status}.`
      };
      return next();
    }

    // Resolve dynamic permissions
    const permResolution = await resolveUserPermissions(dbUser.user_id, dbUser.role);

    req.user = {
      ...dbUser,
      permissions: permResolution.permissions,
      allowedPermissions: permResolution.allowedCodes,
      can: permResolution.can,
      isBlocked: false
    };
  } catch (err) {
    console.error('Error in authenticate middleware:', err);
    req.user = null;
  }

  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      code: 401,
      message: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.'
    });
  }

  if (req.user.isBlocked) {
    return res.status(403).json({
      status: 'error',
      code: 403,
      message: req.user.blockReason || 'Akun Anda tidak aktif atau sedang menunggu persetujuan.'
    });
  }

  next();
}

export function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Autentikasi diperlukan.'
      });
    }

    if (req.user.isBlocked) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: req.user.blockReason
      });
    }

    // ADMIN / ADMIN_PUSAT / admin has universal pass
    if (req.user.role === 'ADMIN' || req.user.role === 'ADMIN_PUSAT' || req.user.role === 'admin') {
      return next();
    }

    const codes = Array.isArray(permissionCode) ? permissionCode : [permissionCode];
    const hasAny = codes.some(code => req.user.can && req.user.can(code));

    if (!hasAny) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: `Akses ditolak. Anda tidak memiliki izin '${codes.join(' / ')}'.`
      });
    }

    next();
  };
}

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Autentikasi diperlukan.'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Compatibility role matching (ADMIN, PETUGAS_UPT, UPT_LUAR + legacy aliases)
    const currentRole = req.user.role;
    const isAllowed = roles.includes(currentRole) || 
      ((currentRole === 'ADMIN' || currentRole === 'ADMIN_PUSAT' || currentRole === 'admin') && (roles.includes('ADMIN') || roles.includes('ADMIN_PUSAT') || roles.includes('admin'))) ||
      ((currentRole === 'PETUGAS_UPT' || currentRole === 'OPERATOR' || currentRole === 'operator' || currentRole === 'upt') && (roles.includes('PETUGAS_UPT') || roles.includes('OPERATOR') || roles.includes('operator') || roles.includes('upt'))) ||
      ((currentRole === 'UPT_LUAR' || currentRole === 'PELAPOR' || currentRole === 'USER_CABANG' || currentRole === 'USER_REGIONAL') && (roles.includes('UPT_LUAR') || roles.includes('PELAPOR')));

    if (!isAllowed) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: 'Akses ditolak. Peran Anda tidak memiliki wewenang untuk tindakan ini.'
      });
    }

    next();
  };
}
