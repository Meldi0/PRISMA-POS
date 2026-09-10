import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { hashPassword, verifyPassword, generateToken, encryptSecret, decryptSecret } from '../utils/auth.js';
import { generateTotpSecret, generateTotpUri, generateTotpCode, generateBackupCodes } from '../utils/totp.js';
import { resolveUserPermissions } from '../utils/permissions.js';
import { sendOtpEmail, isSmtpReady } from '../utils/email.js';
import { normalizeRole, isActive } from '../utils/access.js';
import { HttpError, id, digest, otp, safeEqual, text, email, password, transaction, audit, endpoint, safeUser } from '../utils/security.js';
import { validateOrganization } from './userController.js';

const profileSql = `SELECT u.*, r.name AS region_name, r.code AS region_code, COALESCE(o.name, u.office_id) AS office_name, o.code AS office_code, o.code AS nopen_kc
  FROM users u LEFT JOIN regions r ON u.region_id = r.region_id LEFT JOIN offices o ON u.office_id = o.office_id WHERE u.user_id = ? LIMIT 1`;
const maskEmail = (value) => value.replace(/^(.)(.*)(@.*)$/, '$1***$3');
const codeHash = (token, code) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(token + ':' + code).digest('hex');

async function profile(db, userId) {
  const [[user]] = await db.query(profileSql, [userId]);
  if (!user || !isActive(user)) throw new HttpError(403, 'Akun tidak aktif. Hubungi administrator.');
  const permissions = await resolveUserPermissions(userId, user.role);
  return { ...safeUser(user), role: normalizeRole(user.role), mfa_enabled: Boolean(user.totp_secret), permissions: permissions.allowedCodes };
}
async function deliver(user, code) {
  if (!isSmtpReady()) throw new HttpError(503, 'Pengiriman kode verifikasi belum tersedia. Hubungi administrator untuk konfigurasi email.');
  const sent = await sendOtpEmail({ toEmail: user.email, recipientName: user.name, otpCode: code });
  if (!sent.success) {
    const errorMsg = sent.error ? `: ${sent.error}` : '';
    throw new HttpError(503, `Kode verifikasi belum berhasil dikirim (${sent.mode}${errorMsg}). Coba lagi nanti atau hubungi administrator.`);
  }
}

export const login = endpoint(async (req, res) => {
  const address = email(req.body.email);
  const value = text(req.body.password, 'Kata sandi', { max: 200 });
  const [[user]] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [address]);
  // Do equivalent hashing work for unknown users to limit account enumeration.
  if (!user) { await hashPassword(value); throw new HttpError(401, 'Email atau kata sandi tidak valid.'); }
  if (user.locked_until && new Date(user.locked_until) > new Date()) throw new HttpError(429, 'Terlalu banyak percobaan. Coba kembali dalam 15 menit.');
  if (!await verifyPassword(value, user.password_hash)) {
    await pool.query(`UPDATE users SET failed_attempts = failed_attempts + 1, locked_until = IF(failed_attempts >= 5, DATE_ADD(NOW(), INTERVAL 15 MINUTE), locked_until) WHERE user_id = ?`, [user.user_id]);
    throw new HttpError(401, 'Email atau kata sandi tidak valid.');
  }
  if (!isActive(user)) throw new HttpError(403, user.account_status === 'PENDING' ? 'Pendaftaran Anda sedang ditinjau administrator. Silakan tunggu persetujuan.' : 'Akun Anda tidak aktif. Hubungi administrator.');
  if (!user.password_hash.startsWith('$2')) await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [await hashPassword(value), user.user_id]);

  // Check Trusted Device (7-day OTP bypass)
  const rawDeviceToken = req.body.device_token;
  if (typeof rawDeviceToken === 'string' && rawDeviceToken.length === 64) {
    const [[device]] = await pool.query(
      'SELECT device_id FROM trusted_devices WHERE user_id = ? AND device_token_hash = ? AND expires_at > NOW() LIMIT 1',
      [user.user_id, digest(rawDeviceToken)]
    );
    if (device) {
      const sessionId = id('SES');
      const hours = 168; // 7 days
      const authToken = generateToken({ user_id: user.user_id, sid: sessionId }, hours + 'h');
      await pool.query(
        `INSERT INTO login_sessions (session_id, user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, user.user_id, digest(authToken), req.ip?.slice(0,45) || null, (req.headers['user-agent'] || '').slice(0,1000), new Date(Date.now() + hours * 3600000)]
      );
      await pool.query(
        'UPDATE trusted_devices SET expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY), ip_address = ?, user_agent = ? WHERE device_id = ?',
        [req.ip?.slice(0,45) || null, (req.headers['user-agent'] || '').slice(0,1000), device.device_id]
      );
      await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE user_id = ?', [user.user_id]);
      await audit(pool, user, 'TRUSTED_DEVICE_LOGIN', user.user_id, 'Masuk langsung via perangkat tepercaya');
      return res.json({
        status: 'success',
        mfa_required: false,
        data: {
          token: authToken,
          device_token: rawDeviceToken,
          user: await profile(pool, user.user_id)
        }
      });
    }
  }

  // System Administrator (.local) direct sign-in when TOTP is not enabled
  if (user.email.endsWith('.local') && !user.totp_secret) {
    const sessionId = id('SES');
    const hours = req.body.remember_me === true ? 168 : 8;
    const authToken = generateToken({ user_id: user.user_id, sid: sessionId }, hours + 'h');
    await pool.query(
      `INSERT INTO login_sessions (session_id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, user.user_id, digest(authToken), req.ip?.slice(0,45) || null, (req.headers['user-agent'] || '').slice(0,1000), new Date(Date.now() + hours * 3600000)]
    );
    let deviceToken = null;
    if (req.body.remember_me === true) {
      deviceToken = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO trusted_devices (device_id, user_id, device_token_hash, device_name, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [id('DEV'), user.user_id, digest(deviceToken), (req.headers['user-agent'] || 'Browser').slice(0, 250), req.ip?.slice(0, 45) || null, (req.headers['user-agent'] || '').slice(0, 1000)]
      );
    }
    await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE user_id = ?', [user.user_id]);
    await audit(pool, user, 'LOGIN_SUCCESS', user.user_id, 'Masuk langsung (akun sistem administrator)');
    return res.json({
      status: 'success',
      mfa_required: false,
      data: {
        token: authToken,
        device_token: deviceToken,
        user: await profile(pool, user.user_id)
      }
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const code = otp();
  if (!user.totp_secret) await deliver(user, code);
  await transaction(pool, async db => {
    await db.query('UPDATE mfa_challenges SET is_used = 1 WHERE user_id = ? AND is_used = 0', [user.user_id]);
    await db.query(`INSERT INTO mfa_challenges (challenge_id, challenge_token, user_id, otp_hash, expires_at, remember_me, method, purpose, last_sent_at)
      VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), ?, ?, 'login', NOW())`,
    [id('CHAL'), digest(token), user.user_id, user.totp_secret ? null : codeHash(token, code), req.body.remember_me === true ? 1 : 0, user.totp_secret ? 'totp' : 'email']);
    await db.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?', [user.user_id]);
    await audit(db, user, 'MFA_CHALLENGE', user.user_id, 'Verifikasi masuk diminta');
  });
  res.json({ status: 'success', mfa_required: true, challenge_token: token, masked_email: maskEmail(user.email), smtp_configured: true,
    mfa_method: user.totp_secret ? 'totp' : 'email', message: user.totp_secret ? 'Masukkan kode dari aplikasi authenticator atau kode pemulihan.' : 'Kode verifikasi dikirim ke email Anda.' });
});

export const verifyMfa = endpoint(async (req, res) => {
  const token = text(req.body.challenge_token, 'Sesi verifikasi', { min: 64, max: 64 });
  const code = text(req.body.otp_code, 'Kode verifikasi', { min: 6, max: 20 }).replace(/\s/g, '');
  const outcome = await transaction(pool, async db => {
    const [[challenge]] = await db.query("SELECT * FROM mfa_challenges WHERE challenge_token = ? AND purpose = 'login' FOR UPDATE", [digest(token)]);
    if (!challenge || challenge.is_used || new Date(challenge.expires_at) <= new Date() || challenge.attempts >= 5) return { failure: 'Sesi verifikasi telah berakhir. Silakan masuk kembali.' };
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ? FOR UPDATE', [challenge.user_id]);
    if (!isActive(user)) return { failure: 'Akun tidak aktif.' };
    let valid = false;
    if (challenge.method === 'totp' && user.totp_secret) {
      const step = Math.floor(Date.now() / 30000);
      for (let offset = -1; offset <= 1; offset++) {
        const candidate = step + offset;
        if (candidate > (user.totp_last_step || 0) && safeEqual(generateTotpCode(decryptSecret(user.totp_secret), candidate), code)) {
          await db.query('UPDATE users SET totp_last_step = ? WHERE user_id = ?', [candidate, user.user_id]);
          valid = true; break;
        }
      }
      if (!valid) {
        const backups = typeof user.mfa_backup_codes === 'string' ? JSON.parse(user.mfa_backup_codes || '[]') : (user.mfa_backup_codes || []);
        const index = backups.indexOf(digest(code.toUpperCase()));
        if (index >= 0) {
          backups.splice(index, 1);
          await db.query('UPDATE users SET mfa_backup_codes = ? WHERE user_id = ?', [JSON.stringify(backups), user.user_id]);
          valid = true;
        }
      }
    } else valid = safeEqual(challenge.otp_hash, codeHash(token, code));
    if (!valid) {
      await db.query('UPDATE mfa_challenges SET attempts = attempts + 1 WHERE challenge_id = ?', [challenge.challenge_id]);
      return { failure: 'Kode verifikasi salah. Periksa kode terbaru yang Anda terima.' };
    }
    await db.query('UPDATE mfa_challenges SET is_used = 1 WHERE challenge_id = ?', [challenge.challenge_id]);
    const sessionId = id('SES');
    const hours = challenge.remember_me ? 168 : 8;
    const authToken = generateToken({ user_id: user.user_id, sid: sessionId }, hours + 'h');
    await db.query(`INSERT INTO login_sessions (session_id, user_id, token_hash, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`, [sessionId, user.user_id, digest(authToken), req.ip?.slice(0,45) || null, (req.headers['user-agent'] || '').slice(0,1000), new Date(Date.now() + hours * 3600000)]);
    let deviceToken = null;
    if (challenge.remember_me) {
      deviceToken = crypto.randomBytes(32).toString('hex');
      await db.query(
        `INSERT INTO trusted_devices (device_id, user_id, device_token_hash, device_name, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [id('DEV'), user.user_id, digest(deviceToken), (req.headers['user-agent'] || 'Browser').slice(0, 250), req.ip?.slice(0, 45) || null, (req.headers['user-agent'] || '').slice(0, 1000)]
      );
    }
    await db.query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [user.user_id]);
    await audit(db, user, 'MFA_SUCCESS', user.user_id, 'Masuk dengan verifikasi dua langkah');
    return { token: authToken, userId: user.user_id, deviceToken };
  });
  if (outcome.failure) throw new HttpError(401, outcome.failure);
  res.json({ status: 'success', data: { token: outcome.token, device_token: outcome.deviceToken, user: await profile(pool, outcome.userId) } });
});

export const resendMfaOtp = endpoint(async (req, res) => {
  const token = text(req.body.challenge_token, 'Sesi verifikasi', { min: 64, max: 64 });
  await transaction(pool, async db => {
    const [[c]] = await db.query('SELECT * FROM mfa_challenges WHERE challenge_token = ? FOR UPDATE', [digest(token)]);
    if (!c || c.is_used || c.attempts >= 5 || c.method !== 'email' || new Date(c.expires_at) <= new Date()) throw new HttpError(400, 'Sesi verifikasi telah berakhir. Silakan mulai kembali.');
    if (Date.now() - new Date(c.last_sent_at).getTime() < 60000 || c.resend_count >= 3) throw new HttpError(429, 'Tunggu 60 detik. Maksimal 3 kali kirim ulang per sesi.');
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ?', [c.user_id]);
    if (!isActive(user)) throw new HttpError(403, 'Akun tidak aktif.');
    const code = otp();
    await deliver(user, code);
    // Keep the original expiry and attempts: resend cannot extend or reset a challenge.
    await db.query('UPDATE mfa_challenges SET otp_hash = ?, last_sent_at = NOW(), resend_count = resend_count + 1 WHERE challenge_id = ?', [codeHash(token, code), c.challenge_id]);
  });
  res.json({ status: 'success', message: 'Kode terbaru dikirim ke email Anda.' });
});

export const register = endpoint(async (req, res) => {
  const name = text(req.body.name, 'Nama lengkap', { min: 2, max: 150 });
  const address = email(req.body.email);
  const hashed = await hashPassword(password(req.body.password));
  const officeInput = text(req.body.office_id || req.body.office_name, 'Kantor', { min: 2, max: 150 });
  const regionId = text(req.body.region_id, 'Regional', { max: 50 });
  const position = text(req.body.position, 'Jabatan', { max: 100, optional: true });
  const nip = text(req.body.nip, 'NIP', { max: 50, optional: true });
  const userId = id('USR');
  await transaction(pool, async db => {
    const finalOfficeId = await validateOrganization(db, regionId, officeInput);
    await db.query(`INSERT INTO users (user_id, name, email, password_hash, role, is_active, account_status, region_id, office_id, data_scope, position, nip, created_by)
      VALUES (?, ?, ?, ?, 'UPT_LUAR', 0, 'PENDING', ?, ?, 'OFFICE', ?, ?, 'self_registration')`, [userId, name, address, hashed, regionId, finalOfficeId, position, nip]);
    await db.query("INSERT INTO registration_approvals (approval_id, user_id, status) VALUES (?, ?, 'PENDING')", [id('APV'), userId]);
    await audit(db, { user_id: userId, name, role: 'UPT_LUAR' }, 'REGISTER', userId, 'Pendaftaran akun menunggu persetujuan');
  });
  res.status(201).json({ status: 'success', account_status: 'PENDING', message: 'Pendaftaran berhasil. Tunggu verifikasi administrator sebelum masuk.', data: { user_id: userId, account_status: 'PENDING' } });
});

export const getProfile = endpoint(async (req, res) => res.json({ status: 'success', data: await profile(pool, req.user.user_id) }));
export const logout = endpoint(async (req, res) => {
  await pool.query('UPDATE login_sessions SET is_revoked = 1 WHERE session_id = ?', [req.sessionId]);
  res.json({ status: 'success', message: 'Anda telah keluar.' });
});
export const changePassword = endpoint(async (req, res) => {
  const newHash = await hashPassword(password(req.body.new_password));
  await transaction(pool, async db => {
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ? FOR UPDATE', [req.user.user_id]);
    if (!await verifyPassword(req.body.current_password, user.password_hash)) throw new HttpError(400, 'Kata sandi saat ini tidak cocok.');
    await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, user.user_id]);
    await db.query('UPDATE login_sessions SET is_revoked = 1 WHERE user_id = ?', [user.user_id]);
    await db.query('UPDATE mfa_challenges SET is_used = 1 WHERE user_id = ?', [user.user_id]);
    await audit(db, user, 'PASSWORD_CHANGED', user.user_id, 'Kata sandi diubah dan semua sesi diakhiri');
  });
  res.json({ status: 'success', message: 'Kata sandi diperbarui. Silakan masuk kembali.' });
});
export const setupMfa = endpoint(async (req, res) => {
  const [[user]] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.user.user_id]);
  if (!await verifyPassword(req.body.current_password, user.password_hash)) throw new HttpError(400, 'Kata sandi saat ini tidak cocok.');
  if (user.totp_secret) throw new HttpError(409, 'Authenticator sudah aktif.');
  const secret = generateTotpSecret();
  await pool.query('UPDATE users SET totp_pending_secret = ?, totp_pending_until = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE user_id = ?', [encryptSecret(secret), user.user_id]);
  res.json({ status: 'success', data: { secret, qr_uri: generateTotpUri('PRISMA POS', user.email, secret) } });
});
export const confirmMfa = endpoint(async (req, res) => {
  const backupCodes = generateBackupCodes();
  await transaction(pool, async db => {
    const [[user]] = await db.query('SELECT * FROM users WHERE user_id = ? FOR UPDATE', [req.user.user_id]);
    if (!user.totp_pending_secret || new Date(user.totp_pending_until) <= new Date()) throw new HttpError(400, 'Pengaturan authenticator telah kedaluwarsa.');
    const step = Math.floor(Date.now() / 30000);
    const validStep = [-1,0,1].map(offset => step + offset).find(candidate => safeEqual(generateTotpCode(decryptSecret(user.totp_pending_secret), candidate), req.body.code));
    if (!validStep) throw new HttpError(400, 'Kode authenticator tidak cocok.');
    await db.query('UPDATE users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_pending_until = NULL, totp_last_step = ?, mfa_enabled = 1, mfa_backup_codes = ? WHERE user_id = ?', [validStep, JSON.stringify(backupCodes.map(digest)), user.user_id]);
    await db.query('UPDATE login_sessions SET is_revoked = 1 WHERE user_id = ? AND session_id <> ?', [user.user_id, req.sessionId]);
    await audit(db, user, 'MFA_ENABLE', user.user_id, 'Authenticator diaktifkan');
  });
  res.json({ status: 'success', message: 'Authenticator aktif. Simpan kode pemulihan di tempat aman.', data: { backup_codes: backupCodes } });
});
