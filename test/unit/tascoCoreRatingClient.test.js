'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createTascoCoreRatingClient, mapCoreError } = require('../../src/adapters/integrations/tascoCoreRatingClient');

/**
 * TASCO core REST client against a local stub server (no external network):
 * OAuth2 token caching, headers, idempotency, response validation, error
 * mapping, retry, timeout and circuit breaker.
 */

let server;
let base;
let handler;
let seen;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const okToken = (res, n = 1, expires = 3600) => json(res, 200, { access_token: `tok-${n}`, token_type: 'Bearer', expires_in: expires });

function quoteBody(req, overrides = {}) {
  return {
    quoteRef: 'CQ-2026-000123',
    ratingVersion: 'TARIFF-2026.10',
    validUntil: '2026-10-10T00:00:00Z',
    currency: 'VND',
    extraField: 'ignored by tolerant reader',
    lines: req.lines.map((l) => ({ productCode: l.productCode, premiumNet: 437000, vat: 43700, total: 480700, startDate: '2026-10-08', endDate: '2027-10-08', termDays: 365, lineRef: `CL-${l.productCode}`, breakdown: [{ label: 'core' }] })),
    ...overrides,
  };
}

const REQ = {
  idempotencyKey: 'Q-abc', requestId: 'req-1', channel: 'telesales', quoteDate: '2026-10-07', startDate: '2026-10-08', termYears: 1,
  holder: { type: 'individual' }, vehicle: { category: 'car_under6', usage: 'personal', seats: 5, firstRegisteredYear: 2020 },
  lines: [{ product: 'TNDS_CAR', options: {} }],
};

test.before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const rec = { method: req.method, url: req.url, headers: req.headers, body };
      seen.push(rec);
      handler(req, res, rec);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((r) => server.close(r)));
test.beforeEach(() => { seen = []; });

function client(opts = {}) {
  return createTascoCoreRatingClient({ baseUrl: base, clientId: 'growth', clientSecret: 's3cret', scope: 'rating:quote', timeoutMs: 500, retries: 2, baseDelayMs: 1, ...opts });
}

test('quote: OAuth2 client credentials, cached token, idempotency + tracing headers, no PII sent, response mapped', async () => {
  let tokens = 0;
  handler = (req, res, rec) => {
    if (req.url === '/oauth2/token') { tokens++; return okToken(res, tokens); }
    if (req.url === '/rating/v1/quotes') return json(res, 200, quoteBody(JSON.parse(rec.body)));
    return json(res, 404, {});
  };
  const logs = [];
  const logger = { info: (...a) => logs.push(a), warn: (...a) => logs.push(a), error: (...a) => logs.push(a) };
  const c = client({ logger });
  const r1 = await c.quote(REQ);
  const r2 = await c.quote({ ...REQ, idempotencyKey: 'Q-def' });
  assert.equal(tokens, 1, 'token cached across calls');
  assert.equal(r1.coreQuoteRef, 'CQ-2026-000123');
  assert.equal(r1.ratingVersion, 'TARIFF-2026.10');
  assert.equal(r1.validUntil, '2026-10-10T00:00:00.000Z');
  assert.deepEqual(r1.lines[0], { product: 'TNDS_CAR', premiumNet: 437000, vat: 43700, total: 480700, startDate: '2026-10-08', endDate: '2027-10-08', termDays: 365, ratingRef: 'CL-TNDS_CAR', breakdown: [{ label: 'core' }] });
  assert.equal(r2.lines.length, 1);

  const tok = seen.find((s) => s.url === '/oauth2/token');
  assert.equal(tok.method, 'POST');
  assert.equal(tok.headers.authorization, `Basic ${Buffer.from('growth:s3cret').toString('base64')}`);
  assert.equal(tok.headers['content-type'], 'application/x-www-form-urlencoded');
  assert.match(tok.body, /grant_type=client_credentials/);
  assert.match(tok.body, /scope=rating%3Aquote/);

  const calls = seen.filter((s) => s.url === '/rating/v1/quotes');
  assert.equal(calls[0].headers.authorization, 'Bearer tok-1');
  assert.equal(calls[0].headers['idempotency-key'], 'Q-abc');
  assert.equal(calls[1].headers['idempotency-key'], 'Q-def');
  assert.equal(calls[0].headers['x-request-id'], 'req-1');
  const sent = JSON.parse(calls[0].body);
  assert.deepEqual(Object.keys(sent).sort(), ['channel', 'holder', 'lines', 'quoteDate', 'startDate', 'termYears', 'vehicle']);
  assert.deepEqual(Object.keys(sent.vehicle).sort(), ['category', 'firstRegisteredYear', 'seats', 'usage'], 'risk attributes only — no plate');
  assert.deepEqual(sent.lines, [{ productCode: 'TNDS_CAR' }]);
  assert.ok(!JSON.stringify(logs).includes('s3cret') && !JSON.stringify(logs).includes('tok-1'), 'no secrets in logs');
  assert.equal(c.circuit.rating(), 'closed');
  assert.equal(c.mode, 'http');
  assert.match(c.endpoint, /^127\.0\.0\.1:\d+$/);
});

test('token: refreshed before expiry; 401 drops the cached token and the retry succeeds', async () => {
  let tokens = 0;
  let now = 1_000_000;
  let reject401 = false;
  handler = (req, res, rec) => {
    if (req.url === '/oauth2/token') { tokens++; return okToken(res, tokens, 120); }
    if (reject401 && req.headers.authorization === 'Bearer tok-2') return json(res, 401, { error: { code: 'INVALID_TOKEN' } });
    return json(res, 200, quoteBody(JSON.parse(rec.body)));
  };
  const c = client({ now: () => now });
  await c.quote(REQ);
  now += 30_000;
  await c.quote(REQ);
  assert.equal(tokens, 1, 'still valid');
  now += 40_000; // 70 s into a 120 s token: inside the refresh skew (60 s)
  await c.quote(REQ);
  assert.equal(tokens, 2, 'refreshed early');
  reject401 = true;
  const r = await c.quote(REQ);
  assert.equal(tokens, 3, '401 → new token');
  assert.equal(r.coreQuoteRef, 'CQ-2026-000123');
  // Concurrent callers share one token request.
  c.resetToken();
  await Promise.all([c.quote(REQ), c.quote(REQ), c.quote(REQ)]);
  assert.equal(tokens, 4);
});

test('core business errors map to platform errors, are not retried and do not open the circuit', async () => {
  let status = 422;
  let code = 'UNDERWRITING_DECLINED';
  handler = (req, res) => {
    if (req.url === '/oauth2/token') return okToken(res);
    return json(res, status, { error: { code, message: 'Plate 30A-123.45 declined for Nguyễn Văn A' } });
  };
  const c = client({ failureThreshold: 2 });
  const cases = [
    [422, 'UNDERWRITING_DECLINED', 'BUSINESS_RULE_VIOLATION', 422],
    [422, 'REFER_TO_UNDERWRITER', 'BUSINESS_RULE_VIOLATION', 422],
    [400, 'VALIDATION_ERROR', 'VALIDATION_FAILED', 400],
    [400, 'SOMETHING_NEW', 'VALIDATION_FAILED', 400],
    [404, 'PRODUCT_NOT_FOUND', 'BUSINESS_RULE_VIOLATION', 422],
    [409, 'IDEMPOTENCY_CONFLICT', 'CONFLICT', 409],
    [422, '', 'BUSINESS_RULE_VIOLATION', 422],
  ];
  for (const [s, cc, expCode, expStatus] of cases) {
    status = s; code = cc;
    seen = [];
    const err = await c.quote(REQ).catch((e) => e);
    assert.equal(err.code, expCode, `${s} ${cc}`);
    assert.equal(err.status, expStatus);
    assert.equal(err.details.coreStatus, s);
    assert.ok(!err.message.includes('30A') && !err.message.includes('Nguyễn'), 'core message (may hold PII) is never echoed');
    assert.equal(seen.filter((x) => x.url === '/rating/v1/quotes').length, 1, 'not retried');
  }
  assert.equal(c.circuit.rating(), 'closed');
});

test('5xx and 429 are retried, then surface as upstream-unavailable; repeated failure opens the circuit', async () => {
  let calls = 0;
  let status = 503;
  handler = (req, res) => {
    if (req.url === '/oauth2/token') return okToken(res);
    calls++;
    return json(res, status, { error: { code: 'MAINTENANCE' } });
  };
  const c = client({ failureThreshold: 2, retries: 2 });
  const e1 = await c.quote(REQ).catch((e) => e);
  assert.equal(e1.code, 'UPSTREAM_UNAVAILABLE');
  assert.equal(e1.status, 503);
  assert.equal(e1.reason, 'unavailable');
  assert.equal(calls, 3, '1 try + 2 retries');
  status = 429;
  const e2 = await c.quote(REQ).catch((e) => e);
  assert.equal(e2.reason, 'throttled');
  assert.equal(c.circuit.rating(), 'open');
  const before = calls;
  const e3 = await c.quote(REQ).catch((e) => e);
  assert.equal(e3.reason, 'circuit_open');
  assert.equal(calls, before, 'short-circuited: core not called');
  assert.equal(c.circuit.catalogue(), 'closed', 'catalogue has its own breaker');
});

test('timeouts, unreachable core and token failures are upstream-unavailable with a reason', async () => {
  handler = (req, res) => {
    if (req.url === '/oauth2/token') return okToken(res);
    setTimeout(() => json(res, 200, {}), 300);
  };
  const slow = client({ timeoutMs: 50, retries: 0 });
  const e1 = await slow.quote(REQ).catch((e) => e);
  assert.equal(e1.code, 'UPSTREAM_UNAVAILABLE');
  assert.equal(e1.reason, 'timeout');

  const dead = http.createServer();
  await new Promise((r) => dead.listen(0, '127.0.0.1', r));
  const port = dead.address().port;
  await new Promise((r) => dead.close(r));
  const logs = [];
  const gone = createTascoCoreRatingClient({ baseUrl: `http://127.0.0.1:${port}`, clientId: 'x', clientSecret: 'y', timeoutMs: 500, retries: 0, logger: { warn: (m, f) => logs.push(f) } });
  const e2 = await gone.quote(REQ).catch((e) => e);
  assert.equal(e2.reason, 'unavailable');
  assert.ok(logs.length >= 1);

  handler = (req, res) => json(res, 401, { error: 'invalid_client' });
  const badCreds = client({ retries: 0 });
  const e3 = await badCreds.quote(REQ).catch((e) => e);
  assert.equal(e3.reason, 'auth');
  assert.equal(e3.status, 503);

  handler = (req, res) => json(res, 200, { access_token: 'x', token_type: 'mac', expires_in: 60 });
  const e4 = await client({ retries: 0 }).quote(REQ).catch((e) => e);
  assert.equal(e4.reason, 'bad_response');
  handler = (req, res) => json(res, 200, { token_type: 'Bearer' });
  assert.equal((await client({ retries: 0 }).quote(REQ).catch((e) => e)).reason, 'bad_response');
});

test('response schema validation: contract violations are rejected', async () => {
  let body;
  handler = (req, res, rec) => {
    if (req.url === '/oauth2/token') return okToken(res);
    return json(res, 200, typeof body === 'function' ? body(JSON.parse(rec.body)) : body);
  };
  const c = client({ retries: 0, failureThreshold: 100 });
  const bad = [
    (r) => { const b = quoteBody(r); delete b.quoteRef; return b; },
    (r) => quoteBody(r, { validUntil: 'soon' }),
    (r) => { const b = quoteBody(r); b.lines[0].total = 1; return b; },
    (r) => { const b = quoteBody(r); b.lines[0].premiumNet = '437000.5'; return b; },
    (r) => quoteBody(r, { lines: [] }),
    (r) => quoteBody(r, { currency: 'USD' }),
    () => 'not json',
  ];
  for (const b of bad) {
    body = b;
    const e = await c.quote(REQ).catch((x) => x);
    assert.equal(e.code, 'UPSTREAM_UNAVAILABLE');
    assert.equal(e.reason, 'bad_response');
    assert.ok(Array.isArray(e.details.problems));
  }
});

test('catalogue: fetched, validated, tolerant of new fields, duplicates rejected', async () => {
  const products = [
    { code: 'TNDS_CAR', version: '2026.1', name: 'TNDS car', status: 'active', compulsory: true, newCoreField: 1 },
    { code: 'EV_BATTERY', version: '1.0', name: 'EV battery', status: 'active', ratingMethod: 'core_engine' },
  ];
  let payload = { catalogueVersion: 'CAT-42', publishedAt: '2026-10-01T00:00:00Z', products };
  handler = (req, res) => {
    if (req.url === '/oauth2/token') return okToken(res);
    assert.equal(req.method, 'GET');
    assert.equal(req.url, '/products/v1/catalogue');
    return json(res, 200, payload);
  };
  const c = client({ retries: 0 });
  const cat = await c.fetchCatalogue();
  assert.equal(cat.catalogueVersion, 'CAT-42');
  assert.equal(cat.products.length, 2);
  assert.equal(cat.products[0].newCoreField, undefined, 'unknown fields dropped');
  payload = { catalogueVersion: 'CAT-43', products: [products[0], products[0]] };
  assert.equal((await c.fetchCatalogue().catch((e) => e)).reason, 'bad_response');
  payload = { catalogueVersion: 'CAT-44', products: [{ code: 'x', version: '1', name: 'n', status: 'active' }] };
  assert.equal((await c.fetchCatalogue().catch((e) => e)).reason, 'bad_response');
});

test('mapCoreError fallbacks and constructor guard', () => {
  assert.equal(mapCoreError(403, null).reason, 'auth');
  assert.equal(mapCoreError(502, 'html').reason, 'unavailable');
  assert.equal(mapCoreError(409, { code: 'x' }).code, 'CONFLICT');
  assert.equal(mapCoreError(422, { code: 'QUOTE_EXPIRED' }).status, 422);
  assert.equal(mapCoreError(418, {}).details.coreCode, null);
  assert.throws(() => createTascoCoreRatingClient({}), /baseUrl is required/);
});
