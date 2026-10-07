# Operations — TASCO Growth Platform

Operational documentation for running the TASCO Insurance × VETC motor insurance growth platform in production: support, monitoring, continuity, readiness, go-live and change.

| Document | Purpose | Primary audience |
|---|---|---|
| [runbook-and-support-guide.md](runbook-and-support-guide.md) | Support model (L1 service desk → L2 production support → L3 engineering → vendors), severity matrix and SLAs, on-call, log fields and queries, incident runbooks **RB-01 – RB-15** (DB/readiness, circuit breakers per integration, outbox backlog and dead letters, journey skips, audit chain, lockouts, rule rollback, payment-without-issuance, latency, memory, certificate verification, partner API), standard operating procedures **SOP-01 – SOP-09** (`DATA_KEYS` rotation, `JWT_SECRET` rotation, offboarding, partner keys, DSAR, data correction, outbound kill switch, unlock/MFA reset, job reruns), L1 known-error answers | L1/L2/L3 support, on-call |
| [monitoring-and-alerting.md](monitoring-and-alerting.md) | What the app exposes (`/metrics`, probes, `/api/ops/status`, JSON logs), metric catalogue, SLIs/SLOs **SLO-01 – SLO-10**, recording rules, dashboards D1–D7, Prometheus alert rules **ALR-xx** using the real metric names, business KPI alerts, log-based alerts, synthetic checks **SYN-01 – SYN-09** | SRE, on-call, business owners |
| [dr-bcp.md](dr-bcp.md) | Business impact analysis, RPO/RTO by tier, backups (PITR) and key escrow, DR topology (Hà Nội primary / TP.HCM warm standby, to be confirmed), failover/failback procedures FO-0/FO-1/FB-1/FO-2, DR tests **DR-T1 – DR-T7** and schedule, BCP for voice-vendor, telesales and partner outages, communication plan | TASCO IT, SRE, DBA, business continuity |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Go-live checklist **PRC-xxx-nn** with owner and status across security, quality, performance, observability, DR, compliance and legal sign-offs (benefits `pending_legal_review`, Zalo template approvals, tariffs, commission caps, PDP), data migration and people | Delivery lead, SteerCo |
| [go-live-and-hypercare-plan.md](go-live-and-hypercare-plan.md) | Exposure levers (cohort, journey audience rules, product/channel switches), go/no-go criteria, T-minus cutover schedule to the pilot soft launch on 25 Jan 2027, pilot ramp around the Tết freeze, rollback levels R1–R6, hypercare (war room, daily KPI pack, exit criteria), transition to BAU | Cutover manager, SteerCo, war room |
| [release-and-change-management.md](release-and-change-management.md) | Code changes vs maker-checker rule changes, semver, trunk-based branching, CI/CD gates, CAB types, migration policy (never edit an applied migration; expand/contract), feature flags via rules, rule change procedure, release notes template, freeze calendar | Release manager, CAB, developers, rule authors |

## Facts these documents rely on (from the code)

| Area | Fact |
|---|---|
| Probes | `GET /health/live` (process); `GET /health/ready` → `{status, store, db}`, 503 when the DB ping fails or during shutdown |
| Ops API | `GET /api/ops/status` (circuits, active rule versions/checksums, `eventBacklog` by status, audit count), `GET /api/ops/jobs`, `POST /api/ops/jobs/{reconciliation\|retention\|relay}` |
| Jobs (CLI) | `npm run job -- migrate\|seed\|rules\|journeys\|recompute\|reconcile\|retention\|relay\|openapi` (`seed` never in production: KI-01) |
| Breakers | `vetc-wallet`, `tasco-core`, `voice-ai`, `app-push`, `zalo-zns`, `sms`: 5 failed calls → open 30 s; 5 s timeout, 2 retries (voice-ai 30 s, no retries) |
| Outbox | `domain_events` `pending → processing → done`; 5 attempts → `dead_letter`; Postgres re-claims `processing` after 5 min |
| Metrics | `http_requests_total`, `http_request_duration_seconds`, `integration_calls_total`, `integration_short_circuit_total`, `events_published_total`, `events_processed_total`, `messages_total`, `voice_calls_total`, `quotes_total`, `orders_completed_total`, `process_resident_memory_bytes`, `process_uptime_seconds` |
| Shutdown | `SIGTERM` → readiness false → drain → exit ≤ 25 s |
| Contact window | Marketing only 08:00–20:00 ICT (`contact_policy`); run journeys at 08:30 ICT = 01:30 UTC |

Known issues referenced as **KI-xx** are listed in the [test strategy, Appendix A](../quality/test-strategy.md#appendix-a--known-issues-register-from-code-review-2026-10-07). Quality documents are indexed in [../quality/README.md](../quality/README.md).

> **Sandbox vs production:** the repository's outbound adapters (VETC wallet, TASCO core, Zalo ZNS, SMS, push, voice) are sandboxes. Partner contacts, DR egress allow-lists, hosting regions and Zalo template IDs are placeholders until the interface agreements are signed and are tracked in the readiness checklist.
