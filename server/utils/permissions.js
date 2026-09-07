import { pool } from '../config/db.js';

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
    [roleCode]
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
  if (!user) {
    return { clause: '1=0', params: [] }; // No user = access denied
  }

  const role = user.role;
  const scope = user.data_scope || (
    role === 'ADMIN' || role === 'PETUGAS_UPT' || role === 'ADMIN_PUSAT' || role === 'OPERATOR' || role === 'admin' || role === 'operator'
      ? 'GLOBAL'
      : 'OFFICE'
  );

  // 1. GLOBAL Scope: ADMIN & PETUGAS_UPT (Kantor Pusat) can see and manage all tickets nationally
  if (
    role === 'ADMIN' || 
    role === 'PETUGAS_UPT' || 
    role === 'ADMIN_PUSAT' || 
    role === 'OPERATOR' || 
    role === 'admin' || 
    role === 'operator' || 
    scope === 'GLOBAL'
  ) {
    return { clause: '1=1', params: [] };
  }

  // 2. UPT_LUAR (Office Scope): Sees tickets created by oneself OR coworkers within the same office (office_id)
  if (user.office_id) {
    return {
      clause: `((LOWER(${tableAlias}.requester_email) = ? OR LOWER(${tableAlias}.requester_name) = ?) OR (${tableAlias}.office_id IS NOT NULL AND ${tableAlias}.office_id = ?))`,
      params: [user.email.toLowerCase().trim(), user.name.toLowerCase().trim(), user.office_id]
    };
  }

  // 3. Fallback OWN scope if no office_id is assigned
  return {
    clause: `(LOWER(${tableAlias}.requester_email) = ? OR LOWER(${tableAlias}.requester_name) = ?)`,
    params: [user.email.toLowerCase().trim(), user.name.toLowerCase().trim()]
  };
}
