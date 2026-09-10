import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { safeEqual } from './security.js';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32 || /change_in_production|default_secret|your_jwt/.test(value)) throw new Error('JWT_SECRET harus berupa secret acak minimal 32 karakter.');
  return value;
}
export const hashPassword = (value) => bcrypt.hash(value, 12);
export function hashPasswordLegacy(password, salt = 'poso') {
  return crypto.createHash('sha256').update(password + salt + 'POSO_SALT_DEFAULT').digest('hex') + ':' + salt;
}
export async function verifyPassword(value, hash) {
  if (typeof value !== 'string' || typeof hash !== 'string') return false;
  if (/^\$2[aby]\$/.test(hash)) return bcrypt.compare(value, hash);
  // Upgrade legacy hashes after login; plaintext is never accepted.
  if (/^[a-f0-9]{64}:[^:]+$/.test(hash)) return safeEqual(hashPasswordLegacy(value, hash.split(':')[1]), hash);
  return false;
}
export function generateToken(payload, expiresIn = '8h') {
  return jwt.sign(payload, secret(), { expiresIn, algorithm: 'HS256', issuer: 'prisma-pos', audience: 'prisma-pos-web' });
}
export function verifyToken(token) {
  try { return jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: 'prisma-pos', audience: 'prisma-pos-web' }); }
  catch { return null; }
}
export function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(secret()).digest(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(v => v.toString('base64')).join('.');
}
export function decryptSecret(value) {
  const [iv, tag, data] = value.split('.').map(v => Buffer.from(v, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(secret()).digest(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
