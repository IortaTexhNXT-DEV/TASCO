# 05 — Requirements Traceability Matrix (RTM)

**TASCO Insurance × VETC Motor Insurance Growth Platform** · iorta TechNXT · Version 1.0 · October 2026

## 0. How to use this matrix

- Each row traces one functional requirement (doc 02) to its user stories (doc 04), code modules, HTTP endpoints, rule kinds and tests.
- **Code paths** are relative to the repository root. `domain/` = `src/domain/`, `app/` = `src/application/`, `http/` = `src/adapters/http/`, `persist/` = `src/adapters/persistence/`, `integ/` = `src/adapters/integrations/`, `rules/` = `src/rules/`, `shared/` = `src/shared/`. All HTTP endpoints are declared in `src/adapters/http/routes.js` (73 API routes); `/health/*`, `/metrics`, `/api/openapi.json` and static pages are served by `src/adapters/http/app.js`.
- **Test layout:**

  | Layer | Path | What it covers |
  |---|---|---|
  | Unit | `test/unit/*.test.js` | Rules engine (`rulesEngine.test.js`), `jsonLogic`, `decisionTable`, `identity`, `enrichment`, `leads`, `rating`, `contactPolicy`, `voicebot`, `crypto`, `validation`, `stores`, `schema` |
  | Integration | `test/integration/*.test.js` | Services end to end on the memory store |
  | API | `test/api/*.test.js` | HTTP contract, authentication and authorisation |
  | Security | `test/security/*.test.js` | Security controls |
  | PostgreSQL | `test/pg/*.test.js` | PostgreSQL adapter |
  | Performance | `test/perf/load.js` | Load |

- **Test status.** At the time of writing (snapshot 7 Oct 2026) the test suite is being built in parallel. Only `test/unit/identity.test.js` and `test/unit/jsonLogic.test.js` exist. Every other test reference below is **planned** and is marked with `‡`. Re-run this matrix when the suite lands.
- **Build status** is taken from doc 02: B = Built, P = Partial, Pl = Planned.

---

## 1. Matrix

### A. Data and MDM

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-001 | US-001 | `app/ingestionService.js` | `POST /api/data/ingest` | — | `test/integration/ingestion.test.js‡`, `test/api/data.test.js‡` | B |
| FR-002 | US-001 | `domain/identity.js#normalizePlate` | `POST /api/data/ingest`, `POST /api/partner/v1/quotes` | — | `test/unit/identity.test.js` | P (E-03) |
| FR-003 | US-001 | `domain/identity.js#normalizePhone` | as above | — | `test/unit/identity.test.js` | B |
| FR-004 | US-001 | `domain/enrichment.js#buildProfiles, survivors` | `POST /api/data/ingest` | `enrichment` | `test/unit/enrichment.test.js‡` | B |
| FR-005 | US-002 | `domain/enrichment.js#inferExpiry, rollForward` | `GET /api/customers/:id` | `enrichment` | `test/unit/enrichment.test.js‡` | B |
| FR-006 | US-006 | `domain/enrichment.js#inferCategory`, `rules/decisionTable.js` | `GET /api/customers/:id` | `enrichment` | `test/unit/enrichment.test.js‡`, `test/unit/decisionTable.test.js‡` | B |
| FR-007 | US-004 | `domain/enrichment.js`, `app/opsService.js#dqIssues, resolveDq`, `app/voiceService.js#finalize` | `GET /api/dq/issues`, `POST /api/dq/issues/:id/resolve` | `enrichment` | `test/integration/ops.test.js‡`, `test/api/data.test.js‡` | B |
| FR-008 | US-002 | `app/opsService.js#lineage` | `GET /api/customers/:id/lineage` | — | `test/api/customers.test.js‡` | B (E-18) |
| FR-009 | US-003 | `http/routes.js` (handler), `domain/enrichment.js#applyDeclaredExpiry` | `PATCH /api/customers/:id/expiry` | — | `test/api/customers.test.js‡` | B |
| FR-010 | US-005, US-027 | `app/ingestionService.js#rebuild`, `app/customerService.js#declareExpiry`, `app/voiceService.js#finalize`, `app/salesService.js#purchase` | `POST /api/customer/expiry`, `POST /api/voice/sessions/:id/turns` | `enrichment` | `test/integration/ingestion.test.js‡` | B |
| FR-011 | US-001 | `app/ingestionService.js#rebuild`, `bootstrap/container.js#registerSubscribers` | `POST /api/data/ingest` | — | `test/integration/ingestion.test.js‡` | B |

### B. Lead intelligence

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-012 | US-007 | `domain/leads.js#factsFor` | — | all lead kinds | `test/unit/leads.test.js‡` | B |
| FR-013 | US-017, US-018 | `domain/leads.js#assignJourney`, `rules/jsonLogic.js` | `GET /api/leads` | `journeys` | `test/unit/leads.test.js‡`, `test/unit/jsonLogic.test.js` | B |
| FR-014 | US-007 | `domain/leads.js#score` | `GET /api/leads` | `scoring` | `test/unit/leads.test.js‡` | B |
| FR-015 | US-008, US-054 | `domain/leads.js#evaluateLead`, `rules/decisionTable.js` | `GET /api/leads` | `nba` | `test/unit/leads.test.js‡`, `test/unit/decisionTable.test.js‡` | B |
| FR-016 | US-019 | `domain/leads.js#benefitsFor` | `GET /api/leads`, `GET /api/customers/:id` | `benefits` | `test/unit/leads.test.js‡` | B |
| FR-017 | US-007, US-009 | `app/leadService.js#list`, `app/accessPolicy.js` | `GET /api/leads` | `abac` | `test/api/leads.test.js‡`, `test/security/authz.test.js‡` | B |
| FR-018 | US-011 | `app/leadService.js#recompute`, `bootstrap/container.js` (subscribers), `jobs/cli.js` (`recompute`) | `POST /api/leads/recompute` | — | `test/integration/leads.test.js‡` | B |
| FR-019 | US-010 | `app/leadService.js#recomputeOne, hasActiveTascoCover` | — | — | `test/integration/sales.test.js‡` | B |

### C. Journeys and messaging

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-020 | US-012, US-017, US-019 | `domain/leads.js`, `rules/validators.js` | — | `journeys` | `test/unit/rulesEngine.test.js‡` | B |
| FR-021 | US-012 | `domain/leads.js#planTouchpoints` | `GET /api/touchpoints` | `journeys` | `test/unit/leads.test.js‡` | B |
| FR-022 | US-012, US-017 | `app/journeyService.js#runDue, executeTouchpoint`, `jobs/cli.js` (`journeys`) | `POST /api/journeys/run` | `journeys` | `test/integration/journeys.test.js‡`, `test/api/journeys.test.js‡` | B |
| FR-023 | US-013, US-015 | `domain/contactPolicy.js#canContact` | `POST /api/journeys/run`, `POST /api/ecosystem/events` | `contact_policy` | `test/unit/contactPolicy.test.js‡` | B (E-01) |
| FR-024 | US-014, US-067 | `domain/contactPolicy.js#checkCopy`, `rules/validators.js#copyViolations` | `POST /api/rules`, `POST /api/journeys/run` | `copy_guard` | `test/unit/contactPolicy.test.js‡`, `test/unit/rulesEngine.test.js‡` | B |
| FR-025 | US-012, US-015, US-019 | `app/journeyService.js#sendMessage`, `rules/jsonLogic.js#template`, `bootstrap/container.js` (`links`) | `POST /api/journeys/run` | `content.messages` | `test/integration/journeys.test.js‡` | B |
| FR-026 | US-018, US-020, US-021, US-022 | `app/journeyService.js#handleEcosystemEvent` | `POST /api/ecosystem/events` | `triggers`, `contact_policy` | `test/integration/journeys.test.js‡`, `test/api/journeys.test.js‡` | B (live feed Pl) |
| FR-027 | US-040 | `bootstrap/container.js` (subscriber `confirmation-and-cross-sell`) | `POST /api/customer/orders` (side effect) | `content.messages` | `test/integration/sales.test.js‡` | B |
| FR-028 | US-046 | `bootstrap/container.js` (subscriber `confirmation-and-cross-sell`) | — | `journeys.crossSell` | `test/integration/sales.test.js‡` | B |
| FR-029 | US-012 | `app/journeyService.js#schedule` | `GET /api/touchpoints` | — | `test/api/journeys.test.js‡` | B |
| FR-030 | US-010 | `app/journeyService.js#executeTouchpoint` | `POST /api/journeys/run` | — | `test/integration/journeys.test.js‡` | B |

### D. AI voice bot

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-031 | US-023 | `domain/voicebot.js#createDialogue.start` | `POST /api/voice/sessions` | `content.voicebot` | `test/unit/voicebot.test.js‡` | B |
| FR-032 | US-024 | `domain/voicebot.js#turn` (state `verify_plate`), `domain/identity.js#extractPlateFromSpeech` | `POST /api/voice/sessions/:id/turns` | `content.voicebot` | `test/unit/voicebot.test.js‡`, `test/unit/identity.test.js` | B |
| FR-033 | US-024 | `domain/voicebot.js` (state `confirm_expiry`, `maskPlate`) | `POST /api/voice/sessions/:id/turns` | `content.voicebot` | `test/unit/voicebot.test.js‡` | B |
| FR-034 | US-026 | `domain/voicebot.js#keywordClassifier` | `POST /api/voice/sessions/:id/turns` | `content.voicebot` | `test/unit/voicebot.test.js‡` | B |
| FR-035 | US-025 | `domain/voicebot.js` (intent `price`) | `POST /api/voice/sessions/:id/turns` | `content.voicebot`, `copy_guard` | `test/unit/voicebot.test.js‡` | B |
| FR-036 | US-027, US-028 | `app/voiceService.js#finalize` | `POST /api/voice/sessions/:id/turns`, `POST /api/voice/campaign` | — | `test/integration/voice.test.js‡` | B |
| FR-037 | US-030 | `app/voiceService.js#start, turn, get` | `POST /api/voice/sessions`, `GET /api/voice/sessions/:id`, `POST /api/voice/sessions/:id/turns` | — | `test/api/voice.test.js‡` | B |
| FR-038 | US-029, US-054 | `http/routes.js` (campaign handler), `app/voiceService.js#autoCall`, `integ/simulatedCaller.js` | `POST /api/voice/campaign` | `contact_policy` *(should apply)* | `test/integration/voice.test.js‡` | P (E-01, E-02) |
| FR-039 | US-031 | `app/insightsService.js#governance` | `GET /api/dashboard/governance` | — | `test/api/dashboards.test.js‡` | B |

### E. Telesales

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-040 | US-032 | `domain/voicebot.js#handoffSummary` | `GET /api/handoffs/:id` | — | `test/unit/voicebot.test.js‡` | B |
| FR-041 | US-033 | `app/voiceService.js#listHandoffs`, `app/accessPolicy.js#check` | `GET /api/handoffs`, `GET /api/handoffs/:id` | `abac` | `test/api/handoffs.test.js‡`, `test/security/authz.test.js‡` | B |
| FR-042 | US-033 | `app/voiceService.js#updateHandoff` | `PATCH /api/handoffs/:id` | — | `test/integration/voice.test.js‡` | B |
| FR-043 | US-034 | `http/routes.js` (handler), `app/accessPolicy.js#require` | `PATCH /api/handoffs/:id` | `rbac` | `test/api/handoffs.test.js‡` | B |
| FR-044 | US-016 | `app/voiceService.js#createDirectHandoff`, `app/journeyService.js` | `POST /api/journeys/run` | `journeys` | `test/integration/journeys.test.js‡` | B |

### F. Sales and issuance

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-045 | US-035 | `app/salesService.js#catalogue` | `GET /api/products` | `products` | `test/api/sales.test.js‡` | B |
| FR-046 | US-035, US-039, US-041, US-044 | `app/salesService.js#quote`, `domain/rating.js#coverStartDate` | `POST /api/quotes`, `POST /api/customer/quotes`, `POST /api/partner/v1/quotes` | `products`, `tariff.*`, `rating.*`, `benefits` | `test/integration/sales.test.js‡`, `test/unit/rating.test.js‡` | B |
| FR-047 | US-035, US-039, US-051 | `app/salesService.js#purchase`, `integ/mockGateways.js` (wallet, core), `shared/resilience.js` | `POST /api/orders`, `POST /api/customer/orders`, `POST /api/partner/v1/orders` | — | `test/integration/sales.test.js‡`, `test/api/sales.test.js‡` | B (sandbox ports) |
| FR-048 | US-042 | `app/salesService.js#purchase` (compensation) | as above | — | `test/integration/sales.test.js‡` | B |
| FR-049 | US-039 | `app/salesService.js#purchase` (golden-record update) | as above | — | `test/integration/sales.test.js‡` | B |
| FR-050 | US-040, US-077 | `app/salesService.js#verifyCertificate`, `http/app.js` (`/verify/*` → `verify.html`) | `GET /api/public/certificates/:certNo`, `/verify/:certNo` | — | `test/api/public.test.js‡` | B (page Pl) |
| FR-051 | US-035 | `app/salesService.js#listPolicies` | `GET /api/policies` | — | `test/api/sales.test.js‡` | B |
| FR-052 | US-074 | `app/opsService.js#reconcile`, `jobs/cli.js` (`reconcile`) | `POST /api/ops/jobs/:kind` (`reconciliation`) | — | `test/integration/ops.test.js‡` | B |

### G. Products and rating

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-053 | US-006, US-039, US-041 | `domain/rating.js#METHODS.tariff_table` | `POST /api/quotes` (+ customer and partner variants) | `tariff.tnds_car`, `tariff.tnds_motorbike` | `test/unit/rating.test.js‡` | B |
| FR-054 | US-045 | `domain/rating.js#METHODS.rate_on_sum_insured` | as above | `rating.motor_pd` | `test/unit/rating.test.js‡` | B (E-06) |
| FR-055 | US-044 | `domain/rating.js#METHODS.per_seat` | as above | `rating.pa_seat` | `test/unit/rating.test.js‡` | B |
| FR-056 | US-025, US-039 | `domain/rating.js#rate` (`priceRegulated` note) | as above | `products` | `test/unit/rating.test.js‡` | B |
| FR-057 | US-063 | `rules/validators.js` (`products`), `domain/rating.js` | `POST /api/rules` | `products` | `test/unit/rulesEngine.test.js‡` | B |

### H. Value and benefits

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-058 | US-043 | `domain/leads.js#benefitsFor`, `app/leadService.js#benefitsForStaff` | `GET /api/customer/home`, `GET /api/customers/:id` | `benefits` | `test/unit/leads.test.js‡` | B |
| FR-059 | US-043 | `domain/leads.js#benefitsFor` | as above | `benefits` | `test/unit/leads.test.js‡` | B |
| FR-060 | US-047 | — (gated config only) | — | `benefits` (`loyalty_points`), `referral` | `test/unit/leads.test.js‡` (gating) | Pl |
| FR-061 | US-048 | — | — *(endpoint to be added)* | `benefits` (`auto_renew`) | `test/integration/customer.test.js‡` | Pl (E-10) |
| FR-062 | US-020 | `app/journeyService.js#handleEcosystemEvent` | `POST /api/ecosystem/events` | `triggers`, `benefits` | `test/integration/journeys.test.js‡` | P |

### I. Partners and fleet

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-063 | US-049, US-053 | `app/partnerService.js#create, setStatus, list` | `GET/POST /api/partners`, `PATCH /api/partners/:id` | — | `test/api/partners.test.js‡` | B |
| FR-064 | US-049 | `app/partnerService.js#issueApiKey, revokeApiKey, authenticateKey`, `shared/crypto.js` | `POST /api/partners/:id/keys`, `DELETE /api/partners/keys/:keyId` | — | `test/api/partners.test.js‡`, `test/security/authz.test.js‡` | B |
| FR-065 | US-050 | `http/routes.js` (partner quote handler), `app/ingestionService.js`, `app/salesService.js#quote` | `POST /api/partner/v1/quotes` | `products`, `enrichment` | `test/api/partnerApi.test.js‡` | B (E-11) |
| FR-066 | US-051 | `http/routes.js` (ownership check), `app/salesService.js#purchase` | `POST /api/partner/v1/orders` | — | `test/api/partnerApi.test.js‡` | B |
| FR-067 | US-052 | `app/salesService.js#listPolicies`, `app/partnerService.js#statement` | `GET /api/partner/v1/policies`, `GET /api/partner/v1/statement` | — | `test/api/partnerApi.test.js‡` | B |
| FR-068 | US-052, US-068 | `domain/rating.js#commissionFor`, `rules/validators.js` (`commission`) | `POST /api/partner/v1/orders` (side effect), `POST /api/rules` | `commission` | `test/unit/rating.test.js‡`, `test/unit/rulesEngine.test.js‡` | B |
| FR-069 | US-052 | `app/partnerService.js#statement` | `GET /api/partners/:id/statement` | — | `test/api/partners.test.js‡` | B |
| FR-070 | US-054, US-055 | `domain/leads.js` (NBA), `http/routes.js` (campaign excludes `company`) | `GET /api/leads?action=route_b2b` | `nba`, `benefits` (`fleet_dashboard`) | `test/unit/leads.test.js‡` | P (E-07, E-10) |

### J. Claims FNOL

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-071 | US-056 | `app/claimsService.js#submit` | `POST /api/customer/claims` | — *(SLA should be a rule, E-05)* | `test/integration/claims.test.js‡`, `test/api/customerApp.test.js‡` | B |
| FR-072 | US-057 | `app/claimsService.js#transition, list` (`TRANSITIONS`) | `GET /api/claims`, `PATCH /api/claims/:id` | — | `test/integration/claims.test.js‡` | B |
| FR-073 | US-058 | `app/claimsService.js#list` | `GET /api/customer/claims` | — | `test/api/customerApp.test.js‡` | B |

### K. Customer self-service and privacy

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-074 | US-036 | `bootstrap/container.js` (`links.sign/verify`), `app/customerService.js#issueCustomerToken` | `POST /api/customer/session` | `abac` (`customer_self`) | `test/api/customerApp.test.js‡`, `test/security/authz.test.js‡` | B (VETC SSO Pl) |
| FR-075 | US-037 | `app/customerService.js#home` | `GET /api/customer/home` | `benefits` | `test/integration/customer.test.js‡` | B |
| FR-076 | US-038 | `app/customerService.js#declareExpiry` | `POST /api/customer/expiry` | — | `test/integration/customer.test.js‡` | B |
| FR-077 | US-035, US-039 | `app/salesService.js` | `POST /api/customer/quotes`, `POST /api/customer/orders` | `products`, `tariff.*`, `rating.*` | `test/api/customerApp.test.js‡` | B (UI Pl) |
| FR-078 | US-028, US-059 | `app/customerService.js#updateConsent`, `app/ingestionService.js#rebuild` (overrides) | `PUT /api/customer/consent` | `contact_policy` | `test/integration/customer.test.js‡` | B |
| FR-079 | US-060 | `app/customerService.js#exportData` | `GET /api/customer/data-export` | — | `test/api/customerApp.test.js‡` | B |
| FR-080 | US-061 | `app/customerService.js#exportData, erase` | `POST /api/dsar/:id/export`, `POST /api/dsar/:id/erase` | `retention` | `test/integration/customer.test.js‡` | P (E-19) |
| FR-081 | US-062 | `app/accessPolicy.js#maskProfile`, `shared/util.js#maskPhone, maskName` | `GET /api/customers/:id` | `rbac` | `test/security/authz.test.js‡` | B |

### L. Rules governance

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-082 | US-063 | `app/rulesService.js#list, byId, get` | `GET /api/rules`, `GET /api/rules/:id` | all | `test/integration/rules.test.js‡` | B |
| FR-083 | US-063, US-067, US-068 | `app/rulesService.js#createDraft`, `rules/validators.js`, `rules/jsonLogic.js#validate`, `rules/decisionTable.js#validateTable` | `POST /api/rules` | all | `test/unit/rulesEngine.test.js‡`, `test/unit/jsonLogic.test.js`, `test/unit/decisionTable.test.js‡` | B |
| FR-084 | US-063 | `app/rulesService.js#validate` | `POST /api/rules/validate` | all | `test/api/rules.test.js‡` | B |
| FR-085 | US-064 | `http/routes.js` (simulate handler), `domain/leads.js#evaluateLead` | `POST /api/rules/simulate` | `scoring`, `nba`, `journeys`, `benefits` | `test/api/rules.test.js‡` | B |
| FR-086 | US-065 | `app/rulesService.js#submit, approve, reject` | `POST /api/rules/:id/submit`, `/approve`, `/reject` | all | `test/integration/rules.test.js‡`, `test/security/authz.test.js‡` | B |
| FR-087 | US-066 | `app/rulesService.js#rollback` | `POST /api/rules/:id/rollback` | all | `test/integration/rules.test.js‡` | B |
| FR-088 | — | `app/rulesService.js#loadDefaults`, `bootstrap/seed.js#seedRules` | — (CLI `npm run job rules`) | all | `test/integration/rules.test.js‡` | B |

### M. Identity and access

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-089 | US-069, US-070 | `app/identityService.js#login`, `shared/crypto.js#hashPassword, verifyPassword` | `POST /api/auth/login` | — | `test/integration/identity.test.js‡`, `test/api/auth.test.js‡` | B |
| FR-090 | US-069 | `app/identityService.js#verifyMfa`, `shared/crypto.js#totp, verifyTotp` | `POST /api/auth/mfa`, `GET /api/demo/totp/:username` (demo only) | — | `test/unit/crypto.test.js‡`, `test/api/auth.test.js‡` | B |
| FR-091 | US-069 | `shared/crypto.js#signJwt, verifyJwt`, `app/identityService.js#logout, authenticate` | `POST /api/auth/logout`, `GET /api/auth/me` | — | `test/unit/crypto.test.js‡`, `test/security/authz.test.js‡` | P (E-15) |
| FR-092 | US-071 | `app/accessPolicy.js#permissions, require` | all staff routes | `rbac` | `test/security/authz.test.js‡` | B |
| FR-093 | US-009, US-033 | `app/accessPolicy.js#check` | `GET /api/customers/:id`, `GET/PATCH /api/handoffs*` | `abac` | `test/security/authz.test.js‡` | P (E-18) |
| FR-094 | US-071 | `app/identityService.js#createUser, update, list` | `GET/POST /api/users`, `PATCH /api/users/:id` | `rbac` | `test/api/users.test.js‡` | B |
| FR-095 | US-036, US-049 | `app/partnerService.js#authenticateKey`, `app/identityService.js#authenticate`, `http/app.js` | partner and customer routes | — | `test/security/authz.test.js‡` | B |
| FR-096 | US-071 | `app/identityService.js#changePassword`, `shared/crypto.js#checkPasswordPolicy` | `POST /api/auth/password` | — | `test/unit/crypto.test.js‡` | B |

### N. Audit

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-097 | US-003, US-062 | `app/auditService.js#record` (called by all services), `persist/memoryStore.js`, `persist/postgresStore.js` | — | — | `test/integration/*.test.js‡` | B |
| FR-098 | US-072 | `app/auditService.js#list` | `GET /api/audit` | — | `test/api/audit.test.js‡` | B |
| FR-099 | US-072 | `persist/auditChain.js#verifyChain, entryHash, canonical`, `db/migrations/001_init.sql` (append-only trigger) | `GET /api/audit/verify` | — | `test/unit/stores.test.js‡`, `test/pg/postgresStore.test.js‡` | B |

### O. Operations, reporting and UI

| FR | US | Code module(s) | API endpoint(s) | Rule kind(s) | Test file(s) | Build |
|---|---|---|---|---|---|---|
| FR-100 | US-073 | `app/insightsService.js#overview` | `GET /api/dashboard/overview` | `costs` | `test/integration/insights.test.js‡`, `test/api/dashboards.test.js‡` | B (E-12, E-16) |
| FR-101 | — | `app/insightsService.js#adoption` | `GET /api/dashboard/adoption` | — | `test/api/dashboards.test.js‡` | B |
| FR-102 | US-031 | `app/insightsService.js#governance` | `GET /api/dashboard/governance` | — | `test/api/dashboards.test.js‡` | B |
| FR-103 | US-074 | `http/routes.js` (ops status), `shared/resilience.js` | `GET /api/ops/status` | — | `test/api/ops.test.js‡` | B |
| FR-104 | US-074 | `app/opsService.js#recordRun, jobRuns`, `adapters/messaging/outboxEventBus.js`, `jobs/cli.js` | `GET /api/ops/jobs`, `POST /api/ops/jobs/:kind` | — | `test/integration/ops.test.js‡` | B |
| FR-105 | US-075 | `app/opsService.js#applyRetention` | `POST /api/ops/jobs/retention` | `retention` | `test/integration/ops.test.js‡` | P (E-09) |
| FR-106 | — | `http/app.js`, `http/openapi.js`, `shared/metrics.js` | `/health/live`, `/health/ready`, `/metrics`, `/api/openapi.json`, `GET /api/meta` | — | `test/api/platform.test.js‡` | B |
| FR-107 | — | `bootstrap/seed.js`, `integ/syntheticVetcSource.js`, `shared/config.js` | `GET /api/demo/totp/:username`, `GET /api/meta` (demo customers) | — | `test/integration/seed.test.js‡` | B |
| FR-108 | US-022, US-076 | `public/index.html`, `public/js/console/*`, `public/css/*` | all staff routes | — | UI end-to-end (planned, tool TBD) | Pl |
| FR-109 | US-077 | `public/app/index.html`, `public/js/customer/*`, `public/verify.html`, `public/js/verify.js` | customer and public routes | — | UI end-to-end (planned) | Pl |
| FR-110 | US-076 | `public/js/shared/*` (i18n, theme) | — | — | UI end-to-end (planned) | Pl |

---

## 2. Coverage summary

| Capability | FRs | With ≥ 1 user story | With API endpoint | With rule kind | Built | Partial | Planned |
|---|---:|---:|---:|---:|---:|---:|---:|
| A Data and MDM | 11 | 11 | 11 | 5 | 10 | 1 | 0 |
| B Lead intelligence | 8 | 8 | 6 | 6 | 8 | 0 | 0 |
| C Journeys and messaging | 11 | 11 | 9 | 9 | 11 | 0 | 0 |
| D Voice bot | 9 | 9 | 9 | 6 | 8 | 1 | 0 |
| E Telesales | 5 | 5 | 5 | 3 | 5 | 0 | 0 |
| F Sales and issuance | 8 | 8 | 8 | 2 | 8 | 0 | 0 |
| G Products and rating | 5 | 5 | 5 | 5 | 5 | 0 | 0 |
| H Value and benefits | 5 | 5 | 3 | 5 | 2 | 1 | 2 |
| I Partners and fleet | 8 | 8 | 8 | 3 | 7 | 1 | 0 |
| J Claims | 3 | 3 | 3 | 0 | 3 | 0 | 0 |
| K Customer and privacy | 8 | 8 | 8 | 6 | 7 | 1 | 0 |
| L Rules governance | 7 | 6 | 6 | 7 | 7 | 0 | 0 |
| M Identity and access | 8 | 8 | 8 | 3 | 6 | 2 | 0 |
| N Audit | 3 | 3 | 2 | 0 | 3 | 0 | 0 |
| O Ops and UI | 11 | 8 | 10 | 2 | 7 | 1 | 3 |
| **Total** | **110** | **106** | **101** | **62** | **97** | **8** | **5** |

*Counting rule:* "Built" here counts B and B(…) rows (built with a noted gap or a planned UI or integration), "Partial" counts P rows, and "Planned" counts Pl rows. FR-088, FR-101, FR-106 and FR-107 are platform requirements without a dedicated user story.

---

## 3. Engineering notes: inconsistencies found during documentation

These were found while tracing requirements to code. They are recorded here so that engineering can triage them; IDs are referenced from docs 01–04. **Severity:** H = compliance, security or money risk; M = functional gap or misleading behaviour; L = hygiene.

| ID | Sev | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| **E-01** | H | The automated voice campaign route bypasses the contact policy. It checks only `consent.call`, `dnc`, phone and owner type, so it ignores the 08:00–20:00 window, the weekly call cap and marketing consent. | `src/adapters/http/routes.js` (`POST /api/voice/campaign`) vs `domain/contactPolicy.js#canContact` | Call `canContact(policy, profile, 'voice_bot', { marketing: true, now, history })` per lead and report skipped reasons. |
| **E-02** | M | `voiceService.autoCall` does not itself refuse DNC customers (`start()` does); it relies on callers. | `src/application/voiceService.js` | Guard DNC and consent inside `autoCall`. |
| **E-03** | M | Plate regex accepts only car formats (`^\d{2}[A-Z]{1,2}\d{4,5}$`). The comment says motorbike plates like `51G1-678.90` are handled, but they are rejected, so `TNDS_MOTORBIKE` cannot be sold to most motorbikes. Lead premium is always computed with the `tariff.tnds_car` rule. | `src/domain/identity.js`, `src/application/leadService.js#tndsPremium` | Extend the regex to series + digit (e.g. `G1`); choose the tariff by vehicle class. |
| **E-04** | M | Product channel `zalo` exists in `products.json`, but no route ever sets `channel: 'zalo'`. Customer quotes are hardcoded to `vetc_app`, so Zalo mini-app sales cannot be attributed or restricted. | `routes.js` (`POST /api/customer/quotes`) | Derive the channel from the customer token's audience or client ID. |
| **E-05** | M | Business thresholds are hardcoded, contrary to NFR-062:<br>• claim SLA 4 h (`claimsService.js`)<br>• quote TTL 24 h (`salesService.js`)<br>• `needsConfirmation` < 0.75 (`customerService.js`)<br>• `expiryKnown` ≥ 0.5 (`voicebot.js`, should read `enrichment.usableExpiryConfidence`)<br>• customer-declared confidence **0.8** (`customerService.js`) vs **0.75** in `enrichment.json`<br>• steward confidence 0.9 (`routes.js`)<br>• bot "already renewed" confidence 0.6 and +365 days (`voiceService.js`)<br>• stuck-order threshold 1 h (`opsService.js`)<br>• DQ completeness denominator 5 (`enrichment.js`) | as listed | Move these into rule kinds (`enrichment`, a new `sales` / `claims` kind) and validate them. |
| **E-06** | M | `MOTOR_PD` has `requiresInspection: true`, but quote and purchase never enforce a vehicle inspection or photo step, and it is sellable on `vetc_app`. | `products.json`, `salesService.js` | Add a pre-bind inspection state (photo upload or assessor) or remove PD from self-service channels until ready. |
| **E-07** | M | Company-owned vehicles enter B2C journeys: journey audiences do not exclude `ownerType = company`, while the NBA routes them to B2B. Fleet drivers can therefore get B2C reminders and calls from journey steps. | `journeys.json`, `nba.json` | Add `{"!=": [{"var":"ownerType"},"company"]}` to the B2C audiences, or add a `fleet` journey. |
| **E-08** | L | The `hot_call` NBA recommends `voice_bot` on `consent.call` alone. Execution also requires `marketing` consent (marketing step), so the NBA can recommend an action the contact policy will block. | `nba.json`, `contact_policy.json` | Add `consent.marketing` to `hot_call`. |
| **E-09** | M | Retention is only partly executed: only `source_records` and `voice_sessions` are deleted. Profile anonymisation after 1,825 days, and archival of messages, orders, certificates and audit, are reported as "executed by archival pipeline", which does not exist. | `opsService.js#applyRetention` | Implement anonymisation and archival, or mark them clearly as manual in the ops UI. |
| **E-10** | M | Customer-visible approved benefits promise features that do not exist yet: `auto_renew` (no opt-in endpoint or confirm-before-debit flow) and `fleet_dashboard` (no fleet view or consolidated invoice). The NBA label and the `/api/customer/expiry` summary say "earns points" while `loyalty_points` is pending legal review. | `benefits.json`, `nba.json` (`fix_data`), `routes.js` | Set these benefits to `pending` until built; remove the "earns points" wording until loyalty is approved. |
| **E-11** | M | Partner API: `ownerType` is hardcoded to `individual`, so fleet partners cannot onboard company vehicles. Any active partner can quote any plate in the VETC base, and partner-supplied `currentExpiry` is ingested as evidence, which is a data-poisoning and enumeration vector. | `routes.js` (`POST /api/partner/v1/quotes`) | Accept `ownerType`; rate-limit per key; weight partner evidence by source trust (already the case) and flag conflicts as DQ issues; consider a consent token for existing VETC customers. |
| **E-12** | L | The dashboard metric `profilesWithUsableData` uses `dq_score >= 50` as a proxy, not `expiryConfidence >= usableExpiryConfidence` (the K-01 definition). | `insightsService.js#overview` | Index `policy.expiryConfidence` and count against the rule threshold. |
| **E-13** | L | `copy_guard.appliesTo: "priceRegulated"` is ignored: the guard runs on all customer copy. This is conservative, but the configuration is misleading. | `copy_guard.json`, `contactPolicy.js#checkCopy` | Document "all copy" or implement product scoping. |
| **E-14** | L | Trigger `wallet_topup` fires for days −30..30 but uses `first_reminder` ("expires on {{expiry}}"). For lapsed vehicles that reads as a future date. | `triggers.json` | Use `lapsed_notice` when `days < 0` (split into two triggers). |
| **E-15** | M | Logout revocation and rate limiting are held in memory per replica, so they are ineffective with more than one replica. | `identityService.js` (`revoked` Map), `security.js#createRateLimiter` | Move to a shared store (Postgres table or Redis) or enforce at the gateway or WAF. |
| **E-16** | L | Insights do not scale to 6 M records: `adoption()` reads only the latest 5,000 audit entries, and `overview()` pages through **all** orders to sum premium. | `insightsService.js` | Use SQL aggregates or materialised views. |
| **E-17** | L | Phone masking is inconsistent: `createDirectHandoff` builds its own mask instead of `shared/util.js#maskPhone`. | `voiceService.js` | Use the shared helper. |
| **E-18** | M | ABAC regional policy is not applied to `GET /api/customers/:id/lineage` or `PATCH /api/customers/:id/expiry`. `GET /api/handoffs/:id` lets an agent read **unassigned** handoffs from other regions by ID. | `routes.js` | Call `access.check(principal,'read',{type:'profile',region})` on lineage and expiry; add a region condition to `agent_own_handoffs`. |
| **E-19** | H | DSAR erasure does not scrub PII held in `handoffs` (name), `claims` (description, location) or audit `details`. | `customerService.js#erase`, `schema.js` | Extend erasure to these collections; keep audit entries but pseudonymise details. |
| **E-20** | M | Quality gates are not yet runnable: `test/` is being built (2 unit files at snapshot), so coverage thresholds in `package.json` cannot pass. There is no ESLint config, Dockerfile or K8s manifest yet. Docs referenced in code (`docs/architecture/integration-architecture.md`, ADR-004/005/007) must exist. | repository root | Track in the delivery plan; block release on NFR-042 and NFR-043. |
| **E-21** | L | Rule simulation supports only `scoring`, `nba`, `journeys` and `benefits`, not tariffs, contact policy or triggers. | `routes.js` (simulate) | Extend to quote simulation and `canContact` dry-runs. |
| **E-22** | H | Staff-initiated purchase (`POST /api/orders` with `policy:issue`) debits the customer's VETC wallet without in-app customer confirmation. This contradicts the trust principle "payment only in the VETC app" and the bot and telesales scripts. | `routes.js`, `salesService.js#purchase` | Require a customer confirmation (in-app approve or wallet pre-authorisation) for staff-channel orders, or restrict `POST /api/orders` to sending a pay link. |
