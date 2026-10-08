---
id: TGP-DEL-03
title: RACI Matrix
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 07/10/2026
prepared_by: iorta TechNXT, Delivery Management
reviewed_by: TASCO Insurance, Programme Management
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [ADR, Architecture Decision Record]
  - [AI, Artificial Intelligence]
  - [API, Application Programming Interface]
  - [IT, Information Technology]
  - [QA, Quality Assurance]
  - [RACI, "Responsible, Accountable, Consulted, Informed"]
  - [SME, Subject-Matter Expert]
  - [SMS, Short Message Service]
  - [UAT, User Acceptance Testing]
  - [UX, User Experience]
  - [VETC, VETC Automatic Toll Collection Company]
signoff:
  - [Named individuals for each TASCO and VETC party confirmed at mobilisation, TASCO Product Owner, Open]
  - [Organisation running telesales in the pilot (TASCO or VETC) confirmed in discovery, TASCO Programme Sponsor, Open]
---

# Introduction

This matrix states who is responsible, accountable, consulted and informed for each main activity in the delivery of the TASCO Growth Platform (the platform), from discovery to the pilot read-out, and for the recurring compliance and support activities that start at go-live.

The audience is everyone named in the matrix: TASCO Insurance, VETC, iorta TechNXT, the channel vendors and the pilot partner.

Related documents:

| ID | Title | Relationship |
|---|---|---|
| TGP-DEL-01 | Project Plan | The stages and milestones the activities belong to |
| TGP-DEL-02 | Delivery Methodology | Governance forums and change lanes |
| TGP-DEL-05 | Knowledge Transfer Plan | Detail of the technical handover |
| TGP-OPS-01 | Runbook and Support Guide | Support levels after hypercare |
| TGP-ARC-04 | Security Architecture | Roles and separation of duties enforced by the platform |

# How to read the matrix

| Letter | Meaning |
|---|---|
| A | Accountable: owns the outcome and signs it off. Exactly one party per activity. |
| R | Responsible: does the work. |
| C | Consulted: gives input before the decision. |
| I | Informed: told after the decision. |

A party that is both accountable and responsible appears in both columns. A party not listed for an activity is not involved in it.

# Parties

| Organisation | Code | Party |
|---|---|---|
| TASCO Insurance | SP | Programme sponsor (chairs the steering committee) |
| TASCO Insurance | PO | Product owner and product team, including the partner manager |
| TASCO Insurance | TIT | TASCO IT, including the core system lead and infrastructure |
| TASCO Insurance | SEC | IT security |
| TASCO Insurance | CMP | Compliance and legal, including data protection |
| TASCO Insurance | DAT | Data owner and data stewards |
| TASCO Insurance | TS | Telesales lead, supervisors and agents |
| VETC | VS | VETC sponsor and product lead |
| VETC | VI | VETC data and integration lead |
| iorta TechNXT | EM | Engagement manager |
| iorta TechNXT | SA | Solution architect |
| iorta TechNXT | BA | Business analyst and insurance SME |
| iorta TechNXT | UX | UX and conversation designer |
| iorta TechNXT | IL | Senior engineer (integration lead) |
| iorta TechNXT | ENG | Engineers (backend and frontend) |
| iorta TechNXT | QA | QA engineer |
| iorta TechNXT | DSO | DevSecOps engineer |
| Vendors | VEN | Voice AI vendor, Zalo official account, SMS brandname provider |
| Partner | PTR | The pilot partner on the partner API |

# Discovery and design

| No. | Activity | A | R | C | I |
|---|---|---|---|---|---|
| 1.1 | Mobilisation and plan baseline (M0) | SP | EM | PO, VS | All parties |
| 1.2 | Discovery report and pilot design (M1) | PO | BA, EM | SP, VS, CMP, TS | SA, UX |
| 1.3 | TASCO core integration path and specifications | TIT | SA, IL | PO, SEC | EM |
| 1.4 | VETC interface specifications and data extract | VS | VI, IL | SA, PO | EM |
| 1.5 | Data-sharing basis and regulatory positions | CMP | CMP, BA | PO, VS, VI | SP |
| 1.6 | Choice of hosting provider in Vietnam | TIT | SA, DSO | SEC, EM | SP |
| 1.7 | Security requirements and penetration test scope | SEC | SEC, SA | TIT, DSO | EM |

# Build and integrate

| No. | Activity | A | R | C | I |
|---|---|---|---|---|---|
| 2.1 | Backlog priorities and scope decisions | PO | BA | VS, SA, EM | Delivery team |
| 2.2 | Architecture and design decisions (ADRs) | SA | SA, IL | TIT, SEC | PO |
| 2.3 | TASCO core adapters: catalogue, rating, bind and issue, policy extract | EM | IL, ENG | TIT | PO |
| 2.4 | VETC adapters: data, events, web view, push, wallet | EM | IL, ENG, VI | VS | PO |
| 2.5 | Contracts with the voice AI, Zalo and SMS vendors | PO | PO | EM, CMP | SA |
| 2.6 | Integration of the voice AI, Zalo and SMS channels | EM | IL, ENG, VEN | PO, UX | TS |
| 2.7 | Rule configuration: scoring, journeys, benefits, templates | PO | BA, PO | CMP, VS | EM |
| 2.8 | Approval of rule changes (four-eyes) | CMP | CMP | PO, BA | EM |
| 2.9 | Customer wording and voice script approval | CMP | CMP | PO, UX, VS | TS |
| 2.10 | Products and tariffs confirmed in TASCO core | PO | TIT | CMP, BA | EM |
| 2.11 | Partner onboarding and API keys | PO | PO, ENG | CMP, SEC | PTR |
| 2.12 | Sprint demonstration and story acceptance | PO | EM, BA | TS, VS | SP |

# Test and go-live

| No. | Activity | A | R | C | I |
|---|---|---|---|---|---|
| 3.1 | System integration testing | EM | QA, IL | TIT, VI, VEN | PO |
| 3.2 | Performance testing | EM | QA, DSO | TIT | PO |
| 3.3 | Security testing and remediation | SEC | DSO, QA, ENG | SA | PO, EM |
| 3.4 | UAT execution and sign-off (M3) | PO | PO, TS, QA | CMP, BA | SP |
| 3.5 | Training of pilot users | PO | BA, UX | TS, CMP | SP |
| 3.6 | Cut-over rehearsal and go-live decision | SP | EM, TIT | PO, CMP, SEC, VS | All parties |
| 3.7 | Production deployment | TIT | DSO | SA, SEC | PO |

# Hypercare and pilot

| No. | Activity | A | R | C | I |
|---|---|---|---|---|---|
| 4.1 | Hypercare and Tết on-call (M4) | EM | ENG, IL, DSO | TIT | PO |
| 4.2 | Pilot operation: campaigns, handoffs, sales | PO | TS, PO | BA | SP, VS |
| 4.3 | Technical handover to TASCO IT | TIT | SA, DSO, EM | SEC | PO |
| 4.4 | Pilot measurement and read-out | SP | BA, PO | VS, EM | All parties |
| 4.5 | Scale decision | SP | EM, PO | VS, CMP | All parties |

# Compliance and support from go-live

| No. | Activity | A | R | C | I |
|---|---|---|---|---|---|
| 5.1 | Data subject requests: access, correction, erasure | CMP | CMP | TIT, DAT | PO |
| 5.2 | Data-quality correction with evidence | DAT | DAT | PO, VI | BA |
| 5.3 | Rule changes after go-live | CMP | PO | DAT, BA | SP |
| 5.4 | Access reviews and role changes | SEC | TIT | CMP | PO |
| 5.5 | Audit evidence for internal and external audit | CMP | CMP | TIT, SEC | SP |
| 5.6 | Incident handling (first-line) | TIT | TIT | PO, TS | EM |
| 5.7 | Incident handling (second and third line) | TIT | ENG, DSO | SEC, VI, VEN | PO |
| 5.8 | Commission statements to the partner | PO | PO | CMP | PTR |
| 5.9 | Change requests | PO | EM | SA, BA | SP |

Activities 5.6 and 5.7 assume iorta TechNXT provides the managed service after hypercare. If TASCO runs second and third line itself, R moves to TIT after the knowledge transfer in TGP-DEL-05 Knowledge Transfer Plan.

Activity 4.2 assumes TASCO runs telesales in the pilot. If VETC's call centre runs it, R for telesales moves to VETC.

# Separation of duties

The platform enforces the following rules in code, so the matrix cannot be bypassed in practice. TGP-ARC-04 Security Architecture gives the full role model.

1. The author of a rule change cannot approve it. The roles of rule author and rule approver cannot be held by the same person.
2. Changes to contact rules, wording controls, access policies, commission and retention can only be approved by a compliance officer.
3. Product changes from TASCO core arrive as a proposed change from the catalogue sync and need a human approver.
4. Administrators manage users and operations but cannot author or approve rules, cannot see customer personal data, and cannot change their own roles or status.
5. Support engineers run jobs but cannot see dashboards, customers or rules. Auditors have read-only access.
6. Staff never take payment. Telesales send the quote to the customer's VETC app, and only the customer pays. Partner sales are collected by the partner.
7. Changes to roles and permissions are made through a release, never through a runtime switch.

# Maintenance

The engagement manager maintains this matrix until the end of hypercare, and TASCO IT afterwards. It is reviewed at each milestone and whenever a party or role changes.
