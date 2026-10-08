---
id: TGP-BUS-03
title: Non-Functional Requirements
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 07/10/2026
prepared_by: iorta TechNXT, Solution Architecture
reviewed_by: TASCO Insurance, IT Architecture and IT Security
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [AES, Advanced Encryption Standard]
  - [API, Application Programming Interface]
  - [ASVS, Application Security Verification Standard]
  - [CI, Continuous integration]
  - [CORS, Cross-origin resource sharing]
  - [CPU, Central processing unit]
  - [CSP, Content security policy]
  - [DPIA, Data protection impact assessment]
  - [DR, Disaster recovery]
  - [FR, Functional requirement]
  - [GCM, Galois/Counter Mode]
  - [HSTS, HTTP Strict Transport Security]
  - [HTTP, Hypertext Transfer Protocol]
  - [ID, Identifier]
  - [IDOR, Insecure direct object reference]
  - [IT, Information technology]
  - [LTS, Long-term support]
  - [MB, Megabyte]
  - [OTP, One-time password]
  - [OWASP, Open Worldwide Application Security Project]
  - [PITR, Point-in-time recovery]
  - [QA, Quality assurance]
  - [SMS, Short message service]
  - [SQL, Structured Query Language]
  - [TLS, Transport Layer Security]
  - [TOTP, Time-based one-time password]
  - [UAT, User acceptance testing]
  - [US, User story]
  - [WAL, Write-ahead log]
  - [WCAG, Web Content Accessibility Guidelines]
signoff:
  - ["Performance, availability and recovery targets agreed with TASCO and VETC IT in discovery", "TASCO IT Architecture", Open]
  - ["Production hosting location and data residency position (to be confirmed by TASCO legal)", "TASCO Legal and IT Security", Open]
  - ["Data protection impact assessment and processing register approved", "TASCO Compliance", Open]
  - ["Independent penetration test scope and provider agreed", "TASCO IT Security", Open]
  - ["Retention schedule and legal-hold rules confirmed (to be confirmed by TASCO legal)", "TASCO Legal", Open]
  - ["Workload assumptions W-1 to W-7 confirmed against VETC data", "VETC Data and Integration Lead", Open]
---

# Introduction

## Purpose

This document states how well the TASCO Growth Platform must perform: speed, capacity, availability, security, privacy, accessibility, recovery, maintainability and compliance. Each requirement has a measurable target, a verification method and its status on 7 October 2026.

## Scope

The requirements apply to the staff console, the customer app, the partner API, the background jobs and the integrations with TASCO core, VETC and the messaging and voice providers. Functional behaviour is in TGP-BUS-02.

## Audience

TASCO IT architecture, IT security and operations, VETC integration, and the iorta TechNXT architecture and QA teams.

## Related documents

| ID | Title |
|---|---|
| TGP-BUS-02 | Functional Requirements Specification |
| TGP-ARC-04 | Security Architecture |
| TGP-ARC-05 | Deployment and Infrastructure Architecture |
| TGP-QA-03 | Performance and Capacity Test Plan |
| TGP-OPS-02 | Monitoring and Alerting |
| TGP-OPS-03 | Disaster Recovery and Business Continuity Plan |

## Conventions and baseline

Requirements are numbered NFR-nnn. Status is Built (in place and tested), Partial (in place with a gap noted) or Planned. Targets are proposed; they are agreed with TASCO and VETC IT during discovery and confirmed by a full-scale performance test in pre-production before the base grows beyond the pilot.

The current quality baseline is 255 automated tests (252 pass, 0 fail, 3 manual or roadmap scenarios), plus a separate PostgreSQL suite of 8 tests. Coverage is 99.41% of lines, 88.25% of branches and 97.12% of functions, with no lint errors. A load smoke test on a single instance on 7 October 2026 reached 337 requests per second with a 95th-percentile response time of 103 ms and no errors.

## Workload model

Sizing uses the VETC car base of 6,000,000 vehicles from the brief. The pilot covers 50,000 to 100,000 vehicles.

| Ref | Assumption | Value |
|---|---|---|
| W-1 | Vehicle profiles | 6 million (12 million source records, about two per vehicle) |
| W-2 | Leads re-scored | 6 million nightly (full); up to 50,000 an hour on events (partial) |
| W-3 | Touchpoints due per day at peak (month end and Tết) | 300,000 |
| W-4 | Concurrent staff users | 300 (200 telesales, 100 others) |
| W-5 | Customer app load during a push campaign | 2,000 requests per second for 15 minutes (burst); 300 per second sustained at full scale |
| W-6 | Concurrent assistant calls (vendor side) | 200 |
| W-7 | Partner API peak | 50 requests per second |

# Performance

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-001 | Response time of read screens: leads, Customer 360, customer home, certificate check | 95th percentile 300 ms or less, 99th percentile 800 ms or less at W-4 and W-5 load | Load test; request duration metrics | Partial: metrics and smoke test in place; full-scale test planned |
| NFR-002 | Response time of a quote | 95th percentile 500 ms or less, excluding TASCO core response time | Load test including quotes | Partial: smoke level only |
| NFR-003 | Purchase (pay and issue) end to end, excluding upstream time | 95th percentile 1.5 s or less; upstream timeout 5 s with two retries | Load test; resilience settings | Built (timeout 5,000 ms, two retries) |
| NFR-004 | Assistant dialogue turn, excluding speech recognition and synthesis | 95th percentile 150 ms or less per turn | Unit benchmark | Planned |
| NFR-005 | Ingestion throughput | 2,000 records per second per worker or more; 12 million records rebuilt in four hours or less with four workers | Batch benchmark | Partial: incremental rebuild in chunks of 500 plates |
| NFR-006 | Lead recompute | Full 6 million in three hours or less nightly; event-driven updates visible within 60 seconds | Job timings | Partial: paged by 1,000; parallel workers planned |
| NFR-007 | Journey run | 300,000 due touchpoints executed inside the 08:00 to 20:00 window in two hours or less | Journey run summary | Planned (sharding) |
| NFR-008 | Rule change propagation | Approved rules active on all servers within 15 seconds | Cache expiry and activation event | Built |

# Scalability

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-009 | Horizontal scaling of the API tier | Stateless servers behind a load balancer; autoscaling from 3 to 20 pods at 65% CPU | Kubernetes autoscaling test | Partial: stateless; shared store for sign-out revocation and rate limits planned (E-15) |
| NFR-010 | Data volume | 6 million profiles, 12 million source records and 50 million messages a year without query-plan regressions; every filter uses an indexed column | PostgreSQL suite; query-plan review in the performance test | Built: filters limited to declared indexed columns |
| NFR-011 | Background work scales out | Event relay safe on many servers, at-least-once delivery, idempotent handlers, at most five attempts | PostgreSQL suite (exclusive claims); store unit tests | Built |
| NFR-012 | Event streaming readiness | The event outbox can forward to Kafka or Pub/Sub without changing publishers | Design review | Planned |

# Availability and resilience

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-013 | Customer purchase path: customer app, partner API, certificate check | 99.9% monthly (43.8 minutes of downtime or less) | Uptime probe on readiness; synthetic purchase | Partial |
| NFR-014 | Staff console and staff APIs | 99.5% monthly during 07:00 to 21:00 Vietnam time | Uptime probe | Partial |
| NFR-015 | Graceful degradation | Failure of one integration (wallet, core, Zalo, SMS, push, voice) affects only that feature. A circuit opens after five failures and retries after 30 seconds | Failure test; circuit state on the operations screen | Built |
| NFR-016 | No double charge | No duplicate debits under retries or concurrent taps: idempotency key on order and wallet, atomic quote claim | Sales integration and security tests | Built |
| NFR-017 | Compensation | Every issuance failure after payment is refunded (issued lines cancelled) or flagged as "compensation failed"; reconciliation finds no unexplained mismatch daily | Reconciliation report; sales integration tests | Built |
| NFR-070 | Pricing integrity | No difference between the premium quoted and the premium issued: core binds the core quote reference, and indicative quotes cannot be paid until re-rated | Core rating integration tests; reconciliation | Built |

# Security

The platform is aligned with OWASP ASVS 4.0 Level 2. The controls are described in TGP-ARC-04 Security Architecture.

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-018 | ASVS Level 2 compliance across V1 to V14 | No open high or critical findings at go-live; annual independent penetration test | Security test suite; static analysis, dynamic baseline scan and image scan in CI; external test | Partial: external penetration test pending |
| NFR-019 | Authentication (V2) | Passwords 12 to 128 characters, hashed with scrypt; lockout after five failures (password or code) for 15 minutes; TOTP mandatory for privileged roles, self-enrolled, codes not reusable; sign-in limited to 10 a minute per address | Security and governance tests | Built |
| NFR-020 | Session management (V3) | Access token life 30 minutes or less; sign-out effective on all servers | Security tests | Partial: password, role, status and region changes revoke tokens everywhere; sign-out revocation is per server (E-15) |
| NFR-021 | Access control (V4) | Deny by default; role and attribute checks on every route; partners see only their own quotes and policies; customers see only their vehicle; no IDOR findings | Security tests | Built: partner key scopes enforced; malformed identifiers rejected |
| NFR-022 | Input validation (V5) | Allow-list schemas on every request (types, lengths, enumerations, patterns); body 1 MB or less; parameterised SQL only; only declared columns can be filtered | Security tests with injection and hostile input | Built |
| NFR-023 | Cryptography (V6) | Personal data encrypted at rest with AES-256-GCM and key rotation; blind index for phone search; API keys stored as SHA-256 hashes; TLS 1.2 or higher; HSTS in production | Configuration review | Built |
| NFR-024 | HTTP security (V14) | Strict CSP with no inline script; framing denied; no content sniffing; no referrer; CORS allow-list; global limit of 300 requests a minute; client address taken from the right-most trusted proxy | Security tests | Built |
| NFR-025 | Secrets | No secrets in code; secrets mounted from Kubernetes, Docker or Vault; production refuses to start with missing secrets, without a database, with demo mode on, or with local rating unless TASCO approves it; optional token protects the metrics endpoint | Platform unit tests | Built |
| NFR-026 | Dependency hygiene | Dependency audit at high severity passes in CI; minimal runtime dependencies (currently one, the PostgreSQL driver) | CI: dependency audit and review, secret scan, software bill of materials | Built |
| NFR-027 | Voice-channel fraud resistance | The assistant never asks for an OTP, card or payment; the plate is verified before any personal data is disclosed; plate and phone are masked in summaries | Script review; assistant unit tests | Built |

# Privacy and data protection

The legal basis is to be confirmed by TASCO legal: the Personal Data Protection Law 91/2025/QH15 (effective 1 January 2026), Decree 13/2023/ND-CP, Decree 91/2020/ND-CP on spam messages and calls, the Law on Insurance Business 08/2022/QH15, and the Cybersecurity Law 2018 with Decree 53/2022/ND-CP. The controls below are conservative engineering defaults, not legal advice.

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-028 | Consent by purpose and channel | Marketing and call consent stored per profile, checked before every marketing message and call, audited, and honoured within one minute | Contact policy integration tests | Built |
| NFR-029 | Data-subject rights | Access (self-service and staff export) and erasure by anonymisation completed within 72 hours of a verified request; legal-retention exceptions documented | Governance and functional tests (US-060, US-061) | Built; the 72-hour handling is an operational process |
| NFR-030 | Data residency | Personal data of Vietnamese data subjects stored and processed in Vietnam, as proposed, or in another location approved by TASCO legal. A cross-border transfer impact assessment is filed for any offshore processor, such as a voice vendor | Architecture review | Planned; to be confirmed by TASCO legal |
| NFR-031 | Data minimisation and masking | Staff without personal-data permission never see full name or phone; handoffs carry a masked phone; the certificate check shows a masked plate and no personal data | Security tests | Built |
| NFR-032 | Processing records and impact assessment | A DPIA and processing register for each purpose: renewal, conquest, assistant calls, partner sharing | Compliance sign-off | Planned |
| NFR-033 | Synthetic data outside production | Non-production environments use synthetic data or irreversibly masked extracts | Environment audit | Built (synthetic data generator) |

# Accessibility and usability

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-034 | Accessibility | WCAG 2.2 Level AA for the console and the customer app: contrast 4.5:1 or more, full keyboard use, visible focus, targets of 24 × 24 px or more, labelled fields, reduced motion respected | Automated scan with no serious issues; manual screen-reader check (TalkBack and VoiceOver) | Partial: formal audit after the redesign |
| NFR-035 | Customer task efficiency | Renew from a reminder in three taps or fewer after opening the link; median renewal 60 seconds or less | Usability test with at least 8 participants per segment; adoption dashboard | Planned |
| NFR-036 | Staff task efficiency | Agent reaches the next lead and its talking points within two clicks of home; first contact on a handoff within two business hours | Usability test; handoff timestamps | Planned |
| NFR-037 | Explainability | Every score, action and benefit shown to staff carries a readable reason | Interface review | Built |
| NFR-038 | Help | Contextual help on every console screen in Vietnamese and English | Interface review | Partial: English help built; Vietnamese help text with the redesign |

# Localisation

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-039 | Bilingual interface | Vietnamese (default for customers) and English, switchable at runtime; all interface text held outside the code | Pseudo-localisation test | Built: runtime switch; pseudo-localisation test planned |
| NFR-040 | Vietnamese conventions | Dates dd/mm/yyyy; currency in Vietnamese format (480.700 đ); full diacritics; accent-insensitive search and matching | Unit tests | Built |
| NFR-041 | Customer wording reviewed by TASCO | All templates and assistant lines approved through maker-checker before activation | Rules audit trail | Built |

# Maintainability and quality

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-042 | Automated test coverage | Lines 80% or more, functions 80% or more, branches 70% or more (excluding start-up code and the PostgreSQL adapter, which has its own suite) | Coverage gate in CI | Built: 99.41% lines, 88.25% branches, 97.12% functions |
| NFR-043 | Static analysis | No lint errors on any commit | Lint in CI | Built |
| NFR-044 | Architecture | Ports and adapters: pure domain logic, application services, adapters behind interfaces; no business thresholds in domain code | Code review; dependency rule check | Built; remaining literals listed in E-05 |
| NFR-045 | API first | Every route described in OpenAPI 3, generated from the route table | CI comparison of the published description | Built (80 routes) |
| NFR-046 | Schema governance | Database migrations match the data registry; applied migrations are never edited; migrations take a lock | Schema drift test; PostgreSQL suite | Built |

# Observability

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-047 | Metrics | Request rate, errors and duration by route; quotes, completed orders, messages, assistant calls, integration calls and short-circuits | Dashboard review | Built |
| NFR-048 | Logs | Structured logs with a request ID carried across calls; no personal data in logs | Log review; security test | Built |
| NFR-049 | Alerting | Alerts on error-budget burn, a circuit open for more than five minutes, event backlog above 10,000 or older than ten minutes, failed jobs and audit-chain failure | Alert runbook test | Planned |
| NFR-050 | Business observability | Growth, economics, adoption and governance dashboards current within five minutes | FR-100 to FR-102 | Built (computed on demand) |

# Disaster recovery and backup

The committed targets match the proposal. Tighter design objectives are stated where the architecture supports them.

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-051 | Recovery point objective | 15 minutes or less (committed); design objective 5 minutes through continuous WAL archiving and PITR | Quarterly restore drill | Planned (infrastructure) |
| NFR-052 | Recovery time objective | 4 hours or less for the platform (committed); design objective 1 hour for the purchase path | Annual DR exercise | Planned |
| NFR-053 | Backups | Encrypted; PITR for 35 days; monthly backups kept 13 months; stored in a separate account or region approved under NFR-030; restore tested quarterly | Backup report | Planned |
| NFR-054 | Audit integrity after restore | The audit hash chain verifies after every restore | DR runbook | Built (verification) |

# Portability and deployment

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-055 | Runtime | Node.js 22.12 LTS or later and PostgreSQL 15 or later; an in-memory store for demo and tests with identical behaviour, never in production | CI runs the PostgreSQL suite | Built |
| NFR-056 | Packaging | Container image running as a non-root user (uid 1000) with a read-only file system and liveness and readiness checks | Image scan in CI | Built |
| NFR-057 | Targets | Deployable to Kubernetes, with scheduled jobs for journeys, recompute, reconciliation, retention, event relay and catalogue sync, and to a platform service for demo and UAT. No proprietary managed services required | Deployment rehearsal | Built: Kubernetes manifests and jobs; UAT live with PostgreSQL |
| NFR-058 | Configuration | All settings from the environment; secrets mounted as files | Configuration review | Built |

# Auditability

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-059 | Completeness | All state changes and all views of personal data audited (FR-097) | Audit coverage test | Built |
| NFR-060 | Immutability | Audit log append-only (database triggers reject update, delete and truncate) and hash-chained; verified daily | PostgreSQL suite | Built |
| NFR-061 | Reproducible decisions | Every lead evaluation can be reproduced from the rule versions (ID and checksum) and facts in force at the time | Rule snapshot on the operations screen | Partial: storing the rule version on each lead is planned |

# Configurability

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-062 | No hard-coded business rules | All thresholds, weights, tariffs, rates, journeys, wording, consent policy, commission and retention held in rule sets and changed by the business through maker-checker without a release | Code review checklist; search for numeric literals in business logic | Partial: service levels moved to a rule set; E-05 lists remaining literals |
| NFR-063 | Safe change | Every rule change validated, simulated (scoring, next best action, journeys, benefits), approved by a second person, versioned and reversible | FR-083 to FR-087 | Built |
| NFR-064 | Lead time for business change | One business day or less from request to activation of a rule change | Adoption dashboard | Built (workflow) |

# Data retention

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-065 | Retention schedule | Source records 365 days (delete); profiles 1,825 days after last activity with no active policy (anonymise); assistant recordings and transcripts 180 days (delete); messages 365 days (archive); orders and certificates 3,650 days (archive, financial records); audit log 3,650 days (archive, never deleted early) | Retention job report | Partial: deletion built for source records and assistant sessions; archival planned (E-09) |
| NFR-066 | Legal hold | A legal-hold flag suspends deletion for named records | Retention test | Planned |

# Compliance by design

| ID | Requirement | Target | Verification | Status |
|---|---|---|---|---|
| NFR-067 | No discount language reaches customers | No customer message containing copy-guard phrases: checked on save and blocked at send | Blocked-message count of zero after go-live | Built |
| NFR-068 | Contact hygiene | No marketing contact outside 08:00 to 20:00 Vietnam time or above the caps | Message log analysis | Built for journeys, triggers and assistant campaigns |
| NFR-069 | Commission caps | No commission line above the statutory cap | Save-time validation; statement audit | Built |
