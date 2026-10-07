'use strict';

const { checksum } = require('./rulesService');
const { CORE_ONLY } = require('../domain/rating');

/**
 * Product catalogue sync: TASCO core owns the product catalogue (what exists,
 * its version and whether it is on sale); the platform owns distribution
 * (channels, bundles, local indicative rates). The sync pulls core's catalogue
 * through the ProductCatalogue port, merges it into the active `products` rule
 * set and *proposes* the result through maker-checker governance:
 *
 *   system:catalogue-sync creates a draft → submits it → a human rule approver
 *   (a different person, by construction) approves or rejects it.
 *
 * Nothing is ever activated automatically. The diff summary is written to the
 * audit trail and the job history.
 */

const SYNC_ACTOR = Object.freeze({ id: 'system:catalogue-sync', roles: ['rule_author'] });
const LOCAL_METHODS = ['tariff_table', 'rate_on_sum_insured', 'per_seat'];
// Fields core is authoritative for. Everything else (channels, rating rule kind, bundles) stays platform-owned.
const CORE_FIELDS = ['name', 'nameVi', 'line', 'compulsory', 'priceRegulated', 'requiresInspection', 'status', 'coreVersion'];
const BOOLEAN_FIELDS = new Set(['compulsory', 'priceRegulated', 'requiresInspection']);

function same(field, a, b) {
  if (BOOLEAN_FIELDS.has(field)) return !!a === !!b;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Pure merge of core's catalogue into the platform `products` payload. */
function mergeCatalogue(current, core) {
  const coreByCode = new Map(core.products.map((p) => [p.code, p]));
  const products = [];
  const added = [];
  const withdrawn = [];
  const changed = [];
  for (const p of current.products) {
    const c = coreByCode.get(p.code);
    if (!c) {
      // No longer in core: stop selling (kept so history, bundles and renewals still resolve).
      if (p.status !== 'withdrawn') withdrawn.push(p.code);
      products.push({ ...p, status: 'withdrawn' });
      continue;
    }
    const next = { ...p };
    for (const f of CORE_FIELDS) {
      const v = f === 'coreVersion' ? c.version : c[f];
      if (v !== undefined && !same(f, p[f], v)) next[f] = v;
    }
    const fields = CORE_FIELDS.filter((f) => !same(f, p[f], next[f]));
    if (fields.length) changed.push({ code: p.code, fields, ...(fields.includes('status') ? { status: { from: p.status, to: next.status } } : {}) });
    products.push(next);
  }
  const known = new Set(current.products.map((p) => p.code));
  for (const c of core.products) {
    if (known.has(c.code)) continue;
    // New in core: added *not distributed* (no channels) until the business configures it.
    products.push({
      code: c.code,
      name: c.name,
      nameVi: c.nameVi || c.name,
      line: c.line || 'motor',
      compulsory: !!c.compulsory,
      rating: { method: CORE_ONLY, ruleKind: null, coreRatingMethod: c.ratingMethod || null, localMethodAvailable: LOCAL_METHODS.includes(c.ratingMethod) },
      priceRegulated: !!c.priceRegulated,
      ...(c.requiresInspection ? { requiresInspection: true } : {}),
      channels: [],
      certificate: 'electronic',
      status: c.status,
      coreVersion: c.version,
    });
    added.push(c.code);
  }
  const payload = { ...current, products, coreCatalogue: { version: core.catalogueVersion, publishedAt: core.publishedAt || null } };
  const unchanged = current.products.length - withdrawn.length - changed.length;
  return { payload, diff: { added, withdrawn, changed, unchanged, hasChanges: added.length + withdrawn.length + changed.length > 0 } };
}

function createCatalogueService({ rules, gateways, audit, ops, store, logger, metrics }) {
  async function syncOnce() {
    const gw = gateways.productCatalogue;
    const core = await gw.exec(() => gw.port.fetchCatalogue());
    const active = await rules.getRecord('products');
    const { payload, diff } = mergeCatalogue(active.payload, core);
    const summary = {
      catalogueVersion: core.catalogueVersion,
      basedOn: active.id,
      added: diff.added,
      withdrawn: diff.withdrawn,
      changed: diff.changed,
      unchanged: diff.unchanged,
      coreProducts: core.products.length,
    };
    if (!diff.hasChanges) return { status: 'no_change', ...summary };

    // Don't queue the same proposal twice while one is still awaiting review.
    const ck = checksum(payload);
    const open = (await rules.list({ kind: 'products' })).filter((r) => ['draft', 'pending_approval'].includes(r.status) && r.createdBy === SYNC_ACTOR.id);
    const dup = open.find((r) => r.checksum === ck);
    if (dup) return { status: 'already_proposed', ruleSetId: dup.id, ruleSetStatus: dup.status, ...summary };

    const description = `TASCO core catalogue ${core.catalogueVersion}: +${diff.added.length} added, ~${diff.changed.length} changed, -${diff.withdrawn.length} withdrawn (proposed by catalogue sync; review channels for new products before approving)`;
    const draft = await rules.createDraft({ kind: 'products', payload, description: description.slice(0, 500) }, SYNC_ACTOR);
    // Into the approvers' queue — activation still needs a human rule approver (four-eyes).
    const submitted = await rules.submit(draft.id, SYNC_ACTOR);
    await audit.record({ actor: SYNC_ACTOR.id, action: 'catalogue.sync_proposed', entityType: 'ruleset', entityId: draft.id, details: summary });
    metrics?.inc('catalogue_sync_proposals_total');
    logger?.info('catalogue sync proposed products rule set', { ruleSetId: draft.id, catalogueVersion: core.catalogueVersion, added: diff.added.length, changed: diff.changed.length, withdrawn: diff.withdrawn.length });
    return { status: 'proposed', ruleSetId: draft.id, ruleSetStatus: submitted.status, ...summary };
  }

  return {
    SYNC_ACTOR,
    mergeCatalogue,

    /** Pull core's catalogue and propose it as a governed `products` rule-set version. */
    sync(actor = 'scheduler') {
      return ops.recordRun('catalogue_sync', actor, syncOnce);
    },

    async lastSync() {
      const [run] = await store.collection('job_runs').find({ where: { kind: 'catalogue_sync' }, orderBy: ['started_at', 'desc'], limit: 1 });
      if (!run) return null;
      const r = run.result || {};
      return {
        runId: run.id, status: run.status, actor: run.actor, startedAt: run.startedAt, finishedAt: run.finishedAt || null,
        outcome: r.status || null, catalogueVersion: r.catalogueVersion || null, ruleSetId: r.ruleSetId || null,
        added: r.added?.length ?? null, changed: r.changed?.length ?? null, withdrawn: r.withdrawn?.length ?? null,
        ...(run.status === 'failed' ? { error: run.error } : {}),
      };
    },
  };
}

module.exports = { createCatalogueService, mergeCatalogue, SYNC_ACTOR };
