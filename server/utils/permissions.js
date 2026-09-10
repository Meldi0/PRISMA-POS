import { pool } from '../config/db.js';
import { normalizeRole, scopeFor } from './access.js';

/**
 * Resolve user permissions using the priority:
 * User Override (ALLOW / DENY) > Role Baseline (ALLOW / DENY) > Default Deny
 * 
 * @param {string} userId 
 * @param {string} roleCode 
 * @returns {Promise<{ permissions: Array, allowedCodes: Array<string>, can: (code: string) => boolean }>}
 */
export async function resolveUserPermissions(userId, roleCode) {
  // If ADMIN, ADMIN_PUSAT, or admin, short-circuit or fetch all as ALLOW
  const isSuperAdmin = roleCode === 'ADMIN' || roleCode === 'ADMIN_PUSAT' || roleCode === 'admin';

  // 1. Fetch all permissions catalog
  const [allPermissions] = await pool.query(
    'SELECT id, code, name, module, action, description FROM permissions ORDER BY module, code'
  );

  // 2. Fetch role baseline permissions
  const [rolePerms] = await pool.query(
    'SELECT permission_id, effect FROM role_permissions WHERE role_code = ?',
    [normalizeRole(roleCode) || roleCode]
  );
  const roleMap = {};
  rolePerms.forEach(rp => {
    roleMap[rp.permission_id] = rp.effect;
  });

  // 3. Fetch user overrides
  let userMap = {};
  if (userId) {
    const [userPerms] = await pool.query(
      'SELECT permission_id, effect FROM user_permissions WHERE user_id = ?',
      [userId]
    );
    userPerms.forEach(up => {
      userMap[up.permission_id] = up.effect;
    });
  }

  // 4. Resolve effective permissions
  const effectiveList = [];
  const allowedCodes = [];

  for (const perm of allPermissions) {
    let effect = 'DENY';
    let isOverride = false;

    if (isSuperAdmin) {
      effect = 'ALLOW';
    } else if (userMap[perm.id]) {
      effect = userMap[perm.id];
      isOverride = true;
    } else if (roleMap[perm.id]) {
      effect = roleMap[perm.id];
    }

    if (effect === 'ALLOW') {
      allowedCodes.push(perm.code);
    }

    effectiveList.push({
      id: perm.id,
      code: perm.code,
      name: perm.name,
      module: perm.module,
      action: perm.action,
      description: perm.description,
      effect,
      is_override: isOverride
    });
  }

  return {
    permissions: effectiveList,
    allowedCodes,
    can: (code) => allowedCodes.includes(code)
  };
}

/**
 * Build SQL WHERE conditions based on user's Data Scope
 * 
 * @param {Object} user 
 * @param {string} tableAlias 
 * @returns {{ clause: string, params: Array<any> }}
 */
export function buildDataScopeFilter(user, tableAlias = 'tickets') {
  if (!user || user.isBlocked || !user.is_active || user.account_status !== 'ACTIVE') return { clause: '1=0', params: [] };
  const scope = scopeFor(user);
  if (scope === 'GLOBAL') return { clause: '1=1', params: [] };
  const own = `(${tableAlias}.requester_id = ? OR (${tableAlias}.requester_id IS NULL AND LOWER(${tableAlias}.requester_email) = ?))`;
  const params = [user.user_id, user.email.toLowerCase().trim()];
  if (scope === 'REGIONAL' && user.region_id) return { clause: `(${own} OR ${tableAlias}.region_id = ?)`, params: [...params, user.region_id] };
  if (scope === 'OFFICE' && user.office_id) return { clause: `(${own} OR ${tableAlias}.office_id = ?)`, params: [...params, user.office_id] };
  return { clause: own, params };
}
