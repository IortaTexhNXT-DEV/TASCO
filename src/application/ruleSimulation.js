'use strict';

const { evaluateLead } = require('../domain/leads');
const { errors } = require('../shared/errors');

/**
 * Rules studio support: governance context, a PII-free customer picker for simulations and an
 * aggregate "what would this change do" simulation over a deterministic sample of customers.
 * Used by rule authors and approvers, who do not hold customer-data permissions — so nothing here
 * returns names, phones or other personal data (plate, region and lead outcome only).
 */

const SIMULATABLE = ['scoring', 'nba', 'journeys', 'benefits'];
const TIERS = ['hot', 'warm', 'nurture'];

const outcome = (l) => ({ score: l.score, tier: l.tier, action: l.nextBestAction?.action || null, journey: l.journey || null });

function createRuleSimulation(c) {
  const profiles = c.store.collection('profiles');
  const leads = c.store.collection('leads');

  async function payloadErrors(kind, payload) {
    const errs = await c.services.rules.validate(kind, payload);
    if (errs.length) throw errors.validation('Rule set is invalid', errs);
  }

  return {
    /** Governance facts the studio needs: rating source (core-owned tariffs) and restricted rule kinds. */
    async context() {
      return {
        ratingSource: c.config.ratingSource,
        restrictedKinds: c.rbac?.restrictedRuleKinds || {},
        simulatable: SIMULATABLE,
      };
    },

    /** Customers to simulate against: plate prefix search, or a spread across tiers when q is empty. */
    async sampleCustomers({ q, limit = 8 } = {}) {
      const compact = String(q || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      let rows = [];
      if (compact) {
        if (compact.length < 3) return { items: [], total: 0 };
        const found = await profiles.find({ where: { id: { gte: compact, lt: `${compact}￿` } }, orderBy: ['id', 'asc'], limit: limit * 2 });
        for (const p of found) {
          if (p.anonymised) continue;
          rows.push({ profile: p, lead: await leads.get(p.id) });
          if (rows.length >= limit) break;
        }
      } else {
        const per = Math.max(1, Math.ceil(limit / TIERS.length));
        for (const tier of TIERS) {
          const ls = await leads.find({ where: { tier }, orderBy: ['score', 'desc'], limit: per });
          for (const l of ls) rows.push({ profile: { id: l.id, plate: l.plate, province: l.region }, lead: l });
        }
        rows = rows.slice(0, limit);
      }
      return {
        items: rows.map(({ profile, lead }) => ({
          id: profile.id, plate: profile.plate || profile.id, region: profile.province || lead?.region || null,
          tier: lead?.tier || null, score: lead?.score ?? null, journey: lead?.journey || null, action: lead?.nextBestAction?.action || null,
        })),
        total: rows.length,
      };
    },

    /**
     * Run the current and the candidate rules over a deterministic sample (customers spread across
     * tiers, ordered by id) and summarise tier, next-best-action and journey movements.
     */
    async simulateSample({ kind, payload, size = 60 }) {
      if (!SIMULATABLE.includes(kind)) throw errors.validation('Simulation is not available for this rule type', [`kind must be one of ${SIMULATABLE.join(', ')}`]);
      await payloadErrors(kind, payload);
      const r = await c.services.leads.leadRules();
      const candidateRules = { ...r, [kind]: payload };
      const today = c.clock.today();
      const per = Math.max(1, Math.ceil(size / TIERS.length));
      const ids = [];
      for (const tier of TIERS) {
        const ls = await leads.find({ where: { tier }, orderBy: ['id', 'asc'], limit: per });
        ids.push(...ls.map((l) => l.id));
      }
      const tally = (map, from, to) => { const k = `${from ?? ''}→${to ?? ''}`; map.set(k, { from: from ?? null, to: to ?? null, count: (map.get(k)?.count || 0) + 1 }); };
      const tierMoves = new Map();
      const actionMoves = new Map();
      const journeyMoves = new Map();
      const before = { hot: 0, warm: 0, nurture: 0 };
      const after = { hot: 0, warm: 0, nurture: 0 };
      const examples = [];
      let n = 0; let sumBefore = 0; let sumAfter = 0; let changed = 0;
      for (const id of ids.slice(0, size)) {
        const p = await profiles.get(id);
        if (!p || p.anonymised) continue;
        const premium = c.services.leads.tndsPremium(r, p, today);
        const cur = outcome(evaluateLead(r, p, today, premium));
        const cand = outcome(evaluateLead(candidateRules, p, today, premium));
        n++;
        sumBefore += cur.score; sumAfter += cand.score;
        before[cur.tier] = (before[cur.tier] || 0) + 1;
        after[cand.tier] = (after[cand.tier] || 0) + 1;
        const diff = cur.tier !== cand.tier || cur.action !== cand.action || cur.journey !== cand.journey || cur.score !== cand.score;
        if (cur.tier !== cand.tier) tally(tierMoves, cur.tier, cand.tier);
        if (cur.action !== cand.action) tally(actionMoves, cur.action, cand.action);
        if (cur.journey !== cand.journey) tally(journeyMoves, cur.journey, cand.journey);
        if (diff) {
          changed++;
          if (examples.length < 8 && (cur.tier !== cand.tier || cur.action !== cand.action || cur.journey !== cand.journey)) examples.push({ id: p.id, plate: p.plate, before: cur, after: cand });
        }
      }
      const sorted = (m) => [...m.values()].sort((a, b) => b.count - a.count);
      return {
        kind,
        sampleSize: n,
        changedCustomers: changed,
        averageScore: { before: n ? +(sumBefore / n).toFixed(1) : null, after: n ? +(sumAfter / n).toFixed(1) : null },
        tiers: { before, after },
        tierMoves: sorted(tierMoves),
        actionChanges: sorted(actionMoves),
        journeyChanges: sorted(journeyMoves),
        examples,
      };
    },
  };
}

module.exports = { createRuleSimulation, SIMULATABLE };
