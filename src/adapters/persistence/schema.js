'use strict';

/**
 * Collection registry — the single source of truth for persistence.
 *
 * Each aggregate is stored as a versioned JSON document plus typed, indexed
 * columns used for filtering. Only columns declared here can be filtered or
 * sorted on, which is what keeps every query parameterised and injection-safe.
 *
 *   indexes: { column: { path, type } }  — path into the document
 *   pii:     document fields encrypted at rest (AES-256-GCM)
 *   blind:   { column: field }            — HMAC blind index for equality search on PII
 *
 * db/migrations/*.sql must match this file (verified by test/unit/schema.test.js).
 */

const COLLECTIONS = {
  source_records: {
    indexes: { source: { path: 'source', type: 'text' }, plate_key: { path: 'plateKey', type: 'text' }, batch_id: { path: 'batchId', type: 'text' } },
    pii: ['phoneRaw', 'fullName'],
  },
  profiles: {
    indexes: {
      region: { path: 'province', type: 'text' },
      insurer: { path: 'policy.insurer', type: 'text' },
      expiry_date: { path: 'policy.expiryDate', type: 'date' },
      owner_type: { path: 'ownerType', type: 'text' },
      dq_score: { path: 'dataQuality.score', type: 'int' },
    },
    pii: ['name', 'phone', 'altPhones'],
    blind: { phone_bidx: 'phone' },
  },
  leads: {
    indexes: {
      tier: { path: 'tier', type: 'text' },
      score: { path: 'score', type: 'int' },
      journey: { path: 'journey', type: 'text' },
      action: { path: 'nextBestAction.action', type: 'text' },
      days_to_expiry: { path: 'daysToExpiry', type: 'int' },
      region: { path: 'region', type: 'text' },
    },
  },
  touchpoints: {
    indexes: {
      profile_id: { path: 'profileId', type: 'text' },
      due_date: { path: 'dueDate', type: 'date' },
      status: { path: 'status', type: 'text' },
      journey: { path: 'journey', type: 'text' },
      channel: { path: 'channel', type: 'text' },
    },
  },
  messages: {
    indexes: {
      profile_id: { path: 'profileId', type: 'text' },
      channel: { path: 'channel', type: 'text' },
      status: { path: 'status', type: 'text' },
      sent_at: { path: 'sentAt', type: 'timestamptz' },
    },
    pii: ['to'],
  },
  voice_sessions: {
    indexes: { profile_id: { path: 'customerId', type: 'text' }, outcome: { path: 'outcome', type: 'text' }, state: { path: 'state', type: 'text' } },
    pii: ['transcript'],
  },
  handoffs: {
    indexes: {
      status: { path: 'status', type: 'text' },
      assigned_to: { path: 'assignedTo', type: 'text' },
      region: { path: 'region', type: 'text' },
      profile_id: { path: 'customerId', type: 'text' },
    },
    pii: ['name'],
  },
  quotes: {
    indexes: { profile_id: { path: 'profileId', type: 'text' }, status: { path: 'status', type: 'text' } },
  },
  orders: {
    indexes: {
      profile_id: { path: 'profileId', type: 'text' },
      status: { path: 'status', type: 'text' },
      channel: { path: 'channel', type: 'text' },
      partner_id: { path: 'partnerId', type: 'text' },
      journey: { path: 'journey', type: 'text' },
      created_date: { path: 'createdDate', type: 'date' },
    },
  },
  policies: {
    indexes: {
      profile_id: { path: 'profileId', type: 'text' },
      product: { path: 'product', type: 'text' },
      status: { path: 'status', type: 'text' },
      end_date: { path: 'endDate', type: 'date' },
      partner_id: { path: 'partnerId', type: 'text' },
    },
  },
  claims: {
    indexes: { profile_id: { path: 'profileId', type: 'text' }, status: { path: 'status', type: 'text' }, policy_id: { path: 'policyId', type: 'text' } },
    pii: ['description', 'location'],
  },
  partners: {
    indexes: { type: { path: 'type', type: 'text' }, status: { path: 'status', type: 'text' } },
  },
  api_keys: {
    indexes: { partner_id: { path: 'partnerId', type: 'text' }, key_hash: { path: 'keyHash', type: 'text' }, status: { path: 'status', type: 'text' } },
  },
  users: {
    indexes: { username: { path: 'username', type: 'text' }, status: { path: 'status', type: 'text' } },
    pii: ['totpSecret', 'displayName'],
  },
  rulesets: {
    indexes: { kind: { path: 'kind', type: 'text' }, status: { path: 'status', type: 'text' }, version_no: { path: 'version_no', type: 'int' } },
  },
  domain_events: {
    indexes: { type: { path: 'type', type: 'text' }, status: { path: 'status', type: 'text' }, occurred_at: { path: 'occurredAt', type: 'timestamptz' } },
  },
  dq_issues: {
    indexes: { profile_id: { path: 'profileId', type: 'text' }, type: { path: 'type', type: 'text' }, status: { path: 'status', type: 'text' } },
  },
  lineage: {
    indexes: { entity_id: { path: 'entityId', type: 'text' }, entity_type: { path: 'entityType', type: 'text' } },
  },
  job_runs: {
    indexes: { kind: { path: 'kind', type: 'text' }, started_at: { path: 'startedAt', type: 'timestamptz' } },
  },
};

const COLUMN_RE = /^[a-z][a-z0-9_]*$/;
for (const [name, def] of Object.entries(COLLECTIONS)) {
  if (!COLUMN_RE.test(name)) throw new Error(`bad collection name ${name}`);
  for (const col of [...Object.keys(def.indexes || {}), ...Object.keys(def.blind || {})]) {
    if (!COLUMN_RE.test(col)) throw new Error(`bad column ${name}.${col}`);
  }
  def.pii = def.pii || [];
  def.blind = def.blind || {};
}

module.exports = { COLLECTIONS };
