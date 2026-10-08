'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeContainer, startServer, ACTOR } = require('../helpers');
const { auditCategory } = require('../../src/application/auditService');

let c;
let srv;
test.before(async () => { c = await makeContainer(); srv = await startServer(c); });
test.after(async () => { await srv.close(); });

test('rules: draft edit in place, submit comment, withdraw and display names', async () => {
  const author = ACTOR('author-x', ['rule_author']);
  const other = ACTOR('author-y', ['rule_author']);
  const approver = ACTOR('approver-x', ['rule_approver']);
  const base = await c.services.rules.get('service_levels');
  const draft = await c.services.rules.createDraft({ kind: 'service_levels', payload: { ...base, quoteTtlHours: 36 }, description: 'longer quotes' }, author);
  const edited = await c.services.rules.updateDraft(draft.id, { payload: { ...base, quoteTtlHours: 48 }, description: 'two-day quotes' }, author);
  assert.equal(edited.id, draft.id, 'same version');
  assert.equal(edited.payload.quoteTtlHours, 48);
  assert.equal(edited.description, 'two-day quotes');
  await assert.rejects(c.services.rules.updateDraft(draft.id, { description: 'x' }, other), /Only the author/);
  await assert.rejects(c.services.rules.updateDraft(draft.id, { payload: { ...base, when: { nope: [1] } } }, author), /invalid/);
  await c.services.rules.submit(draft.id, author, { comment: 'Customers asked for more time' });
  const pending = await c.services.rules.byId(draft.id);
  assert.equal(pending.submitComment, 'Customers asked for more time');
  await assert.rejects(c.services.rules.updateDraft(draft.id, { description: 'x' }, author), /Only drafts/);
  await assert.rejects(c.services.rules.withdraw(draft.id, other), /Only the author/);
  const back = await c.services.rules.withdraw(draft.id, author);
  assert.equal(back.status, 'draft');
  await assert.rejects(c.services.rules.withdraw(draft.id, author), /Only pending/);
  await c.services.rules.submit(draft.id, author);
  await c.services.rules.reject(draft.id, approver, { comment: 'Needs legal sign-off' });
  const rejected = await c.services.rules.byId(draft.id);
  assert.ok(rejected.rejectedAt);
  assert.equal(rejected.rejectionComment, 'Needs legal sign-off');
  const actions = (await c.services.audit.list({ entityId: draft.id, limit: 20 })).map((a) => a.action);
  for (const a of ['rules.draft_created', 'rules.draft_updated', 'rules.submitted', 'rules.withdrawn', 'rules.rejected']) assert.ok(actions.includes(a), a);
  const submitted = (await c.services.audit.list({ entityId: draft.id, action: 'rules.submitted', limit: 5 })).find((e) => e.details?.comment);
  assert.equal(submitted.details.comment, 'Customers asked for more time');
});

test('audit: business categories, date range, actor directory and object labels', async () => {
  assert.equal(auditCategory('auth.login'), 'access');
  assert.equal(auditCategory('profile.expiry_corrected'), 'customer');
  assert.equal(auditCategory('rules.approved'), 'rules');
  assert.equal(auditCategory('claim.status_changed'), 'claims');
  assert.equal(auditCategory('job.retention'), 'admin');
  assert.equal(auditCategory('something.else'), 'other');
  const auditor = await srv.login('auditor');
  const author = await srv.login('author');
  const rules = await srv.call('GET', '/api/audit?category=rules&limit=50', { token: auditor });
  assert.equal(rules.status, 200);
  assert.ok(rules.body.length > 0);
  assert.ok(rules.body.every((e) => e.category === 'rules' && e.action.startsWith('rules.')));
  const access = await srv.call('GET', '/api/audit?category=access&limit=50', { token: auditor });
  const login = access.body.find((e) => e.action === 'auth.login' && e.actorDisplayName === 'Hoàng Mai Anh');
  assert.ok(login, 'login of the author resolved to a display name');
  assert.deepEqual(login.actorRoles, ['rule_author']);
  assert.match(login.actorName, /\(author\)$/, 'legacy actorName format kept');
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const inRange = await srv.call('GET', `/api/audit?from=${today}&to=${today}&limit=500`, { token: auditor });
  assert.ok(inRange.body.length > 0);
  assert.equal((await srv.call('GET', '/api/audit?from=2001-01-01&to=2001-01-02', { token: auditor })).body.length, 0);
  assert.equal((await srv.call('GET', '/api/audit?category=nope', { token: auditor })).status, 400);
  assert.equal((await srv.call('GET', '/api/audit?from=yesterday', { token: auditor })).status, 400);
  const actors = await srv.call('GET', '/api/audit/actors', { token: auditor });
  assert.ok(actors.body.some((a) => a.displayName === 'Trịnh Hải Yến' && a.roles.includes('auditor')));
  assert.ok(actors.body.every((a) => !('passwordHash' in a) && !('totpSecret' in a)));
  assert.equal((await srv.call('GET', '/api/audit/actors', { token: author })).status, 403);
  // Customer objects: plate always, name masked for readers without the personal-data permission.
  const [profile] = await c.store.collection('profiles').find({ limit: 1 });
  await c.services.audit.record({ actor: 'U-test', action: 'profile.expiry_corrected', entityType: 'profile', entityId: profile.id, details: { evidence: 'certificate photo' } });
  const entries = await srv.call('GET', `/api/audit?entityId=${profile.id}&limit=5`, { token: auditor });
  const e = entries.body.find((x) => x.action === 'profile.expiry_corrected');
  assert.equal(e.entityPlate, profile.plate);
  if (profile.name && profile.name.includes(' ')) assert.notEqual(e.entityLabel, profile.name, 'auditor sees a masked name');
});

test('rules studio API: context, sample customers, aggregate simulation, draft PATCH and withdraw', async () => {
  const author = await srv.login('author');
  const ctx = await srv.call('GET', '/api/rules/context', { token: author });
  assert.equal(ctx.status, 200);
  assert.ok(['rules', 'core', 'core_with_fallback'].includes(ctx.body.ratingSource));
  assert.deepEqual(ctx.body.restrictedKinds.copy_guard, ['compliance_officer']);
  const sample = await srv.call('GET', '/api/rules/sample-customers?limit=6', { token: author });
  assert.equal(sample.status, 200);
  assert.ok(sample.body.items.length > 0);
  for (const it of sample.body.items) {
    assert.ok(it.id && it.plate);
    assert.equal(it.name, undefined, 'no personal data');
    assert.equal(it.phone, undefined, 'no personal data');
  }
  const prefix = sample.body.items[0].id.slice(0, 4);
  const found = await srv.call('GET', `/api/rules/sample-customers?q=${prefix}`, { token: author });
  assert.ok(found.body.items.every((x) => x.id.startsWith(prefix)));
  assert.equal((await srv.call('GET', '/api/rules/sample-customers?q=3', { token: author })).body.items.length, 0);

  const active = (await srv.call('GET', '/api/rules?kind=scoring&status=active', { token: author })).body[0];
  const payload = (await srv.call('GET', `/api/rules/${encodeURIComponent(active.id)}`, { token: author })).body.payload;
  const same = await srv.call('POST', '/api/rules/simulate-sample', { token: author, body: { kind: 'scoring', payload, size: 30 } });
  assert.equal(same.status, 200);
  assert.ok(same.body.sampleSize > 0);
  assert.equal(same.body.changedCustomers, 0, 'identical rules change nothing');
  const lower = structuredClone(payload);
  lower.tiers.hot = 20; lower.tiers.warm = 10;
  const sim = await srv.call('POST', '/api/rules/simulate-sample', { token: author, body: { kind: 'scoring', payload: lower, size: 30 } });
  assert.ok(sim.body.tiers.after.hot >= sim.body.tiers.before.hot);
  assert.ok(sim.body.tierMoves.every((m) => m.to === 'hot' || m.to === 'warm'));
  assert.equal((await srv.call('POST', '/api/rules/simulate-sample', { token: author, body: { kind: 'products', payload } })).status, 400);
  assert.equal((await srv.call('POST', '/api/rules/simulate-sample', { token: author, body: { kind: 'scoring', payload: { tiers: { hot: 1, warm: 2 } } } })).status, 400);

  const draft = (await srv.call('POST', '/api/rules', { token: author, body: { kind: 'scoring', payload, description: 'tuning' } })).body;
  const patched = await srv.call('PATCH', `/api/rules/${encodeURIComponent(draft.id)}`, { token: author, body: { payload: lower, description: 'lower thresholds' } });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.payload.tiers.hot, 20);
  assert.equal((await srv.call('POST', `/api/rules/${encodeURIComponent(draft.id)}/submit`, { token: author, body: { comment: 'see simulation' } })).status, 200);
  const approver = await srv.login('auditor');
  assert.equal((await srv.call('POST', `/api/rules/${encodeURIComponent(draft.id)}/withdraw`, { token: approver, body: {} })).status, 403);
  const w = await srv.call('POST', `/api/rules/${encodeURIComponent(draft.id)}/withdraw`, { token: author, body: {} });
  assert.equal(w.body.status, 'draft');
  const listed = (await srv.call('GET', '/api/rules?kind=scoring', { token: author })).body.find((r) => r.id === draft.id);
  assert.equal(listed.createdByDisplayName, 'Hoàng Mai Anh');
});
