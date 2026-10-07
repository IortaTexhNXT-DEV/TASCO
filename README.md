# TASCO Growth Platform

**TASCO Insurance × VETC: motor insurance growth platform (new business and retention)**
Built by [iorta TechNXT](https://www.iortatechnxt.com) for TASCO Insurance.

VETC serves about 6 million car drivers, and 70–80% of them use the VETC app. Yet renewals through VETC's own channels are close to zero:

- the data is weak (only 1 record in 10 has a valid policy stamp);
- customers don't trust sales calls;
- discounts are illegal;
- partners close most deals.

This platform turns the VETC relationship into a trusted, data-driven insurance channel. It covers new business as well as renewals.

| Challenge track | What the platform does |
|---|---|
| **Lead scoring & enrichment** | Builds one golden record per vehicle from incomplete VETC and partner records. Records lineage and confidence for every field. Ranks leads with an explainable score. Repairs data at every touch: customers confirm their own expiry in the app, and voice-bot answers feed back into the record. |
| **AI voice bot** | Says up front that it is an automated assistant. Verifies the **licence plate first**. Never asks for OTP or payment. Answers price questions truthfully: TNDS premiums are regulated and the same everywhere. Hands hot leads to telesales with a summary and talking points. |
| **Renewal engine → journey engine** | Five journeys driven by rules: renewal, conquest (insured elsewhere), new vehicle (new VETC tag), uninsured recovery, and cross-sell. Each journey has a timed cadence across app push, Zalo ZNS, SMS, voice bot and telesales. Consent, the 08:00–20:00 contact window, frequency caps and the copy guard are enforced on every send. Key ecosystem moments trigger messages: tag activation, inspection booked, wallet top-up. |
| **Value beyond discount** | 24/7 roadside assistance, instant e-certificate with QR check, inspection booking, a claims fast-lane, multi-year cover, and add-on accident or physical-damage cover. Loyalty points stay staff-only until legal approval. |
| **Beyond the brief** | Partner API and portal with statutory commission caps (partners sell *through* the platform). Fleet routing to B2B. Accident reporting (FNOL) in the app. A consent centre and data-subject rights. A maker-checker rules studio, a hash-chained audit trail, and role-based dashboards. |

## Quick start

```bash
npm ci
npm run start:demo        # in-memory store, synthetic data, demo users
# open http://localhost:3000        staff console
# open http://localhost:3000/app/   customer app (mobile)
```

Demo users: `campaign`, `agent.hn`, `supervisor`, `author`, `approver`, `compliance`, `steward`, `claims`, `partners`, `exec`, `auditor`, `admin`, `support`.
The password is `Tasco@Demo2026!` unless you set `DEMO_PASSWORD`. For accounts with MFA, demo mode adds a "Demo: fill code" button on the code screen.

With PostgreSQL: `docker compose up --build` → http://localhost:8080.

## Quality gates

```bash
npm run lint              # ESLint, zero errors
npm test                  # unit + integration + API + security (86 tests)
npm run test:coverage     # gate: ≥80% lines/functions, ≥70% branches (currently ~99% / ~91%)
npm run test:pg           # PostgreSQL adapter (needs TEST_DATABASE_URL)
npm run test:perf         # load smoke with p95 budget
```

CI (`.github/workflows/ci.yml`) runs the checks above plus:

- CodeQL (static analysis)
- `npm audit` and dependency review
- gitleaks (secret scanning)
- Trivy (image scanning)
- an SBOM
- an OWASP ZAP baseline (dynamic scan)

## Architecture in one paragraph

The platform uses hexagonal / clean architecture on Node.js 22. Its only runtime dependency is `pg`.

- `src/domain/` holds pure business logic.
- `src/application/` holds the use cases.
- `src/adapters/` holds the HTTP, persistence (PostgreSQL or in-memory), messaging (transactional outbox) and integration adapters (VETC wallet, TASCO core, Zalo, SMS, push, voice AI — all sandbox implementations here).
- `src/bootstrap/container.js` is the composition root that wires them together.

**No business rules are hard-coded.** Products, tariffs, rating, scoring, next best action, journeys, triggers, contact policy, copy guard, benefits, commission, retention, message templates and the voice-bot script are versioned JSON Logic rule sets (`config/rules/`). They change through a maker-checker workflow with simulation and full audit.

Security controls:

- RBAC + ABAC, with TOTP MFA and separation of duties
- AES-256-GCM field encryption with blind indexes
- scrypt password hashing
- a strict CSP
- parameterised SQL only
- an append-only, hash-chained audit trail enforced by the database

## Repository map

| Path | Contents |
|---|---|
| `src/` | application code (domain, application, adapters, bootstrap, jobs) |
| `config/rules/` | business rule sets (seeded as version 1; changed via the Rules studio) |
| `config/security/rbac.json` | roles → permissions, SoD pairs, rule kinds needing compliance approval |
| `db/migrations/` | numbered SQL migrations (never edit an applied one) |
| `public/` | staff console, customer app, certificate verification page (vanilla JS, CSP-strict) |
| `test/` | unit, integration, API, security, Postgres and performance tests |
| `deploy/k8s/` | Kubernetes manifests (Deployment, HPA, PDB, NetworkPolicy, CronJobs, ExternalSecret) |
| `Dockerfile`, `docker-compose.yml`, `railway.json` | container and Railway deployment |
| `docs/` | full documentation set (below) |

## Documentation

| Area | Documents |
|---|---|
| Business | [Strategy & business case](docs/business/01-business-context-and-growth-strategy.md) · [FRS](docs/business/02-functional-requirements-specification.md) · [NFR](docs/business/03-non-functional-requirements.md) · [User stories](docs/business/04-user-stories-and-acceptance-criteria.md) · [Traceability](docs/business/05-requirements-traceability-matrix.md) · [Personas & journeys](docs/business/06-personas-and-journey-maps.md) · [Commercials](docs/business/07-commercials-and-engagement-model.md) |
| Architecture | [Solution](docs/architecture/solution-architecture.md) · [ADRs](docs/architecture/adr/) · [Integration](docs/architecture/integration-architecture.md) · [Deployment & infrastructure](docs/architecture/deployment-and-infrastructure-architecture.md) · [Data (ERD, dictionary)](docs/architecture/data-architecture.md) · [Security & threat model](docs/architecture/security-architecture.md) · [AI governance](docs/architecture/ai-governance.md) · [OpenAPI](docs/api/openapi.json) |
| Quality | [Test strategy](docs/quality/test-strategy.md) · [Test cases](docs/quality/test-case-catalogue.md) · [Performance plan](docs/quality/performance-and-capacity-test-plan.md) · [UAT plan](docs/quality/uat-plan.md) |
| Operations | [Runbook & support](docs/operations/runbook-and-support-guide.md) · [Monitoring](docs/operations/monitoring-and-alerting.md) · [DR/BCP](docs/operations/dr-bcp.md) · [Production readiness](docs/operations/production-readiness-checklist.md) · [Go-live & hypercare](docs/operations/go-live-and-hypercare-plan.md) · [Release & change](docs/operations/release-and-change-management.md) |
| Delivery | [Project plan](docs/delivery/project-plan.md) · [Methodology](docs/delivery/delivery-methodology.md) · [RACI](docs/delivery/raci.md) · [Risk register](docs/delivery/risk-register.md) · [KT plan](docs/delivery/kt-plan.md) · [Change & training](docs/delivery/change-management-and-training.md) |
| UX | [Design system](docs/ux/design-system.md) · [Standards & accessibility](docs/ux/ux-standards-and-accessibility.md) · [IA & journeys](docs/ux/journey-maps-and-information-architecture.md) · [Usability testing](docs/ux/usability-testing-plan.md) |
| Manuals | [User manual](docs/manuals/user-manual.md) · persona manuals · [Partner API guide](docs/manuals/partner-api-guide.md) · [Customer app guide](docs/manuals/customer-app-guide.md) |

## Honest status

- **Sandbox integrations.** The VETC wallet, TASCO core, Zalo ZNS, SMS, push and voice-AI adapters are sandbox implementations. Production adapters implement the same ports (see the integration architecture).
- **Illustrative figures.** Regulated TNDS premiums follow Decree 67/2023 and need confirmation by TASCO underwriting. Voluntary-product rates and unit costs are illustrative. Every regulatory statement is marked "confirm with TASCO legal".
- **Open items.** Known issues and planned hardening are tracked in the test strategy's known-issues register and in `security-architecture.md` §15. Examples: a shared rate limiter and token revocation store across replicas, and keyset paging at full 6-million scale.
