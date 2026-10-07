'use strict';

const crypto = require('crypto');
const { addDays, fmtDate } = require('../shared/util');

/**
 * Operational jobs: reconciliation (orders ↔ payments ↔ policies), retention
 * and archival, data-quality issue management and job history.
 */

function createOpsService({ store, rules, audit, clock, logger }) {
  const c = (n) => store.collection(n);

  async function recordRun(kind, actor, fn) {
    const run = { id: `J-${crypto.randomUUID().slice(0, 8)}`, kind, actor, startedAt: clock.now().toISOString(), status: 'running' };
    await c('job_runs').insert(run);
    try {
      const result = await fn();
      await c('job_runs').upsert({ ...run, status: 'succeeded', result, finishedAt: clock.now().toISOString() });
      await audit.record({ actor, action: `job.${kind}`, entityType: 'job', entityId: run.id, details: result });
      return { runId: run.id, ...result };
    } catch (e) {
      await c('job_runs').upsert({ ...run, status: 'failed', error: e.message, finishedAt: clock.now().toISOString() });
      logger?.error('job failed', { kind, err: e });
      throw e;
    }
  }

  return {
    recordRun,

    /** Every completed order must have a payment reference and one policy per quote line. */
    reconcile(actor = 'scheduler') {
      return recordRun('reconciliation', actor, async () => {
        const mismatches = [];
        let checked = 0;
        for (let off = 0; ; off += 1000) {
          const page = await c('orders').find({ limit: 1000, offset: off, orderBy: ['id', 'asc'] });
          for (const o of page) {
            checked++;
            if (o.status === 'completed') {
              if (!o.paymentRef) mismatches.push({ orderId: o.id, issue: 'missing payment reference' });
              for (const pid of o.policies || []) if (!(await c('policies').get(pid))) mismatches.push({ orderId: o.id, issue: `policy ${pid} missing` });
            }
            if (o.status === 'pending_payment' && new Date(o.createdAt) < new Date(Date.now() - 3600000)) mismatches.push({ orderId: o.id, issue: 'stuck in pending_payment > 1h' });
            if (o.status === 'compensation_failed') mismatches.push({ orderId: o.id, issue: `compensation failed (refund ${o.refund?.status}; ${o.cancelFailures?.length || 0} policy cancellations failed) — manual action` });
            if (o.status === 'payment_failed') mismatches.push({ orderId: o.id, issue: 'payment failed — confirm with VETC wallet that no capture occurred', severity: 'check' });
          }
          if (page.length < 1000) break;
        }
        return { checked, mismatches: mismatches.length, details: mismatches.slice(0, 100) };
      });
    },

    /** Apply the retention rule set (delete / anonymise / archive-flag). */
    applyRetention(actor = 'scheduler') {
      return recordRun('retention', actor, async () => {
        const policy = await rules.get('retention');
        const out = {};
        for (const p of policy.policies) {
          const cutoff = fmtDate(addDays(clock.today(), -p.retainDays));
          if (p.entity === 'source_records' && p.action === 'delete') {
            out[p.entity] = await c('source_records').deleteWhere({ created_at: { lt: cutoff } });
          } else if (p.entity === 'voice_sessions' && p.action === 'delete') {
            out[p.entity] = await c('voice_sessions').deleteWhere({ created_at: { lt: cutoff } });
          } else {
            out[p.entity] = `policy ${p.action} after ${p.retainDays}d (cutoff ${cutoff}) — executed by archival pipeline`;
          }
        }
        return out;
      });
    },

    async dqIssues({ type, status = 'open', limit = 100, offset = 0 }) {
      const where = { status };
      if (type) where.type = type;
      const [items, total, byType] = await Promise.all([c('dq_issues').find({ where, limit, offset, orderBy: ['created_at', 'desc'] }), c('dq_issues').count(where), c('dq_issues').countBy('type', { status })]);
      return { items, total, byType };
    },

    async resolveDq(id, { resolution }, actor) {
      const i = await c('dq_issues').get(id);
      if (!i) return null;
      const saved = await c('dq_issues').update({ ...i, status: 'resolved', resolution, resolvedBy: actor.id, resolvedAt: clock.now().toISOString() });
      await audit.record({ actor: actor.id, action: 'dq.resolved', entityType: 'dq_issue', entityId: id });
      return saved;
    },

    async jobRuns(limit = 50) {
      return c('job_runs').find({ orderBy: ['started_at', 'desc'], limit });
    },

    async lineage(entityId) {
      const profile = await c('profiles').get(entityId);
      const batches = await c('lineage').find({ limit: 50, orderBy: ['created_at', 'desc'] });
      return { entityId, fields: profile?.lineage || [], sourceRecords: profile?.recordIds || [], sources: profile?.sources || [], recentBatches: batches.slice(0, 10) };
    },
  };
}

module.exports = { createOpsService };
