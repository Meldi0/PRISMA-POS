import { pool } from '../config/db.js';

/**
 * Get all registration approval requests
 */
export async function getApprovals(req, res) {
  try {
    const { status = 'PENDING', search = '' } = req.query;

    let conditions = ['1=1'];
    let params = [];

    if (status && status !== 'all') {
      conditions.push('ra.status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.nip) LIKE ? OR LOWER(o.name) LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereClause = conditions.join(' AND ');

    const [rows] = await pool.query(
      `SELECT 
        ra.approval_id, ra.status AS approval_status, ra.rejection_reason,
        ra.reviewed_at, ra.reviewer_name, ra.created_at AS requested_at,
        u.user_id, u.name, u.email, u.position, u.nip,
        u.role, u.account_status, u.data_scope, u.region_id, u.office_id,
        r.name AS region_name, o.name AS office_name
      FROM registration_approvals ra
      JOIN users u ON ra.user_id = u.user_id
      LEFT JOIN regions r ON u.region_id = r.region_id
      LEFT JOIN offices o ON u.office_id = o.office_id
      WHERE ${whereClause}
      ORDER BY ra.created_at DESC`,
      params
    );

    return res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (err) {
    console.error('Error in getApprovals:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memuat antrean persetujuan pendaftaran.'
    });
  }
}

/**
 * Approve pending user registration
 */
export async function approveRegistration(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params; // user_id or approval_id
    const { role, data_scope, region_id, office_id } = req.body;

    // Find user
    const [uRows] = await pool.query(
      'SELECT * FROM users WHERE user_id = ? OR user_id = (SELECT user_id FROM registration_approvals WHERE approval_id = ? LIMIT 1) LIMIT 1',
      [id, id]
    );

    if (uRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Data permohonan pengguna tidak ditemukan.'
      });
    }

    const targetUser = uRows[0];

    // Determine final role & scope
    const assignedRole = role || targetUser.role || 'PELAPOR';
    const assignedScope = data_scope || targetUser.data_scope || (
      assignedRole === 'ADMIN' || assignedRole === 'PETUGAS_UPT' || assignedRole === 'ADMIN_PUSAT' || assignedRole === 'OPERATOR'
        ? 'GLOBAL'
        : 'OFFICE'
    );
    const assignedRegion = region_id !== undefined ? region_id : targetUser.region_id;
    const assignedOffice = office_id !== undefined ? office_id : targetUser.office_id;

    // 1. Update User to ACTIVE
    await pool.query(`
      UPDATE users SET
        account_status = 'ACTIVE',
        is_active = 1,
        role = ?,
        data_scope = ?,
        region_id = ?,
        office_id = ?,
        updated_at = NOW()
      WHERE user_id = ?
    `, [assignedRole, assignedScope, assignedRegion || null, assignedOffice || null, targetUser.user_id]);

    // 2. Update Registration Approval
    await pool.query(`
      UPDATE registration_approvals SET
        status = 'APPROVED',
        reviewed_by = ?,
        reviewer_name = ?,
        reviewed_at = NOW()
      WHERE user_id = ?
    `, [adminUser.user_id, adminUser.name, targetUser.user_id]);

    // 3. Audit Log
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'APPROVE_USER', 'USER', ?, ?, ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, adminUser.user_id, adminUser.name, adminUser.role,
        targetUser.user_id, `Disetujui role ${assignedRole} scope ${assignedScope}`,
        `Admin menyetujui pendaftaran akun ${targetUser.email} (${targetUser.name})`
      ]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: `Pendaftaran ${targetUser.name} (${targetUser.email}) berhasil disetujui. Akun kini aktif.`
    });
  } catch (err) {
    console.error('Error in approveRegistration:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal menyetujui pendaftaran pengguna.'
    });
  }
}

/**
 * Reject pending user registration with mandatory reason
 */
export async function rejectRegistration(req, res) {
  try {
    const adminUser = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Alasan penolakan wajib diisi secara jelas.'
      });
    }

    const [uRows] = await pool.query(
      'SELECT * FROM users WHERE user_id = ? OR user_id = (SELECT user_id FROM registration_approvals WHERE approval_id = ? LIMIT 1) LIMIT 1',
      [id, id]
    );

    if (uRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 404,
        message: 'Data permohonan pengguna tidak ditemukan.'
      });
    }

    const targetUser = uRows[0];

    // 1. Update User to REJECTED
    await pool.query(`
      UPDATE users SET
        account_status = 'REJECTED',
        is_active = 0,
        updated_at = NOW()
      WHERE user_id = ?
    `, [targetUser.user_id]);

    // 2. Update Registration Approval
    await pool.query(`
      UPDATE registration_approvals SET
        status = 'REJECTED',
        rejection_reason = ?,
        reviewed_by = ?,
        reviewer_name = ?,
        reviewed_at = NOW()
      WHERE user_id = ?
    `, [reason.trim(), adminUser.user_id, adminUser.name, targetUser.user_id]);

    // 3. Audit Log
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'REJECT_USER', 'USER', ?, ?, ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, adminUser.user_id, adminUser.name, adminUser.role,
        targetUser.user_id, `Alasan: ${reason.trim()}`,
        `Admin menolak pendaftaran akun ${targetUser.email}. Alasan: ${reason.trim()}`
      ]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: `Pendaftaran ${targetUser.name} telah ditolak dengan alasan: "${reason.trim()}".`
    });
  } catch (err) {
    console.error('Error in rejectRegistration:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal menolak pendaftaran pengguna.'
    });
  }
}
