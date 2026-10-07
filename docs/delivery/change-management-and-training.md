# Change Management and Training Plan

This plan is about getting **people** to work in a new way. Telesales agents work from a prioritised inbox with explained scores. Marketing runs governed journeys instead of blasts. Compliance approves rules in a studio instead of reviewing spreadsheets. Customers renew in three taps in the VETC app. Without this change the technology does not move renewals.

Approach: **ADKAR** (Awareness, Desire, Knowledge, Ability, Reinforcement) applied per stakeholder group, delivered through a champions network and role-based training in a safe sandbox.

---

## 1. Change impact assessment

Impact: **H** = high (new way of working, new tool, new KPIs) · **M** = medium · **L** = low.

| Stakeholder group | Today | Future (with platform) | Impact | Key concerns we expect | Roles in the platform |
|---|---|---|---|---|---|
| **Telesales agents** (VETC call centre / TASCO) | Cold-call lists, little context, customers suspect scams, no visibility of expiry reliability | Warm handoffs from the voice bot with verified plate, talking points and benefits. Inbox with claim/callback/won/lost. Regional data only. Send one-tap link instead of taking payment by phone. | **H** | "Will the bot replace me?" "More clicks?" "Will my commission be tracked?" | `telesales_agent` |
| **Telesales supervisors** | Manual allocation, spreadsheets | Queue oversight, assignment (`handoff:assign`), dashboards, SLA tracking | **H** | Loss of control, new KPIs | `telesales_supervisor` |
| **Campaign / marketing managers** | Mass SMS, no frequency control | Journeys with contact policy, triggers, voice campaigns, dashboards. Copy guard blocks discount wording. | **H** | "Rules restrict creativity", ZNS approval lead times | `campaign_manager` |
| **Product and pricing (rule authors)** | Requests to IT for changes | Draft, validate and simulate rule sets themselves | **M** | Fear of breaking production | `rule_author` |
| **Compliance / legal (approvers)** | After-the-fact review | Pre-approval (maker-checker), audit search, DSAR, governance dashboard | **M** | Workload, accountability | `rule_approver`, `compliance_officer` |
| **Data stewards** | No defined role | DQ queue, expiry corrections with evidence, ingestion, lineage | **H** (new role) | Volume of issues | `data_steward` |
| **Claims handlers** | Phone/paper FNOL | Digital FNOL queue with a 4-hour acknowledgement SLA | **M** | SLA pressure | `claims_handler` |
| **Partner managers** | Email/Excel commission | Partner onboarding, API keys, commission statements | **M** | Partner pushback | `partner_manager` |
| **Partners** (banks, showrooms, agents, fleets, inspection centres) | Own systems, manual submission | API integration, instant quote and issue, transparent statements | **M** | Channel conflict, IT effort | API key (`partner_api`) |
| **IT / support** | n/a | Operate the platform, jobs, integrations; MFA administration | **M** | New stack, on-call | `admin`, `support_engineer` |
| **Executives** | Monthly manual reports | Live dashboards | **L** | Data trust | `executive` |
| **Internal audit** | Sample-based evidence | Read-only audit trail with hash-chain verification | **L** | | `auditor` |
| **Customers** (VETC drivers) | Renew with whoever calls, no reminder, paper certificate | Reminders in app/Zalo, ≤ 3-tap renewal with wallet, instant e-certificate with QR, benefits, consent centre, FNOL in app | **M** | Trust, privacy, "is this a scam?" | Customer app |

### Readiness heat map (to be refreshed at G1 and G3)

| Group | Awareness | Desire | Knowledge | Ability | Reinforcement |
|---|---|---|---|---|---|
| Telesales agents | Low | Low | Low | Low | — |
| Supervisors | Medium | Medium | Low | Low | — |
| Campaign managers | Medium | High | Low | Low | — |
| Compliance | Medium | Medium | Low | Low | — |
| Data stewards | Low | Medium | Low | Low | — |

---

## 2. Communications plan

| # | When | Audience | Message | Channel | Sender | Owner |
|---|---|---|---|---|---|---|
| C1 | Kick-off (wk 0) | All internal stakeholders | Why: renewal problem, trust problem, regulated pricing. What changes and what does not. | Town hall + email | TASCO CEO + VETC CEO | T-BUS |
| C2 | Discovery (wk 1–2) | Telesales, supervisors | "We are designing this with you" — invitation to interviews and usability tests | Team briefings | Call-centre manager | V-CC |
| C3 | End of each sprint | Champions, managers | Demo recording and "what's new" one-pager | Teams/Zalo group + intranet | Product Owner | T-PRD |
| C4 | G2 (build complete) | All user groups | Training schedule, sandbox access, "your role in the platform" | Email + LMS enrolment | Change Lead | WS9 |
| C5 | G3 (−2 weeks) | Telesales | "Day in the life" video. The bot does the verification; you do the conversation. Commission continuity. | Video + huddles | Supervisor + champion | V-CC |
| C6 | G3 (−1 week) | Compliance, marketing | Rules studio and copy guard: what is blocked and why | Workshop | Compliance Head | T-CMP |
| C7 | Pilot launch | Pilot users | Go-live guide, war-room contacts, help drawer, FAQ | Email + desk drops | Product Owner | T-PRD |
| C8 | Pilot launch | Customers (pilot cohort) | New: renew in the VETC app, e-certificate with QR, VETC never asks for OTP | In-app banner, Zalo OA post | VETC Marketing | V-PRD |
| C9 | Weekly during pilot | Pilot users, management | Wins, tips, KPI snapshot, fixes shipped | Newsletter | Change Lead | WS9 |
| C10 | Partner onboarding | Partners | Commercial model, API guide, sandbox key | Partner pack + webinar | Partner Manager | T-PRD |
| C11 | Pilot end (G4) | All | Results and next waves | Town hall | T-BUS | T-BUS |
| C12 | Each wave | New users and regions | Wave-specific onboarding | As C4–C7 | Change Lead | WS9 |

**Key messages (agreed with Compliance):**
1. "TNDS premiums are set by regulation and are the same everywhere. We win on service, not price." We never mention discounts.
2. "VETC never asks for OTPs or payment over the phone. Payment only happens inside the official VETC app."
3. "The voice bot handles verification and reminders. People handle conversations and advice."
4. "Every change to customer-facing rules is approved by a second person and recorded."

---

## 3. Champions network

| Item | Design |
|---|---|
| Size | 1 champion per 10 users: about 2–3 per telesales squad, 1 in marketing, 1 in compliance, 1 in data, 1 in claims |
| Selection | Respected practitioners nominated by managers, volunteers preferred |
| Time | 10 % of their time during pilot, 5 % in BAU |
| Role | Early access (sandbox from Sprint 2), test in usability sessions, first-line "how do I…?" help, collect feedback, co-deliver training |
| Enablement | Champion bootcamp (1 day), direct channel to the product team, release previews |
| Recognition | Certificate, visibility at town halls, input to performance reviews |
| Rituals | Fortnightly champion forum. Feedback is logged in the backlog with a "champion" label. |

---

## 4. Training framework

### 4.1 Principles
- **Role-based:** each user learns only the pages their permissions show (the navigation is filtered by permission).
- **Practice first:** every module ends with hands-on tasks in the **SANDBOX environment in demo mode**, with synthetic data and seeded demo users (see section 4.4).
- **Vietnamese-first:** all material in Vietnamese, with English versions for regional and vendor staff.
- **Short and mobile-friendly:** LMS micro-modules of 10–20 minutes, plus a 2–3 hour classroom or virtual lab per role.
- **Documentation-backed:** the persona manuals in `docs/manuals/` are the reference material, and the in-app help drawer ("?") links to the relevant sections.

### 4.2 Curricula by role

| Role | LMS modules (self-paced) | Instructor-led lab | Total | Reference manual |
|---|---|---|---|---|
| All staff (core) | M0 Platform tour, sign-in and MFA, navigation, help, language/theme (15 min); M1 Privacy and PII masking basics (15 min); M2 Regulated pricing and no-discount rule (10 min) | — | 40 min | `user-manual.md` |
| Telesales agent | T1 Reading a handoff and talking points (15); T2 Customer 360 and explainable score (15); T3 Quote, send link, issue (20); T4 Trust script and objection handling (20); T5 Outcomes: won/lost/callback (10) | 3 h lab, role-play with voice bot transcripts | 4.5 h | `manual-telesales-agent.md` |
| Telesales supervisor | Agent modules + S1 Queue management and assignment (15); S2 KPIs and coaching (15) | 2 h | 4 h | `manual-telesales-supervisor.md` |
| Campaign manager | CM1 Leads and tiers (15); CM2 Journeys and contact policy (20); CM3 Triggers and ecosystem events (15); CM4 Voice campaigns (15); CM5 Dashboards (15) | 3 h | 4.5 h | `manual-campaign-manager.md` |
| Rule author | R1 Rule kinds and JSON Logic basics (20); R2 Drafting and validation (20); R3 Simulation (15); R4 Rollback (10) | 3 h | 4 h | `manual-rule-author-and-approver.md` |
| Rule approver / compliance | R1, R3 + C1 Reviewing a change (15); C2 Audit search and chain verification (15); C3 DSAR (15); C4 Governance dashboard (10) | 2 h | 3.5 h | `manual-rule-author-and-approver.md`, `manual-compliance-officer.md` |
| Data steward | D1 DQ issues (15); D2 Expiry correction with evidence (15); D3 Ingestion and lineage (20) | 2 h | 3 h | `manual-data-steward.md` |
| Claims handler | CL1 FNOL queue and SLA (15); CL2 Status transitions (10) | 1 h | 1.5 h | `manual-claims-handler.md` |
| Partner manager | P1 Onboarding and keys (15); P2 Statements (10); P3 Supporting partner developers (15) | 1.5 h | 2.25 h | `manual-partner-manager.md`, `partner-api-guide.md` |
| Admin / support | A1 Users and roles (15); A2 Operations status and jobs (20); A3 Health and incidents (20) | 3 h incl. runbook drills | 4 h | `manual-administrator-and-support.md` |
| Executive | E1 Reading the dashboard (10) | 30 min briefing | 40 min | `manual-executive.md` |
| Partner developers | API guide + sandbox key | 1 h webinar | 2 h | `partner-api-guide.md` |

### 4.3 Training timeline

| When | Activity |
|---|---|
| Sprint 2–3 | Champion bootcamp, sandbox access for champions |
| Sprint 4 | Train-the-trainer (champions + supervisors) |
| UAT (T2–T3) | Pilot users trained (role curricula). UAT doubles as practice. |
| Pilot weeks 1–2 | Floor-walkers (champions + iorta BA) in each telesales room, daily 15-minute tips huddle |
| Each scale-out wave | Same pattern for new users, delivered by champions |
| BAU | New-joiner path in the LMS. Refresher on each major release ("what's new" micro-module). |

### 4.4 Sandbox practice (demo mode)

The SANDBOX/TRAINING environment runs with `DEMO_MODE=true`, synthetic VETC data (2,500 vehicles by default, `SEED_RECORDS`) and the seeded users below. The demo password is `Tasco@Demo2026!`. It is **sandbox only, never used in production**.

| Username | Role | MFA | Practice tasks |
|---|---|---|---|
| `agent.hn` / `agent.hcm` | Telesales agent (Hà Nội / TP.HCM) | No | Claim a handoff, open Customer 360, quote TNDS + PA, send link / issue, record outcome |
| `supervisor` | Telesales supervisor | No | Reassign a handoff, review queue KPIs |
| `campaign` | Campaign manager | No | Filter hot leads, run due journeys, inject an ecosystem event, run a voice campaign |
| `author` | Rule author | No | Draft a scoring change, simulate, submit |
| `approver` | Rule approver | **Yes** | Approve or reject the author's draft |
| `compliance` | Compliance officer | **Yes** | Audit search, verify chain, DSAR export |
| `steward` | Data steward | **Yes** | Resolve DQ issues, correct an expiry with evidence |
| `claims` | Claims handler | No | Move a claim from submitted to acknowledged |
| `partners` | Partner manager | No | Onboard a partner, issue a key, view statement |
| `admin` | Platform admin | **Yes** | Create a user, check ops status, run reconciliation |
| `support` | Support engineer | No | Run relay job, check job history |
| `exec` | Executive | No | Read the overview dashboard |
| `auditor` | Internal auditor | No | Search audit trail |

MFA codes in the sandbox are shown by the demo helper (`GET /api/demo/totp/<username>`), which is disabled outside demo mode. In training, the sign-in screen's demo helper shows the current code. **Production uses a real authenticator app.**

Customer-app practice: open `/app/` and use the demo picker to choose a synthetic vehicle. Confirm the expiry date, renew with an add-on, verify the certificate at `/verify/<certNo>`, change consent and report an accident.

The sandbox is reset nightly (`npm run seed` on an empty store), so trainees can practise freely.

### 4.5 Certification

| Level | Criteria | Grants |
|---|---|---|
| **Certified user** | LMS modules complete. Practical assessment in the sandbox (role task list, ≥ 80 % tasks correct, observed by a champion or trainer). | Production account activated by the admin (role assigned) |
| **Certified approver** | Certified user + approver module + a supervised approval of a real low-risk rule change | `rule_approver` role in production |
| **Champion** | Certified user + bootcamp + 2 co-delivered sessions | Champion badge |

Production accounts for regulated roles (approver, compliance, steward, admin) are created **only after certification**. This forms part of the access-provisioning evidence.

---

## 5. Adoption KPIs

All targets are **proposed** for agreement at G1/G3. Sources: platform endpoints (`/api/dashboard/adoption`, `/api/dashboard/overview`, `/api/dashboard/governance`), audit trail, LMS and surveys. Four targets are already encoded as reference values in `insightsService.adoption()`: weekly active telesales ≥ 90 %, average clicks to renew ≤ 3, handoff first contact within 2 business hours, rule-change lead time ≤ 1 day.

| KPI | Definition | Source | Pilot target (proposed) | Scale target (proposed) |
|---|---|---|---|---|
| Weekly active users — telesales | Distinct agents with ≥ 1 login and ≥ 1 handoff action per week ÷ licensed agents | Audit (`auth.login`, `handoff.updated`) | ≥ 90 % | ≥ 95 % |
| Weekly active users — supervisors, campaign, compliance, stewards | Per role, ≥ 1 meaningful action per week | Audit | ≥ 80 % | ≥ 90 % |
| Handoff first-contact time | Median time from `handoff.created` to first `handoff.updated` by an agent, in business hours | Audit / events | ≤ 2 business hours | ≤ 1 business hour |
| Handoff backlog age | % of open handoffs older than 1 business day | Handoffs | ≤ 10 % | ≤ 5 % |
| % renewals via app | Completed orders with channel `vetc_app`/`zalo` ÷ all completed renewal orders | `sales.byChannel` | ≥ 50 % | ≥ 65 % |
| Clicks/taps to renew | Median taps from opening a renewal link to the e-certificate | Front-end analytics | ≤ 3 | ≤ 3 |
| Customer expiry confirmations | Customers confirming expiry in app ÷ `verify_expiry` messages sent | Audit `customer.expiry_declared` | ≥ 15 % | ≥ 25 % |
| Rule-change lead time | Median time from `rules.draft_created` to `rules.approved` | Audit | ≤ 1 business day | ≤ 1 business day |
| Rule rejection rate | Rejected ÷ submitted | Audit | Track (no target) | ≤ 20 % |
| Voice bot opt-out rate | `opted_out` ÷ calls | Governance dashboard | ≤ 5 % | ≤ 3 % |
| Plate-verification failure rate | (`plate_mismatch` + `unverified`) ÷ calls | Governance dashboard | ≤ 15 % | ≤ 10 % |
| Customer CSAT (post-purchase) | 1–5 rating after e-certificate | In-app survey | ≥ 4.3 | ≥ 4.5 |
| Customer NPS | Quarterly survey of pilot customers | Survey | ≥ +30 | ≥ +40 |
| Staff satisfaction / SUS | System Usability Scale per role | Survey (see usability plan) | ≥ 70 | ≥ 75 |
| Training completion | Certified users ÷ target users before account activation | LMS | 100 % before go-live | 100 % |
| Help usage | Help-drawer opens per active user per week (should fall over time) | Front-end analytics | Track trend | Falling |
| Support tickets per 100 users | "How-to" tickets | Service desk | ≤ 10 / week | ≤ 3 / week |

---

## 6. Resistance management

| Likely resistance | Signal | Response |
|---|---|---|
| Agents bypass the inbox and work old lists | Low `handoff.updated` per agent; wins not recorded | Supervisor coaching; legacy lists retired by date; incentives based on platform-recorded wins |
| "The bot steals my leads" | Champion feedback | Show that the bot does verification and reminders and hands hot leads to agents; share agent conversion uplift |
| Marketing frustrated by caps and the copy guard | Rejected drafts, escalations | Explain the regulatory basis (Decree 91/2020, Law 08/2022); co-create value-based copy; Rules clinic |
| Compliance overloaded with approvals | Rule lead time > 1 day | Batch low-risk changes; add a second approver; agree risk tiers |
| Partners fear channel conflict | Partner churn | Partner council, rules of engagement, transparent statements |

---

## 7. Reinforcement plan

1. **Measure:** weekly adoption dashboard reviewed by supervisors and the Product Owner, with role-level KPIs (section 5).
2. **Recognise:** monthly "renewal hero" recognition for agents and squads, based on wins recorded in the platform.
3. **Coach:** supervisors review a sample of handoffs weekly (talking points used? link sent? outcome recorded?).
4. **Embed:** platform KPIs added to role scorecards and performance objectives (handoff SLA, rule lead time, DQ backlog).
5. **Retire the old way:** legacy call lists and email-based rule approvals are switched off by a set date after pilot.
6. **Refresh:** "what's new" micro-module and a champion forum with each release. Annual refresher for regulated roles (approvers, compliance, stewards).
7. **Listen:** in-app feedback link in the help drawer; quarterly pulse survey; issues tracked to closure and reported back ("you said, we did").
8. **Audit:** quarterly access review confirms that people hold only the roles they need, and that certified approvers remain certified.
