import crypto from 'crypto';
import { pool } from '../config/db.js';
import { hashPassword, verifyPassword, generateToken } from '../utils/auth.js';
import { generateTotpSecret, generateTotpUri, verifyTotp, generateBackupCodes } from '../utils/totp.js';
import { resolveUserPermissions } from '../utils/permissions.js';
import { sendOtpEmail } from '../utils/email.js';

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanEmail || !password) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Email dan kata sandi wajib diisi.'
      });
    }

    const [rows] = await pool.query(
      `SELECT 
        user_id, name, email, password_hash, role, is_active,
        account_status, region_id, office_id, data_scope, position, mfa_enabled,
        failed_attempts, locked_until, nip, department, role_title
      FROM users 
      WHERE LOWER(email) = ? LIMIT 1`,
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Kombinasi email atau kata sandi tidak valid.'
      });
    }

    const user = rows[0];

    // 1. Check Lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: `Akun terkunci sementara karena percobaan gagal berulang. Silakan coba lagi dalam ${remainingMinutes} menit.`
      });
    }

    // 2. Check Account Status (PENDING, REJECTED, SUSPENDED, INACTIVE)
    const status = user.account_status || (user.is_active ? 'ACTIVE' : 'INACTIVE');

    if (status === 'PENDING') {
      return res.status(403).json({
        status: 'error',
        code: 403,
        account_status: 'PENDING',
        message: 'Akun Anda sedang dalam antrean verifikasi Admin Pusat (Status: PENDING). Harap menunggu persetujuan.'
      });
    }

    if (status === 'REJECTED') {
      // Ambil alasan penolakan dari registration_approvals
      const [appRows] = await pool.query(
        'SELECT rejection_reason, reviewed_at FROM registration_approvals WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [user.user_id]
      );
      const reason = appRows[0]?.rejection_reason || 'Data pendaftaran tidak memenuhi kriteria kedinasan.';
      return res.status(403).json({
        status: 'error',
        code: 403,
        account_status: 'REJECTED',
        message: `Pendaftaran akun Anda ditolak oleh Admin Pusat. Alasan: "${reason}"`
      });
    }

    if (status === 'SUSPENDED') {
      return res.status(403).json({
        status: 'error',
        code: 403,
        account_status: 'SUSPENDED',
        message: 'Akun Anda telah dibekukan (SUSPENDED) oleh Administrator Pusat. Akses ke sistem ditutup.'
      });
    }

    if (status === 'INACTIVE' || !user.is_active) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        account_status: 'INACTIVE',
        message: 'Akun Anda sedang dinonaktifkan. Silakan hubungi Administrator Pusat.'
      });
    }

    // 3. Verify Password
    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      const newFailed = (user.failed_attempts || 0) + 1;
      let lockUpdate = '';
      const params = [newFailed, user.user_id];

      if (newFailed >= 5) {
        lockUpdate = ', locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)';
      }

      await pool.query(`UPDATE users SET failed_attempts = ?${lockUpdate} WHERE user_id = ?`, params);

      // Audit Log Gagal Login
      try {
        await pool.query(`
          INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description, ip_address)
          VALUES (?, ?, ?, ?, 'LOGIN_FAILED', 'USER', ?, 'Kata sandi salah', 'Percobaan masuk gagal', ?)
        `, [
          `LOG-${Date.now().toString().slice(-6)}`, user.user_id, user.name, user.role, user.user_id, req.ip
        ]);
      } catch (e) {}

      return res.status(401).json({
        status: 'error',
        code: 401,
        message: newFailed >= 5 
          ? 'Terlalu banyak percobaan gagal. Akun dikunci selama 15 menit.' 
          : 'Kombinasi email atau kata sandi tidak valid.'
      });
    }

    // Reset failed attempts & update last login
    await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE user_id = ?', [user.user_id]);

    // Fetch full user record with Region and Office details
    const [userRows] = await pool.query(
      `SELECT 
        u.user_id, u.name, u.email, u.role, u.is_active, u.account_status,
        u.region_id, u.office_id, u.data_scope, u.position, u.mfa_enabled,
        u.nip, u.department, u.role_title,
        r.name AS regional_name, r.code AS regional_code,
        o.name AS office_name, o.code AS office_code
      FROM users u
      LEFT JOIN regions r ON u.region_id = r.region_id
      LEFT JOIN offices o ON u.office_id = o.office_id
      WHERE u.user_id = ? LIMIT 1`,
      [user.user_id]
    );

    const fullUser = userRows[0] || user;
    const permResolution = await resolveUserPermissions(fullUser.user_id, fullUser.role);

    const userPayload = {
      user_id: fullUser.user_id,
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      account_status: fullUser.account_status || 'ACTIVE',
      data_scope: fullUser.data_scope,
      region_id: fullUser.region_id,
      office_id: fullUser.office_id,
      region_name: fullUser.regional_name,
      region_code: fullUser.regional_code,
      office_name: fullUser.office_name,
      office_code: fullUser.office_code,
      position: fullUser.position,
      nip: fullUser.nip,
      department: fullUser.department,
      role_title: fullUser.role_title,
      permissions: permResolution.allowedCodes
    };

    const token = generateToken(userPayload);

    // Audit Log Login Sukses
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description, ip_address)
        VALUES (?, ?, ?, ?, 'LOGIN_SUCCESS', 'SESSION', ?, 'Login berhasil langsung', 'Autentikasi akun berhasil', ?)
      `, [`LOG-${Date.now().toString().slice(-6)}`, fullUser.user_id, fullUser.name, fullUser.role, fullUser.user_id, req.ip]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Berhasil masuk ke dalam sistem.',
      data: {
        token,
        user: userPayload
      }
    });

  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Terjadi kesalahan sistem saat proses masuk.'
    });
  }
}

/**
 * Verify MFA Challenge Token
 */
export async function verifyMfa(req, res) {
  try {
    const { challenge_token, otp_code } = req.body;

    if (!challenge_token || !otp_code) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Challenge token dan kode OTP 6-digit wajib dikirim.'
      });
    }

    const [chalRows] = await pool.query(
      'SELECT * FROM mfa_challenges WHERE challenge_token = ? AND is_used = 0 LIMIT 1',
      [challenge_token]
    );

    if (chalRows.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Sesi verifikasi MFA tidak valid atau telah digunakan. Silakan login kembali.'
      });
    }

    const challenge = chalRows[0];

    if (new Date(challenge.expires_at) < new Date()) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Sesi verifikasi MFA telah kadaluarsa. Silakan login kembali.'
      });
    }

    if (challenge.attempts >= 5) {
      return res.status(403).json({
        status: 'error',
        code: 403,
        message: 'Terlalu banyak percobaan kode OTP salah. Sesi dibatalkan.'
      });
    }

    const cleanCode = otp_code.trim().replace(/\s+/g, '');
    let isValid = false;

    // 1. Cek kecocokan OTP challenge dari sesi login
    if (challenge.otp_code && cleanCode === challenge.otp_code) {
      isValid = true;
    } else if (cleanCode === '123456') {
      // Fallback kode OTP darurat kedinasan / testing
      isValid = true;
    }

    if (!isValid) {
      await pool.query('UPDATE mfa_challenges SET attempts = attempts + 1 WHERE challenge_id = ?', [challenge.challenge_id]);

      try {
        await pool.query(`
          INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description, ip_address)
          VALUES (?, ?, 'User MFA', 'USER', 'MFA_FAILED', 'SECURITY', ?, 'Kode OTP salah', 'Percobaan verifikasi MFA gagal', ?)
        `, [`LOG-${Date.now().toString().slice(-6)}`, challenge.user_id, challenge.user_id, req.ip]);
      } catch (e) {}

      return res.status(401).json({
        status: 'error',
        code: 401,
        message: 'Kode OTP tidak valid atau salah. Periksa kembali 6 digit kode yang dikirimkan.'
      });
    }

    // Mark challenge used
    await pool.query('UPDATE mfa_challenges SET is_used = 1 WHERE challenge_id = ?', [challenge.challenge_id]);

    // Fetch full user record with Region and Office details
    const [userRows] = await pool.query(
      `SELECT 
        u.user_id, u.name, u.email, u.role, u.is_active, u.account_status,
        u.region_id, u.office_id, u.data_scope, u.position, u.mfa_enabled,
        u.nip, u.department, u.role_title,
        r.name AS regional_name, r.code AS regional_code,
        o.name AS office_name, o.code AS office_code
      FROM users u
      LEFT JOIN regions r ON u.region_id = r.region_id
      LEFT JOIN offices o ON u.office_id = o.office_id
      WHERE u.user_id = ? LIMIT 1`,
      [challenge.user_id]
    );

    const user = userRows[0];
    const permResolution = await resolveUserPermissions(user.user_id, user.role);

    const userPayload = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      account_status: user.account_status || 'ACTIVE',
      data_scope: user.data_scope,
      region_id: user.region_id,
      office_id: user.office_id,
      region_name: user.regional_name,
      region_code: user.regional_code,
      office_name: user.office_name,
      office_code: user.office_code,
      position: user.position,
      nip: user.nip,
      phone_number: null,
      mfa_enabled: true,
      permissions: permResolution.allowedCodes
    };

    const token = generateToken(userPayload);

    // Audit Log Sukses MFA
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description, ip_address)
        VALUES (?, ?, ?, ?, 'MFA_SUCCESS', 'SESSION', ?, 'Verifikasi MFA sukses', 'Login MFA dua faktor berhasil diverifikasi', ?)
      `, [`LOG-${Date.now().toString().slice(-6)}`, user.user_id, user.name, user.role, user.user_id, req.ip]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      code: 200,
      message: 'Autentikasi dua faktor berhasil diverifikasi.',
      data: {
        token,
        user: userPayload
      }
    });

  } catch (err) {
    console.error('Error in verifyMfa:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal memproses verifikasi MFA.'
    });
  }
}

/**
 * Setup MFA TOTP for Authenticated User
 */
export async function setupMfa(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ status: 'error', code: 401, message: 'Autentikasi diperlukan.' });
    }

    const secret = generateTotpSecret();
    const uri = generateTotpUri('POSO Helpdesk', user.email, secret);
    const backupCodes = generateBackupCodes(8);

    return res.status(200).json({
      status: 'success',
      data: {
        secret,
        qr_uri: uri,
        backup_codes: backupCodes
      }
    });
  } catch (err) {
    console.error('Error in setupMfa:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal menginisialisasi MFA.' });
  }
}

/**
 * Confirm and Activate MFA
 */
export async function confirmMfa(req, res) {
  try {
    const user = req.user;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ status: 'error', code: 400, message: 'Kode OTP wajib dimasukkan.' });
    }

    await pool.query('UPDATE users SET mfa_enabled = 1 WHERE user_id = ?', [user.user_id]);

    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
        VALUES (?, ?, ?, ?, 'MFA_ENABLE', 'USER', ?, 'MFA berhasil diaktifkan', 'Pengguna mengaktifkan autentikasi dua faktor')
      `, [`LOG-${Date.now().toString().slice(-6)}`, user.user_id, user.name, user.role, user.user_id]);
    } catch (e) {}

    return res.status(200).json({
      status: 'success',
      message: 'MFA Authenticator berhasil diaktifkan untuk akun Anda.'
    });
  } catch (err) {
    console.error('Error in confirmMfa:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal mengonfirmasi MFA.' });
  }
}

/**
 * Register New Staff Account (Status = PENDING)
 */
export async function register(req, res) {
  try {
    const {
      name,
      email,
      phone,
      position,
      nopen,
      user_type = 'CABANG', // REGIONAL | CABANG
      region_id,
      office_id,
      password
    } = req.body;

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Nama lengkap, email, dan kata sandi wajib diisi.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Kata sandi minimal 6 karakter.'
      });
    }

    // Check email uniqueness
    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE LOWER(email) = ? LIMIT 1',
      [cleanEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        status: 'error',
        code: 409,
        message: 'Email sudah terdaftar. Silakan gunakan menu masuk (Sign In).'
      });
    }

    const userId = `USR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const hashedPassword = await hashPassword(password);

    // Seluruh pendaftaran dinas staf UPT adalah role PELAPOR dengan status PENDING
    const role = 'PELAPOR';
    const dataScope = 'OFFICE';
    const accountStatus = 'PENDING';

    await pool.query(`
      INSERT INTO users (
        user_id, name, email, password_hash, password_plain, role, is_active,
        account_status, region_id, office_id, data_scope, position,
        nip, mfa_enabled, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, 'self_registration')
    `, [
      userId, cleanName, cleanEmail, hashedPassword, password, role,
      accountStatus, region_id || null, office_id || null, dataScope, position || null,
      nopen || null
    ]);

    // Insert approval entry
    const approvalId = `APV-${Date.now().toString().slice(-6)}`;
    await pool.query(`
      INSERT INTO registration_approvals (approval_id, user_id, status, created_at)
      VALUES (?, ?, 'PENDING', NOW())
    `, [approvalId, userId]);

    // Audit Log Pendaftaran
    try {
      await pool.query(`
        INSERT INTO audit_logs (log_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description, ip_address)
        VALUES (?, ?, ?, ?, 'REGISTER', 'USER', ?, 'Pendaftaran akun baru (PENDING)', 'Pendaftaran mandiri pengguna dinas baru', ?)
      `, [
        `LOG-${Date.now().toString().slice(-6)}`, userId, cleanName, role, userId, req.ip
      ]);
    } catch (e) {}

    return res.status(201).json({
      status: 'success',
      code: 201,
      account_status: 'PENDING',
      message: 'Pendaftaran akun berhasil diserahkan. Akun Anda berstatus PENDING dan sedang menunggu persetujuan dari Administrator Pusat sebelum dapat digunakan.',
      data: {
        user_id: userId,
        name: cleanName,
        email: cleanEmail,
        role,
        account_status: 'PENDING'
      }
    });
  } catch (err) {
    console.error('Error in register:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Terjadi kesalahan sistem saat mendaftarkan akun.'
    });
  }
}

export async function getProfile(req, res) {
  if (!req.user) {
    return res.status(401).json({ status: 'error', code: 401, message: 'Belum login.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT 
        u.user_id, u.name, u.email, u.role, u.is_active, u.account_status,
        u.region_id, u.office_id, u.data_scope, u.position, u.mfa_enabled,
        u.nip, u.department, u.role_title,
        r.name AS regional_name, o.name AS office_name
      FROM users u
      LEFT JOIN regions r ON u.region_id = r.region_id
      LEFT JOIN offices o ON u.office_id = o.office_id
      WHERE u.user_id = ? LIMIT 1`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', code: 404, message: 'User tidak ditemukan.' });
    }

    const userData = rows[0];
    const permResolution = await resolveUserPermissions(userData.user_id, userData.role);

    return res.status(200).json({
      status: 'success',
      data: {
        ...userData,
        permissions: permResolution.permissions,
        allowedPermissions: permResolution.allowedCodes
      }
    });
  } catch (err) {
    console.error('Error in getProfile:', err);
    return res.status(500).json({ status: 'error', code: 500, message: 'Gagal mengambil profil.' });
  }
}

/**
 * Resend MFA OTP to user email
 */
export async function resendMfaOtp(req, res) {
  try {
    const { challenge_token } = req.body;
    if (!challenge_token) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Token challenge verifikasi diperlukan.'
      });
    }

    const [rows] = await pool.query(
      `SELECT c.challenge_id, c.user_id, u.name, u.email 
       FROM mfa_challenges c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.challenge_token = ? AND c.is_used = 0 LIMIT 1`,
      [challenge_token]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 400,
        message: 'Sesi verifikasi OTP tidak ditemukan atau telah kedaluwarsa. Silakan masuk kembali.'
      });
    }

    const challenge = rows[0];
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      `UPDATE mfa_challenges SET otp_code = ?, expires_at = ?, attempts = 0 WHERE challenge_id = ?`,
      [newOtp, newExpiresAt, challenge.challenge_id]
    );

    await sendOtpEmail({
      toEmail: challenge.email,
      recipientName: challenge.name,
      otpCode: newOtp
    });

    const masked = maskEmail(challenge.email);

    return res.status(200).json({
      status: 'success',
      code: 200,
      masked_email: masked,
      message: `Kode OTP baru berhasil dikirim ke email ${masked}. Harap periksa folder Inbox atau Spam.`
    });
  } catch (err) {
    console.error('Error in resendMfaOtp:', err);
    return res.status(500).json({
      status: 'error',
      code: 500,
      message: 'Gagal mengirim ulang kode OTP.'
    });
  }
}
