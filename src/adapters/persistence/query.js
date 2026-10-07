'use strict';

/**
 * Shared filter semantics for all store adapters.
 * where: { column: value | { in, gte, lte, gt, lt, ne, isNull } }
 */

const OPS = ['in', 'gte', 'lte', 'gt', 'lt', 'ne', 'isNull'];

function allowedColumns(def) {
  return new Set(['id', 'created_at', 'updated_at', ...Object.keys(def.indexes), ...Object.keys(def.blind)]);
}

function assertColumns(def, where = {}, orderBy) {
  const allowed = allowedColumns(def);
  for (const [col, cond] of Object.entries(where)) {
    if (!allowed.has(col)) throw new Error(`column ${col} is not filterable`);
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      for (const op of Object.keys(cond)) if (!OPS.includes(op)) throw new Error(`operator ${op} not allowed`);
    }
  }
  if (orderBy) {
    const [col, dir = 'asc'] = orderBy;
    if (!allowed.has(col)) throw new Error(`column ${col} is not sortable`);
    if (!['asc', 'desc'].includes(String(dir).toLowerCase())) throw new Error('bad sort direction');
  }
}

function matches(row, where = {}) {
  for (const [col, cond] of Object.entries(where)) {
    const v = row[col];
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if (cond.in && !cond.in.includes(v)) return false;
      if (cond.ne !== undefined && v === cond.ne) return false;
      if (cond.isNull === true && v !== null && v !== undefined) return false;
      if (cond.isNull === false && (v === null || v === undefined)) return false;
      if (cond.gte !== undefined && !(v !== null && v >= cond.gte)) return false;
      if (cond.lte !== undefined && !(v !== null && v <= cond.lte)) return false;
      if (cond.gt !== undefined && !(v !== null && v > cond.gt)) return false;
      if (cond.lt !== undefined && !(v !== null && v < cond.lt)) return false;
    } else if (v !== cond) {
      return false;
    }
  }
  return true;
}

module.exports = { assertColumns, matches, allowedColumns };
