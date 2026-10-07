'use strict';

const { sha256 } = require('../../shared/crypto');

/**
 * Tamper-evident audit trail: each entry's hash covers the previous entry's
 * hash, so any edit or deletion breaks the chain and is detected by verify().
 */

const GENESIS = '0'.repeat(64);

/** Canonical JSON (recursively sorted keys) so hashes survive jsonb key reordering. */
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

function entryHash(prevHash, e) {
  return sha256(canonical([prevHash, e.id, e.at, e.actor, e.action, e.entityType ?? null, e.entityId ?? null, e.details ?? null]));
}

function verifyChain(entries) {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== prev) return { ok: false, brokenAt: i, reason: 'prev hash mismatch' };
    if (entryHash(prev, e) !== e.hash) return { ok: false, brokenAt: i, reason: 'hash mismatch' };
    prev = e.hash;
  }
  return { ok: true, entries: entries.length, head: prev };
}

module.exports = { GENESIS, entryHash, verifyChain, canonical };
