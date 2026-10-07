'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFieldCipher } = require('../../src/shared/crypto');
const { createCodec } = require('../../src/adapters/persistence/codec');
const { createMemoryStore } = require('../../src/adapters/persistence/memoryStore');
const { buildWhere } = require('../../src/adapters/persistence/postgresStore');
const { verifyChain, canonical } = require('../../src/adapters/persistence/auditChain');
const { KEY } = require('../helpers');

function store() {
  const cipher = createFieldCipher({ keys: { k1: Buffer.from(KEY('x'), 'base64') }, activeKeyId: 'k1' });
  return createMemoryStore({ codec: createCodec({ cipher, blindKey: Buffer.from(KEY('b'), 'base64') }) });
}

test('memory store: CRUD, optimistic locking, filters, sorting, paging', async () => {
  const s = store();
  const col = s.collection('profiles');
  await col.insert({ id: 'A', province: 'Hà Nội', phone: '0911111111', name: 'An', policy: { insurer: 'TASCO', expiryDate: '2026-10-10' }, dataQuality: { score: 80 }, ownerType: 'individual' });
  await col.insert({ id: 'B', province: 'Đà Nẵng', phone: '0922222222', policy: { insurer: 'PVI', expiryDate: '2026-12-01' }, dataQuality: { score: 40 }, ownerType: 'company' });
  await col.insert({ id: 'C', province: 'Hà Nội', policy: { insurer: null, expiryDate: null }, dataQuality: { score: 10 } });
  await assert.rejects(col.insert({ id: 'A' }), /already exists/);
  await assert.rejects(col.insert({}), /id required/);
  const a = await col.get('A');
  assert.equal(a.version, 1);
  assert.equal(a.phone, '0911111111');
  const raw = await col.raw('A');
  assert.ok(raw.data.phone.startsWith('enc:v1:'), 'PII encrypted at rest');
  assert.ok(raw.phone_bidx && raw.phone_bidx.length === 64, 'blind index stored');
  assert.equal((await col.find({ where: { phone_bidx: s.collection('profiles') && raw.phone_bidx } }))[0].id, 'A');
  const a2 = await col.update({ ...a, name: 'Anh' });
  assert.equal(a2.version, 2);
  await assert.rejects(col.update({ ...a, name: 'stale' }), /modified by someone else/);
  await assert.rejects(col.update({ id: 'Z' }), /not found/);
  assert.equal((await col.find({ where: { region: 'Hà Nội' } })).length, 2);
  assert.equal((await col.find({ where: { dq_score: { gte: 40 } }, orderBy: ['dq_score', 'desc'] }))[0].id, 'A');
  assert.equal((await col.find({ where: { insurer: { in: ['PVI', 'X'] } } }))[0].id, 'B');
  assert.equal((await col.find({ where: { insurer: { isNull: true } } }))[0].id, 'C');
  assert.equal((await col.find({ where: { insurer: { isNull: false } } })).length, 2);
  assert.equal((await col.find({ where: { insurer: { ne: 'TASCO' } } })).length, 2);
  assert.equal((await col.find({ where: { dq_score: { gt: 10, lt: 80 } } }))[0].id, 'B');
  assert.equal((await col.find({ where: { dq_score: { lte: 10 } } }))[0].id, 'C');
  assert.equal((await col.find({ orderBy: ['expiry_date', 'asc'] })).at(-1).id, 'C', 'nulls last');
  assert.equal((await col.find({ orderBy: ['expiry_date', 'desc'] }))[0].id, 'B');
  assert.equal((await col.find({ limit: 1, offset: 1, orderBy: ['id', 'asc'] }))[0].id, 'B');
  assert.equal(await col.count({ region: 'Hà Nội' }), 2);
  assert.deepEqual(await col.countBy('owner_type'), { individual: 1, company: 1, null: 1 });
  await assert.rejects(col.find({ where: { 'data; DROP TABLE x': 1 } }), /not filterable/);
  await assert.rejects(col.find({ where: { region: { regex: '.*' } } }), /not allowed/);
  await assert.rejects(col.find({ orderBy: ['nope', 'asc'] }), /not sortable/);
  await assert.rejects(col.find({ orderBy: ['id', 'sideways'] }), /sort direction/);
  assert.equal((await col.upsert({ id: 'A', province: 'X' })).version, 3);
  assert.equal(await col.bulkUpsert([{ id: 'D' }, { id: 'E' }]), 2);
  assert.equal(await col.deleteWhere({ region: 'X' }), 1);
  assert.equal(await col.delete('B'), true);
  assert.throws(() => s.collection('nope'), /unknown collection/);
  assert.equal(await s.ping(), true);
  await s.transaction(async (tx) => assert.equal(tx, s));
});

test('outbox claim and audit hash chain (tamper evident)', async () => {
  const s = store();
  await s.collection('domain_events').insert({ id: 'e1', type: 't', status: 'pending', occurredAt: '2026-01-01T00:00:00Z' });
  await s.collection('domain_events').insert({ id: 'e2', type: 't', status: 'done', occurredAt: '2026-01-01T00:00:00Z' });
  const claimed = await s.claimEvents(10);
  assert.deepEqual(claimed.map((e) => e.id), ['e1']);
  assert.equal((await s.claimEvents(10)).length, 0, 'claimed events are not handed out twice');
  await s.audit.append({ actor: 'a', action: 'x', details: { b: 1, a: 2 } });
  await s.audit.append({ actor: 'b', action: 'y', entityId: 'E' });
  assert.equal((await s.audit.verify()).ok, true);
  assert.equal((await s.audit.list({ entityId: 'E' })).length, 1);
  assert.equal(await s.audit.count(), 2);
  s.audit._entries[0].details.b = 999;
  const v = await s.audit.verify();
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 0);
  s.audit._entries[0].details.b = 1;
  s.audit._entries[1].prevHash = 'f'.repeat(64);
  assert.equal(verifyChain(s.audit._entries).reason, 'prev hash mismatch');
  assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 0 }] }), '{"a":[2,{"c":0,"d":1}],"b":1}');
  await s.reset();
  assert.equal(await s.audit.count(), 0);
});

test('postgres where-builder produces bind parameters only', () => {
  const w = buildWhere({ a: 1, b: { in: ['x'] }, c: { gte: 2, lt: 5 }, d: null, e: { isNull: false }, f: { ne: 'z' }, g: { isNull: true } });
  assert.equal(w.sql, 'WHERE a = $1 AND b = ANY($2) AND c >= $3 AND c < $4 AND d IS NULL AND e IS NOT NULL AND f IS DISTINCT FROM $5 AND g IS NULL');
  assert.deepEqual(w.params, [1, ['x'], 2, 5, 'z']);
  assert.equal(buildWhere({}).sql, '');
});
