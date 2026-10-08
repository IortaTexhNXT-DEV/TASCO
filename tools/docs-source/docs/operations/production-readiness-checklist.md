---
id: TGP-OPS-04
title: Production Readiness Checklist
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 07/10/2026
prepared_by: iorta TechNXT, Service Operations
reviewed_by: TASCO Insurance, Head of IT
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [ALR, Alert Rule]
  - [API, Application Programming Interface]
  - [CAB, Change Advisory Board]
  - [CI, Continuous Integration]
  - [CISO, Chief Information Security Officer]
  - [CORS, Cross-Origin Resource Sharing]
  - [DBA, Database Administrator]
  - [DDL, Data Definition Language]
  - [DPIA, Data Protection Impact Assessment]
  - [DPO, Data Protection Officer]
  - [DR, Disaster Recovery]
  - [DSAR, Data Subject Access Request]
  - [HSTS, HTTP Strict Transport Security]
  - [ID, Identifier]
  - [IT, Information Technology]
  - [ITSM, IT Service Management]
  - [KI, Known Issue]
  - [MFA, Multi-Factor Authentication]
  - [OAuth, Open Authorization]
  - [PDP, Personal Data Protection]
  - [PO, Product Owner]
  - [PRC, Production Readiness Check]
  - [QA, Quality Assurance]
  - [RB, Runbook procedure]
  - [RPO, Recovery Point Objective]
  - [SBOM, Software Bill of Materials]
  - [SIT, System Integration Testing]
  - [SMS, Short Message Service]
  - [SOP, Standard Operating Procedure]
  - [SQL, Structured Query Language]
  - [SRE, Site Reliability Engineering]
  - [TC, Test Case]
  - [TLS, Transport Layer Security]
  - [TNDS, Compulsory motor third-party liability insurance (Bảo hiểm TNDS bắt buộc)]
  - [UAT, User Acceptance Testing]
  - [UTC, Coordinated Universal Time]
  - [UX, User Experience]
  - [WAF, Web Application Firewall]
  - [WORM, Write Once Read Many]
  - [ZAP, Zed Attack Proxy]
  - [ZNS, Zalo Notification Service]
signoff:
  - ["TASCO core interface specification (rating, catalogue, issuance, cancellation, error codes, scopes) confirmed", TASCO IT Architecture, Open]
  - [TASCO core UAT and production client credentials issued, TASCO IT Architecture, Open]
  - ["Rating mode for production (core only, or core with indicative fallback) decided", TASCO Business Owner, Open]
  - ["Contact policy, benefits wording, loyalty points and commission caps to be confirmed by TASCO legal", TASCO Legal, Open]
  - [Tariffs for physical damage cover and personal accident cover per seat confirmed as filed rates, TASCO Underwriting, Open]
  - [Zalo ZNS templates approved by Zalo for every template used, TASCO Marketing, Open]
---

# Introduction

This checklist is the evidence base for the go-live decision. Each check has an owner, the evidence that proves it and its current status. The Steering Committee uses it at gate G3 (go or no-go for the pilot, 26 January 2027), and it is run again before each scale-up step.

It covers security, functional quality, performance, observability and operations, resilience and DR, the TASCO core integration, compliance and legal sign-offs, data migration, and people and process.

The audience is the iorta TechNXT Delivery Lead, who compiles the checklist, the TASCO Head of IT, who accepts it, and the Steering Committee.

Related documents:

- TGP-QA-01 Test Strategy (known issues KI-xx) and TGP-QA-02 Test Case Catalogue.
- TGP-QA-04 User Acceptance Test Plan.
- TGP-OPS-01 Runbook and Support Guide, TGP-OPS-02 Monitoring and Alerting and TGP-OPS-03 Disaster Recovery and Business Continuity Plan.
- TGP-OPS-05 Go-Live and Hypercare Plan.

## How to use it

| Item | Rule |
|---|---|
| Status values | Not started; In progress; Done (evidence linked); Waived (approver and expiry); Not applicable |
| Gate rule | Every P1 item is Done or Waived by the Steering Committee before go-live |
| Waivers | Name the approver, the reason, the compensating controls and an expiry date |
| Current state | Status as at 7 October 2026 (release 1.0.0). Items blocked by an open known issue name it. Test evidence is in TASCO-Test-Cases-and-Results.xlsx. Update the table in place at each review |

# Security

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-SEC-01 | Production secrets in the vault, injected as `<NAME>_FILE`; none in environment files, images or git | P1 | SRE | Secret inventory; gitleaks report | Not started |
| PRC-SEC-02 | Production start-up refuses missing `JWT_SECRET`, `DATA_KEYS`, `BLIND_INDEX_KEY` or `DATABASE_URL`, demo mode, and local rating without approval | P1 | Dev lead | TC-159, TC-176 | Done in code; confirm in production configuration |
| PRC-SEC-03 | Demo mode off; demo code helper returns 404 (SYN-06) | P1 | SRE | Synthetic result | Not started |
| PRC-SEC-04 | Seed job cannot run against production (KI-01 fixed); no seed job in the manifests; `kubectl exec` denied | P1 | Dev lead | TC-134; manifest review | In progress: code done, manifest and access review pending |
| PRC-SEC-05 | No demo users in the production database; named accounts only; `DEMO_PASSWORD`, `DEMO_TOTP_SEED` and `DEMO_ACCOUNT_SYNC` unset | P1 | Administrator | User export; configuration review | Not started |
| PRC-SEC-06 | MFA enforced for administrator, rule approver, compliance officer and data steward with self-enrolment; lockout across both factors (KI-06 fixed); separation-of-duties pairs and restricted rule kinds reviewed by Security | P1 | Security | TC-010, TC-020, TC-027 | In progress |
| PRC-SEC-07 | Rate limiting at the gateway or WAF in front of the per-replica limiter (KI-07); trusted proxy settings match the proxy chain | P1 | SRE | WAF configuration | Not started |
| PRC-SEC-08 | Independent penetration test: no open critical or high findings; mediums with a dated plan | P1 | TASCO CISO | Report | Not started |
| PRC-SEC-09 | CI security gates green on the release tag: CodeQL, dependency audit, gitleaks, Trivy, ZAP, SBOM | P1 | DevSecOps | CI run | In progress |
| PRC-SEC-10 | Metrics token set (KI-14 fixed); `/metrics` unreachable from the internet; network policy allows only Prometheus | P1 | SRE | External request returns 401 or 404 | Not started |
| PRC-SEC-11 | CORS origins set to the exact console and app origins | P1 | SRE | Configuration | Not started |
| PRC-SEC-12 | TLS everywhere: valid ingress certificate, HSTS, database TLS with a verified certificate | P1 | SRE | TLS scan grade A | Not started |
| PRC-SEC-13 | Database roles: application role without DDL and not the table owner; audit triggers enabled with no update, delete or truncate grants; pgaudit on | P1 | DBA | Grants and trigger export | Not started |
| PRC-SEC-14 | Staff roles and regions reviewed and signed by line managers | P2 | TASCO IT Security | Signed list | Not started |
| PRC-SEC-15 | Administrator unlock and MFA reset (KI-27 fixed); SOP-08, including forgotten passwords, agreed by Security | P2 | Security | SOP sign-off | In progress: function done |
| PRC-SEC-16 | Renewal links expire; separate link key from the token secret (KI-08) or the risk accepted | P3 | Security | Fix or risk acceptance | In progress (KI-08) |

# Functional quality

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-FUNC-01 | UAT signed off by every persona; compliance scenarios without waiver | P1 | TASCO Business Owner | TGP-QA-04 sign-off sheet | Not started |
| PRC-FUNC-02 | SIT passed with VETC wallet, sign-on, app and events, TASCO core rating, catalogue and issuance, Zalo ZNS, SMS and the voice vendor (TC-150 to TC-155, TC-161, TC-180) | P1 | QA Lead | SIT report | Not started: production adapters pending |
| PRC-FUNC-03 | Coverage gate and all automated suites green on the release tag | P1 | QA Lead | 255 tests: 252 passed, 3 to-do; coverage 99.41 % lines, 88.25 % branches, 97.12 % functions | Done for 1.0.0; re-run on the release tag |
| PRC-FUNC-04 | Redesigned staff console, customer app and certificate verification page in the release image; SYN-09 green | P1 | UX lead | Smoke test | In progress: redesign under way (KI-15 fixed) |
| PRC-FUNC-05 | Sev 1 known issues fixed: KI-01, KI-02, KI-09, KI-28 | P1 | Dev lead | TC-080, TC-134, TC-135, TC-159 | Done |
| PRC-FUNC-06 | Open Sev 2 issues KI-04, KI-13 and KI-18 fixed or waived with a date (KI-05, KI-25 and KI-33 are fixed); KI-03 replay tool or the RB-06 procedure approved | P1 | Dev lead and PO | TGP-QA-01 known issues | In progress |
| PRC-FUNC-07 | API documentation published to partners and matching the release (TC-133) | P2 | Tech lead | Published OpenAPI document | Not started |
| PRC-FUNC-08 | Accessibility: no serious or critical violations; manual screen reader pass on the renewal flow (TC-144, TC-145) | P1 | UX lead | Report | Not started |

# Performance and capacity

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-PERF-01 | PERF-S1 at the design point meets the targets, with TASCO core latency injected | P1 | Performance engineer | Report | Not started |
| PRC-PERF-02 | Pilot cohort (50,000 to 100,000 vehicles) loaded and reconciled; 6 million volume test before the scale phase | P1 | Performance engineer and data steward | PERF-S7 report | Not started |
| PRC-PERF-03 | Daily journey run completes within contact hours at pilot volume; all due touchpoints paged and window-blocked ones deferred (KI-05 fixed) | P1 | Campaign manager and SRE | Run logs | Not started |
| PRC-PERF-04 | 12-hour soak with no leak (24 hours before the scale phase) | P2 | Performance engineer | PERF-S11 | Not started |
| PRC-PERF-05 | Autoscaling, disruption budget and resource limits set per the capacity model | P1 | SRE | Manifests | In progress |
| PRC-PERF-06 | Connection budget: replicas × pool size under 70 % of the database maximum, or a pooler | P1 | DBA | Calculation | Not started |

# Observability and operations

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-OPS-01 | Metrics scraped; dashboards D1 to D7 live; alert rules ALR-xx loaded, tested and routed to on-call | P1 | SRE | Dashboard links | Not started |
| PRC-OPS-02 | Readiness and liveness probes in use; readiness shows store `postgres`; grace period at least 30 s | P1 | SRE | Manifest; SYN-01 | In progress: manifest sets 30 s |
| PRC-OPS-03 | Logs shipped and searchable by request ID, route and status; kept 90 days; no personal data (LOG-07 clean) | P1 | SRE | Log query | Not started |
| PRC-OPS-04 | Scheduled jobs deployed (UTC): journeys 01:15, recompute 17:30, sync-catalogue 18:00, reconcile 19:00, retention 20:00, relay every 5 minutes; no overlap; no seed job | P1 | SRE | Manifests | In progress: manifests done |
| PRC-OPS-05 | Migration job runs before rollout; migrate-on-start off in Kubernetes (KI-30 fixed) | P1 | SRE | Manifests | In progress |
| PRC-OPS-06 | Database exporter series for the outbox, journey backlog, open handoffs, orders and indicative quotes | P2 | SRE | Dashboard D3 | Not started |
| PRC-OPS-07 | Procedures RB-01 to RB-18 and SOP-01 to SOP-09 walked through by L2 | P1 | L2 lead | Attendance and feedback | Not started |
| PRC-OPS-08 | On-call rota live (L2, and L3 for hypercare); paging tested end to end | P1 | L2 lead | Test page | Not started |
| PRC-OPS-09 | ITSM categories, severity matrix and service levels configured; known-error database seeded | P1 | Service desk | ITSM configuration | Not started |
| PRC-OPS-10 | Synthetic checks SYN-01 to SYN-09 live | P1 | SRE | Results | Not started |
| PRC-OPS-11 | Dead-letter recovery tool (KI-03) or the RB-06 SQL procedure approved by the DBA | P2 | Dev lead and DBA | Approval | Not started |

# Resilience and DR

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-DR-01 | Point-in-time recovery on, 35 days, cross-region copy; backup alert ALR-93 | P1 | DBA | Provider configuration | Not started |
| PRC-DR-02 | DR-T1 restore within 60 minutes and RPO within 15 minutes | P1 | DBA | Report | Not started |
| PRC-DR-03 | DR-T2 zone failover under load | P1 | SRE | Report | Not started |
| PRC-DR-04 | DR egress addresses allow-listed by VETC wallet, TASCO core (including the token endpoint), SMS, Zalo and the voice vendor | P1 | Integration lead | Partner confirmations | Not started |
| PRC-DR-05 | Key escrow and recovery drill (DR-T5): all data keys, the blind-index key and the TASCO core client secret | P1 | Security | Drill record | Not started |
| PRC-DR-06 | Circuit behaviour verified per integration (TC-079, TC-140, TC-178) | P1 | QA | Tests | In progress |
| PRC-DR-07 | Vendor outage tabletop (DR-T6), including TASCO core | P2 | Incident Commander and business | Minutes | Not started |

# TASCO core integration

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-CORE-01 | TASCO core interface specification confirmed: rating, catalogue, issuance, cancellation, error codes, OAuth scopes. The client's assumed paths (`/oauth2/token`, `/rating/v1/quotes`, `/products/v1/catalogue`) aligned and contract tests updated | P1 | Integration lead and TASCO core IT | Signed specification; updated tests | Not started: client built on assumed paths |
| PRC-CORE-02 | Client credentials issued for UAT and production; secret in the vault as `TASCO_CORE_CLIENT_SECRET_FILE`; client certificate if TASCO requires mutual TLS; rotation owner named | P1 | SRE and TASCO core IT | Vault inventory | Not started |
| PRC-CORE-03 | Rating mode decided by TASCO and set: `core` (shipped default) or `core_with_fallback`; `ALLOW_LOCAL_RATING` unset; integration status shows mode `http` | P1 | TASCO Business Owner and SRE | Decision record; integration status | In progress: production configuration ships `core` |
| PRC-CORE-04 | Production issuance adapter built and SIT-tested with the core quote reference (TC-153, TC-170) | P1 | Dev lead | SIT report | Not started: issuance is a sandbox adapter |
| PRC-CORE-05 | Catalogue sync job live; first proposal reviewed and approved by a rule approver; channels configured for new products | P1 | TASCO Product Owner | Approved products version | In progress: job and manifest done |
| PRC-CORE-06 | TASCO core latency target and rate limits agreed; SIT TC-180 passed; alerts ALR-13 to ALR-16 tuned | P1 | TASCO IT Architecture | Agreement; SIT report | Not started |
| PRC-CORE-07 | TASCO core recovery targets recorded in the interface agreement and reflected in TGP-OPS-03 | P2 | TASCO Head of IT | Interface agreement | Not started |

# Compliance and legal

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-COMP-01 | Content inventory signed: every active message template, the voice script and benefit texts in Vietnamese; no discount, rebate or cashback language (KI-26 fixed) | P1 | TASCO Compliance | Signed inventory with rule checksums | Not started |
| PRC-COMP-02 | Contact policy confirmed by TASCO legal: 08:00 to 20:00, 1 per day and 3 per week marketing, 2 calls per week, consent mapping, service-message exemption, under Decree 91/2020/ND-CP and the PDP rules | P1 | TASCO Legal | Legal memo | Not started |
| PRC-COMP-03 | Voice campaigns and journeys respect the contact policy (KI-09 and KI-33 fixed; TC-135, TC-162); bot disclosure wording approved | P1 | Compliance and dev lead | Tests; script sign-off | In progress: script sign-off pending |
| PRC-COMP-04 | Benefits pending legal review (loyalty points; referral disabled) and unavailable items (auto-renew, fleet dashboard) hidden from customers; loyalty points never promised; approval only through maker-checker with the legal memo | P1 | TASCO Legal | Memo; TC-041 | In progress: control in place, approval pending |
| PRC-COMP-05 | Zalo ZNS templates approved by Zalo for all 12 template keys used, with parameter mapping | P1 | Marketing and integration lead | Approval IDs mapped to keys | Not started |
| PRC-COMP-06 | SMS brandname and templates registered | P1 | Marketing | Provider confirmation | Not started |
| PRC-COMP-07 | Tariffs confirmed by TASCO underwriting: TNDS car and motorbike (Decree 67/2023/ND-CP); physical damage and personal accident rates replaced with filed rates. With core rating, the platform tariffs are used only for indicative prices | P1 | TASCO Underwriting | Approved rule versions | Not started |
| PRC-COMP-08 | Commission caps confirmed by TASCO Finance and Legal | P1 before the first partner goes live | TASCO Finance | Memo | Not started |
| PRC-COMP-09 | Privacy notice and consent wording in the app; DPIA completed; data processing agreements between VETC, TASCO and iorta TechNXT; no cross-border transfer | P1 | DPO | DPIA | Not started |
| PRC-COMP-10 | DSAR procedure (SOP-05) working; export and erasure scope complete (KI-29 fixed; TC-105, TC-107) | P1 | DPO | SOP sign-off | In progress |
| PRC-COMP-11 | Archival for profiles, messages, orders and certificates built, or waived by TASCO legal (KI-13); retention job live | P2 | DPO and dev lead | Job runs or waiver | Not started (KI-13) |
| PRC-COMP-12 | Maker-checker staffed: at least 2 approvers with MFA and 2 authors, never the same person, and a compliance officer for restricted rule kinds; emergency rollback pair on call | P1 | PO | Named list | Not started |
| PRC-COMP-13 | Audit chain verifies at go-live; chain head exported to WORM storage | P1 | Compliance | Screenshot and export | Not started |

# Data migration and initial load

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-DATA-01 | Data-sharing agreement for VETC account and TASCO core extracts | P1 | Legal | Signed agreement | Not started |
| PRC-DATA-02 | Pilot cohort extract (50,000 to 100,000 vehicles, with about 10 % held out as the control group) delivered and profiled | P1 | Data steward | Profiling report | Not started |
| PRC-DATA-03 | Initial load in production in batches of 2,000 or fewer (KI-16); counts reconcile (TC-112); data quality issue volume as expected | P1 | Data steward and L3 | Load log | Not started |
| PRC-DATA-04 | Lead recompute after load; journey dry run on a sample; daily touchpoint volumes agreed with campaign managers | P1 | Campaign manager | Dry-run summary | Not started |
| PRC-DATA-05 | Rule sets seeded and every kind's checksum recorded in the change log | P1 | Tech lead | Operations status | Not started |
| PRC-DATA-06 | First partner's master data and API key issued | P2 | Partner manager | Partner list | Not started |

# People and process

| ID | Check | Priority | Owner | Evidence | Status |
|---|---|---|---|---|---|
| PRC-PPL-01 | Pilot users trained: telesales teams, supervisors, campaign, compliance, data steward, claims | P1 | PO | Attendance | Not started |
| PRC-PPL-02 | VETC customer service briefed: scripts, known errors, escalation path | P1 | VETC customer service lead | Briefing record | Not started |
| PRC-PPL-03 | Hypercare plan, war room and daily review scheduled (TGP-OPS-05) | P1 | Delivery lead | Calendar | Not started |
| PRC-PPL-04 | Release notes and rollback plan for the go-live release approved by CAB | P1 | Release manager | CAB minutes | Not started |
| PRC-PPL-05 | Partner and customer communications approved (launch and incident templates) | P2 | Marketing and Compliance | Templates | Not started |

# Appendix

## Area approvals

| Area | Approver | Decision | Date |
|---|---|---|---|
| Security | TASCO CISO | | |
| Compliance and legal | TASCO Compliance Officer and Legal | | |
| Operations | TASCO IT Production Support lead | | |
| Infrastructure and DR | TASCO Head of IT | | |
| TASCO core integration | TASCO IT Architecture | | |
| Business | TASCO Business Owner | | |
| VETC channel | VETC Product Owner and IT Lead | | |
| Delivery | iorta TechNXT Delivery Lead | | |
