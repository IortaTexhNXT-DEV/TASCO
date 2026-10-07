# Business and Product Documentation

**TASCO Insurance × VETC Motor Insurance Growth Platform** · prepared by iorta TechNXT · October 2026

This folder holds the business case, requirements and engagement model for the platform: new business, renewal, partners and value beyond discount. The documents are written to be read in order but can stand alone. IDs are consistent across all of them.

## Documents

| # | Document | What it answers | Primary audience |
|---|---|---|---|
| 01 | [Business context and growth strategy](01-business-context-and-growth-strategy.md) | Why own-channel renewals are near zero; the segment, channel, trust, value and data strategy; roadmap; KPI tree; illustrative business case; fit with the judging criteria | Executives, judges, steering committee |
| 02 | [Functional requirements specification](02-functional-requirements-specification.md) | What the platform must do: FR-001 – FR-110 by capability, with business rules, MoSCoW priority, track and build status | Product owners, BAs, engineering |
| 03 | [Non-functional requirements](03-non-functional-requirements.md) | How well it must do it: NFR-001 – NFR-069 (performance, scale, SLOs, ASVS L2, PDP privacy, WCAG 2.2 AA, DR, portability, configurability, retention) | Architects, security, operations |
| 04 | [User stories and acceptance criteria](04-user-stories-and-acceptance-criteria.md) | US-001 – US-077 in 15 epics, with Gherkin acceptance criteria linked to FRs | Delivery team, QA, UAT users |
| 05 | [Requirements traceability matrix](05-requirements-traceability-matrix.md) | FR → US → code module → API endpoint → rule kind → test file, plus **engineering notes E-01 – E-22** | Engineering, QA, audit |
| 06 | [Personas and journey maps](06-personas-and-journey-maps.md) | 5 customer and 13 staff/partner personas; current vs future journeys; service blueprints for renewal and new-vehicle onboarding; pain points; moments of truth | Product, UX, campaign managers |
| 07 | [Commercials and engagement model](07-commercials-and-engagement-model.md) | Phases, team, effort, Option A (fixed + T&M + managed service) and Option B (outcome-linked), run cost, 3- and 5-year TCO, milestones, assumptions, exclusions | TASCO procurement and finance, executives |

## ID conventions

| Prefix | Meaning | Defined in |
|---|---|---|
| `SEG-n` | Growth segment (lapsed, new vehicle, renewal, conquest, cross-sell, fleet, partner-led) | 01 §4 |
| `K-nn` | KPI | 01 §11 |
| `A-nn` | Business-case assumption | 01 §13 |
| `R-nn` | Strategic risk | 01 §16 |
| `FR-nnn` | Functional requirement | 02 |
| `NFR-nnn` | Non-functional requirement | 03 |
| `W-n` | Workload assumption | 03 §0 |
| `EP-nn`, `US-nnn` | Epic, user story | 04 |
| `E-nn` | Engineering note (code inconsistency to fix) | 05 §3 |
| `PC-n`, `PS-nn` | Customer persona, staff/partner persona | 06 |
| `PP-nn`, `MoT-nn` | Pain point, moment of truth | 06 |
| `C-nn` | Commercial assumption | 07 §9 |
| `T1`–`T4`, `NB`, `PL` | Challenge track 1–4, new-business extension, platform/governance | 02 §0 |

## Sources and conventions

- **Facts about TASCO, VETC and the market** come only from the client brief. Everything else is a labelled assumption.
- **Facts about the solution** cite the codebase: `config/rules/*.json` (business rules), `config/security/rbac.json`, `src/domain`, `src/application`, `src/adapters/http/routes.js` (73 API routes) and `src/bootstrap/seed.js`.
- **All financial figures are illustrative or indicative.** Unit costs come from `config/rules/costs.json` and regulated premiums from `config/rules/tariff.tnds_car.json` (Decree 67/2023/ND-CP, to be confirmed by TASCO underwriting).
- **Regulatory references** (Law on Insurance Business 08/2022/QH15, PDP Law 91/2025/QH15, Decree 13/2023/ND-CP, Decree 91/2020/ND-CP) are noted for **confirmation by TASCO legal**. They are not legal advice.
- Vietnamese terms: *Bảo hiểm TNDS bắt buộc* (compulsory motor third-party liability), *đăng kiểm* (vehicle inspection), *bảo hiểm vật chất xe* (physical damage), *tai nạn người ngồi trên xe* (passenger accident).

## Related documentation

Architecture, delivery, operations, quality, UX and user manuals are maintained in sibling folders under `docs/`.
