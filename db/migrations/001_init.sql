-- 001_init.sql — collection tables generated from src/adapters/persistence/schema.js
-- (document + indexed-column pattern, see docs/architecture/adr/ADR-004-persistence.md).
-- Never edit an applied migration: add a new numbered file instead.

CREATE TABLE IF NOT EXISTS source_records (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  source text,
  plate_key text,
  batch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_source_records_source ON source_records (source);
CREATE INDEX IF NOT EXISTS ix_source_records_plate_key ON source_records (plate_key);
CREATE INDEX IF NOT EXISTS ix_source_records_batch_id ON source_records (batch_id);

CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  region text,
  insurer text,
  expiry_date date,
  owner_type text,
  dq_score integer,
  phone_bidx text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_profiles_region ON profiles (region);
CREATE INDEX IF NOT EXISTS ix_profiles_insurer ON profiles (insurer);
CREATE INDEX IF NOT EXISTS ix_profiles_expiry_date ON profiles (expiry_date);
CREATE INDEX IF NOT EXISTS ix_profiles_owner_type ON profiles (owner_type);
CREATE INDEX IF NOT EXISTS ix_profiles_dq_score ON profiles (dq_score);
CREATE INDEX IF NOT EXISTS ix_profiles_phone_bidx ON profiles (phone_bidx);

CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  tier text,
  score integer,
  journey text,
  action text,
  days_to_expiry integer,
  region text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_leads_tier ON leads (tier);
CREATE INDEX IF NOT EXISTS ix_leads_score ON leads (score);
CREATE INDEX IF NOT EXISTS ix_leads_journey ON leads (journey);
CREATE INDEX IF NOT EXISTS ix_leads_action ON leads (action);
CREATE INDEX IF NOT EXISTS ix_leads_days_to_expiry ON leads (days_to_expiry);
CREATE INDEX IF NOT EXISTS ix_leads_region ON leads (region);

CREATE TABLE IF NOT EXISTS touchpoints (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  due_date date,
  status text,
  journey text,
  channel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_touchpoints_profile_id ON touchpoints (profile_id);
CREATE INDEX IF NOT EXISTS ix_touchpoints_due_date ON touchpoints (due_date);
CREATE INDEX IF NOT EXISTS ix_touchpoints_status ON touchpoints (status);
CREATE INDEX IF NOT EXISTS ix_touchpoints_journey ON touchpoints (journey);
CREATE INDEX IF NOT EXISTS ix_touchpoints_channel ON touchpoints (channel);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  channel text,
  status text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_messages_profile_id ON messages (profile_id);
CREATE INDEX IF NOT EXISTS ix_messages_channel ON messages (channel);
CREATE INDEX IF NOT EXISTS ix_messages_status ON messages (status);
CREATE INDEX IF NOT EXISTS ix_messages_sent_at ON messages (sent_at);

CREATE TABLE IF NOT EXISTS voice_sessions (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  outcome text,
  state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_voice_sessions_profile_id ON voice_sessions (profile_id);
CREATE INDEX IF NOT EXISTS ix_voice_sessions_outcome ON voice_sessions (outcome);
CREATE INDEX IF NOT EXISTS ix_voice_sessions_state ON voice_sessions (state);

CREATE TABLE IF NOT EXISTS handoffs (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  status text,
  assigned_to text,
  region text,
  profile_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_handoffs_status ON handoffs (status);
CREATE INDEX IF NOT EXISTS ix_handoffs_assigned_to ON handoffs (assigned_to);
CREATE INDEX IF NOT EXISTS ix_handoffs_region ON handoffs (region);
CREATE INDEX IF NOT EXISTS ix_handoffs_profile_id ON handoffs (profile_id);

CREATE TABLE IF NOT EXISTS quotes (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_quotes_profile_id ON quotes (profile_id);
CREATE INDEX IF NOT EXISTS ix_quotes_status ON quotes (status);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  status text,
  channel text,
  partner_id text,
  journey text,
  created_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_orders_profile_id ON orders (profile_id);
CREATE INDEX IF NOT EXISTS ix_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS ix_orders_channel ON orders (channel);
CREATE INDEX IF NOT EXISTS ix_orders_partner_id ON orders (partner_id);
CREATE INDEX IF NOT EXISTS ix_orders_journey ON orders (journey);
CREATE INDEX IF NOT EXISTS ix_orders_created_date ON orders (created_date);

CREATE TABLE IF NOT EXISTS policies (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  product text,
  status text,
  end_date date,
  partner_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_policies_profile_id ON policies (profile_id);
CREATE INDEX IF NOT EXISTS ix_policies_product ON policies (product);
CREATE INDEX IF NOT EXISTS ix_policies_status ON policies (status);
CREATE INDEX IF NOT EXISTS ix_policies_end_date ON policies (end_date);
CREATE INDEX IF NOT EXISTS ix_policies_partner_id ON policies (partner_id);

CREATE TABLE IF NOT EXISTS claims (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  status text,
  policy_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_claims_profile_id ON claims (profile_id);
CREATE INDEX IF NOT EXISTS ix_claims_status ON claims (status);
CREATE INDEX IF NOT EXISTS ix_claims_policy_id ON claims (policy_id);

CREATE TABLE IF NOT EXISTS partners (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  type text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_partners_type ON partners (type);
CREATE INDEX IF NOT EXISTS ix_partners_status ON partners (status);

CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  partner_id text,
  key_hash text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_api_keys_partner_id ON api_keys (partner_id);
CREATE INDEX IF NOT EXISTS ix_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS ix_api_keys_status ON api_keys (status);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  username text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);
CREATE INDEX IF NOT EXISTS ix_users_status ON users (status);

CREATE TABLE IF NOT EXISTS rulesets (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  kind text,
  status text,
  version_no integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rulesets_kind ON rulesets (kind);
CREATE INDEX IF NOT EXISTS ix_rulesets_status ON rulesets (status);
CREATE INDEX IF NOT EXISTS ix_rulesets_version_no ON rulesets (version_no);

CREATE TABLE IF NOT EXISTS domain_events (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  type text,
  status text,
  occurred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_domain_events_type ON domain_events (type);
CREATE INDEX IF NOT EXISTS ix_domain_events_status ON domain_events (status);
CREATE INDEX IF NOT EXISTS ix_domain_events_occurred_at ON domain_events (occurred_at);

CREATE TABLE IF NOT EXISTS dq_issues (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  type text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dq_issues_profile_id ON dq_issues (profile_id);
CREATE INDEX IF NOT EXISTS ix_dq_issues_type ON dq_issues (type);
CREATE INDEX IF NOT EXISTS ix_dq_issues_status ON dq_issues (status);

CREATE TABLE IF NOT EXISTS lineage (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  entity_id text,
  entity_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_lineage_entity_id ON lineage (entity_id);
CREATE INDEX IF NOT EXISTS ix_lineage_entity_type ON lineage (entity_type);

CREATE TABLE IF NOT EXISTS job_runs (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  kind text,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_job_runs_kind ON job_runs (kind);
CREATE INDEX IF NOT EXISTS ix_job_runs_started_at ON job_runs (started_at);

-- Append-only, hash-chained audit trail.
CREATE TABLE IF NOT EXISTS audit_log (
  seq bigserial PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  at timestamptz NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  prev_hash char(64) NOT NULL,
  hash char(64) NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS ix_audit_log_entity ON audit_log (entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_actor ON audit_log (actor);
CREATE INDEX IF NOT EXISTS ix_audit_log_action ON audit_log (action);

-- Enforce append-only at the database level (defence in depth).
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS ux_api_keys_key_hash ON api_keys (key_hash);
