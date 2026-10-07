'use strict';

/** Functional acceptance tests — EP-09 Partners, EP-10 Fleet, EP-11 Claims, EP-12 Privacy, EP-13 Rules, EP-14 Identity & audit, EP-15 Ops & insights. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, individual } = require('./fx');
const { totp } = require('../../src/shared/crypto');

let f;
let pol; let ct; let claimId; let custProfile;
test.before(async () => {
  f = await setup();
  await claimsFixture();
});
test.after(async () => { await f.srv.close(); });

// ---------- EP-09 Partner channel
let partner; let key; let partnerQuote;
test('US-049 · Onboard and issue key', async () => {
  const t = await f.as('partners');
  partner = (await f.call('POST', '/api/partners', { token: t, body: { name: 'Showroom Hanoi', type: 'showroom' } })).body;
  key = (await f.call('POST', `/api/partners/${partner.id}/keys`, { token: t })).body.apiKey;
  assert.match(key, /^tpk_/);
  const stored = await f.c.store.collection('api_keys').find({ where: { partner_id: partner.id } });
  assert.ok(!JSON.stringify(stored).includes(key), 'only a hash is stored');
});
test('US-050 · Unknown plate becomes a new profile', async () => {
  const r = await f.call('POST', '/api/partner/v1/quotes', { headers: { 'X-Api-Key': key }, body: { plate: '30K-777.88', holderName: 'Lê Mới', phone: '0912777888', seats: 5, usage: 'personal', products: [{ code: 'TNDS_CAR' }] } });
  assert.equal(r.status, 200);
  partnerQuote = r.body;
  const p = await f.c.store.collection('profiles').get('30K77788');
  assert.ok(p.sources.includes('partner_showroom'));
});
test('US-050 · Product not sold on partner channel', async () => {
  const r = await f.call('POST', '/api/partner/v1/quotes', { headers: { 'X-Api-Key': key }, body: { plate: '30K-777.88', products: [{ code: 'TNDS_MOTORBIKE', options: { category: 'moto_over50cc' } }] } });
  assert.equal(r.status, 422);
});
test('US-051 · Own quote', async () => {
  const r = await f.call('POST', '/api/partner/v1/orders', { headers: { 'X-Api-Key': key, 'Idempotency-Key': 'fx-us051-01' }, body: { quoteId: partnerQuote.id } });
  assert.equal(r.body.order.status, 'completed');
  assert.match(r.body.order.paymentRef, /^PARTNER-/);
});
test("US-051 · Another partner's quote", async () => {
  const other = (await f.call('POST', '/api/partners/P-AGENT-01/keys', { token: await f.as('partners') })).body.apiKey;
  const q = await f.call('POST', '/api/partner/v1/quotes', { headers: { 'X-Api-Key': key }, body: { plate: '30K-777.88', products: [{ code: 'TNDS_CAR' }] } });
  assert.equal((await f.call('POST', '/api/partner/v1/orders', { headers: { 'X-Api-Key': other, 'Idempotency-Key': 'fx-us051-02' }, body: { quoteId: q.body.id } })).status, 404);
});
test('US-052 · Statement', async () => {
  const r = await f.call('GET', '/api/partner/v1/statement', { headers: { 'X-Api-Key': key } });
  assert.equal(r.body.orders, 1);
  assert.equal(r.body.lines[0].rate, 0.05);
  assert.equal(r.body.totalCommission, Math.round(437000 * 0.05));
});
test('US-052 · Cap enforced', async () => {
  const comm = await f.c.services.rules.get('commission');
  const bad = structuredClone(comm);
  bad.table.rules[0].then.rate = 0.08;
  const r = await f.call('POST', '/api/rules/validate', { token: await f.as('author'), body: { kind: 'commission', payload: bad } });
  assert.ok(r.body.errors.some((e) => e.includes('statutory cap')));
});
test('US-053 · Suspension blocks API access', async () => {
  await f.call('PATCH', `/api/partners/${partner.id}`, { token: await f.as('partners'), body: { status: 'suspended' } });
  assert.equal((await f.call('GET', '/api/partner/v1/policies', { headers: { 'X-Api-Key': key } })).status, 401);
});

// ---------- EP-10 Fleet / B2B
test('US-054 · Fleet routing', async () => {
  const p = await f.profile((x) => x.ownerType === 'company' && !x.consent.dnc);
  assert.equal((await f.c.store.collection('leads').get(p.id)).nextBestAction.action, 'route_b2b');
});
test('US-054 · No B2C journeys for fleet (target behaviour)', async () => {
  const fleet = (await f.c.store.collection('profiles').find({ where: { owner_type: 'company' }, limit: 500 })).map((p) => p.id);
  const leads = await f.c.store.collection('leads').find({ where: { id: { in: fleet } }, limit: 500 });
  assert.ok(leads.length > 0 && leads.every((l) => l.journey === null));
  assert.equal(await f.c.store.collection('touchpoints').count({ profile_id: { in: fleet }, status: 'scheduled' }), 0);
});
test.todo('US-055 · Fleet view — consolidated fleet dashboard is on the roadmap (benefit marked available=false)');

// ---------- EP-11 Claims FNOL
async function claimsFixture() {
  custProfile = await f.profile((x) => individual(x) && x.policy.insurer !== 'TASCO' && x.vehicle.category === 'car_under6');
  ct = await f.customer(custProfile.id);
  const q = await f.call('POST', '/api/customer/quotes', { token: ct, body: { products: [{ code: 'TNDS_CAR' }] } });
  pol = (await f.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': 'fx-claims-01' } })).body.policies[0];
}
test('US-056 · Valid FNOL', async () => {
  const r = await f.call('POST', '/api/customer/claims', { token: ct, body: { policyId: pol.certNo, incidentDate: pol.startDate, description: 'Rear-ended at toll plaza', location: 'Cao tốc Pháp Vân, km 12', photos: 3 } });
  assert.equal(r.body.status, 'submitted');
  assert.ok(r.body.slaDueAt);
  claimId = r.body.id;
  const msgs = await f.c.store.collection('messages').find({ where: { profile_id: custProfile.id }, limit: 50 });
  assert.ok(msgs.some((m) => m.templateKey === 'claim_received') || !custProfile.channels.app_push);
});
test('US-056 · Outside policy period', async () => {
  assert.equal((await f.call('POST', '/api/customer/claims', { token: ct, body: { policyId: pol.certNo, incidentDate: '2020-01-01', description: 'x' } })).status, 422);
});
test('US-056 · Not my policy', async () => {
  const other = await f.customer((await f.profile((x) => individual(x) && x.id !== custProfile.id)).id);
  assert.equal((await f.call('POST', '/api/customer/claims', { token: other, body: { policyId: pol.certNo, incidentDate: pol.startDate, description: 'x' } })).status, 404);
});
test('US-057 · Valid transition', async () => {
  assert.equal((await f.call('PATCH', `/api/claims/${claimId}`, { token: await f.as('claims'), body: { status: 'acknowledged' } })).body.status, 'acknowledged');
});
test('US-057 · Skipping steps', async () => {
  assert.equal((await f.call('PATCH', `/api/claims/${claimId}`, { token: await f.as('claims'), body: { status: 'paid' } })).status, 422);
});
test('US-058 · My claims only', async () => {
  const mine = await f.call('GET', '/api/customer/claims', { token: ct });
  assert.ok(mine.body.length >= 1 && mine.body.every((c) => c.profileId === custProfile.id));
});

// ---------- EP-12 Privacy and consent
test('US-059 · Withdraw call consent', async () => {
  const p = await f.profile((x) => individual(x) && x.consent.call && !x.consent.dnc);
  await f.call('PUT', '/api/customer/consent', { token: await f.customer(p.id), body: { call: false } });
  assert.equal((await f.c.services.voice.canCall(p.id, new Date('2026-10-07T03:00:00Z'))).reasons.includes('no call consent'), true);
});
test('US-060 · Self-service export', async () => {
  const r = await f.call('GET', '/api/customer/data-export', { token: ct });
  for (const k of ['profile', 'policies', 'quotes', 'orders', 'claims', 'messages', 'sourceRecords']) assert.ok(k in r.body, k);
});
test('US-061 · Active policy blocks erasure', async () => {
  assert.equal((await f.call('POST', `/api/dsar/${custProfile.id}/erase`, { token: await f.as('compliance') })).status, 422);
});
test('US-061 · Erasure', async () => {
  const p = await f.profile((x) => individual(x) && x.name && x.phone && x.id !== custProfile.id);
  assert.equal((await f.call('POST', `/api/dsar/${p.id}/erase`, { token: await f.as('compliance') })).body.erased, true);
  const after = await f.c.store.collection('profiles').get(p.id);
  assert.equal(after.name, null); assert.equal(after.phone, null); assert.equal(after.anonymised, true);
});
test('US-062 · Masking', async () => {
  const p = await f.profile((x) => individual(x) && x.phone);
  const r = await f.call('GET', `/api/customers/${p.id}`, { token: await f.as('campaign') });
  assert.equal(r.body.profile.piiMasked, true);
  assert.match(r.body.profile.phone, /\*\*\*/);
});

// ---------- EP-13 Rule governance
let draftId;
test('US-063 · Invalid weights rejected', async () => {
  const s = await f.c.services.rules.get('scoring');
  const bad = structuredClone(s); bad.factors[0].weight = 50;
  const r = await f.call('POST', '/api/rules', { token: await f.as('author'), body: { kind: 'scoring', payload: bad } });
  assert.equal(r.status, 400);
  assert.ok(r.body.error.details.some((d) => d.includes('sum to 100')));
});
test('US-063 · Valid draft', async () => {
  const s = await f.c.services.rules.get('scoring');
  const good = structuredClone(s); good.tiers.hot = 68;
  const r = await f.call('POST', '/api/rules', { token: await f.as('author'), body: { kind: 'scoring', payload: good, description: 'lower hot threshold' } });
  assert.equal(r.body.status, 'draft');
  draftId = r.body.id;
});
test('US-064 · Current vs candidate', async () => {
  const p = await f.profile(individual);
  const d = await f.call('GET', `/api/rules/${encodeURIComponent(draftId)}`, { token: await f.as('author') });
  const r = await f.call('POST', '/api/rules/simulate', { token: await f.as('author'), body: { profileId: p.id, kind: 'scoring', payload: d.body.payload } });
  assert.ok(r.body.current.score !== undefined && r.body.candidate.score !== undefined);
});
test('US-065 · Self-approval forbidden', async () => {
  await f.call('POST', `/api/rules/${encodeURIComponent(draftId)}/submit`, { token: await f.as('author'), body: {} });
  const st = await f.c.services.rules.approve(draftId, { id: (await f.c.services.identity.byUsername('author')).id, roles: ['rule_approver'] }).then(() => 200, (e) => e.status);
  assert.equal(st, 403);
});
test('US-065 · Approval activates and retires', async () => {
  const r = await f.call('POST', `/api/rules/${encodeURIComponent(draftId)}/approve`, { token: await f.as('approver'), body: { comment: 'ok' } });
  assert.equal(r.body.status, 'active');
  assert.equal((await f.c.services.rules.byId('scoring@1')).status, 'retired');
});
test('US-066 · Rollback is a governed change', async () => {
  const r = await f.call('POST', '/api/rules/scoring@1/rollback', { token: await f.as('author'), body: {} });
  assert.equal(r.body.status, 'draft', 'rollback creates a draft that still needs approval');
});
test('US-067 · Banned phrase in template', async () => {
  const m = structuredClone(await f.c.services.rules.get('content.messages'));
  m.templates.first_reminder.vi = 'Chiết khấu 10% khi gia hạn hôm nay!';
  const r = await f.call('POST', '/api/rules', { token: await f.as('author'), body: { kind: 'content.messages', payload: m } });
  assert.equal(r.status, 400);
});
test('US-068 · Cap', async () => {
  const comm = structuredClone(await f.c.services.rules.get('commission'));
  comm.table.rules[0].then.rate = 0.06;
  assert.equal((await f.call('POST', '/api/rules', { token: await f.as('author'), body: { kind: 'commission', payload: comm } })).status, 400);
});

// ---------- EP-14 Identity, access and audit
test('US-069 · Two-step login', async () => {
  const r = await f.call('POST', '/api/auth/login', { body: { username: 'compliance', password: 'Tasco@Demo2026!' } });
  assert.equal(r.body.mfaRequired, true);
  const u = await f.c.services.identity.byUsername('compliance');
  await f.c.store.collection('users').upsert({ ...u, lastTotpStep: null });
  const m = await f.call('POST', '/api/auth/mfa', { body: { mfaToken: r.body.mfaToken, code: totp(u.totpSecret) } });
  assert.ok(m.body.accessToken);
});
test('US-069 · Privileged role without MFA enrolment', async () => {
  await f.c.services.identity.createUser({ username: 'new.steward', password: 'Long enough pass 1', displayName: 'New', roles: ['data_steward'] }, { id: 'admin-x' });
  const r = await f.call('POST', '/api/auth/login', { body: { username: 'new.steward', password: 'Long enough pass 1' } });
  assert.equal(r.body.mfaEnrolment, true);
  assert.match(r.body.otpauthUri, /^otpauth:/);
});
test('US-070 · Lockout', async () => {
  await f.c.services.identity.createUser({ username: 'lock.test', password: 'Long enough pass 1', displayName: 'Lock', roles: ['executive'] }, { id: 'admin-x' });
  for (let i = 0; i < 5; i++) await f.call('POST', '/api/auth/login', { body: { username: 'lock.test', password: 'wrong' } });
  assert.equal((await f.call('POST', '/api/auth/login', { body: { username: 'lock.test', password: 'Long enough pass 1' } })).status, 423);
});
test('US-071 · Create agent', async () => {
  const r = await f.call('POST', '/api/users', { token: await f.as('admin'), body: { username: 'agent.dn', password: 'Strong pass phrase 1', displayName: 'Agent Đà Nẵng', roles: ['telesales_agent'], region: 'Đà Nẵng' } });
  assert.equal(r.body.user.region, 'Đà Nẵng');
});
test('US-071 · Weak password', async () => {
  assert.equal((await f.call('POST', '/api/users', { token: await f.as('admin'), body: { username: 'weak.user', password: 'short', displayName: 'W', roles: ['executive'] } })).status, 400);
});
test('US-071 · Admin cannot read PII or approve rules', async () => {
  const t = await f.as('admin');
  const p = await f.profile(individual);
  assert.equal((await f.call('GET', `/api/customers/${p.id}`, { token: t })).status, 403);
  assert.equal((await f.call('POST', '/api/rules/scoring@1/approve', { token: t, body: {} })).status, 403);
});
test('US-072 · Verify', async () => {
  assert.equal((await f.call('GET', '/api/audit/verify', { token: await f.as('auditor') })).body.ok, true);
});
test('US-072 · Tampering detected', async () => {
  const entries = f.c.store.audit._entries;
  const original = entries[3].action;
  entries[3].action = 'tampered';
  const v = await f.c.services.audit.verify();
  entries[3].action = original;
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 3);
});

// ---------- EP-15 Operations, insights and UX
test('US-073 · Overview', async () => {
  const r = await f.call('GET', '/api/dashboard/overview', { token: await f.as('exec') });
  for (const k of ['base', 'leads', 'dataQuality', 'engagement', 'sales', 'economics']) assert.ok(k in r.body, k);
});
test('US-074 · Status', async () => {
  const r = await f.call('GET', '/api/ops/status', { token: await f.as('support') });
  assert.ok(r.body.integrations.length >= 6);
  assert.ok(r.body.rules.length >= 15);
});
test('US-074 · Reconciliation', async () => {
  const r = await f.call('POST', '/api/ops/jobs/reconciliation', { token: await f.as('support') });
  assert.ok(r.body.checked >= 1);
  assert.ok(r.body.runId);
});
test('US-075 · Retention job', async () => {
  const r = await f.call('POST', '/api/ops/jobs/retention', { token: await f.as('support') });
  assert.ok(r.body.runId);
});
test.todo('US-076 · Language toggle — UI behaviour, verified manually / in UAT (VI ⇄ EN on staff console)');
test.todo('US-077 · Scan — physical QR scan of an e-certificate with a phone camera, verified in UAT');
