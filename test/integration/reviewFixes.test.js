'use strict';

/**
 * Regression tests for the client screenshot review: score reason texts, TASCO
 * certificate → renewal consistency, distinct-vehicle DQ KPI, claims queue
 * context, grouped partner statements, stable demo picker and actor names.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeContainer, ACTOR, findProfile } = require('../helpers');
const { buildProfiles, applyDeclaredExpiry, applyRenewedElsewhereClaim } = require('../../src/domain/enrichment');
const { evaluateLead, reasonText } = require('../../src/domain/leads');

const RULES_DIR = path.join(__dirname, '..', '..', 'config', 'rules');
const R = Object.fromEntries(fs.readdirSync(RULES_DIR).map((f) => { const d = JSON.parse(fs.readFileSync(path.join(RULES_DIR, f), 'utf8')); return [d.kind, d.payload]; }));
const TODAY = '2026-10-07';

let c;
test.before(async () => { c = await makeContainer(); });

// ---------- #17 score breakdown reasons
test('score reasons: never empty, tidy separators, "phone (call consent)" spacing', () => {
  assert.equal(reasonText('app push; Zalo; phone (call consent); '), 'app push; Zalo; phone (call consent)');
  assert.equal(reasonText('', 'no prior relationship'), 'no prior relationship');
  assert.equal(reasonText('  ;  ', undefined), 'no supporting signal');
  const { profiles: [p] } = buildProfiles(R.enrichment, [{ recordId: 'a', source: 'vetc_account', plateRaw: '30A12345', phoneRaw: '0912345678', ownerType: 'individual',
    callConsent: true, tagActivatedAt: '2024-01-01', policy: { insurer: 'PVI', expiryDate: '2026-11-01', verified: false } }], TODAY);
  p.channels = { app_push: false, zalo_zns: false, sms: true, voice_bot: true, telesales: true };
  p.consent = { marketing: true, call: true, dnc: false };
  const lead = evaluateLead({ scoring: R.scoring, nba: R.nba, journeys: R.journeys, benefits: R.benefits }, p, TODAY, 437000);
  for (const r of lead.reasons) assert.ok(r.why && r.why.trim().length > 0, `${r.label} has a reason`);
  const reach = lead.reasons.find((r) => r.factor === 'reachability');
  assert.match(reach.why, /phone \(call consent\)/);
  assert.doesNotMatch(reach.why, /phone\(/);
  const rel = lead.reasons.find((r) => r.factor === 'affinity');
  assert.match(rel.why, /no prior relationship/);
});

// ---------- #18 TASCO certificate ⇒ TASCO insurer ⇒ renewal; bot claim cannot contradict it
test('a verified TASCO certificate makes the profile a TASCO renewal, whatever weaker sources say', () => {
  const { profiles: [p] } = buildProfiles(R.enrichment, [
    { recordId: 'p1', source: 'telesales_csv', plateRaw: '51G67890', ownerType: 'individual', policy: { insurer: 'PVI', certNo: null, expiryDate: '2027-03-01', verified: false } },
    { recordId: 'a1', source: 'vetc_account', plateRaw: '51G-678.90', ownerType: 'individual', tagActivatedAt: '2023-05-01', policy: { insurer: 'TASCO', certNo: 'TAS-123456', expiryDate: '2027-03-01', verified: true } },
  ], TODAY);
  assert.equal(p.policy.insurer, 'TASCO');
  assert.equal(p.policy.expiryMethod, 'verified_certificate');
  const lead = evaluateLead({ scoring: R.scoring, nba: R.nba, journeys: R.journeys, benefits: R.benefits }, p, TODAY, 437000);
  assert.equal(lead.journey, 'renewal');

  const { profile: after, conflict } = applyRenewedElsewhereClaim(p, { confidence: 0.6, note: 'Bảo Việt' });
  assert.equal(conflict, true);
  assert.equal(after.policy.insurer, 'TASCO', 'spoken claim does not flip a verified TASCO customer to conquest');
  assert.equal(after.policy.expiryDate, '2027-03-01');
  assert.equal(after.policy.expiryCandidates.length, p.policy.expiryCandidates.length, 'no invented year-later expiry');
  assert.equal(after.policy.renewalClaim.status, 'unverified');
  assert.equal(evaluateLead({ scoring: R.scoring, nba: R.nba, journeys: R.journeys, benefits: R.benefits }, after, TODAY, 437000).journey, 'renewal');
});

test('weaker declared evidence is kept as superseded and does not change the insurer', () => {
  const { profiles: [p] } = buildProfiles(R.enrichment, [{ recordId: 'a', source: 'vetc_account', plateRaw: '30A55555', ownerType: 'individual', policy: { insurer: 'TASCO', certNo: 'TAS-1', expiryDate: '2027-01-10', verified: true } }], TODAY);
  const q = applyDeclaredExpiry(p, { expiryDate: '2028-01-10', insurer: 'OTHER', source: 'voice_bot', confidence: 0.6 });
  assert.equal(q.policy.insurer, 'TASCO');
  assert.equal(q.policy.expiryDate, '2027-01-10');
  assert.equal(q.policy.expiryCandidates[0].superseded, true);
  // Unverified profile: the bot claim still applies (conquest data captured).
  const { profiles: [u] } = buildProfiles(R.enrichment, [{ recordId: 'b', source: 'vetc_account', plateRaw: '30A66666', ownerType: 'individual', tagActivatedAt: '2024-11-01' }], TODAY);
  const { profile: v, conflict } = applyRenewedElsewhereClaim(u, { confidence: 0.6 });
  assert.equal(conflict, false);
  assert.equal(v.policy.insurer, 'OTHER');
  assert.equal(v.policy.expiryMethod, 'voice_bot');
});

test('seeded base: every profile backed by a TASCO core certificate is insured by TASCO', async () => {
  const all = await c.store.collection('profiles').find({ limit: 5000 });
  const tasco = all.filter((p) => (p.policy.expiryCandidates || []).some((x) => x.source === 'tasco_core'));
  assert.ok(tasco.length > 0);
  for (const p of tasco) assert.equal(p.policy.insurer, 'TASCO', p.id);
});

test('voice bot "already renewed" on a verified TASCO customer opens a DQ check instead of flipping to conquest', async () => {
  const p = await findProfile(c, (x) => x.ownerType === 'individual' && !x.consent.dnc && x.policy.verified && x.policy.insurer === 'TASCO');
  assert.ok(p, 'fixture: a verified TASCO customer exists');
  const actor = ACTOR('campaign-1', ['campaign_manager']);
  let s = await c.services.voice.start(p.id, actor);
  for (const text of [p.plate.replace('-', ' ').replace('.', ' '), 'tôi đã gia hạn rồi', 'mua bên Bảo Việt, hết hạn tháng 9 năm sau']) {
    if (s.state === 'ended') break;
    s = await c.services.voice.turn(s.id, text, actor);
  }
  assert.equal(s.outcome, 'already_renewed');
  await c.events.drain();
  const after = await c.store.collection('profiles').get(p.id);
  assert.equal(after.policy.insurer, 'TASCO');
  assert.equal(after.policy.expiryDate, p.policy.expiryDate);
  assert.ok(!(after.policy.expiryCandidates || []).some((x) => x.method === 'voice_bot'));
  assert.equal((await c.store.collection('leads').get(p.id)).journey, 'renewal');
  assert.equal((await c.store.collection('dq_issues').get(`${p.id}:unverified_renewal_claim`)).status, 'open');
});

// ---------- #19 data-quality KPI counts vehicles, not issues
test('overview reports vehicles with open data issues (distinct) alongside total issues', async () => {
  const ov = await c.services.insights.overview();
  assert.ok(ov.dataQuality.profilesWithOpenIssues > 0);
  assert.ok(ov.dataQuality.profilesWithOpenIssues <= ov.base.profiles, 'never more vehicles than in the golden record');
  assert.ok(ov.dataQuality.profilesWithOpenIssues <= ov.dataQuality.openIssues);
  const open = await c.store.collection('dq_issues').find({ where: { status: 'open' }, limit: 100000 });
  assert.equal(ov.dataQuality.profilesWithOpenIssues, new Set(open.map((i) => i.profileId).filter(Boolean)).size);
});

// ---------- #20, #21, #22 claims queue context, grouped statement, stable demo picker
test('claims queue rows carry plate, masked customer name and description', async () => {
  const p = await findProfile(c, (x) => x.ownerType === 'individual' && x.vehicle.category === 'car_under6' && x.policy.insurer !== 'TASCO' && x.name && !x.anonymised);
  const customer = { id: `customer:${p.id}`, roles: ['customer'], customerId: p.id };
  const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'vetc_app' }, customer);
  const { policies } = await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'review-fix-claim-1' }, customer);
  await c.events.drain();
  await c.services.claims.submit({ profileId: p.id, policyId: policies[0].certNo, incidentDate: policies[0].startDate, description: 'Va chạm nhẹ ở bãi đỗ xe' }, customer);
  const [row] = (await c.services.claims.list({ limit: 100 })).filter((x) => x.profileId === p.id);
  assert.equal(row.plate, p.plate);
  assert.equal(row.description, 'Va chạm nhẹ ở bãi đỗ xe');
  assert.ok(row.customerName && row.customerName !== p.name, 'name is masked for claims handlers');

  // Demo picker keeps a customer after they buy, with a status.
  const picks = await c.services.customers.demoCustomers();
  const mine = picks.find((x) => x.id === p.id);
  assert.ok(mine, 'buyer stays in the demo picker');
  assert.equal(mine.status, 'insured');
  if (p.name) assert.ok(mine.name && mine.name !== p.name, 'picker shows a masked name, never the full name');
  const again = await c.services.customers.demoCustomers();
  for (const x of picks) assert.ok(again.some((y) => y.id === x.id), 'picker is stable between calls');
});

test('partner statement groups commission lines by order with subtotals', async () => {
  const partner = { id: 'partner:P-BANK-01', partnerId: 'P-BANK-01', roles: ['partner_api'] };
  const p = await findProfile(c, (x) => x.ownerType === 'individual' && x.vehicle.category === 'car_under6' && x.policy.insurer !== 'TASCO' && !x.anonymised);
  const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }, { code: 'PA_SEAT', options: { sumInsuredPerSeat: 20000000, seats: 5 } }], channel: 'partner_api', partnerId: 'P-BANK-01' }, partner);
  await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'review-fix-partner-1' }, partner);
  const s = await c.services.partners.statement('P-BANK-01');
  assert.equal(s.byOrder.length, s.orders);
  const g = s.byOrder.find((x) => x.lines.length === 2);
  assert.ok(g, 'one order, two product lines');
  assert.equal(g.subtotal, g.lines.reduce((t, l) => t + l.amount, 0));
  assert.equal(s.byOrder.reduce((t, x) => t + x.subtotal, 0), s.totalCommission);
  assert.equal(s.lines.length, s.byOrder.reduce((t, x) => t + x.lines.length, 0), 'flat lines kept for API compatibility');
});

// ---------- #14 names instead of user ids
test('audit entries and rule sets resolve user ids to names', async () => {
  const author = await c.services.identity.byUsername('author');
  const principal = { id: author.id, username: author.username, roles: author.roles };
  const d = await c.services.rules.createDraft({ kind: 'service_levels', payload: (await c.services.rules.getRecord('service_levels')).payload, description: 'names test' }, principal);
  const listed = (await c.services.rules.list({ kind: 'service_levels' })).find((r) => r.id === d.id);
  assert.match(listed.createdByName, /author/);
  assert.match((await c.services.rules.byId(d.id)).createdByName, /author/);
  const entries = await c.services.audit.list({ entityId: d.id });
  assert.ok(entries.some((e) => e.actor === author.id && /author/.test(e.actorName)));
});
