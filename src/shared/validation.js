'use strict';

const { errors } = require('./errors');

/**
 * Minimal declarative input validation (allow-list). Unknown properties are
 * rejected, strings are length-bounded, so every API input is validated before
 * it reaches a use case (OWASP ASVS V5).
 *
 * Schema: { field: { type, required, min, max, enum, pattern, items, schema } }
 */

function check(value, rule, path, problems) {
  if (value === undefined || value === null) {
    if (rule.required) problems.push(`${path} is required`);
    return value;
  }
  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') { problems.push(`${path} must be a string`); return value; }
      const max = rule.max ?? 1000;
      if (value.length > max) problems.push(`${path} must be at most ${max} characters`);
      if (rule.min && value.length < rule.min) problems.push(`${path} must be at least ${rule.min} characters`);
      if (rule.pattern && !rule.pattern.test(value)) problems.push(`${path} has an invalid format`);
      if (rule.enum && !rule.enum.includes(value)) problems.push(`${path} must be one of ${rule.enum.join(', ')}`);
      return value;
    }
    case 'integer':
    case 'number': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || Number.isNaN(n) || (rule.type === 'integer' && !Number.isInteger(n))) { problems.push(`${path} must be a ${rule.type}`); return value; }
      if (rule.min !== undefined && n < rule.min) problems.push(`${path} must be ≥ ${rule.min}`);
      if (rule.max !== undefined && n > rule.max) problems.push(`${path} must be ≤ ${rule.max}`);
      if (rule.enum && !rule.enum.includes(n)) problems.push(`${path} must be one of ${rule.enum.join(', ')}`);
      return n;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 'false') return value === 'true';
      problems.push(`${path} must be a boolean`);
      return value;
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) problems.push(`${path} must be a date YYYY-MM-DD`);
      return value;
    case 'array': {
      if (!Array.isArray(value)) { problems.push(`${path} must be an array`); return value; }
      if (rule.max !== undefined && value.length > rule.max) problems.push(`${path} must have at most ${rule.max} items`);
      return rule.items ? value.map((v, i) => check(v, rule.items, `${path}[${i}]`, problems)) : value;
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) { problems.push(`${path} must be an object`); return value; }
      if (!rule.schema) return value; // free-form (e.g. rule payloads, validated by their own validator)
      return validateObject(value, rule.schema, path, problems);
    }
    default:
      throw new Error(`unknown rule type ${rule.type}`);
  }
}

function validateObject(obj, schema, path, problems) {
  const out = {};
  for (const key of Object.keys(obj)) {
    if (!schema[key]) problems.push(`${path ? `${path}.` : ''}${key} is not allowed`);
  }
  for (const [key, rule] of Object.entries(schema)) {
    const v = check(obj[key], rule, path ? `${path}.${key}` : key, problems);
    if (v !== undefined) out[key] = v;
    else if (rule.default !== undefined) out[key] = rule.default;
  }
  return out;
}

function validate(input, schema) {
  const problems = [];
  const value = validateObject(input || {}, schema, '', problems);
  if (problems.length) throw errors.validation('Request validation failed', problems);
  return value;
}

module.exports = { validate };
