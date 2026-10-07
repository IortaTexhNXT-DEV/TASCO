'use strict';

const crypto = require('crypto');
const { normalizePlate } = require('../domain/identity');
const { buildProfiles } = require('../domain/enrichment');

/**
 * Data ingestion and golden-record build (MDM).
 *
 * ingest(): lands raw source records (encrypted PII), tagged with a batch id
 * and lineage, then rebuilds only the affected golden profiles — incremental by
 * plate so it scales to the full 6M-vehicle VETC base.
 */

function createIngestionService({ store, rules, audit, events, clock, logger }) {
  const sources = store.collection('source_records');
  const profiles = store.collection('profiles');
  const dq = store.collection('dq_issues');
  const lineage = store.collection('lineage');

  async function rebuild(plateKeys, batchId) {
    const enrichment = await rules.get('enrichment');
    const today = clock.today();
    const stats = { profiles: 0, rejected: 0, dqIssues: 0 };
    const keys = [...plateKeys];
    const CHUNK = 500;
    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunk = keys.slice(i, i + CHUNK);
      const recs = await sources.find({ where: { plate_key: { in: chunk } }, limit: 50000 });
      const built = buildProfiles(enrichment, recs, today);
      for (const p of built.profiles) {
        const existing = await profiles.get(p.id);
        // Customer/bot-declared facts and consents captured on the platform survive rebuilds.
        if (existing) {
          if (existing.policy?.expiryConfidence > p.policy.expiryConfidence && ['customer_declared', 'voice_bot', 'tasco_issued', 'data_steward'].includes(existing.policy.expiryMethod)) {
            p.policy = existing.policy;
          }
          if (existing.consentOverrides) { p.consent = { ...p.consent, ...existing.consentOverrides }; p.consentOverrides = existing.consentOverrides; }
          if (existing.anonymised) continue;
        }
        await profiles.upsert(p);
      }
      for (const issue of built.dqIssues) {
        const cur = await dq.get(issue.id);
        if (!cur || cur.status === 'resolved') await dq.upsert({ ...issue, detectedAt: clock.now().toISOString(), batchId });
      }
      stats.profiles += built.profiles.length;
      stats.rejected += built.rejects.length;
      stats.dqIssues += built.dqIssues.length;
    }
    return stats;
  }

  return {
    /** Land a batch of raw source records and rebuild affected profiles. */
    async ingest(records, { actor = 'system', sourceName = 'unknown' } = {}) {
      const batchId = `B-${clock.today()}-${crypto.randomUUID().slice(0, 8)}`;
      const touched = new Set();
      let rejected = 0;
      for (const r of records) {
        const plate = normalizePlate(r.plateRaw);
        if (!plate.valid) {
          rejected++;
          await dq.upsert({ id: `record:${r.recordId}:invalid_plate`, profileId: null, type: 'invalid_plate', status: 'open', recordId: r.recordId, source: r.source, batchId, detectedAt: clock.now().toISOString() });
        }
        await sources.upsert({ ...r, id: r.recordId, plateKey: plate.valid ? plate.key : null, batchId, ingestedAt: clock.now().toISOString() });
        if (plate.valid) touched.add(plate.key);
      }
      await lineage.insert({ id: batchId, entityType: 'batch', entityId: batchId, source: sourceName, records: records.length, rejected, at: clock.now().toISOString() });
      const stats = await rebuild(touched, batchId);
      await audit.record({ actor, action: 'data.ingested', entityType: 'batch', entityId: batchId, details: { source: sourceName, records: records.length, rejected, profiles: stats.profiles } });
      await events.publish('profiles.rebuilt', { batchId, profileIds: [...touched] }, { actor });
      logger?.info('batch ingested', { batchId, records: records.length, profiles: stats.profiles });
      return { ...stats, batchId, records: records.length, rejected, profilesTouched: touched.size };
    },

    rebuild,
  };
}

module.exports = { createIngestionService };
