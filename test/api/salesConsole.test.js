'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeContainer, startServer } = require('../helpers');

/** Read-model additions used by the redesigned sales & service console screens (all backward compatible). */

let c;
let srv;
test.before(async () => { c = await makeContainer(); srv = await startServer(c); });
test.after(async () => { await srv.close(); });

test('lead queue: plate search and owner / vehicle / expiry display fields (masked per permission)', async () => {
  const sup = await srv.login('supervisor');
  const all = await srv.call('GET', '/api/leads?limit=5', { token: sup });
  assert.equal(all.status, 200);
  const first = all.body.items[0];
  assert.ok(all.body.facets.regions.includes(first.region));
  assert.ok('owner' in first && 'category' in first && 'expiryDate' in first && 'ownerType' in first);
  const prefix = first.id.slice(0, 5);
  const found = await srv.call('GET', `/api/leads?q=${encodeURIComponent(prefix)}&limit=50`, { token: sup });
  assert.ok(found.body.items.length >= 1);
  assert.ok(found.body.items.every((l) => l.id.startsWith(prefix)));
  assert.ok(found.body.total >= found.body.items.length);
  // Campaign managers have no PII permission: owner names come back masked.
  const camp = await srv.login('campaign');
  const masked = await srv.call('GET', `/api/leads?q=${first.id}`, { token: camp });
  const p = await c.store.collection('profiles').get(first.id);
  if (p.name) assert.notEqual(masked.body.items[0].owner, p.name);
});

test('dashboard overview: forward pipeline, DQ by status and due touchpoints', async () => {
  const exec = await srv.login('exec');
  const ov = (await srv.call('GET', '/api/dashboard/overview', { token: exec })).body;
  assert.equal(ov.pipeline.length, 12);
  assert.match(ov.pipeline[0].month, /^2026-10$/);
  assert.ok(ov.pipeline.some((m) => m.retention + m.newBusiness > 0));
  assert.equal(typeof ov.dataQuality.byStatus, 'object');
  assert.equal(typeof ov.journeys.scheduled, 'number');
  assert.equal(typeof ov.journeys.dueToday, 'object');
});

test('voice campaign: dry-run preview, recorded run, campaign list and call list', async () => {
  const camp = await srv.login('campaign');
  const preview = await srv.call('POST', '/api/voice/campaign', { token: camp, body: { tier: 'hot', limit: 5, dryRun: true, at: '2026-10-07T03:00:00Z' } });
  assert.equal(preview.status, 200);
  assert.ok(preview.body.audience >= preview.body.eligible);
  assert.ok(preview.body.willCall <= 5);
  assert.equal((await srv.call('GET', '/api/voice/sessions', { token: camp })).body.items.length, 0, 'a preview calls nobody');

  const run = await srv.call('POST', '/api/voice/campaign', { token: camp, body: { tier: 'hot', limit: 3, name: 'Hot renewals', at: '2026-10-07T03:00:00Z' } });
  assert.equal(run.status, 200);
  assert.ok(run.body.campaignId);
  const list = await srv.call('GET', '/api/campaigns', { token: camp });
  const rec = list.body.items.find((x) => x.id === run.body.campaignId);
  assert.equal(rec.kind, 'voice_campaign');
  assert.equal(rec.result.name, 'Hot renewals');
  assert.equal(rec.result.called, run.body.called);
  assert.equal(rec.by, 'Campaign Manager');

  await srv.call('POST', '/api/journeys/run', { token: camp, body: { date: '2026-10-07', at: '2026-10-07T03:00:00Z' } });
  assert.ok((await srv.call('GET', '/api/campaigns', { token: camp })).body.items.some((x) => x.kind === 'journey_run'));

  const calls = await srv.call('GET', '/api/voice/sessions?limit=10', { token: camp });
  assert.equal(calls.status, 200);
  assert.equal(calls.body.items.length, run.body.called + calls.body.items.filter((x) => x.mode !== 'campaign').length);
  const call = calls.body.items[0];
  assert.ok(call && call.customerId && 'verified' in call && 'outcome' in call);
  assert.equal(call.transcript, undefined, 'list never carries transcripts');
  const agent = await srv.login('agent.hn');
  assert.equal((await srv.call('GET', '/api/campaigns', { token: agent })).status, 403);
  const own = await srv.call('GET', '/api/voice/sessions', { token: agent });
  assert.ok(own.body.items.every((x) => x.region === 'Hà Nội'));
});

test('handoffs: assignee names, SLA due time and assignee list for supervisors', async () => {
  const lead = (await c.store.collection('leads').find({ where: { tier: 'hot' }, limit: 1 }))[0];
  await c.services.voice.createDirectHandoff(await c.store.collection('profiles').get(lead.id), lead, 'journey_escalation');
  const sup = await srv.login('supervisor');
  const open = await srv.call('GET', '/api/handoffs?status=open&limit=5', { token: sup });
  assert.ok(open.body.items.length, 'campaign produced hot handoffs');
  const h = open.body.items[0];
  assert.ok(h.slaDueAt);
  assert.equal(new Date(h.slaDueAt).getTime() - new Date(h.createdAt).getTime(), 2 * 3600000);
  const claimed = await srv.call('PATCH', `/api/handoffs/${h.id}`, { token: sup, body: { status: 'claimed', note: 'Calling now' } });
  assert.equal(claimed.body.assignedToName, 'Telesales Supervisor');
  assert.equal(claimed.body.notes[0].byName, 'Telesales Supervisor');
  const people = await srv.call('GET', '/api/handoffs/assignees', { token: sup });
  assert.ok(people.body.items.some((u) => u.name.startsWith('Telesales Agent')));
  const agent = await srv.login('agent.hn');
  assert.equal((await srv.call('GET', '/api/handoffs/assignees', { token: agent })).status, 403);
});
