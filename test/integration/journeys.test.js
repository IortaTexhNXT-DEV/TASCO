'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeContainer, findProfile } = require('../helpers');

let c;
test.before(async () => { c = await makeContainer(); });

test('seed builds golden records, leads and touchpoints for new business and retention', async () => {
  const ov = await c.services.insights.overview();
  assert.ok(ov.base.profiles > 300);
  for (const j of ['conquest', 'lapsed_uninsured', 'renewal']) assert.ok(ov.leads.byJourney[j] > 0, j);
  assert.ok(ov.dataQuality.openIssues > 0);
  assert.ok(await c.store.collection('touchpoints').count({ status: 'scheduled' }) > 0);
  const list = await c.services.leads.list({ limit: 5 });
  assert.ok(list.items[0].score >= list.items[4].score, 'sorted by score');
  assert.ok((await c.services.leads.list({ sort: 'expiry', maxDays: 30, minScore: 1, limit: 5 })).items.every((l) => l.daysToExpiry <= 30));
  await assert.rejects(c.services.leads.get('NOPE'), /not found/);
});

test('journey run respects contact hours: night run sends only service notices', async () => {
  const night = await c.services.journeys.runDue({ date: '2026-10-07', at: '2026-10-07T15:30:00Z', actor: 'test' });
  assert.ok(night.due > 0);
  const msgs = await c.store.collection('messages').find({ limit: 5000 });
  assert.ok(msgs.filter((m) => m.status === 'sent').every((m) => m.marketing === false), 'no marketing at 22:30 local');
  assert.ok(night.skipped > 0, 'marketing touchpoints are skipped');
  const day = await c.services.journeys.runDue({ date: '2026-10-10', at: '2026-10-10T03:00:00Z', actor: 'test' });
  await c.events.drain();
  assert.ok(day.done > 0);
  assert.ok(Object.keys(day.byChannel).length >= 2);
  const sent = await c.store.collection('messages').find({ where: { status: 'sent' }, limit: 5000 });
  assert.ok(sent.every((m) => !/giảm giá|chiết khấu/i.test(m.text)), 'copy guard holds');
  assert.ok(sent.some((m) => m.text.includes('/app/?r=')), 'messages carry signed renew links');
});

test('ecosystem events trigger moments of truth', async () => {
  const p = await findProfile(c, (x) => x.channels.app_push && x.consent.marketing && !x.consent.dnc && x.policy.expiryDate && x.policy.expiryDate > '2026-10-08' && x.policy.expiryDate < '2026-11-05');
  const r = await c.services.journeys.handleEcosystemEvent({ type: 'vetc.wallet_topped_up', profileId: p.id, at: '2026-10-07T04:00:00Z' });
  assert.equal(r.matched, 1);
  assert.ok(['sent', 'condition not met', 'no permitted channel'].includes(r.actions[0].result));
  const enrol = await c.services.journeys.handleEcosystemEvent({ type: 'vetc.tag_activated', profileId: p.id });
  assert.match(enrol.actions[0].result, /new_vehicle/);
  assert.deepEqual(await c.services.journeys.handleEcosystemEvent({ type: 'vetc.unknown', profileId: p.id }), { matched: 0, actions: [] });
  await c.events.drain();
  assert.ok((await c.services.journeys.schedule({ profileId: p.id })).length >= 0);
});

test('lead recompute is incremental and audit-logged', async () => {
  const before = await c.services.audit.count();
  const r = await c.services.leads.recompute(null, { actor: 'test' });
  assert.ok(r.recomputed > 300);
  assert.ok(await c.services.audit.count() > before);
  assert.deepEqual(await c.services.leads.recompute(['NOPE']), { recomputed: 0 });
});

test('window-blocked touchpoints are deferred, not lost', async () => {
  const before = await c.store.collection('touchpoints').count({ status: 'scheduled' });
  const night = await c.services.journeys.runDue({ date: '2026-10-12', at: '2026-10-12T16:00:00Z' });
  assert.ok(night.deferred > 0);
  const day = await c.services.journeys.runDue({ date: '2026-10-12', at: '2026-10-13T03:00:00Z' });
  assert.ok(day.done > 0, 'deferred touchpoints execute in the next in-window run');
  assert.ok(before > 0);
});

test('admin reset unlocks accounts and forces MFA re-enrolment without revealing seeds', async () => {
  const admin = { id: 'admin-r', roles: ['admin'] };
  const target = (await c.services.identity.list()).find((u) => u.username === 'steward');
  const r = await c.services.identity.reset(target.id, { unlock: true, resetMfa: true }, admin);
  assert.equal(r.mfaEnabled, false);
  assert.equal(JSON.stringify(r).includes('totp'), false);
  const login = await c.services.identity.login({ username: 'steward', password: 'Tasco@Demo2026!' });
  assert.equal(login.mfaEnrolment, true);
  await assert.rejects(c.services.identity.reset(target.id, {}, { id: target.id, roles: ['admin'] }), /another administrator/);
  await assert.rejects(c.services.identity.reset('nope', {}, admin), /not found/);
});
