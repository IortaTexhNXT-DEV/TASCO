---
id: TGP-00
title: Document Register
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 08/10/2026
prepared_by: iorta TechNXT, Delivery Management
reviewed_by: TASCO Insurance, Programme Management
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [AI, Artificial Intelligence]
  - [API, Application Programming Interface]
  - [ID, Identifier]
  - [IT, Information Technology]
  - [MVP, Minimum Viable Product]
  - [QA, Quality Assurance]
  - [RACI, "Responsible, Accountable, Consulted, Informed"]
  - [SME, Subject-Matter Expert]
  - [TGP, TASCO Growth Platform (document identifier prefix)]
  - [UAT, User Acceptance Testing]
  - [UX, User Experience]
  - [VETC, VETC Automatic Toll Collection Company]
  - [WCAG, Web Content Accessibility Guidelines]
signoff:
  - [Document owners on the TASCO side named for review and approval of each area, TASCO Programme Management, Open]
---

# Introduction

This register lists every document that iorta TechNXT submits to TASCO Insurance for the TASCO Growth Platform (the platform). For each document it gives the identifier, the title, its purpose, the primary audience and the owner at iorta TechNXT.

The set contains 38 documents, including this register. The proposal and the cover letter are submitted with the set as separate submission documents.

The audience is anyone at TASCO Insurance or VETC who needs to find a document, and the reviewers and approvers of each area.

# How the set is organised

Apart from this register, the documents are grouped into seven areas. Each document has an identifier made of the prefix TGP (TASCO Growth Platform), an area code and a number. Cross-references between documents use the identifier and the title, for example "TGP-ARC-02 Integration Architecture, section 4".

| Area code | Area | Documents | What the area answers |
|---|---|---:|---|
| BUS | Business | 7 | What TASCO needs, what the platform does and what it costs |
| ARC | Architecture | 7 | How the platform is built, integrated, secured and hosted |
| QA | Quality | 4 | How the platform is tested and accepted |
| OPS | Operations | 6 | How the platform is run, monitored, recovered and released |
| DEL | Delivery | 6 | How the MVP is planned, governed and handed over |
| UX | User experience | 4 | How the screens look and behave, and how usability is tested |
| MAN | Manuals | 3 | How staff, customers and partners use the platform |

Every document follows the iorta TechNXT template: cover page, table of contents, document control, acronyms, numbered sections, appendix where useful, and sign-off. The sign-off table lists the open items that need TASCO's confirmation; approval of a document is conditional on those items.

All documents are delivered in Word format. Documents are counted by topic, not by file format.

# Versioning

All documents in this set are issued as version 1.0, dated 08/10/2026, for submission. After contract signature:

- a minor change (correction or clarification) increases the version by 0.1;
- a change of substance (scope, design, plan or commitment) increases the major version and needs the approval named on the cover;
- each document records its history in its document control section;
- this register is reissued whenever a document is added, withdrawn or reaches a new major version.

The engagement manager maintains this register until the end of hypercare. TASCO's programme management office owns it afterwards.

# Submission documents

| Document | Purpose | Primary audience | Owner |
|---|---|---|---|
| Proposal | The solution, plan, team, price and terms offered to TASCO | TASCO evaluation team, programme sponsor | Engagement manager |
| Cover letter | Formal submission of the proposal | TASCO programme sponsor | Engagement manager |

# Register

## Register

| ID | Title | Purpose | Primary audience | Owner |
|---|---|---|---|---|
| TGP-00 | Document Register | Lists and organises the document set | All readers | Engagement manager |

## Business

| ID | Title | Purpose | Primary audience | Owner |
|---|---|---|---|---|
| TGP-BUS-01 | Business Context and Growth Strategy | The business problem, growth levers and business case | TASCO and VETC sponsors | Business analyst and insurance SME |
| TGP-BUS-02 | Functional Requirements Specification | What the platform must do, by capability | TASCO product owner, delivery team | Business analyst and insurance SME |
| TGP-BUS-03 | Non-Functional Requirements | Performance, availability, security, privacy and operability targets | TASCO IT, solution architect | Solution architect |
| TGP-BUS-04 | User Stories and Acceptance Criteria | Stories with the Given/When/Then scenarios used for acceptance | TASCO product owner, QA | Business analyst and insurance SME |
| TGP-BUS-05 | Requirements Traceability Matrix | Links requirements to stories, design and tests | TASCO product owner, QA | Business analyst and insurance SME |
| TGP-BUS-06 | Personas and Customer Journeys | The customers and staff the platform serves, and their journeys | TASCO product and distribution | UX and conversation designer |
| TGP-BUS-07 | Commercials and Engagement Model | Price, payment milestones, options and total cost of ownership | TASCO sponsor, procurement | Engagement manager |

## Architecture

| ID | Title | Purpose | Primary audience | Owner |
|---|---|---|---|---|
| TGP-ARC-01 | Solution Architecture | Overall structure of the platform and its main components | TASCO IT architecture | Solution architect |
| TGP-ARC-02 | Integration Architecture | Interfaces with TASCO core, VETC, channels and partners | TASCO IT, VETC integration | Solution architect |
| TGP-ARC-03 | Data Architecture | Data model, golden record, lineage, retention | TASCO IT, data owner | Solution architect |
| TGP-ARC-04 | Security Architecture | Identity, access, encryption, audit and security controls | TASCO IT security | Solution architect |
| TGP-ARC-05 | Deployment and Infrastructure Architecture | Hosting in Vietnam, environments, scaling and resilience | TASCO IT infrastructure | DevSecOps engineer |
| TGP-ARC-06 | AI Governance | Controls over scoring and the voice assistant | TASCO compliance, risk | Solution architect |
| TGP-ARC-07 | Architecture Decision Records | The 13 main design decisions and their reasons | TASCO IT architecture | Solution architect |

## Quality

| ID | Title | Purpose | Primary audience | Owner |
|---|---|---|---|---|
| TGP-QA-01 | Test Strategy | Test levels, environments, coverage and exit criteria | TASCO IT, product owner | QA engineer |
| TGP-QA-02 | Test Case Catalogue | Test cases and results; the execution record is the test-case workbook | QA, TASCO product owner | QA engineer |
| TGP-QA-03 | Performance and Capacity Test Plan | Load tests and capacity targets for the pilot and full scale | TASCO IT | QA engineer |
| TGP-QA-04 | User Acceptance Test Plan | How TASCO users run and sign off UAT | TASCO product owner, key users | QA engineer |

## Operations

| ID | Title | Purpose | Primary audience | Owner |
|---|---|---|---|---|
| TGP-OPS-01 | Runbook and Support Guide | Support model, incident runbooks and standard procedures | TASCO IT support | DevSecOps engineer |
| TGP-OPS-02 | Monitoring and Alerting | Metrics, dashboards, alerts and their responses | TASCO IT operations | DevSecOps engineer |
| TGP-OPS-03 | Disaster Recovery and Business Continuity Plan | Recovery targets, backups, failover and continuity | TASCO IT, risk | DevSecOps engineer |
| TGP-OPS-04 | Production Readiness Checklist | Checks to pass before go-live | TASCO IT, product owner | DevSecOps engineer |
| TGP-OPS-05 | Go-Live and Hypercare Plan | Cut-over, soft launch and the four weeks of hypercare | TASCO IT, product owner | Engagement manager |
| TGP-OPS-06 | Release and Change Management | How code, configuration and rule changes reach production | TASCO IT service management | DevSecOps engineer |

## Delivery

| ID | Title | Purpose | Primary audience | Owner |
|---|---|---|---|---|
| TGP-DEL-01 | Project Plan | The 17-week MVP plan, milestones, team and dependencies | Steering committee, product owner | Engagement manager |
| TGP-DEL-02 | Delivery Methodology | Sprints, quality gates, environments and governance forums | Product owner, delivery team | Engagement manager |
| TGP-DEL-03 | RACI Matrix | Who does what across TASCO, VETC, iorta TechNXT and vendors | All parties | Engagement manager |
| TGP-DEL-04 | Risk Register | Delivery and pilot risks with owners and mitigations | Steering committee | Engagement manager |
| TGP-DEL-05 | Knowledge Transfer Plan | Technical handover and the option of full transition | TASCO IT | Solution architect |
| TGP-DEL-06 | Organisational Change and Training Plan | Change impact, communications, training and adoption | Product owner, team managers | Business analyst and insurance SME |

## User experience

| ID | Title | Purpose | Primary audience | Owner |
|---|---|---|---|---|
| TGP-UX-01 | Design System | Visual language, components and brand use | Designers, front-end engineers | UX and conversation designer |
| TGP-UX-02 | UX Standards and Accessibility | Interaction rules and WCAG 2.2 AA conformance | Designers, QA | UX and conversation designer |
| TGP-UX-03 | Information Architecture and Navigation | Screen inventory and navigation by role | Product owner, designers | UX and conversation designer |
| TGP-UX-04 | Usability Testing Plan | Usability tests with staff and customers | Product owner, designers | UX and conversation designer |

## Manuals

| ID | Title | Purpose | Primary audience | Owner |
|---|---|---|---|---|
| TGP-MAN-01 | Staff Console User Manual | How each staff role uses the console, one chapter per role | TASCO and VETC staff | Business analyst and insurance SME |
| TGP-MAN-02 | Customer App Guide | How customers use the customer app, starting in the VETC app | Customer service, VETC | Business analyst and insurance SME |
| TGP-MAN-03 | Partner API Integration Guide | How a partner connects to and certifies on the partner API | Partner developers, partner managers | Senior engineer (integration lead) |

# Supporting artefacts

| Artefact | Related document | Purpose |
|---|---|---|
| Test-case workbook (`TASCO-Test-Cases-and-Results.xlsx`) | TGP-QA-02 Test Case Catalogue | Test conditions, scenarios, expected and actual results |
| API specification (`openapi.json`) | TGP-MAN-03 Partner API Integration Guide | Machine-readable description of the platform's API |
