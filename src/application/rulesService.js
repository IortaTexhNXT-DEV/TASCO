'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validatePayload } = require('../rules/validators');
const { errors } = require('../shared/errors');

/**
 * Rule registry with versioning and maker-checker governance.
 *
 *   draft → pending_approval → active → retired
 *                     ↘ rejected
 *
 * A different user must approve than the one who authored (four-eyes). Every
 * transition is written to the audit trail. Active rules are cached in-process
 * with a short TTL so all replicas converge within seconds of an approval.
 */

const CACHE_TTL_MS = 15000;

function checksum(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

function createRulesService({ store, audit, events, clock, logger }) {
  const col = store.collection('rulesets');
  let cache = new Map();
  let cacheAt = 0;

  async function refresh() {
    const active = await col.find({ where: { status: 'active' }, limit: 1000 });
    cache = new Map(active.map((r) => [r.kind, r]));
    cacheAt = Date.now();
  }

  async function activeRecord(kind) {
    if (Date.now() - cacheAt > CACHE_TTL_MS || !cache.has(kind)) await refresh();
    const r = cache.get(kind);
    if (!r) throw errors.notFound(`Active rule set ${kind}`);
    return r;
  }

  async function bannedPhrases() {
    try { return (await activeRecord('copy_guard')).payload.bannedPhrases; } catch { return []; }
  }

  async function nextVersion(kind) {
    const latest = await col.find({ where: { kind }, orderBy: ['version_no', 'desc'], limit: 1 });
    return (latest[0]?.version_no || 0) + 1;
  }

  const service = {
    /** Seed default rule sets from config/rules/*.json for kinds that have none. */
    async loadDefaults(dir) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
      const loaded = [];
      // copy_guard first so content validation has the guard available.
      files.sort((a, b) => (a.startsWith('copy_guard') ? -1 : b.startsWith('copy_guard') ? 1 : 0));
      for (const f of files) {
        const def = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const existing = await col.count({ kind: def.kind });
        if (existing) continue;
        const errs = validatePayload(def.kind, def.payload, { bannedPhrases: await bannedPhrases() });
        if (errs.length) throw new Error(`Default rule set ${f} invalid: ${errs.join('; ')}`);
        const rec = {
          id: `${def.kind}@1`, kind: def.kind, version_no: 1, status: 'active',
          description: def.description, payload: def.payload, checksum: checksum(def.payload),
          createdBy: 'system', approvedBy: 'system', createdAt: clock.now().toISOString(), activatedAt: clock.now().toISOString(),
        };
        await col.insert(rec);
        await audit.record({ actor: 'system', action: 'rules.seeded', entityType: 'ruleset', entityId: rec.id, details: { checksum: rec.checksum } });
        loaded.push(def.kind);
        cacheAt = 0;
      }
      return loaded;
    },

    async get(kind) {
      return (await activeRecord(kind)).payload;
    },

    async getRecord(kind) {
      return activeRecord(kind);
    },

    async snapshot() {
      await refresh();
      return [...cache.values()].map((r) => ({ kind: r.kind, version: r.version_no, checksum: r.checksum }));
    },

    async list({ kind, status } = {}) {
      const where = {};
      if (kind) where.kind = kind;
      if (status) where.status = status;
      const rows = await col.find({ where, orderBy: ['kind', 'asc'], limit: 1000 });
      return rows.map(({ payload, ...meta }) => ({ ...meta, size: JSON.stringify(payload).length }));
    },

    async byId(id) {
      const r = await col.get(id);
      if (!r) throw errors.notFound('Rule set');
      return r;
    },

    async createDraft({ kind, payload, description }, actor) {
      const errs = validatePayload(kind, payload, { bannedPhrases: kind === 'copy_guard' ? [] : await bannedPhrases() });
      if (errs.length) throw errors.validation('Rule set is invalid', errs);
      const versionNo = await nextVersion(kind);
      const rec = {
        id: `${kind}@${versionNo}`, kind, version_no: versionNo, status: 'draft', description: description || '',
        payload, checksum: checksum(payload), createdBy: actor.id, createdAt: clock.now().toISOString(),
      };
      await col.insert(rec);
      await audit.record({ actor: actor.id, action: 'rules.draft_created', entityType: 'ruleset', entityId: rec.id, details: { checksum: rec.checksum } });
      return rec;
    },

    async submit(id, actor) {
      const r = await service.byId(id);
      if (r.status !== 'draft') throw errors.rule(`Only drafts can be submitted (status: ${r.status})`);
      if (r.createdBy !== actor.id) throw errors.forbidden('Only the author can submit a draft');
      const updated = await col.update({ ...r, status: 'pending_approval', submittedAt: clock.now().toISOString() });
      await audit.record({ actor: actor.id, action: 'rules.submitted', entityType: 'ruleset', entityId: id });
      return updated;
    },

    async approve(id, actor, { comment } = {}) {
      const r = await service.byId(id);
      if (r.status !== 'pending_approval') throw errors.rule(`Only pending rule sets can be approved (status: ${r.status})`);
      if (r.createdBy === actor.id) throw errors.forbidden('Maker-checker: you cannot approve your own change');
      const now = clock.now().toISOString();
      const previous = await col.find({ where: { kind: r.kind, status: 'active' } });
      for (const p of previous) await col.update({ ...p, status: 'retired', retiredAt: now, supersededBy: id });
      const updated = await col.update({ ...r, status: 'active', approvedBy: actor.id, approvalComment: comment || null, activatedAt: now });
      cacheAt = 0;
      await audit.record({ actor: actor.id, action: 'rules.approved', entityType: 'ruleset', entityId: id, details: { supersedes: previous.map((p) => p.id), comment } });
      await events.publish('rules.activated', { kind: r.kind, id, checksum: r.checksum });
      logger?.info('rule set activated', { kind: r.kind, id });
      return updated;
    },

    async reject(id, actor, { comment } = {}) {
      const r = await service.byId(id);
      if (r.status !== 'pending_approval') throw errors.rule('Only pending rule sets can be rejected');
      if (r.createdBy === actor.id) throw errors.forbidden('Maker-checker: you cannot review your own change');
      const updated = await col.update({ ...r, status: 'rejected', rejectedBy: actor.id, rejectionComment: comment || null });
      await audit.record({ actor: actor.id, action: 'rules.rejected', entityType: 'ruleset', entityId: id, details: { comment } });
      return updated;
    },

    /** Roll back = new draft copied from an earlier version; still needs approval. */
    async rollback(id, actor) {
      const old = await service.byId(id);
      return service.createDraft({ kind: old.kind, payload: old.payload, description: `Rollback to ${id}` }, actor);
    },

    validate(kind, payload) {
      return bannedPhrases().then((b) => validatePayload(kind, payload, { bannedPhrases: b }));
    },

    invalidate() { cacheAt = 0; },
  };
  return service;
}

module.exports = { createRulesService, checksum };
