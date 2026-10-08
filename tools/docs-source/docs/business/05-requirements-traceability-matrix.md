---
id: TGP-BUS-05
title: Requirements Traceability Matrix
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 08/10/2026
prepared_by: iorta TechNXT, Business Analysis and Quality Assurance
reviewed_by: TASCO Insurance, Product Owner and QA Lead
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [AI, Artificial intelligence]
  - [API, Application Programming Interface]
  - [B2B, Business to business]
  - [FR, Functional requirement]
  - [HTTP, Hypertext Transfer Protocol]
  - [ID, Identifier]
  - [IT, Information technology]
  - [KPI, Key performance indicator]
  - [MDM, Master data management]
  - [MVP, Minimum viable product]
  - [OWASP, Open Worldwide Application Security Project]
  - [PG, PostgreSQL]
  - [QA, Quality assurance]
  - [QR, Quick response (code)]
  - [REST, Representational state transfer]
  - [TNDS, Compulsory motor third-party liability insurance (Bảo hiểm TNDS bắt buộc)]
  - [TOTP, Time-based one-time password]
  - [UAT, User acceptance testing]
  - [US, User story]
signoff:
  - ["Closure plan for open engineering notes agreed: MVP scope or scale phase", "TASCO Product Owner and IT Architecture", Open]
  - ["Manual scenarios US-055, US-076 and US-077 executed and recorded in UAT", "TASCO UAT Lead", Open]
  - ["Contract tests for the TASCO core interface added once TASCO's specification is received", "TASCO Core System Lead", Open]
---

# Introduction

## Purpose

This matrix traces every functional requirement in TGP-BUS-02 to the user stories that accept it (TGP-BUS-04), the tests that prove it, and the components, API endpoints and rule sets that deliver it. It lets TASCO confirm that nothing specified is untested and nothing built is unspecified.

## Scope

All 119 functional requirements, FR-001 to FR-119. The matrix is presented in two views: requirement to story and test, and requirement to component and API. An appendix records the engineering findings raised while tracing the requirements to the software.

## Audience

The TASCO product owner, QA lead and IT architecture team, and the iorta TechNXT delivery and QA teams.

## Related documents

| ID | Title |
|---|---|
| TGP-BUS-02 | Functional Requirements Specification |
| TGP-BUS-04 | User Stories and Acceptance Criteria |
| TGP-QA-01 | Test Strategy |
| TGP-QA-02 | Test Case Catalogue |
| TGP-ARC-01 | Solution Architecture |
| TGP-MAN-03 | Partner API Integration Guide |

## Test status

All test suites below run in continuous integration. The latest run has 271 tests: 268 pass, 0 fail and 3 are to-do (the manual or roadmap scenarios US-055, US-076 and US-077). The PostgreSQL suite of 8 tests runs separately against a real database, and all 8 pass. Line coverage is above 99%; TGP-QA-01 Test Strategy records the figures of each build. The API has 103 routes: 6 public, 82 staff, 11 customer and 4 partner. Detailed results are in the test cases and results workbook described in TGP-QA-02.

Build status follows TGP-BUS-02: B is built, P is partial, Pl is planned.

## Test suites

Functional suites F-1 to F-3 hold one test per scenario of US-001 to US-077 in TGP-BUS-04, named "US-nnn · scenario title": 124 scenarios, of which 121 are automated and 3 are manual or roadmap. The 11 scenarios of US-078 and US-079 are covered by the suites API-DQ and U-QR.

| Code | Suite | Scope |
|---|---|---|
| U-ID | Identity unit tests | Plate, phone and spoken-plate parsing |
| U-JL | Rules language unit tests | Expressions, templates, decision tables |
| U-PF | Platform unit tests | Cryptography, tokens, TOTP, validation, resilience, configuration, schema drift |
| U-RD | Rules domain unit tests | Rule validators, enrichment, leads, journeys, benefits, rating, contact policy |
| U-ST | Store unit tests | In-memory store, event outbox, audit hash chain |
| U-VB | Voice assistant unit tests | Dialogue |
| U-CC | Core rating client unit tests | TASCO core REST client |
| U-QR | Quick renewal unit tests | Quick renewal eligibility and reasons; service levels validation, including the data-request response time |
| I-GV | Governance integration tests | Rules, identity, access, voice, customer, operations |
| I-JN | Journey integration tests | Seed data, journeys, triggers, recompute |
| I-SA | Sales integration tests | Quote, purchase, compensation, partners |
| I-CR | Core rating integration tests | Rating modes, indicative quotes, re-rating, catalogue sync, integration status |
| I-RF | Regression integration tests | Fixes from design and code reviews |
| API | API contract tests | HTTP contract, authentication and authorisation |
| API-DQ | Data-request and quick-renewal API tests | Data-request register, export, erasure and refusal; quick renewal in the customer app |
| SEC | Security tests | Controls against the OWASP Top 10 |
| PG | PostgreSQL suite | Database adapter, migrations, audit immutability |
| PERF | Load smoke test | 95th-percentile budget |
| F-1 | Functional suite 1 | US-001 to US-022 |
| F-2 | Functional suite 2 | US-023 to US-048 |
| F-3 | Functional suite 3 | US-049 to US-077 |

# Requirement to story and test

## A. Data and master data management

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-001 | Batch ingestion | US-001 | F-1, API | B |
| FR-002 | Plate normalisation | US-001 | U-ID, F-1 | B |
| FR-003 | Phone normalisation | US-001 | U-ID, F-1 | B |
| FR-004 | One record per vehicle | US-001 | U-RD, F-1 | B |
| FR-005 | Expiry estimation | US-002 | U-RD, F-1 | B |
| FR-006 | Vehicle category inference | US-006 | U-RD, U-JL, F-1 | B |
| FR-007 | Data-quality score and queue | US-004 | U-RD, I-GV, F-1 | B |
| FR-008 | Field-level lineage | US-002 | I-GV, F-1 | B |
| FR-009 | Steward expiry correction | US-003 | API, F-1 | B |
| FR-010 | Data-repair loop | US-005, US-027 | U-RD, I-GV, F-1 | B |
| FR-011 | Incremental rebuild | US-001 | I-JN, F-1 | B |

## B. Lead intelligence

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-012 | Fact model | US-007 | U-RD, F-1 | B |
| FR-013 | Journey assignment | US-017, US-018 | U-RD, U-JL, F-1 | B |
| FR-014 | Explainable lead score | US-007 | U-RD, F-1 | B |
| FR-015 | Next best action | US-008, US-054 | U-RD, U-JL, F-1, F-3 | B |
| FR-016 | Benefits per lead | US-019 | U-RD, F-1 | B |
| FR-017 | Prioritised lead queue | US-007, US-009 | API, SEC, I-GV, F-1 | B |
| FR-018 | Recompute | US-011 | I-JN, F-1 | B |
| FR-019 | Insured suppression | US-010 | I-SA, F-1 | B |

## C. Journeys and messaging

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-020 | Journey catalogue | US-012, US-017, US-019 | U-RD, F-1 | B |
| FR-021 | Touchpoint planning | US-012 | U-RD, F-1 | B |
| FR-022 | Execute due touchpoints | US-012, US-017 | I-JN, API, F-1 | B |
| FR-023 | Contact policy gate | US-013, US-015 | U-RD, I-JN, F-1 | B |
| FR-024 | Copy guard | US-014, US-067 | U-RD, I-SA, F-1, F-3 | B |
| FR-025 | Templated messages | US-012, US-015, US-019 | I-JN, F-1 | B |
| FR-026 | Ecosystem triggers | US-018, US-020, US-021, US-022 | I-JN, API, F-1 | B |
| FR-027 | Purchase confirmation | US-040 | I-SA, F-2 | B |
| FR-028 | Post-purchase cross-sell | US-046 | I-SA, F-2 | B |
| FR-029 | Touchpoint schedule | US-012 | API, F-1 | B |
| FR-030 | Journey integrity | US-010 | I-SA, F-1 | B |

## D. AI voice assistant

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-031 | Disclosure | US-023 | U-VB, F-2 | B |
| FR-032 | Plate-first verification | US-024 | U-VB, U-ID, F-2 | B |
| FR-033 | Expiry confirmation | US-024 | U-VB, F-2 | B |
| FR-034 | Intent recognition | US-026 | U-VB, F-2 | B |
| FR-035 | Honest price answer | US-025 | U-VB, F-2 | B |
| FR-036 | Outcomes and write-back | US-027, US-028 | U-VB, I-GV, F-2 | B |
| FR-037 | Interactive console | US-030 | I-GV, API, F-2 | B |
| FR-038 | Automated campaign | US-029, US-054 | I-GV, API, F-2, F-3 | B |
| FR-039 | Assistant governance KPIs | US-031 | API, F-2 | B |

## E. Telesales

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-040 | Structured handoff | US-032 | U-VB, F-2 | B |
| FR-041 | Work queue | US-033 | SEC, I-GV, F-2 | B |
| FR-042 | Handoff lifecycle | US-033 | API, F-2 | B |
| FR-043 | Supervisor assignment | US-034 | API, F-2 | B |
| FR-044 | Journey escalation | US-016 | F-1 | B |

## F. Sales and issuance

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-045 | Product catalogue | US-035 | I-SA, F-2 | B |
| FR-046 | Quotation | US-035, US-039, US-041, US-044 | I-SA, U-RD, F-2 | B |
| FR-047 | Pay and issue | US-035, US-039, US-051 | I-SA, I-CR, SEC, API, F-2, F-3 | B |
| FR-048 | Failure compensation | US-042 | I-SA, F-2 | B |
| FR-049 | Record update on issuance | US-039 | I-SA, F-2 | B |
| FR-050 | Public certificate verification | US-040, US-077 | API, F-2, F-3 (manual QR scan) | B |
| FR-051 | Policy listing | US-035 | API, F-2 | B |
| FR-052 | Reconciliation | US-074 | I-SA, F-3 | B |

## G. Products and rating

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-053 | Regulated TNDS tariff | US-006, US-039, US-041 | U-RD, F-1, F-2 | B |
| FR-054 | Physical damage cover | US-045 | U-RD, F-2 | B |
| FR-055 | Personal accident cover per seat | US-044 | U-RD, F-2 | B |
| FR-056 | No-discount pricing | US-025, US-039 | U-RD, F-2 | B |
| FR-057 | Products by configuration | US-063 | U-RD, F-3 | B |

## H. Value and benefits

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-058 | Benefits with legal gating | US-043 | U-RD, F-2 | B |
| FR-059 | Relevance and explanation | US-043 | U-RD, F-2 | B |
| FR-060 | Loyalty points and referral | US-047 | F-2 | Pl |
| FR-061 | Auto-renew opt-in | US-048 | F-2 (guard only) | Pl |
| FR-062 | Inspection reminder and booking | US-020 | I-JN, F-1 | P |

## I. Partners and fleet

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-063 | Partner onboarding and status | US-049, US-053 | I-SA, API, F-3 | B |
| FR-064 | Partner API keys | US-049 | I-SA, SEC, F-3 | B |
| FR-065 | Partner quote by plate | US-050 | I-SA, API, F-3 | B |
| FR-066 | Partner bind | US-051 | API, F-3 | B |
| FR-067 | Partner reporting | US-052 | API, F-3 | B |
| FR-068 | Commission | US-052, US-068 | U-RD, I-SA, F-3 | B |
| FR-069 | Partner statement for staff | US-052 | F-3 | B |
| FR-070 | Fleet and B2B | US-054, US-055 | F-3 (US-055 roadmap) | P |

## J. Claims first notice

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-071 | Report an accident | US-056 | I-GV, API, F-3 | B |
| FR-072 | Claims queue | US-057 | F-3 | B |
| FR-073 | My claims | US-058 | API, F-3 | B |

## K. Customer self-service and privacy

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-074 | Customer session | US-036 | API, SEC, F-2 | B |
| FR-075 | Cover status home | US-037 | I-GV, API, F-2 | B |
| FR-076 | Confirm my expiry | US-038 | U-RD, I-GV, F-2 | B |
| FR-077 | Purchase with add-ons | US-035, US-039, US-079 | API, API-DQ, I-SA, I-CR, F-2 | B |
| FR-078 | Consent centre | US-028, US-059 | I-GV, API, F-2, F-3 | B |
| FR-079 | Download my data | US-060, US-078 | I-GV, API, API-DQ, F-3 | B |
| FR-080 | Export and erasure by staff | US-061, US-078 | I-GV, SEC, API-DQ, F-3 | B |
| FR-081 | Masking by permission | US-062 | I-GV, SEC, F-3 | B |
| FR-116 | Confirm vehicle use and seats | US-079 | API, API-DQ | B |
| FR-117 | Same journeys in every host app | None | API | B |
| FR-118 | Data-subject request register | US-078 | API-DQ, U-QR | B |
| FR-119 | Quick renewal | US-079 | U-QR, API-DQ | B |

## L. Rules governance

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-082 | Versioned rule registry | US-063 | I-GV, F-3 | B |
| FR-083 | Draft with validation | US-063, US-067, US-068 | U-RD, U-JL, I-GV, F-3 | B |
| FR-084 | Validate without saving | US-063 | API, F-3 | B |
| FR-085 | Simulate | US-064 | API, F-3 | B |
| FR-086 | Maker-checker approval | US-065 | I-GV, SEC, PG, F-3 | B |
| FR-087 | Rollback | US-066 | I-GV, F-3 | B |
| FR-088 | Default rules | None (platform requirement) | U-RD, PG | B |

## M. Identity and access

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-089 | Sign-in with lockout | US-069, US-070 | I-GV, SEC, F-3 | B |
| FR-090 | Two-factor authentication | US-069 | U-PF, I-GV, API, F-3 | B |
| FR-091 | Sessions | US-069 | U-PF, SEC, F-3 | P |
| FR-092 | Role-based access | US-071 | I-GV, SEC, F-3 | B |
| FR-093 | Attribute-based access | US-009, US-033 | I-GV, SEC, F-1, F-2 | B |
| FR-094 | User administration | US-071 | I-GV, I-JN, API, F-3 | B |
| FR-095 | Partner and customer authentication | US-036, US-049 | SEC, API, F-2, F-3 | B |
| FR-096 | Password management | US-071 | U-PF, I-GV, F-3 | B |

## N. Audit

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-097 | Audit every change | US-003, US-062 | U-ST, I-GV, F-3 | B |
| FR-098 | Audit search | US-072 | API, F-3 | B |
| FR-099 | Tamper evidence | US-072 | U-ST, PG, SEC, F-3 | B |

## O. Operations, reporting and user interfaces

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-100 | Growth dashboard | US-073 | API, F-3 | B |
| FR-101 | Adoption dashboard | None (platform requirement) | I-GV, API | B |
| FR-102 | Governance dashboard | US-031 | API, F-2 | B |
| FR-103 | Operational status | US-074 | API, F-3 | B |
| FR-104 | Jobs | US-074 | I-GV, I-CR, API, F-3 | B |
| FR-105 | Retention | US-075 | I-GV, F-3 | P |
| FR-106 | Health, metrics, API description | None (platform requirement) | U-PF, API, PERF | B |
| FR-107 | Demo and UAT environment | None (platform requirement) | I-JN, I-GV, SEC | B |
| FR-108 | Staff console | US-022, US-076 | API, F-1, UAT (manual) | B |
| FR-109 | Customer app | US-077 | API, F-2, UAT (manual) | B |
| FR-110 | Language and themes | US-076 | F-3 (manual), UAT | B |

## P. TASCO core integration

| FR | Requirement | User stories | Tests | Build |
|---|---|---|---|---|
| FR-111 | Core rates every quote | US-035, US-039 | I-CR, U-CC | B |
| FR-112 | Rating mode and indicative quotes | None (integration requirement) | I-CR | B |
| FR-113 | Product catalogue sync | None (integration requirement) | I-CR | B |
| FR-114 | Integration status | None (integration requirement) | I-CR | B |
| FR-115 | TASCO policy book | US-002 | U-RD, F-1 | P |

# Requirement to component and API

Components are named as they are in the code base, without paths. Every API endpoint is described in the OpenAPI specification supplied with this submission; partner endpoints are explained in TGP-MAN-03 Partner API Integration Guide.

## A. Data and master data management

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-001 | `ingestionService` | `POST /api/data/ingest` | None |
| FR-002 | `identity.normalizePlate` | `POST /api/data/ingest`, `POST /api/partner/v1/quotes` | None |
| FR-003 | `identity.normalizePhone` | As FR-002 | None |
| FR-004 | `enrichment.buildProfiles` | `POST /api/data/ingest` | Data enrichment |
| FR-005 | `enrichment.inferExpiry` | `GET /api/customers/:id` | Data enrichment |
| FR-006 | `enrichment.inferCategory`, `decisionTable` | `GET /api/customers/:id` | Data enrichment |
| FR-007 | `enrichment`, `opsService`, `voiceService` | `GET /api/dq/issues`, `POST /api/dq/issues/:id/resolve` | Data enrichment |
| FR-008 | `opsService.lineage` | `GET /api/customers/:id/lineage` | None |
| FR-009 | `enrichment.applyDeclaredExpiry` | `PATCH /api/customers/:id/expiry` | Service levels |
| FR-010 | `ingestionService`, `customerService`, `voiceService`, `salesService` | `POST /api/customer/expiry`, `POST /api/voice/sessions/:id/turns` | Data enrichment |
| FR-011 | `ingestionService.rebuild`, event subscribers | `POST /api/data/ingest` | None |

## B. Lead intelligence

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-012 | `leads.factsFor` | None | All lead rule sets |
| FR-013 | `leads.assignJourney` | `GET /api/leads` | Journeys |
| FR-014 | `leads.score` | `GET /api/leads` | Lead scoring |
| FR-015 | `leads.evaluateLead`, `decisionTable` | `GET /api/leads` | Next best action |
| FR-016 | `leads.benefitsFor` | `GET /api/leads`, `GET /api/customers/:id` | Benefits |
| FR-017 | `leadService.list`, `accessPolicy` | `GET /api/leads` | Attribute access policies |
| FR-018 | `leadService.recompute`, recompute job | `POST /api/leads/recompute` | None |
| FR-019 | `leadService.recomputeOne` | None | None |

## C. Journeys and messaging

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-020 | `leads`, rule validators | None | Journeys |
| FR-021 | `leads.planTouchpoints` | `GET /api/touchpoints` | Journeys |
| FR-022 | `journeyService.runDue`, journeys job | `POST /api/journeys/run` | Journeys |
| FR-023 | `contactPolicy.canContact` | `POST /api/journeys/run`, `POST /api/ecosystem/events` | Contact policy |
| FR-024 | `contactPolicy.checkCopy`, rule validators | `POST /api/rules`, `POST /api/journeys/run` | Copy guard |
| FR-025 | `journeyService.sendMessage`, signed links | `POST /api/journeys/run` | Message content |
| FR-026 | `journeyService.handleEcosystemEvent` | `POST /api/ecosystem/events` | Ecosystem triggers, contact policy |
| FR-027 | Confirmation and cross-sell subscriber | `POST /api/customer/orders` (side effect) | Message content |
| FR-028 | Confirmation and cross-sell subscriber | None | Journeys |
| FR-029 | `journeyService.schedule` | `GET /api/touchpoints` | None |
| FR-030 | `journeyService.executeTouchpoint` | `POST /api/journeys/run` | None |

## D. AI voice assistant

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-031 | `voicebot.createDialogue` | `POST /api/voice/sessions` | Voice assistant script |
| FR-032 | `voicebot`, `identity.extractPlateFromSpeech` | `POST /api/voice/sessions/:id/turns` | Voice assistant script |
| FR-033 | `voicebot` (expiry confirmation, plate masking) | `POST /api/voice/sessions/:id/turns` | Voice assistant script |
| FR-034 | `voicebot.keywordClassifier` | `POST /api/voice/sessions/:id/turns` | Voice assistant script |
| FR-035 | `voicebot` (price intent) | `POST /api/voice/sessions/:id/turns` | Voice assistant script, copy guard |
| FR-036 | `voiceService.finalize` | `POST /api/voice/sessions/:id/turns`, `POST /api/voice/campaign` | Service levels |
| FR-037 | `voiceService` | `POST /api/voice/sessions`, `GET /api/voice/sessions/:id` | None |
| FR-038 | `voiceService.canCall`, `voiceService.autoCall`, simulated caller | `POST /api/voice/campaign` | Contact policy |
| FR-039 | `insightsService.governance` | `GET /api/dashboard/governance` | None |

## E. Telesales

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-040 | `voicebot.handoffSummary` | `GET /api/handoffs/:id` | None |
| FR-041 | `voiceService.listHandoffs`, `accessPolicy` | `GET /api/handoffs`, `GET /api/handoffs/:id` | Attribute access policies |
| FR-042 | `voiceService.updateHandoff` | `PATCH /api/handoffs/:id` | None |
| FR-043 | `accessPolicy.require` | `PATCH /api/handoffs/:id` | Roles |
| FR-044 | `voiceService.createDirectHandoff`, `journeyService` | `POST /api/journeys/run` | Journeys |

## F. Sales and issuance

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-045 | `salesService.catalogue` | `GET /api/products` | Product catalogue |
| FR-046 | `salesService.quote`, `salesService.markSent`, `rating.coverStartDate` | `POST /api/quotes`, `POST /api/quotes/:id/send`, `POST /api/customer/quotes`, `POST /api/partner/v1/quotes` | Product catalogue, tariffs, rating, benefits, service levels |
| FR-047 | `salesService.purchase`, wallet and core gateways, `resilience` | `GET /api/customer/quotes`, `POST /api/customer/orders`, `POST /api/partner/v1/orders` | None |
| FR-048 | `salesService.purchase` (compensation) | As FR-047 | None |
| FR-049 | `salesService.purchase` (record update) | As FR-047 | None |
| FR-050 | `salesService.verifyCertificate`, verification page | `GET /api/public/certificates/:certNo` | None |
| FR-051 | `salesService.listPolicies` | `GET /api/policies` | None |
| FR-052 | `opsService.reconcile`, reconciliation job | `POST /api/ops/jobs/:kind` | None |

## G. Products and rating

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-053 | `rating` (tariff table) | `POST /api/quotes` and customer and partner variants | TNDS car and motorbike tariffs |
| FR-054 | `rating` (rate on sum insured), `salesService.recordInspection` | As FR-053; `POST /api/quotes/:id/inspection` | Physical damage rating |
| FR-055 | `rating` (per seat) | As FR-053 | Seat accident rating |
| FR-056 | `rating.rate` (price-regulated note) | As FR-053 | Product catalogue |
| FR-057 | Rule validators, `rating` | `POST /api/rules` | Product catalogue |

## H. Value and benefits

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-058 | `leads.benefitsFor`, `leadService.benefitsForStaff` | `GET /api/customer/home`, `GET /api/customers/:id` | Benefits |
| FR-059 | `leads.benefitsFor` | As FR-058 | Benefits |
| FR-060 | Configuration only (switched off) | None | Benefits, referral |
| FR-061 | None (roadmap) | None | Benefits |
| FR-062 | `journeyService.handleEcosystemEvent` | `POST /api/ecosystem/events` | Ecosystem triggers, benefits |

## I. Partners and fleet

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-063 | `partnerService` | `GET /api/partners`, `POST /api/partners`, `PATCH /api/partners/:id` | None |
| FR-064 | `partnerService` (keys), `crypto` | `POST /api/partners/:id/keys`, `DELETE /api/partners/keys/:keyId` | None |
| FR-065 | Partner quote handler, `ingestionService`, `salesService.quote` | `POST /api/partner/v1/quotes` | Product catalogue, data enrichment |
| FR-066 | Ownership check, `salesService.purchase` | `POST /api/partner/v1/orders` | None |
| FR-067 | `salesService.listPolicies`, `partnerService.statement` | `GET /api/partner/v1/policies`, `GET /api/partner/v1/statement` | None |
| FR-068 | `rating.commissionFor`, rule validators | `POST /api/partner/v1/orders`, `POST /api/rules` | Commission |
| FR-069 | `partnerService.statement` | `GET /api/partners/:id/statement` | None |
| FR-070 | `leads` (next best action), campaign handler | `GET /api/leads` | Next best action, journeys, benefits |

## J. Claims first notice

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-071 | `claimsService.submit` | `POST /api/customer/claims` | Service levels, message content |
| FR-072 | `claimsService.transition` | `GET /api/claims`, `PATCH /api/claims/:id` | None |
| FR-073 | `claimsService.list` | `GET /api/customer/claims` | None |

## K. Customer self-service and privacy

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-074 | Signed links, `customerService.issueCustomerToken` | `POST /api/customer/session` | Attribute access policies |
| FR-075 | `customerService.home` | `GET /api/customer/home` | Benefits |
| FR-076 | `customerService.declareExpiry` | `POST /api/customer/expiry` | Service levels |
| FR-077 | `salesService` | `POST /api/customer/quotes`, `POST /api/customer/orders` | Product catalogue, tariffs, rating, service levels |
| FR-078 | `customerService.updateConsent`, `ingestionService.rebuild` | `PUT /api/customer/consent` | Contact policy |
| FR-079 | `customerService.exportData`, `dsarService.recordSelfServiceExport` | `GET /api/customer/data-export` | None |
| FR-080 | `dsarService`, `customerService.exportData`, `customerService.erase` | `POST /api/dsar/:id/complete-export`, `POST /api/dsar/:id/erase`; the older `POST /api/dsar/:id/export` still works | Data retention |
| FR-081 | `accessPolicy.maskProfile` | `GET /api/customers/:id` | Roles |
| FR-116 | `enrichment` (customer vehicle evidence), `ingestionService` | `POST /api/customer/vehicle` | Data enrichment |
| FR-117 | `customerService.issueCustomerToken`, `salesService` (payment by host) | `POST /api/customer/session` | Products |
| FR-118 | `dsarService` | `GET /api/dsar`, `POST /api/dsar`, `GET /api/dsar/:id`, `POST /api/dsar/:id/start`, `/complete-export`, `/erase`, `/refuse` | Service levels |
| FR-119 | `quickRenewal`, `customerService.quickRenewal`, `salesService.quote` | `GET /api/customer/home`, `POST /api/customer/quotes` (quick flow), `POST /api/customer/orders` | Service levels, product catalogue |

## L. Rules governance

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-082 | `rulesService` | `GET /api/rules`, `GET /api/rules/:id` | All |
| FR-083 | `rulesService.createDraft`, rule validators | `POST /api/rules` | All |
| FR-084 | `rulesService.validate` | `POST /api/rules/validate` | All |
| FR-085 | Simulate handler, `leads.evaluateLead` | `POST /api/rules/simulate` | Lead scoring, next best action, journeys, benefits |
| FR-086 | `rulesService.submit`, `approve`, `reject` | `POST /api/rules/:id/submit`, `/approve`, `/reject` | All; roles for restricted sets |
| FR-087 | `rulesService.rollback` | `POST /api/rules/:id/rollback` | All |
| FR-088 | `rulesService.loadDefaults`, seed | None (rules job) | All |

## M. Identity and access

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-089 | `identityService.login`, `crypto` | `POST /api/auth/login` | None |
| FR-090 | `identityService.verifyMfa`, `crypto.totp` | `POST /api/auth/mfa` | None |
| FR-091 | `crypto` (tokens), `identityService.logout` | `POST /api/auth/logout`, `GET /api/auth/me` | None |
| FR-092 | `accessPolicy.permissions` | All staff routes | Roles |
| FR-093 | `accessPolicy.check` | `GET /api/customers/:id`, handoff routes | Attribute access policies |
| FR-094 | `identityService` (users) | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/reset` | Roles |
| FR-095 | `partnerService.authenticateKey`, `identityService.authenticate` | Partner and customer routes | None |
| FR-096 | `identityService.changePassword` | `POST /api/auth/password` | None |

## N. Audit

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-097 | `auditService.record` (called by all services) | None | None |
| FR-098 | `auditService.list` | `GET /api/audit` | None |
| FR-099 | `auditChain`, append-only database triggers | `GET /api/audit/verify` | None |

## O. Operations, reporting and user interfaces

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-100 | `insightsService.overview` | `GET /api/dashboard/overview` | Channel costs |
| FR-101 | `insightsService.adoption` | `GET /api/dashboard/adoption` | None |
| FR-102 | `insightsService.governance` | `GET /api/dashboard/governance` | None |
| FR-103 | Operations status handler, `resilience` | `GET /api/ops/status` | None |
| FR-104 | `opsService`, event outbox, job runner | `GET /api/ops/jobs`, `POST /api/ops/jobs/:kind` | None |
| FR-105 | `opsService.applyRetention` | `POST /api/ops/jobs/:kind` (retention) | Data retention |
| FR-106 | HTTP app, OpenAPI generator, metrics | Health, metrics and OpenAPI endpoints, `GET /api/meta` | None |
| FR-107 | Seed, synthetic VETC source, configuration | `GET /api/meta`, demo authenticator (demo mode only) | None |
| FR-108 | Staff console | All staff routes | None |
| FR-109 | Customer app, verification page | Customer and public routes | None |
| FR-110 | Shared language and theme modules | None | None |

## P. TASCO core integration

| FR | Component | API endpoint | Rule set |
|---|---|---|---|
| FR-111 | `ratingService`, `tascoCoreRatingClient`, simulated core | `POST /api/quotes`, `POST /api/customer/quotes`, `POST /api/partner/v1/quotes` | Product catalogue, tariffs |
| FR-112 | `ratingService`, `salesService.rerate`, configuration | `POST /api/quotes/:id/rerate`, `POST /api/customer/quotes/:id/rerate` | TNDS tariffs |
| FR-113 | `catalogueService`, catalogue sync job | `POST /api/ops/jobs/:kind` (catalogue-sync) | Product catalogue |
| FR-114 | Integration status handler | `GET /api/integrations/status` | None |
| FR-115 | `enrichment` (TASCO policy evidence), `ingestionService` | `POST /api/data/ingest` | Data enrichment |

# Coverage summary

## Traceability coverage

| Area | FRs | With a user story | With an API endpoint | With a rule set |
|---|---:|---:|---:|---:|
| A Data and MDM | 11 | 11 | 11 | 6 |
| B Lead intelligence | 8 | 8 | 6 | 6 |
| C Journeys and messaging | 11 | 11 | 9 | 9 |
| D Voice assistant | 9 | 9 | 9 | 7 |
| E Telesales | 5 | 5 | 5 | 3 |
| F Sales and issuance | 8 | 8 | 8 | 2 |
| G Products and rating | 5 | 5 | 5 | 5 |
| H Value and benefits | 5 | 5 | 3 | 5 |
| I Partners and fleet | 8 | 8 | 8 | 3 |
| J Claims | 3 | 3 | 3 | 1 |
| K Customer and privacy | 12 | 11 | 12 | 11 |
| L Rules governance | 7 | 6 | 6 | 7 |
| M Identity and access | 8 | 8 | 8 | 3 |
| N Audit | 3 | 3 | 2 | 0 |
| O Operations and interfaces | 11 | 8 | 10 | 2 |
| P TASCO core integration | 5 | 2 | 5 | 4 |
| Total | 119 | 111 | 110 | 74 |

Every requirement has at least one automated or manual test. The eight requirements without a user story (FR-088, FR-101, FR-106, FR-107, FR-112 to FR-114 and FR-117) are platform and integration requirements verified directly by unit and integration tests.

## Build status

| Area | Built | Partial | Planned |
|---|---:|---:|---:|
| A Data and MDM | 11 | 0 | 0 |
| B Lead intelligence | 8 | 0 | 0 |
| C Journeys and messaging | 11 | 0 | 0 |
| D Voice assistant | 9 | 0 | 0 |
| E Telesales | 5 | 0 | 0 |
| F Sales and issuance | 8 | 0 | 0 |
| G Products and rating | 5 | 0 | 0 |
| H Value and benefits | 2 | 1 | 2 |
| I Partners and fleet | 7 | 1 | 0 |
| J Claims | 3 | 0 | 0 |
| K Customer and privacy | 12 | 0 | 0 |
| L Rules governance | 7 | 0 | 0 |
| M Identity and access | 7 | 1 | 0 |
| N Audit | 3 | 0 | 0 |
| O Operations and interfaces | 10 | 1 | 0 |
| P TASCO core integration | 4 | 1 | 0 |
| Total | 112 | 5 | 2 |

"Built" includes requirements whose production connector is still to be built in the MVP, for example the live VETC wallet and the production TASCO core issuance, which run against sandbox connectors today.

# Appendix

## Engineering findings

These findings were raised while tracing requirements to the software and were re-checked against the current build. Severity H is a compliance, security or money risk, M a functional gap, L a hygiene item.

| ID | Severity | Status | Finding |
|---|---|---|---|
| E-01 | H | Resolved | Assistant campaigns bypassed the contact policy |
| E-02 | M | Open, mitigated | The automatic call function does not itself refuse do-not-contact customers |
| E-03 | M | Partly resolved | Motorbike plates were rejected; lead premium always uses the car tariff |
| E-04 | M | Resolved | Zalo was never recorded as the sales channel; customer quotes were always tagged as VETC app. The session now records the host (FR-117) |
| E-05 | M | Partly resolved | Some business thresholds are still written in code |
| E-06 | M | Resolved | Physical damage inspection was not enforced before payment |
| E-07 | M | Resolved | Company vehicles entered consumer journeys |
| E-08 | L | Open | The "call" next best action ignores marketing consent |
| E-09 | M | Open | Retention is only partly executed: no anonymisation or archival |
| E-10 | M | Partly resolved | Benefits and wording promised features that do not exist |
| E-11 | M | Partly resolved | Partner API: owner type, plate enumeration and data-poisoning risk |
| E-12 | L | Resolved | The usable-data KPI used a proxy |
| E-13 | L | Open | The copy-guard scope setting is ignored |
| E-14 | L | Open | The wallet top-up trigger uses future-tense wording for lapsed vehicles |
| E-15 | M | Partly resolved | Sign-out revocation and rate limits are held per server |
| E-16 | L | Open | Dashboards do not yet scale to 6 million records |
| E-17 | L | Open | Phone masking is inconsistent in journey handoffs |
| E-18 | M | Resolved | Regional checks were missing on lineage, expiry correction and handoff detail |
| E-19 | H | Resolved | Erasure did not scrub handoffs, claims and assistant data |
| E-20 | M | Resolved | Quality gates (tests, lint, container, manifests) were not yet runnable |
| E-21 | L | Open | Rule simulation covers only four rule sets |
| E-22 | H | Resolved | A staff-initiated purchase could debit the customer's wallet; staff can now only send quotes |

## Open and partly resolved findings

| ID | Remaining issue | Recommendation |
|---|---|---|
| E-02 | The automatic call relies on its callers; all current callers check eligibility first | Check do-not-contact and consent inside the call function |
| E-03 | Lead premium uses the car tariff for every vehicle | Choose the tariff by vehicle class |
| E-05 | Remaining literals: confirmation prompt below 0.75, assistant "expiry known" at 0.5, assistant +365 days, stuck order after one hour, data-quality completeness denominator | Move them into the service levels or data enrichment rule sets |
| E-08 | The next best action can recommend a call that the contact policy then blocks | Add marketing consent to the call rule |
| E-09 | Profile anonymisation and archival are reported as done by an archival pipeline that does not yet exist | Implement, or show as manual on the operations screen |
| E-10 | Auto-renew and the fleet dashboard are now staff-only; the API description of "confirm my expiry" still mentions earning points | Remove the points wording until loyalty is approved |
| E-11 | Owner type is accepted and key scopes are enforced; any active partner can still quote any plate and supply expiry evidence | Rate-limit per key; raise conflicting partner evidence as data issues |
| E-13 | The copy guard runs on all customer wording, which is conservative, but the configuration suggests otherwise | Document "all wording" or implement scoping |
| E-14 | Lapsed vehicles can receive "expires on" with a past date | Use the lapsed notice when the vehicle has lapsed |
| E-15 | Password and role changes revoke tokens on all servers; sign-out and rate limits remain per server | Shared store, or enforce at the gateway or firewall |
| E-16 | The adoption view reads the latest 5,000 audit entries; the overview pages through all orders | Database aggregates or materialised views |
| E-17 | Journey handoffs build their own phone mask | Use the shared masking function |
| E-21 | No simulation for tariffs, contact policy or triggers | Add quote simulation and contact-policy dry runs |
