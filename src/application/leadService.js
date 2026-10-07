'use strict';

const { evaluateLead, planTouchpoints, factsFor, benefitsFor } = require('../domain/leads');
const { rate, coverStartDate } = require('../domain/rating');
const { errors } = require('../shared/errors');

/**
 * Lead scoring, journey assignment and touchpoint planning.
 */

function createLeadService({ store, rules, audit, clock, logger }) {
  const profiles = store.collection('profiles');
  const leads = store.collection('leads');
  const touchpoints = store.collection('touchpoints');
  const policies = store.collection('policies');

  async function leadRules() {
    const [scoring, nba, journeys, benefits, products, tariff] = await Promise.all([
      rules.get('scoring'), rules.get('nba'), rules.get('journeys'), rules.get('benefits'), rules.get('products'), rules.get('tariff.tnds_car'),
    ]);
    return { scoring, nba, journeys, benefits, products, tariff };
  }

  function tndsPremium(r, profile, today) {
    const product = r.products.products.find((p) => p.code === 'TNDS_CAR');
    try {
      return rate(product, r.tariff, { category: profile.vehicle.category, startDate: coverStartDate(profile.policy.expiryDate, today) }).total;
    } catch {
      return 0;
    }
  }

  async function hasActiveTascoCover(profileId, today) {
    const active = await policies.find({ where: { profile_id: profileId, status: 'active', end_date: { gt: today } }, limit: 5 });
    return active.some((p) => p.product.startsWith('TNDS'));
  }

  async function recomputeOne(r, profile, today) {
    const premium = tndsPremium(r, profile, today);
    const lead = evaluateLead(r, profile, today, premium);
    if (await hasActiveTascoCover(profile.id, today)) {
      lead.journey = null;
      lead.nextBestAction = { action: 'insured', label: 'Insured with TASCO — no action', reason: 'active TASCO policy', ruleId: 'insured' };
    }
    const prev = await leads.get(profile.id);
    await leads.upsert(lead);
    if (!prev || prev.journey !== lead.journey || prev.tier !== lead.tier) {
      await touchpoints.deleteWhere({ profile_id: profile.id, status: 'scheduled' });
      if (lead.journey && lead.nextBestAction.action !== 'suppress') {
        for (const tp of planTouchpoints(r.journeys, lead, profile, today)) {
          const existing = await touchpoints.get(tp.id);
          if (!existing) await touchpoints.insert(tp);
        }
      }
    }
    return lead;
  }

  const service = {
    leadRules,
    tndsPremium,

    async recompute(profileIds, { actor = 'system' } = {}) {
      const r = await leadRules();
      const today = clock.today();
      let n = 0;
      if (profileIds) {
        for (const id of profileIds) {
          const p = await profiles.get(id);
          if (p && !p.anonymised) { await recomputeOne(r, p, today); n++; }
        }
      } else {
        const PAGE = 1000;
        for (let offset = 0; ; offset += PAGE) {
          const page = await profiles.find({ limit: PAGE, offset, orderBy: ['id', 'asc'] });
          for (const p of page) if (!p.anonymised) { await recomputeOne(r, p, today); n++; }
          if (page.length < PAGE) break;
        }
      }
      await audit.record({ actor, action: 'leads.recomputed', entityType: 'leads', details: { count: n, scope: profileIds ? 'partial' : 'all' } });
      logger?.info('leads recomputed', { count: n });
      return { recomputed: n };
    },

    async list({ tier, journey, action, region, maxDays, minScore, limit = 50, offset = 0, sort = 'score' }) {
      const where = {};
      if (tier) where.tier = tier;
      if (journey) where.journey = journey;
      if (action) where.action = action;
      if (region) where.region = region;
      if (maxDays !== undefined || minScore !== undefined) {
        if (maxDays !== undefined) where.days_to_expiry = { lte: maxDays };
        if (minScore !== undefined) where.score = { gte: minScore };
      }
      const orderBy = sort === 'expiry' ? ['days_to_expiry', 'asc'] : ['score', 'desc'];
      const [items, total] = await Promise.all([leads.find({ where, orderBy, limit, offset }), leads.count(where)]);
      return { items, total, limit, offset };
    },

    async get(id) {
      const lead = await leads.get(id);
      if (!lead) throw errors.notFound('Lead');
      return lead;
    },

    /** Staff view of benefits incl. items pending legal review (flagged). */
    async benefitsForStaff(profile) {
      const r = await leadRules();
      return benefitsFor(r.benefits, factsFor(profile, clock.today()), { audience: 'staff', limit: 20 });
    },

    recomputeOne: async (profile) => recomputeOne(await leadRules(), profile, clock.today()),
  };
  return service;
}

module.exports = { createLeadService };
