'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeContainer, startServer, findProfile, ACTOR } = require('../helpers');

let c;
let srv;
let dpo;
test.before(async () => { c = await makeContainer(); srv = await startServer(c); dpo = await srv.login('compliance'); });
test.after(async () => { await srv.close(); });

const customer = async (profileId, channel = 'vetc_app') => (await srv.call('POST', '/api/customer/session', { body: { demoProfileId: profileId, channel } })).body.token;
const ikey = () => `t-${Math.random().toString(36).slice(2)}`;

/** A customer with a name and phone, no policy on the platform and not used by another test. */
const used = new Set(['30E94935']);
async function freeProfile() {
  for (const x of await c.store.collection('profiles').find({ limit: 5000 })) {
    if (!x.name || !x.phone || x.anonymised || used.has(x.id) || x.ownerType === 'company') continue;
    if (await c.store.collection('policies').count({ profile_id: x.id })) continue;
    used.add(x.id);
    return x;
  }
  throw new Error('no free profile');
}

/** A customer who holds a TASCO policy in force (bought in the app). */
async function insuredCustomer() {
  const p = await freeProfile();
  const ct = await customer(p.id);
  const q = await srv.call('POST', '/api/customer/quotes', { token: ct, body: { products: [{ code: 'TNDS_CAR', options: { termYears: 1 } }] } });
  assert.equal(q.status, 200);
  const o = await srv.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': ikey() } });
  assert.equal(o.status, 200);
  return p;
}

test('data requests: only compliance (dsar:manage) — 401 without a token, 403 for other roles', async () => {
  assert.equal((await srv.call('GET', '/api/dsar')).status, 401);
  for (const user of ['agent.hn', 'admin', 'steward', 'claims', 'auditor']) {
    const tk = await srv.login(user);
    assert.equal((await srv.call('GET', '/api/dsar', { token: tk })).status, 403, `${user} list`);
    assert.equal((await srv.call('POST', '/api/dsar', { token: tk, body: { plate: '30E94935', type: 'access', channel: 'hotline' } })).status, 403, `${user} log`);
    assert.equal((await srv.call('GET', '/api/dsar/DSR-261008-0000', { token: tk })).status, 403, `${user} detail`);
    assert.equal((await srv.call('POST', '/api/dsar/DSR-261008-0000/refuse', { token: tk, body: { reason: 'nope nope' } })).status, 403, `${user} refuse`);
    assert.equal((await srv.call('POST', '/api/dsar/DSR-261008-0000/complete-export', { token: tk, body: {} })).status, 403, `${user} export`);
  }
});

test('data requests: log by plate, due date from service levels, masked list, detail with counts only, audited', async () => {
  const p = await findProfile(c, (x) => x.name && x.phone && !x.anonymised);
  const r = await srv.call('POST', '/api/dsar', { token: dpo, body: { plate: p.plate, type: 'access', channel: 'hotline', note: 'Khách gọi tổng đài yêu cầu bản sao dữ liệu' } });
  assert.equal(r.status, 200);
  assert.match(r.body.id, /^DSR-\d{6}-[0-9A-F]{4}$/);
  assert.equal(r.body.status, 'received');
  assert.equal(Date.parse(r.body.dueAt) - Date.parse(r.body.receivedAt), 72 * 3600000, 'dsarResponseHours = 72');
  const list = await srv.call('GET', '/api/dsar', { token: dpo });
  assert.equal(list.status, 200);
  const row = list.body.items.find((x) => x.id === r.body.id);
  assert.equal(row.plate, p.plate);
  assert.notEqual(row.customerName, p.name, 'name is masked');
  assert.ok(!JSON.stringify(list.body).includes(p.phone), 'no phone number in the register');
  assert.ok(list.body.summary.open >= 1);
  assert.equal(list.body.responseHours, 72);
  // Detail: timeline and counts of what is held, never the data itself.
  const d = await srv.call('GET', `/api/dsar/${r.body.id}`, { token: dpo });
  assert.equal(d.status, 200);
  for (const k of ['policies', 'quotes', 'orders', 'claims', 'messages', 'sourceRecords', 'voiceSessions']) assert.equal(typeof d.body.held[k], 'number', k);
  assert.ok(d.body.held.sourceRecords >= 1);
  assert.ok(!JSON.stringify(d.body).includes(p.phone));
  assert.equal((await srv.call('GET', '/api/dsar/DSR-000000-ZZZZ', { token: dpo })).status, 404);
  // Filters.
  assert.ok((await srv.call('GET', '/api/dsar?status=received&type=access', { token: dpo })).body.items.every((x) => x.status === 'received' && x.type === 'access'));
  assert.equal((await srv.call('GET', '/api/dsar?status=lost', { token: dpo })).status, 400);
  // Audited.
  const actions = (await c.services.audit.list({ entityId: p.id, limit: 50 })).map((e) => e.action);
  for (const a of ['dsar.request_logged', 'dsar.request_viewed']) assert.ok(actions.includes(a), a);
  assert.ok((await c.services.audit.list({ action: 'dsar.register_viewed', limit: 5 })).length >= 1);
});

test('data requests: validation of the customer, type, channel and received date', async () => {
  assert.equal((await srv.call('POST', '/api/dsar', { token: dpo, body: { plate: '30E94935', type: 'delete', channel: 'hotline' } })).status, 400);
  assert.equal((await srv.call('POST', '/api/dsar', { token: dpo, body: { plate: '30E94935', type: 'access', channel: 'fax' } })).status, 400);
  assert.equal((await srv.call('POST', '/api/dsar', { token: dpo, body: { type: 'access', channel: 'hotline' } })).status, 400, 'customer required');
  assert.equal((await srv.call('POST', '/api/dsar', { token: dpo, body: { plate: 'XX', type: 'access', channel: 'hotline' } })).status, 400);
  assert.equal((await srv.call('POST', '/api/dsar', { token: dpo, body: { plate: '99Z99999', type: 'access', channel: 'hotline' } })).status, 404);
  const p = await findProfile(c, (x) => x.phone && !x.anonymised);
  const future = new Date(Date.now() + 3 * 86400000).toISOString();
  assert.equal((await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: p.id, type: 'access', channel: 'letter', receivedAt: future } })).status, 400);
  assert.equal((await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: p.id, type: 'access', channel: 'letter', receivedAt: 'yesterday' } })).status, 400);
  assert.equal((await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: p.id, type: 'access', channel: 'letter', receivedAt: '2020-01-01T00:00:00Z' } })).status, 400);
  // By phone (blind index), received four days ago → overdue.
  const old = new Date(Date.now() - 4 * 86400000).toISOString();
  const r = await srv.call('POST', '/api/dsar', { token: dpo, body: { phone: p.phone, type: 'access', channel: 'letter', receivedAt: old, verifiedIdentity: true } });
  assert.equal(r.status, 200);
  assert.equal(r.body.profileId, p.id);
  assert.equal(r.body.overdue, true);
  assert.equal(r.body.verifiedIdentity, true);
  const overdue = await srv.call('GET', '/api/dsar?overdue=true', { token: dpo });
  assert.ok(overdue.body.items.some((x) => x.id === r.body.id));
  assert.ok(overdue.body.items.every((x) => x.overdue));
  assert.ok(overdue.body.summary.overdue >= 1);
  assert.ok((await srv.call('GET', '/api/dsar?overdue=false', { token: dpo })).body.items.every((x) => !x.overdue));
});

test('data requests: start, export (identity required), then completed and closed', async () => {
  const p = await freeProfile();
  const r = (await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: p.id, type: 'access', channel: 'email' } })).body;
  const noId = await srv.call('POST', `/api/dsar/${r.id}/complete-export`, { token: dpo, body: {} });
  assert.equal(noId.status, 422, 'identity must be verified first');
  const started = await srv.call('POST', `/api/dsar/${r.id}/start`, { token: dpo, body: {} });
  assert.equal(started.body.status, 'in_progress');
  assert.equal(started.body.verifiedIdentity, false);
  const ver = await srv.call('POST', `/api/dsar/${r.id}/start`, { token: dpo, body: { verifiedIdentity: true } });
  assert.equal(ver.body.verifiedIdentity, true);
  assert.equal(ver.body.status, 'in_progress');
  const ex = await srv.call('POST', `/api/dsar/${r.id}/complete-export`, { token: dpo, body: {} });
  assert.equal(ex.status, 200);
  assert.match(ex.body.filename, /^TASCO-data-[0-9A-Z.-]+-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(ex.body.data.profile.id, p.id);
  assert.equal(ex.body.request.status, 'completed');
  assert.equal(ex.body.request.outcome, 'exported');
  assert.deepEqual(ex.body.request.history.map((x) => x.status), ['received', 'in_progress', 'identity_verified', 'completed']);
  assert.equal((await srv.call('POST', `/api/dsar/${r.id}/complete-export`, { token: dpo, body: {} })).status, 422, 'already completed');
  assert.equal((await srv.call('POST', `/api/dsar/${r.id}/refuse`, { token: dpo, body: { reason: 'Không xác minh được' } })).status, 422);
  assert.equal((await srv.call('POST', `/api/dsar/${r.id}/start`, { token: dpo, body: {} })).status, 422);
  const sum = (await srv.call('GET', '/api/dsar', { token: dpo })).body.summary;
  assert.ok(sum.completed30d >= 1);
  // An access request cannot be fulfilled by erasing, and vice versa.
  const e = (await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: p.id, type: 'erasure', channel: 'branch', verifiedIdentity: true } })).body;
  assert.equal((await srv.call('POST', `/api/dsar/${e.id}/complete-export`, { token: dpo, body: {} })).status, 422);
  const a = (await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: p.id, type: 'access', channel: 'branch' } })).body;
  assert.equal((await srv.call('POST', `/api/dsar/${a.id}/erase`, { token: dpo, body: { reason: 'Khách yêu cầu xóa', confirmPlate: p.plate } })).status, 422);
});

test('data requests: erasure needs a reason and the plate; refused in business language while a policy is in force', async () => {
  const insured = await insuredCustomer();
  const r = (await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: insured.id, type: 'erasure', channel: 'letter', verifiedIdentity: true, note: 'Thư đề nghị xóa dữ liệu' } })).body;
  assert.equal((await srv.call('POST', `/api/dsar/${r.id}/erase`, { token: dpo, body: { confirmPlate: insured.plate } })).status, 400, 'reason required');
  assert.equal((await srv.call('POST', `/api/dsar/${r.id}/erase`, { token: dpo, body: { reason: 'Khách yêu cầu xóa', confirmPlate: '30A00000' } })).status, 400, 'plate must match');
  const er = await srv.call('POST', `/api/dsar/${r.id}/erase`, { token: dpo, body: { reason: 'Khách yêu cầu xóa', confirmPlate: insured.plate.replace(/[-.]/g, '') } });
  assert.equal(er.status, 200);
  assert.equal(er.body.erased, false);
  assert.equal(er.body.refused, true);
  assert.equal(er.body.request.status, 'refused');
  assert.equal(er.body.request.refusalCode, 'policy_in_force');
  assert.match(er.body.request.refusalReason, /^Hợp đồng bảo hiểm còn hiệu lực đến \d{2}\/\d{2}\/\d{4}/);
  assert.equal((await c.store.collection('profiles').get(insured.id)).anonymised, undefined, 'nothing erased');
});

test('data requests: erasure anonymises; manual refusal; legacy endpoints still work', async () => {
  const p = await freeProfile();
  const other = (await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: p.id, type: 'access', channel: 'hotline' } })).body;
  const r = (await srv.call('POST', '/api/dsar', { token: dpo, body: { profileId: p.id, type: 'erasure', channel: 'app' } })).body;
  assert.equal((await srv.call('POST', `/api/dsar/${r.id}/erase`, { token: dpo, body: { reason: 'Khách yêu cầu xóa', confirmPlate: p.plate } })).status, 422, 'identity first');
  const er = await srv.call('POST', `/api/dsar/${r.id}/erase`, { token: dpo, body: { reason: 'Khách yêu cầu xóa toàn bộ dữ liệu', confirmPlate: p.plate, verifiedIdentity: true } });
  assert.equal(er.status, 200);
  assert.equal(er.body.erased, true);
  assert.equal(er.body.request.status, 'completed');
  assert.equal(er.body.request.outcome, 'erased');
  assert.equal(er.body.request.customerName, null);
  assert.equal((await c.store.collection('profiles').get(p.id)).anonymised, true);
  const list = (await srv.call('GET', `/api/dsar?profileId=${p.id}`, { token: dpo })).body.items;
  assert.ok(list.every((x) => x.anonymised && x.customerName === null), 'other requests no longer show a name');
  // Manual refusal with a reason.
  assert.equal((await srv.call('POST', `/api/dsar/${other.id}/refuse`, { token: dpo, body: { reason: 'x' } })).status, 400);
  const ref = await srv.call('POST', `/api/dsar/${other.id}/refuse`, { token: dpo, body: { reason: 'Không xác minh được danh tính — khách không cung cấp CCCD' } });
  assert.equal(ref.body.status, 'refused');
  assert.equal(ref.body.refusalCode, 'manual');
  // Legacy profile-id endpoints (backward compatible).
  const q = await freeProfile();
  const legacyExport = await srv.call('POST', `/api/dsar/${q.id}/export`, { token: dpo });
  assert.equal(legacyExport.status, 200);
  assert.equal(legacyExport.body.profile.id, q.id);
  const legacyErase = await srv.call('POST', `/api/dsar/${q.id}/erase`, { token: dpo });
  assert.equal(legacyErase.body.erased, true);
  const actions = (await c.services.audit.list({ entityId: p.id, limit: 50 })).map((e) => e.action);
  for (const a of ['dsar.request_logged', 'dsar.erased', 'dsar.request_completed', 'dsar.request_refused']) assert.ok(actions.includes(a), a);
});

test('data requests: the customer’s own download in the app is recorded as a completed access request (channel app)', async () => {
  const p = await freeProfile();
  const ct = await customer(p.id);
  const r = await srv.call('GET', '/api/customer/data-export', { token: ct });
  assert.equal(r.status, 200);
  assert.equal(r.body.profile.id, p.id);
  assert.ok(Array.isArray(r.body.dataRequests));
  const list = (await srv.call('GET', `/api/dsar?profileId=${p.id}`, { token: dpo })).body.items;
  const self = list.find((x) => x.channel === 'app');
  assert.ok(self);
  assert.equal(self.type, 'access');
  assert.equal(self.status, 'completed');
  assert.equal(self.outcome, 'exported');
  assert.equal(self.verifiedIdentity, true);
  assert.equal(self.byCustomer, true);
});

// ---------------------------------------------------------------- quick renewal

/** A renewal-journey customer whose VETC wallet covers the premium and whose seats are not confirmed yet. */
async function quickCandidate() {
  const leads = await c.store.collection('leads').find({ where: { journey: 'renewal' }, orderBy: ['score', 'desc'], limit: 200 });
  for (const l of leads) {
    const p = await c.store.collection('profiles').get(l.id);
    if (p && !p.anonymised && p.ownerType !== 'company' && p.engagement.walletBalance >= l.premium && !(await c.store.collection('policies').count({ profile_id: l.id }))) return p;
  }
  throw new Error('no quick-renewal candidate in the seed');
}

test('quick renewal: app contract — not eligible until the vehicle is confirmed, then 3 interactions renew', async () => {
  const p = await quickCandidate();
  const ct = await customer(p.id, 'vetc_app');
  const before = await srv.call('GET', '/api/customer/home', { token: ct });
  assert.equal(before.status, 200);
  const qr0 = before.body.quickRenewal;
  assert.deepEqual(Object.keys(qr0).sort(), ['codes', 'eligible', 'products', 'reasons', 'termYears']);
  assert.equal(qr0.eligible, false);
  assert.ok(qr0.reasons.includes('Cần xác nhận thông tin xe'));
  assert.ok(before.body.vehicle && before.body.cover && before.body.policies, 'existing home fields unchanged');
  // Not eligible → the quick quote is refused by the server.
  assert.equal((await srv.call('POST', '/api/customer/quotes', { token: ct, body: { flow: 'quick' } })).status, 422);
  // Customer confirms use and seats (the first step of today's flow).
  assert.equal((await srv.call('POST', '/api/customer/vehicle', { token: ct, body: { usage: p.vehicle.usage === 'commercial' ? 'commercial' : 'personal', seats: p.vehicle.seats || 5 } })).status, 200);
  const home = (await srv.call('GET', '/api/customer/home', { token: ct })).body;
  assert.equal(home.quickRenewal.eligible, true, JSON.stringify(home.quickRenewal.reasons));
  assert.deepEqual(home.quickRenewal.reasons, []);
  assert.deepEqual(home.quickRenewal.products, [{ code: 'TNDS_CAR', options: { termYears: 1 } }]);
  assert.equal(home.quickRenewal.termYears, 1);
  // Tap 1 (open: the cover the server offers is priced), tap 2 (declaration, client side), tap 3 (pay).
  const q = await srv.call('POST', '/api/customer/quotes', { token: ct, body: { flow: 'quick', products: [{ code: 'MOTOR_PD', options: { sumInsured: 500000000 } }] } });
  assert.equal(q.status, 200);
  assert.equal(q.body.flow, 'quick');
  assert.deepEqual(q.body.lines.map((l) => l.product), ['TNDS_CAR'], 'server decides the cover, not the client');
  assert.equal(q.body.indicative, false);
  assert.equal(q.body.journey, 'renewal');
  const key = ikey();
  const o = await srv.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': key } });
  assert.equal(o.status, 200);
  assert.equal(o.body.order.status, 'completed');
  assert.equal(o.body.order.flow, 'quick');
  assert.equal(o.body.policies[0].product, 'TNDS_CAR');
  assert.deepEqual(Object.keys(o.body.policies[0].vehicle).sort(), ['category', 'seats', 'usage']);
  const replay = await srv.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': key } });
  assert.equal(replay.body.idempotentReplay, true, 'a retried tap never pays twice');
  // Renewed: no second quick renewal; quick quotes never wait on the home screen as "pending".
  const after = (await srv.call('GET', '/api/customer/home', { token: ct })).body.quickRenewal;
  assert.equal(after.eligible, false);
  assert.ok(after.codes.includes('already_renewed'));
  // Standard flow keeps working and still requires products.
  assert.equal((await srv.call('POST', '/api/customer/quotes', { token: ct, body: {} })).status, 400);
});

test('quick renewal: the customer app offers it as 3 taps next to the full flow (static contract)', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'customer', 'app.js'), 'utf8');
  assert.match(app, /href: '#\/renew-quick' }, ic\('zap', 20\), 'Gia hạn nhanh'\)/, 'home: primary "Gia hạn nhanh"');
  assert.match(app, /'Tùy chỉnh gói bảo hiểm'/, 'home: secondary link to the full flow');
  const quick = app.slice(app.indexOf('async function viewQuickRenew()'), app.indexOf('/** E-certificate card'));
  assert.match(quick, /flow: 'quick'/);
  assert.equal((quick.match(/type: 'checkbox'/g) || []).length, 1, 'one explicit declaration tick');
  assert.equal((quick.match(/'Xác nhận thanh toán'/g) || []).length, 1, 'one confirm button');
  assert.match(quick, /'Idempotency-Key': idempotencyKey\(\)/);
  assert.doesNotMatch(quick, /openSheet\(/, 'no extra confirmation sheet in the quick path');
  // Co-brand removed everywhere in the customer app.
  assert.doesNotMatch(app, /×\s*\$\{|'×'|TASCO × /);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'app', 'index.html'), 'utf8'), /×/);
  assert.match(app, /'Ví VETC'/, 'payment method wording stays');
});

test('quick renewal: disabled in service levels → no quick path', async () => {
  const p = await quickCandidate();
  const ct = await customer(p.id, 'tasco_app');
  await srv.call('POST', '/api/customer/vehicle', { token: ct, body: { usage: 'personal', seats: p.vehicle.seats || 5 } });
  assert.equal((await srv.call('GET', '/api/customer/home', { token: ct })).body.quickRenewal.eligible, true);
  const author = ACTOR('qr-author', ['rule_author']);
  const approver = ACTOR('qr-approver', ['rule_approver']);
  const base = await c.services.rules.get('service_levels');
  const d = await c.services.rules.createDraft({ kind: 'service_levels', payload: { ...base, quickRenewal: { ...base.quickRenewal, enabled: false } }, description: 'Tạm dừng gia hạn nhanh' }, author);
  await c.services.rules.submit(d.id, author);
  await c.services.rules.approve(d.id, approver);
  c.services.rules.invalidate();
  const home = (await srv.call('GET', '/api/customer/home', { token: ct })).body;
  assert.equal(home.quickRenewal.eligible, false);
  assert.deepEqual(home.quickRenewal.codes, ['disabled']);
  assert.equal((await srv.call('POST', '/api/customer/quotes', { token: ct, body: { flow: 'quick' } })).status, 422);
});
