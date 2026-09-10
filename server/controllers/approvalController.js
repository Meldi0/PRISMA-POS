import { pool } from '../config/db.js';
import { validateOrganization } from './userController.js';
import { normalizeRole } from '../utils/access.js';
import { HttpError, text, choice, transaction, audit, endpoint } from '../utils/security.js';

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
        r.name AS region_name, r.code AS region_code,
        COALESCE(o.name, u.office_id) AS office_name, o.code AS office_code, o.code AS nopen_kc
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

const review = (approved) => endpoint(async (req, res) => {
  const reason = approved ? null : text(req.body.reason, 'Alasan penolakan', { min: 10, max: 2000 });
  await transaction(pool, async db => {
    const [[approval]] = await db.query('SELECT * FROM registration_approvals WHERE approval_id = ? OR user_id = ? ORDER BY created_at DESC LIMIT 1 FOR UPDATE', [req.params.id, req.params.id]);
    if (!approval) throw new HttpError(404, 'Permohonan tidak ditemukan.');
    if (approval.status !== 'PENDING') throw new HttpError(409, 'Permohonan ini sudah diproses.');
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ? FOR UPDATE', [approval.user_id]);
    if (!user || user.account_status !== 'PENDING') throw new HttpError(409, 'Akun tidak sedang menunggu persetujuan.');
    if (approved) {
      const role = normalizeRole(req.body.role || user.role);
      if (!role) throw new HttpError(400, 'Peran tidak valid.');
      const scope = choice(req.body.data_scope || user.data_scope, ['OWN','OFFICE','REGIONAL','GLOBAL'], 'Cakupan');
      const region = req.body.region_id || user.region_id;
      const office = req.body.office_id || user.office_id;
      const finalOfficeId = await validateOrganization(db, region, office);
      await db.query("UPDATE users SET role = ?, data_scope = ?, region_id = ?, office_id = ?, account_status = 'ACTIVE', is_active = 1 WHERE user_id = ?", [role, scope, region, finalOfficeId, user.user_id]);
    } else await db.query("UPDATE users SET account_status = 'REJECTED', is_active = 0 WHERE user_id = ?", [user.user_id]);
    await db.query('UPDATE registration_approvals SET status = ?, reviewed_by = ?, reviewer_name = ?, rejection_reason = ?, reviewed_at = NOW() WHERE approval_id = ?', [approved ? 'APPROVED' : 'REJECTED', req.user.user_id, req.user.name, reason, approval.approval_id]);
    await audit(db, req.user, approved ? 'APPROVE_USER' : 'REJECT_USER', user.user_id, reason || 'Pendaftaran disetujui');
  });
  res.json({ status: 'success', message: approved ? 'Pendaftaran disetujui. Pengguna dapat masuk.' : 'Pendaftaran ditolak dengan alasan yang diberikan.' });
});
export const approveRegistration = review(true);
export const rejectRegistration = review(false);
