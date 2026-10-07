'use strict';

/**
 * Audit trail facade. Who did what, to which entity, when — hash-chained and
 * append-only. PII never goes into audit details (ids only).
 */
function createAuditService({ store, logger }) {
  return {
    async record({ actor, action, entityType, entityId, details }) {
      const entry = await store.audit.append({ actor: actor || 'system', action, entityType: entityType || null, entityId: entityId || null, details: details || null });
      logger?.debug('audit', { action, entityType, entityId });
      return entry;
    },
    list: (filter) => store.audit.list(filter),
    verify: () => store.audit.verify(),
    count: () => store.audit.count(),
  };
}

module.exports = { createAuditService };
