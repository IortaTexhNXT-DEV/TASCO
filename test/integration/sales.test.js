'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeContainer, ACTOR, findProfile } = require('../helpers');
const { errors } = require('../../src/shared/errors');

let c;
let p;
const agent = ACTOR('agent-1', ['telesales_agent']);
const customer = (id) => ({ id: `customer:${id}`, roles: ['customer'], customerId: id });
test.before(async () => {
  c = await makeContainer();
  p = await findProfile(c, (x) => x.ownerType === 'individual' && x.vehicle.category === 'car_under6' && x.channels.app_push && x.consent.marketing && x.policy.insurer !== 'TASCO');
});

test('quote: regulated TNDS + add-ons, bundle detection, channel restrictions', async () => {
  const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }, { code: 'PA_SEAT', options: { sumInsuredPerSeat: 20000000, seats: 5 } }], channel: 'telesales' }, agent);
  assert.equal(q.lines[0].total, 480700);
  assert.equal(q.lines[1].total, 100000);
  assert.equal(q.bundle, 'SAFE_DRIVE');
  assert.ok(q.benefits.length > 0);
  await assert.rejects(c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_MOTORBIKE', options: { category: 'moto_over50cc' } }], channel: 'telesales' }, agent), /not sold on channel/);
  await assert.rejects(c.services.sales.quote({ profileId: p.id, products: [{ code: 'NOPE' }], channel: 'telesales' }, agent), /Unknown product/);
  await assert.rejects(c.services.sales.quote({ profileId: 'NOPE', products: [{ code: 'TNDS_CAR' }], channel: 'telesales' }, agent), /not found/);
});

test('purchase: pay → issue → certificate; idempotent replay; golden record updated; journeys stop; cross-sell planned', async () => {
  const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'vetc_app', journey: 'conquest' }, agent);
  const r1 = await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'key-123456' }, customer(q.profileId));
  await c.events.drain();
  assert.equal(r1.order.status, 'completed');
  assert.equal(r1.policies.length, 1);
  const r2 = await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'key-123456' }, customer(q.profileId));
  assert.equal(r2.idempotentReplay, true, 'retried tap does not double-charge');
  await assert.rejects(c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'other-key-1' }, customer(q.profileId)), /Quote is converted/);
  const prof = await c.store.collection('profiles').get(p.id);
  assert.equal(prof.policy.insurer, 'TASCO');
  assert.equal(prof.policy.expiryConfidence, 1);
  const lead = await c.store.collection('leads').get(p.id);
  assert.equal(lead.nextBestAction.action, 'insured');
  assert.equal(await c.store.collection('touchpoints').count({ profile_id: p.id, status: 'scheduled', journey: 'conquest' }), 0);
  assert.ok(await c.store.collection('touchpoints').count({ profile_id: p.id, journey: 'cross_sell' }) >= 1, 'cross-sell planned');
  const v = await c.services.sales.verifyCertificate(r1.policies[0].certNo, '2027-01-01');
  assert.equal(v.valid, true);
  assert.ok(!JSON.stringify(v).includes(prof.phone || 'zzz'), 'no PII in public verification');
  assert.equal((await c.services.sales.verifyCertificate('NOPE')).valid, false);
  assert.equal((await c.services.sales.verifyCertificate(r1.policies[0].certNo, '2030-01-01')).state, 'expired');
  assert.equal((await c.services.sales.verifyCertificate(r1.policies[0].certNo, '2000-01-01')).state, 'not_yet_in_force');
  const msgs = await c.store.collection('messages').find({ where: { profile_id: p.id }, limit: 100 });
  assert.ok(msgs.some((m) => m.templateKey === 'purchase_confirmation'));
  assert.ok((await c.services.sales.listPolicies({ profileId: p.id })).length === 1);
  assert.ok((await c.services.sales.listOrders({ profileId: p.id, status: 'completed' })).length === 1);
});

test('staff can never debit a customer wallet', async () => {
  const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'telesales' }, agent);
  await assert.rejects(c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'staff-pay-1' }, agent), /Only the customer/);
  await c.services.sales.markSent(q.id, agent);
  assert.ok((await c.services.sales.openQuotes(p.id)).some((x) => x.id === q.id));
});

test('expired quote and payment failure are handled', async () => {
  const other = await findProfile(c, (x) => x.id !== p.id && x.ownerType === 'individual' && x.vehicle.category === 'car_6_11');
  const q = await c.services.sales.quote({ profileId: other.id, products: [{ code: 'TNDS_CAR' }], channel: 'telesales' }, agent);
  await c.store.collection('quotes').upsert({ ...q, expiresAt: '2000-01-01T00:00:00Z' });
  await assert.rejects(c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'exp-12345' }, customer(q.profileId)), /expired/);
  const q2 = await c.services.sales.quote({ profileId: other.id, products: [{ code: 'TNDS_CAR' }], channel: 'telesales' }, agent);
  const realPay = c.gateways.payment.port;
  c.gateways.payment.port = { debit: async () => { throw errors.validation('insufficient wallet balance'); } };
  await assert.rejects(c.services.sales.purchase({ quoteId: q2.id, idempotencyKey: 'pay-fail-1' }, customer(q2.profileId)), /insufficient/);
  c.gateways.payment.port = realPay;
  const failed = await c.services.sales.listOrders({ profileId: other.id, status: 'payment_failed' });
  assert.equal(failed.length, 1);
});

test('issuance failure after payment triggers refund + reconciliation flag', async () => {
  const other = await findProfile(c, (x) => x.id !== p.id && x.ownerType === 'individual' && x.vehicle.category === 'car_under6' && x.policy.insurer !== 'TASCO');
  const q = await c.services.sales.quote({ profileId: other.id, products: [{ code: 'TNDS_CAR' }], channel: 'telesales' }, agent);
  const realCore = c.gateways.policyAdmin.port;
  let refunded = false;
  const realPay = c.gateways.payment.port;
  c.gateways.payment.port = { debit: realPay.debit, refund: async () => { refunded = true; return {}; } };
  c.gateways.policyAdmin.port = { issuePolicy: async () => { throw errors.validation('core rejected'); } };
  await assert.rejects(c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'iss-fail-1' }, customer(q.profileId)), /core rejected/);
  c.gateways.policyAdmin.port = realCore;
  c.gateways.payment.port = realPay;
  assert.equal(refunded, true);
  assert.equal((await c.services.sales.listOrders({ profileId: other.id, status: 'issuance_failed_refunded' })).length, 1);
  const rec = await c.services.ops.reconcile('test');
  assert.ok(rec.checked >= 3);
});

test('partner channel: onboarding a new vehicle, commission within statutory caps, key lifecycle', async () => {
  const admin = ACTOR('pm', ['partner_manager']);
  const key = await c.services.partners.issueApiKey('P-SHOWROOM-01', admin);
  assert.match(key.apiKey, /^tpk_/);
  const stored = await c.store.collection('api_keys').get(key.id);
  assert.ok(!JSON.stringify(stored).includes(key.apiKey), 'only the hash is stored');
  const principal = await c.services.partners.authenticateKey(key.apiKey);
  assert.equal(principal.partnerId, 'P-SHOWROOM-01');
  assert.equal(await c.services.partners.authenticateKey('tpk_wrong'), null);
  assert.equal(await c.services.partners.authenticateKey('nope'), null);
  await c.services.ingestion.ingest([{ recordId: 'PR-1', source: 'partner_showroom', partnerId: 'P-SHOWROOM-01', plateRaw: '30K-555.66', phoneRaw: '0912000111', fullName: 'Lê Mới', seatsDeclared: 5, usageDeclared: 'personal', ownerType: 'individual' }], { actor: principal.id, sourceName: 'P-SHOWROOM-01' });
  await c.events.drain();
  const q = await c.services.sales.quote({ profileId: '30K55566', products: [{ code: 'TNDS_CAR' }, { code: 'MOTOR_PD', options: { sumInsured: 800000000 } }], channel: 'partner_api', partnerId: 'P-SHOWROOM-01' }, principal);
  await assert.rejects(c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'partner-000' }, principal), /inspection/);
  await c.services.sales.recordInspection(q.id, { passed: true, evidence: 'showroom PDI photos' }, ACTOR('assessor', ['telesales_supervisor']));
  const r = await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'partner-001' }, principal);
  assert.match(r.order.paymentRef, /^PARTNER-/, 'partner-collected premium, no wallet debit');
  await c.events.drain();
  const tnds = r.order.commission.find((x) => x.product === 'TNDS_CAR');
  assert.equal(tnds.rate, 0.05);
  assert.equal(r.order.commission.find((x) => x.product === 'MOTOR_PD').rate, 0.1);
  const st = await c.services.partners.statement('P-SHOWROOM-01', { from: '2020-01-01', to: '2030-01-01' });
  assert.equal(st.orders, 1);
  assert.ok(st.totalCommission > 0);
  await c.services.partners.revokeApiKey(key.id, admin);
  assert.equal(await c.services.partners.authenticateKey(key.apiKey), null);
  await assert.rejects(c.services.partners.revokeApiKey('nope', admin), /not found/);
  await c.services.partners.setStatus('P-BANK-01', 'suspended', admin);
  const k2 = await c.services.partners.issueApiKey('P-BANK-01', admin);
  assert.equal(await c.services.partners.authenticateKey(k2.apiKey), null, 'suspended partners cannot transact');
  const created = await c.services.partners.create({ name: 'New Bank', type: 'bank' }, admin);
  assert.match(created.id, /^P-/);
  assert.ok((await c.services.partners.list({ type: 'bank' })).length >= 2);
  await assert.rejects(c.services.partners.get('NOPE'), /not found/);
});

test('saga compensation: partial issuance cancels issued lines and refunds; failed keys cannot be replayed as success', async () => {
  const other = await findProfile(c, (x) => x.ownerType === 'individual' && x.vehicle.category === 'car_under6' && x.policy.insurer !== 'TASCO' && !x.anonymised && x.id !== p.id);
  const q = await c.services.sales.quote({ profileId: other.id, products: [{ code: 'TNDS_CAR' }, { code: 'PA_SEAT', options: { sumInsuredPerSeat: 10000000 } }], channel: 'vetc_app' }, customer(other.id));
  const realCore = c.gateways.policyAdmin.port;
  let n = 0;
  const cancelled = [];
  c.gateways.policyAdmin.port = {
    issuePolicy: async (x) => { n++; if (n === 2) throw errors.validation('line 2 rejected'); return realCore.issuePolicy(x); },
    cancelPolicy: async (x) => { cancelled.push(x.policyNo); return { status: 'cancelled' }; },
  };
  await assert.rejects(c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'saga-0001' }, customer(other.id)), /line 2 rejected/);
  c.gateways.policyAdmin.port = realCore;
  assert.equal(cancelled.length, 1, 'issued line was cancelled');
  const [o] = await c.services.sales.listOrders({ profileId: other.id, status: 'issuance_failed_refunded' });
  assert.equal(o.refund.status, 'refunded');
  const pol = await c.store.collection('policies').get(o.policies[0]);
  assert.equal(pol.status, 'cancelled');
  await assert.rejects(c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'saga-0001' }, customer(other.id)), /previous attempt/i);
  const ok = await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'saga-0002' }, customer(other.id));
  assert.equal(ok.order.status, 'completed', 'quote released for a clean retry');
});

test('copy guard catches whitespace and spacing evasions', () => {
  const { checkCopy } = require('../../src/domain/contactPolicy');
  const guard = { bannedPhrases: ['giảm giá', 'cashback'] };
  assert.equal(checkCopy(guard, 'Giảm   giá hôm nay').ok, false);
  assert.equal(checkCopy(guard, 'cash back 5%').ok, false);
  assert.equal(checkCopy(guard, 'c.a.s.h-back').ok, false);
  assert.equal(checkCopy(guard, 'Gia hạn bảo hiểm').ok, true);
});
