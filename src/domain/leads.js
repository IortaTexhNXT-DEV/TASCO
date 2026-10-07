'use strict';

const { apply, truthy } = require('../rules/jsonLogic');
const { evaluate } = require('../rules/decisionTable');
const { daysBetween, addDays, fmtDate, parseDate } = require('../shared/util');

/**
 * Lead intelligence: facts → journey → explainable score → next best action →
 * personalised benefits. Pure functions over rule sets (scoring, nba, journeys,
 * benefits); nothing here hardcodes a business threshold.
 */

const METHOD_LABELS = {
  verified_certificate: 'verified certificate',
  partner_policy_record: 'partner policy record',
  customer_declared: 'customer declaration',
  inspection_cycle: 'inspection cycle',
  tag_anniversary: 'tag anniversary',
  voice_bot: 'voice bot call',
  unknown: 'no evidence',
};

/** Flatten a profile into the fact model every rule set evaluates against. */
function factsFor(profile, today, { premium = 0 } = {}) {
  const days = profile.policy.expiryDate ? daysBetween(today, profile.policy.expiryDate) : null;
  const year = parseDate(today).getUTCFullYear();
  return {
    days,
    lapsedDays: days !== null && days < 0 ? -days : 0,
    expiryConfidence: profile.policy.expiryConfidence,
    expiryMethod: profile.policy.expiryMethod,
    expiryMethodLabel: METHOD_LABELS[profile.policy.expiryMethod] || profile.policy.expiryMethod,
    insurer: profile.policy.insurer,
    tagAgeDays: profile.tagActivatedAt ? daysBetween(profile.tagActivatedAt, today) : null,
    ownerType: profile.ownerType,
    region: profile.province,
    category: profile.vehicle.category,
    seats: profile.vehicle.seats ?? (profile.vehicle.category === 'car_6_11' ? 7 : 5),
    usage: profile.vehicle.usage,
    vehicleAge: profile.vehicle.firstRegisteredYear ? year - profile.vehicle.firstRegisteredYear : null,
    hasPhone: !!profile.phone,
    channels: profile.channels,
    consent: profile.consent,
    premium,
    ...profile.engagement,
  };
}

function assignJourney(journeysRules, facts) {
  const sorted = [...journeysRules.journeys].sort((a, b) => a.priority - b.priority);
  for (const j of sorted) if (truthy(apply(j.audience, facts))) return j;
  return null;
}

function score(scoringRules, facts) {
  let total = 0;
  const reasons = [];
  for (const f of scoringRules.factors) {
    const v = Math.max(0, Math.min(1, Number(apply(f.value, facts)) || 0));
    const pts = f.weight * v;
    total += pts;
    reasons.push({ factor: f.key, label: f.label, points: +pts.toFixed(1), max: f.weight, why: String(apply(f.reason, facts) || '').trim() });
  }
  const d = scoringRules.damping;
  total *= d.base + d.byExpiryConfidence * (facts.expiryConfidence || 0);
  if (scoringRules.zeroWhen && truthy(apply(scoringRules.zeroWhen, facts))) total = 0;
  const s = Math.round(total);
  const tier = s >= scoringRules.tiers.hot ? 'hot' : s >= scoringRules.tiers.warm ? 'warm' : 'nurture';
  return { score: s, tier, reasons: reasons.sort((a, b) => b.points - a.points) };
}

function benefitsFor(benefitRules, facts, { audience = 'customer', limit } = {}) {
  return benefitRules.items
    .filter((b) => !b.eligible || truthy(apply(b.eligible, facts)))
    .filter((b) => audience !== 'customer' || b.legalStatus === 'approved')
    .map((b) => ({
      id: b.id, type: b.type, product: b.product || null, provider: b.provider, legalStatus: b.legalStatus,
      title: b.title, titleVi: b.titleVi, desc: b.desc, descVi: b.descVi,
      relevance: +Number(apply(b.relevance, facts)).toFixed(2),
      why: String(apply(b.why, facts)),
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit ?? benefitRules.maxShown);
}

/**
 * Full lead evaluation for one profile.
 * @param rules { scoring, nba, journeys, benefits }
 */
function evaluateLead(rules, profile, today, premium) {
  const facts = factsFor(profile, today, { premium });
  const journey = assignJourney(rules.journeys, facts);
  facts.journey = journey?.id || null;
  const s = score(rules.scoring, facts);
  facts.tier = s.tier;
  facts.score = s.score;
  const nba = evaluate(rules.nba, facts);
  return {
    id: profile.id,
    profileId: profile.id,
    plate: profile.plate,
    region: profile.province,
    journey: journey?.id || null,
    objective: journey?.objective || null,
    score: s.score,
    tier: s.tier,
    reasons: s.reasons,
    daysToExpiry: facts.days,
    premium,
    nextBestAction: nba,
    benefits: benefitsFor(rules.benefits, facts),
    evaluatedAt: today,
  };
}

/**
 * Plan touchpoints for a lead from its journey definition.
 * Only steps due within [today - catchUpDays, ∞) are planned; earlier steps are skipped.
 */
function planTouchpoints(journeysRules, lead, profile, today) {
  const journey = journeysRules.journeys.find((j) => j.id === lead.journey);
  if (!journey) return [];
  let anchor;
  if (journey.anchor === 'expiry') anchor = profile.policy.expiryDate;
  else if (journey.anchor === 'tagActivatedAt') anchor = profile.tagActivatedAt;
  else anchor = today;
  if (!anchor) return [];
  const floor = addDays(today, -journeysRules.catchUpDays);
  return journey.steps
    .filter((s) => !s.onlyTiers || s.onlyTiers.includes(lead.tier))
    .map((s) => ({ ...s, dueDate: fmtDate(addDays(anchor, s.offset)) }))
    .filter((s) => parseDate(s.dueDate) >= floor)
    .map((s) => ({
      id: `${profile.id}:${journey.id}:${s.step}:${s.dueDate}`,
      profileId: profile.id,
      journey: journey.id,
      step: s.step,
      dueDate: s.dueDate,
      channels: s.channels,
      channel: null,
      marketing: !!s.marketing,
      template: s.template || null,
      status: 'scheduled',
    }));
}

module.exports = { factsFor, assignJourney, score, benefitsFor, evaluateLead, planTouchpoints, METHOD_LABELS };
