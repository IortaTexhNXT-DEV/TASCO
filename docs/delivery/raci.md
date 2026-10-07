# RACI Matrix

**R** = Responsible (does the work) · **A** = Accountable (owns the outcome, signs off; **exactly one per activity**) · **C** = Consulted (two-way, before the decision) · **I** = Informed (one-way, after the decision). A blank cell means no involvement.

## Parties and abbreviations

| Org | Code | Party |
|---|---|---|
| TASCO Insurance | **T-BUS** | Business owner (sponsor, motor line head) |
| | **T-PRD** | Product owner / product team |
| | **T-CMP** | Compliance and Legal (incl. DPO) |
| | **T-IT** | IT (core systems, infrastructure, service management) |
| | **T-SEC** | Information security (CISO office) |
| | **T-DAT** | Data owner / data stewards |
| VETC | **V-PRD** | Product |
| | **V-APP** | Mobile app team |
| | **V-DAT** | Data team |
| | **V-CC** | Call centre / telesales (managers, supervisors, agents) |
| iorta TechNXT | **I-DL** | Delivery lead |
| | **I-AR** | Solution architect |
| | **I-EN** | Engineers (backend, frontend, data, integration) |
| | **I-QA** | QA / test |
| | **I-DSO** | DevSecOps |
| | **I-BA** | Business analyst |
| | **I-UX** | UX/UI designer |
| Vendors | **X-VAI** | Voice-AI / telephony vendor |
| | **X-ZAL** | Zalo (OA / ZNS, VNG) |
| | **X-SMS** | SMS brandname aggregator |
| Partners | **P** | Distribution partners (banks, showrooms, agents, fleets, inspection centres) |

---

## Part A — Build and launch

| # | Activity | T-BUS | T-PRD | T-CMP | T-IT | T-SEC | T-DAT | V-PRD | V-APP | V-DAT | V-CC | I-DL | I-AR | I-EN | I-QA | I-DSO | I-BA | I-UX | X-VAI | X-ZAL | X-SMS | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Business requirements and backlog prioritisation | C | **A** | C | C | C | C | R | C | C | C | C | C | I | I | I | R | C | | | | C |
| A2 | Non-functional requirements (performance, availability, security) | I | C | C | **A** | R | C | C | C | | | C | R | C | C | R | C | | C | | | |
| A3 | UX design and design sign-off (staff console, customer app) | C | **A** | C | I | | | R | R | | C | I | C | C | C | | C | R | | | | |
| A4 | Architecture and integration design (ADRs, port contracts) | | C | | **A** | C | C | C | C | C | | C | R | R | C | C | I | | C | C | C | C |
| A5 | Data-sharing agreement VETC → TASCO (legal basis, PDP) | **A** | C | R | I | C | R | R | | R | | I | C | | | | C | | | | | |
| A6 | Data extracts, ingestion and enrichment rules (`enrichment.json`) | I | C | C | C | | **A** | C | | R | | I | C | R | C | | R | | | | | C |
| A7 | Rules authoring (scoring, NBA, journeys, benefits, products) | C | **A** | C | | | C | C | | | C | I | C | C | C | | R | | | | | |
| A8 | Rules approval — maker-checker (incl. tariffs, commission, contact policy) | I | C | **A** / R | | | C | C | | | | I | | | | | C | | | | | |
| A9 | Content and script approval (message templates, voice script, benefit wording) | C | R | **A** | | | | C | C | | C | I | | | | | R | C | C | C | | |
| A10 | ZNS template submission and OA verification | I | C | C | | | | **A** | R | | | I | | C | | | C | | | R | | |
| A11 | SMS brandname registration | I | C | C | | | | **A** | | | | I | | C | | | | | | | R | |
| A12 | Voice-AI configuration (ASR/TTS, accents, call recording, disclosure) | I | C | C | C | C | | C | | | C | C | C | R | C | | C | | R | | | |
| A13 | Integrations: VETC wallet, SSO, events | I | C | | C | C | | C | **A** | R | | C | R | R | R | C | | | | | | |
| A14 | Integration: TASCO core issuance and certificate | I | C | C | **A** | C | | | | | | C | R | R | R | C | | | | | | |
| A15 | Integration: notification channels (push, ZNS, SMS) and telephony | | C | C | C | C | | **A** | R | | | C | R | R | R | C | | | R | R | R | |
| A16 | Security testing (SAST/DAST, pen test) and remediation | I | I | C | C | **A** | | I | C | | | C | C | R | R | R | | | C | | | |
| A17 | Privacy impact assessment (DPIA) | C | C | **A** / R | C | C | R | C | | C | | I | C | | | | R | | C | | | |
| A18 | Accessibility conformance (WCAG 2.2 AA) | | **A** | C | | | | C | C | | | I | | R | R | | | R | | | | |
| A19 | SIT execution | | I | | C | | | | C | C | | **A** | C | R | R | R | C | | C | C | C | C |
| A20 | UAT execution and sign-off | **A** | R | R | C | C | R | R | R | | R | C | C | C | R | | R | C | | | | C |
| A21 | Training delivery (pilot users) | C | **A** | C | | | C | C | | | R | C | | | | | R | R | | | | I |
| A22 | Go-live decision (Go/No-go G3, G4) | **A** | R | C | C | C | C | C | C | | C | R | C | | C | C | | | | | | I |
| A23 | Production deployment | I | I | | **A** | C | | I | C | | | C | C | R | C | R | | | | | | |
| A24 | Partner onboarding (commercials, API keys, certification) | C | **A** | C | C | C | | C | | | | I | C | R | R | | C | | | | | R |

> Partner onboarding (A24) is owned by the TASCO Partner Manager, who sits within **T-PRD** for the purposes of this matrix and holds the `partner_manager` role.

---

## Part B — Run, support and compliance

| # | Activity | T-BUS | T-PRD | T-CMP | T-IT | T-SEC | T-DAT | V-PRD | V-APP | V-DAT | V-CC | I-DL | I-AR | I-EN | I-QA | I-DSO | I-BA | I-UX | X-VAI | X-ZAL | X-SMS | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 | Hypercare (4 weeks per wave) | I | C | I | C | C | C | C | C | C | C | **A** | R | R | R | R | R | | C | C | C | I |
| B2 | BAU L1 support (users, access, how-to) | | C | | **A** | | | | | | C | I | | | | | | | | | | |
| B3 | BAU L2/L3 support (incidents, defects, jobs) | | I | | **A** | C | | | C | | | C | C | R | C | R | | | C | C | C | |
| B4 | Daily operations: journeys run, reconciliation, retention, relay jobs | | I | | **A** | | C | | | | | I | | C | | R | | | | | | |
| B5 | Disaster recovery tests (semi-annual) | I | I | I | **A** | C | | I | C | | | C | C | R | R | R | | | C | | | |
| B6 | DSAR handling — access export / erasure (`/api/dsar/:id/*`) | | I | **A** / R | C | | C | C | C | C | C | | | | | | | | | | | |
| B7 | Consent withdrawal and do-not-contact handling | | C | **A** | | | R | C | R | | R | | | R | | | | | R | R | R | |
| B8 | Data-quality triage and correction (`/api/dq/*`, expiry corrections) | | C | | | | **A** | | | R | C | | | | | | | | | | | C |
| B9 | Rule changes in BAU (author → simulate → approve) | I | R | **A** | | | C | C | | | C | | | | | | C | | | | | |
| B10 | Access reviews (quarterly, roles from `rbac.json`) | | C | C | R | **A** | | | | | C | | | | | | | | | | | |
| B11 | RBAC configuration changes (code review + CAB) | | C | C | R | **A** | | | | | | | C | R | C | R | | | | | | |
| B12 | Audit-chain verification and audit evidence for internal/external audit | I | | **A** / R | C | C | | | | | | | | | | | | | | | | |
| B13 | Partner API key issue / revocation and suspension | | **A** | C | I | C | | | | | | | | | | | | | | | | R |
| B14 | Commission statement reconciliation and payment | C | **A** | C | C | | | | | | | | | | | | | | | | | R |
| B15 | Telesales operations (inbox, handoff SLAs) | C | C | I | | | | C | | | **A** / R | | | | | | | | | | | |
| B16 | Claims FNOL acknowledgement (4-hour SLA) | C | **A** | I | C | | | | C | | | | | | | | | | | | | |
| B17 | Knowledge transfer (see `kt-plan.md`) | C | C | I | **A** | C | C | C | C | C | | R | R | R | R | R | R | R | | | | |
| B18 | Platform roadmap and continuous improvement | **A** | R | C | C | C | C | R | C | C | C | C | C | | | | C | C | | | | C |

Notes on Part B:
- **B12**: T-CMP is accountable for producing the evidence. Internal Audit (outside this matrix) consumes it through the read-only `auditor` role.
- **B16**: the accountable party is the TASCO Claims Lead (a product/business function, shown under T-PRD). The `claims_handler` role carries out the work (R).
- **B15**: telesales operations are accountable and responsible within VETC's call centre, assuming VETC runs the telesales squads as agreed in Discovery. If TASCO runs telesales, A moves to T-PRD.

---

## Key separation-of-duties rules reflected above

1. **The maker cannot be the checker.** The rules service rejects approval or rejection by the draft's author (`Maker-checker: you cannot approve your own change`). Authors (`rule_author`) cannot approve, and approvers (`rule_approver`, `compliance_officer`) should not author.
2. **The platform administrator cannot author or approve rules or see customer PII.** The `admin` role has `users:manage`, `ops:*`, `audit:read`, `rules:read` and `dashboard:read` only.
3. **Support engineers run jobs but cannot see dashboards, customers or rules** (`support_engineer`: `ops:read`, `ops:run_jobs`).
4. **Auditors are read-only** (`audit:read`, `rules:read`, `dashboard:read`).
5. **DSAR erasure** is limited to `compliance_officer` (`dsar:manage`). It is refused while a policy is active, because of the legal retention obligation.
6. **RBAC changes** are code plus CAB, never a runtime toggle.

## RACI maintenance

The Delivery Lead owns this document until BAU handover, and the TASCO IT Service Manager owns it afterwards. It is reviewed at every stage gate and whenever an organisation or role changes.
