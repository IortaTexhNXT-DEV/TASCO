# Monitoring and Alerting — TASCO Growth Platform

| Item | Value |
|---|---|
| Owner | SRE (iorta TechNXT during hypercare → TASCO IT operations) |
| Stack (reference) | Prometheus (+ Alertmanager), Grafana, Loki (or the TASCO log platform), blackbox exporter, postgres_exporter / sql_exporter. Any Prometheus-compatible stack works |
| Related | [Runbook](runbook-and-support-guide.md) (RB-xx) · [Performance plan](../quality/performance-and-capacity-test-plan.md) §4 SLOs · KI-14, KI-17 |

---

## 1. What the application exposes

| Endpoint | Content | Exposure |
|---|---|---|
| `GET /metrics` | Prometheus text format 0.0.4, **per process**: counters and histograms below, plus `process_resident_memory_bytes` and `process_uptime_seconds` | **Unauthenticated (KI-14).** Scrape in-cluster via pod IP; block `/metrics` at the ingress; NetworkPolicy allows only the Prometheus namespace |
| `GET /health/live` | `{status:"ok"}` | Liveness probe |
| `GET /health/ready` | `{status, store, db}`; 503 when not ready | Readiness probe; external synthetic |
| `GET /api/ops/status` | Circuit state per integration, active rule versions and checksums, `eventBacklog` by status, audit count | Staff with `ops:read`. Use for humans and dashboards' links, not as a scrape target |
| stdout JSON logs | `request` lines with `requestId`, `method`, `route`, `status`, `ms`; lifecycle and error events | Log pipeline (Loki/ELK) |

**Notes on the metrics implementation (`src/shared/metrics.js`):**

- Counters are in-memory per pod and **reset on restart**. Always use `rate()`/`increase()` and `sum` across pods.
- The output has no `# TYPE` lines, so Prometheus ingests the series as untyped. `rate()` and `histogram_quantile()` still work on the `_bucket` series.
- Histogram buckets (seconds): 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, +Inf.
- `route` is the **route template** (e.g. `POST /api/customer/orders`, `GET /api/customers/:id`). Probes are `health`, the scrape itself is `metrics`, unmatched/static paths are `static`, and the spec is `openapi`, so cardinality is bounded (73 API routes + 4).

## 2. Additional exporters (to configure)

Some signals the app does not export yet (KI-17). Provide them with a read-only SQL exporter against the **replica** (role `metrics_ro`), polled every 60 s. These series are prefixed `tasco_db_` to make clear they come from the database, not the app.

| Series | Query (sketch) | Used by |
|---|---|---|
| `tasco_db_domain_events{status}` | `SELECT status, count(*) FROM domain_events GROUP BY status` | ALR-21, ALR-22 |
| `tasco_db_domain_events_oldest_pending_seconds` | `SELECT extract(epoch FROM now() - min(occurred_at)) FROM domain_events WHERE status='pending'` | ALR-21 |
| `tasco_db_touchpoints_due_unexecuted` | `SELECT count(*) FROM touchpoints WHERE status='scheduled' AND due_date < CURRENT_DATE` | ALR-34 |
| `tasco_db_handoffs_open_older_than_2h` | `SELECT count(*) FROM handoffs WHERE status='open' AND created_at < now() - interval '2 hours'` | ALR-83 |
| `tasco_db_orders{status}` (last 24 h) | `SELECT status, count(*) FROM orders WHERE created_at > now()-interval '1 day' GROUP BY status` | ALR-84 |
| `tasco_db_job_last_success_timestamp{kind}` | `SELECT kind, extract(epoch FROM max(started_at)) FROM job_runs WHERE data->>'status'='succeeded' GROUP BY kind` | ALR-35 |
| postgres_exporter standard | Connections, replication lag, locks, transaction wraparound, DB size | ALR-90–ALR-93 |

Only `reconciliation` and `retention` record `job_runs` today. CLI-run `journeys`, `recompute` and `relay` do not, so their freshness comes from logs (ALR-33) and the CronJob status (`kube_cronjob_status_last_successful_time` from kube-state-metrics).

## 3. Metric catalogue (from the code)

| Metric | Type | Labels | Emitted by |
|---|---|---|---|
| `http_requests_total` | counter | `route`, `method`, `status` | `app.js`, every request |
| `http_request_duration_seconds` | histogram | `route`, `method` | `app.js` |
| `integration_calls_total` | counter | `integration` (`vetc-wallet`, `tasco-core`, `voice-ai`, `app-push`, `zalo-zns`, `sms`), `result` (`ok`, `error`) | `resilience.js`, **every attempt including retries** |
| `integration_short_circuit_total` | counter | `integration` | `resilience.js`, calls rejected while the circuit is open |
| `events_published_total` | counter | `type` (`policy.issued`, `profiles.rebuilt`, `lead.recompute_requested`, `handoff.created`, `renewal.link_requested`, `claim.submitted`, `rules.activated`) | `outboxEventBus.publish` |
| `events_processed_total` | counter | `type`, `status` (`done`, `pending` = will retry, `dead_letter`) | `outboxEventBus.relay` |
| `messages_total` | counter | `channel` (`app_push`, `zalo_zns`, `sms`), `status` (`sent`, `failed`, `blocked`), `journey` | `journeyService.sendMessage` |
| `voice_calls_total` | counter | `outcome` (`hot_handoff`, `link_sent`, `already_renewed`, `opted_out`, `wrong_person`, `plate_mismatch`, `unverified`, `callback_later`, `not_interested`) | `voiceService.finalize` |
| `quotes_total` | counter | `channel` (`vetc_app`, `zalo`, `telesales`, `voice_bot`, `partner_api`) | `salesService.quote` |
| `orders_completed_total` | counter | `channel`, `journey` | `salesService.purchase` |
| `process_resident_memory_bytes` | gauge | — | `metrics.render` |
| `process_uptime_seconds` | gauge | — | `metrics.render` |

## 4. SLIs and SLOs

| SLO ID | User journey | SLI (Prometheus) | Objective (28-day rolling) |
|---|---|---|---|
| SLO-01 | Customer purchase path availability | Non-5xx ratio over `route=~"POST /api/customer/(quotes\|orders)\|POST /api/customer/session\|GET /api/customer/home"` | **99.9 %** (40 min error budget / 28 d) |
| SLO-02 | Partner API availability | Non-5xx ratio over `route=~"(POST\|GET) /api/partner/v1/.*"` | **99.9 %** |
| SLO-03 | Staff console availability | Non-5xx ratio over all other `/api/*` routes | **99.5 %** |
| SLO-04 | Certificate verification availability | Non-5xx ratio over `GET /api/public/certificates/:certNo` + synthetic SYN-02 | **99.95 %** |
| SLO-05 | Latency: customer reads | p95 of `GET /api/customer/home` | ≤ 300 ms for 99 % of 5-min windows |
| SLO-06 | Latency: quotes | p95 of quote routes | ≤ 500 ms |
| SLO-07 | Latency: orders | p95 of order routes | ≤ 2.5 s |
| SLO-08 | Latency: staff reads | p95 of `GET /api/leads`, `GET /api/customers/:id`, `GET /api/handoffs` | ≤ 500 ms |
| SLO-09 | Journey freshness | Daily journey run completes by 12:00 ICT with backlog `tasco_db_touchpoints_due_unexecuted` = 0 | 99 % of days |
| SLO-10 | Event freshness | Oldest pending event < 5 min | 99 % of the time |

Recording rules:

```yaml
groups:
- name: tasco-gp-recording
  rules:
  - record: route:http_requests:rate5m
    expr: sum by (route, status) (rate(http_requests_total[5m]))
  - record: slo:customer_purchase:error_ratio5m
    expr: |
      sum(rate(http_requests_total{route=~"POST /api/customer/(quotes|orders)|POST /api/customer/session|GET /api/customer/home",status=~"5.."}[5m]))
      /
      sum(rate(http_requests_total{route=~"POST /api/customer/(quotes|orders)|POST /api/customer/session|GET /api/customer/home"}[5m]))
  - record: slo:customer_purchase:error_ratio1h
    expr: |
      sum(rate(http_requests_total{route=~"POST /api/customer/(quotes|orders)|POST /api/customer/session|GET /api/customer/home",status=~"5.."}[1h]))
      /
      sum(rate(http_requests_total{route=~"POST /api/customer/(quotes|orders)|POST /api/customer/session|GET /api/customer/home"}[1h]))
  - record: route:http_request_duration_seconds:p95_5m
    expr: histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket{route!~"health|metrics|static|openapi"}[5m])))
  - record: integration:error_ratio5m
    expr: |
      sum by (integration) (rate(integration_calls_total{result="error"}[5m]))
      / sum by (integration) (rate(integration_calls_total[5m]))
```

## 5. Golden signals and dashboards

| Dashboard | Panels | Audience |
|---|---|---|
| **D1 Service overview** | RPS by route group; 4xx/5xx ratio; p50/p95/p99 by route (`route:http_request_duration_seconds:p95_5m`); 429 rate; pods ready; memory per pod; restarts; SLO burn (SLO-01..04) | On-call |
| **D2 Integrations** | Per integration: call rate, error ratio, short-circuits, circuit state (from `integration_short_circuit_total` > 0 plus a link to `/api/ops/status`), retries (calls ÷ requests) | On-call, vendor managers |
| **D3 Events and jobs** | `events_published_total` vs `events_processed_total{status}` by type; `tasco_db_domain_events{status}`; oldest pending; dead letters; CronJob last success; journey run summary (log-derived) | On-call, L3 |
| **D4 Business funnel** | `quotes_total` and `orders_completed_total` by channel and journey; quote→order conversion; messages by channel and status; voice outcomes; open handoffs > 2 h; GWP (from the `/api/dashboard/overview` export, daily) | Business owner, campaign managers |
| **D5 Compliance** | `messages_total{status="blocked"}`; marketing messages outside the window (SQL, should be 0); opt-outs (`voice_calls_total{outcome="opted_out"}`); DNC contacts (should be 0); audit chain verify status; rule activations timeline | Compliance, DPO |
| **D6 Security** | Login 401/423/429 rates; MFA failures (audit); 403 rate by route; partner 401 rate; WAF blocks | Security |
| **D7 Database** | Connections vs max, CPU, IOPS, replication lag, slow statements, table sizes (`domain_events`, `audit_log`, `messages`), advisory-lock waits | DBA |

Golden signals mapping:

| Signal | Metric |
|---|---|
| Latency | `http_request_duration_seconds` (by route), `ms` in logs |
| Traffic | `rate(http_requests_total[5m])`, `quotes_total`, `orders_completed_total` |
| Errors | `http_requests_total{status=~"5.."}`, `integration_calls_total{result="error"}`, `events_processed_total{status="dead_letter"}`, `messages_total{status="failed"}` |
| Saturation | `process_resident_memory_bytes`, container CPU throttling, DB connections, `tasco_db_domain_events{status="pending"}` |

## 6. Alert rules

`severity: page` pages on-call 24×7; `severity: ticket` creates a ticket and posts to the channel during business hours. Every alert carries `runbook_url` to the RB-xx section.

### 6.1 Platform

| ID | Name | Expression | For | Severity | Runbook |
|---|---|---|---|---|---|
| ALR-01 | ReadinessFailing | `probe_success{job="blackbox",instance=~".*/health/ready"} == 0` | 2m | page | RB-01 |
| ALR-02 | HighErrorRate | `sum(rate(http_requests_total{status=~"5..",route!~"health\|metrics\|static"}[5m])) / sum(rate(http_requests_total{route!~"health\|metrics\|static"}[5m])) > 0.02` | 5m | page | RB-01 / RB-12 |
| ALR-03 | LatencySLOBreach | `route:http_request_duration_seconds:p95_5m{route=~"GET /api/customer/home"} > 0.3 or route:http_request_duration_seconds:p95_5m{route=~"POST /api/(customer/)?quotes\|POST /api/partner/v1/quotes"} > 0.5 or route:http_request_duration_seconds:p95_5m{route=~"POST /api/(customer/\|partner/v1/)?orders"} > 2.5` | 10m | ticket (page if > 2× threshold) | RB-12 |
| ALR-04 | PurchaseSLOFastBurn | `slo:customer_purchase:error_ratio5m > (14.4 * 0.001) and slo:customer_purchase:error_ratio1h > (14.4 * 0.001)` | 2m | page | RB-02/03 |
| ALR-05 | PurchaseSLOSlowBurn | `slo:customer_purchase:error_ratio1h > (6 * 0.001)` | 30m | ticket | — |
| ALR-06 | InternalErrors | `sum(increase(http_requests_total{status="500"}[10m])) > 5` (500 = `INTERNAL_ERROR`; 503 is upstream) | — | ticket | Logs `unhandled error` |
| ALR-07 | RateLimitSurge | `sum(rate(http_requests_total{status="429"}[5m])) > 5` | 10m | ticket | RB-09 / RB-14 |
| ALR-08 | NoTraffic | `sum(rate(http_requests_total{route!~"health\|metrics\|static"}[15m])) == 0 and on() (hour() >= 1 and hour() < 13)` (08:00–20:00 ICT) | 15m | page | RB-01 |
| ALR-09 | ScrapeDown | `up{job="tasco-growth-platform"} == 0` | 5m | ticket | — |

### 6.2 Integrations

| ID | Name | Expression | For | Severity | Runbook |
|---|---|---|---|---|---|
| ALR-10 | CircuitOpen | `sum by (integration) (increase(integration_short_circuit_total[5m])) > 0` | 1m | page for `vetc-wallet`, `tasco-core`; ticket for others | RB-02 – RB-05 |
| ALR-11 | IntegrationErrorRatio | `integration:error_ratio5m > 0.2 and sum by (integration) (rate(integration_calls_total[5m])) > 0.1` | 5m | ticket | RB-02 – RB-05 |
| ALR-12 | IntegrationRetryInflation | `sum by (integration) (rate(integration_calls_total[10m])) / on() group_left sum(rate(http_requests_total{route=~"POST /api/(customer/\|partner/v1/)?orders"}[10m])) > 3` (wallet: > 1 call per order means retries) | 15m | ticket | RB-02 |

### 6.3 Events and jobs

| ID | Name | Expression | For | Severity | Runbook |
|---|---|---|---|---|---|
| ALR-20 | DeadLetterEvents | `sum by (type) (increase(events_processed_total{status="dead_letter"}[15m])) > 0` | — | page (business hours) / ticket (night) | RB-06 |
| ALR-21 | OutboxBacklog | `tasco_db_domain_events{status="pending"} > 10000 or tasco_db_domain_events_oldest_pending_seconds > 300` | 10m | ticket (page if > 30 min) | RB-06 |
| ALR-22 | EventsStuckProcessing | `tasco_db_domain_events{status="processing"} > 0` sustained (no app metric; KI-03) | 15m | ticket | RB-06 |
| ALR-23 | EventRetryChurn | `sum by (type) (rate(events_processed_total{status="pending"}[10m])) > 0.5` | 15m | ticket | RB-06 |
| ALR-24 | BacklogGrowth (app-only fallback) | `sum(increase(events_published_total[30m])) - sum(increase(events_processed_total{status="done"}[30m])) > 5000` | 30m | ticket | RB-06 |
| ALR-33 | JourneySkipSpike (log-based) | Loki ruler: `max_over_time({app="tasco-growth-platform"} \| json \| msg="journey run complete" \| unwrap skipped [1h]) / max_over_time({app="tasco-growth-platform"} \| json \| msg="journey run complete" \| unwrap due [1h]) > 0.3` | — | ticket | RB-07 |
| ALR-34 | JourneyBacklog | `tasco_db_touchpoints_due_unexecuted > 0 and on() hour() >= 5` (after 12:00 ICT) | 30m | ticket | RB-07 / KI-05 |
| ALR-35 | JobNotRun | `time() - kube_cronjob_status_last_successful_time{cronjob=~".*(journeys\|reconcile\|retention\|relay).*"} > 26*3600` (relay: > 900 s) | — | ticket | SOP-09 |
| ALR-36 | ReconciliationMismatch | Log/SQL: last `reconciliation` job result `mismatches > 0` (from `GET /api/ops/jobs`, or `tasco_db` query on `job_runs.data->'result'->>'mismatches'`) | — | ticket (page if > 10) | RB-11 |

### 6.4 Security and audit

| ID | Name | Expression | For | Severity | Runbook |
|---|---|---|---|---|---|
| ALR-40 | AuditChainBroken | Synthetic SYN-07 result `ok == false` (exported as `probe_success{probe="audit_verify"} == 0`) | — | page | RB-08 |
| ALR-50 | LoginFailureSpike | `sum(increase(http_requests_total{route="POST /api/auth/login",status="401"}[5m])) > 30` | — | ticket (page if > 200) | RB-09 |
| ALR-51 | AccountLockouts | `sum(increase(http_requests_total{route="POST /api/auth/login",status="423"}[15m])) > 5` | — | ticket | RB-09 |
| ALR-52 | LoginRateLimited | `sum(increase(http_requests_total{route=~"POST /api/auth/(login\|mfa)",status="429"}[5m])) > 20` | — | ticket | RB-09 |
| ALR-53 | MfaFailures (log/audit) | Audit `auth.mfa_failed` count > 20 in 15 min (SQL exporter on `audit_log.action`) | — | ticket | RB-09 |
| ALR-54 | PartnerAuthFailures | `sum(increase(http_requests_total{route=~".*/api/partner/v1/.*",status="401"}[10m])) > 50` | — | ticket | RB-15 |
| ALR-55 | ForbiddenSpike | `sum by (route) (increase(http_requests_total{status="403"}[10m])) > 50` (possible IDOR probing) | — | ticket | Security |
| ALR-56 | DemoModeInProduction | Synthetic `GET /api/meta` body `demoMode:true`, or `GET /api/demo/totp/admin` ≠ 404 | — | page | Config, KI-01 |
| ALR-57 | InMemoryStoreInProduction | Synthetic `GET /health/ready` body `store != "postgres"` | — | page | KI-28 |

### 6.5 Resources

| ID | Name | Expression | For | Severity | Runbook |
|---|---|---|---|---|---|
| ALR-60 | MemoryHigh | `max(process_resident_memory_bytes) > 0.8 * 1.5 * 1024^3` (adjust to the container limit) | 15m | ticket | RB-13 |
| ALR-61 | FrequentRestarts | `sum(resets(process_uptime_seconds[1h])) > 3` | — | ticket | RB-13 |
| ALR-62 | CPUThrottling | `sum(rate(container_cpu_cfs_throttled_periods_total{container="app"}[5m])) / sum(rate(container_cpu_cfs_periods_total{container="app"}[5m])) > 0.25` | 15m | ticket | RB-12 |

### 6.6 Business KPIs

| ID | Name | Expression | For | Severity | Notes |
|---|---|---|---|---|---|
| ALR-80 | NoOrdersInBusinessHours | `sum(increase(orders_completed_total[1h])) == 0 and on() (hour() >= 2 and hour() < 13)` | — | page (after pilot full volume) | 09:00–20:00 ICT |
| ALR-81 | ConversionDrop | `sum(increase(orders_completed_total[6h])) / sum(increase(quotes_total[6h])) < 0.5 * (sum(increase(orders_completed_total[6h] offset 1w)) / sum(increase(quotes_total[6h] offset 1w)))` | — | ticket | Week-over-week |
| ALR-82 | QuotesDropByChannel | `sum by (channel) (increase(quotes_total[1h])) < 0.3 * sum by (channel) (increase(quotes_total[1h] offset 1w))` | — | ticket | Channel outage |
| ALR-83 | HotHandoffsUnworked | `tasco_db_handoffs_open_older_than_2h > 20 and on() (hour() >= 1 and hour() < 11)` | 30m | ticket to the telesales supervisor | KPI: first contact ≤ 2 business hours |
| ALR-84 | IssuanceFailures | `tasco_db_orders{status="issuance_failed_refunded"} > 0` | — | page | RB-11 |
| ALR-30 | CopyGuardBlocked | `sum(increase(messages_total{status="blocked"}[1h])) > 0` | — | page Compliance + L2 | An active template contains banned wording, which validation should prevent: investigate the rule set (RB-10) |
| ALR-31 | MessageFailureRatio | `sum by (channel) (increase(messages_total{status="failed"}[30m])) / sum by (channel) (increase(messages_total[30m])) > 0.1` | — | ticket | RB-04 |
| ALR-85 | OptOutSpike | `sum(increase(voice_calls_total{outcome="opted_out"}[2h])) / sum(increase(voice_calls_total[2h])) > 0.1` | — | ticket to Compliance | Script or targeting problem |
| ALR-86 | PlateMismatchSpike | `sum(increase(voice_calls_total{outcome=~"plate_mismatch\|unverified"}[2h])) / sum(increase(voice_calls_total[2h])) > 0.15` | — | ticket | Data quality, or ASR/KI-25 |

### 6.7 Database

| ID | Name | Expression (postgres_exporter) | For | Severity |
|---|---|---|---|---|
| ALR-90 | DBConnectionsHigh | `sum(pg_stat_activity_count) / max(pg_settings_max_connections) > 0.8` | 5m | ticket |
| ALR-91 | DBReplicationLag | `pg_replication_lag_seconds > 30` | 5m | page (RPO at risk) |
| ALR-92 | DBDiskHigh | DB volume used > 70 % (provider metric) | 15m | ticket |
| ALR-93 | BackupFailed | Provider backup/PITR status ≠ success in 24 h | — | page |

Example Alertmanager rule file entry:

```yaml
- alert: CircuitOpen
  expr: sum by (integration) (increase(integration_short_circuit_total[5m])) > 0
  for: 1m
  labels:
    severity: '{{ if or (eq $labels.integration "vetc-wallet") (eq $labels.integration "tasco-core") }}page{{ else }}ticket{{ end }}'
  annotations:
    summary: "Circuit open for {{ $labels.integration }}"
    runbook_url: "docs/operations/runbook-and-support-guide.md#rb-02--circuit-open-vetc-wallet-vetc-wallet"
```

(Alertmanager cannot template labels in the rule itself on every version. If yours cannot, split the rule into a `page` rule for `integration=~"vetc-wallet|tasco-core"` and a `ticket` rule for the rest.)

## 7. Log-based alerts

| ID | Query (LogQL) | Threshold | Severity |
|---|---|---|---|
| LOG-01 | `sum(count_over_time({app="tasco-growth-platform"} \| json \| msg="unhandled error" [10m]))` | > 5 | ticket |
| LOG-02 | `count_over_time({app="tasco-growth-platform"} \| json \| msg="circuit opened" [5m])` | > 0 | follows ALR-10 |
| LOG-03 | `count_over_time({app="tasco-growth-platform"} \| json \| msg="job failed" [1h])` | > 0 | ticket |
| LOG-04 | `count_over_time({app="tasco-growth-platform"} \| json \| msg="pg pool error" [5m])` | > 3 | page |
| LOG-05 | `count_over_time({app="tasco-growth-platform"} \| json \| level="warn" \|~ "not set — using an ephemeral"[1h])` | > 0 in PROD | page (missing secret in a non-production config that reached prod) |
| LOG-06 | Sign-in failures: `sum(count_over_time({app="tasco-growth-platform"} \| json \| route="POST /api/auth/login" \| status="401" [5m]))`. The **audit action `auth.login_failed`** is in the DB, not the logs; use the HTTP 401 on the login route as the log proxy | > 30 | ticket |
| LOG-07 | `{app="tasco-growth-platform"} \|~ "(?i)(\\b0[35789]\\d{8}\\b)"` (unredacted VN mobile pattern in logs) | > 0 | ticket to Security (redaction gap) |

## 8. Synthetic checks

| ID | Check | Frequency / location | Assertion | Alert |
|---|---|---|---|---|
| SYN-01 | `GET /health/ready` through the public ingress | 1 min, 2 locations (HN, HCM) | 200, `db:true`, `store:"postgres"` | ALR-01, ALR-57 |
| SYN-02 | `GET /api/public/certificates/<synthetic cert>` (a long-dated internal test policy agreed with TASCO core) | 5 min | `valid:true`, masked plate | ALR-71 |
| SYN-03 | Staff login with a no-MFA synthetic user (role `executive`, read-only) → `GET /api/auth/me` | 5 min | 200 within 1 s | ticket |
| SYN-04 | Customer flow (session → home → quote) in **PREPROD only**. In PROD a quote creates real records, so it runs read-only (session + home) for a synthetic test profile excluded from KPIs | 10 min | 200s within SLO | ticket |
| SYN-05 | `GET /api/meta` | 5 min | `demoMode:false` | ALR-56 |
| SYN-06 | `GET /api/demo/totp/admin` | 1 h | 404 | ALR-56 |
| SYN-07 | `GET /api/audit/verify` with an `auditor` service account | 1 h, off-peak heavy (KI-12) | `ok:true` | ALR-40 |
| SYN-08 | TLS certificate expiry for the public hostnames | Daily | > 21 days | ticket |
| SYN-09 | `/verify/<certNo>` page renders (HTML 200) | 15 min | 200, contains the cert number | ALR-71 |
| ALR-71 | Certificate verification synthetic failing | SYN-02 or SYN-09 failing for 10 min | — | page (police/inspection depend on it) |

## 9. Alert hygiene

- Every alert has an owner, a runbook link and a tested expression (unit-tested with `promtool test rules`).
- Silences must have an expiry and a ticket ID.
- Monthly review: alerts that fired with no action are tuned or removed; incidents with no alert get a new rule.
- Thresholds marked for the pilot are re-baselined after pilot week 2 and before W1 (volumes ×20–30).
