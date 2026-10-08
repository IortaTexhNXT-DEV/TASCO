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
The password is `Tasco@Demo2026!` unless you set `DEMO_PASSWORD`. For accounts with MFA, demo mode adds a "Sign in with demo code (UAT)" button on the code screen.

With PostgreSQL: `docker compose up --build` → http://localhost:8080.

## Quality gates

```bash
npm run lint              # ESLint, zero errors
npm test                  # unit + integration + API + security + functional (235 tests)
npm run test:functional   # 124 business scenarios from the user stories (Given/When/Then)
npm run test:coverage     # gate: ≥80% lines/functions, ≥70% branches (currently 99.5% lines / 91.6% branches)
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

**TASCO core is the master for products and rating.** Bindable quotes are priced by TASCO's core system through the `CoreRating` port (`RATING_SOURCE=core` or `core_with_fallback`), and catalogue changes from core arrive as drafts for maker-checker approval. Sandbox and UAT use a simulated core behind the same port.

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
| `docs/` | the documentation set in **Word** (38 documents, below), the proposal and cover letter, and test cases & results in `docs/quality/TASCO-Test-Cases-and-Results.xlsx` |
| `tools/docs-source/` | Markdown sources, screenshots and the generator for the Word documents |

## Proposal to TASCO Insurance

[Cover Letter](<docs/proposal/ITN-TASCO-2026-001 Cover Letter.docx>) · [Proposal for the TASCO Motor Insurance Growth Platform](<docs/proposal/ITN-TASCO-2026-001 Proposal for the TASCO Motor Insurance Growth Platform.docx>)

## Documentation

38 documents, counted by topic, each in **Word** on the iorta TechNXT template (cover, contents, document control, acronyms, numbered sections, sign-off). Sources are in `tools/docs-source/`.

| Area | Documents |
|---|---|
| Register | [Document Register](<docs/TGP-00 Document Register.docx>) |
| Business | [Business Context and Growth Strategy](<docs/business/TGP-BUS-01 Business Context and Growth Strategy.docx>) · [Functional Requirements Specification](<docs/business/TGP-BUS-02 Functional Requirements Specification.docx>) · [Non-Functional Requirements](<docs/business/TGP-BUS-03 Non-Functional Requirements.docx>) · [User Stories and Acceptance Criteria](<docs/business/TGP-BUS-04 User Stories and Acceptance Criteria.docx>) · [Requirements Traceability Matrix](<docs/business/TGP-BUS-05 Requirements Traceability Matrix.docx>) · [Personas and Customer Journeys](<docs/business/TGP-BUS-06 Personas and Customer Journeys.docx>) · [Commercials and Engagement Model](<docs/business/TGP-BUS-07 Commercials and Engagement Model.docx>) |
| Architecture | [OpenAPI](docs/api/openapi.json) · [Solution Architecture](<docs/architecture/TGP-ARC-01 Solution Architecture.docx>) · [Integration Architecture](<docs/architecture/TGP-ARC-02 Integration Architecture.docx>) · [Data Architecture](<docs/architecture/TGP-ARC-03 Data Architecture.docx>) · [Security Architecture](<docs/architecture/TGP-ARC-04 Security Architecture.docx>) · [Deployment and Infrastructure Architecture](<docs/architecture/TGP-ARC-05 Deployment and Infrastructure Architecture.docx>) · [AI Governance](<docs/architecture/TGP-ARC-06 AI Governance.docx>) · [Architecture Decision Records](<docs/architecture/TGP-ARC-07 Architecture Decision Records.docx>) |
| UX | [Design System](<docs/ux/TGP-UX-01 Design System.docx>) · [UX Standards and Accessibility](<docs/ux/TGP-UX-02 UX Standards and Accessibility.docx>) · [Information Architecture and Navigation](<docs/ux/TGP-UX-03 Information Architecture and Navigation.docx>) · [Usability Testing Plan](<docs/ux/TGP-UX-04 Usability Testing Plan.docx>) |
| Quality | **[Test cases & results (Excel)](docs/quality/TASCO-Test-Cases-and-Results.xlsx)** · [Test Strategy](<docs/quality/TGP-QA-01 Test Strategy.docx>) · [Test Case Catalogue](<docs/quality/TGP-QA-02 Test Case Catalogue.docx>) · [Performance and Capacity Test Plan](<docs/quality/TGP-QA-03 Performance and Capacity Test Plan.docx>) · [User Acceptance Test Plan](<docs/quality/TGP-QA-04 User Acceptance Test Plan.docx>) |
| Delivery | [Project Plan](<docs/delivery/TGP-DEL-01 Project Plan.docx>) · [Delivery Methodology](<docs/delivery/TGP-DEL-02 Delivery Methodology.docx>) · [RACI Matrix](<docs/delivery/TGP-DEL-03 RACI Matrix.docx>) · [Risk Register](<docs/delivery/TGP-DEL-04 Risk Register.docx>) · [Knowledge Transfer Plan](<docs/delivery/TGP-DEL-05 Knowledge Transfer Plan.docx>) · [Organisational Change and Training Plan](<docs/delivery/TGP-DEL-06 Organisational Change and Training Plan.docx>) |
| Operations | [Runbook and Support Guide](<docs/operations/TGP-OPS-01 Runbook and Support Guide.docx>) · [Monitoring and Alerting](<docs/operations/TGP-OPS-02 Monitoring and Alerting.docx>) · [Disaster Recovery and Business Continuity Plan](<docs/operations/TGP-OPS-03 Disaster Recovery and Business Continuity Plan.docx>) · [Production Readiness Checklist](<docs/operations/TGP-OPS-04 Production Readiness Checklist.docx>) · [Go-Live and Hypercare Plan](<docs/operations/TGP-OPS-05 Go-Live and Hypercare Plan.docx>) · [Release and Change Management](<docs/operations/TGP-OPS-06 Release and Change Management.docx>) |
| Manuals | [Staff Console User Manual](<docs/manuals/TGP-MAN-01 Staff Console User Manual.docx>) · [Customer App Guide](<docs/manuals/TGP-MAN-02 Customer App Guide.docx>) · [Partner API Integration Guide](<docs/manuals/TGP-MAN-03 Partner API Integration Guide.docx>) |

## Honest status

- **Sandbox integrations.** The VETC wallet, Zalo ZNS, SMS, push and voice-AI adapters are sandbox implementations. TASCO core rating and catalogue have a production REST connector (`tascoCoreRatingClient.js`) whose paths and payloads must be confirmed against TASCO's specification; policy issuance is still a sandbox adapter. Production adapters implement the same ports (see the integration architecture).
- **Illustrative figures.** Regulated TNDS premiums follow Decree 67/2023 and need confirmation by TASCO underwriting. Voluntary-product rates and unit costs are illustrative. Every regulatory statement is marked "confirm with TASCO legal".
- **Open items.** Known issues and planned hardening are tracked in the test strategy's known-issues register and in `security-architecture.md` §15. Examples: a shared rate limiter and token revocation store across replicas, and keyset paging at full 6-million scale.
