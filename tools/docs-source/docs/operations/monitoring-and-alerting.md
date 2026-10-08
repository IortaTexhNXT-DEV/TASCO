---
id: TGP-OPS-02
title: Monitoring and Alerting
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 08/10/2026
prepared_by: iorta TechNXT, Service Operations
reviewed_by: TASCO Insurance, IT Operations
approved_by: TASCO Insurance, Head of IT
change_history: Initial issue for submission
acronyms:
  - [ALR, Alert Rule]
  - [API, Application Programming Interface]
  - [CPU, Central Processing Unit]
  - [DBA, Database Administrator]
  - [DNC, Do Not Contact]
  - [DPO, Data Protection Officer]
  - [HCM, Hồ Chí Minh City]
  - [HN, Hà Nội]
  - [ID, Identifier]
  - [IDOR, Insecure Direct Object Reference]
  - [IOPS, Input/Output Operations Per Second]
  - [IT, Information Technology]
  - [JSON, JavaScript Object Notation]
  - [KI, Known Issue]
  - [MFA, Multi-Factor Authentication]
  - [PREPROD, Pre-production environment]
  - [RB, Runbook procedure]
  - [RPO, Recovery Point Objective]
  - [SLO, Service Level Objective]
  - [SOP, Standard Operating Procedure]
  - [SQL, Structured Query Language]
  - [SRE, Site Reliability Engineering]
  - [TLS, Transport Layer Security]
  - [WAF, Web Application Firewall]
signoff:
  - ["Monitoring stack chosen (Prometheus-compatible, log platform, synthetic checks) for the hosting confirmed in discovery", TASCO IT Operations, Open]
  - [TASCO core rating latency target and alert thresholds agreed with TASCO core IT, TASCO IT Architecture, Open]
  - [Alert routing to the TASCO on-call tool and escalation list confirmed, TASCO IT Production Support, Open]
---

# Introduction

This document defines what is monitored on the TASCO Growth Platform, the service level objectives, the dashboards, and every alert rule with its threshold and the procedure it points to. Alert expressions use the metric names the code emits today.

It covers the application, its integrations (including TASCO core rating and the product catalogue), the event outbox and scheduled jobs, security signals, resources, business indicators and the database. The reference stack is Prometheus with Alertmanager, Grafana, Loki or the TASCO log platform, a blackbox exporter and a SQL exporter; any Prometheus-compatible stack works.

The audience is SRE and on-call engineers, and the business owners who receive business alerts. SRE at iorta TechNXT owns it during hypercare; TASCO IT Operations owns it afterwards.

Related documents:

- TGP-OPS-01 Runbook and Support Guide (procedures RB-01 to RB-18 and SOP-01 to SOP-09 named in each alert).
- TGP-QA-03 Performance and Capacity Test Plan (latency targets).
- TGP-OPS-03 Disaster Recovery and Business Continuity Plan.
- TGP-QA-01 Test Strategy (known issues KI-14, fixed, and KI-17, open).

# What the platform exposes

| Endpoint | Content | Exposure |
|---|---|---|
| `GET /metrics` | Prometheus text, per process: counters, histograms, memory and uptime | Requires `Authorization: Bearer <METRICS_TOKEN>` when the token is set (KI-14 fixed). Production mounts `METRICS_TOKEN_FILE`. Always set the token, block `/metrics` at the ingress and allow only the Prometheus namespace |
| `GET /health/live` | `{status:"ok"}` | Liveness probe |
| `GET /health/ready` | `{status, store, db}`; 503 when not ready | Readiness probe and external synthetic |
| `GET /api/ops/status` | Circuit per integration, active rule versions and checksums, event backlog by status, audit count | Staff with `ops:read`; for people and dashboard links, not scraping |
| `GET /api/integrations/status` | Rating source, core mode, rating and catalogue circuits, last catalogue sync, issuance circuit | Staff with `ops:read` |
| Logs | JSON lines on stdout | Log pipeline |

Points to know about the metrics implementation:

- Counters live in memory per pod and reset on restart. Always use `rate()` or `increase()` and sum across pods.
- There are no `# TYPE` lines, so Prometheus treats series as untyped; `rate()` and `histogram_quantile()` still work on `_bucket` series (KI-17).
- Histogram buckets in seconds: 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10 and +Inf.
- `route` is the route template (for example `POST /api/customer/orders`). Probes are labelled `health`, the scrape `metrics`, static paths `static` and the specification `openapi`, so cardinality is bounded (103 API routes plus 4 labels).

# Metric catalogue

| Metric | Type | Labels | Emitted by |
|---|---|---|---|
| `http_requests_total` | Counter | `route`, `method`, `status` | Every request |
| `http_request_duration_seconds` | Histogram | `route`, `method` | Every request |
| `integration_calls_total` | Counter | `integration` (`vetc-wallet`, `tasco-core`, `tasco-core-rating`, `tasco-core-catalogue`, `voice-ai`, `app-push`, `zalo-zns`, `sms`), `result` (`ok`, `error`) | Circuit breaker, every attempt including retries |
| `integration_short_circuit_total` | Counter | `integration` | Calls refused while the circuit is open |
| `integration_latency_seconds` | Histogram | `integration` (`tasco-core`), `op` (`token`, `quote`, `catalogue`) | TASCO core production client only (not the simulated core) |
| `rating_requests_total` | Counter | `source` (`core`), `result` (`ok`, `unavailable`) | Rating service; core business answers (decline, refer) are not counted as unavailable |
| `quotes_indicative_total` | Counter | — | Indicative quotes issued in fallback mode |
| `tasco_core_token_fetch_total` | Counter | — | Access tokens fetched from TASCO core (production client only) |
| `tasco_core_quotes_total` | Counter | — | Quotes priced by the TASCO core production client |
| `catalogue_sync_proposals_total` | Counter | — | Catalogue sync proposals created |
| `events_published_total` | Counter | `type` | Outbox publish |
| `events_processed_total` | Counter | `type`, `status` (`done`, `pending`, `dead_letter`) | Outbox relay |
| `messages_total` | Counter | `channel`, `status` (`sent`, `failed`, `blocked`), `journey` | Journey sends |
| `voice_calls_total` | Counter | `outcome` | Voice bot |
| `quotes_total` | Counter | `channel` | Quotes |
| `orders_completed_total` | Counter | `channel`, `journey` | Completed orders |
| `orders_compensation_total` | Counter | `status` (`issuance_failed_refunded`, `compensation_failed`) | Compensation after an issuance failure |
| `process_resident_memory_bytes` | Gauge | — | Process |
| `process_uptime_seconds` | Gauge | — | Process |

## Database series

Some signals are not exported by the application yet (KI-17). A read-only SQL exporter polls the replica every 60 seconds with the role `metrics_ro`. These series start with `tasco_db_`.

| Series | Query (outline) | Used by |
|---|---|---|
| `tasco_db_domain_events{status}` | Count of events by status | ALR-21, ALR-22 |
| `tasco_db_domain_events_oldest_pending_seconds` | Age of the oldest pending event | ALR-21 |
| `tasco_db_touchpoints_due_unexecuted` | Scheduled touchpoints due before today | ALR-34 |
| `tasco_db_handoffs_open_older_than_2h` | Open handoffs older than 2 hours | ALR-83 |
| `tasco_db_orders{status}` | Orders of the last 24 hours by status | ALR-84 |
| `tasco_db_job_last_success_timestamp{kind}` | Latest succeeded job run per kind | ALR-35, ALR-37 |
| `tasco_db_quotes_indicative_open` and `tasco_db_quotes_indicative_oldest_seconds` | Open quotes with `indicative` true, count and oldest age | ALR-38 |
| `tasco_db_dsar_requests_overdue` and `tasco_db_dsar_requests_due_soon` | Data requests in `dsar_requests` with status received or in progress, past `due_at`, or due within 24 hours | ALR-39 |
| PostgreSQL exporter defaults | Connections, replication lag, locks, size | ALR-90 to ALR-93 |

Reconciliation, retention and catalogue sync record job runs in the database. Journeys, recompute and relay run from the command line without a job record, so their freshness comes from the logs (ALR-33) and the scheduled job status (`kube_cronjob_status_last_successful_time`).

# Service level objectives

| ID | Journey | Indicator | Objective (28 days) |
|---|---|---|---|
| SLO-01 | Customer purchase path availability | Share of non-5xx responses on customer quote, order, session and home | 99.9 % (about 40 minutes of error budget) |
| SLO-02 | Partner API availability | Share of non-5xx responses on partner routes | 99.9 % |
| SLO-03 | Staff console availability | Share of non-5xx responses on other API routes | 99.5 % |
| SLO-04 | Certificate verification availability | Share of non-5xx responses plus synthetic SYN-02 | 99.95 % |
| SLO-05 | Customer read latency | p95 of customer home | 300 ms in 99 % of 5-minute windows |
| SLO-06 | Quote latency (TASCO core rating included) | p95 of quote routes | 500 ms |
| SLO-07 | Order latency | p95 of order routes | 2.5 s |
| SLO-08 | Staff read latency | p95 of leads, Customer 360 and handoffs | 500 ms |
| SLO-09 | Journey freshness | Daily run finished by 12:00 with no due touchpoints left | 99 % of days |
| SLO-10 | Event freshness | Oldest pending event under 5 minutes | 99 % of the time |
| SLO-11 | TASCO core rating success | Share of core rating requests answered (`result="ok"`) | 99.5 %, tracked as a dependency indicator for the service review |

SLO-01 counts a 503 caused by a TASCO core outage in core-only mode as an error, because customers cannot buy. SLO-11 shows how much of that budget the dependency used.

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
  - record: core:rating_latency_seconds:p95_10m
    expr: histogram_quantile(0.95, sum by (le) (rate(integration_latency_seconds_bucket{integration="tasco-core",op="quote"}[10m])))
  - record: core:rating_unavailable_ratio5m
    expr: |
      sum(rate(rating_requests_total{source="core",result="unavailable"}[5m]))
      / sum(rate(rating_requests_total{source="core"}[5m]))
```

# Dashboards

| Dashboard | Panels | Audience |
|---|---|---|
| D1 Service overview | Requests by route group; 4xx and 5xx ratio; p50, p95, p99 by route; 429 rate; pods ready; memory; restarts; error budget burn for SLO-01 to 04 | On-call |
| D2 Integrations | Per integration: call rate, error ratio, short-circuits, retries; TASCO core panel with rating latency (p95), unavailable ratio, indicative quotes, last catalogue sync and a link to the integration status | On-call, vendor managers |
| D3 Events and jobs | Published and processed events by type and status; pending and oldest pending; dead letters; scheduled job last success; journey run summary | On-call, L3 |
| D4 Business funnel | Quotes and orders by channel and journey; conversion; messages by channel and status; voice outcomes; handoffs open over 2 hours; daily premium | Business Owner, campaign managers |
| D5 Compliance | Blocked messages; marketing outside contact hours (should be 0); opt-outs; DNC contacts (should be 0); audit chain status; rule activations; data requests open, due within 24 hours and overdue | Compliance, DPO |
| D6 Security | Sign-in 401, 423 and 429; MFA failures; 403 by route; partner 401; WAF blocks | Security |
| D7 Database | Connections, CPU, IOPS, replication lag, slow statements, table sizes, lock waits | DBA |

| Golden signal | Metrics |
|---|---|
| Latency | `http_request_duration_seconds` by route; `integration_latency_seconds` for TASCO core |
| Traffic | `http_requests_total`, `quotes_total`, `orders_completed_total` |
| Errors | 5xx responses, `integration_calls_total{result="error"}`, dead-letter events, failed messages, unavailable ratings |
| Saturation | Memory, CPU throttling, database connections, pending events |

# Alert rules

`severity: page` pages on-call 24 × 7. `severity: ticket` opens a ticket and posts to the channel during business hours. Every alert carries a link to TGP-OPS-01 and names its procedure.

## Platform

| ID | Name | Expression | For | Severity | Procedure |
|---|---|---|---|---|---|
| ALR-01 | ReadinessFailing | `probe_success{job="blackbox",instance=~".*/health/ready"} == 0` | 2m | page | RB-01 |
| ALR-02 | HighErrorRate | 5xx ratio over all non-probe routes `> 0.02` | 5m | page | RB-01, RB-12 |
| ALR-03 | LatencySLOBreach | `route:http_request_duration_seconds:p95_5m` above 0.3 s (customer home), 0.5 s (quotes) or 2.5 s (orders) | 10m | ticket; page above 2× | RB-12 |
| ALR-04 | PurchaseSLOFastBurn | `slo:customer_purchase:error_ratio5m > 0.0144 and slo:customer_purchase:error_ratio1h > 0.0144` | 2m | page | RB-02, RB-03, RB-16 |
| ALR-05 | PurchaseSLOSlowBurn | `slo:customer_purchase:error_ratio1h > 0.006` | 30m | ticket | — |
| ALR-06 | InternalErrors | `sum(increase(http_requests_total{status="500"}[10m])) > 5` | — | ticket | Logs `unhandled error` |
| ALR-07 | RateLimitSurge | `sum(rate(http_requests_total{status="429"}[5m])) > 5` | 10m | ticket | RB-09, RB-14 |
| ALR-08 | NoTraffic | No non-probe requests for 15 minutes between 08:00 and 20:00 | 15m | page | RB-01 |
| ALR-09 | ScrapeDown | `up{job="tasco-growth-api"} == 0` | 5m | ticket | — |

## Integrations

| ID | Name | Expression | For | Severity | Procedure |
|---|---|---|---|---|---|
| ALR-10 | CircuitOpen | `sum by (integration) (increase(integration_short_circuit_total{integration!="tasco-core-rating"}[5m])) > 0` | 1m | page for `vetc-wallet` and `tasco-core`; ticket for others | RB-02 to RB-05, RB-17 |
| ALR-11 | IntegrationErrorRatio | `integration:error_ratio5m > 0.2` with at least 0.1 calls per second | 5m | ticket | RB-02 to RB-05, RB-16 |
| ALR-12 | IntegrationRetryInflation | Wallet calls per order above 3 (retries) | 15m | ticket | RB-02 |
| ALR-13 | CoreRatingCircuitOpen | `sum(increase(integration_short_circuit_total{integration="tasco-core-rating"}[5m])) > 0` | 1m | page | RB-16 |
| ALR-14 | CoreRatingLatency | `core:rating_latency_seconds:p95_10m > 0.3` (production client only) | 15m | ticket; page above 2 s | RB-12, RB-16 |
| ALR-15 | IndicativeQuotesIssued | `sum(increase(quotes_indicative_total[15m])) > 0` (fallback mode only) | — | ticket | RB-16, RB-18 |
| ALR-16 | RatingUnavailable | `core:rating_unavailable_ratio5m > 0.05` | 5m | page | RB-16 |

## Events and jobs

| ID | Name | Expression | For | Severity | Procedure |
|---|---|---|---|---|---|
| ALR-20 | DeadLetterEvents | `sum by (type) (increase(events_processed_total{status="dead_letter"}[15m])) > 0` | — | page in business hours; ticket at night | RB-06 |
| ALR-21 | OutboxBacklog | `tasco_db_domain_events{status="pending"} > 10000 or tasco_db_domain_events_oldest_pending_seconds > 300` | 10m | ticket; page after 30 minutes | RB-06 |
| ALR-22 | EventsStuckProcessing | `tasco_db_domain_events{status="processing"} > 0` sustained (re-claim after 5 minutes means no relay is running) | 15m | ticket | RB-06 |
| ALR-23 | EventRetryChurn | `sum by (type) (rate(events_processed_total{status="pending"}[10m])) > 0.5` | 15m | ticket | RB-06 |
| ALR-24 | BacklogGrowth | Published minus processed events over 30 minutes `> 5000` (application-only fallback) | 30m | ticket | RB-06 |
| ALR-33 | JourneySkipSpike | Log rule: skipped divided by due in `journey run complete` above 0.3 | — | ticket | RB-07 |
| ALR-34 | JourneyBacklog | `tasco_db_touchpoints_due_unexecuted > 0` after 12:00 | 30m | ticket | RB-07 |
| ALR-35 | JobNotRun | Journeys, recompute, reconcile or retention without success for 26 hours; relay for 15 minutes | — | ticket | SOP-09 |
| ALR-36 | ReconciliationMismatch | Last reconciliation result with mismatches above 0 | — | ticket; page above 10 | RB-11 |
| ALR-37 | CatalogueSyncFailed | `time() - kube_cronjob_status_last_successful_time{cronjob="tasco-growth-sync-catalogue"} > 26*3600`, or the last `catalogue_sync` run failed | — | ticket | RB-17 |
| ALR-38 | IndicativeQuoteBacklog | `tasco_db_quotes_indicative_open > 50 or tasco_db_quotes_indicative_oldest_seconds > 3600` | 15m | ticket | RB-18 |
| ALR-39 | DataRequestOverdue | `tasco_db_dsar_requests_overdue > 0`; also a daily ticket at 09:00 when `tasco_db_dsar_requests_due_soon > 0` | — | ticket to Compliance and the DPO | SOP-05 |

## Security and audit

| ID | Name | Expression | For | Severity | Procedure |
|---|---|---|---|---|---|
| ALR-40 | AuditChainBroken | Synthetic SYN-07 returns `ok:false` (`probe_success{probe="audit_verify"} == 0`) | — | page | RB-08 |
| ALR-50 | LoginFailureSpike | Sign-in 401 responses over 5 minutes `> 30` | — | ticket; page above 200 | RB-09 |
| ALR-51 | AccountLockouts | Sign-in 423 responses over 15 minutes `> 5` | — | ticket | RB-09 |
| ALR-52 | LoginRateLimited | Sign-in and MFA 429 responses over 5 minutes `> 20` | — | ticket | RB-09 |
| ALR-53 | MfaFailures | Audit `auth.mfa_failed` over 15 minutes `> 20` (SQL exporter) | — | ticket | RB-09 |
| ALR-54 | PartnerAuthFailures | Partner API 401 responses over 10 minutes `> 50` | — | ticket | RB-15 |
| ALR-55 | ForbiddenSpike | 403 responses by route over 10 minutes `> 50` (possible IDOR probing) | — | ticket | Security |
| ALR-56 | DemoModeInProduction | Synthetic: metadata shows demo mode on, or the demo code helper does not return 404 | — | page | Configuration |
| ALR-57 | InMemoryStoreInProduction | Synthetic: readiness shows a store other than `postgres` (defence in depth; start-up already refuses it, KI-28 fixed) | — | page | RB-01 |

## Resources

| ID | Name | Expression | For | Severity | Procedure |
|---|---|---|---|---|---|
| ALR-60 | MemoryHigh | `max(process_resident_memory_bytes) > 0.8 * <container limit>` | 15m | ticket | RB-13 |
| ALR-61 | FrequentRestarts | `sum(resets(process_uptime_seconds[1h])) > 3` | — | ticket | RB-13 |
| ALR-62 | CPUThrottling | Throttled CPU periods above 25 % | 15m | ticket | RB-12 |

## Business indicators

| ID | Name | Expression | For | Severity | Procedure |
|---|---|---|---|---|---|
| ALR-30 | CopyGuardBlocked | `sum(increase(messages_total{status="blocked"}[1h])) > 0` | — | page Compliance and L2 | RB-10 |
| ALR-31 | MessageFailureRatio | Failed messages by channel above 10 % over 30 minutes | — | ticket | RB-04 |
| ALR-80 | NoOrdersInBusinessHours | No completed orders for an hour between 09:00 and 20:00 | — | page from full pilot volume | RB-02, RB-03, RB-16 |
| ALR-81 | ConversionDrop | Orders per quote over 6 hours below half of the same window last week | — | ticket | — |
| ALR-82 | QuotesDropByChannel | Quotes per channel over an hour below 30 % of last week | — | ticket | RB-16 |
| ALR-83 | HotHandoffsUnworked | `tasco_db_handoffs_open_older_than_2h > 20` between 08:00 and 18:00 | 30m | ticket to the telesales supervisor | — |
| ALR-84 | IssuanceFailures | `sum by (status) (increase(orders_compensation_total[15m])) > 0` | — | page (`compensation_failed` always pages) | RB-11 |
| ALR-85 | OptOutSpike | Opted-out calls above 10 % over 2 hours | — | ticket to Compliance | — |
| ALR-86 | PlateMismatchSpike | Plate mismatch or unverified calls above 15 % over 2 hours | — | ticket | Data quality or speech recognition review (spoken plates fixed under KI-25) |

## Database

| ID | Name | Expression | For | Severity |
|---|---|---|---|---|
| ALR-90 | DBConnectionsHigh | Connections above 80 % of the maximum | 5m | ticket |
| ALR-91 | DBReplicationLag | `pg_replication_lag_seconds > 30` | 5m | page (RPO at risk) |
| ALR-92 | DBDiskHigh | Database volume above 70 % | 15m | ticket |
| ALR-93 | BackupFailed | Backup or point-in-time recovery status not successful in 24 hours | — | page |

# Log-based alerts

| ID | Query (LogQL) | Threshold | Severity |
|---|---|---|---|
| LOG-01 | `sum(count_over_time({app="tasco-growth-api"} \| json \| msg="unhandled error" [10m]))` | Above 5 | ticket |
| LOG-02 | `count_over_time({app="tasco-growth-api"} \| json \| msg="circuit opened" [5m])` | Above 0 | Follows ALR-10 and ALR-13 |
| LOG-03 | `count_over_time({app="tasco-growth-api"} \| json \| msg="job failed" [1h])` | Above 0 | ticket |
| LOG-04 | `count_over_time({app="tasco-growth-api"} \| json \| msg="pg pool error" [5m])` | Above 3 | page |
| LOG-05 | Warnings containing "not set — using an ephemeral" or "using the simulated TASCO core" in production | Above 0 | page (configuration that should never reach production) |
| LOG-06 | Sign-in 401 responses in the request log (the audit action is in the database) | Above 30 in 5 minutes | ticket |
| LOG-07 | Unredacted Vietnamese mobile number pattern in any log line | Above 0 | ticket to Security |

# Synthetic checks

| ID | Check | Frequency and location | Assertion |
|---|---|---|---|
| SYN-01 | Readiness through the public ingress | Every minute from two locations (HN, HCM) | 200, `db:true`, store `postgres` |
| SYN-02 | Certificate check for a long-dated internal test policy agreed with TASCO core | Every 5 minutes | Valid, masked plate |
| SYN-03 | Staff sign-in with a read-only synthetic user, then `GET /api/auth/me` | Every 5 minutes | 200 within 1 s |
| SYN-04 | Customer session, home and quote in PREPROD; session and home only in production for an excluded test profile | Every 10 minutes | 200 within targets |
| SYN-05 | Metadata | Every 5 minutes | Demo mode off |
| SYN-06 | Demo code helper | Hourly | 404 |
| SYN-07 | Audit verification with an auditor service account | Hourly, off-peak heavy (KI-12) | `ok:true` |
| SYN-08 | TLS certificate expiry for public hostnames | Daily | More than 21 days left |
| SYN-09 | Certificate verification page renders | Every 15 minutes | 200 and contains the certificate number |

| ID | Name | Condition | Severity | Procedure |
|---|---|---|---|---|
| ALR-71 | CertificateVerificationSynthetic | SYN-02 or SYN-09 failing for 10 minutes | page (police and inspection centres depend on it) | RB-14 |

# Alert hygiene

- Every alert has an owner, a procedure and an expression tested with `promtool test rules`.
- Silences have an expiry and a ticket number.
- A monthly review tunes or removes alerts that fired without action, and adds rules for incidents that had no alert.
- Pilot thresholds are re-based after pilot week 2 and before each scale-up step.

# Appendix

## Example Alertmanager rule

```yaml
- alert: CoreRatingCircuitOpen
  expr: sum(increase(integration_short_circuit_total{integration="tasco-core-rating"}[5m])) > 0
  for: 1m
  labels:
    severity: page
  annotations:
    summary: "TASCO core rating circuit open: quotes cannot be priced by core"
    runbook: "TGP-OPS-01 Runbook and Support Guide, RB-16"
```

Where Alertmanager cannot template the severity label from the integration, ALR-10 is split into a page rule for `integration=~"vetc-wallet|tasco-core"` and a ticket rule for the rest.
