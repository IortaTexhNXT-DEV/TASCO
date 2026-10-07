'use strict';

const crypto = require('crypto');

/**
 * Cryptography primitives, all from node:crypto (no third-party crypto).
 *  - AES-256-GCM envelope for PII at rest, with key ids for rotation
 *  - HMAC-SHA256 blind index for equality search on encrypted fields
 *  - scrypt password hashing
 *  - HS256 JWT
 *  - RFC 6238 TOTP for MFA
 */

function createFieldCipher({ keys, activeKeyId }) {
  return {
    encrypt(plain) {
      if (plain === null || plain === undefined) return plain;
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', keys[activeKeyId], iv);
      const ct = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `enc:v1:${activeKeyId}:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
    },
    decrypt(value) {
      if (typeof value !== 'string' || !value.startsWith('enc:v1:')) return value;
      const [, , keyId, b64] = value.split(':');
      const key = keys[keyId];
      if (!key) throw new Error(`unknown data key ${keyId}`);
      const buf = Buffer.from(b64, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
      decipher.setAuthTag(buf.subarray(12, 28));
      const pt = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
      return JSON.parse(pt);
    },
    isEncrypted: (v) => typeof v === 'string' && v.startsWith('enc:v1:'),
    keyIdOf: (v) => (typeof v === 'string' && v.startsWith('enc:v1:') ? v.split(':')[2] : null),
  };
}

function blindIndex(key, value) {
  if (value === null || value === undefined || value === '') return null;
  return crypto.createHmac('sha256', key).update(String(value).toLowerCase()).digest('hex');
}

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [algo, N, r, p, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(expected, actual);
}

/** Password policy aligned with OWASP ASVS V2.1 (length over complexity). */
function checkPasswordPolicy(password) {
  const issues = [];
  if (typeof password !== 'string' || password.length < 12) issues.push('at least 12 characters');
  if (typeof password === 'string' && password.length > 128) issues.push('at most 128 characters');
  return issues;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: now, exp: now + ttlSeconds, jti: crypto.randomUUID(), ...payload }));
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token, secret, { audience } = {}) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  let h;
  try { h = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')); } catch { return null; }
  if (h.alg !== 'HS256') return null; // reject alg=none and algorithm confusion
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (audience && payload.aud !== audience) return null;
  return payload;
}

// --- TOTP (RFC 6238 / RFC 4226) ---
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0; let value = 0; let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0; let value = 0; const out = [];
  for (const c of str.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(c);
    if (idx < 0) throw new Error('invalid base32');
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totp(secretB32, timeMs = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(timeMs / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secretB32)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString();
  return code.padStart(digits, '0');
}

/** Returns the matched 30-second time step (for replay protection) or null. */
function matchTotpStep(secretB32, code, { window = 1, timeMs = Date.now() } = {}) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  for (let w = -window; w <= window; w++) {
    const t = timeMs + w * 30000;
    const expected = totp(secretB32, t);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(code)))) return Math.floor(t / 1000 / 30);
  }
  return null;
}

function verifyTotp(secretB32, code, opts) {
  return matchTotpStep(secretB32, code, opts) !== null;
}

function otpauthUri({ secret, account, issuer = 'TASCO Growth Platform' }) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = {
  createFieldCipher, blindIndex, hashPassword, verifyPassword, checkPasswordPolicy, signJwt, verifyJwt,
  generateTotpSecret, totp, verifyTotp, matchTotpStep, otpauthUri, base32Encode, base32Decode, sha256, randomToken,
};
