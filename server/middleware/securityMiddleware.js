import crypto from 'node:crypto';
import { pool } from '../config/db.js';

// Database-backed limits are shared by every server instance, including serverless workers.
export function rateLimit(name, max, seconds = 900) {
  return async (req, res, next) => {
    if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === '1') {
      return next();
    }
    try {
      const key = crypto.createHash('sha256').update(`${name}:${req.ip || 'unknown'}`).digest('hex');
      await pool.query(`INSERT INTO request_limits (bucket, hits, expires_at) VALUES (?, 1, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ON DUPLICATE KEY UPDATE hits = IF(expires_at <= NOW(), 1, hits + 1), expires_at = IF(expires_at <= NOW(), VALUES(expires_at), expires_at)`, [key, seconds]);
      const [[entry]] = await pool.query('SELECT hits, expires_at FROM request_limits WHERE bucket = ?', [key]);
      if (entry.hits > max) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((new Date(entry.expires_at).getTime() - Date.now()) / 1000))));
        return res.status(429).json({ status: 'error', code: 429, message: 'Terlalu banyak permintaan. Tunggu beberapa saat sebelum mencoba lagi.' });
      }
      // Expired buckets contain no identity and can be discarded in bounded batches.
      await pool.query('DELETE FROM request_limits WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 50');
      next();
    } catch (error) { next(error); }
  };
}

export function securityHeaders(req, res, next) {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
  if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}
