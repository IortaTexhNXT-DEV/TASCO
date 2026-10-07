'use strict';

const { apply, validate, truthy, template } = require('./jsonLogic');

/**
 * Decision tables: an ordered list of `{ id, when, then }` rows evaluated with a
 * hit policy. `when` is JSON Logic; string values in `then` may contain
 * `{{path}}` templates resolved against the input facts.
 *
 *   hitPolicy "first"   – first matching row wins (default)
 *   hitPolicy "collect" – every matching row, in order
 */

function renderOutput(then, facts) {
  if (typeof then === 'string') return template(then, facts);
  if (Array.isArray(then)) return then.map((t) => renderOutput(t, facts));
  if (then && typeof then === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(then)) out[k] = renderOutput(v, facts);
    return out;
  }
  return then;
}

function evaluate(table, facts) {
  const policy = table.hitPolicy || 'first';
  const hits = [];
  for (const row of table.rules) {
    const matched = row.when === undefined || truthy(apply(row.when, facts));
    if (!matched) continue;
    const out = { ...renderOutput(row.then, facts), ruleId: row.id };
    if (policy === 'first') return out;
    hits.push(out);
  }
  if (policy === 'collect') return hits;
  return table.default ? { ...renderOutput(table.default, facts), ruleId: 'default' } : null;
}

function validateTable(table, path = '$') {
  const errors = [];
  if (!table || !Array.isArray(table.rules)) return [`${path}: decision table needs a "rules" array`];
  if (table.hitPolicy && !['first', 'collect'].includes(table.hitPolicy)) errors.push(`${path}: unknown hitPolicy`);
  const ids = new Set();
  table.rules.forEach((r, i) => {
    if (!r.id) errors.push(`${path}.rules[${i}]: missing id`);
    if (ids.has(r.id)) errors.push(`${path}.rules[${i}]: duplicate id ${r.id}`);
    ids.add(r.id);
    if (r.then === undefined) errors.push(`${path}.rules[${i}]: missing then`);
    if (r.when !== undefined) errors.push(...validate(r.when, `${path}.rules[${i}].when`));
  });
  return errors;
}

module.exports = { evaluate, validateTable };
