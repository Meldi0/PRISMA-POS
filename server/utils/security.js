import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const otp = () => crypto.randomInt(100000, 1000000).toString();
export const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export function text(value, label, { min = 1, max = 255, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpError(400, `${label} harus berisi ${min}–${max} karakter.`);
  }
  return value.trim();
}

export function email(value) {
  const result = text(value, 'Email', { max: 150 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, 'Format email tidak valid.');
  return result;
}

export function password(value) {
  if (typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new HttpError(400, 'Gunakan kata sandi minimal 12 karakter dan maksimal 72 byte.');
  }
  if (!/[a-zA-Z]/.test(value) || !/[^a-zA-Z]/.test(value)) {
    throw new HttpError(400, 'Gabungkan huruf dengan angka atau simbol pada kata sandi.');
  }
  return value;
}

export function choice(value, values, label) {
  if (!values.includes(value)) throw new HttpError(400, `${label} tidak valid.`);
  return value;
}

export function integer(value, fallback, max = 100) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new HttpError(400, 'Parameter halaman atau batas data tidak valid.');
  return number;
}

export function safeUser(user) {
  const allowed = ['user_id', 'name', 'email', 'role', 'is_active', 'account_status', 'data_scope', 'region_id', 'office_id', 'position', 'nip', 'department', 'role_title', 'mfa_enabled', 'failed_attempts', 'locked_until', 'last_login_at', 'created_by', 'created_at', 'updated_at', 'region_name', 'region_code', 'office_name', 'office_code', 'nopen_kc'];
  return Object.fromEntries(allowed.filter(key => key in user).map(key => [key, user[key]]));
}

export async function transaction(db, work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function audit(db, user, action, entityId, details, ticketId = null) {
  await db.query(`INSERT INTO audit_logs
    (log_id, ticket_id, actor_id, actor_name, actor_role, action, entity_type, entity_id, details, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [id('LOG'), ticketId, user.user_id, user.name, user.role, action, ticketId ? 'TICKET' : 'USER', entityId, details, details]);
}

export const endpoint = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};
