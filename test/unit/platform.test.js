'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const c = require('../../src/shared/crypto');
const { validate } = require('../../src/shared/validation');
const { createCircuitBreaker, withTimeout } = require('../../src/shared/resilience');
const { createLogger, redact } = require('../../src/shared/logger');
const { createMetrics } = require('../../src/shared/metrics');
const { loadConfig } = require('../../src/shared/config');
const { errors, AppError } = require('../../src/shared/errors');
const util = require('../../src/shared/util');
const { createClock } = require('../../src/shared/clock');
const { collectionsDdl } = require('../../src/adapters/persistence/schemaSql');
const { KEY, testEnv } = require('../helpers');

test('field cipher: AES-256-GCM round trip, key rotation, tamper detection', () => {
  const k1 = Buffer.from(KEY('a'), 'base64');
  const k2 = Buffer.from(KEY('b'), 'base64');
  const old = c.createFieldCipher({ keys: { k1 }, activeKeyId: 'k1' });
  const ct = old.encrypt({ phone: '0912345678' });
  assert.ok(ct.startsWith('enc:v1:k1:'));
  assert.ok(!ct.includes('0912'));
  const rotated = c.createFieldCipher({ keys: { k1, k2 }, activeKeyId: 'k2' });
  assert.deepEqual(rotated.decrypt(ct), { phone: '0912345678' }, 'old key ids still decrypt after rotation');
  assert.equal(rotated.keyIdOf(rotated.encrypt('x')), 'k2');
  assert.equal(rotated.encrypt(null), null);
  assert.equal(rotated.decrypt('plain'), 'plain');
  assert.equal(rotated.isEncrypted(ct), true);
  const parts = ct.split(':');
  const buf = Buffer.from(parts[3], 'base64');
  buf[buf.length - 1] ^= 1;
  assert.throws(() => old.decrypt(`enc:v1:k1:${buf.toString('base64')}`));
  assert.throws(() => old.decrypt('enc:v1:zz:AAAA'), /unknown data key/);
});

test('blind index, passwords and policy', () => {
  const key = Buffer.from(KEY('bi'), 'base64');
  assert.equal(c.blindIndex(key, 'ABC'), c.blindIndex(key, 'abc'));
  assert.equal(c.blindIndex(key, ''), null);
  const h = c.hashPassword('correct horse battery');
  assert.ok(c.verifyPassword('correct horse battery', h));
  assert.ok(!c.verifyPassword('wrong', h));
  assert.ok(!c.verifyPassword('x', 'md5$abc'));
  assert.ok(!c.verifyPassword('x', null));
  assert.deepEqual(c.checkPasswordPolicy('short'), ['at least 12 characters']);
  assert.deepEqual(c.checkPasswordPolicy('x'.repeat(200)), ['at most 128 characters']);
  assert.deepEqual(c.checkPasswordPolicy('long enough pass'), []);
});

test('JWT: signs, verifies, rejects tampering, alg=none, expiry and wrong audience', () => {
  const t = c.signJwt({ sub: 'u1', aud: 'staff' }, 'secret', 60);
  assert.equal(c.verifyJwt(t, 'secret').sub, 'u1');
  assert.equal(c.verifyJwt(t, 'other'), null);
  assert.equal(c.verifyJwt(t, 'secret', { audience: 'customer' }), null);
  const [h, b] = t.split('.');
  const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  assert.equal(c.verifyJwt(`${noneHeader}.${b}.`, 'secret'), null);
  const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url');
  assert.equal(c.verifyJwt(`${h}.${forged}.${t.split('.')[2]}`, 'secret'), null);
  assert.equal(c.verifyJwt(c.signJwt({ sub: 'u' }, 'secret', -10), 'secret'), null);
  assert.equal(c.verifyJwt('garbage', 'secret'), null);
  assert.equal(c.verifyJwt('a.b.c', 'secret'), null);
  assert.equal(c.verifyJwt(null, 'secret'), null);
});

test('TOTP (RFC 6238) and base32', () => {
  // RFC 6238 test vector (SHA1, T=59s) → 94287082 (8 digits); 6-digit → 287082
  const secret = c.base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(c.totp(secret, 59000), '287082');
  assert.ok(c.verifyTotp(secret, c.totp(secret)));
  assert.ok(!c.verifyTotp(secret, '000000x'));
  assert.ok(!c.verifyTotp(secret, 'abcdef'));
  assert.equal(c.base32Decode(secret).toString(), '12345678901234567890');
  assert.throws(() => c.base32Decode('!!!'), /invalid base32/);
  assert.equal(c.generateTotpSecret().length, 32);
  assert.equal(c.sha256('a').length, 64);
  assert.ok(c.randomToken(8).length >= 10);
});

test('validation: allow-list, types, coercion, nested and errors', () => {
  const schema = {
    name: { type: 'string', required: true, max: 5, pattern: /^[a-z]+$/ },
    n: { type: 'integer', min: 1, max: 10 },
    f: { type: 'number', enum: [1.5, 2] },
    b: { type: 'boolean' },
    d: { type: 'date' },
    e: { type: 'string', enum: ['x'] },
    arr: { type: 'array', max: 2, items: { type: 'integer' } },
    obj: { type: 'object', schema: { k: { type: 'string', min: 2 } } },
    free: { type: 'object' },
    dflt: { type: 'integer', default: 7 },
  };
  const ok = validate({ name: 'abc', n: '3', b: 'true', d: '2026-01-01', arr: [1, 2], obj: { k: 'ab' }, free: { any: 1 }, f: 2 }, schema);
  assert.equal(ok.n, 3);
  assert.equal(ok.b, true);
  assert.equal(ok.dflt, 7);
  try {
    validate({ name: 'TOOLONG1', n: 0.5, f: 3, b: 'maybe', d: '2026-13-99', e: 'y', arr: [1, 2, 3], obj: { k: 'a', z: 1 }, extra: 1, free: [] }, schema);
    assert.fail('should throw');
  } catch (e) {
    assert.equal(e.code, 'VALIDATION_FAILED');
    const d = e.details.join('|');
    for (const s of ['name must be at most', 'name has an invalid format', 'n must be a integer', 'f must be one of', 'b must be a boolean', 'd must be a date', 'e must be one of', 'arr must have at most', 'obj.k must be at least', 'obj.z is not allowed', 'extra is not allowed', 'free must be an object']) assert.ok(d.includes(s), s);
  }
  assert.throws(() => validate({}, schema), /validation/i);
  assert.throws(() => validate({ name: 'a', n: 99 }, schema), (e) => e.details.some((x) => x.includes('≤ 10')));
  assert.throws(() => validate({ name: 1 }, schema), (e) => e.details.some((x) => x.includes('must be a string')));
  assert.throws(() => validate({ name: 'a', arr: 'x' }, schema), (e) => e.details.some((x) => x.includes('must be an array')));
  assert.throws(() => validate({ x: 1 }, { x: { type: 'weird' } }), /unknown rule type/);
});

test('circuit breaker: retries, opens, short-circuits, half-opens and recovers', async () => {
  let calls = 0;
  const cb = createCircuitBreaker({ name: 't', failureThreshold: 2, resetMs: 30, retries: 1, baseDelayMs: 1, timeoutMs: 50 });
  await assert.rejects(cb.exec(async () => { calls++; throw errors.upstream('down'); }));
  assert.equal(calls, 2, 'one retry');
  await assert.rejects(cb.exec(async () => { throw errors.upstream('down'); }));
  assert.equal(cb.state(), 'open');
  await assert.rejects(cb.exec(async () => 1), /circuit open/);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(await cb.exec(async () => 'ok'), 'ok');
  assert.equal(cb.state(), 'closed');
  let n = 0;
  await assert.rejects(cb.exec(async () => { n++; throw errors.validation('bad'); }));
  assert.equal(n, 1, 'client errors are not retried');
  await assert.rejects(withTimeout(new Promise(() => {}), 5, 'slow'), /timed out/);
  const half = createCircuitBreaker({ name: 'h', failureThreshold: 1, resetMs: 5, retries: 0 });
  await assert.rejects(half.exec(async () => { throw new Error('x'); }));
  await new Promise((r) => setTimeout(r, 10));
  await assert.rejects(half.exec(async () => { throw new Error('y'); }));
  assert.equal(half.state(), 'open');
});

test('logger redacts PII and secrets; metrics render Prometheus format', () => {
  const lines = [];
  const log = createLogger({ level: 'info', sink: (l) => lines.push(JSON.parse(l)) });
  log.debug('hidden');
  log.info('hello', { phone: '0912', nested: { password: 'p', ok: 1 }, list: [{ token: 't' }] });
  log.child({ req: 1 }).error('boom', { err: new Error('bad') });
  log.warn('w');
  assert.equal(lines.length, 3);
  assert.equal(lines[0].phone, '[REDACTED]');
  assert.equal(lines[0].nested.password, '[REDACTED]');
  assert.equal(lines[0].list[0].token, '[REDACTED]');
  assert.equal(lines[1].err.message, 'bad');
  assert.equal(lines[1].req, 1);
  assert.equal(redact('x'), 'x');
  const m = createMetrics();
  m.inc('a_total', { x: 'y"z' });
  m.inc('b_total');
  m.observe('lat_seconds', { r: '/' }, 0.02);
  m.observe('lat2_seconds', {}, 3);
  const out = m.render();
  assert.match(out, /a_total\{x="y_z"\} 1/);
  assert.match(out, /^b_total 1$/m);
  assert.match(out, /lat_seconds_bucket\{r="\/",le="0.025"\} 1/);
  assert.match(out, /lat2_seconds_count 1/);
  assert.ok(m.snapshot()['b_total{}'] === 1);
});

test('config: dev defaults, secrets from files, production hard-fails', () => {
  const dev = loadConfig({});
  assert.equal(dev.production, false);
  assert.equal(dev.demoMode, false, 'demo features are opt-in');
  assert.ok(dev.warnings.length >= 3);
  const tmp = path.join(require('os').tmpdir(), `jwt-${process.pid}`);
  fs.writeFileSync(tmp, 'from-file-secret\n');
  assert.equal(loadConfig({ ...testEnv(), JWT_SECRET: undefined, JWT_SECRET_FILE: tmp }).jwtSecret, 'from-file-secret');
  fs.unlinkSync(tmp);
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /Missing required secret/);
  assert.throws(() => loadConfig({ ...testEnv(), NODE_ENV: 'production', DEMO_MODE: 'false' }), /DATABASE_URL is required/);
  const prodEnv = { ...testEnv(), NODE_ENV: 'production', DEMO_MODE: 'false', DATABASE_URL: 'postgres://x/y', RATING_SOURCE: 'core', TASCO_CORE_BASE_URL: 'https://core.example', TASCO_CORE_CLIENT_ID: 'id', TASCO_CORE_CLIENT_SECRET: 'secret' };
  const prod = loadConfig(prodEnv);
  assert.equal(prod.production, true);
  assert.equal(prod.demoMode, false);
  assert.equal(prod.trustProxy, true);
  assert.throws(() => loadConfig({ ...prodEnv, DEMO_MODE: 'true' }), /DEMO_MODE/);
  assert.throws(() => loadConfig({ ...testEnv(), DATA_KEYS: 'k1:c2hvcnQ=' }), /32 bytes/);
  assert.throws(() => loadConfig({ ...testEnv(), DATA_KEY_ACTIVE: 'k9' }), /not present/);
  assert.equal(loadConfig({ ...testEnv(), PORT: 'abc' }).port, 3000);
});

test('errors, util and clock helpers', () => {
  assert.equal(errors.notFound('X').status, 404);
  assert.ok(errors.conflict('c') instanceof AppError);
  assert.equal(errors.tooMany().status, 429);
  assert.equal(errors.locked().status, 423);
  assert.equal(util.daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.equal(util.parseDate('nope'), null);
  assert.equal(util.parseDate(null), null);
  assert.equal(util.fmtDate(util.parseDate(new Date('2026-05-05T10:00:00Z'))), '2026-05-05');
  assert.equal(util.stripDiacritics('Đường Hà Nội'), 'duong ha noi');
  assert.equal(util.maskPhone('0912345678'), '0912***678');
  assert.equal(util.maskPhone('123'), '***');
  assert.equal(util.maskPhone(null), null);
  assert.equal(util.maskName('Nguyễn Văn An'), 'N. V. An');
  assert.equal(util.maskName('An'), 'A***');
  assert.equal(util.maskName(null), null);
  assert.equal(util.viDate('2026-10-07'), '07/10/2026');
  assert.equal(util.viDate(null), '');
  assert.match(util.formatVnd(1000), /₫/);
  assert.equal(util.clamp(5, 0, 1), 1);
  const r = util.rng(1);
  assert.equal(typeof r.pick([1]), 'number');
  assert.equal(r.chance(1), true);
  assert.equal(r.weighted([['a', 0], ['b', 1]]), 'b');
  assert.equal(createClock('2026-01-01').today(), '2026-01-01');
  assert.match(createClock(null).today(), /^\d{4}-\d{2}-\d{2}$/);
});

test('migration 001 matches the collection registry (schema drift guard)', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', '001_init.sql'), 'utf8');
  assert.ok(sql.includes(collectionsDdl().trim()), 'regenerate 001 or add a new migration when schema.js changes');
  assert.match(sql, /audit_log is append-only/);
});
