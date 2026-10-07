'use strict';

/**
 * Safe JSON Logic evaluator (subset of https://jsonlogic.com).
 *
 * Business rules are stored as data, never as code: no `eval`, no `Function`,
 * no prototype access. Supported operators are listed in OPS; anything else is
 * rejected at validation time so a bad rule can never reach production.
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function getVar(data, path, fallback) {
  if (path === '' || path === null || path === undefined) return data;
  const parts = String(path).split('.');
  let cur = data;
  for (const p of parts) {
    if (FORBIDDEN_KEYS.has(p)) throw new Error(`forbidden path segment: ${p}`);
    if (cur === null || cur === undefined || !Object.prototype.hasOwnProperty.call(Object(cur), p)) return fallback ?? null;
    cur = cur[p];
  }
  return cur === undefined ? (fallback ?? null) : cur;
}

const num = (x) => (x === null || x === undefined || x === '' ? 0 : Number(x));

const OPS = {
  var: (args, data) => {
    const [path, fallback] = Array.isArray(args) ? args : [args];
    return getVar(data, path, fallback);
  },
  missing: (args, data) => args.filter((p) => { const v = getVar(data, p); return v === null || v === ''; }),
  '==': ([a, b]) => a == b, // eslint-disable-line eqeqeq
  '===': ([a, b]) => a === b,
  '!=': ([a, b]) => a != b, // eslint-disable-line eqeqeq
  '!==': ([a, b]) => a !== b,
  '<': (a) => (a.length === 3 ? a[0] < a[1] && a[1] < a[2] : a[0] < a[1]),
  '<=': (a) => (a.length === 3 ? a[0] <= a[1] && a[1] <= a[2] : a[0] <= a[1]),
  '>': ([a, b]) => a > b,
  '>=': ([a, b]) => a >= b,
  '!': ([a]) => !truthy(a),
  '!!': ([a]) => truthy(a),
  '+': (a) => a.reduce((s, x) => s + num(x), 0),
  '-': (a) => (a.length === 1 ? -num(a[0]) : num(a[0]) - num(a[1])),
  '*': (a) => a.reduce((s, x) => s * num(x), 1),
  '/': ([a, b]) => (num(b) === 0 ? 0 : num(a) / num(b)),
  '%': ([a, b]) => num(a) % num(b),
  min: (a) => Math.min(...a.map(num)),
  max: (a) => Math.max(...a.map(num)),
  clamp: ([x, lo, hi]) => Math.max(num(lo), Math.min(num(hi), num(x))),
  round: ([x, d = 0]) => { const f = 10 ** d; return Math.round(num(x) * f) / f; },
  in: ([a, b]) => (Array.isArray(b) ? b.includes(a) : String(b ?? '').includes(String(a))),
  cat: (a) => a.map((x) => (x === null || x === undefined ? '' : String(x))).join(''),
};

// Lazily-evaluated operators (short-circuit).
const LAZY = {
  and: (args, data) => { let r = true; for (const a of args) { r = apply(a, data); if (!truthy(r)) return r; } return r; },
  or: (args, data) => { let r = false; for (const a of args) { r = apply(a, data); if (truthy(r)) return r; } return r; },
  if: (args, data) => {
    let i = 0;
    for (; i < args.length - 1; i += 2) if (truthy(apply(args[i], data))) return apply(args[i + 1], data);
    return i < args.length ? apply(args[i], data) : null;
  },
};

function truthy(v) {
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
}

function isRule(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 1;
}

function apply(rule, data = {}) {
  if (Array.isArray(rule)) return rule.map((r) => apply(r, data));
  if (!isRule(rule)) return rule;
  const op = Object.keys(rule)[0];
  let args = rule[op];
  if (!Array.isArray(args)) args = [args];
  if (LAZY[op]) return LAZY[op](args, data);
  const fn = OPS[op];
  if (!fn) throw new Error(`unsupported operator: ${op}`);
  if (op === 'var') return fn(args.map((a) => apply(a, data)), data);
  return fn(args.map((a) => apply(a, data)), data);
}

/** Validate a rule tree. Returns list of errors (empty when valid). */
function validate(rule, path = '$') {
  const errors = [];
  if (Array.isArray(rule)) {
    rule.forEach((r, i) => errors.push(...validate(r, `${path}[${i}]`)));
    return errors;
  }
  if (rule === null || typeof rule !== 'object') return errors;
  const keys = Object.keys(rule);
  if (keys.length !== 1) return [`${path}: rule object must have exactly one operator`];
  const op = keys[0];
  if (FORBIDDEN_KEYS.has(op)) return [`${path}: forbidden operator ${op}`];
  if (!OPS[op] && !LAZY[op]) return [`${path}: unsupported operator "${op}"`];
  const args = Array.isArray(rule[op]) ? rule[op] : [rule[op]];
  if (op === 'var' && typeof args[0] === 'string' && args[0].split('.').some((p) => FORBIDDEN_KEYS.has(p))) {
    errors.push(`${path}: forbidden var path`);
  }
  args.forEach((a, i) => errors.push(...validate(a, `${path}.${op}[${i}]`)));
  return errors;
}

/** Render "{{path}}" placeholders from data (used for reason/explanation templates). */
function template(str, data) {
  return String(str).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => {
    const v = getVar(data, p);
    return v === null || v === undefined ? '' : String(v);
  });
}

module.exports = { apply, validate, truthy, template, OPERATORS: [...Object.keys(OPS), ...Object.keys(LAZY)] };
