'use strict';

const { COLLECTIONS } = require('./schema');
const { blindIndex } = require('../../shared/crypto');

/**
 * Translates between domain documents and stored rows: encrypts PII fields,
 * computes blind indexes and extracts indexed column values. Shared by every
 * persistence adapter so behaviour is identical in memory and in Postgres.
 */

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
}

function createCodec({ cipher, blindKey }) {
  return {
    def(collection) {
      const d = COLLECTIONS[collection];
      if (!d) throw new Error(`unknown collection ${collection}`);
      return d;
    },
    encode(collection, doc) {
      const d = this.def(collection);
      const stored = { ...doc };
      for (const f of d.pii) if (stored[f] !== undefined && stored[f] !== null) stored[f] = cipher.encrypt(stored[f]);
      const columns = {};
      for (const [col, { path }] of Object.entries(d.indexes)) {
        const v = getPath(doc, path);
        columns[col] = v === undefined ? null : v;
      }
      for (const [col, field] of Object.entries(d.blind)) columns[col] = blindIndex(blindKey, doc[field]);
      return { data: stored, columns };
    },
    decode(collection, data) {
      const d = this.def(collection);
      const out = { ...data };
      for (const f of d.pii) if (out[f] !== undefined) out[f] = cipher.decrypt(out[f]);
      return out;
    },
    blind(value) {
      return blindIndex(blindKey, value);
    },
  };
}

module.exports = { createCodec, getPath };
