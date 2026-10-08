'use strict';

const crypto = require('crypto');
const { errors } = require('../shared/errors');
const { maskName } = require('../shared/util');

/**
 * First notice of loss (FNOL) from the VETC app. Trust is built at claim time:
 * fast, transparent claim handling is the strongest renewal driver.
 * Full claims adjudication stays in TASCO core; this is the digital front door.
 */

const TRANSITIONS = {
  submitted: ['acknowledged', 'rejected'],
  acknowledged: ['assessor_assigned', 'rejected'],
  assessor_assigned: ['under_assessment'],
  under_assessment: ['approved', 'rejected'],
  approved: ['paid'],
  paid: [],
  rejected: [],
};

/** Statuses that end a claim (no SLA clock runs). */
const CLOSED = ['paid', 'rejected', 'closed'];
/** Default stage targets when service_levels does not define them (hours). */
const DEFAULT_SLA_HOURS = { decision: 120, payment: 72 };

/**
 * The SLA clock that currently applies to a claim: acknowledgement (submitted), assessment decision
 * (acknowledged → under assessment, from submission) or payment (approved, from approval).
 */
function slaFor(c, levels) {
  if (CLOSED.includes(c.status)) return null;
  const firstAt = (st) => (c.history || []).find((x) => x.status === st)?.at;
  if (c.status === 'submitted') return { stage: 'acknowledgement', dueAt: c.slaDueAt };
  if (c.status === 'approved') {
    const from = firstAt('approved') || c.slaDueAt;
    return { stage: 'payment', dueAt: new Date(new Date(from).getTime() + (levels.claimPaymentSlaHours ?? DEFAULT_SLA_HOURS.payment) * 3600000).toISOString() };
  }
  const from = firstAt('submitted') || c.createdAt || c.slaDueAt;
  return { stage: 'decision', dueAt: new Date(new Date(from).getTime() + (levels.claimDecisionSlaHours ?? DEFAULT_SLA_HOURS.decision) * 3600000).toISOString() };
}

function createClaimsService({ store, rules, audit, events, clock }) {
  const claims = store.collection('claims');
  const policies = store.collection('policies');
  const profiles = store.collection('profiles');
  const users = store.collection('users');

  /** Display names for history actors (staff names; customers shown as the app channel). */
  async function actorNames(ids) {
    const staff = [...new Set(ids.filter((id) => id && !String(id).startsWith('customer:')))];
    const found = (await Promise.all(staff.map((id) => users.get(id)))).filter(Boolean);
    const m = new Map(found.map((u) => [u.id, u.displayName]));
    return (id) => (String(id || '').startsWith('customer:') ? null : m.get(id) || null);
  }

  return {
    async submit({ profileId, policyId, incidentDate, description, location, photos = 0 }, actor) {
      const pol = await policies.get(policyId);
      if (!pol || pol.profileId !== profileId) throw errors.notFound('Policy');
      if (incidentDate < pol.startDate || incidentDate > pol.endDate) throw errors.rule('Incident date is outside the policy period');
      const c = {
        id: `CL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, profileId, policyId, product: pol.product, incidentDate,
        description, location, photos, status: 'submitted', history: [{ status: 'submitted', at: clock.now().toISOString(), by: actor.id }],
        slaDueAt: new Date(clock.now().getTime() + (await rules.get('service_levels')).claimAckSlaHours * 3600000).toISOString(),
      };
      await claims.insert(c);
      await audit.record({ actor: actor.id, action: 'claim.submitted', entityType: 'claim', entityId: c.id, details: { policyId } });
      await events.publish('claim.submitted', { claimId: c.id, profileId }, { actor: actor.id });
      return c;
    },
    async list({ profileId, status, limit = 50, offset = 0 }) {
      const where = {};
      if (profileId) where.profile_id = profileId;
      if (status) where.status = status;
      const rows = await claims.find({ where, orderBy: ['created_at', 'desc'], limit, offset });
      // Queue context for handlers: plate and (masked) customer name — claims handlers do not hold profile:read_pii.
      const ids = [...new Set(rows.map((r) => r.profileId).filter(Boolean))];
      const byId = new Map((await Promise.all(ids.map((id) => profiles.get(id)))).filter(Boolean).map((p) => [p.id, p]));
      const levels = await rules.get('service_levels');
      return rows.map((r) => {
        const p = byId.get(r.profileId);
        return { ...r, plate: p?.plate || null, customerName: p ? maskName(p.name) : null, sla: slaFor(r, levels) };
      });
    },
    /** Claim with additive context: actor names on history/notes, policy and (masked) customer snapshot, current SLA. */
    async get(id) {
      const c = await claims.get(id);
      if (!c) throw errors.notFound('Claim');
      const [pol, prof, levels] = await Promise.all([policies.get(c.policyId), profiles.get(c.profileId), rules.get('service_levels')]);
      const nameOf = await actorNames([...(c.history || []).map((x) => x.by), ...(c.notes || []).map((x) => x.by)]);
      return {
        ...c,
        history: (c.history || []).map((x) => ({ ...x, byName: nameOf(x.by) })),
        notes: (c.notes || []).map((x) => ({ ...x, byName: nameOf(x.by) })),
        sla: slaFor(c, levels),
        plate: prof?.plate || null,
        customerName: prof ? maskName(prof.name) : null,
        policy: pol ? { certNo: pol.certNo, policyNo: pol.policyNo, product: pol.product, startDate: pol.startDate, endDate: pol.endDate, total: pol.total ?? null, status: pol.status, channel: pol.channel || null } : null,
        customer: prof ? { plate: prof.plate || prof.id, name: maskName(prof.name), province: prof.province || null, ownerType: prof.ownerType || null, category: prof.vehicle?.category || null } : null,
      };
    },
    /**
     * Advance a claim. Decision data travels with the step (all optional for API compatibility):
     * assessor (→ assessor_assigned), approvedAmount (→ approved), reason (→ rejected), paymentRef (→ paid).
     */
    async transition(id, status, actor, note, data = {}) {
      const c = await claims.get(id);
      if (!c) throw errors.notFound('Claim');
      if (!TRANSITIONS[c.status]?.includes(status)) throw errors.rule(`Cannot move claim from ${c.status} to ${status}`);
      const extra = {};
      if (status === 'assessor_assigned' && data.assessor) extra.assessor = data.assessor;
      if (status === 'approved' && data.approvedAmount !== undefined) {
        if (!(Number.isInteger(data.approvedAmount) && data.approvedAmount > 0)) throw errors.validation('The approved amount must be a positive whole number of đồng');
        extra.approvedAmount = data.approvedAmount;
      }
      if (status === 'rejected' && data.reason) extra.rejectionReason = data.reason;
      if (status === 'paid' && data.paymentRef) extra.paymentRef = data.paymentRef;
      const step = { status, at: clock.now().toISOString(), by: actor.id, note: note || null, ...Object.keys(extra).length ? { data: extra } : {} };
      const saved = await claims.update({ ...c, ...extra, status, history: [...c.history, step] });
      await audit.record({ actor: actor.id, action: 'claim.status_changed', entityType: 'claim', entityId: id, details: { from: c.status, to: status } });
      return saved;
    },
    /** Internal handler note (not visible to the customer). */
    async addNote(id, text, actor) {
      const c = await claims.get(id);
      if (!c) throw errors.notFound('Claim');
      const n = { id: `N-${crypto.randomUUID().slice(0, 8)}`, text, at: clock.now().toISOString(), by: actor.id };
      const saved = await claims.update({ ...c, notes: [...(c.notes || []), n] });
      await audit.record({ actor: actor.id, action: 'claim.note_added', entityType: 'claim', entityId: id });
      return { ...n, claimId: saved.id };
    },
  };
}

module.exports = { createClaimsService, TRANSITIONS, slaFor };
