'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateQuickRenewal, quickRenewalSettings, QUICK_RENEWAL_REASONS } = require('../../src/domain/quickRenewal');
const { validatePayload } = require('../../src/rules/validators');
const levels = require('../../config/rules/service_levels.json');
const products = require('../../config/rules/products.json');

const TODAY = '2026-10-07';
const NOW = Date.parse('2026-10-07T03:00:00Z');
const DAY = 86400000;

/** An eligible renewal: journey renewal, vehicle confirmed by the customer last month, enough wallet balance. */
function facts(over = {}) {
  return {
    settings: quickRenewalSettings(levels.payload),
    profile: { id: '30E94935', vehicle: { seats: 5, usage: 'personal', category: 'car_lt6' }, engagement: { walletBalance: 900000 }, policy: { insurer: 'PVI' } },
    lead: { journey: 'renewal', premium: 480700 },
    policies: [],
    vehicleEvidence: [{ source: 'customer_vehicle_confirmed', at: new Date(NOW - 30 * DAY).toISOString() }],
    catalogue: products.payload,
    channel: 'vetc_app',
    coreAvailable: true,
    today: TODAY,
    nowMs: NOW,
    ...over,
  };
}
const codes = (over) => evaluateQuickRenewal(facts(over)).codes;

test('quick renewal: eligible case offers compulsory TNDS for one year, no reasons', () => {
  const r = evaluateQuickRenewal(facts());
  assert.equal(r.eligible, true);
  assert.deepEqual(r.reasons, []);
  assert.deepEqual(r.products, [{ code: 'TNDS_CAR', options: { termYears: 1 } }]);
  assert.equal(r.termYears, 1);
});

test('quick renewal: configuration from service_levels (defaults off for older rule versions)', () => {
  assert.equal(quickRenewalSettings(levels.payload).enabled, true);
  assert.deepEqual(quickRenewalSettings(levels.payload).journeys, ['renewal']);
  assert.equal(quickRenewalSettings({}).enabled, false, 'no quickRenewal block → no quick path');
  assert.equal(levels.payload.dsarResponseHours, 72);
  assert.match(levels.description, /TASCO LEGAL/i);
  assert.match(levels.description, /13\/2023/);
  assert.match(levels.description, /91\/2025/);
});

test('quick renewal: config disabled means no quick path', () => {
  const r = evaluateQuickRenewal(facts({ settings: { ...quickRenewalSettings(levels.payload), enabled: false } }));
  assert.equal(r.eligible, false);
  assert.deepEqual(r.codes, ['disabled']);
  assert.equal(r.reasons[0], QUICK_RENEWAL_REASONS.disabled);
});

test('quick renewal: each ineligible reason, in Vietnamese business language', () => {
  // Journey not in the list and not renewing a TASCO policy.
  assert.deepEqual(codes({ lead: { journey: 'conquest', premium: 480700 } }), ['journey']);
  // …but a customer renewing a TASCO policy qualifies whatever the journey.
  assert.deepEqual(codes({ lead: { journey: null, premium: 480700 }, profile: { ...facts().profile, policy: { insurer: 'TASCO' } } }), []);
  // Already renewed: a TASCO compulsory policy starting in the future.
  assert.ok(codes({ policies: [{ product: 'TNDS_CAR', status: 'active', insurer: 'TASCO', startDate: '2026-11-01', endDate: '2027-10-31', orderId: 'O-1' }] }).includes('already_renewed'));
  // Vehicle: seats unknown; no confirmation at all; confirmation too old.
  assert.deepEqual(codes({ profile: { ...facts().profile, vehicle: { seats: null, usage: 'personal' } } }), ['vehicle_unconfirmed']);
  assert.deepEqual(codes({ vehicleEvidence: [] }), ['vehicle_unconfirmed']);
  assert.deepEqual(codes({ vehicleEvidence: [{ source: 'customer_vehicle_confirmed', at: new Date(NOW - 400 * DAY).toISOString() }] }), ['vehicle_confirmation_expired']);
  // Physical damage cover needs an inspection → full flow.
  assert.ok(codes({ policies: [{ product: 'MOTOR_PD', status: 'active', insurer: 'TASCO', startDate: '2025-10-20', endDate: '2026-10-19', orderId: 'O-2' }] }).includes('physical_damage'));
  // Product not sold on this host.
  assert.deepEqual(codes({ catalogue: { products: products.payload.products.map((p) => (p.code === 'TNDS_CAR' ? { ...p, channels: ['telesales'] } : p)) } }), ['product_unavailable']);
  // Price would be indicative (TASCO core unavailable).
  assert.deepEqual(codes({ coreAvailable: false }), ['core_unavailable']);
  // VETC wallet below the premium (VETC hosts only).
  assert.deepEqual(codes({ profile: { ...facts().profile, engagement: { walletBalance: 100000 } } }), ['wallet_low']);
  assert.deepEqual(codes({ channel: 'tasco_app', profile: { ...facts().profile, engagement: { walletBalance: 100000 } } }), [], 'TASCO payment gateway: no wallet check');
  assert.deepEqual(codes({ lead: { journey: 'renewal', premium: null }, profile: { ...facts().profile, engagement: { walletBalance: 0 } } }), [], 'premium unknown → skipped');
  const r = evaluateQuickRenewal(facts({ vehicleEvidence: [], coreAvailable: false }));
  assert.deepEqual(r.reasons, ['Cần xác nhận thông tin xe', 'Hệ thống định phí TASCO đang bận']);
  for (const reason of Object.values(QUICK_RENEWAL_REASONS)) assert.doesNotMatch(reason, /[a-z]+_[a-z]+/, 'no codes in customer text');
});

test('quick renewal: vehicle known from TASCO core, add-ons and term carried over', () => {
  // TASCO core evidence has no age limit.
  assert.deepEqual(codes({ vehicleEvidence: [{ source: 'tasco_core', at: null }] }), []);
  // requireConfirmedVehicle off: use and seats on file are enough.
  assert.deepEqual(codes({ vehicleEvidence: [], settings: { ...quickRenewalSettings(levels.payload), requireConfirmedVehicle: false } }), []);
  const pols = [
    { product: 'TNDS_CAR', status: 'active', insurer: 'TASCO', startDate: '2024-10-20', endDate: '2026-10-19', orderId: 'O-9' },
    { product: 'PA_SEAT', status: 'active', insurer: 'TASCO', startDate: '2024-10-20', endDate: '2026-10-19', orderId: 'O-9' },
  ];
  const noAddOns = evaluateQuickRenewal(facts({ policies: pols, profile: { ...facts().profile, engagement: { walletBalance: 5000000 } } }));
  assert.equal(noAddOns.termYears, 2);
  assert.deepEqual(noAddOns.products.map((p) => p.code), ['TNDS_CAR'], 'allowAddOns false → compulsory only');
  const withAddOns = evaluateQuickRenewal(facts({ policies: pols, settings: { ...quickRenewalSettings(levels.payload), allowAddOns: true }, profile: { ...facts().profile, engagement: { walletBalance: 5000000 } } }));
  assert.deepEqual(withAddOns.products.map((p) => p.code), ['TNDS_CAR', 'PA_SEAT']);
  assert.equal(withAddOns.eligible, true);
  // Wallet check uses the premium for the whole term.
  assert.ok(codes({ policies: pols, profile: { ...facts().profile, engagement: { walletBalance: 900000 } } }).includes('wallet_low'));
});

test('service_levels validation: dsarResponseHours and quickRenewal', () => {
  assert.deepEqual(validatePayload('service_levels', levels.payload), []);
  const bad = (patch) => validatePayload('service_levels', { ...levels.payload, ...patch });
  assert.ok(bad({ dsarResponseHours: 0 }).some((e) => /dsarResponseHours/.test(e)));
  assert.ok(bad({ dsarResponseHours: 1.5 }).some((e) => /dsarResponseHours/.test(e)));
  assert.ok(bad({ quoteTtlHours: -1 }).some((e) => /quoteTtlHours/.test(e)));
  assert.ok(bad({ customerDeclaredConfidence: 2 }).some((e) => /customerDeclaredConfidence/.test(e)));
  assert.ok(bad({ quickRenewal: 'yes' }).some((e) => /quickRenewal must be an object/.test(e)));
  assert.ok(bad({ quickRenewal: { ...levels.payload.quickRenewal, enabled: 'yes' } }).some((e) => /quickRenewal.enabled/.test(e)));
  assert.ok(bad({ quickRenewal: { ...levels.payload.quickRenewal, journeys: ['Renewal!'] } }).some((e) => /quickRenewal.journeys/.test(e)));
  assert.ok(bad({ quickRenewal: { ...levels.payload.quickRenewal, vehicleConfirmationMaxAgeDays: 0 } }).some((e) => /vehicleConfirmationMaxAgeDays/.test(e)));
  const { quickRenewal, dsarResponseHours, ...older } = levels.payload; // eslint-disable-line no-unused-vars
  assert.deepEqual(validatePayload('service_levels', older), [], 'older versions without the new fields stay valid');
});
