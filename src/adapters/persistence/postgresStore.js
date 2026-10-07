'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { assertColumns } = require('./query');
const { GENESIS, entryHash, verifyChain } = require('./auditChain');
const { errors } = require('../../shared/errors');

/**
 * PostgreSQL store adapter.
 *
 * SECURITY: every statement uses bind parameters ($1..$n). Identifiers
 * (table/column names) are never taken from input — they come from the
 * collection registry (schema.js) and are validated against a strict pattern
 * there, and filter/sort columns are checked by assertColumns().
 */

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'db', 'migrations');

function buildWhere(where, startIdx = 1) {
  const clauses = [];
  const params = [];
  let i = startIdx;
  for (const [col, cond] of Object.entries(where || {})) {
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if (cond.in) { clauses.push(`${col} = ANY($${i++})`); params.push(cond.in); }
      if (cond.ne !== undefined) { clauses.push(`${col} IS DISTINCT FROM $${i++}`); params.push(cond.ne); }
      if (cond.isNull === true) clauses.push(`${col} IS NULL`);
      if (cond.isNull === false) clauses.push(`${col} IS NOT NULL`);
      for (const [op, sql] of [['gte', '>='], ['lte', '<='], ['gt', '>'], ['lt', '<']]) {
        if (cond[op] !== undefined) { clauses.push(`${col} ${sql} $${i++}`); params.push(cond[op]); }
      }
    } else if (cond === null) {
      clauses.push(`${col} IS NULL`);
    } else {
      clauses.push(`${col} = $${i++}`);
      params.push(cond);
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params, next: i };
}

function createPostgresStore({ codec, databaseUrl, ssl, poolMax = 10, logger, pool: injectedPool }) {
  // Loaded lazily so the in-memory mode has no runtime dependency on pg.
  const { Pool } = require('pg');  
  const pool = injectedPool || new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    ssl: ssl ? { rejectUnauthorized: true } : undefined,
    statement_timeout: 15000,
    idleTimeoutMillis: 30000,
  });
  pool.on?.('error', (err) => logger?.error('pg pool error', { err }));

  function makeApi(q) {
    function collection(name) {
      const def = codec.def(name);
      const idxCols = [...Object.keys(def.indexes), ...Object.keys(def.blind)];
      const fromRow = (row) => (row ? { ...codec.decode(name, row.data), version: row.version } : null);

      const writeRow = async (doc, mode) => {
        const { version, ...rest } = doc;
        const { data, columns } = codec.encode(name, rest);
        const cols = ['id', 'data', ...idxCols];
        const vals = [rest.id, JSON.stringify(data), ...idxCols.map((c) => columns[c])];
        const ph = vals.map((_, i) => `$${i + 1}`);
        if (mode === 'insert') {
          try {
            await q(`INSERT INTO ${name} (${cols.join(', ')}, version) VALUES (${ph.join(', ')}, 1)`, vals);
          } catch (e) {
            if (e.code === '23505') throw errors.conflict(`${name} ${rest.id} already exists`);
            throw e;
          }
          return { ...rest, version: 1 };
        }
        if (mode === 'update') {
          const sets = cols.slice(1).map((c, i) => `${c} = $${i + 2}`);
          let sql = `UPDATE ${name} SET ${sets.join(', ')}, version = version + 1, updated_at = now() WHERE id = $1`;
          const params = [...vals];
          if (version !== undefined) { sql += ` AND version = $${params.length + 1}`; params.push(version); }
          sql += ' RETURNING version';
          const r = await q(sql, params);
          if (!r.rows.length) {
            const exists = await q(`SELECT version FROM ${name} WHERE id = $1`, [rest.id]);
            if (!exists.rows.length) throw errors.notFound(name);
            throw errors.conflict(`${name} ${rest.id} was modified by someone else`, { expected: version, actual: exists.rows[0].version });
          }
          return { ...rest, version: r.rows[0].version };
        }
        const updates = cols.slice(1).map((c) => `${c} = EXCLUDED.${c}`);
        const r = await q(
          `INSERT INTO ${name} (${cols.join(', ')}, version) VALUES (${ph.join(', ')}, 1)
           ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}, version = ${name}.version + 1, updated_at = now()
           RETURNING version`,
          vals,
        );
        return { ...rest, version: r.rows[0].version };
      };

      return {
        async get(id) {
          const r = await q(`SELECT data, version FROM ${name} WHERE id = $1`, [id]);
          return fromRow(r.rows[0]);
        },
        insert: (doc) => { if (!doc.id) throw new Error('id required'); return writeRow(doc, 'insert'); },
        update: (doc) => writeRow(doc, 'update'),
        upsert: (doc) => writeRow(doc, 'upsert'),
        async bulkUpsert(docs) {
          for (const d of docs) await writeRow(d, 'upsert');
          return docs.length;
        },
        async find({ where = {}, orderBy, limit = 100, offset = 0 } = {}) {
          assertColumns(def, where, orderBy);
          const w = buildWhere(where);
          const order = orderBy ? `ORDER BY ${orderBy[0]} ${String(orderBy[1] || 'asc').toUpperCase()} NULLS LAST, id ASC` : 'ORDER BY id ASC';
          const r = await q(
            `SELECT data, version FROM ${name} ${w.sql} ${order} LIMIT $${w.next} OFFSET $${w.next + 1}`,
            [...w.params, Math.min(Number(limit) || 100, 5000), Math.max(Number(offset) || 0, 0)],
          );
          return r.rows.map(fromRow);
        },
        async count(where = {}) {
          assertColumns(def, where);
          const w = buildWhere(where);
          const r = await q(`SELECT count(*)::int AS n FROM ${name} ${w.sql}`, w.params);
          return r.rows[0].n;
        },
        async countBy(column, where = {}) {
          assertColumns(def, { ...where, [column]: null });
          const w = buildWhere(where);
          const r = await q(`SELECT COALESCE(${column}::text, 'null') AS k, count(*)::int AS n FROM ${name} ${w.sql} GROUP BY 1`, w.params);
          return Object.fromEntries(r.rows.map((x) => [x.k, x.n]));
        },
        async delete(id) {
          const r = await q(`DELETE FROM ${name} WHERE id = $1`, [id]);
          return r.rowCount > 0;
        },
        async deleteWhere(where) {
          assertColumns(def, where);
          const w = buildWhere(where);
          if (!w.sql) throw new Error('deleteWhere requires a filter');
          const r = await q(`DELETE FROM ${name} ${w.sql}`, w.params);
          return r.rowCount;
        },
        async raw(id) {
          const r = await q(`SELECT * FROM ${name} WHERE id = $1`, [id]);
          return r.rows[0] || null;
        },
      };
    }

    const audit = {
      async append(e) {
        // Serialise appends so the hash chain stays linear across replicas.
        return withTx(async (tq) => {
          await tq('SELECT pg_advisory_xact_lock(724001)');
          const last = await tq('SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1');
          const prevHash = last.rows[0]?.hash || GENESIS;
          const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), ...e, prevHash };
          entry.hash = entryHash(prevHash, entry);
          await tq(
            `INSERT INTO audit_log (id, at, actor, action, entity_type, entity_id, details, prev_hash, hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [entry.id, entry.at, entry.actor, entry.action, entry.entityType || null, entry.entityId || null, JSON.stringify(entry.details ?? null), prevHash, entry.hash],
          );
          return entry;
        });
      },
      async list({ entityId, actor, action, limit = 100, offset = 0 } = {}) {
        const w = buildWhere({ ...(entityId ? { entity_id: entityId } : {}), ...(actor ? { actor } : {}), ...(action ? { action } : {}) });
        const r = await q(`SELECT * FROM audit_log ${w.sql} ORDER BY seq DESC LIMIT $${w.next} OFFSET $${w.next + 1}`, [...w.params, limit, offset]);
        return r.rows.map(rowToAudit);
      },
      async verify() {
        const r = await q('SELECT * FROM audit_log ORDER BY seq ASC');
        return verifyChain(r.rows.map(rowToAudit));
      },
      async count() {
        const r = await q('SELECT count(*)::int AS n FROM audit_log');
        return r.rows[0].n;
      },
    };

    return { collection, audit };
  }

  function rowToAudit(r) {
    return {
      id: r.id, at: new Date(r.at).toISOString(), actor: r.actor, action: r.action, entityType: r.entity_type,
      entityId: r.entity_id, details: r.details, prevHash: r.prev_hash, hash: r.hash,
    };
  }

  const q = (sql, params) => pool.query(sql, params);

  async function withTx(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn((sql, params) => client.query(sql, params));
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  const api = makeApi(q);

  return {
    kind: 'postgres',
    ...api,
    async transaction(fn) {
      return withTx(async (tq) => fn({ ...makeApi(tq), kind: 'postgres-tx' }));
    },
    /** Outbox relay: claim pending events without blocking other replicas. */
    async claimEvents(limit = 50) {
      return withTx(async (tq) => {
        const r = await tq(
          `UPDATE domain_events SET status = 'processing', data = jsonb_set(data, '{status}', '"processing"'), updated_at = now()
           WHERE id IN (SELECT id FROM domain_events
                        WHERE status = 'pending' OR (status = 'processing' AND updated_at < now() - interval '5 minutes')
                        ORDER BY occurred_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED)
           RETURNING data, version`,
          [limit],
        );
        return r.rows.map((row) => ({ ...codec.decode('domain_events', row.data), version: row.version }));
      });
    },
    async migrate() {
      // Serialise concurrent migrators (several pods starting at once).
      const client = await pool.connect();
      try {
        await client.query('SELECT pg_advisory_lock(724002)');
        return await this._migrate();
      } finally {
        await client.query('SELECT pg_advisory_unlock(724002)').catch(() => {});
        client.release();
      }
    },
    async _migrate() {
      await q('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const done = new Set((await q('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
      const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
      const applied = [];
      for (const f of files) {
        if (done.has(f)) continue;
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
        await withTx(async (tq) => {
          await tq(sql);
          await tq('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        });
        applied.push(f);
      }
      return applied;
    },
    async ping() { await q('SELECT 1'); return true; },
    async close() { await pool.end(); },
    async reset() {
      const { COLLECTIONS } = require('./schema');  
      await withTx(async (tq) => {
        await tq("SET LOCAL tasco.allow_audit_truncate = 'on'");
        await tq(`TRUNCATE ${Object.keys(COLLECTIONS).join(', ')}, audit_log`);
      });
    },
    _pool: pool,
  };
}

module.exports = { createPostgresStore, buildWhere };
