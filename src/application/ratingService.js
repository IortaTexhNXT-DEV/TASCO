'use strict';

const crypto = require('crypto');
const { rate, ratingFacts, CORE_ONLY } = require('../domain/rating');
const { AppError, errors } = require('../shared/errors');

/**
 * Rating orchestration. TASCO core (policy administration) is the system of
 * record for premiums; which source prices a quote is set by RATING_SOURCE:
 *
 *   rules               local rule sets (sandbox/demo — the original behaviour)
 *   core                CoreRating port only; core unavailable → 503 (fail closed)
 *   core_with_fallback  CoreRating first; if core is *unavailable* (timeout, circuit
 *                       open, network/5xx) price locally and mark the quote
 *                       `indicative: true` — such a quote cannot be paid until it is
 *                       re-rated by core. Business answers from core (decline,
 *                       refer, invalid) are never overridden by a local price.
 *
 * Result: { lines, ratingSource: 'rules'|'core'|'rules_fallback', ratingVersion,
 *           coreQuoteRef, coreValidUntil, indicative }
 */

const UNAVAILABLE_MSG = 'TASCO core rating is temporarily unavailable — quotes cannot be priced right now, please retry shortly';

function isUnavailable(e) {
  return e?.code === 'UPSTREAM_UNAVAILABLE';
}

function createRatingService({ rules, gateways, config, logger, metrics }) {
  const source = config?.ratingSource || 'rules';

  function present(prod, l, extra = {}) {
    return {
      product: prod.code,
      productName: prod.name,
      productNameVi: prod.nameVi,
      startDate: l.startDate,
      endDate: l.endDate,
      termDays: l.termDays,
      premiumNet: l.premiumNet,
      vat: l.vat,
      total: l.total,
      priceRegulated: !!prod.priceRegulated,
      breakdown: l.breakdown || [],
      note: prod.priceRegulated ? 'Premium fixed by regulation — identical at every insurer.' : 'Premium per TASCO filed rates.',
      ...extra,
    };
  }

  async function rateLocally({ products, request }) {
    const lines = [];
    const versions = new Set();
    for (const { prod, options } of products) {
      if (prod.rating.method === CORE_ONLY) throw errors.rule(`${prod.code} is priced by TASCO core only — no local rating is available`);
      const rec = await rules.getRecord(prod.rating.ruleKind);
      versions.add(`${rec.kind}@${rec.version_no}`);
      lines.push(rate(prod, rec.payload, ratingFacts({ vehicle: request.vehicle, options, termYears: request.termYears, startDate: request.startDate, today: request.quoteDate })));
    }
    return { lines, ratingVersion: `rules:${[...versions].sort().join(',')}` };
  }

  async function rateWithCore({ products, request }) {
    const gw = gateways.coreRating;
    const res = await gw.exec(() => gw.port.quote({
      ...request,
      requestId: request.requestId || crypto.randomUUID(),
      lines: products.map(({ prod, options }) => ({ product: prod.code, options: options || {} })),
    }));
    const lines = products.map(({ prod }) => {
      const l = res.lines.find((x) => x.product === prod.code);
      return present(prod, l, { ratingRef: l.ratingRef || null });
    });
    return { lines, ratingVersion: res.ratingVersion, coreQuoteRef: res.coreQuoteRef, coreValidUntil: res.validUntil };
  }

  function unavailable(e) {
    return new AppError('UPSTREAM_UNAVAILABLE', UNAVAILABLE_MSG, 503, { reason: e?.reason || 'unavailable', ratingSource: source });
  }

  return {
    source,

    /**
     * @param products [{ prod (catalogue entry), options }]
     * @param request  { idempotencyKey, channel, partnerId, quoteDate, startDate, termYears, holder, vehicle }
     * @param coreOnly true when re-rating an indicative quote: core must answer, no fallback
     */
    async rate({ products, request, coreOnly = false }) {
      if (source === 'rules' && !coreOnly) {
        const r = await rateLocally({ products, request });
        return { ...r, ratingSource: 'rules', coreQuoteRef: null, coreValidUntil: null, indicative: false };
      }
      try {
        const r = await rateWithCore({ products, request });
        metrics?.inc('rating_requests_total', { source: 'core', result: 'ok' });
        return { ...r, ratingSource: 'core', indicative: false };
      } catch (e) {
        if (!isUnavailable(e)) throw e; // core answered: decline / refer / invalid stand as-is
        metrics?.inc('rating_requests_total', { source: 'core', result: 'unavailable' });
        if (source !== 'core_with_fallback' || coreOnly) {
          logger?.warn('core rating unavailable — failing closed', { reason: e.reason || 'unavailable' });
          throw unavailable(e);
        }
        logger?.warn('core rating unavailable — indicative local price issued', { reason: e.reason || 'unavailable' });
        let r;
        try {
          r = await rateLocally({ products, request });
        } catch (le) {
          // A product only core can price: report core's unavailability, not a local rule error.
          if (le.code === 'BUSINESS_RULE_VIOLATION' && products.some(({ prod }) => prod.rating.method === CORE_ONLY)) throw unavailable(e);
          throw le;
        }
        metrics?.inc('quotes_indicative_total');
        return { ...r, ratingSource: 'rules_fallback', coreQuoteRef: null, coreValidUntil: null, indicative: true, fallbackReason: e.reason || 'unavailable' };
      }
    },
  };
}

module.exports = { createRatingService, isUnavailable };
