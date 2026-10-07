'use strict';

const crypto = require('crypto');
const { rate, ratingFacts, CORE_ONLY } = require('../../domain/rating');
const { errors } = require('../../shared/errors');

/**
 * Sandbox / UAT stand-in for TASCO core rating and product catalogue. Implements
 * the same CoreRating and ProductCatalogue ports as tascoCoreRatingClient.js by
 * delegating to the platform's local rule sets, so premiums are identical to
 * RATING_SOURCE=rules, but the response looks like core's: a `coreQuoteRef`
 * (idempotent per Idempotency-Key), a `ratingVersion` and a validity window.
 */
function createSimulatedTascoCore({ rules, clock, validityHours = 72 }) {
  const issued = new Map(); // idempotencyKey → response (core-side idempotency)

  async function productDef(code) {
    const cat = await rules.get('products');
    const p = cat.products.find((x) => x.code === code);
    if (!p) throw errors.rule(`Product ${code} is not available in TASCO core`);
    return p;
  }

  return {
    name: 'tasco-core-simulated',
    mode: 'simulated',
    endpoint: null,

    async quote(req) {
      if (req.idempotencyKey && issued.has(req.idempotencyKey)) return issued.get(req.idempotencyKey);
      const today = req.quoteDate || clock.today();
      const lines = [];
      const versions = new Set();
      for (const l of req.lines) {
        const prod = await productDef(l.product);
        if (prod.rating.method === CORE_ONLY) throw errors.rule(`Product ${prod.code} has no simulated rates`);
        const rec = await rules.getRecord(prod.rating.ruleKind);
        versions.add(`${rec.kind}@${rec.version_no}`);
        const r = rate(prod, rec.payload, ratingFacts({ vehicle: req.vehicle, options: l.options, termYears: req.termYears, startDate: req.startDate, today }));
        lines.push({
          product: r.product, premiumNet: r.premiumNet, vat: r.vat, total: r.total, startDate: r.startDate, endDate: r.endDate, termDays: r.termDays,
          ratingRef: `SIMCORE-L-${crypto.randomUUID().slice(0, 8)}`, breakdown: r.breakdown,
        });
      }
      const res = {
        coreQuoteRef: `SIMCORE-Q-${crypto.randomUUID().slice(0, 12)}`,
        ratingVersion: `simcore:${[...versions].sort().join(',')}`,
        validUntil: new Date(clock.now().getTime() + validityHours * 3600000).toISOString(),
        lines,
      };
      if (req.idempotencyKey) issued.set(req.idempotencyKey, res);
      return res;
    },

    async fetchCatalogue() {
      const rec = await rules.getRecord('products');
      return {
        catalogueVersion: `SIMCORE-CAT-${rec.version_no}`,
        publishedAt: rec.activatedAt || rec.createdAt,
        products: rec.payload.products.map((p) => ({
          code: p.code,
          version: p.coreVersion || `${p.code}-v1`,
          name: p.name,
          nameVi: p.nameVi,
          line: p.line,
          compulsory: !!p.compulsory,
          priceRegulated: !!p.priceRegulated,
          requiresInspection: !!p.requiresInspection,
          status: ['active', 'inactive', 'withdrawn'].includes(p.status) ? p.status : 'inactive',
          ratingMethod: p.rating?.method,
        })),
      };
    },
  };
}

module.exports = { createSimulatedTascoCore };
