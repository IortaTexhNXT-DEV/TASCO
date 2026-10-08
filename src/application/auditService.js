'use strict';

/**
 * Audit trail facade. Who did what, to which entity, when — hash-chained and
 * append-only. PII never goes into audit details (ids only).
 */

/**
 * Business activity categories used by the console filter. Each maps to action-code prefixes; an
 * entry belongs to the first category whose prefix matches its action.
 */
const AUDIT_CATEGORIES = Object.freeze({
  access: ['auth.'],
  customer: ['profile.', 'customer.', 'consent.', 'dsar.', 'dq.', 'data.'],
  sales: ['quote.', 'order.', 'handoff.', 'voice.', 'journeys.', 'leads.', 'ecosystem.'],
  rules: ['rules.', 'catalogue.'],
  claims: ['claim.'],
  partners: ['partner.'],
  admin: ['user.', 'job.', 'demo.'],
});

/** Category of an action code ('other' when no prefix matches). */
function auditCategory(action) {
  for (const [cat, prefixes] of Object.entries(AUDIT_CATEGORIES)) if (prefixes.some((p) => String(action || '').startsWith(p))) return cat;
  return 'other';
}

/** Staff user ids (U-…) → { displayName, username, roles }. Unknown ids are skipped. */
async function userDirectory(store, ids) {
  const wanted = new Set(ids.filter((id) => typeof id === 'string' && id.startsWith('U-')));
  const out = new Map();
  if (!wanted.size) return out;
  const users = await store.collection('users').find({ limit: 1000 });
  for (const u of users) if (wanted.has(u.id)) out.set(u.id, { displayName: u.displayName || u.username, username: u.username, roles: u.roles || [] });
  return out;
}

/** Map staff user ids (U-…) to "Display name (username)" for display. Unknown ids are skipped. */
async function userNames(store, ids) {
  const dir = await userDirectory(store, ids);
  const out = new Map();
  for (const [id, u] of dir) out.set(id, u.displayName && u.displayName !== u.username ? `${u.displayName} (${u.username})` : u.username);
  return out;
}

const DAY_MS = 86400000;
const SCAN_PAGE = 500;
const SCAN_MAX = 20000;

function createAuditService({ store, logger }) {
  /**
   * Read-time enrichment (the hash chain is untouched): actor display name and roles, and a business
   * label for the object (customer plate + name masked per the reader's permissions, staff user name,
   * partner name). `actorName` keeps its historical "Display name (username)" format.
   */
  async function enrich(entries, principal, access) {
    const dir = await userDirectory(store, entries.flatMap((e) => [e.actor, e.entityType === 'user' ? e.entityId : null]));
    // Object labels are resolved only for console reads (principal given), not for internal aggregations.
    const profileIds = principal ? [...new Set(entries.filter((e) => e.entityType === 'profile' && e.entityId).map((e) => e.entityId))] : [];
    const partnerIds = principal ? [...new Set(entries.filter((e) => e.entityType === 'partner' && e.entityId).map((e) => e.entityId))] : [];
    const profiles = new Map();
    for (const id of profileIds) {
      const p = await store.collection('profiles').get(id).catch(() => null);
      if (p) profiles.set(id, p);
    }
    const partners = new Map();
    for (const id of partnerIds) {
      const p = await store.collection('partners').get(id).catch(() => null);
      if (p) partners.set(id, p);
    }
    return entries.map((e) => {
      const out = { ...e, category: auditCategory(e.action) };
      const u = dir.get(e.actor);
      if (u) Object.assign(out, { actorName: u.displayName !== u.username ? `${u.displayName} (${u.username})` : u.username, actorDisplayName: u.displayName, actorUsername: u.username, actorRoles: u.roles });
      if (e.entityType === 'user' && dir.get(e.entityId)) out.entityLabel = dir.get(e.entityId).displayName;
      if (e.entityType === 'partner' && partners.get(e.entityId)) out.entityLabel = partners.get(e.entityId).name;
      if (e.entityType === 'profile' && profiles.get(e.entityId)) {
        const p = profiles.get(e.entityId);
        const shown = p.anonymised ? null : (principal && access ? access.maskProfile(principal, p).name : null);
        out.entityPlate = p.plate || p.id;
        if (shown) out.entityLabel = shown;
      }
      return out;
    });
  }

  return {
    async record({ actor, action, entityType, entityId, details }) {
      const entry = await store.audit.append({ actor: actor || 'system', action, entityType: entityType || null, entityId: entityId || null, details: details || null });
      logger?.debug('audit', { action, entityType, entityId });
      return entry;
    },
    /**
     * Entries (newest first) with actor names resolved from the user directory.
     * Optional business filters: category (AUDIT_CATEGORIES key), from / to (yyyy-mm-dd, inclusive, UTC+7 days).
     * Pass { principal, access } so customer names are shown masked according to the reader's permissions
     * (without them no customer name is returned, only the plate).
     */
    async list(filter = {}, { principal, access } = {}) {
      const { category, from, to, limit = 100, offset = 0, ...base } = filter;
      let entries;
      if (!category && !from && !to) {
        entries = await store.audit.list({ ...base, limit, offset });
      } else {
        // Vietnam business days: [from 00:00, to 24:00) in UTC+7.
        const fromTs = from ? Date.parse(`${from}T00:00:00+07:00`) : -Infinity;
        const toTs = to ? Date.parse(`${to}T00:00:00+07:00`) + DAY_MS : Infinity;
        const matched = [];
        for (let off = 0; off < SCAN_MAX; off += SCAN_PAGE) {
          const page = await store.audit.list({ ...base, limit: SCAN_PAGE, offset: off });
          let older = false;
          for (const e of page) {
            const ts = Date.parse(e.at);
            if (ts < fromTs) { older = true; break; }
            if (ts >= toTs) continue;
            if (category && auditCategory(e.action) !== category) continue;
            matched.push(e);
          }
          if (older || page.length < SCAN_PAGE || matched.length >= offset + limit) break;
        }
        entries = matched.slice(offset, offset + limit);
      }
      return enrich(entries, principal, access);
    },
    /** Staff who appear in the trail (for the "person" filter): id, display name and roles — no contact data. */
    async actors() {
      const users = await store.collection('users').find({ limit: 1000 });
      return users.map((u) => ({ id: u.id, displayName: u.displayName || u.username, roles: u.roles || [] }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
    verify: () => store.audit.verify(),
    count: () => store.audit.count(),
  };
}

module.exports = { createAuditService, userNames, userDirectory, auditCategory, AUDIT_CATEGORIES };
