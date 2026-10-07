'use strict';

/**
 * Audit trail facade. Who did what, to which entity, when — hash-chained and
 * append-only. PII never goes into audit details (ids only).
 */
/** Map staff user ids (U-…) to "Display name (username)" for display. Unknown ids are skipped. */
async function userNames(store, ids) {
  const wanted = new Set(ids.filter((id) => typeof id === 'string' && id.startsWith('U-')));
  const out = new Map();
  if (!wanted.size) return out;
  const users = await store.collection('users').find({ limit: 1000 });
  for (const u of users) if (wanted.has(u.id)) out.set(u.id, u.displayName ? `${u.displayName} (${u.username})` : u.username);
  return out;
}

function createAuditService({ store, logger }) {
  return {
    async record({ actor, action, entityType, entityId, details }) {
      const entry = await store.audit.append({ actor: actor || 'system', action, entityType: entityType || null, entityId: entityId || null, details: details || null });
      logger?.debug('audit', { action, entityType, entityId });
      return entry;
    },
    /** Entries with `actorName` resolved from the user directory (read-time only; the hash chain is untouched). */
    async list(filter) {
      const entries = await store.audit.list(filter);
      const names = await userNames(store, entries.map((e) => e.actor));
      return entries.map((e) => (names.has(e.actor) ? { ...e, actorName: names.get(e.actor) } : e));
    },
    verify: () => store.audit.verify(),
    count: () => store.audit.count(),
  };
}

module.exports = { createAuditService, userNames };
