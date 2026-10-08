---
id: TGP-DEL-06
title: Organisational Change and Training Plan
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 07/10/2026
prepared_by: iorta TechNXT, Delivery Management
reviewed_by: TASCO Insurance, Product and Distribution
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [API, Application Programming Interface]
  - [IT, Information Technology]
  - [MVP, Minimum Viable Product]
  - [OTP, One-Time Password]
  - [QR, Quick Response (code)]
  - [SMS, Short Message Service]
  - [TNDS, Compulsory motor third-party liability insurance (Bảo hiểm TNDS bắt buộc)]
  - [UAT, User Acceptance Testing]
  - [VETC, VETC Automatic Toll Collection Company]
signoff:
  - [Key messages to staff and customers approved by TASCO compliance, TASCO Compliance and Legal, Open]
  - [Super users nominated for each pilot team, TASCO Product Owner, Open]
  - [Adoption targets confirmed in discovery, TASCO Product Owner, Open]
---

# Introduction

This plan describes how TASCO Insurance staff, VETC and the pilot partner will be prepared to work with the TASCO Growth Platform (the platform): what changes for each group, how it is communicated, how each role is trained, and how adoption is measured during the pilot.

It covers the MVP and the pilot. The training schedule follows the proposal, section 19. The same pattern is repeated for new users in each step of the scale phase.

The audience is the TASCO product owner, the managers of the teams that will use the platform, the super users and the iorta TechNXT business analyst.

Related documents:

| ID | Title | Relationship |
|---|---|---|
| TGP-DEL-01 | Project Plan | Weeks and milestones the training is tied to |
| TGP-DEL-05 | Knowledge Transfer Plan | Technical handover to TASCO IT |
| TGP-BUS-06 | Personas and Customer Journeys | The people whose work changes |
| TGP-MAN-01 | Staff Console User Manual | Reference material for staff roles, one chapter per role |
| TGP-MAN-02 | Customer App Guide | Reference for customer-facing staff |
| TGP-MAN-03 | Partner API Integration Guide | Reference for partner developers |
| TGP-QA-04 | User Acceptance Test Plan | UAT, which doubles as practice |

# What changes

Technology alone will not move own-channel sales. The groups below change how they work, and the plan concentrates effort where the change is largest.

| Group | Today | With the platform | Impact |
|---|---|---|---|
| Telesales agents | Cold-call lists with little context; customers suspect scams | Warm handoffs from the voice assistant with a verified plate and talking points; quotes sent to the customer's VETC app; staff never take payment | High |
| Telesales supervisors | Manual allocation from spreadsheets | Handoff queue, assignment and service-level tracking | High |
| Campaign managers | Mass SMS with no frequency control | Journeys with contact rules, voice campaigns and dashboards; discount wording is blocked | High |
| Data stewards | No defined role | Data-quality queue and corrections with evidence | High (new role) |
| Product rule authors | Change requests to IT | Draft, check and simulate rule changes in the rules studio | Medium |
| Compliance officers | Review after the event; data requests handled by email and letter with no register | Approve changes before they take effect; audit trail; every data request logged in Governance › "Data requests" with a due date, identity check, export or erasure, and a timeline | Medium |
| Claims handlers | Phone and paper first notice | Digital first-notice queue with a 4-hour acknowledgement target | Medium |
| Partner managers | Email and spreadsheet commission | Partner onboarding, API keys and commission statements | Medium |
| TASCO IT and support | Not involved | Operate the platform, its jobs and integrations | Medium |
| Customers in the pilot | Renew with whoever calls; paper certificate | Reminders in the app and Zalo; quick renewal in 3 steps where eligible, or the full flow; e-certificate with QR code | Medium |

For telesales the change is the largest: their role shifts from cold calling to closing warm, verified leads. The bot does the verification and the reminders; agents do the conversation.

# Communications

TASCO and VETC own all customer communications. iorta TechNXT provides the message templates, the wording control and the measurement.

| When | Audience | Message | Channel | Sender |
|---|---|---|---|---|
| Week 1 | All internal stakeholders | Why the platform, what changes and what does not | Briefing and email | TASCO programme sponsor |
| Weeks 1 and 2 | Telesales and supervisors | Invitation to discovery interviews and design reviews | Team briefings | Telesales lead |
| End of each sprint | Super users and managers | What was demonstrated, what comes next | Short note and recording | TASCO product owner |
| Week 10 | All user groups | Training schedule, UAT access, each role's part | Email | TASCO product owner |
| Week 12 | Telesales | A day in the life with the platform; how wins are recorded | Huddles with super users | Telesales supervisors |
| Soft launch | Pilot users | Go-live guide, hypercare contacts, help in the console | Email and floor visits | TASCO product owner |
| Soft launch | Customers in the cohort | Renew in the VETC app; VETC and TASCO never ask for an OTP or payment by phone | In-app banner, Zalo post | VETC |
| Weekly in the pilot | Pilot users and managers | Results, tips, fixes released | Newsletter | TASCO product owner |
| Pilot read-out | All internal stakeholders | Results against the control group and the next steps | Briefing | TASCO programme sponsor |

Key messages, to be approved by TASCO compliance:

1. TNDS premiums are set by regulation and are the same everywhere. We compete on service, never on discounts.
2. Payment happens only inside the official VETC app. Nobody from TASCO or VETC asks for an OTP or a payment over the phone.
3. The voice assistant handles verification and reminders. People handle conversations and advice.
4. Every change to customer-facing rules is approved by a second person and recorded.

For customers we recommend a simple launch message, subject to TASCO compliance approval: "Renew your TNDS in the VETC app in about a minute."

# Super users

TASCO nominates super users who are trained first and then support their colleagues.

| Item | Arrangement |
|---|---|
| Number | About one per ten users: two or three per telesales team, one each in campaigns, compliance, data and claims |
| Selection | Respected practitioners nominated by their managers |
| Time | About 10% of their time during the pilot |
| Role | Early access to UAT, first-line "how do I" help, feedback to the product council, co-delivery of training |
| Support | Direct channel to the delivery team; preview of each release |

# Training plan

Training is role-based: each person learns only the screens their role can see. Every session ends with practice in UAT.

| Audience | Format | Content | When |
|---|---|---|---|
| Telesales agents and supervisors | Classroom and practice in UAT, half a day | Handoff inbox, customer 360 view, sending quotes to the app, the two renewal paths customers see (quick renewal and the full flow), scripts that respect the no-discount rule | Week 12 |
| Campaign managers | Workshop, one day | Leads, journeys, voice campaigns, dashboards | Week 11 |
| Product rule authors and compliance approvers | Workshop, one day | Rules studio: drafting, simulation, approval, rollback; switching quick renewal on or off in the service levels | Weeks 9 to 11 |
| Compliance officers | Session and practice in UAT, two hours | Data requests process in Governance › "Data requests": "Log request" from the hotline, email, app, branch or letter; verify identity; "Export data"; "Erase personal data", or refuse with a reason; watch "Due within 24 h" and "Overdue"; data downloaded in the app appears as a completed request | Week 11 |
| Data stewards | Workshop, half a day | Data-quality queue, corrections with evidence, lineage | Week 11 |
| Claims handlers and partner managers | Session, two hours each | Claims queue; partner onboarding, keys and statements | Week 12 |
| TASCO IT and support | Technical handover, two days | Architecture, deployment, monitoring, runbooks, incident handling | Weeks 12 to 13 |
| Tasco360 users and partner staff | Integration guide, sandbox and a short demonstration | Quote by plate, instant certificate, commission statement | From week 8 |
| TASCO digital team (TASCO app, website, Zalo OA, Tasco360) | Technical session, half a day | Embedding the shared journeys, partner API keys, shared wording and official contacts | Week 12 |

Week 8 starts on 21/12/2026, week 9 on 28/12/2026, week 11 on 11/01/2027, week 12 on 18/01/2027 and week 13 on 25/01/2027. Rule authors and approvers start earlier because they configure the pilot rules with the business analyst during Sprint 4. The technical handover for TASCO IT is described in TGP-DEL-05 Knowledge Transfer Plan.

Training is supported by:

- the role chapters of TGP-MAN-01 Staff Console User Manual, TGP-MAN-02 Customer App Guide and TGP-MAN-03 Partner API Integration Guide;
- short how-to videos recorded during UAT;
- in-app help in the staff console.

## Training environment

All practice takes place in UAT with synthetic data. Each trainee receives a named account for their role; credentials are issued through the access workbook and are never written in training material. Users with privileged roles (administrators, rule approvers, compliance officers and data stewards) enrol an authenticator app at first sign-in, exactly as they will in production. Demo accounts exist only in UAT and never in production.

## Readiness for go-live

A user receives a production account when they have completed their session and the practice tasks for their role, observed by a super user or trainer. Accounts for privileged roles are created only after this check, which forms part of the access-approval evidence.

# Adoption measures

The pilot success criteria in TGP-DEL-01 Project Plan measure the business result. The measures below show whether people are using the platform as intended. Targets are proposals to be confirmed in discovery.

| Measure | Definition | Pilot target |
|---|---|---|
| Training completed | Users trained and checked before their account is activated | 100% before go-live |
| Weekly active telesales agents | Agents who worked at least one handoff in the week | At least 90% |
| Handoff first contact | Time from handoff to the agent's first contact, in business hours | Within 2 business hours |
| Rule change lead time | Time from draft to approval | Within 1 business day |
| Data requests answered on time | Requests completed or refused within the response time (72 hours, to be confirmed by TASCO legal) | 100% |
| Policies bought in the app | Share of own-channel sales completed in the VETC app | At least 60% |
| How-to support tickets | Tickets asking how to do something, per 100 users per week | Falling week on week |

# Resistance and reinforcement

| Likely resistance | Signal | Response |
|---|---|---|
| Agents bypass the inbox and keep old lists | Few handoff actions; wins not recorded | Supervisor coaching; old lists retired by a set date; recognition based on wins recorded in the platform |
| Agents fear the voice assistant takes their leads | Super-user feedback | Show that the assistant verifies and hands warm leads to agents; share agent conversion in the pilot |
| Campaign managers find contact limits and the wording control restrictive | Rejected drafts, escalations | Explain the regulatory basis; write value-based copy together |
| Compliance approvers are overloaded | Rule lead time above one day | Group low-risk changes; add a second approver |

Adoption is reinforced through a weekly review of the measures above by supervisors and the product owner, a "what's new" note with each release, and an annual refresher for privileged roles. Supervisors review a sample of handoffs each week, and the quarterly access review confirms that people hold only the roles they need.
