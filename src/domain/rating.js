'use strict';

const { parseDate, fmtDate, daysBetween, addDays } = require('../shared/util');
const { evaluate } = require('../rules/decisionTable');
const { errors } = require('../shared/errors');

/**
 * Product rating. The rating *method* is code (three generic methods); every
 * rate, tariff, limit and tax comes from rule sets, so new products and rate
 * changes are configuration.
 *
 * Quotes for price-regulated products carry no discount field at all.
 */

function termEnd(startDate, termYears) {
  const s = parseDate(startDate);
  return new Date(Date.UTC(s.getUTCFullYear() + termYears, s.getUTCMonth(), s.getUTCDate()));
}

const METHODS = {
  /** Regulated tariff table (TNDS): annual premium by category, pro-rata by days. */
  tariff_table(rules, { category, startDate, termYears = 1 }) {
    const cat = rules.categories[category];
    if (!cat) throw errors.validation(`Unknown vehicle category ${category}`);
    const years = Math.max(rules.minTermYears, Math.min(rules.maxTermYears, Math.floor(termYears)));
    const end = termEnd(startDate, years);
    const days = daysBetween(startDate, end);
    const net = Math.round((cat.annual * days) / 365);
    return {
      net, vatRate: rules.vatRate, endDate: fmtDate(end), termDays: days,
      breakdown: [{ label: cat.label, labelVi: cat.labelVi, annual: cat.annual, years }],
    };
  },

  /** Voluntary physical damage: rate on sum insured from a decision table. */
  rate_on_sum_insured(rules, { sumInsured, vehicleAge = 0, usage = 'personal', deductible = 0, startDate }) {
    if (!Number.isFinite(sumInsured) || sumInsured <= 0) throw errors.validation('sumInsured must be positive');
    if (sumInsured > rules.maxSumInsured) throw errors.rule('Sum insured exceeds the online limit — refer to underwriter');
    if (!rules.deductibleOptions.includes(deductible)) throw errors.validation('Unsupported deductible');
    const { rate, ruleId } = evaluate(rules.rateTable, { vehicleAge, usage });
    const relief = rules.deductibleRelief[String(deductible)] || 0;
    const net = Math.max(rules.minPremium, Math.round(sumInsured * rate * (1 - relief)));
    const end = termEnd(startDate, 1);
    return {
      net, vatRate: rules.vatRate, endDate: fmtDate(end), termDays: daysBetween(startDate, end),
      breakdown: [{ label: 'Physical damage', rate, rateRule: ruleId, sumInsured, deductible, deductibleRelief: relief }],
    };
  },

  /** Personal accident per seat. */
  per_seat(rules, { seats, sumInsuredPerSeat, startDate }) {
    if (!Number.isInteger(seats) || seats < 1 || seats > 60) throw errors.validation('seats must be 1..60');
    if (!rules.sumInsuredOptions.includes(sumInsuredPerSeat)) throw errors.validation('Unsupported sum insured per seat');
    const net = Math.round(seats * sumInsuredPerSeat * rules.ratePerSeat);
    const end = termEnd(startDate, 1);
    return {
      net, vatRate: rules.vatExempt ? 0 : (rules.vatRate || 0), endDate: fmtDate(end), termDays: daysBetween(startDate, end),
      breakdown: [{ label: 'Personal accident', seats, sumInsuredPerSeat, ratePerSeat: rules.ratePerSeat }],
    };
  },
};

/**
 * @param product product definition (from `products` rule set)
 * @param rules   rate rule payload for that product
 * @param input   rating facts
 */
function rate(product, rules, input) {
  if (product.status !== 'active') throw errors.rule(`Product ${product.code} is not on sale`);
  const method = METHODS[product.rating.method];
  if (!method) throw errors.rule(`No rating method ${product.rating.method}`);
  const r = method(rules, input);
  const vat = Math.round(r.net * r.vatRate);
  return {
    product: product.code,
    productName: product.name,
    productNameVi: product.nameVi,
    startDate: input.startDate,
    endDate: r.endDate,
    termDays: r.termDays,
    premiumNet: r.net,
    vat,
    total: r.net + vat,
    priceRegulated: !!product.priceRegulated,
    breakdown: r.breakdown,
    note: product.priceRegulated ? 'Premium fixed by regulation — identical at every insurer.' : 'Premium per TASCO filed rates.',
  };
}

/** Cover starts the day after current cover ends, or today when lapsed / unknown. */
function coverStartDate(expiryDate, today) {
  if (!expiryDate) return fmtDate(parseDate(today));
  const next = addDays(expiryDate, 1);
  return next < parseDate(today) ? fmtDate(parseDate(today)) : fmtDate(next);
}

function commissionFor(commissionRules, { product, partnerType, premiumNet }) {
  const { rate: r, ruleId } = evaluate(commissionRules.table, { product, partnerType });
  const cap = commissionRules.statutoryCaps[product] ?? 0;
  const applied = Math.min(r, cap);
  return { rate: applied, amount: Math.round(premiumNet * applied), ruleId, capped: r > cap };
}

module.exports = { rate, coverStartDate, commissionFor, METHODS };
