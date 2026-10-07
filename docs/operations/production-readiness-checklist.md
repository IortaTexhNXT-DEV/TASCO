# Production Readiness Checklist — TASCO Growth Platform

| Item | Value |
|---|---|
| Gate | **G3 Go / No-go for pilot (22 Jan 2027)**; re-run before **W1 nationwide (29 Mar 2027)** and **W2 partner API (26 Apr 2027)** |
| Owner | iorta TechNXT Delivery Lead (compiles); TASCO IT Head (accepts) |
| Status values | `Not started` · `In progress` · `Done` (evidence linked) · `Waived` (approver + expiry) · `N/A` |
| Rule | Every **P1** item must be `Done` or `Waived` by the SteerCo for go-live. A waiver needs a named approver, a reason, compensating controls and an expiry date |

> The **Status** column records the state at document creation (code review on 2026-10-07). Items blocked by a known issue cite the KI ID ([register](../quality/test-strategy.md#appendix-a--known-issues-register-from-code-review-2026-10-07)). Update this table in place at each readiness review.

---

## 1. Security

| ID | Check | Pri | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-SEC-01 | Production secrets in vault/KMS, injected via `<NAME>_FILE`; none in env files, images or git (gitleaks clean) | P1 | SRE | Secret inventory, gitleaks report | Not started |
| PRC-SEC-02 | `NODE_ENV=production`; boot refuses missing `JWT_SECRET`, `DATA_KEYS`, `BLIND_INDEX_KEY` (verified by test) | P1 | Dev lead | TC config tests | In progress |
| PRC-SEC-03 | `DEMO_MODE=false`; `ALLOW_DEMO_IN_PRODUCTION` unset; `/api/demo/totp/*` → 404 (SYN-06) | P1 | SRE | Synthetic result | Not started |
| PRC-SEC-04 | **`npm run job -- seed` cannot run against PROD** (KI-01 fixed, or `seed` excluded from PROD manifests and RBAC denies `kubectl exec`) | P1 | Dev lead | Fix PR / manifest review | Not started (KI-01) |
| PRC-SEC-05 | No demo users in the PROD DB (`GET /api/users` shows no `admin`, `exec`, `agent.hn`… with the demo password); named accounts only | P1 | Admin | User export | Not started |
| PRC-SEC-06 | MFA enforced for `admin`, `rule_approver`, `compliance_officer`, `data_steward` (`MFA_REQUIRED_ROLES`) with self-enrolment; lockout across both factors and TOTP replay protection (KI-06 fixed); separation-of-duties pairs in `rbac.json` reviewed by Security | P1 | Security | TC-010, TC-020, TC-027 | In progress |
| PRC-SEC-07 | Rate limiting at the gateway/WAF in front of the in-process limiter (multi-replica, KI-07); `TRUST_PROXY=true` with the real client IP | P1 | SRE | WAF config | Not started |
| PRC-SEC-08 | Independent penetration test: no open critical/high; mediums with a dated plan | P1 | TASCO CISO | Pen-test report | Not started |
| PRC-SEC-09 | CI security gates green on the release tag: CodeQL, `npm run audit`, gitleaks, Trivy (no critical/high), ZAP baseline (no high), SBOM attached | P1 | DevSecOps | CI run link | In progress |
| PRC-SEC-10 | `METRICS_TOKEN` set; `/metrics` not reachable from the internet (KI-14); NetworkPolicy allows only Prometheus | P1 | SRE | `curl` from outside → 401/404 | Not started |
| PRC-SEC-11 | `CORS_ORIGINS` set to the exact console/app origins | P1 | SRE | Config | Not started |
| PRC-SEC-12 | TLS everywhere: ingress certificate valid, HSTS (production), `DATABASE_SSL=true` with a CA-verified certificate | P1 | SRE | SSL Labs grade A | Not started |
| PRC-SEC-13 | DB roles: app role with no DDL at runtime and not the table owner (migration Job uses a separate role); `audit_log` immutability triggers enabled (migrations 001/002) and no UPDATE/DELETE/TRUNCATE grant for the app role; pgaudit on | P1 | DBA | Grants + `pg_trigger` export | Not started |
| PRC-SEC-14 | Access review of staff roles and regions signed by line managers | P2 | TASCO IT Security | Signed list | Not started |
| PRC-SEC-15 | Admin unlock / MFA reset procedure agreed (SOP-08) or KI-27 fixed | P2 | Security | SOP sign-off | Not started (KI-27) |
| PRC-SEC-16 | Signed links expire (`LINK_TTL_DAYS`, done); separate link key from `JWT_SECRET` (KI-08) or accept the risk | P3 | Security | Fix PR / risk acceptance | In progress (KI-08) |

## 2. Functional and quality

| ID | Check | Pri | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-FUNC-01 | UAT signed off (all personas; compliance scenarios without waiver) | P1 | TASCO Business Owner | [UAT sign-off sheet](../quality/uat-plan.md#6-sign-off-sheet) | Not started |
| PRC-FUNC-02 | SIT passed with VETC wallet/SSO/app/events, TASCO core, Zalo ZNS, SMS, voice vendor (TC-150 – TC-155, TC-161) | P1 | QA Lead | SIT report | Not started (production adapters pending) |
| PRC-FUNC-03 | Coverage gate (≥ 80/80/70 %) and all automated suites green on the release tag | P1 | QA Lead | CI | In progress |
| PRC-FUNC-04 | Front-end pages present in the release image: staff console (`index.html`), customer app (`/app/`), `/verify/<certNo>` (`verify.html`); SYN-09 green | P1 | UX lead | Smoke test | In progress (pages added by UX workstream; KI-15 resolved) |
| PRC-FUNC-05 | Sev 1 known issues fixed: KI-01, KI-02, KI-28 (KI-09 fixed: keep TC-135 green) | P1 | Dev lead | Fix PRs + regression TCs | In progress |
| PRC-FUNC-06 | Sev 2 known issues fixed or waived with a date: KI-03, KI-04, KI-05, KI-13, KI-18, KI-25, KI-33 | P1 | Dev lead / PO | KI register | Not started |
| PRC-FUNC-07 | OpenAPI document published to partners and matching the release (TC-133) | P2 | Tech lead | `docs/api/openapi.json` | Not started |
| PRC-FUNC-08 | Accessibility: axe 0 serious/critical; manual screen-reader pass on the renewal flow (TC-144, TC-145) | P1 | UX lead | Report | Not started |

## 3. Performance and capacity

| ID | Check | Pri | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-PERF-01 | PERF-S1 mixed load at the pilot design point (and 300 RPS before W1) meets the SLOs | P1 | Perf engineer | Perf report | Not started |
| PRC-PERF-02 | Volume: pilot cohort (100–200 k) loaded and reconciled; 6 M volume test before W1 | P1 | Perf + Data | PERF-S7 report | Not started |
| PRC-PERF-03 | Daily journey run completes inside the window at pilot volume; extra runs scheduled until KI-05 is fixed | P1 | Campaign + SRE | Run logs | Not started (KI-05) |
| PRC-PERF-04 | Soak 12 h with no leak (24 h before W1) | P2 | Perf engineer | PERF-S11 | Not started |
| PRC-PERF-05 | HPA, PDB, resource requests/limits configured per the capacity model | P1 | SRE | Manifests | In progress (deploy assets) |
| PRC-PERF-06 | PgBouncer or connection budget: replicas × `DB_POOL_MAX` < 70 % of `max_connections` | P1 | DBA | Calculation | Not started |

## 4. Observability and operations

| ID | Check | Pri | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-OPS-01 | Prometheus scraping `/metrics`; dashboards D1–D7 live; alert rules ALR-xx loaded and `promtool`-tested; routes to on-call | P1 | SRE | Grafana links | Not started |
| PRC-OPS-02 | `/health/ready` used for readiness and `/health/live` for liveness; **readiness shows `store:"postgres"`** (KI-28 guard); `terminationGracePeriodSeconds` ≥ 30 | P1 | SRE | Manifest + SYN-01 | Not started (KI-28) |
| PRC-OPS-03 | Logs shipped and searchable by `requestId`, `route`, `status`; retention ≥ 90 days; no PII in logs (LOG-07 clean) | P1 | SRE | Log query screenshot | Not started |
| PRC-OPS-04 | CronJobs deployed: journeys **01:30 UTC** (08:30 ICT), relay, reconcile, retention, weekly recompute; `concurrencyPolicy: Forbid`; **no `seed` CronJob** | P1 | SRE | Manifests | In progress |
| PRC-OPS-05 | Migration Job runs before rollout; `MIGRATE_ON_START=false` in Kubernetes (concurrent migrators are serialised by an advisory lock anyway, KI-30 fixed) | P1 | SRE | Manifests | In progress |
| PRC-OPS-06 | SQL exporter metrics (`tasco_db_*`) for the outbox backlog, journey backlog, open handoffs and order status | P2 | SRE | Dashboard D3 | Not started |
| PRC-OPS-07 | Runbook RB-01 – RB-15 and SOP-01 – SOP-09 walked through by L2 (tabletop) | P1 | L2 lead | Attendance + feedback | Not started |
| PRC-OPS-08 | On-call rota live (L2 + L3 hypercare); paging tested end to end | P1 | L2 lead | Test page | Not started |
| PRC-OPS-09 | ITSM categories, severity matrix, SLAs configured; KEDB seeded (runbook §6) | P1 | Service desk | ITSM config | Not started |
| PRC-OPS-10 | Synthetic checks SYN-01 – SYN-09 live | P1 | SRE | Results | Not started |
| PRC-OPS-11 | Dead-letter/stuck-event recovery tool (KI-03) or the SQL procedure in RB-06 approved by the DBA | P2 | Dev lead / DBA | Approval | Not started (KI-03) |

## 5. Resilience and DR

| ID | Check | Pri | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-DR-01 | PITR enabled, 35-day retention, cross-region copy; backup alert ALR-93 | P1 | DBA | Provider config | Not started |
| PRC-DR-02 | DR-T1 restore test passed (≤ 60 min, RPO ≤ 5 min) | P1 | DBA | Report | Not started |
| PRC-DR-03 | DR-T2 AZ failover passed under load | P1 | SRE | Report | Not started |
| PRC-DR-04 | DR egress IPs allow-listed by VETC wallet, TASCO core, SMS, Zalo, voice vendor | P1 | Integration lead | Partner confirmations | Not started |
| PRC-DR-05 | Key escrow and recovery drill (DR-T5): all `DATA_KEYS` IDs + `BLIND_INDEX_KEY` recoverable | P1 | Security | Drill record | Not started |
| PRC-DR-06 | Circuit-breaker behaviour verified per integration (TC-079, TC-140) | P1 | QA | Tests | In progress |
| PRC-DR-07 | Vendor outage BCP tabletop (DR-T6) completed | P2 | IC / Business | Minutes | Not started |

## 6. Compliance and legal sign-offs

| ID | Check | Pri | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-COMP-01 | **Content inventory sign-off**: every active `content.messages` template, the `content.voicebot` script and `benefits` texts (vi) reviewed; no discount, rebate or cashback language; copy-guard list complete (KI-26 whitespace variants reviewed manually) | P1 | TASCO Compliance | Signed inventory with rule checksums | Not started |
| PRC-COMP-02 | **Contact policy confirmed by Legal** (`contact_policy.json`: window 08:00–20:00, 1/day and 3/week marketing, 2 calls/week, consent mapping, service-message bypass) under Decree 91/2020/ND-CP and the PDP rules | P1 | TASCO Legal | Legal memo | Not started |
| PRC-COMP-03 | **Voice campaign and journeys respect the contact policy**: KI-09 fixed (TC-135 green); the `at` time override disabled in production (KI-33, TC-162); bot disclosure wording approved | P1 | Compliance + Dev | TC-135, TC-162, script sign-off | In progress (KI-33 open) |
| PRC-COMP-04 | **Benefits with `legalStatus: pending_legal_review`** (`loyalty_points` in `benefits.json`; `referral.json` disabled) remain hidden from customers until legal approval; any change to approved goes via maker-checker with the legal memo attached | P1 | TASCO Legal | Memo; TC-041 | In progress (control in place; approval pending) |
| PRC-COMP-05 | **Zalo ZNS templates approved by Zalo** for every `templateKey` used on `zalo_zns` (all 12 keys in `content.messages.json`: `verify_expiry`, `first_reminder`, `conquest_reminder`, `value_reminder`, `urgent_reminder`, `expiry_day`, `lapsed_notice`, `new_vehicle_welcome`, `inspection_tnds_check`, `cross_sell`, `purchase_confirmation`, `quote_ready`) with parameter mapping | P1 | Marketing + Integration lead | Zalo approval IDs mapped to template keys | Not started |
| PRC-COMP-06 | SMS brandname registered; SMS templates registered where required | P1 | Marketing | Provider confirmation | Not started |
| PRC-COMP-07 | **Tariffs confirmed by TASCO underwriting**: `tariff.tnds_car`, `tariff.tnds_motorbike` (Decree 67/2023/ND-CP); the illustrative `rating.motor_pd` and `rating.pa_seat` replaced with filed rates via maker-checker | P1 | TASCO Underwriting / Actuarial | Approved rule versions | Not started |
| PRC-COMP-08 | **Commission caps confirmed by Finance and Legal** (`commission.json` `statutoryCaps`) | P1 (before W2) | TASCO Finance | Memo | Not started |
| PRC-COMP-09 | **PDP compliance**: privacy notice and consent wording in the app; DPIA completed; data processing agreements VETC ↔ TASCO ↔ iorta; cross-border transfer assessment (none expected) | P1 | DPO | DPIA | Not started |
| PRC-COMP-10 | DSAR procedure (SOP-05) operational; erasure covers profile, messages, sessions, handoffs and claims (KI-29 fixed; TC-107) | P1 | DPO | SOP sign-off | In progress |
| PRC-COMP-11 | Retention: archival pipeline for profiles, messages, orders and certificates built or waived by Legal (KI-13); `retention` CronJob live | P2 | DPO + Dev | Job runs | Not started (KI-13) |
| PRC-COMP-12 | Maker-checker roles staffed: at least 2 approvers (MFA) and 2 authors, never the same person; emergency rollback pair on call | P1 | PO | Named list | Not started |
| PRC-COMP-13 | Audit chain verifying (`GET /api/audit/verify` ok) at go-live, chain head exported to WORM | P1 | Compliance | Screenshot + export | Not started |

## 7. Data migration and initial load

| ID | Check | Pri | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-DATA-01 | Data-sharing agreement for VETC account and TASCO core extracts | P1 | Legal | Signed DSA | Not started |
| PRC-DATA-02 | Pilot cohort extract (HN + HCM, expiry in 15–60 days + lapsed ≤ 60 days, 100–200 k) delivered and profiled | P1 | Data steward | Profiling report | Not started |
| PRC-DATA-03 | Initial load executed in PROD in batches (≤ 2,000 records each, KI-16); counts reconcile (TC-112); DQ issue volume within the expected range | P1 | Data steward + L3 | Load log | Not started |
| PRC-DATA-04 | Lead recompute after load; journeys dry run on a sample; touchpoint volumes per day agreed with campaign managers | P1 | Campaign manager | Dry-run summary | Not started |
| PRC-DATA-05 | Rule sets seeded (`npm run job -- rules`) and every kind's checksum recorded in the change log | P1 | Tech lead | `GET /api/ops/status` | Not started |
| PRC-DATA-06 | Partner master data and API keys issued for first partners (W2) | P2 (W2) | Partner manager | Partner list | Not started |

## 8. People, process and support

| ID | Check | Pri | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-PPL-01 | Pilot users trained (telesales squads HN/HCM, supervisors, campaign, compliance, steward, claims) | P1 | PO | Attendance | Not started |
| PRC-PPL-02 | VETC CS briefed: scripts, KEDB, escalation path | P1 | VETC CS lead | Briefing record | Not started |
| PRC-PPL-03 | Hypercare plan, war room and daily KPI review scheduled ([go-live plan](go-live-and-hypercare-plan.md)) | P1 | Delivery lead | Calendar | Not started |
| PRC-PPL-04 | Release notes and rollback plan for the go-live release approved by CAB | P1 | Release manager | CAB minutes | Not started |
| PRC-PPL-05 | Partner and customer communication assets approved (launch, incident templates) | P2 | Marketing + Compliance | Templates | Not started |

## 9. Sign-off

| Area | Approver | Decision | Date | Signature |
|---|---|---|---|---|
| Security | TASCO CISO | | | |
| Compliance and legal | TASCO Compliance Officer / Legal | | | |
| Operations readiness | TASCO IT Production Support lead | | | |
| Infrastructure and DR | TASCO IT Head | | | |
| Business | TASCO Business Owner | | | |
| VETC channel | VETC Product Owner / IT Lead | | | |
| Delivery | iorta TechNXT Delivery Lead | | | |
