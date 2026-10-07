'use strict';

/** Functional acceptance tests — EP-05 Voice bot, EP-06 Telesales, EP-07 Customer app, EP-08 Value & cross-sell. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, individual } = require('./fx');
const { errors } = require('../../src/shared/errors');

let f;
test.before(async () => { f = await setup(); });
test.after(async () => { await f.srv.close(); });

const callable = (x) => individual(x) && x.consent.call && !x.consent.dnc && x.phone && x.policy.expiryConfidence >= 0.5;
async function call(lines, pred = callable, user = 'campaign') {
  const p = await f.profile(pred);
  const t = await f.as(user);
  let s = (await f.call('POST', '/api/voice/sessions', { token: t, body: { profileId: p.id } })).body;
  for (const l of lines) {
    if (s.state === 'ended') break;
    s = (await f.call('POST', `/api/voice/sessions/${s.id}/turns`, { token: t, body: { text: typeof l === 'function' ? l(p) : l } })).body;
  }
  return { s, p };
}
const PLATE = (p) => f.plateSpoken(p);

// ---------- EP-05 AI voice bot
test('US-023 · Opening line', async () => {
  const { s } = await call([]);
  assert.match(s.transcript[0].text, /trợ lý tự động của VETC/);
  assert.match(s.transcript[0].text, /không bao giờ yêu cầu mã OTP/);
});
test('US-024 · Spoken plate matches', async () => {
  const { s } = await call([PLATE]);
  assert.equal(s.verified, true);
  assert.equal(s.state, 'confirm_expiry');
});
test('US-024 · Plate mismatch', async () => {
  const { s } = await call(['biển số 29A 999 99']);
  assert.equal(s.outcome, 'plate_mismatch');
});
test('US-024 · Plate not understood three times', async () => {
  const { s } = await call(['à', 'ừm', 'hả']);
  assert.equal(s.outcome, 'unverified');
});
test('US-025 · Price asked', async () => {
  const { s } = await call([PLATE, 'phí bao nhiêu tiền']);
  assert.equal(s.signals.priceAsked, true);
  const line = s.transcript.find((x) => x.key === 'price');
  assert.match(line.text, /do Nhà nước quy định/);
  assert.doesNotMatch(line.text, /giảm giá|chiết khấu/i);
});
test('US-026 · Scam concern at any point', async () => {
  const { s } = await call([PLATE, 'đúng', 'có phải lừa đảo không']);
  assert.equal(s.signals.trustConcern, true);
  assert.ok(s.transcript.some((x) => x.key === 'trust'));
  assert.notEqual(s.state, 'ended');
});
test('US-027 · Already renewed', async () => {
  const { s, p } = await call([PLATE, 'tôi đã gia hạn rồi', 'Bảo Việt tháng 9']);
  assert.equal(s.outcome, 'already_renewed');
  await f.c.events.drain();
  assert.equal((await f.c.store.collection('profiles').get(p.id)).policy.insurer, 'OTHER');
});
test('US-028 · Opt-out', async () => {
  const { s, p } = await call(['đừng gọi nữa']);
  assert.equal(s.outcome, 'opted_out');
  await f.c.events.drain();
  assert.equal((await f.c.store.collection('profiles').get(p.id)).consent.dnc, true);
});
test('US-029 · Eligible customers only', async () => {
  const r = await f.call('POST', '/api/voice/campaign', { token: await f.as('campaign'), body: { limit: 10, tier: 'warm', at: '2026-10-07T03:00:00Z' } });
  assert.ok(r.body.called <= 10);
  const sessions = await f.c.store.collection('voice_sessions').find({ limit: 1000 });
  for (const s of sessions.filter((x) => x.mode === 'campaign')) {
    const p = await f.c.store.collection('profiles').get(s.customerId);
    assert.notEqual(p.ownerType, 'company');
  }
});
test('US-029 · Contact policy applies to campaigns (target behaviour)', async () => {
  const r = await f.call('POST', '/api/voice/campaign', { token: await f.as('campaign'), body: { limit: 5, tier: 'warm', at: '2026-10-07T15:30:00Z' } });
  assert.equal(r.body.called, 0);
  assert.ok(r.body.skipped['outside allowed contact hours'] > 0);
});
test('US-030 · Console session', async () => {
  const { s } = await call([PLATE, 'đúng']);
  assert.ok(s.transcript.length >= 4);
  assert.ok(s.transcript.every((x) => x.speaker === 'bot' ? x.gloss : true));
});
test('US-030 · DNC customer', async () => {
  const p = await f.profile((x) => x.consent.dnc);
  const r = await f.call('POST', '/api/voice/sessions', { token: await f.as('campaign'), body: { profileId: p.id } });
  assert.equal(r.status, 422);
});
test('US-031 · Governance dashboard', async () => {
  const r = await f.call('GET', '/api/dashboard/governance', { token: await f.as('compliance') });
  assert.ok(r.body.voiceBot.calls > 0);
  assert.ok(r.body.voiceBot.optOutRate !== undefined && r.body.voiceBot.plateVerificationFailureRate !== undefined);
  assert.equal(r.body.auditChain.ok, true);
});

// ---------- EP-06 Telesales
let handoffId;
let handoffProfile;
test('US-032 · Handoff content', async () => {
  const { s, p } = await call([PLATE, 'đúng', 'tôi muốn mua ngay'], (x) => callable(x) && x.province === 'Hà Nội' && x.policy.insurer !== 'TASCO');
  handoffId = s.handoffId; handoffProfile = p;
  const h = (await f.call('GET', `/api/handoffs/${handoffId}`, { token: await f.as('agent.hn') })).body;
  assert.equal(h.plateVerifiedByCustomer, true);
  assert.ok(h.talkingPoints.length >= 2);
  assert.ok(h.phoneMasked.includes('***'));
});
test('US-033 · Claim', async () => {
  const r = await f.call('PATCH', `/api/handoffs/${handoffId}`, { token: await f.as('agent.hn'), body: { status: 'claimed' } });
  assert.equal(r.body.status, 'claimed');
  assert.ok(r.body.assignedTo);
});
test('US-033 · Invalid transition', async () => {
  const h = await f.c.services.voice.createDirectHandoff(handoffProfile, await f.c.store.collection('leads').get(handoffProfile.id), 'test');
  await f.call('PATCH', `/api/handoffs/${h.id}`, { token: await f.as('agent.hn'), body: { status: 'lost' } });
  assert.equal((await f.call('PATCH', `/api/handoffs/${h.id}`, { token: await f.as('agent.hn'), body: { status: 'won' } })).status, 422);
});
test("US-033 · Someone else's handoff", async () => {
  const h = await f.c.services.voice.createDirectHandoff(handoffProfile, await f.c.store.collection('leads').get(handoffProfile.id), 'test');
  await f.c.store.collection('handoffs').upsert({ ...h, assignedTo: 'U-someone-else' });
  assert.equal((await f.call('PATCH', `/api/handoffs/${h.id}`, { token: await f.as('agent.hn'), body: { status: 'claimed' } })).status, 403);
});
test('US-034 · Assign', async () => {
  const h = await f.c.services.voice.createDirectHandoff(handoffProfile, await f.c.store.collection('leads').get(handoffProfile.id), 'test');
  const r = await f.call('PATCH', `/api/handoffs/${h.id}`, { token: await f.as('supervisor'), body: { assignTo: 'U-agent-x' } });
  assert.equal(r.body.assignedTo, 'U-agent-x');
});
test('US-034 · Agent cannot assign', async () => {
  const h = await f.c.services.voice.createDirectHandoff(handoffProfile, await f.c.store.collection('leads').get(handoffProfile.id), 'test');
  assert.equal((await f.call('PATCH', `/api/handoffs/${h.id}`, { token: await f.as('agent.hn'), body: { assignTo: 'x' } })).status, 403);
});
let sentQuote;
test('US-035 · Quote on the call, pay in app', async () => {
  const t = await f.as('agent.hn');
  const q = await f.call('POST', '/api/quotes', { token: t, body: { profileId: handoffProfile.id, products: [{ code: 'TNDS_CAR' }], channel: 'telesales' } });
  assert.equal((await f.call('POST', `/api/quotes/${encodeURIComponent(q.body.id)}/send`, { token: t })).status, 200);
  sentQuote = q.body;
  const pending = await f.call('GET', '/api/customer/quotes', { token: await f.customer(handoffProfile.id) });
  assert.ok(pending.body.some((x) => x.id === q.body.id));
});
test('US-035 · Payment is customer-confirmed (target behaviour)', async () => {
  assert.equal((await f.call('POST', '/api/orders', { token: await f.as('agent.hn'), body: { quoteId: sentQuote.id } })).status, 404);
  const r = await f.call('POST', '/api/customer/orders', { token: await f.customer(handoffProfile.id), body: { quoteId: sentQuote.id }, headers: { 'Idempotency-Key': 'fx-us035-01' } });
  assert.equal(r.body.order.status, 'completed');
});

// ---------- EP-07 Customer app
test('US-036 · Signed link', async () => {
  const p = await f.profile(individual);
  const r = await f.call('POST', '/api/customer/session', { body: { link: f.c.links.sign(p.id) } });
  assert.ok(r.body.token);
});
test('US-036 · Tampered link', async () => {
  const p = await f.profile(individual);
  const link = f.c.links.sign(p.id);
  const other = await f.profile((x) => individual(x) && x.id !== p.id);
  const forged = link.replace(p.id, other.id);
  assert.equal((await f.call('POST', '/api/customer/session', { body: { link: forged } })).status, 401);
});
test('US-037 · Low confidence asks for confirmation', async () => {
  const p = await f.profile((x) => individual(x) && x.policy.expiryConfidence < 0.75);
  const r = await f.call('GET', '/api/customer/home', { token: await f.customer(p.id) });
  assert.equal(r.body.cover.needsConfirmation, true);
});
test('US-038 · Declare expiry', async () => {
  const p = await f.profile((x) => individual(x) && x.policy.expiryConfidence < 0.75);
  const r = await f.call('POST', '/api/customer/expiry', { token: await f.customer(p.id), body: { expiryDate: '2027-04-04', insurer: 'PVI' } });
  assert.equal(r.body.ok, true);
  assert.ok((await f.c.services.audit.list({ entityId: p.id })).some((a) => a.action === 'customer.expiry_declared'));
});
let paid;
test('US-039 · Happy path', async () => {
  const p = await f.profile((x) => individual(x) && x.vehicle.category === 'car_under6' && x.policy.insurer !== 'TASCO');
  const ct = await f.customer(p.id);
  const q = await f.call('POST', '/api/customer/quotes', { token: ct, body: { products: [{ code: 'TNDS_CAR' }] } });
  assert.equal(q.body.lines[0].total, 480700);
  const o = await f.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': 'fx-us039-01' } });
  assert.equal(o.body.order.status, 'completed');
  assert.ok(o.body.policies[0].certificateUrl.includes('/verify/'));
  paid = { ct, q: q.body, o: o.body };
});
test('US-039 · Double tap', async () => {
  const again = await f.call('POST', '/api/customer/orders', { token: paid.ct, body: { quoteId: paid.q.id }, headers: { 'Idempotency-Key': 'fx-us039-01' } });
  assert.equal(again.body.idempotentReplay, true);
  assert.equal(again.body.order.id, paid.o.order.id);
});
test('US-039 · Expired quote', async () => {
  const p = await f.profile((x) => individual(x) && x.policy.insurer !== 'TASCO' && x.vehicle.category === 'car_6_11');
  const ct = await f.customer(p.id);
  const q = await f.call('POST', '/api/customer/quotes', { token: ct, body: { products: [{ code: 'TNDS_CAR' }] } });
  await f.c.store.collection('quotes').upsert({ ...(await f.c.store.collection('quotes').get(q.body.id)), expiresAt: '2000-01-01T00:00:00Z' });
  assert.equal((await f.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': 'fx-us039-02' } })).status, 422);
});
test('US-040 · Verification without PII', async () => {
  const r = await f.call('GET', `/api/public/certificates/${encodeURIComponent(paid.o.policies[0].certNo)}`);
  assert.equal(r.body.issued, true);
  assert.match(r.body.plate, /\*\*\*/);
  assert.equal(JSON.stringify(r.body).includes('phone'), false);
});
test('US-040 · Unknown certificate', async () => {
  assert.equal((await f.call('GET', '/api/public/certificates/TAS-UNKNOWN-1')).body.valid, false);
});
test('US-041 · Multi-year', async () => {
  const p = await f.profile((x) => individual(x) && x.vehicle.category === 'car_under6');
  const q = await f.call('POST', '/api/customer/quotes', { token: await f.customer(p.id), body: { products: [{ code: 'TNDS_CAR', options: { termYears: 2 } }] } });
  assert.equal(q.body.lines[0].premiumNet, 874000);
});
test('US-041 · Out of range', async () => {
  const p = await f.profile(individual);
  assert.equal((await f.call('POST', '/api/customer/quotes', { token: await f.customer(p.id), body: { products: [{ code: 'TNDS_CAR', options: { termYears: 4 } }] } })).status, 400);
});
test('US-042 · Issuance failure after payment', async () => {
  const p = await f.profile((x) => individual(x) && x.policy.insurer !== 'TASCO' && x.vehicle.category === 'car_under6' && !x.anonymised);
  const ct = await f.customer(p.id);
  const q = await f.call('POST', '/api/customer/quotes', { token: ct, body: { products: [{ code: 'TNDS_CAR' }] } });
  const real = f.c.gateways.policyAdmin.port;
  f.c.gateways.policyAdmin.port = { issuePolicy: async () => { throw errors.validation('core down'); }, cancelPolicy: real.cancelPolicy };
  const r = await f.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': 'fx-us042-01' } });
  f.c.gateways.policyAdmin.port = real;
  assert.ok(r.status >= 400);
  const [o] = await f.c.services.sales.listOrders({ profileId: p.id, status: 'issuance_failed_refunded' });
  assert.equal(o.refund.status, 'refunded');
});

// ---------- EP-08 Value beyond discount and cross-sell
test('US-043 · Personalised ranking', async () => {
  const l = (await f.c.store.collection('leads').find({ limit: 20 }))[0];
  const rel = l.benefits.map((b) => b.relevance);
  assert.deepEqual(rel, [...rel].sort((a, b) => b - a));
  assert.ok(l.benefits.every((b) => b.why));
});
test('US-043 · Legal gating', async () => {
  const leads = await f.c.store.collection('leads').find({ limit: 300 });
  assert.ok(leads.every((l) => l.benefits.every((b) => b.legalStatus === 'approved' && b.available)));
});
test('US-044 · PA add-on', async () => {
  const p = await f.profile((x) => individual(x) && x.vehicle.category === 'car_under6');
  const q = await f.call('POST', '/api/customer/quotes', { token: await f.customer(p.id), body: { products: [{ code: 'TNDS_CAR' }, { code: 'PA_SEAT', options: { sumInsuredPerSeat: 20000000, seats: 5 } }] } });
  const pa = q.body.lines.find((l) => l.product === 'PA_SEAT');
  assert.equal(pa.total, 100000);
  assert.equal(pa.vat, 0);
  assert.equal(q.body.bundle, 'SAFE_DRIVE');
});
test('US-045 · PD rating', async () => {
  const p = await f.profile((x) => individual(x) && x.vehicle.usage === 'personal');
  const q = await f.call('POST', '/api/quotes', { token: await f.as('supervisor'), body: { profileId: p.id, products: [{ code: 'MOTOR_PD', options: { sumInsured: 500000000, vehicleAge: 2 } }], channel: 'telesales' } });
  assert.equal(q.body.lines[0].premiumNet, 7500000);
});
test('US-045 · Referral above the online limit', async () => {
  const p = await f.profile(individual);
  const r = await f.call('POST', '/api/quotes', { token: await f.as('supervisor'), body: { profileId: p.id, products: [{ code: 'MOTOR_PD', options: { sumInsured: 6000000000 } }], channel: 'telesales' } });
  assert.equal(r.status, 422);
});
test('US-046 · Cross-sell scheduled', async () => {
  const p = await f.c.store.collection('profiles').get(paid.q.profileId);
  if (p.consent.marketing) assert.ok(await f.c.store.collection('touchpoints').count({ profile_id: p.id, journey: 'cross_sell' }) >= 1);
  else assert.equal(await f.c.store.collection('touchpoints').count({ profile_id: p.id, journey: 'cross_sell' }), 0);
});
test('US-046 · Already bought add-ons or no consent', async () => {
  const p = await f.profile((x) => individual(x) && x.policy.insurer !== 'TASCO' && x.vehicle.category === 'car_under6' && x.consent.marketing && !x.anonymised);
  const ct = await f.customer(p.id);
  const q = await f.call('POST', '/api/customer/quotes', { token: ct, body: { products: [{ code: 'TNDS_CAR' }, { code: 'PA_SEAT', options: { sumInsuredPerSeat: 10000000 } }] } });
  await f.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': 'fx-us046-01' } });
  assert.equal(await f.c.store.collection('touchpoints').count({ profile_id: p.id, journey: 'cross_sell' }), 0);
});
test('US-047 · Referral disabled', async () => {
  const r = await f.c.services.rules.get('referral');
  assert.equal(r.enabled, false);
  assert.equal(r.legalStatus, 'pending_legal_review');
});
test('US-048 · Confirm-before-debit', async () => {
  const p = await f.profile(individual);
  const q = await f.call('POST', '/api/quotes', { token: await f.as('supervisor'), body: { profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'telesales' } });
  await assert.rejects(f.c.services.sales.purchase({ quoteId: q.body.id, idempotencyKey: 'fx-us048-1' }, { id: 'sup', roles: ['telesales_supervisor'] }), /Only the customer/);
});
