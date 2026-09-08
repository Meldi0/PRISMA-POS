import { pool } from '../config/db.js';
import { hashPassword } from '../utils/auth.js';
import { resolveUserPermissions } from '../utils/permissions.js';

/**
 * Get all users with organizational & security metadata
 */
export async function getUsers(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT 
        u.user_id, u.name, u.email, u.role, u.is_active, u.account_status,
        u.data_scope, u.region_id, u.office_id, u.position, u.mfa_enabled,
        u.failed_attempts, u.locked_until, u.last_login_at, u.password_plain,
        u.nip, u.department, u.role_title, u.created_by, u.created_at, u.updated_at,
        r.name AS region_name, r.code AS region_code,
        o.name AS office_name, o.code AS office_code, o.code AS nopen_kc
      FROM users u
      LEFT JOIN regions r ON u.region_id = r.region_id
      LEFT JOIN offices o ON u.office_id = o.office_id
      ORDER BY u.created_at DESC`
    );

    const formatted = rows.map(u => ({
      ...u,
      is_active: Boolean(u.is_active),
      mfa_enabled: Boolean(u.mfa_enabled)
    }));

    return res.status(200).json({
      status: 'success',
      data: formatted
    });
  } catch (err) {
    console.error('Error in getUsers:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memuat daftar pengguna.'
    });
  }
}

/**
 * Create new user by Admin Pusat
 */
export async function createUser(req, res) {
  try {
    const adminUser = req.user;
    const {
      name,
      email,
      password = 'PosoDefault123!',
      role = 'PELAPOR',
      account_status = 'ACTIVE',
      data_scope,
      region_id,
      office_id,
      position,
      upt_unit,
      nip,
      department,
      phone_number
    } = req.body;

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanName || !cleanEmail) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Nama lengkap dan email wajib diisi.'
      });
    }

    const [existing] = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = ? LIMIT 1', [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        code: 409,
        message: 'Email sudah terdaftar dalam sistem.'
      });
    }

    const userId = `USR-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    const hashedPassword = await hashPassword(password);
    const assignedScope = data_scope || (
      role === 'ADMIN' || role === 'PETUGAS_UPT' || role === 'ADMIN_PUSAT' || role === 'OPERATOR'
        ? 'GLOBAL'
        : 'OFFICE'
    );

    await pool.query(`
      INSERT INTO users (
        user_id, name, email, password_hash, password_plain, role, is_active,
        account_status, region_id, office_id, data_scope, position,
        nip, department, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId, cleanName, cleanEmail, hashedPassword, password.trim(), role,
      account_status === 'ACTIVE' ? 1 : 0, account_status, region_id || null,
      office_id || null, assignedScope, position || null,
      nip || null, department || null,
      adminUser ? adminUser.email : 'admin@poso.local'
    ]);

    // Audit log
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'CREATE_USER', 'USER', ?, ?, ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, adminUser ? adminUser.user_id : 'ADMIN',
        adminUser ? adminUser.name : 'Administrator', adminUser ? adminUser.role : 'ADMIN',
        userId, `Role: ${role}, Scope: ${assignedScope}`,
        `Admin membuat akun baru: ${cleanEmail} (${cleanName})`
      ]);
    } catch (e) {}

    const [newUser] = await pool.query('SELECT * FROM users WHERE user_id = ?', [userId]);

    return res.status(201).json({
      status: 'success',
      code: 201,
      message: 'Pengguna baru berhasil ditambahkan.',
      data: newUser[0]
    });
  } catch (err) {
    console.error('Error in createUser:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal membuat pengguna baru.'
    });
  }
}

/**
 * Update user role, scope, status, or reset password
 */
export async function updateUserRole(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params;
    const {
      name,
      new_role,
      role,
      data_scope,
      region_id,
      office_id,
      position,
      account_status,
      is_active,
      reset_password
    } = req.body;

    const [existing] = await pool.query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    const curr = existing[0];
    const targetRole = new_role || role;

    // Protection for Super Admin: other users cannot demote primary admin
    if (curr.user_id === 'USR-ADMIN01' && targetRole && targetRole !== 'ADMIN_PUSAT' && targetRole !== 'admin') {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: 'Akun Super Administrator Utama tidak dapat diubah rolenya.'
      });
    }

    const updates = [];
    const params = [];
    const changeLogs = [];

    if (name && name !== curr.name) {
      updates.push('name = ?');
      params.push(name.trim());
      changeLogs.push(`Nama: ${curr.name} -> ${name.trim()}`);
    }

    if (targetRole && targetRole !== curr.role) {
      updates.push('role = ?');
      params.push(targetRole);
      changeLogs.push(`Role: ${curr.role} -> ${targetRole}`);
    }

    if (data_scope && data_scope !== curr.data_scope) {
      updates.push('data_scope = ?');
      params.push(data_scope);
      changeLogs.push(`Scope: ${curr.data_scope} -> ${data_scope}`);
    }

    if (region_id !== undefined && region_id !== curr.region_id) {
      updates.push('region_id = ?');
      params.push(region_id || null);
      changeLogs.push(`Region: ${curr.region_id || 'None'} -> ${region_id || 'None'}`);
    }

    if (office_id !== undefined && office_id !== curr.office_id) {
      updates.push('office_id = ?');
      params.push(office_id || null);
      changeLogs.push(`Office: ${curr.office_id || 'None'} -> ${office_id || 'None'}`);
    }

    if (position !== undefined && position !== curr.position) {
      updates.push('position = ?');
      params.push(position || null);
    }

    if (account_status && account_status !== curr.account_status) {
      updates.push('account_status = ?');
      params.push(account_status);
      updates.push('is_active = ?');
      params.push(account_status === 'ACTIVE' ? 1 : 0);
      changeLogs.push(`Status: ${curr.account_status} -> ${account_status}`);
    } else if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
      if (!is_active && curr.account_status === 'ACTIVE') {
        updates.push("account_status = 'INACTIVE'");
      }
    }

    if (reset_password) {
      const hashedPassword = await hashPassword(reset_password);
      updates.push('password_hash = ?');
      params.push(hashedPassword);
      updates.push('password_plain = ?');
      params.push(reset_password.trim());
      changeLogs.push('Password di-reset');
    }

    if (updates.length > 0) {
      await pool.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
        [...params, id]
      );

      try {
        await pool.query(`
          INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
          VALUES (?, ?, ?, ?, 'UPDATE_USER', 'USER', ?, ?, ?)
        `, [
          `LOG-${Date.now().toString().slice(-6)}`, adminUser ? adminUser.user_id : 'ADMIN',
          adminUser ? adminUser.name : 'Administrator', adminUser ? adminUser.role : 'ADMIN_PUSAT',
          curr.user_id, changeLogs.join('; '),
          `Perubahan data user ${curr.email}: ${changeLogs.join('; ')}`
        ]);
      } catch (e) {}
    }

    const [updated] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Data pengguna berhasil diperbarui.',
      data: updated[0]
    });
  } catch (err) {
    console.error('Error in updateUserRole:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memperbarui data pengguna.'
    });
  }
}

/**
 * Get effective granular permissions for a specific user
 */
export async function getUserPermissions(req, res) {
  try {
    const { id } = req.params;

    const [uRows] = await pool.query('SELECT user_id, name, email, role FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (uRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'User tidak ditemukan.' });
    }

    const user = uRows[0];
    const resolution = await resolveUserPermissions(user.user_id, user.role);

    return res.status(200).json({
      status: 'success',
      data: {
        user,
        permissions: resolution.permissions,
        allowedCodes: resolution.allowedCodes
      }
    });
  } catch (err) {
    console.error('Error in getUserPermissions:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal mengambil permissions user.' });
  }
}

/**
 * Update user-specific permission overrides (ALLOW / DENY / INHERIT)
 */
export async function updateUserPermissions(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params;
    const { overrides } = req.body; // Array of { permission_id, effect: 'ALLOW' | 'DENY' | 'INHERIT' }

    if (!Array.isArray(overrides)) {
      return res.status(400).json({ status: 'error', code: 400, message: 'Format overrides harus berupa array.' });
    }

    const [uRows] = await pool.query('SELECT user_id, name, email, role FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (uRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'User tidak ditemukan.' });
    }

    const targetUser = uRows[0];
    let changesCount = 0;

    for (const ov of overrides) {
      const { permission_id, effect } = ov;
      if (!permission_id) continue;

      if (effect === 'INHERIT') {
        // Hapus override agar kembali ke role baseline
        await pool.query('DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?', [targetUser.user_id, permission_id]);
        changesCount++;
      } else if (effect === 'ALLOW' || effect === 'DENY') {
        await pool.query(`
          INSERT INTO user_permissions (user_id, permission_id, effect, granted_by)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by), updated_at = NOW()
        `, [targetUser.user_id, permission_id, effect, adminUser.user_id]);
        changesCount++;
      }
    }

    // Audit log
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'MANAGE_PERMISSION', 'PERMISSION', ?, ?, ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, adminUser.user_id, adminUser.name, adminUser.role,
        targetUser.user_id, `${changesCount} permission diubah`,
        `Admin mengubah hak akses khusus untuk ${targetUser.email} (${changesCount} items)`
      ]);
    } catch (e) {}

    const updatedResolution = await resolveUserPermissions(targetUser.user_id, targetUser.role);

    return res.status(200).json({
      status: 'success',
      message: `Hak akses pengguna berhasil disimpan (${changesCount} perubahan diterapkan).`,
      data: updatedResolution
    });
  } catch (err) {
    console.error('Error in updateUserPermissions:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal menyimpan permission pengguna.' });
  }
}

/**
 * Suspend user account
 */
export async function suspendUser(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params;

    const [uRows] = await pool.query('SELECT user_id, name, email, role FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (uRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'Pengguna tidak ditemukan.' });
    }

    const target = uRows[0];
    if (target.user_id === 'USR-ADMIN01') {
      return res.status(403).json({ status: 'error', code: 403, message: 'Super Admin Utama tidak dapat di-suspend.' });
    }

    await pool.query("UPDATE users SET account_status = 'SUSPENDED', is_active = 0 WHERE user_id = ?", [id]);

    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'SUSPEND_USER', 'USER', ?, 'Akun dibekukan', 'Admin membekukan akses akun pengguna')
      `, [`LOG-${Date.now().toString().slice(-6)}`, adminUser.user_id, adminUser.name, adminUser.role, id]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: `Akun ${target.name} (${target.email}) telah dibekukan (SUSPENDED).`
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal membekukan akun.' });
  }
}

/**
 * Activate user account
 */
export async function activateUser(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params;

    const [uRows] = await pool.query('SELECT user_id, name, email FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (uRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'Pengguna tidak ditemukan.' });
    }

    const target = uRows[0];

    await pool.query("UPDATE users SET account_status = 'ACTIVE', is_active = 1, failed_attempts = 0, locked_until = NULL WHERE user_id = ?", [id]);

    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'ACTIVATE_USER', 'USER', ?, 'Akun diaktifkan kembali', 'Admin mengaktifkan kembali akun pengguna')
      `, [`LOG-${Date.now().toString().slice(-6)}`, adminUser.user_id, adminUser.name, adminUser.role, id]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: `Akun ${target.name} (${target.email}) berhasil diaktifkan kembali.`
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal mengaktifkan akun.' });
  }
}

/**
 * Reset User MFA by Admin Pusat
 */
export async function resetUserMfa(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params;

    const [uRows] = await pool.query('SELECT user_id, name, email FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (uRows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'Pengguna tidak ditemukan.' });
    }

    const target = uRows[0];

    // Reset MFA on users and delete challenges
    await pool.query('UPDATE users SET mfa_enabled = 0 WHERE user_id = ?', [id]);
    await pool.query('DELETE FROM mfa_challenges WHERE user_id = ?', [id]);

    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'MFA_RESET', 'SECURITY', ?, 'MFA direset oleh Admin', 'Admin Pusat mereset konfigurasi MFA pengguna')
      `, [`LOG-${Date.now().toString().slice(-6)}`, adminUser.user_id, adminUser.name, adminUser.role, id]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: `MFA untuk akun ${target.name} (${target.email}) berhasil di-reset. Pengguna dapat login tanpa MFA atau melakukan setup ulang.`
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal mereset MFA pengguna.' });
  }
}

/**
 * Delete user permanently
 */
export async function deleteUser(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Pengguna tidak ditemukan.'
      });
    }

    const targetUser = existing[0];

    // Protection for Super Admin
    if (targetUser.email === 'admin@poso.local' || targetUser.user_id === 'USR-ADMIN01') {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: 'Akun Super Administrator Utama dilindungi dan tidak dapat dihapus.'
      });
    }

    await pool.query('DELETE FROM users WHERE user_id = ?', [id]);

    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'DELETE_USER', 'USER', ?, 'Hapus akun permanen', ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, adminUser ? adminUser.user_id : 'ADMIN',
        adminUser ? adminUser.name : 'Administrator', adminUser ? adminUser.role : 'ADMIN_PUSAT',
        targetUser.user_id, `Hapus akun ${targetUser.name} (${targetUser.email})`
      ]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: `Akun ${targetUser.name} (${targetUser.email}) berhasil dihapus permanen dari database.`
    });
  } catch (err) {
    console.error('Error in deleteUser:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal menghapus pengguna.'
    });
  }
}

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
