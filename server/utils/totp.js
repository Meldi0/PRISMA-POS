import crypto from 'crypto';

// Base32 alphabet according to RFC 4648
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a buffer to a Base32 string
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decode a Base32 string to a Buffer
 */
export function base32Decode(base32Str) {
  const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
    if (idx === -1) {
      continue; // Skip invalid chars
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a cryptographically secure Base32 TOTP secret (20 bytes)
 */
export function generateTotpSecret(length = 20) {
  const randomBytes = crypto.randomBytes(length);
  return base32Encode(randomBytes);
}

/**
 * Generate a 6-digit TOTP code for a specific time step (RFC 6238)
 */
export function generateTotpCode(secretBase32, timeStep = Math.floor(Date.now() / 1000 / 30)) {
  const key = base32Decode(secretBase32);

  // Counter as 8-byte big-endian buffer
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(timeStep));

  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const token = binaryCode % 1000000;
  return token.toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP token allowing +/- 1 time step for clock drift (tolerance window)
 */
export function verifyTotp(secretBase32, token, window = 1) {
  if (!secretBase32 || !token) return false;
  const cleanToken = token.toString().trim();
  if (cleanToken.length !== 6) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);

  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTotpCode(secretBase32, currentStep + offset);
    if (expected === cleanToken) {
      return true;
    }
  }

  return false;
}

/**
 * Generate TOTP URI for Authenticator apps (Google Authenticator, Microsoft Authenticator, Authy)
 */
export function generateTotpUri(issuer = 'POSO', accountName = 'user@poso.local', secretBase32 = '') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate 6-8 backup recovery codes
 */
export function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}
