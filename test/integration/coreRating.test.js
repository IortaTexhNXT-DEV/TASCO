'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { makeContainer, ACTOR, findProfile, startServer, testEnv } = require('../helpers');
const { loadConfig } = require('../../src/shared/config');
const { createRatingService } = require('../../src/application/ratingService');
const { mergeCatalogue } = require('../../src/application/catalogueService');
const { errors } = require('../../src/shared/errors');
const { tagged } = require('../../src/shared/resilience');

/**
 * TASCO core as the system of record for rating and products:
 * RATING_SOURCE modes, indicative fallback, payment block + re-rate,
 * coreQuoteRef binding, catalogue sync via maker-checker, admin status.
 */

const agent = ACTOR('agent-1', ['telesales_agent']);
const customer = (id) => ({ id: `customer:${id}`, roles: ['customer'], customerId: id });
const tick = () => new Promise((r) => setTimeout(r, 5));
const outage = (reason = 'timeout') => () => { throw tagged(errors.upstream(`core ${reason}`), reason); };

let c; // RATING_SOURCE=core_with_fallback, simulated core
let p;
test.before(async () => {
  c = await makeContainer({ env: { RATING_SOURCE: 'core_with_fallback', SEED_RECORDS: '300' } });
  p = await findProfile(c, (x) => x.ownerType === 'individual' && x.vehicle.category === 'car_under6' && x.policy.insurer !== 'TASCO');
});

test('simulated core prices like local rules but returns a core quote reference and rating version', async () => {
  const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }, { code: 'PA_SEAT', options: { sumInsuredPerSeat: 20000000, seats: 5 } }], channel: 'telesales' }, agent);
  assert.equal(q.ratingSource, 'core');
  assert.equal(q.indicative, false);
  assert.match(q.coreQuoteRef, /^SIMCORE-Q-/);
  assert.match(q.ratingVersion, /^simcore:rating\.pa_seat@1,tariff\.tnds_car@1$/);
  assert.equal(q.lines[0].total, 480700, 'same premium as the regulated tariff');
  assert.equal(q.lines[1].total, 100000);
  assert.equal(q.lines[0].productName, 'Compulsory motor third-party liability (car)');
  assert.match(q.lines[0].ratingRef, /^SIMCORE-L-/);
  assert.equal(q.bundle, 'SAFE_DRIVE');
  assert.ok(q.expiresAt <= new Date(c.clock.now().getTime() + 24 * 3600000).toISOString());
  const audit = await c.services.audit.list({ entityId: q.id });
  assert.equal(audit[0].details.ratingSource, 'core');
});

test('core business answers are never overridden by a local price', async () => {
  const port = c.gateways.coreRating.port;
  c.gateways.coreRating.port = { ...port, quote: async () => { throw errors.rule('This risk must be referred to a TASCO underwriter'); } };
  try {
    await assert.rejects(c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'telesales' }, agent), /referred to a TASCO underwriter/);
  } finally { c.gateways.coreRating.port = port; }
});

test('core_with_fallback: core timeout / open circuit → indicative local quote that cannot be paid until re-rated', async () => {
  const port = c.gateways.coreRating.port;
  c.gateways.coreRating.port = { ...port, quote: outage('timeout') };
  let q;
  try {
    q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'vetc_app' }, agent);
  } finally { c.gateways.coreRating.port = port; }
  assert.equal(q.indicative, true);
  assert.equal(q.ratingSource, 'rules_fallback');
  assert.equal(q.coreQuoteRef, null);
  assert.equal(q.total, 480700, 'indicative price still shown');
  assert.match(q.ratingVersion, /^rules:tariff\.tnds_car@1$/);

  // Payment blocked.
  const err = await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'ind-pay-1' }, customer(q.profileId)).catch((e) => e);
  assert.equal(err.code, 'BUSINESS_RULE_VIOLATION');
  assert.equal(err.details.reason, 'indicative_quote');
  assert.equal((await c.services.sales.getQuote(q.id)).status, 'open', 'quote not claimed');
  assert.equal(await c.store.collection('orders').count({ status: 'pending_payment' }), 0, 'no order, no debit');

  // Re-rate needs core: still down → 503, quote stays indicative.
  c.gateways.coreRating.port = { ...port, quote: outage('circuit_open') };
  try {
    const e = await c.services.sales.rerate(q.id, agent).catch((x) => x);
    assert.equal(e.status, 503);
    assert.equal(e.details.reason, 'circuit_open');
  } finally { c.gateways.coreRating.port = port; }
  assert.equal((await c.services.sales.getQuote(q.id)).indicative, true);

  // Core back → re-rate → payable; core binds the quote it priced.
  const rr = await c.services.sales.rerate(q.id, agent);
  assert.equal(rr.indicative, false);
  assert.equal(rr.ratingSource, 'core');
  assert.match(rr.coreQuoteRef, /^SIMCORE-Q-/);
  assert.equal(rr.previousTotal, 480700);
  await assert.rejects(c.services.sales.rerate(q.id, agent), /no re-rating needed/);
  const issued = [];
  const pa = c.gateways.policyAdmin.port;
  const issue = pa.issuePolicy;
  pa.issuePolicy = async (args) => { issued.push(args); return issue(args); };
  try {
    const r = await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'ind-pay-2' }, customer(q.profileId));
    assert.equal(r.order.status, 'completed');
    assert.equal(r.order.coreQuoteRef, rr.coreQuoteRef);
    assert.equal(r.policies[0].coreQuoteRef, rr.coreQuoteRef);
  } finally { pa.issuePolicy = issue; }
  assert.equal(issued[0].coreQuoteRef, rr.coreQuoteRef, 'coreQuoteRef passed to issuePolicy');
  assert.match(issued[0].coreLineRef, /^SIMCORE-L-/);
  const actions = (await c.services.audit.list({ entityId: q.id })).map((a) => a.action);
  assert.ok(actions.includes('quote.rerated'));
});

test('rating service modes: rules (unchanged), core fails closed, fallback only on unavailability', async () => {
  const products = [{ prod: (await c.services.rules.get('products')).products.find((x) => x.code === 'TNDS_CAR'), options: {} }];
  const request = { idempotencyKey: 'k', channel: 'telesales', quoteDate: '2026-10-07', startDate: '2026-10-08', vehicle: { category: 'car_under6' } };
  const calls = [];
  const gw = (impl) => ({ coreRating: { exec: (fn) => fn(), port: { quote: async (r) => { calls.push(r); return impl(r); } } } });
  const coreOk = gw(async (r) => ({ coreQuoteRef: 'CQ-1', ratingVersion: 'V1', validUntil: '2026-10-08T00:00:00.000Z', lines: r.lines.map((l) => ({ product: l.product, premiumNet: 1000, vat: 100, total: 1100, startDate: '2026-10-08', endDate: '2027-10-08', termDays: 365, ratingRef: null })) }));
  const coreDown = gw(outage('timeout'));

  const rulesSvc = createRatingService({ rules: c.services.rules, gateways: coreOk, config: { ratingSource: 'rules' } });
  const local = await rulesSvc.rate({ products, request });
  assert.equal(local.ratingSource, 'rules');
  assert.equal(local.lines[0].total, 480700);
  assert.equal(local.lines[0].ratingRef, undefined, 'rules mode lines unchanged');
  assert.equal(calls.length, 0, 'rules mode never calls core');

  const coreSvc = createRatingService({ rules: c.services.rules, gateways: coreOk, config: { ratingSource: 'core' } });
  const viaCore = await coreSvc.rate({ products, request });
  assert.equal(viaCore.lines[0].total, 1100, 'core price wins');
  assert.equal(viaCore.coreQuoteRef, 'CQ-1');
  assert.equal(viaCore.coreValidUntil, '2026-10-08T00:00:00.000Z');
  assert.equal(calls[0].lines[0].product, 'TNDS_CAR');
  assert.ok(calls[0].requestId);

  const closed = createRatingService({ rules: c.services.rules, gateways: coreDown, config: { ratingSource: 'core' } });
  const e = await closed.rate({ products, request }).catch((x) => x);
  assert.equal(e.status, 503);
  assert.equal(e.code, 'UPSTREAM_UNAVAILABLE');
  assert.match(e.message, /temporarily unavailable/);
  assert.equal(e.details.ratingSource, 'core');

  const fb = createRatingService({ rules: c.services.rules, gateways: coreDown, config: { ratingSource: 'core_with_fallback' } });
  const ind = await fb.rate({ products, request });
  assert.equal(ind.indicative, true);
  assert.equal(ind.fallbackReason, 'timeout');
  // coreOnly (re-rate) never falls back.
  assert.equal((await fb.rate({ products, request, coreOnly: true }).catch((x) => x)).status, 503);
  // A non-availability failure (programming error) is not masked by the fallback.
  const boom = createRatingService({ rules: c.services.rules, gateways: gw(async () => { throw new TypeError('bug'); }), config: { ratingSource: 'core_with_fallback' } });
  await assert.rejects(boom.rate({ products, request }), TypeError);
  // Core-only product during an outage → 503, not a misleading local error.
  const coreOnlyProduct = [{ prod: { ...products[0].prod, code: 'EV_X', rating: { method: 'core', ruleKind: null } }, options: {} }];
  assert.equal((await fb.rate({ products: coreOnlyProduct, request }).catch((x) => x)).status, 503);
  await assert.rejects(rulesSvc.rate({ products: coreOnlyProduct, request }), /priced by TASCO core only/);
});

test('RATING_SOURCE=core against a real HTTP core (local stub): quote → pay → issue binds coreQuoteRef', async () => {
  const seen = [];
  let down = false;
  const coreValidUntil = new Date(Math.floor(Date.now() / 1000) * 1000 + 2 * 3600000).toISOString();
  const stub = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      seen.push({ url: req.url, headers: req.headers, body });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/oauth2/token') return res.end(JSON.stringify({ access_token: 'T', token_type: 'Bearer', expires_in: 3600 }));
      if (down) { res.statusCode = 503; return res.end('{}'); }
      const r = JSON.parse(body);
      res.end(JSON.stringify({
        quoteRef: 'CORE-Q-777', ratingVersion: 'CORE-2026.10', validUntil: coreValidUntil,
        lines: r.lines.map((l) => ({ productCode: l.productCode, premiumNet: 437000, vat: 43700, total: 480700, startDate: r.startDate, endDate: '2027-10-08', lineRef: `L-${l.productCode}` })),
      }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));
  const k = await makeContainer({ env: { RATING_SOURCE: 'core', TASCO_CORE_BASE_URL: `http://127.0.0.1:${stub.address().port}`, TASCO_CORE_CLIENT_ID: 'growth', TASCO_CORE_CLIENT_SECRET: 'sec', TASCO_CORE_TIMEOUT_MS: '1000', SEED_RECORDS: '120' } });
  try {
    assert.equal(k.gateways.coreRating.mode, 'http');
    const prof = await findProfile(k, (x) => x.ownerType === 'individual' && x.vehicle.category === 'car_under6');
    const q = await k.services.sales.quote({ profileId: prof.id, products: [{ code: 'TNDS_CAR' }], channel: 'vetc_app' }, agent);
    assert.equal(q.coreQuoteRef, 'CORE-Q-777');
    assert.equal(q.ratingVersion, 'CORE-2026.10');
    assert.equal(q.ratingSource, 'core');
    assert.equal(q.expiresAt, coreValidUntil, 'quote validity capped by core validity (2 h < 24 h platform TTL)');
    const quoteCall = seen.find((s) => s.url === '/rating/v1/quotes');
    assert.equal(quoteCall.headers['idempotency-key'], q.id);
    assert.ok(!quoteCall.body.includes(prof.plate) && !quoteCall.body.includes(prof.id), 'no plate sent for rating');
    if (prof.name) assert.ok(!quoteCall.body.includes(prof.name));

    const r = await k.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'core-pay-1' }, customer(prof.id));
    assert.equal(r.policies[0].coreQuoteRef, 'CORE-Q-777');

    // Fail closed: core down → 503 with a clear message, nothing stored.
    down = true;
    const before = await k.store.collection('quotes').count({});
    const e = await k.services.sales.quote({ profileId: prof.id, products: [{ code: 'TNDS_CAR' }], channel: 'vetc_app' }, agent).catch((x) => x);
    assert.equal(e.status, 503);
    assert.match(e.message, /TASCO core rating is temporarily unavailable/);
    assert.equal(await k.store.collection('quotes').count({}), before);
  } finally {
    await new Promise((r) => stub.close(r));
  }
});

test('catalogue sync: proposes a products draft via maker-checker, never activates, audits the diff', async () => {
  const actor = 'ops-tester';
  const active0 = await c.services.rules.getRecord('products');

  // Simulated core: first sync records core product versions → a proposal.
  const r1 = await c.services.catalogue.sync(actor);
  assert.equal(r1.status, 'proposed');
  assert.ok(r1.runId);
  assert.equal(r1.ruleSetStatus, 'pending_approval');
  assert.deepEqual(r1.added, []);
  assert.ok(r1.changed.every((x) => x.fields.includes('coreVersion')));
  const draft = await c.services.rules.byId(r1.ruleSetId);
  assert.equal(draft.createdBy, 'system:catalogue-sync');
  assert.equal(draft.status, 'pending_approval');
  assert.equal((await c.services.rules.getRecord('products')).id, active0.id, 'nothing auto-activated');

  // Same catalogue again → not queued twice.
  const r2 = await c.services.catalogue.sync(actor);
  assert.equal(r2.status, 'already_proposed');
  assert.equal(r2.ruleSetId, r1.ruleSetId);

  // Core changes: new product, renamed product, withdrawn product, product suspended.
  const cat = c.gateways.productCatalogue;
  const original = cat.port;
  const base = await original.fetchCatalogue();
  cat.port = {
    ...original,
    fetchCatalogue: async () => ({
      catalogueVersion: 'CORE-CAT-2026.11',
      products: [
        ...base.products.filter((x) => x.code !== 'TNDS_MOTORBIKE').map((x) => (x.code === 'MOTOR_PD' ? { ...x, name: 'Motor own damage (2026)', version: 'MOTOR_PD-v2' } : x.code === 'PA_SEAT' ? { ...x, status: 'inactive' } : x)),
        { code: 'EV_BATTERY', version: '1.0', name: 'EV battery cover', status: 'active', ratingMethod: 'core_engine' },
      ],
    }),
  };
  await tick(); // job runs are ordered by start time (ms resolution)
  let r3;
  try { r3 = await c.services.catalogue.sync(actor); } finally { cat.port = original; }
  assert.equal(r3.status, 'proposed');
  assert.equal(r3.catalogueVersion, 'CORE-CAT-2026.11');
  assert.deepEqual(r3.added, ['EV_BATTERY']);
  assert.deepEqual(r3.withdrawn, ['TNDS_MOTORBIKE']);
  const pd = r3.changed.find((x) => x.code === 'MOTOR_PD');
  assert.ok(pd.fields.includes('name') && pd.fields.includes('coreVersion'));
  assert.deepEqual(r3.changed.find((x) => x.code === 'PA_SEAT').status, { from: 'active', to: 'inactive' });

  const proposal = await c.services.rules.byId(r3.ruleSetId);
  const ev = proposal.payload.products.find((x) => x.code === 'EV_BATTERY');
  assert.deepEqual(ev.channels, [], 'new core products are not distributed until configured');
  assert.equal(ev.rating.method, 'core');
  assert.equal(proposal.payload.products.find((x) => x.code === 'TNDS_MOTORBIKE').status, 'withdrawn');
  assert.equal(proposal.payload.products.find((x) => x.code === 'TNDS_CAR').channels.length, active0.payload.products.find((x) => x.code === 'TNDS_CAR').channels.length, 'platform-owned distribution preserved');
  assert.deepEqual(proposal.payload.bundles, active0.payload.bundles);
  assert.equal(proposal.payload.coreCatalogue.version, 'CORE-CAT-2026.11');

  // Diff summary in the audit log.
  const audit = await c.services.audit.list({ entityId: r3.ruleSetId, action: 'catalogue.sync_proposed' });
  const entry = audit.find((a) => a.action === 'catalogue.sync_proposed');
  assert.deepEqual(entry.details.added, ['EV_BATTERY']);
  assert.deepEqual(entry.details.withdrawn, ['TNDS_MOTORBIKE']);
  assert.ok((await c.services.audit.list({ action: 'job.catalogue_sync' })).length >= 3);

  // Maker-checker: the system cannot approve its own proposal; a human approver can.
  await assert.rejects(c.services.rules.approve(r3.ruleSetId, { id: 'system:catalogue-sync', roles: ['rule_approver'] }), /cannot approve your own/);
  await c.services.rules.approve(r3.ruleSetId, ACTOR('approver-1', ['rule_approver']));
  assert.equal((await c.services.rules.getRecord('products')).id, r3.ruleSetId);
  await assert.rejects(c.services.sales.quote({ profileId: p.id, products: [{ code: 'PA_SEAT', options: { sumInsuredPerSeat: 20000000 } }], channel: 'telesales' }, agent), /not on sale/);
  await assert.rejects(c.services.sales.quote({ profileId: p.id, products: [{ code: 'EV_BATTERY' }], channel: 'telesales' }, agent), /not sold on channel/);

  const last = await c.services.catalogue.lastSync();
  assert.equal(last.status, 'succeeded');
  assert.equal(last.outcome, 'proposed');
  assert.equal(last.catalogueVersion, 'CORE-CAT-2026.11');
  assert.equal(last.added, 1);

  // Core unavailable → job fails and is recorded; nothing proposed.
  await tick();
  cat.port = { ...original, fetchCatalogue: outage('unavailable') };
  try { await assert.rejects(c.services.catalogue.sync(actor), /core unavailable/); } finally { cat.port = original; }
  const failed = await c.services.catalogue.lastSync();
  assert.equal(failed.status, 'failed');
  assert.ok(failed.error);

  // Restore the original catalogue for later tests.
  const back = await c.services.rules.rollback(active0.id, ACTOR('author-1', ['rule_author']));
  await c.services.rules.submit(back.id, ACTOR('author-1', ['rule_author']));
  await c.services.rules.approve(back.id, ACTOR('approver-1', ['rule_approver']));
});

test('mergeCatalogue: unchanged catalogue is a no-op; already-withdrawn products stay quiet', () => {
  const current = { products: [{ code: 'A', name: 'A', status: 'active', coreVersion: '1', compulsory: false, rating: { method: 'per_seat', ruleKind: 'x' }, channels: ['zalo'] }, { code: 'OLD', name: 'Old', status: 'withdrawn', rating: { method: 'per_seat', ruleKind: 'x' }, channels: [] }], bundles: [] };
  const { diff, payload } = mergeCatalogue(current, { catalogueVersion: 'v', products: [{ code: 'A', name: 'A', status: 'active', version: '1' }] });
  assert.equal(diff.hasChanges, false);
  assert.equal(diff.unchanged, 2);
  assert.equal(payload.products[1].status, 'withdrawn');
});

test('integration status endpoint (ops permission) and catalogue-sync ops job', async () => {
  const srv = await startServer(c);
  try {
    const support = await srv.login('support');
    const st = await srv.call('GET', '/api/integrations/status', { token: support });
    assert.equal(st.status, 200);
    assert.equal(st.body.rating.source, 'core_with_fallback');
    assert.equal(st.body.rating.fallbackToIndicative, true);
    assert.equal(st.body.rating.failClosed, false);
    assert.equal(st.body.rating.core.mode, 'simulated');
    assert.equal(st.body.rating.core.circuit, 'closed');
    assert.ok(st.body.catalogue.lastSync.runId);
    assert.equal(st.body.policyAdministration.circuit, 'closed');
    const agentTok = await srv.login('agent.hn');
    assert.equal((await srv.call('GET', '/api/integrations/status', { token: agentTok })).status, 403);
    assert.equal((await srv.call('GET', '/api/integrations/status')).status, 401);
    const job = await srv.call('POST', '/api/ops/jobs/catalogue-sync', { token: support });
    assert.equal(job.status, 200);
    assert.ok(['proposed', 'already_proposed', 'no_change'].includes(job.body.status));
    const ops = await srv.call('GET', '/api/ops/status', { token: support });
    assert.ok(ops.body.integrations.some((i) => i.name === 'tasco-core-rating'));
    const spec = await srv.call('GET', '/api/openapi.json');
    assert.equal(spec.body.paths['/api/integrations/status'].get['x-permission'], 'ops:read');
    assert.ok(spec.body.paths['/api/quotes/{id}/rerate'].post);

    // Staff/customer re-rate endpoints: a core-priced quote needs no re-rating.
    const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'vetc_app' }, agent);
    const sup = await srv.login('supervisor');
    assert.equal((await srv.call('POST', `/api/quotes/${q.id}/rerate`, { token: sup })).status, 422);
    const sess = await srv.call('POST', '/api/customer/session', { body: { demoProfileId: p.id } });
    assert.equal((await srv.call('POST', `/api/customer/quotes/${q.id}/rerate`, { token: sess.body.token })).status, 422);
    const other = await findProfile(c, (x) => x.id !== p.id && !x.anonymised);
    const sess2 = await srv.call('POST', '/api/customer/session', { body: { demoProfileId: other.id } });
    assert.equal((await srv.call('POST', `/api/customer/quotes/${q.id}/rerate`, { token: sess2.body.token })).status, 404);
  } finally {
    await srv.close();
  }
});

test('config: RATING_SOURCE values and production guards', () => {
  assert.equal(loadConfig(testEnv()).ratingSource, 'rules', 'default keeps current behaviour');
  assert.throws(() => loadConfig(testEnv({ RATING_SOURCE: 'magic' })), /RATING_SOURCE must be one of/);
  assert.throws(() => loadConfig(testEnv({ TASCO_CORE_BASE_URL: 'ftp://core' })), /http\(s\) URL/);
  const dev = loadConfig(testEnv({ RATING_SOURCE: 'core' }));
  assert.ok(dev.warnings.some((w) => /simulated TASCO core/.test(w)));
  const withUrl = loadConfig(testEnv({ TASCO_CORE_BASE_URL: 'https://core.example/api/', TASCO_CORE_TIMEOUT_MS: '2500' }));
  assert.equal(withUrl.tascoCore.baseUrl, 'https://core.example/api');
  assert.equal(withUrl.tascoCore.tokenUrl, 'https://core.example/api/oauth2/token');
  assert.equal(withUrl.tascoCore.timeoutMs, 2500);

  const prod = testEnv({ NODE_ENV: 'production', DEMO_MODE: 'false', DATABASE_URL: 'postgres://x/y' });
  assert.throws(() => loadConfig(prod), /not allowed in production/);
  assert.equal(loadConfig({ ...prod, ALLOW_LOCAL_RATING: 'true' }).ratingSource, 'rules', 'explicit override');
  assert.throws(() => loadConfig({ ...prod, RATING_SOURCE: 'core' }), /TASCO_CORE_BASE_URL is required/);
  assert.throws(() => loadConfig({ ...prod, RATING_SOURCE: 'core', TASCO_CORE_BASE_URL: 'http://core' }), /must use https/);
  assert.throws(() => loadConfig({ ...prod, RATING_SOURCE: 'core', TASCO_CORE_BASE_URL: 'https://core' }), /TASCO_CORE_CLIENT_ID and TASCO_CORE_CLIENT_SECRET/);
  const ok = loadConfig({ ...prod, RATING_SOURCE: 'core_with_fallback', TASCO_CORE_BASE_URL: 'https://core', TASCO_CORE_CLIENT_ID: 'id', TASCO_CORE_CLIENT_SECRET: 's' });
  assert.equal(ok.ratingSource, 'core_with_fallback');
  assert.equal(ok.tascoCore.clientSecret, 's');
});
