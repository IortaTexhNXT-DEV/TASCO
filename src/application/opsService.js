'use strict';

const crypto = require('crypto');
const { addDays, fmtDate, maskName, maskPhone } = require('../shared/util');
const { errors } = require('../shared/errors');

/**
 * Background jobs as scheduled in production (deploy/k8s/60-jobs.yaml, UTC cron) — shown in the
 * operations console with their last and next run. 'every' is minutes for interval jobs.
 */
const JOB_SCHEDULE = [
  { kind: 'catalogue-sync', runKind: 'catalogue_sync', cron: '0 18 * * *', at: { h: 18, m: 0 } },
  { kind: 'reconciliation', runKind: 'reconciliation', cron: '0 19 * * *', at: { h: 19, m: 0 } },
  { kind: 'retention', runKind: 'retention', cron: '0 20 * * *', at: { h: 20, m: 0 } },
  { kind: 'relay', runKind: 'relay', cron: '*/5 * * * *', every: 5 },
];

function nextRun(job, now) {
  if (job.every) {
    const ms = job.every * 60000;
    return new Date(Math.floor(now.getTime() / ms) * ms + ms).toISOString();
  }
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), job.at.h, job.at.m));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Where a DQ issue came from, as a source code the UI maps to a business name (never the raw batch id). */
function issueOrigin(issue, batch, partnerNames) {
  if (issue.via) return { kind: 'voice_call', source: 'voice_bot', at: issue.detectedAt || null };
  const src = batch?.source || issue.source || null;
  if (src && partnerNames.has(src)) return { kind: 'batch', source: 'partner_api', partnerName: partnerNames.get(src), at: batch?.at || issue.detectedAt || null };
  return { kind: issue.batchId ? 'batch' : 'unknown', source: src, records: batch?.records ?? null, at: batch?.at || issue.detectedAt || null };
}

/**
 * Operational jobs: reconciliation (orders ↔ payments ↔ policies), retention
 * and archival, data-quality issue management and job history.
 */

/** Profile facts a steward needs to judge an issue (owner masked, phones masked). */
function profileSnapshot(p) {
  const pol = p.policy || {};
  return {
    id: p.id, plate: p.plate || p.id, owner: maskName(p.name), province: p.province || null, category: p.vehicle?.category || null,
    categoryConfidence: p.vehicle?.categoryConfidence ?? null, insurer: pol.insurer || null, expiryDate: pol.expiryDate || null,
    expiryMethod: pol.expiryMethod || null, expiryConfidence: pol.expiryConfidence ?? null, verified: !!pol.verified,
    phones: [p.phone, ...(p.altPhones || [])].filter(Boolean).map(maskPhone), sources: p.sources || [], records: (p.recordIds || []).length,
    expiryCandidates: (pol.expiryCandidates || []).slice(0, 5).map((x) => ({ date: x.date || null, method: x.method || null, source: x.source || null, confidence: x.confidence ?? null })),
  };
}
const lineageOf = (p) => (p.lineage || []).map((l) => ({ field: l.field, source: l.source, confidence: l.confidence ?? null, at: l.at || null, superseded: !!l.superseded }));

/** "Customer says renewed" vs the verified record, side by side. */
function renewalConflict(p, session, issue) {
  const pol = p.policy || {};
  const claim = pol.renewalClaim || {};
  return {
    verified: { insurer: pol.insurer || null, expiryDate: pol.expiryDate || null, method: pol.expiryMethod || null, confidence: pol.expiryConfidence ?? null },
    claimed: {
      insurer: claim.insurer || 'OTHER', note: claim.note || session?.signals?.competitorInfo || null, confidence: claim.confidence ?? null,
      at: session?.endedAt || session?.startedAt || issue.detectedAt || null, channel: 'voice_bot',
    },
  };
}

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

    async dqIssues({ type, status = 'open', profileId, limit = 100, offset = 0 }) {
      const where = { status };
      if (type) where.type = type;
      if (profileId) where.profile_id = profileId; // one vehicle's issues (Customer 360 → queue)
      const [items, total, byType] = await Promise.all([c('dq_issues').find({ where, limit, offset, orderBy: ['created_at', 'desc'] }), c('dq_issues').count(where), c('dq_issues').countBy('type', profileId ? { status, profile_id: profileId } : { status })]);
      return { items: await this.describeIssues(items), total, byType };
    },

    /**
     * Queue context for each issue (additive fields): `origin` (source code + date, resolved from the ingestion
     * batch record so the UI never shows a batch id) and `vehicle` (plate + masked owner).
     */
    async describeIssues(items) {
      const batchIds = [...new Set(items.map((i) => i.batchId).filter(Boolean))];
      const profileIds = [...new Set(items.map((i) => i.profileId).filter(Boolean))];
      const [batches, profs, partners] = await Promise.all([
        Promise.all(batchIds.map((id) => c('lineage').get(id))),
        Promise.all(profileIds.map((id) => c('profiles').get(id))),
        c('partners').find({ limit: 500 }),
      ]);
      const byBatch = new Map(batches.filter(Boolean).map((b) => [b.id, b]));
      const byProfile = new Map(profs.filter(Boolean).map((p) => [p.id, p]));
      const partnerNames = new Map(partners.map((p) => [p.id, p.name]));
      return items.map((i) => {
        const p = byProfile.get(i.profileId);
        return {
          ...i,
          origin: issueOrigin(i, byBatch.get(i.batchId), partnerNames),
          vehicle: p ? { plate: p.plate || p.id, owner: maskName(p.name), province: p.province || null } : null,
        };
      });
    },

    /** One issue with lineage context; "customer says renewed" carries both claims side by side. */
    async dqIssue(id) {
      const i = await c('dq_issues').get(id);
      if (!i) throw errors.notFound('Issue');
      const [item] = await this.describeIssues([i]);
      const p = i.profileId ? await c('profiles').get(i.profileId) : null;
      const out = { ...item, profile: p ? profileSnapshot(p) : null, lineage: p ? lineageOf(p) : [], context: null };
      if (i.type === 'unverified_renewal_claim' && p) out.context = renewalConflict(p, i.via ? await c('voice_sessions').get(i.via) : null, i);
      return out;
    },

    /** Staff who can work the data-quality queue (names only). */
    async dqAssignees(rbac) {
      const roles = Object.entries(rbac?.roles || {}).filter(([, perms]) => perms.includes('dq:resolve')).map(([r]) => r);
      const users = await c('users').find({ limit: 1000, orderBy: ['username', 'asc'] });
      return users.filter((u) => u.status === 'active' && u.roles.some((r) => roles.includes(r))).map((u) => ({ id: u.id, displayName: u.displayName }));
    },

    /** Bulk assign (assignee = user id, or null to unassign) or dismiss with a reason. */
    async bulkDq({ ids, action, assignee, reason }, actor, rbac) {
      if (action === 'dismiss' && !reason) throw errors.validation('A reason is required to dismiss issues');
      let who = null;
      if (action === 'assign' && assignee) {
        who = (await this.dqAssignees(rbac)).find((u) => u.id === assignee);
        if (!who) throw errors.validation('The assignee cannot work the data-quality queue');
      }
      let updated = 0;
      for (const id of ids) {
        const i = await c('dq_issues').get(id);
        if (!i || i.status !== 'open') continue;
        if (action === 'assign') {
          await c('dq_issues').update({ ...i, assignee: who?.id || null, assigneeName: who?.displayName || null, assignedAt: clock.now().toISOString() });
          await audit.record({ actor: actor.id, action: 'dq.assigned', entityType: 'dq_issue', entityId: id, details: { assignee: who?.id || null } });
        } else {
          await this.resolveDq(id, { resolution: reason, outcome: 'dismissed' }, actor);
        }
        updated++;
      }
      return { updated };
    },

    async resolveDq(id, { resolution, outcome, evidence }, actor) {
      const i = await c('dq_issues').get(id);
      if (!i) return null;
      const saved = await c('dq_issues').update({
        ...i, status: 'resolved', resolution, outcome: outcome || null, evidence: evidence || null, resolvedBy: actor.id, resolvedAt: clock.now().toISOString(),
      });
      await audit.record({ actor: actor.id, action: 'dq.resolved', entityType: 'dq_issue', entityId: id, ...(outcome ? { details: { outcome } } : {}) });
      return saved;
    },

    /** Scheduled jobs with their last run and next run. */
    async jobSchedule() {
      const now = new Date();
      return Promise.all(JOB_SCHEDULE.map(async (j) => {
        const [last] = await c('job_runs').find({ where: { kind: j.runKind }, orderBy: ['started_at', 'desc'], limit: 1 });
        return {
          kind: j.kind, cron: j.cron, everyMinutes: j.every || null, nextRunAt: nextRun(j, now),
          lastRun: last ? { status: last.status, startedAt: last.startedAt, finishedAt: last.finishedAt || null, actor: last.actor } : null,
        };
      }));
    },

    /** Job history; `actorName` (additive) names the staff member who ran it (null for the scheduler). */
    async jobRuns(limit = 50) {
      const runs = await c('job_runs').find({ orderBy: ['started_at', 'desc'], limit });
      const ids = [...new Set(runs.map((r) => r.actor).filter((a) => /^U-/.test(String(a))))];
      const names = new Map((await Promise.all(ids.map((id) => c('users').get(id)))).filter(Boolean).map((u) => [u.id, u.displayName]));
      return runs.map((r) => ({ ...r, actorName: names.get(r.actor) || null }));
    },

    async lineage(entityId) {
      const profile = await c('profiles').get(entityId);
      const batches = await c('lineage').find({ limit: 50, orderBy: ['created_at', 'desc'] });
      return { entityId, fields: profile?.lineage || [], sourceRecords: profile?.recordIds || [], sources: profile?.sources || [], recentBatches: batches.slice(0, 10) };
    },
  };
}

module.exports = { createOpsService };
