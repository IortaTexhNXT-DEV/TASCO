-- 002_integrity_hardening.sql
-- Defence in depth for governance data (see docs/architecture/security-architecture.md).

-- Only one active version per rule kind, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rulesets_one_active_per_kind ON rulesets (kind) WHERE status = 'active';

-- The row-level trigger in 001 does not fire on TRUNCATE; block it too.
CREATE OR REPLACE FUNCTION audit_log_no_truncate() RETURNS trigger AS $$
BEGIN
  IF current_setting('tasco.allow_audit_truncate', true) = 'on' THEN
    RETURN NULL; -- test databases only (set per session by the test harness)
  END IF;
  RAISE EXCEPTION 'audit_log cannot be truncated';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_audit_log_no_truncate ON audit_log;
CREATE TRIGGER trg_audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_no_truncate();

-- Outbox: find stuck 'processing' events quickly for recovery.
CREATE INDEX IF NOT EXISTS ix_domain_events_status_occurred ON domain_events (status, occurred_at);
