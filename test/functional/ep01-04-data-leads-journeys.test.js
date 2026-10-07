'use strict';

/**
 * Functional acceptance tests — EP-01 Data foundation, EP-02 Lead prioritisation,
 * EP-03 Renewal journeys, EP-04 New-business journeys. Test names = "US-xxx · scenario"
 * from docs/business/04-user-stories-and-acceptance-criteria.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { setup, individual } = require('./fx');
const { buildProfiles, inferCategory } = require('../../src/domain/enrichment');
const { canContact, checkCopy } = require('../../src/domain/contactPolicy');

const R = (k) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'rules', `${k}.json`), 'utf8')).payload;
let f;
test.before(async () => { f = await setup(); });
test.after(async () => { await f.srv.close(); });

// ---------- EP-01 Data foundation and repair
test('US-001 · Duplicate records for the same vehicle merge into one golden profile', async () => {
  const t = await f.as('steward');
  const r = await f.call('POST', '/api/data/ingest', { token: t, body: { source: 'partner_bank', records: [
    { recordId: 'F-1', source: 'vetc_account', plateRaw: '30a-123.45', phoneRaw: '+84912345678', fullName: 'Nguyễn An' },
    { recordId: 'F-2', source: 'partner_bank', plateRaw: '30A 12345', phoneRaw: '0912 345 678' }] } });
  assert.equal(r.status, 200);
  const p = await f.c.store.collection('profiles').get('30A12345');
  assert.equal(p.plate, '30A-123.45');
  assert.equal(p.phone, '0912345678');
  assert.ok(p.sources.includes('vetc_account') && p.sources.includes('partner_bank'));
});
test('US-001 · Invalid plate is rejected and raised as a DQ issue', async () => {
  const r = await f.call('POST', '/api/data/ingest', { token: await f.as('steward'), body: { source: 'partner_bank', records: [{ recordId: 'F-BAD', plateRaw: '30-12345' }] } });
  assert.equal(r.body.rejected, 1);
  assert.equal((await f.c.store.collection('dq_issues').get('record:F-BAD:invalid_plate')).status, 'open');
});
test('US-001 · Batch size limit', async () => {
  const records = Array.from({ length: 5001 }, (_, i) => ({ recordId: `B${i}` }));
  const big = await f.c.config;
  assert.ok(big);
  const r = await f.call('POST', '/api/data/ingest', { token: await f.as('steward'), body: { source: 'x', records } });
  assert.ok([400, 413].includes(r.status), 'rejected by validation or body limit');
});
test('US-002 · Verified certificate wins', () => {
  const { profiles } = buildProfiles(R('enrichment'), [{ recordId: 'a', source: 'vetc_account', plateRaw: '51G67890', policy: { insurer: 'TASCO', expiryDate: '2027-03-01', verified: true }, lastInspectionDate: '2026-03-10' }], '2026-10-07');
  assert.equal(profiles[0].policy.expiryDate, '2027-03-01');
  assert.equal(profiles[0].policy.expiryMethod, 'verified_certificate');
  assert.equal(profiles[0].policy.expiryConfidence, 1);
});
test('US-002 · Agreeing weak evidence is corroborated', () => {
  const { profiles } = buildProfiles(R('enrichment'), [{ recordId: 'a', source: 'vetc_account', plateRaw: '51G67891', lastInspectionDate: '2026-03-01', tagActivatedAt: '2025-03-10' }], '2026-10-07');
  assert.equal(profiles[0].policy.expiryMethod, 'inspection_cycle');
  assert.equal(profiles[0].policy.expiryConfidence, 0.65);
});
test('US-002 · Lineage shows the evidence', async () => {
  const r = await f.call('GET', '/api/customers/30A12345/lineage', { token: await f.as('steward') });
  assert.ok(r.body.fields.some((x) => x.field === 'policy.expiryDate' && x.source && x.confidence !== undefined));
});
test('US-003 · Correction requires evidence and is audited', async () => {
  const t = await f.as('steward');
  const r = await f.call('PATCH', '/api/customers/30A12345/expiry', { token: t, body: { expiryDate: '2027-01-15', insurer: 'PVI', evidence: 'certificate photo' } });
  assert.equal(r.status, 200);
  assert.equal((await f.c.store.collection('profiles').get('30A12345')).policy.expiryMethod, 'data_steward');
  assert.ok((await f.c.services.audit.list({ entityId: '30A12345' })).some((a) => a.action === 'profile.expiry_corrected'));
});
test('US-003 · Missing evidence', async () => {
  const r = await f.call('PATCH', '/api/customers/30A12345/expiry', { token: await f.as('steward'), body: { expiryDate: '2027-01-15' } });
  assert.equal(r.status, 400);
});
test('US-004 · Filter and resolve', async () => {
  const t = await f.as('steward');
  const list = await f.call('GET', '/api/dq/issues?type=phone&limit=5', { token: t });
  assert.ok(list.body.items.every((i) => i.type === 'phone'));
  const id = list.body.items[0].id;
  assert.equal((await f.call('POST', `/api/dq/issues/${encodeURIComponent(id)}/resolve`, { token: t, body: { resolution: 'called customer' } })).body.status, 'resolved');
});
test('US-005 · Customer declaration beats a weaker reload', async () => {
  const p = await f.profile((x) => individual(x) && x.policy.expiryConfidence < 0.75);
  const ct = await f.customer(p.id);
  await f.call('POST', '/api/customer/expiry', { token: ct, body: { expiryDate: '2027-02-02', insurer: 'PTI' } });
  await f.c.services.ingestion.rebuild([p.id], 'reload');
  const after = await f.c.store.collection('profiles').get(p.id);
  assert.equal(after.policy.expiryDate, '2027-02-02');
  assert.equal(after.policy.expiryMethod, 'customer_declared');
});
test('US-005 · Consent withdrawal survives reload', async () => {
  const p = await f.profile((x) => individual(x) && x.consent.marketing);
  await f.call('PUT', '/api/customer/consent', { token: await f.customer(p.id), body: { marketing: false } });
  await f.c.services.ingestion.rebuild([p.id], 'reload');
  assert.equal((await f.c.store.collection('profiles').get(p.id)).consent.marketing, false);
});
test('US-006 · Declared seats beat toll class', () => {
  assert.equal(inferCategory(R('enrichment'), { tollClass: 1, seats: 7 }).category, 'car_6_11');
});
test('US-006 · Toll class only', () => {
  const r = inferCategory(R('enrichment'), { tollClass: 1 });
  assert.equal(r.category, 'car_under6');
  assert.equal(r.confidence, 0.55);
});

// ---------- EP-02 Lead prioritisation
test('US-007 · Score, tier and reasons', async () => {
  const r = await f.call('GET', '/api/leads?limit=3', { token: await f.as('campaign') });
  const l = r.body.items[0];
  assert.ok(l.score >= 0 && l.score <= 100);
  assert.ok(['hot', 'warm', 'nurture'].includes(l.tier));
  assert.equal(l.reasons.length, 5);
  assert.ok(l.reasons.every((x) => x.why !== undefined && x.max > 0));
});
test('US-007 · Do-not-contact zeroes the score', async () => {
  const p = await f.profile((x) => x.consent.dnc);
  const l = await f.c.store.collection('leads').get(p.id);
  assert.equal(l.score, 0);
  assert.equal(l.nextBestAction.action, 'suppress');
});
test('US-007 · Filtering', async () => {
  const r = await f.call('GET', '/api/leads?tier=warm&journey=conquest&limit=20', { token: await f.as('campaign') });
  assert.ok(r.body.items.every((l) => l.tier === 'warm' && l.journey === 'conquest'));
});
test('US-008 · First matching NBA rule wins', async () => {
  const fleet = await f.profile((x) => x.ownerType === 'company' && !x.consent.dnc);
  assert.equal((await f.c.store.collection('leads').get(fleet.id)).nextBestAction.ruleId, 'fleet');
});
test('US-009 · Region scoping', async () => {
  const r = await f.call('GET', '/api/leads?limit=50', { token: await f.as('agent.hn') });
  assert.ok(r.body.items.every((l) => l.region === 'Hà Nội'));
});
test('US-009 · Profile outside region', async () => {
  const p = await f.profile((x) => x.province !== 'Hà Nội');
  assert.equal((await f.call('GET', `/api/customers/${p.id}`, { token: await f.as('agent.hn') })).status, 403);
});
test('US-010 · Purchase stops journeys', async () => {
  const p = await f.profile((x) => individual(x) && x.vehicle.category === 'car_under6' && x.policy.insurer !== 'TASCO' && x.policy.expiryDate);
  const ct = await f.customer(p.id);
  const q = await f.call('POST', '/api/customer/quotes', { token: ct, body: { products: [{ code: 'TNDS_CAR' }] } });
  await f.call('POST', '/api/customer/orders', { token: ct, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': 'fx-us010-1' } });
  assert.equal(await f.c.store.collection('touchpoints').count({ profile_id: p.id, status: 'scheduled', journey: { ne: 'cross_sell' } }), 0);
  assert.equal((await f.c.store.collection('leads').get(p.id)).nextBestAction.action, 'insured');
});
test('US-011 · Recompute', async () => {
  const r = await f.call('POST', '/api/leads/recompute', { token: await f.as('campaign') });
  assert.ok(r.body.recomputed > 300);
});

// ---------- EP-03 Renewal journeys
test('US-012 · Renewal cadence is planned from expiry', async () => {
  const lead = (await f.c.store.collection('leads').find({ where: { journey: 'renewal' }, limit: 50 })).find((l) => l.daysToExpiry > 20);
  const p = await f.c.store.collection('profiles').get(lead.id);
  const tps = await f.c.services.journeys.schedule({ profileId: lead.id });
  assert.ok(tps.length > 0);
  const offsets = tps.map((t) => (new Date(t.dueDate) - new Date(p.policy.expiryDate)) / 86400000);
  assert.ok(offsets.every((o) => [-45, -30, -21, -14, -7, -3, 0].includes(o)));
});
test('US-012 · App push first, then fallback', () => {
  const step = R('journeys').journeys.find((j) => j.id === 'renewal').steps.find((s) => s.step === 'first_reminder');
  assert.deepEqual(step.channels, ['app_push', 'zalo_zns', 'sms']);
});
const prof = (over = {}) => ({ channels: { app_push: true, zalo_zns: true, sms: true, voice_bot: true, telesales: true }, consent: { marketing: true, call: true, dnc: false }, ...over });
test('US-013 · Outside the contact window', () => {
  const r = canContact(R('contact_policy'), prof(), 'sms', { marketing: true, now: new Date('2026-10-07T14:30:00Z') });
  assert.ok(r.reasons.includes('outside allowed contact hours'));
});
test('US-013 · Weekly cap', () => {
  const hist = ['2026-10-03', '2026-10-04', '2026-10-05'].map((d) => ({ at: `${d}T03:00:00Z`, channel: 'sms', marketing: true }));
  assert.ok(canContact(R('contact_policy'), prof(), 'app_push', { marketing: true, now: new Date('2026-10-07T03:00:00Z'), history: hist }).reasons.includes('weekly contact cap reached'));
});
test('US-013 · No marketing consent', () => {
  assert.ok(canContact(R('contact_policy'), prof({ consent: { marketing: false, call: true, dnc: false } }), 'zalo_zns', { marketing: true, now: new Date('2026-10-07T03:00:00Z') }).reasons.includes('no marketing consent'));
});
test('US-014 · Send-time block', async () => {
  const p = await f.profile((x) => individual(x) && x.channels.sms);
  const content = await f.c.services.rules.get('content.messages');
  content.templates.__bad = { vi: 'Giảm giá 20% cho xe {{plate}}', en: '' };
  const orig = f.c.services.rules.get;
  f.c.services.rules.get = async (k) => (k === 'content.messages' ? content : orig(k));
  const m = await f.c.services.journeys.sendMessage({ profile: p, lead: null, channel: 'sms', templateKey: '__bad', marketing: false, now: new Date() });
  f.c.services.rules.get = orig;
  assert.equal(m.status, 'blocked');
  assert.match(m.blockReason, /copy guard/);
});
test('US-014 · Diacritic-insensitive', () => {
  assert.equal(checkCopy(R('copy_guard'), 'Giam gia hom nay').ok, false);
});
test('US-015 · Service message bypasses caps but not DNC', () => {
  const hist = [{ at: '2026-10-07T01:00:00Z', channel: 'sms', marketing: true }];
  const now = new Date('2026-10-07T03:00:00Z');
  assert.equal(canContact(R('contact_policy'), prof(), 'sms', { marketing: false, now, history: hist }).ok, true);
  assert.equal(canContact(R('contact_policy'), prof({ consent: { marketing: true, call: true, dnc: true } }), 'sms', { marketing: false, now }).ok, false);
});
test('US-016 · Journey escalation', async () => {
  const lead = (await f.c.store.collection('leads').find({ where: { tier: 'hot' }, limit: 100 })).find((l) => l.journey);
  const p = await f.c.store.collection('profiles').get(lead.id);
  const h = await f.c.services.voice.createDirectHandoff(p, lead, 'journey_escalation');
  assert.equal(h.status, 'open');
  assert.equal(h.outcome, 'journey_escalation');
});

// ---------- EP-04 New business
test('US-017 · Lapsed vehicle enters the recovery journey', async () => {
  const l = (await f.c.store.collection('leads').find({ where: { days_to_expiry: { lt: 0, gte: -60 } }, limit: 200 })).find((x) => x.journey);
  assert.equal(l.journey, 'lapsed_uninsured');
});
test('US-017 · Lapsed too long is not assumed uninsured', async () => {
  const l = await f.c.store.collection('leads').find({ where: { days_to_expiry: { lt: -60 } }, limit: 50 });
  assert.ok(l.every((x) => x.journey !== 'lapsed_uninsured'));
});
test('US-018 · Tag activation triggers onboarding', async () => {
  const p = await f.profile(individual);
  const r = await f.call('POST', '/api/ecosystem/events', { token: await f.as('campaign'), body: { type: 'vetc.tag_activated', profileId: p.id } });
  assert.match(r.body.actions[0].result, /new_vehicle/);
});
test('US-019 · Conquest copy is benefit-led and lawful', () => {
  const tpl = R('content.messages').templates.conquest_reminder;
  assert.match(tpl.vi, /\{\{benefit\}\}/);
  assert.equal(checkCopy(R('copy_guard'), tpl.vi).ok, true);
});
test('US-020 · Inspection booked with expiry soon', async () => {
  const l = (await f.c.store.collection('leads').find({ where: { days_to_expiry: { gte: 1, lte: 30 } }, limit: 50 }))[0];
  const r = await f.call('POST', '/api/ecosystem/events', { token: await f.as('campaign'), body: { type: 'vetc.inspection_booked', profileId: l.id } });
  assert.notEqual(r.body.actions[0].result, 'condition not met');
});
test('US-020 · Expiry far away', async () => {
  const l = (await f.c.store.collection('leads').find({ where: { days_to_expiry: { gte: 120 } }, limit: 5 }))[0];
  const r = await f.call('POST', '/api/ecosystem/events', { token: await f.as('campaign'), body: { type: 'vetc.inspection_booked', profileId: l.id } });
  assert.equal(r.body.actions[0].result, 'condition not met');
});
test('US-021 · Wallet top-up within ±30 days of expiry', async () => {
  const l = (await f.c.store.collection('leads').find({ where: { days_to_expiry: { gte: 1, lte: 25 } }, limit: 50 }))[0];
  const r = await f.call('POST', '/api/ecosystem/events', { token: await f.as('campaign'), body: { type: 'vetc.wallet_topped_up', profileId: l.id } });
  assert.notEqual(r.body.actions[0].result, 'condition not met');
});
test('US-022 · Simulator', async () => {
  const p = await f.profile(individual);
  for (const type of ['vetc.tag_activated', 'vetc.inspection_booked', 'vetc.wallet_topped_up', 'vetc.long_trip_started']) {
    assert.equal((await f.call('POST', '/api/ecosystem/events', { token: await f.as('campaign'), body: { type, profileId: p.id } })).status, 200, type);
  }
});
