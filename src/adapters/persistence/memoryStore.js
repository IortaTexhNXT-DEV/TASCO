'use strict';

const crypto = require('crypto');
const { assertColumns, matches } = require('./query');
const { GENESIS, entryHash, verifyChain } = require('./auditChain');
const { errors } = require('../../shared/errors');

/**
 * In-memory store adapter (development, tests, demos). Implements exactly the
 * same port as postgresStore, including encryption via the codec, optimistic
 * locking and the audit hash chain, so behaviour is identical.
 */

function createMemoryStore({ codec }) {
  const tables = new Map();
  const audit = [];
  const table = (name) => {
    codec.def(name);
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };

  function collection(name) {
    const def = codec.def(name);
    const t = table(name);
    const toRow = (doc, version, createdAt) => {
      const { data, columns } = codec.encode(name, doc);
      const now = new Date().toISOString();
      return { id: doc.id, version, data, ...columns, created_at: createdAt || now, updated_at: now };
    };
    const fromRow = (row) => (row ? { ...codec.decode(name, row.data), version: row.version } : null);

    return {
      async get(id) { return fromRow(t.get(id)); },
      async insert(doc) {
        if (!doc.id) throw new Error('id required');
        if (t.has(doc.id)) throw errors.conflict(`${name} ${doc.id} already exists`);
        t.set(doc.id, toRow(doc, 1));
        return { ...doc, version: 1 };
      },
      async update(doc) {
        const cur = t.get(doc.id);
        if (!cur) throw errors.notFound(name);
        if (doc.version !== undefined && doc.version !== cur.version) {
          throw errors.conflict(`${name} ${doc.id} was modified by someone else`, { expected: doc.version, actual: cur.version });
        }
        const next = cur.version + 1;
        const { version, ...rest } = doc; // eslint-disable-line no-unused-vars
        t.set(doc.id, toRow(rest, next, cur.created_at));
        return { ...rest, version: next };
      },
      async upsert(doc) {
        const cur = t.get(doc.id);
        const { version, ...rest } = doc; // eslint-disable-line no-unused-vars
        const next = cur ? cur.version + 1 : 1;
        t.set(doc.id, toRow(rest, next, cur?.created_at));
        return { ...rest, version: next };
      },
      async bulkUpsert(docs) {
        for (const d of docs) await this.upsert(d);
        return docs.length;
      },
      async find({ where = {}, orderBy, limit = 100, offset = 0 } = {}) {
        assertColumns(def, where, orderBy);
        let rows = [...t.values()].filter((r) => matches(r, where));
        if (orderBy) {
          const [col, dir = 'asc'] = orderBy;
          const s = dir.toLowerCase() === 'desc' ? -1 : 1;
          rows.sort((a, b) => {
            const av = a[col]; const bv = b[col];
            if (av === bv) return a.id < b.id ? -1 : 1;
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            return av < bv ? -s : s;
          });
        }
        rows = rows.slice(offset, offset + limit);
        return rows.map(fromRow);
      },
      async count(where = {}) {
        assertColumns(def, where);
        let n = 0;
        for (const r of t.values()) if (matches(r, where)) n++;
        return n;
      },
      async countBy(column, where = {}) {
        assertColumns(def, { ...where, [column]: null });
        const out = {};
        for (const r of t.values()) {
          if (!matches(r, where)) continue;
          const k = r[column] ?? 'null';
          out[k] = (out[k] || 0) + 1;
        }
        return out;
      },
      async delete(id) { return t.delete(id); },
      async deleteWhere(where) {
        assertColumns(def, where);
        let n = 0;
        for (const [id, r] of t) if (matches(r, where)) { t.delete(id); n++; }
        return n;
      },
      /** Raw stored row — used by tests to prove PII is encrypted at rest. */
      async raw(id) { return t.get(id) || null; },
    };
  }

  return {
    kind: 'memory',
    collection,
    async transaction(fn) { return fn(this); },
    async claimEvents(limit = 50) {
      const t = table('domain_events');
      const pending = [...t.values()].filter((r) => r.status === 'pending').sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1)).slice(0, limit);
      for (const r of pending) { r.status = 'processing'; r.data = { ...r.data, status: 'processing' }; }
      return pending.map((r) => ({ ...codec.decode('domain_events', r.data), version: r.version }));
    },
    audit: {
      async append(e) {
        const prevHash = audit.length ? audit[audit.length - 1].hash : GENESIS;
        const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), ...e, prevHash };
        entry.hash = entryHash(prevHash, entry);
        audit.push(entry);
        return entry;
      },
      async list({ entityId, actor, action, limit = 100, offset = 0 } = {}) {
        return audit
          .filter((e) => (!entityId || e.entityId === entityId) && (!actor || e.actor === actor) && (!action || e.action === action))
          .slice()
          .reverse()
          .slice(offset, offset + limit);
      },
      async verify() { return verifyChain(audit); },
      async count() { return audit.length; },
      _entries: audit,
    },
    async ping() { return true; },
    async close() {},
    async reset() { tables.clear(); audit.length = 0; },
  };
}

module.exports = { createMemoryStore };
