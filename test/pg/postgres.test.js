'use strict';

/**
 * Postgres adapter integration tests (run with `npm run test:pg`; CI provides a
 * Postgres service). Exercises migrations, parameterised queries, optimistic
 * locking, encryption at rest, SKIP LOCKED outbox claims, the hash-chained audit
 * trail with DB-level immutability, and a full business flow on Postgres.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeContainer, findProfile } = require('../helpers');

const url = process.env.TEST_DATABASE_URL;
const skip = !url && 'TEST_DATABASE_URL not set';

let c;
test.before(async () => {
  if (skip) return;
  c = await makeContainer({ env: { DATABASE_URL: url, DATABASE_SSL: 'false', SEED_RECORDS: '300' }, seed: false });
  await c.store.migrate();
  await c.store.reset();
  await require('../../src/bootstrap/seed').seedDemo(c);
});
test.after(async () => { if (c) await c.store.close(); });

test('migrations are idempotent and tables exist', { skip }, async () => {
  assert.deepEqual(await c.store.migrate(), [], 'second run applies nothing');
  const r = await c.store._pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('profiles','leads','audit_log','rulesets')");
  assert.equal(r.rows[0].n, 4);
});

test('seeded platform works on Postgres: profiles, leads, rules, filtering', { skip }, async () => {
  const ov = await c.services.insights.overview();
  assert.ok(ov.base.profiles > 200);
  const hot = await c.services.leads.list({ tier: 'warm', limit: 5 });
  assert.ok(hot.items.every((l) => l.tier === 'warm'));
  const byRegion = await c.store.collection('leads').countBy('region');
  assert.ok(Object.keys(byRegion).length > 3);
  assert.equal((await c.services.rules.snapshot()).length >= 15, true);
});

test('PII is encrypted at rest in Postgres and blind index works', { skip }, async () => {
  const p = await findProfile(c, (x) => x.phone && x.name);
  const raw = await c.store._pool.query('SELECT data::text AS d, phone_bidx FROM profiles WHERE id = $1', [p.id]);
  assert.ok(!raw.rows[0].d.includes(p.phone));
  assert.ok(raw.rows[0].d.includes('enc:v1:'));
  const found = await c.store.collection('profiles').find({ where: { phone_bidx: c.store.collection && raw.rows[0].phone_bidx } });
  assert.equal(found[0].id, p.id);
});

test('optimistic locking and parameterised filters resist injection', { skip }, async () => {
  const col = c.store.collection('partners');
  const p = await col.get('P-BANK-01');
  await col.update({ ...p, name: 'v2' });
  await assert.rejects(col.update({ ...p, name: 'stale' }), /modified by someone else/);
  const evil = await col.find({ where: { type: "bank' OR '1'='1" } });
  assert.equal(evil.length, 0, 'value is bound, not concatenated');
  await assert.rejects(col.find({ where: { 'type; DROP TABLE partners': 'x' } }), /not filterable/);
  assert.ok(await col.count() >= 5);
});

test('audit trail: chain verifies and the database blocks UPDATE, DELETE and TRUNCATE', { skip }, async () => {
  assert.equal((await c.services.audit.verify()).ok, true);
  await assert.rejects(c.store._pool.query("UPDATE audit_log SET actor = 'x'"), /append-only/);
  await assert.rejects(c.store._pool.query('DELETE FROM audit_log'), /append-only/);
  await assert.rejects(c.store._pool.query('TRUNCATE audit_log'), /cannot be truncated/);
});

test('one active rule version per kind is enforced by the database', { skip }, async () => {
  const r = await c.store._pool.query("SELECT data FROM rulesets WHERE kind = 'costs' AND status = 'active'");
  const dup = { ...r.rows[0].data, id: 'costs@99', version_no: 99 };
  await assert.rejects(c.store._pool.query("INSERT INTO rulesets (id, data, kind, status, version_no) VALUES ('costs@99', $1, 'costs', 'active', 99)", [JSON.stringify(dup)]), /ux_rulesets_one_active_per_kind/);
});

test('outbox claims are exclusive across concurrent relays (SKIP LOCKED)', { skip }, async () => {
  for (let i = 0; i < 20; i++) await c.events.publish('test.event', { i });
  const [a, b] = await Promise.all([c.store.claimEvents(15), c.store.claimEvents(15)]);
  const ids = [...a, ...b].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'no event handed to two relays');
  assert.equal(ids.length, 20);
});

test('end-to-end sale on Postgres with transactional rule approval', { skip }, async () => {
  const p = await findProfile(c, (x) => x.ownerType === 'individual' && x.policy.insurer !== 'TASCO' && x.vehicle.category === 'car_under6');
  const me = { id: `customer:${p.id}`, roles: ['customer'], customerId: p.id };
  const q = await c.services.sales.quote({ profileId: p.id, products: [{ code: 'TNDS_CAR' }], channel: 'vetc_app' }, me);
  const r = await c.services.sales.purchase({ quoteId: q.id, idempotencyKey: 'pg-e2e-0001' }, me);
  assert.equal(r.order.status, 'completed');
  await c.events.drain();
  assert.equal((await c.services.sales.verifyCertificate(r.policies[0].certNo)).issued, true);
  const costs = await c.services.rules.get('costs');
  const d = await c.services.rules.createDraft({ kind: 'costs', payload: { ...costs, sms: 650 } }, { id: 'a1', roles: ['rule_author'] });
  await c.services.rules.submit(d.id, { id: 'a1', roles: ['rule_author'] });
  await c.services.rules.approve(d.id, { id: 'a2', roles: ['rule_approver'] });
  assert.equal((await c.services.rules.get('costs')).sms, 650);
  assert.equal(await c.store.collection('rulesets').count({ kind: 'costs', status: 'active' }), 1);
});
