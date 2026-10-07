'use strict';

/**
 * Security regression suite (OWASP Top 10 oriented). Runs against a real HTTP
 * server with production-like limits.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { makeContainer, startServer, findProfile } = require('../helpers');

let c;
let srv;
test.before(async () => {
  c = await makeContainer({ env: { RATE_LIMIT_LOGIN_MAX: '30', BODY_LIMIT_BYTES: '2048' } });
  srv = await startServer(c);
});
test.after(async () => { await srv.close(); });

test('A01 broken access control: role, region, IDOR and staff/customer token separation', async () => {
  const exec = await srv.login('exec');
  for (const [m, p] of [['GET', '/api/users'], ['GET', '/api/audit'], ['POST', '/api/journeys/run'], ['GET', '/api/handoffs'], ['POST', '/api/rules']]) {
    assert.equal((await srv.call(m, p, { token: exec, body: m === 'POST' ? {} : undefined })).status, 403, `${m} ${p}`);
  }
  const p = await findProfile(c, () => true);
  const cust = (await srv.call('POST', '/api/customer/session', { body: { demoProfileId: p.id } })).body.token;
  assert.equal((await srv.call('GET', '/api/dashboard/overview', { token: cust })).status, 403);
  const staff = await srv.login('campaign');
  assert.equal((await srv.call('GET', '/api/customer/home', { token: staff })).status, 403);
});

test('A02 cryptographic failures: PII encrypted at rest, secrets never returned', async () => {
  const p = await findProfile(c, (x) => x.phone && x.name);
  const raw = await c.store.collection('profiles').raw(p.id);
  const blob = JSON.stringify(raw);
  assert.ok(!blob.includes(p.phone), 'phone not stored in clear');
  assert.ok(!blob.includes(p.name), 'name not stored in clear');
  const admin = await srv.login('admin');
  const users = await srv.call('GET', '/api/users', { token: admin });
  const s = JSON.stringify(users.body);
  assert.ok(!s.includes('passwordHash') && !s.includes('totpSecret'));
  const u = (await c.store.collection('users').find({ limit: 1 }))[0];
  assert.match(u.passwordHash, /^scrypt\$/);
});

test('A03 injection: unknown filter columns, oversized/hostile inputs, JSON-only bodies', async () => {
  const t = await srv.login('campaign');
  const sqli = await srv.call('GET', `/api/leads?tier=${encodeURIComponent("hot' OR 1=1 --")}`, { token: t });
  assert.equal(sqli.status, 400);
  const extra = await srv.call('GET', '/api/leads?region=x&evil=1', { token: t });
  assert.equal(extra.status, 400, 'unknown query params rejected');
  const ct = await srv.call('POST', '/api/journeys/run', { token: t, raw: 'date=2026-01-01', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(ct.status, 415);
  const bad = await srv.call('POST', '/api/journeys/run', { token: t, raw: '{not json', headers: { 'Content-Type': 'application/json' } });
  assert.equal(bad.status, 400);
  const arr = await srv.call('POST', '/api/journeys/run', { token: t, raw: '[1,2]', headers: { 'Content-Type': 'application/json' } });
  assert.equal(arr.status, 400);
  const big = await srv.call('POST', '/api/journeys/run', { token: t, body: { date: '2026-01-01', at: 'x'.repeat(5000) } });
  assert.equal(big.status, 413);
  const proto = await srv.call('POST', '/api/rules/validate', { token: await srv.login('author'), body: { kind: 'nba', payload: { rules: [{ id: 'x', when: { var: '__proto__.x' }, then: {} }], hitPolicy: 'first' } } });
  assert.ok(proto.body.errors.some((e) => e.includes('forbidden')));
});

test('A05 security misconfiguration: headers, no stack traces, path traversal, CORS', async () => {
  const r = await srv.call('GET', '/api/meta');
  for (const h of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'x-request-id']) assert.ok(r.headers.get(h), h);
  assert.equal(r.headers.get('x-powered-by'), null);
  for (const p of ['/../package.json', '/%2e%2e/package.json', '/css/../../src/server.js', '/..%2f..%2fpackage.json']) {
    const res = await fetch(srv.base + p);
    assert.ok([400, 404].includes(res.status), p);
    assert.ok(!(await res.text()).includes('"dependencies"'));
  }
  const cors = await fetch(`${srv.base}/api/meta`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(cors.status, 403);
  const same = await fetch(`${srv.base}/api/meta`, { headers: { Origin: srv.base } });
  assert.equal(same.status, 200);
  const err = await srv.call('GET', '/api/customers/%E0%A4%A', { token: await srv.login('campaign') });
  assert.ok(!JSON.stringify(err.body).includes('at '), 'no stack traces');
});

test('A07 identification & authentication: alg=none, forged and expired tokens, brute force', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub: 'U-x', roles: ['admin'], aud: 'staff', exp: 9999999999 })).toString('base64url');
  assert.equal((await srv.call('GET', '/api/users', { token: `${header}.${body}.` })).status, 401);
  const forged = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${body}.${crypto.createHmac('sha256', 'guess').update('x').digest('base64url')}`;
  assert.equal((await srv.call('GET', '/api/users', { token: forged })).status, 401);
  const mfaToken = (await srv.call('POST', '/api/auth/login', { body: { username: 'admin', password: 'Tasco@Demo2026!' } })).body.mfaToken;
  assert.equal((await srv.call('GET', '/api/users', { token: mfaToken })).status, 401, 'MFA challenge token is not an access token');
  let locked = false;
  for (let i = 0; i < 8; i++) {
    const r = await srv.call('POST', '/api/auth/login', { body: { username: 'auditor', password: `wrong-${i}` } });
    if (r.status === 423) locked = true;
  }
  assert.ok(locked || (await srv.call('POST', '/api/auth/login', { body: { username: 'auditor', password: 'Tasco@Demo2026!' } })).status === 423);
  const unknown = await srv.call('POST', '/api/auth/login', { body: { username: 'ghost', password: 'x' } });
  assert.equal(unknown.body.error.message, 'Invalid username or password', 'no user enumeration');
});

test('rate limiting on sign-in returns 429 with Retry-After', async () => {
  let limited = null;
  for (let i = 0; i < 40 && !limited; i++) {
    const r = await srv.call('POST', '/api/auth/login', { body: { username: 'nobody', password: 'x' } });
    if (r.status === 429) limited = r;
  }
  assert.ok(limited, 'eventually rate limited');
  assert.ok(limited.headers.get('retry-after'));
});

test('A08/A09 integrity & logging: audit chain intact; signed links cannot be forged', async () => {
  assert.equal((await c.services.audit.verify()).ok, true);
  const p = await findProfile(c, () => true);
  assert.equal(c.links.verify(`${p.id}.AAAAAAAAAAAAAAAA`), null);
  assert.equal(c.links.verify('garbage'), null);
  assert.equal(c.links.verify(c.links.sign(p.id)), p.id);
  const actions = (await c.services.audit.list({ limit: 1000 })).map((a) => a.action);
  assert.ok(actions.includes('auth.login_failed'));
});

test('demo endpoints are disabled when DEMO_MODE is off', async () => {
  const prodLike = await makeContainer({ env: { DEMO_MODE: 'false' }, seed: false });
  await require('../../src/bootstrap/seed').seedRules(prodLike);
  const s2 = await startServer(prodLike);
  assert.equal((await s2.call('GET', '/api/demo/totp/admin')).status, 404);
  assert.equal((await s2.call('POST', '/api/customer/session', { body: { demoProfileId: 'X' } })).status, 401);
  assert.equal((await s2.call('GET', '/api/meta')).body.demoCustomers, undefined);
  await s2.close();
});

test('hardening regressions: proxy IP, metrics auth, key scopes, malformed paths, link expiry, erasure', async () => {
  const hc = await makeContainer({ env: { TRUST_PROXY: 'true', METRICS_TOKEN: 'mt-secret', RATE_LIMIT_LOGIN_MAX: '3' } });
  const s = await startServer(hc);
  // Spoofed left-most X-Forwarded-For values must not reset the login limiter.
  let limited = false;
  for (let i = 0; i < 6; i++) {
    const r = await s.call('POST', '/api/auth/login', { body: { username: 'x', password: 'y' }, headers: { 'X-Forwarded-For': `10.0.0.${i}, 203.0.113.9` } });
    if (r.status === 429) limited = true;
  }
  assert.ok(limited, 'rotating spoofed client IPs does not bypass rate limiting');
  assert.equal((await s.call('GET', '/metrics')).status, 401);
  assert.equal((await s.call('GET', '/metrics', { headers: { Authorization: 'Bearer mt-secret' } })).status, 200);
  assert.equal((await s.call('GET', '/api/public/certificates/%E0%A4%A')).status, 400);
  const k = await hc.services.partners.issueApiKey('P-AGENT-01', { id: 'pm' }, { scopes: ['policies:read'] });
  assert.equal((await s.call('POST', '/api/partner/v1/quotes', { headers: { 'X-Api-Key': k.apiKey }, body: { plate: '30A-123.45', products: [{ code: 'TNDS_CAR' }] } })).status, 403);
  assert.equal((await s.call('GET', '/api/partner/v1/policies', { headers: { 'X-Api-Key': k.apiKey } })).status, 200);
  const p = await findProfile(hc, (x) => !x.anonymised && x.policy.insurer !== 'TASCO');
  assert.equal(hc.links.verify(hc.links.sign(p.id, -1)), null, 'expired links are rejected');
  const tok = (await s.call('POST', '/api/customer/session', { body: { link: hc.links.sign(p.id) } })).body.token;
  assert.equal((await s.call('GET', '/api/customer/home', { token: tok })).status, 200);
  await hc.services.customers.erase(p.id, { id: 'dpo', roles: ['compliance_officer'] });
  assert.equal((await s.call('GET', '/api/customer/home', { token: tok })).status, 401, 'erased subject loses session');
  await s.close();
});

test('concurrent purchases of one quote cannot double-charge', async () => {
  const p = await findProfile(c, (x) => !x.anonymised && x.ownerType === 'individual' && x.policy.insurer !== 'TASCO' && x.vehicle.category === 'car_6_11');
  const me = { id: `customer:${p.id}`, roles: ['customer'], customerId: p.id };
  const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'vetc_app' }, me);
  const results = await Promise.allSettled([
    c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'race-aaaa-1' }, me),
    c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'race-bbbb-2' }, me),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(results.find((r) => r.status === 'rejected').reason.message, /already being paid|Quote is/);
  assert.equal((await c.services.sales.listOrders({ profileId: p.id, status: 'completed' })).length, 1);
});

test('security-sensitive rule kinds need a compliance officer to approve', async () => {
  const author = { id: 'au', roles: ['rule_author'] };
  const approver = { id: 'ap', roles: ['rule_approver'] };
  const dpo = { id: 'co', roles: ['compliance_officer'] };
  const guard = await c.services.rules.get('copy_guard');
  const d = await c.services.rules.createDraft({ kind: 'copy_guard', payload: { ...guard, bannedPhrases: [...guard.bannedPhrases, 'miễn phí bảo hiểm'] } }, author);
  await c.services.rules.submit(d.id, author);
  await assert.rejects(c.services.rules.approve(d.id, approver), /compliance_officer/);
  assert.equal((await c.services.rules.approve(d.id, dpo)).status, 'active');
});

test('ABAC cannot be widened by adding an unrelated role', async () => {
  const agentExec = { id: 'ae', roles: ['telesales_agent', 'executive'], region: 'Hà Nội' };
  await assert.rejects(c.services.access.check(agentExec, 'read', { type: 'profile', region: 'Đà Nẵng' }), /regional_data/);
  const agentSup = { id: 'as', roles: ['telesales_agent', 'campaign_manager'], region: 'Hà Nội' };
  await c.services.access.check(agentSup, 'read', { type: 'profile', region: 'Đà Nẵng' });
});
