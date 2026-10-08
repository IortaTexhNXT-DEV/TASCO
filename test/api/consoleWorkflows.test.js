'use strict';

/**
 * Additive API fields used by the staff console workflow screens (claims, data quality, partners,
 * users, operations). Every addition is backward compatible: old request bodies still work.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeContainer, startServer, findProfile } = require('../helpers');

let c;
let srv;
test.before(async () => { c = await makeContainer(); srv = await startServer(c); });
test.after(async () => { await srv.close(); });

async function newClaim() {
  const p = await findProfile(c, (x) => x.ownerType === 'individual' && x.policy.insurer !== 'TASCO' && !x.anonymised && x.vehicle.category === 'car_under6');
  const t = (await srv.call('POST', '/api/customer/session', { body: { link: c.links.sign(p.id) } })).body.token;
  const q = await srv.call('POST', '/api/customer/quotes', { token: t, body: { products: [{ code: 'TNDS_CAR', options: { termYears: 1 } }] } });
  const o = await srv.call('POST', '/api/customer/orders', { token: t, body: { quoteId: q.body.id }, headers: { 'Idempotency-Key': `wf-claim-${Date.now()}` } });
  assert.ok(o.body.policies, JSON.stringify(o.body).slice(0, 300) + JSON.stringify(q.body).slice(0, 300));
  const pol = o.body.policies[0];
  const cl = await srv.call('POST', '/api/customer/claims', { token: t, body: { policyId: pol.certNo, incidentDate: pol.startDate, description: 'Rear-ended at a toll plaza', location: 'Km 12' } });
  assert.equal(cl.status, 200, JSON.stringify(cl.body));
  return cl.body;
}

test('claims: decision data, notes, SLA and enriched detail', async () => {
  const claim = await newClaim();
  const ch = await srv.login('claims');
  const list = await srv.call('GET', '/api/claims?status=submitted', { token: ch });
  const row = list.body.find((x) => x.id === claim.id);
  assert.equal(row.sla.stage, 'acknowledgement');
  assert.ok(row.sla.dueAt);

  // Old body shape still works.
  assert.equal((await srv.call('PATCH', `/api/claims/${claim.id}`, { token: ch, body: { status: 'acknowledged' } })).body.status, 'acknowledged');
  const assigned = await srv.call('PATCH', `/api/claims/${claim.id}`, { token: ch, body: { status: 'assessor_assigned', assessor: 'Trần Văn Bình' } });
  assert.equal(assigned.body.assessor, 'Trần Văn Bình');
  await srv.call('PATCH', `/api/claims/${claim.id}`, { token: ch, body: { status: 'under_assessment' } });
  assert.equal((await srv.call('PATCH', `/api/claims/${claim.id}`, { token: ch, body: { status: 'approved', approvedAmount: 0 } })).status, 400);
  const approved = await srv.call('PATCH', `/api/claims/${claim.id}`, { token: ch, body: { status: 'approved', approvedAmount: 4500000, note: 'Rear bumper' } });
  assert.equal(approved.body.approvedAmount, 4500000);

  const note = await srv.call('POST', `/api/claims/${claim.id}/notes`, { token: ch, body: { text: 'Garage quote received' } });
  assert.equal(note.status, 200);
  assert.equal((await srv.call('POST', '/api/claims/CL-NOPE/notes', { token: ch, body: { text: 'x' } })).status, 404);

  const d = (await srv.call('GET', `/api/claims/${claim.id}`, { token: ch })).body;
  assert.equal(d.sla.stage, 'payment');
  assert.equal(d.history.at(-1).byName, 'Claims Handler');
  assert.equal(d.history[0].byName, null, 'customer steps carry no staff name');
  assert.equal(d.notes[0].byName, 'Claims Handler');
  assert.ok(d.policy.product);
  assert.ok(d.customer.plate);
  assert.ok(!/\s/.test(d.customer.name) || d.customer.name.includes('.'), 'customer name is masked');

  const paid = await srv.call('PATCH', `/api/claims/${claim.id}`, { token: ch, body: { status: 'paid', paymentRef: 'VW-889911' } });
  assert.equal(paid.body.paymentRef, 'VW-889911');
  assert.equal((await srv.call('GET', `/api/claims/${claim.id}`, { token: ch })).body.sla, null);
});

test('data quality: business origin instead of batch ids, detail, assignees, bulk and outcomes', async () => {
  const st = await srv.login('steward');
  const list = await srv.call('GET', '/api/dq/issues?status=open&limit=5', { token: st });
  const it = list.body.items[0];
  assert.ok(it.origin && it.origin.source, 'origin resolved from the batch record');
  assert.ok(it.origin.at);
  if (it.profileId) assert.ok(it.vehicle.plate);

  if (it.profileId) {
    const one = (await srv.call('GET', `/api/dq/issues?status=open&profileId=${encodeURIComponent(it.profileId)}`, { token: st })).body;
    assert.ok(one.total >= 1 && one.items.every((x) => x.profileId === it.profileId));
  }
  const d = await srv.call('GET', `/api/dq/issues/${encodeURIComponent(it.id)}`, { token: st });
  assert.equal(d.status, 200);
  assert.ok(Array.isArray(d.body.lineage));
  assert.equal((await srv.call('GET', '/api/dq/issues/nope', { token: st })).status, 404);

  const people = (await srv.call('GET', '/api/dq/assignees', { token: st })).body;
  const steward = people.find((u) => u.displayName === 'Data Steward');
  assert.ok(steward);
  const ids = list.body.items.slice(0, 2).map((x) => x.id);
  assert.equal((await srv.call('POST', '/api/dq/issues/bulk', { token: st, body: { ids, action: 'assign', assignee: steward.id } })).body.updated, 2);
  const after = (await srv.call('GET', `/api/dq/issues/${encodeURIComponent(ids[0])}`, { token: st })).body;
  assert.equal(after.assigneeName, 'Data Steward');
  const admin = await srv.login('admin');
  const adminId = (await srv.call('GET', '/api/auth/me', { token: admin })).body.id;
  assert.equal((await srv.call('POST', '/api/dq/issues/bulk', { token: st, body: { ids, action: 'assign', assignee: adminId } })).status, 400);
  assert.equal((await srv.call('POST', '/api/dq/issues/bulk', { token: st, body: { ids, action: 'dismiss' } })).status, 400);
  assert.equal((await srv.call('POST', '/api/dq/issues/bulk', { token: st, body: { ids: [ids[1]], action: 'dismiss', reason: 'Duplicate of a fleet record' } })).body.updated, 1);
  const dismissed = (await srv.call('GET', `/api/dq/issues/${encodeURIComponent(ids[1])}`, { token: st })).body;
  assert.equal(dismissed.status, 'resolved');
  assert.equal(dismissed.outcome, 'dismissed');

  const r = await srv.call('POST', `/api/dq/issues/${encodeURIComponent(ids[0])}/resolve`, { token: st, body: { resolution: 'Confirmed with the owner', outcome: 'confirmed', evidence: 'Phone call' } });
  assert.equal(r.body.outcome, 'confirmed');
  assert.equal((await srv.call('POST', `/api/dq/issues/${encodeURIComponent(ids[0])}/resolve`, { token: st, body: { resolution: 'x', outcome: 'bogus' } })).status, 400);
});

test('data quality: partner-sourced issues name the partner, voice issues name the call', async () => {
  const items = [
    { id: 'x:1', profileId: null, type: 'invalid_plate', status: 'open', batchId: 'B-test-1', source: 'partner_showroom' },
    { id: 'x:2', profileId: null, type: 'wrong_person', status: 'open', via: 'VS-1' },
  ];
  await c.store.collection('lineage').insert({ id: 'B-test-1', entityType: 'batch', entityId: 'B-test-1', source: 'P-SHOWROOM-01', records: 1, rejected: 1, at: '2026-10-07T01:00:00.000Z' });
  const [a, b] = await c.services.ops.describeIssues(items);
  assert.equal(a.origin.source, 'partner_api');
  assert.equal(a.origin.partnerName, 'Car Showroom Network');
  assert.equal(b.origin.source, 'voice_bot');
});

test('partners: month stats, scoped expiring keys, key listing without secrets', async () => {
  const pm = await srv.login('partners');
  const list = (await srv.call('GET', '/api/partners', { token: pm })).body;
  assert.ok(list[0].stats && typeof list[0].stats.policies === 'number' && typeof list[0].stats.commission === 'number');
  const st = (await srv.call('GET', '/api/partners/P-BANK-01/statement', { token: pm })).body;
  assert.ok(Array.isArray(st.byOrder) && Array.isArray(st.lines));
  for (const g of st.byOrder) assert.ok(Array.isArray(g.certificates) && 'vehicle' in g && 'premium' in g);
  const k = await srv.call('POST', '/api/partners/P-BANK-01/keys', { token: pm, body: { scopes: ['quote'], expiresInDays: 90 } });
  assert.deepEqual(k.body.scopes, ['quote']);
  assert.ok(k.body.expiresAt);
  assert.equal((await srv.call('POST', '/api/partners/P-BANK-01/keys', { token: pm, body: { scopes: ['admin'] } })).status, 400);
  const keys = (await srv.call('GET', '/api/partners/P-BANK-01/keys', { token: pm })).body;
  assert.ok(keys.some((x) => x.id === k.body.id));
  assert.ok(keys.every((x) => !x.keyHash && !x.apiKey));
  // An expired key no longer authenticates.
  const rec = await c.store.collection('api_keys').get(k.body.id);
  await c.store.collection('api_keys').update({ ...rec, expiresAt: '2020-01-01T00:00:00.000Z' });
  assert.equal(await c.services.partners.authenticateKey(k.body.apiKey), null);
  // Default issue (no body) keeps working with all scopes and no expiry.
  const d = await srv.call('POST', '/api/partners/P-BANK-01/keys', { token: pm });
  assert.equal(d.body.scopes.length, 3);
  assert.ok(await c.services.partners.authenticateKey(d.body.apiKey));
});

test('users: lock and MFA state, temporary password reset', async () => {
  const admin = await srv.login('admin');
  const pol = (await srv.call('GET', '/api/users/role-policy', { token: admin })).body;
  assert.ok(pol.roles.includes('claims_handler') && !pol.roles.includes('customer'));
  assert.ok(pol.separationOfDuties.some(([a, b]) => a === 'admin' && b === 'rule_author'));
  assert.ok(pol.mfaRequiredRoles.includes('admin'));
  assert.equal((await srv.call('GET', '/api/users/role-policy', { token: await srv.login('claims') })).status, 403);
  const users = (await srv.call('GET', '/api/users', { token: admin })).body;
  const exec = users.find((u) => u.username === 'exec');
  assert.equal(typeof exec.locked, 'boolean');
  assert.equal(typeof exec.mfaPending, 'boolean');
  const r = await srv.call('POST', `/api/users/${exec.id}/reset`, { token: admin, body: { resetPassword: true } });
  assert.match(r.body.temporaryPassword, /^Tmp-/);
  assert.equal(r.body.mustChangePassword, true);
  const login = await srv.call('POST', '/api/auth/login', { body: { username: 'exec', password: r.body.temporaryPassword } });
  assert.equal(login.status, 200);
  assert.equal(login.body.mustChangePassword, true);
  assert.equal((await srv.call('POST', '/api/users/nope/reset', { token: admin, body: { resetPassword: true } })).status, 404);
});

test('operations: integration health fields and job schedule', async () => {
  const sup = await srv.login('support');
  const s = (await srv.call('GET', '/api/ops/status', { token: sup })).body;
  assert.ok(s.checkedAt);
  assert.ok(s.integrations.every((i) => 'latencyMs' in i && 'lastCallAt' in i));
  const kinds = s.jobs.map((j) => j.kind);
  assert.deepEqual(kinds.sort(), ['catalogue-sync', 'reconciliation', 'relay', 'retention']);
  assert.ok(s.jobs.every((j) => new Date(j.nextRunAt) > new Date()));
  await srv.call('POST', '/api/ops/jobs/reconciliation', { token: sup });
  const s2 = (await srv.call('GET', '/api/ops/status', { token: sup })).body;
  assert.equal(s2.jobs.find((j) => j.kind === 'reconciliation').lastRun.status, 'succeeded');
  assert.ok(s2.rules.every((r) => 'activatedAt' in r));
  const runs = (await srv.call('GET', '/api/ops/jobs', { token: sup })).body;
  assert.equal(runs[0].actorName, 'Production Support');
});

test('UX review: customer app reads support contacts and vehicle details it pre-fills; copy says "voice assistant" and dates are dd/MM/yyyy', async () => {
  const meta = (await srv.call('GET', '/api/meta')).body;
  assert.equal(meta.supportHotline, '1900 1562');
  assert.equal(meta.supportEmail, 'info@baohiemtasco.vn');
  assert.match(meta.supportWebsite, /^https:\/\//);

  // The "Thông tin xe" card is pre-filled from home.vehicle and reflects a confirmation immediately.
  const p = await findProfile(c, (x) => x.ownerType === 'individual' && !x.anonymised && x.vehicle.category === 'car_under6');
  const t = (await srv.call('POST', '/api/customer/session', { body: { link: c.links.sign(p.id) } })).body.token;
  const home = (await srv.call('GET', '/api/customer/home', { token: t })).body;
  assert.ok('seats' in home.vehicle && 'usage' in home.vehicle);
  await srv.call('POST', '/api/customer/vehicle', { token: t, body: { usage: 'personal', seats: 7 } });
  const after = (await srv.call('GET', '/api/customer/home', { token: t })).body;
  assert.equal(after.vehicle.seats, 7);
  assert.equal(after.vehicle.usage, 'personal');

  // Business wording: the NBA label and the voice script English gloss.
  const nba = await c.services.rules.get('nba');
  assert.ok(!JSON.stringify(nba).includes('voice bot'), 'NBA labels say "voice assistant", never "bot"');
  const script = await c.services.rules.get('content.voicebot');
  assert.match(script.lines.expiryKnown.en, /\{\{expiryVi\}\}/, 'English gloss shows the expiry as dd/MM/yyyy');
});
