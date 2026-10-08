-- 003_dsar_requests.sql — data-subject request register (access / erasure).
-- Generated from src/adapters/persistence/schema.js (collection dsar_requests). Never edit an applied migration.

CREATE TABLE IF NOT EXISTS dsar_requests (
  id text PRIMARY KEY,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  profile_id text,
  type text,
  status text,
  received_at timestamptz,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_dsar_requests_profile_id ON dsar_requests (profile_id);
CREATE INDEX IF NOT EXISTS ix_dsar_requests_type ON dsar_requests (type);
CREATE INDEX IF NOT EXISTS ix_dsar_requests_status ON dsar_requests (status);
CREATE INDEX IF NOT EXISTS ix_dsar_requests_received_at ON dsar_requests (received_at);
CREATE INDEX IF NOT EXISTS ix_dsar_requests_due_at ON dsar_requests (due_at);
