'use strict';

const crypto = require('crypto');
const { errors } = require('../shared/errors');

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

function createClaimsService({ store, rules, audit, events, clock }) {
  const claims = store.collection('claims');
  const policies = store.collection('policies');

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
      return claims.find({ where, orderBy: ['created_at', 'desc'], limit, offset });
    },
    async get(id) {
      const c = await claims.get(id);
      if (!c) throw errors.notFound('Claim');
      return c;
    },
    async transition(id, status, actor, note) {
      const c = await this.get(id);
      if (!TRANSITIONS[c.status]?.includes(status)) throw errors.rule(`Cannot move claim from ${c.status} to ${status}`);
      const saved = await claims.update({ ...c, status, history: [...c.history, { status, at: clock.now().toISOString(), by: actor.id, note: note || null }] });
      await audit.record({ actor: actor.id, action: 'claim.status_changed', entityType: 'claim', entityId: id, details: { from: c.status, to: status } });
      return saved;
    },
  };
}

module.exports = { createClaimsService, TRANSITIONS };
