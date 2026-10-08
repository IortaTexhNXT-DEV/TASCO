---
id: TGP-QA-03
title: Performance and Capacity Test Plan
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 08/10/2026
prepared_by: iorta TechNXT, Quality Engineering
reviewed_by: TASCO Insurance, IT Infrastructure
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [API, Application Programming Interface]
  - [CI, Continuous Integration]
  - [CPU, Central Processing Unit]
  - [GB, Gigabyte]
  - [GiB, Gibibyte]
  - [ID, Identifier]
  - [IOPS, Input/Output Operations Per Second]
  - [IP, Internet Protocol]
  - [IT, Information Technology]
  - [JSON, JavaScript Object Notation]
  - [KI, Known Issue]
  - [MFA, Multi-Factor Authentication]
  - [PERF, Performance test environment]
  - [PITR, Point-In-Time Recovery]
  - [RPS, Requests Per Second]
  - [SRE, Site Reliability Engineering]
  - [SSD, Solid-State Drive]
  - [TC, Test Case]
  - [TNDS, Compulsory motor third-party liability insurance (Bảo hiểm TNDS bắt buộc)]
  - [TPS, Transactions Per Second]
  - [vCPU, Virtual CPU]
  - [WAL, Write-Ahead Log]
  - [ZNS, Zalo Notification Service]
signoff:
  - [Workload assumptions marked (A) confirmed with VETC traffic data and TASCO volumes in discovery, VETC IT and TASCO Business Owner, Open]
  - [TASCO core rating latency and throughput limits for the pilot agreed, TASCO IT Architecture, Open]
  - [Partner transaction forecasts provided before any partner goes live, TASCO Partner Manager, Open]
---

# Introduction

This plan defines how the platform's performance and capacity are tested: the workload model, the scenarios, the latency and throughput targets, the tooling, the test environment, the pass and fail criteria, and the capacity model that turns business volumes into pods, database size and connections.

It covers the online tier (customer app, staff console, partner API, certificate verification, ecosystem events), the batch tier (ingestion, lead recompute, journey runs, reconciliation) and the effect of slow or unavailable dependencies, including TASCO core rating.

The audience is the performance engineer, SRE, TASCO IT infrastructure and VETC IT, who supply the traffic forecasts.

Related documents:

- TGP-QA-01 Test Strategy (non-functional testing and CI gates).
- TGP-QA-02 Test Case Catalogue (TC-136 to TC-143 and TC-169).
- TGP-OPS-02 Monitoring and Alerting (metrics and service level objectives).
- TGP-BUS-03 Non-Functional Requirements.
- TGP-ARC-05 Deployment and Infrastructure Architecture.

Every workload figure marked (A) is an assumption. VETC and TASCO confirm it with real data in discovery, and it is re-based after the first two weeks of the pilot.

The latest smoke result (8 October 2026, `npm run test:perf`, one process, 25 concurrent users, in-memory store) is 194 requests per second, p95 210 ms and 0 errors, against a budget of p95 ≤ 300 ms and errors ≤ 1 %.

# Objectives

1. Show that the platform meets the latency and throughput targets at the forecast peak with at least 2× headroom.
2. Show that it can load and process the pilot cohort (50,000 to 100,000 vehicles) within its batch windows, and later the full VETC base of about 6 million vehicles.
3. Find the breaking point and confirm graceful degradation: 429 and 503 responses, open circuits and no data corruption.
4. Find memory and connection leaks over long runs.
5. Produce a capacity model so that operations can scale before each roll-out step.

# Workload model

## Population

| Quantity | Value | Basis |
|---|---|---|
| Vehicle profiles at full scale | 6,000,000 | VETC electronic toll base |
| Pilot cohort | 50,000 to 100,000, with a control group of about 10 % | Proposal pilot design |
| VETC app users at full scale | 70 to 80 %, 4.2 to 4.8 million | Programme brief |
| Source records per vehicle | About 1.5, so about 9 million rows | (A) |
| Vehicles with a usable expiry at start | About 10 % | Programme brief |
| Expiries per day at full scale | About 16,400 (6 million / 365) | Annual TNDS term |
| Peak renewal day | 3× average, about 50,000 | (A) month end, after Tết, registration anniversaries |

## Daily batch volumes at full scale

| Flow | Daily volume | Derivation |
|---|---|---|
| Touchpoints due | About 115,000 (peak 300,000) | 6 to 7 renewal and conquest steps per expiring vehicle, plus lapsed and new-vehicle journeys |
| Messages attempted | About 100,000 (peak 280,000) | One send per digital touchpoint plus fallbacks |
| Voice bot calls | About 6,500 (peak 20,000) | Hot and warm share (about 40 %) of expiring vehicles at day −14, with call consent |
| Telesales handoffs | About 1,500 | About 22 % of calls end as a hot handoff, plus journey escalations |
| Incremental ingest | 60,000 to 180,000 records | (A) 1 to 3 % of the base changes per day |
| Lead recompute | Event-driven, plus a full recompute | Nightly in the shipped schedule; weekly at full scale (A) |
| Catalogue sync | One call to TASCO core per night | Scheduled at 01:00 Vietnam time |

Pilot volumes are about 1 to 2 % of these figures.

## Online traffic

| Actor | Peak-hour assumption | Requests per session | Sustained RPS | Burst RPS |
|---|---|---|---|---|
| Customers (VETC app, Zalo) | 75,000 sessions on a peak day, 15 % in the peak hour (A) | About 6 | About 19 | About 100 for 10 minutes after a push blast |
| Telesales and staff | 250 concurrent staff, 200 of them agents (A) | One request per 10 s per user | About 25 | About 50 at shift start |
| Partner API | 30 partners at scale (A) | — | Quotes 20, orders 5, other 5 TPS (A) | 50 TPS |
| Certificate verification | Police, inspection centres, customers (A) | 1 | 5 | 20 |
| Ecosystem events | Tag activations, inspection bookings, top-ups (A) | 1 | 10 | 50 |
| Design point | — | — | About 100 | 300 design, 600 stress target |

Partner figures are sizing assumptions, not commitments. Contractual rate limits per partner are enforced at the API gateway.

Every quote calls TASCO core for rating (`RATING_SOURCE=core`), so quote latency includes core's response time. The tests inject realistic core latency into the sandbox.

## Transaction mix for PERF-S1

| Group | Endpoints | Share |
|---|---|---|
| Customer reads | Customer home (with the quick-renewal check), customer quotes | 25 % |
| Customer quote | Customer quote (TNDS; TNDS with personal accident cover per seat; quick renewal) | 12 % |
| Customer order | Customer order with a unique `Idempotency-Key` | 4 % |
| Customer session | Session from a signed link | 5 % |
| Staff reads | Leads, Customer 360, handoffs, touchpoints | 20 % |
| Staff writes | Handoff update, quote, send quote to customer | 6 % |
| Partner | Partner quote, order, policy list | 15 % |
| Public | Certificate verification | 5 % |
| Events | Ecosystem events | 5 % |
| Dashboards | Overview dashboard (heavy aggregate, rate-capped) | 1 % |
| Sign-in | Password and MFA | 2 % |

# Scenarios

| ID | Scenario | Load profile | Duration | Purpose | Case |
|---|---|---|---|---|---|
| PERF-S1 | Peak-hour mixed load | Ramp to 300 RPS over 10 minutes, hold 30 minutes | 45 min | Targets at the design point | TC-136 |
| PERF-S2 | Push-blast spike | Customer traffic 20 to 150 RPS in 30 s, hold 10 minutes | 15 min | Burst after a journey run | — |
| PERF-S3 | Renewal-day purchase path | 30 orders per second with wallet and core latency injected (p50 300 ms, p95 900 ms) | 30 min | Idempotency and breaker headroom under load | TC-073 |
| PERF-S4 | Partner API burst | 50 TPS from 30 keys | 20 min | Key lookup cost; per-IP limits behind a gateway | — |
| PERF-S5 | Inline drain interference | PERF-S1 plus a backlog of 50,000 pending events | 30 min | Effect of KI-04 on order and quote latency | — |
| PERF-S6 | Staff shift start | 200 sign-ins in 5 minutes plus console reads | 10 min | Password hashing cost; sign-in limit behind a shared office IP | TC-121 |
| PERF-S7 | Volume: initial load | Pilot cohort, then 9 million synthetic records in batches of 2,000 (KI-16) | Until done | Load window, database growth, counts reconcile | TC-137 |
| PERF-S8 | Incremental daily rebuild | 180,000 changed records on top of 6 million | Until done | Finishes within 60 minutes | — |
| PERF-S9 | Full recompute and daily journey run | Recompute, then journeys with 115,000 due touchpoints | Until done | Recompute within 4 hours; journeys within the contact window (KI-12) | — |
| PERF-S10 | Stress to failure | Add 100 RPS every 5 minutes from 300 until targets break or errors exceed 5 % | About 60 min | Breaking point, degradation, recovery | TC-139 |
| PERF-S11 | Soak | 60 % of the design point, with relay and hourly journey runs | 12 h (24 h before scale-up) | Memory and connection leaks | TC-138 |
| PERF-S12 | Wallet degradation | PERF-S1 with the wallet at 50 % errors, then down | 30 min | Circuit opens; the rest stays within targets | TC-079 |
| PERF-S13 | Database failover under load | PERF-S1 plus a managed failover | 30 min | Readiness flips; recovery within 2 minutes; no 500 storm | TC-141 |
| PERF-S14 | TASCO core rating degradation | PERF-S1 with core rating p95 raised to 3 s, then core down | 30 min | Quotes fail closed within the timeout budget (or turn indicative under fallback); circuit opens; other routes within targets | TC-169 |

# Targets

Latency is measured on the server by `http_request_duration_seconds` per route template and confirmed by the load generator. Time spent in external integrations is included where a route calls one. The sandbox adds none, so tests inject realistic latency.

| Route group | Routes | p95 | p99 | 5xx budget |
|---|---|---|---|---|
| Health and public | Health probes, metadata, certificate verification | 150 ms | 300 ms | < 0.1 % |
| Customer reads | Customer home, customer claims | 300 ms | 600 ms | < 0.1 % |
| Quotes (TASCO core rating included) | Customer, staff and partner quotes for a known plate | 500 ms | 1 s | < 0.1 %, excluding core outages |
| Partner quote for a new plate | Partner quote with onboarding and rebuild | 1.2 s | 2.5 s | < 0.5 % |
| Orders (pay and issue) | Customer order (wallet and core); partner order (core only) | 2.5 s, of which 800 ms platform time | 5 s | < 0.5 %, excluding upstream 503 |
| Staff reads | Leads, Customer 360, handoffs, touchpoints, policies | 500 ms | 1 s | < 0.5 % |
| Staff writes | Handoff update, voice turn, consent change | 500 ms | 1 s | < 0.5 % |
| Sign-in | Password and MFA | 600 ms | 1.2 s | < 0.1 % |
| Dashboards | Dashboard routes at 6 million profiles (KI-12) | 3 s | 6 s | < 1 % |
| Batch | Incremental rebuild of 180,000 records | 60 min | — | No failed batches |
| Batch | Full recompute of 6 million | 4 h | — | — |
| Batch | Daily journey run | All due touchpoints done by 12:00 | — | Skips only for policy reasons |

The quote target assumes TASCO core rates within 300 ms at p95; the agreed core figure is a discovery item. Throughput targets are 300 RPS mixed within the targets with CPU at or below 70 % on the planned replicas, and 600 RPS without data corruption.

# Tooling

| Tool | Use |
|---|---|
| `npm run test:perf` (`test/perf/load.js`) | Dependency-free load generator. It starts an in-process server or targets `BASE_URL`, signs in, drives a weighted mix of read and write paths, and reports requests per second, p50, p95, p99 and errors per endpoint. Settings: `DURATION_MS` (15,000), `CONCURRENCY` (25), `P95_BUDGET_MS` (300), `SEED_RECORDS`. Exits 1 above the p95 budget or 1 % errors |
| k6 (optional) | Distributed load when one process cannot reach the target, or to model think time |
| Synthetic generator | Up to 6 million records, generated in province-sized chunks |
| Batch jobs | Migrate, recompute, journeys, reconcile, relay and sync-catalogue, timed; history from `GET /api/ops/jobs` |
| Fault injection | Sandbox ports with latency and error rate (wallet, notifications, simulated TASCO core); network tools for database latency |
| Database | `pg_stat_statements`, `EXPLAIN (ANALYZE, BUFFERS)`, `pg_stat_activity` |

# Test environment

| Component | PERF sizing | Rationale |
|---|---|---|
| Application pods | 3 to 10 (autoscaling at 60 % CPU), each 1 vCPU and 1 GiB requested, 2 vCPU and 1.5 GiB limit; `DB_POOL_MAX` 10 | Mirrors production |
| Relay | Built-in 1 s relay in every pod plus the relay job | As production |
| PostgreSQL 16 | 8 vCPU, 32 GiB, 500 GB SSD with 3,000+ IOPS; connection pooler in transaction mode | Holds 6 million profiles with headroom |
| Load injectors | 2 × 4 vCPU in the same region, outside the cluster | Avoids measuring the injector |
| Integrations | Sandbox with injected latency: wallet p50 300 ms, p95 900 ms; core rating p50 150 ms, p95 300 ms; core issuance p50 500 ms, p95 1.5 s; ZNS 200 ms | Real partners are not load-tested without written agreement |
| Configuration | Production mode, demo mode off, `RATING_SOURCE=core`, trusted proxy on, raised per-IP limit for injector addresses | Otherwise the per-IP limiter throttles the injectors |

# Monitoring during tests

| Signal | Source | Watch for |
|---|---|---|
| Rate, errors and latency per route | `http_requests_total`, `http_request_duration_seconds_bucket` | p95 against the targets; 5xx and 429 |
| Integration health | `integration_calls_total`, `integration_short_circuit_total`, `integration_latency_seconds` (TASCO core) | Retries inflating calls; circuits opening; core latency |
| Rating | `rating_requests_total`, `quotes_indicative_total` | Unavailable results; indicative quotes |
| Event flow | `events_published_total`, `events_processed_total`, event backlog in `GET /api/ops/status` | Backlog growth; dead letters |
| Business throughput | `quotes_total`, `orders_completed_total`, `messages_total`, `voice_calls_total` | Matches the injected mix |
| Process | Memory, uptime (restarts), CPU throttling | Leak slope; out-of-memory kills |
| Database | CPU, IOPS, active and idle-in-transaction sessions, lock waits (audit append lock), slowest statements | Pool saturation; audit append serialisation |
| Logs | JSON request lines with route, status, duration and request ID | Tail latency outliers |

# Pass and fail criteria

| Criterion | Pass |
|---|---|
| Latency | All route groups meet p95 and p99 at 300 RPS (PERF-S1, S3, S4) |
| Errors | 5xx under 0.1 %, excluding injected upstream faults; no internal errors in logs |
| Resources at the design point | Application CPU ≤ 70 %; database CPU ≤ 60 %; pool waits under 100 ms at p95 |
| Spike (S2) | p95 back within target 2 minutes after the spike starts; autoscaling adds pods |
| Volume (S7 to S9) | Cohort loaded and reconciled; rebuild within 60 minutes; journey run within the window |
| Stress (S10) | Degrades with 429 and 503 only; zero corrupted orders; recovery within 5 minutes |
| Soak (S11) | Memory growth under 5 % per hour after 1 hour; no restarts; flat error rate |
| Resilience (S12 to S14) | Wallet outage affects sales only; failover recovery within 2 minutes; core outage affects quoting only and fails closed |
| Regression | CI smoke on every push: p95 ≤ 300 ms, errors ≤ 1 %. Release candidates: p95 within 120 % of the previous PERF baseline |

Each run produces a report with the build, environment, data volume, mix, per-route results, dashboard snapshots, top database statements, findings and tuning actions.

# Capacity model

## Online tier

`pods = ceil(peak_RPS × CPU_ms_per_request / (1000 × 0.6))`

The CPU time per request is calibrated from PERF-S1; the planning value is about 4 ms of event-loop time (A). Sign-ins (one password hash costs 50 to 80 ms of CPU) and orders (bound by wallet and core input/output) are sized separately.

| Stage | Design peak RPS | Planning pods (1 vCPU) | Min and max replicas | Database connections |
|---|---|---|---|---|
| Pilot (50,000 to 100,000 vehicles) | 30 | 2, raised to 3 for availability | 3 and 4 | 30 to 40 |
| Scale phase (6 million base) | 300 | 2 by CPU, 4 for headroom and zone spread | 4 and 10 | 40 to 100, through a pooler |
| Scale phase with partners | 350 | 5 | 5 and 12 | Pooler required |

## Batch tier

Batch work runs sequentially in one process today. At 6 million vehicles this, not the online tier, is the main capacity constraint.

| Job | Work per item | Items | Estimate | Window | Assessment |
|---|---|---|---|---|---|
| Journey run | About 7 queries and one sequential send (200 to 500 ms) per touchpoint; all due touchpoints are paged (KI-05 fixed) | 115,000 per day (peak 300,000) | About 9.6 h sequential; over 24 h at peak | 08:00 to 20:00 | Fits the pilot; does not fit the scale-phase peak without concurrent sends or parallel runs |
| Full lead recompute | 3 to 8 queries per profile with OFFSET paging | 6 million | About 8 h, worse with OFFSET (KI-12) | Weekly overnight | At risk; keyset pagination and parallel workers |
| Incremental rebuild | About 4 queries per plate; chunks of 500 | 60,000 to 180,000 | 4 to 15 minutes | Hourly or daily | Fits |
| Initial load | As above | Pilot cohort; later 6 million plates | Under 1 h for the pilot; 8 to 12 h at full scale | Weekend, split by province | Fits with planning |
| Reconciliation | One lookup per order; OFFSET paging | Orders, growing by 10,000+ per day at scale | Minutes in year 1 | Nightly | Fits; revisit at 5 million orders |
| Catalogue sync | One core call and one merge | Product catalogue | Seconds | Nightly 01:00 | Fits |
| Audit verification | Reads the whole audit log | About 70 million rows per year (A) | Memory-bound (KI-12) | On demand | Needs checkpoints before the scale phase |

## Storage at full scale, year 1

| Table | Rows | Average row (A) | Size |
|---|---|---|---|
| `profiles` | 6 million | 4 KB | About 24 GB |
| `leads` | 6 million | 2.5 KB | About 15 GB |
| `source_records` | 9 million (365-day retention) | 1.2 KB | About 11 GB |
| `touchpoints` | About 42 million per year | 0.7 KB | About 29 GB |
| `messages` | About 36 million per year | 0.9 KB | About 32 GB |
| `domain_events` | About 20 million per year (no retention yet, KI-13) | 0.6 KB | About 12 GB |
| `audit_log` | About 70 million per year (A) | 0.5 KB | About 35 GB |
| `voice_sessions` | About 2.4 million per year (180-day retention) | 3 KB | About 4 GB |
| Orders, quotes, policies, handoffs, claims | About 10 million per year | 1 KB | About 10 GB |
| Total | — | — | About 170 GB plus WAL and PITR; provision 500 GB and alert at 70 % |

## Scaling triggers

| Trigger | Action |
|---|---|
| p95 of any group above 80 % of its target for 3 days | Raise the minimum replicas by one; profile the route |
| Database CPU above 60 % at peak, or connections above 70 % of the maximum | Add or resize the pooler; scale the database; add a read replica for dashboards |
| Journey run not finished by 12:00 | Add in-window runs, or split runs by journey or region |
| Pending events above 10,000 for a sustained period | Increase relay frequency or replicas; investigate slow handlers |
| Core rating p95 above 300 ms for a day | Review with TASCO core IT; check the quote target and the client timeout |
| Disk above 70 % | Expand storage; implement retention for events and audit archive (KI-13) |

# Schedule

| When | Runs |
|---|---|
| Sprints 3 and 4 (December 2026 to 8 January 2027) | Baseline PERF-S1 and S6 on a 500,000-record synthetic base; CI smoke in place |
| Test phase (11 to 22 January 2027) | PERF-S1 to S6 and S10 to S14 at the design point; S7 to S9 at pilot cohort volume; 12-hour soak. Report to the Steering Committee before G3 |
| Pilot weeks 1 and 2 | Re-base the workload model with real traffic, replacing every (A) |
| Before the scale phase | S7 to S11 at 6 million with fixes for KI-04 and KI-12; 24-hour soak |
| Each release | CI smoke; full PERF-S1 when the release touches sales, rating, journeys or persistence |
