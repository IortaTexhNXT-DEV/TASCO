'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildProfiles, inferCategory, applyDeclaredExpiry } = require('../../src/domain/enrichment');
const { factsFor, evaluateLead, planTouchpoints, assignJourney, benefitsFor } = require('../../src/domain/leads');
const { rate, coverStartDate, commissionFor } = require('../../src/domain/rating');
const { canContact, checkCopy, inContactWindow } = require('../../src/domain/contactPolicy');
const { validatePayload, copyViolations } = require('../../src/rules/validators');
const { generate } = require('../../src/adapters/integrations/syntheticVetcSource');

const RULES_DIR = path.join(__dirname, '..', '..', 'config', 'rules');
const R = Object.fromEntries(fs.readdirSync(RULES_DIR).map((f) => { const d = JSON.parse(fs.readFileSync(path.join(RULES_DIR, f), 'utf8')); return [d.kind, d.payload]; }));
const TODAY = '2026-10-07';

test('every shipped default rule set is valid', () => {
  for (const [kind, payload] of Object.entries(R)) {
    assert.deepEqual(validatePayload(kind, payload, { bannedPhrases: R.copy_guard.bannedPhrases }), [], kind);
  }
});

test('validators reject bad payloads', () => {
  assert.ok(validatePayload('scoring', { ...R.scoring, factors: [{ ...R.scoring.factors[0], weight: 99 }] }).some((e) => e.includes('sum to 100')));
  assert.ok(validatePayload('scoring', { ...R.scoring, tiers: { hot: 10, warm: 20 } }).some((e) => e.includes('tiers')));
  assert.ok(validatePayload('tariff.tnds_car', { vatRate: 0.5, categories: { x: { annual: -1 } } }).length >= 2);
  assert.ok(validatePayload('products', { products: [{ code: 'bad code', rating: { method: 'magic' } }], bundles: [{ code: 'B', products: ['NOPE'] }] }).length >= 3);
  assert.ok(validatePayload('journeys', { journeys: [{ id: 'a', anchor: 'moon', steps: [{ step: 's', channels: [] }] }, { id: 'a', anchor: 'today', steps: [] }] }).length >= 3);
  assert.ok(validatePayload('contact_policy', { contactWindow: { startHour: 22, endHour: 8 } }).length === 1);
  const over = structuredClone(R.commission);
  over.table.rules[0].then.rate = 0.2;
  assert.ok(validatePayload('commission', over).some((e) => e.includes('statutory cap')));
  assert.ok(validatePayload('content.messages', { templates: { x: { vi: 'Giảm giá 10%!', en: 'ok' } } }, { bannedPhrases: R.copy_guard.bannedPhrases }).some((e) => e.includes('copy guard')));
  assert.ok(validatePayload('nba', { rules: [{ id: 'x', when: { hack: 1 }, then: {} }], hitPolicy: 'first' }).some((e) => e.includes('unsupported')));
  assert.deepEqual(validatePayload('BAD KIND', {}), ['invalid kind']);
  assert.deepEqual(validatePayload('scoring', null), ['payload must be an object']);
  assert.deepEqual(copyViolations('Không giam gia', ['giảm giá']), ['giảm giá']);
});

test('enrichment builds golden profiles with lineage, survivorship and DQ issues', () => {
  const raw = generate({ count: 300, seed: 7, today: TODAY });
  const out = buildProfiles(R.enrichment, raw, TODAY);
  assert.ok(out.profiles.length > 250 && out.profiles.length <= 300);
  assert.ok(out.rejects.length > 0, 'dirty plates are rejected');
  assert.ok(out.stats.duplicatesMerged > 0, 'duplicates merged across sources');
  assert.ok(out.stats.usableExpiryRate > out.stats.verifiedStampRateRaw, 'enrichment improves usable data');
  const p = out.profiles[0];
  assert.match(p.id, /^\d{2}[A-Z]{1,2}\d{4,5}$/);
  assert.ok(p.lineage.some((l) => l.field === 'policy.expiryDate'));
  assert.ok(out.dqIssues.every((i) => i.status === 'open'));
});

test('expiry inference prefers verified certificates and corroborates', () => {
  const recs = [
    { recordId: '1', source: 'vetc_account', plateRaw: '30A12345', lastInspectionDate: '2025-11-01', tagActivatedAt: '2024-11-03' },
    { recordId: '2', source: 'partner_bank', plateRaw: '30A-123.45', policy: { insurer: 'PVI', expiryDate: '2026-11-01', verified: false }, declaredExpiry: '2026-11-02' },
  ];
  const { profiles } = buildProfiles(R.enrichment, recs, TODAY);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].policy.expiryMethod, 'customer_declared');
  assert.ok(profiles[0].policy.expiryConfidence > 0.75, 'agreeing evidence boosts confidence');
  assert.equal(profiles[0].policy.insurer, 'PVI');
  const verified = buildProfiles(R.enrichment, [{ recordId: '3', source: 'vetc_account', plateRaw: '51G67890', policy: { insurer: 'TASCO', expiryDate: '2027-01-01', verified: true, certNo: 'TAS-1' } }], TODAY);
  assert.equal(verified.profiles[0].policy.expiryConfidence, 1);
  assert.equal(verified.profiles[0].policy.verified, true);
  const none = buildProfiles(R.enrichment, [{ recordId: '4', source: 'telesales_csv', plateRaw: '43A11111' }], TODAY);
  assert.equal(none.profiles[0].policy.expiryMethod, 'unknown');
});

test('vehicle category inference from toll class and seats', () => {
  assert.equal(inferCategory(R.enrichment, { tollClass: 1, seats: 7 }).category, 'car_6_11');
  assert.equal(inferCategory(R.enrichment, { tollClass: 1, seats: 5, usage: 'commercial' }).category, 'commercial_under6');
  assert.equal(inferCategory(R.enrichment, { tollClass: 4, seats: 2 }).category, 'truck_over15t');
  assert.equal(inferCategory(R.enrichment, { tollClass: 3, seats: 2 }).category, 'truck_8_15t');
  assert.equal(inferCategory(R.enrichment, { tollClass: 2, seats: 2 }).category, 'truck_3_8t');
  assert.equal(inferCategory(R.enrichment, { tollClass: 1, seats: 2 }).category, 'truck_under3t');
  assert.equal(inferCategory(R.enrichment, { seats: 16 }).category, 'car_12_24');
  assert.equal(inferCategory(R.enrichment, { seats: 30 }).category, 'car_over24');
  assert.equal(inferCategory(R.enrichment, { seats: 7, usage: 'commercial' }).category, 'commercial_6_8');
  assert.equal(inferCategory(R.enrichment, { tollClass: 2 }).category, 'car_12_24');
  assert.equal(inferCategory(R.enrichment, { tollClass: 3 }).category, 'truck_8_15t');
  assert.equal(inferCategory(R.enrichment, { tollClass: 5 }).category, 'truck_over15t');
  assert.equal(inferCategory(R.enrichment, { tollClass: 1, ownerType: 'company' }).category, 'commercial_under6');
  assert.equal(inferCategory(R.enrichment, {}).ruleId, 'default');
});

function profile(over = {}) {
  return {
    id: '30A12345', plate: '30A-123.45', province: 'Hà Nội', name: 'A', phone: '0912345678', ownerType: 'individual', tagActivatedAt: '2023-01-01',
    vehicle: { category: 'car_under6', seats: 5, usage: 'personal', firstRegisteredYear: 2023 },
    policy: { expiryDate: '2026-10-20', expiryMethod: 'verified_certificate', expiryConfidence: 1, insurer: 'TASCO' },
    engagement: { appSessions30d: 12, tollTrips30d: 20, longTripsKm90d: 2000, walletBalance: 2000000, autoTopUp: true, priorVetcInsurancePurchase: true, complaints12m: 0 },
    channels: { app_push: true, zalo_zns: true, sms: true, voice_bot: true, telesales: true },
    consent: { marketing: true, call: true, dnc: false },
    dataQuality: { score: 90, missing: [] },
    ...over,
  };
}
const leadRules = { scoring: R.scoring, nba: R.nba, journeys: R.journeys, benefits: R.benefits };

test('lead evaluation: TASCO customer expiring soon is a hot renewal for the voice bot', () => {
  const lead = evaluateLead(leadRules, profile(), TODAY, 480700);
  assert.equal(lead.journey, 'renewal');
  assert.equal(lead.tier, 'hot');
  assert.equal(lead.nextBestAction.action, 'voice_bot');
  assert.equal(lead.reasons.length, 5);
  assert.ok(lead.benefits.length <= R.benefits.maxShown);
  assert.ok(lead.benefits.every((b) => b.legalStatus === 'approved'));
});

test('lead evaluation: journeys for new business', () => {
  const lapsed = evaluateLead(leadRules, profile({ policy: { expiryDate: '2026-09-20', expiryMethod: 'partner_policy_record', expiryConfidence: 0.7, insurer: 'PVI' } }), TODAY, 480700);
  assert.equal(lapsed.journey, 'lapsed_uninsured');
  assert.equal(lapsed.nextBestAction.action, 'urgent_recovery');
  const conquest = evaluateLead(leadRules, profile({ policy: { expiryDate: '2026-11-01', expiryMethod: 'customer_declared', expiryConfidence: 0.75, insurer: 'PTI' } }), TODAY, 480700);
  assert.equal(conquest.journey, 'conquest');
  const newVeh = evaluateLead(leadRules, profile({ tagActivatedAt: '2026-09-20', policy: { expiryDate: null, expiryMethod: 'unknown', expiryConfidence: 0, insurer: null } }), TODAY, 480700);
  assert.equal(newVeh.journey, 'new_vehicle');
  assert.equal(newVeh.nextBestAction.action, 'verify_expiry', 'data repair comes first');
  const dnc = evaluateLead(leadRules, profile({ consent: { marketing: true, call: true, dnc: true } }), TODAY, 480700);
  assert.equal(dnc.score, 0);
  assert.equal(dnc.nextBestAction.action, 'suppress');
  const fleet = evaluateLead(leadRules, profile({ ownerType: 'company' }), TODAY, 480700);
  assert.equal(fleet.nextBestAction.action, 'route_b2b');
  const early = evaluateLead(leadRules, profile({ policy: { expiryDate: '2027-05-01', expiryMethod: 'verified_certificate', expiryConfidence: 1, insurer: 'TASCO' } }), TODAY, 480700);
  assert.equal(early.nextBestAction.action, 'nurture');
  const noPhone = evaluateLead(leadRules, profile({ phone: null, channels: { app_push: false, zalo_zns: false, sms: false, voice_bot: false, telesales: false }, consent: { marketing: false, call: false, dnc: false } }), TODAY, 480700);
  assert.equal(noPhone.nextBestAction.action, 'enrich');
  const smsOnly = evaluateLead(leadRules, profile({ channels: { app_push: false, zalo_zns: false, sms: true, voice_bot: true, telesales: true }, consent: { marketing: true, call: false, dnc: false } }), TODAY, 480700);
  assert.equal(smsOnly.nextBestAction.action, 'sms_reminder');
  assert.equal(assignJourney({ journeys: [] }, {}), null);
});

test('touchpoint planning follows the journey cadence and tier filters', () => {
  const p = profile();
  const lead = evaluateLead(leadRules, p, TODAY, 480700);
  const tps = planTouchpoints(R.journeys, lead, p, TODAY);
  assert.ok(tps.length >= 3);
  assert.ok(tps.every((t) => t.dueDate >= '2026-10-05'), 'past steps beyond catch-up are skipped');
  assert.ok(tps.some((t) => t.step === 'voice_bot'));
  assert.deepEqual(planTouchpoints(R.journeys, { ...lead, journey: 'nope' }, p, TODAY), []);
  const nv = profile({ tagActivatedAt: '2026-10-05', policy: { expiryDate: null, expiryMethod: 'unknown', expiryConfidence: 0, insurer: null } });
  const nvLead = evaluateLead(leadRules, nv, TODAY, 1);
  assert.ok(planTouchpoints(R.journeys, nvLead, nv, TODAY).some((t) => t.step === 'welcome'));
  assert.deepEqual(planTouchpoints(R.journeys, { ...lead, journey: 'renewal' }, { ...p, policy: { ...p.policy, expiryDate: null } }, TODAY), []);
});

test('benefits: eligibility, legal filter and staff view', () => {
  const facts = factsFor(profile({ ownerType: 'company' }), TODAY);
  const customer = benefitsFor(R.benefits, facts, { limit: 20 });
  assert.ok(!customer.some((b) => b.id === 'fleet_dashboard'), 'roadmap items are staff-only');
  assert.ok(!customer.some((b) => b.legalStatus !== 'approved'));
  const staff = benefitsFor(R.benefits, facts, { audience: 'staff', limit: 20 });
  assert.ok(staff.some((b) => b.id === 'loyalty_points'));
  assert.ok(staff.some((b) => b.id === 'fleet_dashboard' && b.available === false));
});

test('rating: regulated TNDS tariff, pro-rata multi-year, add-on covers, commission caps', () => {
  const products = Object.fromEntries(R.products.products.map((p) => [p.code, p]));
  const q = rate(products.TNDS_CAR, R['tariff.tnds_car'], { category: 'car_under6', startDate: '2026-10-08' });
  assert.equal(q.premiumNet, 437000);
  assert.equal(q.vat, 43700);
  assert.equal(q.total, 480700);
  assert.equal(q.priceRegulated, true);
  assert.equal(q.endDate, '2027-10-08');
  const q2 = rate(products.TNDS_CAR, R['tariff.tnds_car'], { category: 'car_under6', startDate: '2026-10-08', termYears: 2 });
  assert.equal(q2.termDays, 731, '2028 is a leap year');
  assert.equal(q2.premiumNet, 874000);
  const q9 = rate(products.TNDS_CAR, R['tariff.tnds_car'], { category: 'car_under6', startDate: '2026-10-08', termYears: 9 });
  assert.ok(q9.termDays <= 3 * 366);
  assert.throws(() => rate(products.TNDS_CAR, R['tariff.tnds_car'], { category: 'spaceship', startDate: '2026-10-08' }), /Unknown vehicle category/);
  const pd = rate(products.MOTOR_PD, R['rating.motor_pd'], { sumInsured: 500000000, vehicleAge: 2, usage: 'personal', deductible: 0, startDate: '2026-10-08' });
  assert.equal(pd.premiumNet, 7500000);
  const pdOld = rate(products.MOTOR_PD, R['rating.motor_pd'], { sumInsured: 100000000, vehicleAge: 15, deductible: 1000000, startDate: '2026-10-08' });
  assert.equal(pdOld.premiumNet, 1890000);
  const pdMin = rate(products.MOTOR_PD, R['rating.motor_pd'], { sumInsured: 10000000, vehicleAge: 1, deductible: 0, startDate: '2026-10-08' });
  assert.equal(pdMin.premiumNet, R['rating.motor_pd'].minPremium);
  assert.throws(() => rate(products.MOTOR_PD, R['rating.motor_pd'], { sumInsured: 9e10, startDate: '2026-10-08', deductible: 0 }), /refer to underwriter/);
  assert.throws(() => rate(products.MOTOR_PD, R['rating.motor_pd'], { sumInsured: -1, startDate: '2026-10-08' }), /positive/);
  assert.throws(() => rate(products.MOTOR_PD, R['rating.motor_pd'], { sumInsured: 1e8, startDate: '2026-10-08', deductible: 7 }), /deductible/);
  const pa = rate(products.PA_SEAT, R['rating.pa_seat'], { seats: 5, sumInsuredPerSeat: 20000000, startDate: '2026-10-08' });
  assert.equal(pa.premiumNet, 100000);
  assert.equal(pa.vat, 0, 'personal accident is VAT exempt');
  assert.throws(() => rate(products.PA_SEAT, R['rating.pa_seat'], { seats: 0, sumInsuredPerSeat: 20000000, startDate: '2026-10-08' }), /seats/);
  assert.throws(() => rate(products.PA_SEAT, R['rating.pa_seat'], { seats: 4, sumInsuredPerSeat: 1, startDate: '2026-10-08' }), /sum insured/);
  assert.throws(() => rate({ ...products.PA_SEAT, status: 'retired' }, R['rating.pa_seat'], {}), /not on sale/);
  assert.throws(() => rate({ ...products.PA_SEAT, rating: { method: 'x' } }, R['rating.pa_seat'], {}), /No rating method/);
  assert.equal(coverStartDate('2026-10-20', TODAY), '2026-10-21');
  assert.equal(coverStartDate('2026-01-01', TODAY), TODAY);
  assert.equal(coverStartDate(null, TODAY), TODAY);
  const comm = commissionFor(R.commission, { product: 'TNDS_CAR', partnerType: 'bank', premiumNet: 437000 });
  assert.equal(comm.rate, 0.05);
  assert.equal(comm.amount, 21850);
  const capped = commissionFor({ ...R.commission, table: { rules: [{ id: 'x', then: { rate: 0.5 } }] } }, { product: 'TNDS_CAR', premiumNet: 100 });
  assert.equal(capped.capped, true);
  assert.equal(capped.rate, 0.05);
});

test('contact policy: consent, DNC, quiet hours and frequency caps', () => {
  const pol = R.contact_policy;
  const p = profile();
  const noon = new Date('2026-10-07T05:00:00Z'); // 12:00 in Vietnam
  const night = new Date('2026-10-07T15:00:00Z'); // 22:00 in Vietnam
  assert.equal(inContactWindow(pol, noon), true);
  assert.equal(inContactWindow(pol, night), false);
  assert.equal(canContact(pol, p, 'app_push', { marketing: true, now: noon }).ok, true);
  assert.ok(canContact(pol, p, 'app_push', { marketing: true, now: night }).reasons.includes('outside allowed contact hours'));
  assert.equal(canContact(pol, p, 'app_push', { marketing: false, now: night }).ok, true, 'service notices are allowed');
  assert.ok(canContact(pol, profile({ consent: { marketing: false, call: true, dnc: false } }), 'sms', { marketing: true, now: noon }).reasons.includes('no marketing consent'));
  assert.ok(canContact(pol, profile({ consent: { marketing: true, call: false, dnc: false } }), 'voice_bot', { marketing: true, now: noon }).reasons.includes('no call consent'));
  assert.ok(canContact(pol, profile({ consent: { marketing: true, call: true, dnc: true } }), 'sms', { marketing: false, now: noon }).reasons[0].includes('do-not-contact'));
  assert.ok(canContact(pol, profile({ channels: { ...p.channels, zalo_zns: false } }), 'zalo_zns', { marketing: false, now: noon }).reasons[0].includes('not reachable'));
  const recent = [{ at: '2026-10-07T01:00:00Z', channel: 'sms', marketing: true }];
  assert.ok(canContact(pol, p, 'app_push', { marketing: true, now: noon, history: recent }).reasons.includes('daily contact cap reached'));
  const week = [1, 2, 3].map((d) => ({ at: `2026-10-0${d + 2}T03:00:00Z`, channel: 'voice_bot', marketing: true }));
  const r = canContact(pol, p, 'voice_bot', { marketing: true, now: noon, history: week });
  assert.ok(r.reasons.includes('weekly contact cap reached'));
  assert.ok(r.reasons.includes('weekly call cap reached'));
  assert.equal(checkCopy(R.copy_guard, 'Gia hạn ngay').ok, true);
  assert.equal(checkCopy(R.copy_guard, 'Chiết khấu 10%').ok, false);
  assert.equal(checkCopy(R.copy_guard, 'Chiet khau 10%').ok, false, 'diacritic-free variants are caught');
});

test('applyDeclaredExpiry updates evidence and closes DQ gaps', () => {
  const p = profile({ policy: { expiryDate: null, expiryMethod: 'unknown', expiryConfidence: 0, insurer: null, expiryCandidates: [] }, dataQuality: { score: 10, missing: ['reliable_expiry', 'current_insurer'] }, lineage: [] });
  const u = applyDeclaredExpiry(p, { expiryDate: '2027-01-01', insurer: 'PVI' });
  assert.equal(u.policy.expiryDate, '2027-01-01');
  assert.equal(u.policy.insurer, 'PVI');
  assert.deepEqual(u.dataQuality.missing, []);
  const low = applyDeclaredExpiry(profile(), { expiryDate: '2030-01-01', confidence: 0.1 });
  assert.equal(low.policy.expiryDate, '2026-10-20', 'weaker evidence does not override');
});
