'use strict';

const { COLLECTIONS } = require('./schema');

/** Generates the DDL for the collection registry (used to author migrations and in schema tests). */
const SQL_TYPES = { text: 'text', int: 'integer', date: 'date', timestamptz: 'timestamptz' };

function tableDdl(name, def) {
  const cols = ['  id text PRIMARY KEY', '  version integer NOT NULL DEFAULT 1', '  data jsonb NOT NULL'];
  for (const [c, { type }] of Object.entries(def.indexes)) cols.push(`  ${c} ${SQL_TYPES[type]}`);
  for (const c of Object.keys(def.blind || {})) cols.push(`  ${c} text`);
  cols.push('  created_at timestamptz NOT NULL DEFAULT now()', '  updated_at timestamptz NOT NULL DEFAULT now()');
  let out = `CREATE TABLE IF NOT EXISTS ${name} (\n${cols.join(',\n')}\n);\n`;
  for (const c of [...Object.keys(def.indexes), ...Object.keys(def.blind || {})]) {
    out += `CREATE INDEX IF NOT EXISTS ix_${name}_${c} ON ${name} (${c});\n`;
  }
  return out;
}

function collectionsDdl() {
  return Object.entries(COLLECTIONS).map(([n, d]) => tableDdl(n, d)).join('\n');
}

module.exports = { collectionsDdl, tableDdl, SQL_TYPES };
