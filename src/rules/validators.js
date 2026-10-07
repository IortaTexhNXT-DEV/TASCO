'use strict';

const { validate: validateLogic } = require('./jsonLogic');
const { validateTable } = require('./decisionTable');
const { stripDiacritics } = require('../shared/util');

/**
 * Per-kind validation of rule payloads. A rule set that fails validation can
 * never be saved, so production only ever runs well-formed rules.
 */

const LOGIC_KEYS = new Set(['when', 'value', 'reason', 'relevance', 'eligible', 'why', 'audience', 'allow', 'zeroWhen']);

/** Walk any payload and validate every embedded JSON Logic expression and decision table. */
function walk(node, path, errors) {
  if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${path}[${i}]`, errors)); return; }
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.rules) && (node.hitPolicy || node.default !== undefined)) errors.push(...validateTable(node, path));
  for (const [k, v] of Object.entries(node)) {
    if (LOGIC_KEYS.has(k) && v && typeof v === 'object') errors.push(...validateLogic(v, `${path}.${k}`));
    else walk(v, `${path}.${k}`, errors);
  }
}

function copyViolations(text, banned) {
  const raw = String(text || '').toLowerCase();
  const plain = stripDiacritics(text);
  return banned.filter((p) => raw.includes(p.toLowerCase()) || plain.includes(stripDiacritics(p)));
}

/** Collect every customer-facing string in a content payload. */
function customerStrings(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => customerStrings(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (['intents', 'relevance', 'eligible', 'id', 'legalStatus', 'type', 'provider', 'product'].includes(k)) continue;
      customerStrings(v, out);
    }
  }
  return out;
}

const SPECIFIC = {
  nba: (p, e) => e.push(...validateTable(p)),
  products: (p, e) => {
    if (!Array.isArray(p.products) || !p.products.length) e.push('products[] required');
    const codes = new Set();
    for (const prod of p.products || []) {
      if (!prod.code || !/^[A-Z][A-Z0-9_]{1,40}$/.test(prod.code)) e.push(`bad product code ${prod.code}`);
      if (codes.has(prod.code)) e.push(`duplicate product ${prod.code}`);
      codes.add(prod.code);
      if (!['tariff_table', 'rate_on_sum_insured', 'per_seat'].includes(prod.rating?.method)) e.push(`${prod.code}: unknown rating method`);
    }
    for (const b of p.bundles || []) for (const c of b.products) if (!codes.has(c)) e.push(`bundle ${b.code} references unknown product ${c}`);
  },
  tariff: (p, e) => {
    if (typeof p.vatRate !== 'number' || p.vatRate < 0 || p.vatRate > 0.2) e.push('vatRate must be 0..0.2');
    const cats = Object.entries(p.categories || {});
    if (!cats.length) e.push('categories required');
    for (const [k, c] of cats) if (!Number.isInteger(c.annual) || c.annual <= 0) e.push(`category ${k}: annual must be a positive integer`);
  },
  scoring: (p, e) => {
    if (!(p.tiers?.hot > p.tiers?.warm)) e.push('tiers.hot must be greater than tiers.warm');
    const total = (p.factors || []).reduce((s, f) => s + (f.weight || 0), 0);
    if (Math.abs(total - 100) > 0.001) e.push(`factor weights must sum to 100 (got ${total})`);
  },
  journeys: (p, e) => {
    const ids = new Set();
    for (const j of p.journeys || []) {
      if (ids.has(j.id)) e.push(`duplicate journey ${j.id}`);
      ids.add(j.id);
      if (!['expiry', 'today', 'tagActivatedAt'].includes(j.anchor)) e.push(`journey ${j.id}: bad anchor`);
      for (const s of j.steps || []) if (!Array.isArray(s.channels) || !s.channels.length) e.push(`journey ${j.id} step ${s.step}: channels required`);
    }
  },
  contact_policy: (p, e) => {
    const w = p.contactWindow || {};
    if (!(w.startHour >= 0 && w.endHour <= 24 && w.startHour < w.endHour)) e.push('contactWindow invalid');
  },
  commission: (p, e) => {
    for (const r of p.table?.rules || []) {
      const prodMatch = JSON.stringify(r.when || {});
      for (const [prod, cap] of Object.entries(p.statutoryCaps || {})) {
        if (prodMatch.includes(`"${prod}"`) && r.then.rate > cap) e.push(`rule ${r.id}: rate ${r.then.rate} exceeds statutory cap ${cap} for ${prod}`);
      }
    }
  },
};

function kindFamily(kind) {
  if (kind.startsWith('tariff.')) return 'tariff';
  return kind;
}

/**
 * @param kind rule kind
 * @param payload rule payload
 * @param ctx { bannedPhrases } – current copy guard, applied to content kinds
 */
function validatePayload(kind, payload, ctx = {}) {
  const errors = [];
  if (!kind || !/^[a-z_]+(\.[a-z_]+)?$/.test(kind)) errors.push('invalid kind');
  if (!payload || typeof payload !== 'object') return ['payload must be an object'];
  walk(payload, '$', errors);
  SPECIFIC[kindFamily(kind)]?.(payload, errors);
  if ((kind.startsWith('content.') || kind === 'benefits') && ctx.bannedPhrases?.length) {
    for (const s of customerStrings(kind === 'content.voicebot' ? payload.lines : payload)) {
      const v = copyViolations(s, ctx.bannedPhrases);
      if (v.length) errors.push(`copy guard: "${v.join('", "')}" in "${s.slice(0, 60)}…"`);
    }
  }
  return errors;
}

module.exports = { validatePayload, copyViolations };
