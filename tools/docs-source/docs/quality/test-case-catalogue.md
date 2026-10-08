---
id: TGP-QA-02
title: Test Case Catalogue
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 08/10/2026
prepared_by: iorta TechNXT, Quality Engineering
reviewed_by: TASCO Insurance, IT Quality Assurance
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [ABAC, Attribute-Based Access Control]
  - [API, Application Programming Interface]
  - [B2B, Business to Business]
  - [CI, Continuous Integration]
  - [CORS, Cross-Origin Resource Sharing]
  - [CPU, Central Processing Unit]
  - [CSP, Content Security Policy]
  - [DBA, Database Administrator]
  - [DNC, Do Not Contact]
  - [DQ, Data Quality]
  - [DR, Disaster Recovery]
  - [FR, Functional Requirement]
  - [HA, High Availability]
  - [HCM, Hồ Chí Minh City]
  - [HMAC, Hash-based Message Authentication Code]
  - [HSTS, HTTP Strict Transport Security]
  - [HTTP, Hypertext Transfer Protocol]
  - [ICT, Indochina Time (UTC+7)]
  - [ID, Identifier]
  - [IP, Internet Protocol]
  - [IT, Information Technology]
  - [KI, Known Issue]
  - [MDM, Master Data Management]
  - [MFA, Multi-Factor Authentication]
  - [MiB, Mebibyte]
  - [NFR, Non-Functional Requirement]
  - [NFT, Non-Functional Testing]
  - [NVDA, NonVisual Desktop Access (screen reader)]
  - [OA, Official Account (Zalo)]
  - [OAuth, Open Authorization]
  - [OTP, One-Time Password]
  - [PERF, Performance test environment]
  - [PG, PostgreSQL]
  - [PII, Personally Identifiable Information]
  - [PITR, Point-In-Time Recovery]
  - [PREPROD, Pre-production environment]
  - [QA, Quality Assurance]
  - [QR, Quick Response (code)]
  - [RB, Runbook procedure]
  - [RBAC, Role-Based Access Control]
  - [RPO, Recovery Point Objective]
  - [SHA, Secure Hash Algorithm]
  - [SIM, Subscriber Identity Module]
  - [SIT, System Integration Testing]
  - [SMS, Short Message Service]
  - [SoD, Separation of Duties]
  - [SOP, Standard Operating Procedure]
  - [SQL, Structured Query Language]
  - [TC, Test Case]
  - [TNDS, Compulsory motor third-party liability insurance (Bảo hiểm TNDS bắt buộc)]
  - [TOTP, Time-based One-Time Password]
  - [UAT, User Acceptance Testing]
  - [URI, Uniform Resource Identifier]
  - [URL, Uniform Resource Locator]
  - [UTC, Coordinated Universal Time]
  - [UUID, Universally Unique Identifier]
  - [VAT, Value Added Tax]
  - [VND, Vietnamese đồng]
  - [ZNS, Zalo Notification Service]
signoff:
  - ["Data request response time of 72 hours (TC-184, TC-193) to be confirmed by TASCO legal", TASCO Legal, Open]
  - [TC-180 contract tests re-based on the confirmed TASCO core interface specification, TASCO IT Architecture, Open]
---

# Introduction

This catalogue lists the test cases for the TASCO Growth Platform, grouped by module. Each case states the scenario, the preconditions and steps, the expected result, the test type and priority, and where it is automated. The record of execution, with the actual result and status of every case, is the workbook TASCO-Test-Cases-and-Results.xlsx (sheets *Test Cases* and *Automated Run*).

The catalogue covers TC-001 to TC-205 and the additional sales case TC-080a, 206 cases in all, and matches the workbook case for case. TC-165 to TC-180 cover the TASCO core rating and product catalogue integration; TC-181 to TC-183 cover the customer hosts and vehicle confirmation; TC-184 to TC-205 cover the data requests register and quick renewal. The 124 user-story scenarios automated in the functional suite are recorded separately in the workbook sheet *Functional Test Cases*.

The audience is the iorta TechNXT and TASCO test teams, developers, and TASCO IT reviewers who sign off the gates.

Related documents:

- TGP-QA-01 Test Strategy (test levels, environments, defect severity and the known issues register KI-01 to KI-33).
- TGP-QA-03 Performance and Capacity Test Plan (scenarios PERF-S1 to PERF-S14).
- TGP-QA-04 User Acceptance Test Plan (business scenarios that reference these cases).
- TGP-BUS-04 User Stories and Acceptance Criteria and TGP-BUS-05 Requirements Traceability Matrix.
- TGP-OPS-01 Runbook and Support Guide (RB and SOP procedures referenced in expected results).

# How to read the catalogue

| Column | Meaning |
|---|---|
| Scenario | What the case proves, in one line |
| Preconditions and steps | Starting state, then the action taken |
| Expected result | The observable outcome; error codes come from the body `{ error: { code, message, details, requestId } }` |
| Type/Priority | Type: Unit, Int (integration), API, Sec (security), PG (needs PostgreSQL), SIT, UAT, NFT, UI (manual check of a screen). Priority: P1 must pass for any release, P2 must pass for go-live, P3 should pass |
| Automation | Test file under `test/` (for example `api` is `test/api/api.test.js`, `unit/identity` is `test/unit/identity.test.js`; `api/dsarQuickRenewal` is suite API-DQ and `unit/quickRenewal` is suite U-QR), or Manual |

Preconditions use the demo users created by `src/bootstrap/seed.js` (for example `admin`, `agent.hn`, `author`, `approver`). They exist only where demo mode is on (local, development and the hosted UAT). `admin`, `approver`, `compliance` and `steward` need a TOTP code. Times are Vietnam time (ICT, UTC+7) unless stated.

Where an open known issue blocks a case, the expected result describes the correct behaviour and the KI is named. The QA Lead confirms at each release that every automated case is asserted in its file.

# Test cases by module

## Authentication and session

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-001 | Password sign-in without MFA | User `exec`. `POST /api/auth/login` with the demo password | 200 with `accessToken`, `expiresIn` 1800 and `dashboard:read` in permissions. Audit `auth.login` | API · P1 | `api` |
| TC-002 | MFA challenge for a privileged role | User `admin` (TOTP enrolled). Sign in with the correct password | 200 `{mfaRequired:true, mfaToken}`. No access token | API · P1 | `api` |
| TC-003 | MFA completed with a valid code | After TC-002. `POST /api/auth/mfa` with a valid TOTP | 200. Token has `amr` pwd and otp, audience `staff`. Failure counter reset to 0 | API · P1 | `api` |
| TC-004 | Wrong password gives no detail | User `exec`. Sign in with a wrong password | 401 `UNAUTHENTICATED` "Invalid username or password". Audit `auth.login_failed`, reason `bad_password` | API · P1 | `api` |
| TC-005 | Lockout after 5 failures | User `exec`. Five wrong passwords, then the correct one | Attempts 1 to 5 return 401. Attempt 6 returns 423 `ACCOUNT_LOCKED`. Audit `auth.login_locked` | Sec · P1 | `security` |
| TC-006 | Lock expires | After TC-005, clock advanced 15 minutes. Correct sign-in | 200. Failure counter 0, lock cleared | Sec · P2 | `security` |
| TC-007 | No username enumeration | Sign in with an unknown user, then with a known user and a wrong password | Same 401 message. Response times within ±30 % (dummy hash). Audit actor `anonymous` | Sec · P2 | `security` |
| TC-008 | Wrong MFA code | After TC-002. Submit code `000000` | 401 "Invalid code". Audit `auth.mfa_failed`. Failure counter incremented | Sec · P1 | `security` |
| TC-009 | MFA session expires | After TC-002, clock +301 s. Submit a valid code | 401 "MFA session expired — sign in again" | API · P2 | `api` |
| TC-010 | MFA self-enrolment | Admin creates a `rule_approver` user (seed never shown to the admin). User signs in, scans the code, submits a valid code, changes password | Sign-in returns `mfaEnrolment:true` and `otpauthUri`. First valid code completes enrolment (audit `auth.mfa_enrolled`) and asks for a password change. Later sign-ins challenge without the URI | API · P1 | `api` |
| TC-011 | Disabled user cut off at once | `agent.hn` holds a valid token. Admin sets status `disabled`. Agent calls `GET /api/auth/me`, then signs in | `me` returns 401 (status checked on every request; earlier tokens invalid). Sign-in returns 401, reason `inactive` | API · P1 | `api` |
| TC-012 | Demo code helper absent outside demo mode | Demo mode off. `GET /api/demo/totp/admin` | 404 `NOT_FOUND` | Sec · P1 | `security` |
| TC-013 | Token with `alg: none` rejected | Re-encode a valid token with `alg: none` and no signature | 401 | Sec · P1 | `security` |
| TC-014 | Tampered token rejected | `exec` token with roles changed to `admin`, signature kept | 401 (signature mismatch). Roles are read from the user record, not the token | Sec · P1 | `security` |
| TC-015 | Expired token rejected | Token signed with a negative lifetime | 401 | Sec · P1 | `security` |
| TC-016 | Token audience confusion | Use the MFA token on a staff route. Use a customer token on `GET /api/leads` | MFA token: 401. Customer token: 403 "Staff token required" | Sec · P1 | `security` |
| TC-017 | Sign-out revokes the token | `exec` signed in. `POST /api/auth/logout`, then `GET /api/auth/me` | 401 on the same replica. Revocation is per replica (KI-07) | API · P2 | `api` (blocked by KI-07) |
| TC-018 | Password policy and change | `exec`. New password `short`; then a wrong current password; then a valid change | 400 password policy (12 characters minimum, must differ). 401 "Current password is incorrect". 200 `{reauthenticate:true}`; old token rejected afterwards | API · P2 | `api` |
| TC-019 | Permissions match the role mapping | Each demo user. `GET /api/auth/me` | Permissions equal the union of `rbac.json` for the user's roles | API · P2 | `api` |
| TC-020 | MFA step honours lockout | `admin` locked but holding a valid MFA token. Submit a correct code; replay a used code | 423 `ACCOUNT_LOCKED`. Replayed code 401 "Invalid code" (KI-06 fixed) | Sec · P2 | `security` |

## Authorisation (RBAC and ABAC)

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-021 | Route and role authorisation matrix | Tokens for 13 staff roles, a customer and a partner. Call all 103 routes with each principal | Missing permission: 403 `FORBIDDEN`. No token: 401. Public routes open | API · P1 | `api` |
| TC-022 | Administrator has no business data | `admin`. Open a customer; create a rule; approve a rule | 403 for all three | API · P1 | `api` |
| TC-023 | Agents see their own region's leads | `agent.hn`. Request leads for TP. Hồ Chí Minh | Every lead returned is in Hà Nội; the region filter is overridden | API · P1 | `api` |
| TC-024 | Regional restriction on Customer 360 | `agent.hn`. Open a TP. Hồ Chí Minh profile | 403 "Policy regional_data denies read on this profile" | Sec · P1 | `security` |
| TC-025 | Agents see only their own or unassigned handoffs | Handoff assigned to `agent.hcm`. `agent.hn` reads and updates it | 403. The list omits it | Sec · P1 | `security` |
| TC-026 | Only supervisors assign work | Open handoff. Agent assigns it; supervisor assigns it | Agent: 403 "Missing permission handoff:assign". Supervisor: 200, audit `handoff.updated` | API · P1 | `api` |
| TC-027 | No self-administration; separation of duties | `admin` changes own roles; creates a user with author and approver roles | 422 "You cannot change your own roles or status". 422 separation-of-duties message | API · P2 | `api` |
| TC-028 | Unknown role rejected | `admin` creates a user with role `superuser` | 400 "Unknown role superuser" | API · P2 | `api` |
| TC-029 | Regional restriction beyond Customer 360 | `agent.hn`, HCM profile. Read lineage; start a voice session; list policies for the profile | Lineage: 403. Voice session and policies should return 403; today they return 200 (KI-10) | Sec · P2 | `security` (lineage); rest blocked by KI-10 |
| TC-030 | Staff and customer audiences kept apart | Staff token on `GET /api/customer/home`; customer token on `GET /api/policies` | 403 "Customer token required"; 403 "Staff token required" | Sec · P1 | `security` |

## Customer 360, data enrichment and MDM

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-031 | Personal data masked by permission | `campaign` (no PII permission) and `agent.hn` (has it) open the same customer | Campaign sees masked name and phone. Agent sees clear values. Audit `profile.viewed` records which | API · P1 | `api` |
| TC-032 | Plate and phone normalised on ingest | `steward` ingests plates `30a-123.45`, `30A 12345`, `30A.123.45`, `30-12345` and three phone formats | First three plates map to `30A12345`. `30-12345` rejected (DQ `invalid_plate`). Phones become `0912345678`. Response `rejected` = 1 | Int · P1 | `unit/identity`, `integration/journeys` |
| TC-033 | Survivorship across sources | Same plate from a VETC account (trust 0.85) and a partner agent (0.5) with different names | Golden profile takes the higher-trust value. Lineage lists both records | Int · P1 | `integration/journeys` |
| TC-034 | Conflicting phones raise a DQ issue | Two sources, same plate, different phones | DQ issue `conflicting_phone` open | Int · P2 | `integration/journeys` |
| TC-035 | Customer-declared expiry survives rebuild | Customer declared expiry. Re-ingest an older partner record | Profile keeps the customer-declared date | Int · P1 | `integration/journeys` |
| TC-036 | Erased profiles are not re-identified | Profile erased (TC-107). Ingest a new record with name and phone | Profile stays anonymised with no name or phone | Int · P1 | `integration/governance` |
| TC-037 | Data steward corrects an expiry | `steward` (MFA) corrects with evidence; then without evidence | 200, audit `profile.expiry_corrected`, lead recomputed, confidence 0.9. Without evidence: 400. Regional stewards limited by region | API · P1 | `api` |
| TC-038 | DQ issue lifecycle | Open `invalid_plate` issue. Resolve it; re-ingest the same bad record | Status resolved with resolver. Re-ingest reopens it | API · P2 | `api` |
| TC-039 | Ingest bounds and allow-list | Batch of 5,001 records; extra field `isAdmin`; record without `recordId` | 400 "at most 5000 items". Extra field not stored. 400 `recordId required` | API · P2 | `api` |
| TC-040 | Lineage view | Profile built from two sources. `GET /api/customers/:id/lineage` | Field sources and confidence shown; source record IDs; at most 10 recent batches | API · P3 | `api` |

## Lead scoring, next best action and benefits

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-041 | Benefits pending legal review never reach customers | Loyalty points pending legal review; eligible profile. Customer home; staff view | Customer list excludes loyalty points and unavailable items (auto-renew, fleet dashboard), at most 3 shown. Staff see them flagged | API · P1 | `api` |
| TC-042 | Explainable score and tiers | Fixed profile facts. Evaluate the lead | Score = round(Σ weight × value × (0.6 + 0.4 × expiry confidence)). Hot ≥ 70, warm ≥ 45, else nurture. Reasons sorted with text | Unit · P1 | `unit/rulesDomain` |
| TC-043 | Fix data before selling | Expiry confidence below 0.5. Recompute | Next best action: confirm the expiry date (rule `fix_data`) | Unit · P1 | `unit/rulesDomain` |
| TC-044 | Do-not-contact suppresses everything | Customer on the DNC list. Recompute | Action `suppress`; no touchpoints planned | Int · P1 | `integration/journeys` |
| TC-045 | Company vehicles routed to B2B | Company-owned vehicle. Recompute | Action `route_b2b`; excluded from voice campaigns | Unit · P2 | `unit/rulesDomain` |
| TC-046 | TASCO-insured vehicles leave journeys | Active TASCO TNDS policy beyond today. Recompute | No journey; action `insured`; scheduled touchpoints deleted | Int · P1 | `integration/journeys` |
| TC-047 | Journey priority | Lapsed 10 days, confidence ≥ 0.5 | Lapsed journey chosen over renewal and conquest | Unit · P2 | `unit/rulesDomain` |
| TC-048 | Touchpoints re-planned only on change | Recompute twice with no change; then change the tier | No duplicates. A tier change re-plans scheduled touchpoints | Int · P2 | `integration/journeys` |
| TC-049 | Lead queue filters and bounds | `campaign`. Filter hot, score ≥ 70, sort by expiry, limit 500; limit 501; tier `cold` | 200 filtered and sorted. 400 for limit above 500. 400 for an unknown tier | API · P2 | `api` |

## Journeys and contact compliance

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-050 | No marketing before 08:00; blocked touchpoints deferred | Due marketing touchpoint, consent given, demo clock. Run at 07:59, then at 10:00 | First run: nothing sent, touchpoint stays scheduled and counts as deferred. Second run: done (KI-05 fixed) | Int · P1 | `unit/rulesDomain`, `integration/journeys` |
| TC-051 | Window opens at 08:00 | Runs at 08:00 and 19:59 on separate profiles | Sent both times | Unit · P1 | `unit/rulesDomain` |
| TC-052 | No marketing at or after 20:00 | Run at 20:00 | Blocked, "outside allowed contact hours" | Unit · P1 | `unit/rulesDomain` |
| TC-053 | Marketing needs marketing consent | Marketing consent off. Check contact | "no marketing consent" | Unit · P1 | `unit/rulesDomain` |
| TC-054 | Calls need call consent | Call consent off. Check voice bot and telesales | "no call consent" | Unit · P1 | `unit/rulesDomain` |
| TC-055 | DNC customer never contacted | Customer on the DNC list. Service and marketing on every channel; start a voice session | Every channel blocked. Voice session 422 "Customer is on the do-not-contact list" | Int · P1 | `unit/rulesDomain`, `api` |
| TC-056 | Daily marketing cap | One marketing message in the last 24 hours. Next marketing touchpoint | Blocked "daily contact cap reached" | Unit · P1 | `unit/rulesDomain` |
| TC-057 | Weekly caps | Three marketing messages in 7 days; separately two calls | "weekly contact cap reached"; "weekly call cap reached" | Unit · P1 | `unit/rulesDomain` |
| TC-058 | Service messages bypass caps and window | Caps reached, 22:00. Lapsed notice (service) | Allowed; consent and DNC still apply | Unit · P2 | `unit/rulesDomain` |
| TC-059 | Touchpoints cancelled when no longer relevant | Scheduled touchpoint; customer buys TASCO TNDS, or the journey changes | Cancelled with "already insured with TASCO" or "journey changed to …" | Int · P1 | `integration/journeys` |
| TC-060 | Copy guard blocks banned wording at send time | Test-only active template containing "giảm giá" inserted directly. Run due | Message stored as blocked with reason; nothing sent; blocked counter +1 | Int · P1 | `integration/journeys` |
| TC-061 | Copy guard ignores diacritics, case, spacing and punctuation | Check "GIAM GIA", "Giảm Giá", "Cashback", "cash back", "giảm  giá", "c.a.s.h-back" | All blocked (KI-26 fixed). "Gia hạn bảo hiểm" allowed | Unit · P1 | `unit/rulesDomain`, `integration/sales` |
| TC-062 | Channel fallback | Zalo gateway fails. Touchpoint with Zalo then SMS | Zalo failed, SMS sent, touchpoint done on SMS, failure counted | Int · P2 | `integration/journeys` |
| TC-063 | VETC ecosystem events | Profile under 60 days to expiry. Post inspection-booked and tag-activated events | Inspection: TNDS check service message. Tag: lead recompute requested. Audit `ecosystem.event_handled` | API · P2 | `api` |

## Voice bot and telesales handoff

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-064 | Disclosure and plate privacy | Profile `30A-123.45`. Start a voice session | First line discloses the automated assistant and never asks for OTP or payment. No line reads the full plate | API · P1 | `unit/voicebot`, `api` |
| TC-065 | Plate verified from speech | Session for `30A12345`. Say the plate four ways, including "ba mươi A, một hai ba bốn năm" | Each verified. Tens words and motorbike plates parse (KI-25 fixed) | Unit · P1 | `unit/voicebot`, `unit/identity` |
| TC-066 | Plate mismatch ends the call | Session for `30A12345`. Say "29A 999 99" | Outcome `plate_mismatch`; DQ issue opened; no expiry or price disclosed | Int · P1 | `integration/governance` |
| TC-067 | Unverifiable caller | Three turns with no plate | Outcome `unverified`; no personal data spoken | Unit · P2 | `unit/voicebot` |
| TC-068 | Opt-out by voice honoured | Call consent given. Say "đừng gọi nữa" | Outcome `opted_out`; call consent off and DNC on, kept through rebuilds; audit `consent.withdrawn`; later campaigns skip the profile | Int · P1 | `integration/governance` |
| TC-069 | Scam concern handled | Say "lừa đảo à" | Trust script spoken; trust concern flagged; handoff notes say "never take payment by phone" | Unit · P2 | `unit/voicebot` |
| TC-070 | Hot lead handoff is minimal | Verified session. Say "tôi muốn mua ngay" | Outcome `hot_handoff`; handoff with masked phone, plate verified flag and talking points; event `handoff.created` | Int · P1 | `integration/governance` |

## Quote, payment, issuance and e-certificate

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-071 | Customer cannot buy another customer's quote | Customers A and B. A pays B's quote | 404 "Quote not found"; no debit | Sec · P1 | `security` |
| TC-072 | Regulated TNDS premium exact | Car under 6 seats, 1-year term. Customer quotes TNDS | Net VND 437,000, VAT VND 43,700, total VND 480,700; price-regulated flag; no discount field | Unit/API · P1 | `unit/rulesDomain`, `api` |
| TC-073 | Idempotent double purchase | Open quote. Pay twice with the same `Idempotency-Key` | Second call replays the same order; exactly one wallet debit | API · P1 | `api` |
| TC-074 | Public certificate check shows no personal data | Issued policy. Verify its number; verify an unknown number | Valid, in force, masked plate, product, dates; no name or phone. Early renewal: not yet in force. Unknown: not found | API · P1 | `api` |
| TC-075 | Quote expires after 24 hours | Quote created; clock +24 h 1 min. Pay | 422 "Quote expired — please re-quote"; no order | API · P1 | `api` |
| TC-076 | Paid quote cannot be paid again with a new key | After TC-073. Pay with a different key | 422 "Quote is converted" | API · P1 | `api` |
| TC-077 | Channel eligibility | Product not sold on the partner channel. Partner quote | 422 "… is not sold on channel partner_api" | Unit · P2 | `integration/sales` |
| TC-078 | Physical damage underwriting limits | Sum insured VND 6 billion (limit 5 billion); deductible 250,000 | 422 "refer to underwriter"; 400 "Unsupported deductible" | Unit · P2 | `unit/rulesDomain` |
| TC-079 | Wallet outage | Wallet port fails. Six customer payments | 503 `UPSTREAM_UNAVAILABLE`; order `payment_failed`; after 5 failures the `vetc-wallet` circuit opens and short-circuits | Int · P1 | `integration/sales` |
| TC-080 | Issuance failure compensated | Issuance fails on line 2 of TNDS plus personal accident cover per seat. Pay; retry with the same key, then a new key | Line 1 cancelled, full refund through the breaker, order `issuance_failed_refunded` (or `compensation_failed`); same key 409; new key completes (KI-02 fixed) | Int · P1 | `integration/sales` |
| TC-080a | Concurrent purchases of one quote | Two simultaneous payments of the same quote | One order and one debit (quote claimed atomically); the other gets 409 `CONFLICT` (with the same key, see KI-20) | Sec · P1 | `security` |

## Partners and partner API

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-081 | Partner cannot bind another partner's quote | Keys for two partners; quote by the first. Second binds it | 404 "Quote not found"; no order | Sec · P1 | `security` |
| TC-082 | Partner key authentication | No key; key without `tpk_`; key over 100 characters; revoked key; suspended partner | 401 "Valid X-Api-Key required" in every case | Sec · P1 | `security` |
| TC-083 | New vehicle onboarded by a partner | Plate not in the base. Partner quotes with holder details; invalid plate `ABC`; invalid phone | Profile created with lineage; quote on the partner channel. 400 for the bad plate and phone | API · P1 | `api` |
| TC-084 | Commission above the statutory cap rejected | `author` drafts a TNDS commission of 8 % | 400 "rate 0.08 exceeds statutory cap 0.05" | API · P1 | `api` |
| TC-085 | Commission statement | Partner order with TNDS and physical damage cover. Read the statement | TNDS 5 %, physical damage 10 %, not capped; total = sum; own completed orders only | API · P1 | `api` |
| TC-086 | API key shown once, stored hashed | Partner manager issues a key | Key `tpk_…` returned once; stored as SHA-256 hash and prefix; audit `partner.api_key_issued` | API · P1 | `api` |
| TC-087 | Partner sees only its own policies | Two partners with sales. List policies | Only the caller's policies | Sec · P1 | `security` |
| TC-088 | Statement date filter | Orders on three dates. Filter to one date; invalid date | Only that date's orders; 400 for the invalid date | API · P3 | `api` |
| TC-089 | Key revocation immediate | Active key. Revoke, then call | 200 revoked; next call 401; audit `partner.api_key_revoked` | API · P1 | `api` |

## Rules engine and maker-checker

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-090 | Maker cannot approve own rule | Dual-role user inserted directly into the store (SoD blocks it through the API). Draft, submit, approve own | 403 "Maker-checker: you cannot approve your own change" | Sec · P1 | `security` |
| TC-091 | Maker cannot reject own rule | As TC-090. Reject own | 403 "you cannot review your own change" | Sec · P1 | `security` |
| TC-092 | Submission rules | Draft by `author`. Another author submits; author submits twice | 403 "Only the author can submit a draft"; 422 on the second submission | API · P1 | `api` |
| TC-093 | Approval activates and retires | Pending scoring v2. `approver` (MFA) approves | v2 active, v1 retired; audit `rules.approved`; event `rules.activated`; operations status shows v2 and its checksum | API · P1 | `api` |
| TC-094 | Rollback needs approval | Active scoring v2. Roll back to v1 | New draft v3 with v1's content; v2 stays active until v3 is approved | API · P1 | `api` |
| TC-095 | Banned wording in templates rejected | `author` drafts a template with "giảm giá 10%" and with "Giam gia" | 400 "Rule set is invalid" with the copy-guard detail | API · P1 | `api` |
| TC-096 | Scoring validation | Weights summing to 90; hot threshold below warm | Errors for both | Unit · P2 | `unit/rulesDomain` |
| TC-097 | Simulation has no side effects | `campaign` simulates a scoring change for a profile | Current and candidate returned; no rule set created; invalid content 400 | API · P2 | `api` |
| TC-098 | Unknown rule operator rejected | Validate a condition using `eval` | Validation error; nothing executed | Unit · P1 | `unit/jsonLogic` |
| TC-099 | Rule cache converges across replicas | Two instances on one database. Approve on A; read on B | B serves the new version within 15 s | PG · P2 | Manual (PREPROD) |

## Claims first notice of loss

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-100 | Customer reports an accident | Active own policy. Submit with date in period, description, 3 photos | 200, claim submitted, acknowledgement due in 4 hours; event `claim.submitted`; description and location encrypted | API · P1 | `api` |
| TC-101 | Claim against another customer's policy | A submits on B's policy | 404 "Policy not found" | Sec · P1 | `security` |
| TC-102 | Incident outside cover | Incident date before the start date | 422 "Incident date is outside the policy period" | API · P2 | `api` |
| TC-103 | Illegal status change | Submitted claim moved straight to paid | 422 "Cannot move claim from submitted to paid" | API · P1 | `api` |
| TC-104 | Normal claim lifecycle | Acknowledge, assign assessor, assess, approve, pay | Each 200; history of 6 entries with actor and note; 5 audit entries | API · P2 | `api` |

## Privacy, encryption and audit

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-105 | Data subject access export | `compliance` (MFA) exports; customer downloads own data | Profile, lead, policies, messages, source records and voice sessions, internal fields stripped; audit `dsar.access_exported` | API · P1 | `api` |
| TC-106 | Erasure refused with an active policy | Profile with an active policy. Erase | 422 "Active policy in force — personal data must be retained until expiry"; nothing changed | API · P1 | `api` |
| TC-107 | Erasure anonymises | No active policy. Erase | Profile anonymised and DNC; lead deleted; messages, transcripts, handoff and claim personal data cleared (KI-29 fixed); sessions revoked; audit `dsar.erased` | API · P1 | `api` |
| TC-108 | Personal data encrypted at rest | Ingested profile. Read the raw row | Name and phones stored as `enc:v1:<keyId>:…`; phone index is an HMAC; lookup works | Unit/PG · P1 | `unit/platform`, `pg` |
| TC-109 | Logs redact secrets and personal data | Capture logs during sign-in, Customer 360 and key issue | No password, token, key, phone or name values in logs | Sec · P1 | `security` |
| TC-110 | Audit immutability and tamper detection | PostgreSQL. (a) App role updates, deletes and truncates the audit log. (b) Owner disables the trigger, edits row 5, re-enables; verify | (a) Each statement rejected. (b) Verification reports `ok:false`, broken at 4, "hash mismatch" | PG · P1 | (a) `pg`; (b) Manual (DBA) |
| TC-111 | Audit chain linear under concurrency | Two instances. 500 parallel audited actions | Verification ok; entries = 500 plus baseline | PG · P2 | Manual (PERF) |

## Operations, jobs and events

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-112 | Initial data load reconciles | Pilot extract of N records. Load in batches and compare | Records = N; rejected = invalid plates; profiles = distinct valid plates; 50 random profiles match the source | SIT/UAT · P1 | Manual (scripted checklist) |
| TC-113 | Reconciliation finds mismatches | Orders: no payment reference; pending 2 hours; missing policy; `compensation_failed`; `payment_failed`. Run reconciliation | One mismatch per order with the expected text; job run succeeded; audit `job.reconciliation` | API · P1 | `api` |
| TC-114 | Retention job | Source records 400 days old; voice sessions 200 days old. Run retention | Both deleted; other entities reported as archival pipeline (KI-13) | Int · P2 | `integration/governance` (blocked by KI-13) |
| TC-115 | Outbox retry then dead letter | Subscriber that always fails. Publish; relay 5 times | Attempts 1 to 5; then `dead_letter` with last error; succeeded handlers not re-run | Unit · P1 | `unit/stores` |
| TC-116 | Graceful shutdown | Light load. Send `SIGTERM` | Readiness 503 at once; in-flight requests finish; exit 0 within 25 s | NFT · P2 | Manual (Kubernetes drill) |

## HTTP pipeline and platform security

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-117 | Unknown body properties rejected | Create a quote with an extra `discount` field | 400 `VALIDATION_FAILED` "discount is not allowed" | API · P1 | `api` |
| TC-118 | Oversized body | Post 1 MiB plus 1 byte to sign-in | 413 `PAYLOAD_TOO_LARGE` | Sec · P1 | `security` |
| TC-119 | Wrong content type | Post `text/plain` to sign-in | 415 `UNSUPPORTED_MEDIA_TYPE` | Sec · P1 | `security` |
| TC-120 | Path traversal on static files | Three traversal paths | 404 each; no file outside `public/` | Sec · P1 | `security` |
| TC-121 | Sign-in rate limit | 11 sign-ins in 60 s from one IP | 11th: 429 `RATE_LIMITED`, `Retry-After: 60` | Sec · P1 | `security` |
| TC-122 | Global rate limit | Exceed the per-IP budget (certificate check costs 2) | 429 with `Retry-After` | Sec · P1 | `security` |
| TC-123 | SQL injection in filters | PostgreSQL. Injection strings in region, tier and audit filters | Region literal (0 rows); tier 400; audit 200 empty; tables intact | PG/Sec · P1 | `pg`, `security` |
| TC-124 | SQL injection in path and sort | PostgreSQL. Injected customer ID; injected sort | 404; 400 for sort. Columns never taken from input | PG/Sec · P1 | `pg`, `security` |
| TC-125 | Security headers | Production mode. Any request | CSP with `frame-ancestors 'none'`, `nosniff`, `DENY`, `no-referrer`, HSTS in production, no `X-Powered-By`, API `no-store` | Sec · P1 | `security` |
| TC-126 | CORS allow-list | Allowed origin set. Request from another origin | 403 "Origin not allowed"; allowed origin echoed with `Vary: Origin` | Sec · P1 | `security` |
| TC-127 | Method not allowed | `DELETE /api/leads` | 405 `METHOD_NOT_ALLOWED` | API · P3 | `api` |
| TC-128 | Request ID propagation | Send a valid and an invalid `X-Request-Id` | Valid echoed; invalid replaced by a UUID; error bodies and logs carry it | API · P2 | `api` |
| TC-129 | Malformed percent-encoding | `GET /api/customers/%E0%A4%A` | 400 "Malformed path parameter" (KI-11 fixed); no unhandled error | API · P3 | `api` |
| TC-130 | `Idempotency-Key` required | Customer pays without the header; with `abc` | 400 "Idempotency-Key header (8–100 chars) is required" | API · P1 | `api` |
| TC-131 | Health probes | PostgreSQL. Live; ready; stop the database; ready | Live 200. Ready 200 with store `postgres`. Database down: ready 503, live 200 | PG · P1 | `api` (live, ready); database-down step Manual (PREPROD) |
| TC-132 | Metrics protected and complete | Metrics token set. Read `/metrics` without, then with, the token | Without: 401. With: request, latency, quote, order, integration, event and memory series | API · P2 | `api` |
| TC-133 | OpenAPI contract complete | `GET /api/openapi.json` | OpenAPI 3.1.0; one operation per route (103 operations on 92 paths); security per audience; key required on both order routes; strict bodies; equals the committed copy | API · P1 | `api` |
| TC-134 | Demo seed refused outside demo mode | Demo mode off, PostgreSQL. Run the seed job | Exits non-zero; no users created (KI-01 fixed) | Sec · P1 | Manual (release checklist) |
| TC-135 | Voice campaign respects contact policy | Hot leads with call consent; one already called twice. Campaign at 21:00, then at 10:00 | 21:00: none called. 10:00: twice-called lead skipped for the weekly cap; each call recorded (KI-09 fixed) | Int · P1 | `integration/governance`, `api` |

## Non-functional, resilience and DR

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-136 | Peak-hour mixed load | PERF environment. Run PERF-S1 | p95 per route within target; 5xx under 0.1 %; CPU under 70 % | NFT · P1 | `perf/load` |
| TC-137 | Volume load | Empty PERF database. Run PERF-S7 | Completes in the load window; counts reconcile (TC-112 method) | NFT · P1 | `perf/load` and ingest job |
| TC-138 | 12-hour soak | Run PERF-S11 | Memory growth under 5 % per hour after warm-up; no pool exhaustion | NFT · P2 | `perf/load` |
| TC-139 | Stress to failure | Run PERF-S10 | Degrades with 429 or 503 only; no data corruption; back to target within 5 minutes | NFT · P2 | `perf/load` |
| TC-140 | Circuit breaker state machine | Five failed calls; wait the reset time; one success | Closed, open (short-circuits counted), half-open, closed. Business errors (4xx except 429) do not count | Unit · P1 | `unit/platform` |
| TC-141 | Database failover | PREPROD HA database. Fail over under load | Readiness 503 during the switch; recovery without restart; no lost orders; recovery within 2 minutes | NFT · P1 | Manual (DR-T2) |
| TC-142 | Pod loss under load | Kubernetes with disruption budget and autoscaling. Delete 1 of 3 pods at peak | No client-visible 5xx beyond retried in-flight requests; replicas restored | NFT · P2 | Manual (chaos drill) |
| TC-143 | Restore from PITR | PREPROD. Restore to 10 minutes ago into a new instance | Data matches the target time; audit chain verifies; RPO ≤ 5 minutes shown (design aim; commitment ≤ 15 minutes) | NFT · P1 | Manual (DR-T1) |

## Accessibility and localisation

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-144 | Automated accessibility scan | Front end deployed. Scan every page, both themes, both languages | No serious or critical violations | NFT · P1 | CI accessibility job |
| TC-145 | Screen reader renewal | VoiceOver and TalkBack. Open the renewal link, confirm, pay, view certificate | Every control named in Vietnamese; payment result announced; QR has a text alternative | UAT · P1 | Manual |
| TC-146 | Keyboard-only staff console | NVDA with Firefox. Leads, Customer 360, quote, handoff | All actions reachable; focus visible and not obscured; no trap | UAT · P2 | Manual |
| TC-147 | Vietnamese templates render | Render every active template with a fixture | No unresolved placeholders; dates dd/mm/yyyy; amounts with đ; signed app link | Unit · P1 | `unit/rulesDomain` |
| TC-148 | English gloss for staff | Read a voice transcript | Each bot line has Vietnamese text and an English gloss | API · P3 | `api` |
| TC-149 | SMS length with diacritics | Render first, urgent and lapsed SMS reminders | Within the agreed segment count, or the approved unaccented variant | SIT · P2 | Manual |

## SIT with VETC, TASCO and Zalo

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-150 | Zalo ZNS delivery | Templates approved; OA test account. Trigger first reminder and purchase confirmation | Delivered with correct parameters; provider ID stored; receipt correlated | SIT · P1 | Manual |
| TC-151 | VETC single sign-on token exchange | VETC identity UAT. Valid, expired and foreign-audience tokens | Valid: customer token. Others: 401 "Link invalid or expired" | SIT · P1 | Manual, then contract stub in `api` |
| TC-152 | Wallet idempotency and refund | VETC wallet test accounts. Debit twice with one key; force a timeout and retry; refund | One capture; same transaction ID; refund visible in the wallet | SIT · P1 | Manual |
| TC-153 | TASCO core issuance | TASCO core UAT. Issue TNDS car and motorbike, physical damage cover and personal accident cover per seat | Policy and certificate numbers returned; certificate link opens the verification page | SIT · P1 | Manual |
| TC-154 | Voice vendor integration | Vendor test trunk and test SIM. Campaign call; say the plate; opt out | Speech reaches the dialogue; plate check works on real speech; opt-out persists | SIT · P1 | Manual |
| TC-155 | Settlement reconciliation | One day of SIT orders. Compare with the VETC settlement file and TASCO issuance report | No unexplained differences; any difference handled through RB-11 | SIT · P1 | Manual (blocked by KI-18) |

## Assisted sales and review findings

Staff never take payment. Telesales and supervisors create a quote and send it to the customer's VETC app or Zalo; the customer pays in the app. Partner orders are collected by the partner: there is no VETC wallet debit, the payment reference starts with `PARTNER-` and the premium is remitted to TASCO under the partner agreement.

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-156 | Staff can never debit a wallet | Open quote. Call the purchase service as `agent.hn` (no staff order route exists) | 403 "Only the customer can confirm payment, inside the VETC app"; no debit; quote released | Int · P1 | `integration/sales` |
| TC-157 | Assisted sale: quote sent, customer pays | `agent.hn` quotes and sends; customer lists quotes and pays | Service message on each reachable channel; audit `quote.sent_to_customer`; paid once; re-sending a closed quote 422 | API · P1 | `api` |
| TC-158 | Region checked before quote send | `agent.hn`, quote for an HCM customer. Send | 403; quote not marked sent; no audit entry or message (KI-32 fixed) | Sec · P3 | Manual (UAT regression) |
| TC-159 | Production refuses to run without a database | Production mode, secrets set, no `DATABASE_URL`. Start | Fatal error "DATABASE_URL is required in production" (KI-28 fixed) | Unit · P1 | `unit/platform` |
| TC-160 | Replay of a failed order | Customer order failed. Re-send with the same key; then a new key | 409 `CONFLICT` "retry with a new key"; new key completes (KI-31 fixed) | Int · P2 | `integration/sales` |
| TC-161 | Partner order settlement | Partner key and quote. Bind | Completed; reference `PARTNER-<partnerId>-<orderId>`; no wallet call; commission capped | API · P1 | `api` |
| TC-162 | Time override cannot bypass the contact window | Demo mode off, real time 21:00. Campaign and journey run with `at` set to 10:00 | Override ignored; real clock applies; nothing sent (KI-33 fixed) | Sec · P1 | Manual (UAT regression) |
| TC-163 | Physical damage cover needs an inspection | Customer quote with physical damage cover. Pay; staff record a passed inspection; pay with a new key | First 422 "needs a vehicle inspection first"; audit `quote.inspection_recorded`; then completed | API · P1 | `api` |
| TC-164 | Claim detail for claims handlers | `claims` user opens a claim; an unknown ID; another role opens it | 200 with history; 404 "Claim not found"; 403 | API · P3 | `api` |

## TASCO core rating and product catalogue

TASCO core is the master for products and rating. The rating source is set by `RATING_SOURCE`: `rules` (local rule sets, sandbox only), `core` (fail closed) or `core_with_fallback` (an indicative local price when core is unavailable, which cannot be paid until re-rated). Rating requests carry risk attributes only; identity goes to core at issuance with the core quote reference. The production client paths are assumptions until TASCO's interface specification is confirmed; TC-180 re-tests against it.

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-165 | Core prices the quote | `core_with_fallback`, simulated core. Agent quotes TNDS and personal accident cover per seat | Rating source `core`; core quote reference and rating version recorded; TNDS VND 480,700; audit records the source | Int · P1 | `integration/coreRating` |
| TC-166 | Core business answer never overridden | Core refers the risk to an underwriter. Quote | Referral message returned; no local price | Int · P1 | `integration/coreRating` |
| TC-167 | Indicative quote cannot be paid | `core_with_fallback`; core times out. Quote, then customer pays | Quote marked indicative (source `rules_fallback`, no core reference). Payment 422 reason `indicative_quote`; quote not claimed; no order or debit | Int · P1 | `integration/coreRating` |
| TC-168 | Re-rate an indicative quote | After TC-167. Re-rate while the circuit is open; re-rate after recovery; re-rate again; pay | Open circuit: 503, still indicative. After recovery: core-priced, previous total kept, audit `quote.rerated`. Again: 422 "no re-rating needed". Order and policy carry the core quote reference | Int · P1 | `integration/coreRating` |
| TC-169 | Rating modes and fail-closed behaviour | Rating service in each mode with core up and down | `rules` never calls core. `core` down: 503 "temporarily unavailable". Fallback only on unavailability; re-rate never falls back; programming errors not masked; core-only products 503 | Int · P1 | `integration/coreRating` |
| TC-170 | Real HTTP core: quote, pay, issue | `core` mode against a local HTTP stub. Quote, pay; then take core down and quote | Idempotency key = quote ID; no plate or name in the rating request; quote validity capped by core's; issuance carries the core reference; core down: 503 and no quote stored | Int · P1 | `integration/coreRating` |
| TC-171 | Staff and customer re-rate endpoints | Core-priced quote. Supervisor and owning customer re-rate; another customer re-rates | 422 for both (already core-priced); other customer 404 | API · P2 | `integration/coreRating` |
| TC-172 | Catalogue sync proposes, never activates | Run the sync twice; then with a new, a renamed, a suspended and a withdrawn product; approve | Proposal pending approval by `system:catalogue-sync`; duplicate not queued; new product has no channels; withdrawn product marked; audit `catalogue.sync_proposed`; system cannot approve its own proposal; a human approver can | Int · P1 | `integration/coreRating` |
| TC-173 | Catalogue sync failure recorded | Core catalogue unavailable. Run the sync | Job fails and is recorded with the error; nothing proposed | Int · P1 | `integration/coreRating` |
| TC-174 | Unchanged catalogue is a no-op | Merge an identical catalogue | No changes; withdrawn products stay withdrawn | Unit · P3 | `integration/coreRating` |
| TC-175 | Integration status and sync job | `support` reads `GET /api/integrations/status`; agent and anonymous call it; run the catalogue-sync job | Source, circuit states and last sync shown; agent 403; anonymous 401; job returns proposed, already proposed or no change | API · P1 | `integration/coreRating` |
| TC-176 | Production guards for rating | Production configuration with `rules`; `core` without URL, with `http`, without credentials | Each refused at start-up; `rules` allowed only with `ALLOW_LOCAL_RATING`; a full core configuration loads | Unit · P1 | `integration/coreRating` |
| TC-177 | Client authentication and headers | Unit client. Quote; token expiry; core returns 401 | OAuth client credentials, cached token, idempotency and tracing headers, no personal data, mapped response. Token refreshed before expiry; a 401 drops the token and the retry succeeds | Unit · P1 | `unit/tascoCoreRatingClient` |
| TC-178 | Client error handling and circuit | Core business errors; 5xx and 429; timeouts, unreachable core, token failures | Business errors mapped, not retried, circuit stays closed. 5xx and 429 retried then upstream-unavailable; repeated failure opens the circuit. Timeouts and network failures carry a reason | Unit · P1 | `unit/tascoCoreRatingClient` |
| TC-179 | Client response contract | Malformed quote response; catalogue with new fields and with duplicates | Contract violations rejected as unavailable; unknown fields ignored; duplicate products rejected | Unit · P1 | `unit/tascoCoreRatingClient` |
| TC-180 | Rating and catalogue against TASCO core UAT | Confirmed interface specification; UAT credentials. Quote each product; fetch the catalogue; bind and issue with the core reference | Prices match TASCO's expected values; catalogue validates; issuance binds the quoted price | SIT · P1 | Manual |

## Customer channels and vehicle confirmation

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-181 | Customer confirms vehicle use and seats | Private car under 6 seats. Quote TNDS; confirm commercial use with 5 seats; quote again. Also send seats 0, and seats without use | Invalid input refused with 400. The vehicle is re-categorised, the confirmation is kept as source evidence and the TNDS premium rises to the commercial tariff | API · P1 | `api/api` |
| TC-182 | Same journeys in every host app | Open sessions with channel `tasco_web`, `zalo_mini_app`, none and an unknown host. Quote and pay in the TASCO web session | Unknown host refused with 400; no channel defaults to the VETC app. Quotes and orders carry the host channel. The TASCO web order is paid through the TASCO payment gateway (reference starting TP-) | API · P1 | `api/api` |
| TC-183 | Host wording in the customer app | Open the app with `?channel=tasco_web` and with no channel; go to the payment step | TASCO hosts show "Thanh toán qua cổng TASCO"; VETC hosts show the VETC wallet. Splash and error text name the right host | UI · P2 | Manual |

## Data requests and quick renewal

The data requests register (FR-118) records every access and erasure request, whatever the channel, and is open only to the compliance role (permission `dsar:manage`). The response time is `dsarResponseHours` in the service-level rule set, 72 hours, to be confirmed by TASCO legal. Quick renewal (FR-119) offers an eligible customer a 3-step renewal; the server decides eligibility from the `quickRenewal` service-level rule, and the full 6-step flow stays available to everyone.

| ID | Scenario | Preconditions and steps | Expected result | Type/Priority | Automation |
|---|---|---|---|---|---|
| TC-184 | Log a data request and keep a record | `compliance` logs an access request by plate, channel hotline, with a note. Read the register and the detail | 200, ID `DSR-yymmdd-XXXX`, status received, due 72 hours after receipt. Register masks the name and shows no phone. Detail shows a timeline and counts of data held, never the data. Audit `dsar.request_logged`, `dsar.request_viewed`, `dsar.register_viewed` | API · P1 | `api/dsarQuickRenewal` |
| TC-185 | New request validation | Log with type `delete`, channel `fax`, no customer, plate `XX`, an unknown plate, a future, unreadable or too old received date | 400 for each invalid value; 404 for the unknown plate; nothing logged | API · P2 | `api/dsarQuickRenewal` |
| TC-186 | Identity required before export | Access request received by email. Export at once; start without verification; start again with identity verified | Export 422. Start: in progress, identity not verified. Second start: identity verified, still in progress | API · P1 | `api/dsarQuickRenewal` |
| TC-187 | Export download completes the request | After TC-186. Complete the export; then export, refuse and start again | 200 with file name `TASCO-data-<plate>-<date>.json` and the customer's data. Request completed, outcome exported, timeline received, in progress, identity verified, completed. Later actions 422. Completed-in-30-days count rises | API · P1 | `api/dsarQuickRenewal` |
| TC-188 | Action must match the request type | Erasure request: complete an export. Access request: erase | 422 for both; nothing exported or erased | API · P2 | `api/dsarQuickRenewal` |
| TC-189 | Erasure refused while a policy is in force | Customer with a TASCO policy in force; erasure request with identity verified. Erase without a reason; with a wrong plate; with the right plate | 400 without a reason; 400 for the wrong plate. With the right plate: request refused, reason "Hợp đồng bảo hiểm còn hiệu lực đến dd/mm/yyyy…"; nothing erased | API · P1 | `api/dsarQuickRenewal` |
| TC-190 | Erasure anonymises | Customer without a policy; erasure request by app. Erase before identity is verified; then with reason, typed plate and identity verified | First 422. Then profile anonymised; request completed, outcome erased; the customer's other requests show no name. Audit `dsar.erased`, `dsar.request_completed` | API · P1 | `api/dsarQuickRenewal` |
| TC-191 | Refuse a request with a reason | Open access request. Refuse with reason "x"; then with a full reason | 400 for the short reason. Then status refused with the reason recorded; audit `dsar.request_refused` | API · P1 | `api/dsarQuickRenewal` |
| TC-192 | Only compliance handles data requests | No token; then `agent.hn`, `admin`, `steward`, `claims` and `auditor`. List, log, open, refuse and export | 401 without a token; 403 for every other role on every action | API · P1 | `api/dsarQuickRenewal` |
| TC-193 | Response time and overdue requests | Request logged by phone, received four days ago, identity verified. Filter overdue and not overdue | Request overdue. The overdue filter returns only overdue requests and the overdue count is at least 1; the not-overdue filter returns none | API · P1 | `api/dsarQuickRenewal` |
| TC-194 | App download recorded as a request | Customer downloads their data in the app. `compliance` filters the register by the customer | Download 200. The register shows a completed access request, channel app, outcome exported, identity verified, made by the customer | API · P1 | `api/dsarQuickRenewal` |
| TC-195 | Earlier export and erase endpoints still work | `compliance` calls export and erase by customer ID for a customer without a policy | Export 200 with the customer's data; erasure done; audited | API · P3 | `api/dsarQuickRenewal` |
| TC-196 | Data requests screen | `compliance` opens Governance › "Data requests" ("Yêu cầu dữ liệu cá nhân" in Vietnamese); uses "Log request", "Export data" and "Erase personal data"; another role looks for the screen | Indicators for open requests, "Due within 24 h", "Overdue" and "Completed in 30 days"; timeline per request; "Erase personal data" asks for a reason and the typed plate. Not in the menu for other roles | UI · P2 | Manual |
| TC-197 | Quick renewal for an eligible case | Renewal journey, vehicle confirmed by the customer 30 days ago, VETC wallet covers the premium | Eligible, no reasons; offers TNDS for one year | Unit · P1 | `unit/quickRenewal` |
| TC-198 | Each reason for no quick renewal | Vary one fact at a time: other journey; already renewed; seats unknown or never confirmed; confirmation over 365 days old; physical damage cover; product not sold on the host; TASCO core unavailable; wallet below the premium | Reason returned for each, in Vietnamese with no codes. A TASCO TNDS renewal qualifies on any journey. No wallet check on TASCO hosts or when the premium is unknown | Unit · P1 | `unit/quickRenewal` |
| TC-199 | Vehicle evidence and cover carried over | Vehicle known from TASCO core with no date; current TASCO TNDS and personal accident cover per seat, two-year term | TASCO core evidence has no age limit. Add-ons left out while `allowAddOns` is false, included when true. Term carried over; wallet checked for the whole term | Unit · P2 | `unit/quickRenewal` |
| TC-200 | Service-level rule set checks | Validate the shipped rule set; then invalid response hours, quick-renewal block and settings; then an older version without the new fields | Shipped set valid, 72 hours, quick renewal on for renewals. Each invalid value refused. Older version valid, with quick renewal off | Unit · P2 | `unit/quickRenewal` |
| TC-201 | Quick renewal switched off | Eligible customer in the TASCO app. Author drafts the service-level rule with quick renewal off; approver approves; customer opens home and asks for a quick quote | Before: eligible. After approval: not eligible, reason disabled; quick quote 422 | API · P1 | `api/dsarQuickRenewal`, `unit/quickRenewal` |
| TC-202 | Home shows eligibility after vehicle confirmation | Renewal customer with an unconfirmed vehicle in the VETC app. Open home; ask for a quick quote; confirm use and seats; open home | First: not eligible, "Cần xác nhận thông tin xe"; quick quote 422; other home fields unchanged. After confirmation: eligible, TNDS for one year | API · P1 | `api/dsarQuickRenewal` |
| TC-203 | Quick renewal in 3 steps | After TC-202. Open quick renewal (the client also asks for physical damage cover); tick the declaration; pay with an `Idempotency-Key`; retry the same key | Server quotes TNDS only, priced by core, journey renewal. Order completed with flow quick and one TNDS policy. Retry replays, no second debit. Home then shows already renewed | API · P1 | `api/dsarQuickRenewal` |
| TC-204 | Customer app offers both paths | Read the customer app screens for home and quick renewal | Home: "Gia hạn nhanh" first and "Tùy chỉnh gói bảo hiểm" for the full flow. Quick screen: one declaration tick, one "Xác nhận thanh toán", no extra confirmation sheet. No co-branding; "Ví VETC" kept as the payment method | API · P2 | `api/dsarQuickRenewal` |
| TC-205 | Full flow still available | Eligible and not eligible customers. Choose "Tùy chỉnh gói bảo hiểm"; go through "Gia hạn ngay", "Xem phí bảo hiểm", "Tiếp tục", declaration, "Thanh toán", "Xác nhận thanh toán" | Full flow in 6 steps for both; add-on covers can be chosen; a standard quote still needs products (400 without) | UI · P1 | Manual; `api/dsarQuickRenewal` (standard quote) |

# Traceability

| Requirement area | Test cases |
|---|---|
| Data foundation and identity | TC-001 to TC-040, TC-108 to TC-112 |
| Scoring, journeys and messaging | TC-041 to TC-063, TC-147, TC-150 |
| Purchase and voice | TC-064 to TC-080a, TC-145, TC-151 to TC-154, TC-156, TC-157, TC-160, TC-163 |
| TASCO core rating and product catalogue | TC-165 to TC-180, TC-153 |
| Customer channels and vehicle confirmation | TC-181 to TC-183 |
| Data requests register (FR-118, US-078) | TC-105 to TC-107, TC-184 to TC-196 |
| Quick renewal (FR-119, US-079, NFR-035) | TC-197 to TC-205 |
| Governance, partners, claims and operations | TC-081 to TC-107, TC-113 to TC-116, TC-155, TC-161, TC-164 |
| Platform security and non-functional requirements | TC-117 to TC-144, TC-158, TC-159, TC-162 |

Story-level traceability (requirement, story, scenario, automated test) is in the workbook sheet *Functional Test Cases* and in TGP-BUS-05 Requirements Traceability Matrix.

# Appendix

## Cases by module

| Module | IDs | Cases |
|---|---|---|
| Authentication and session | TC-001 to TC-020 | 20 |
| Authorisation (RBAC and ABAC) | TC-021 to TC-030 | 10 |
| Customer 360, data enrichment and MDM | TC-031 to TC-040 | 10 |
| Lead scoring, next best action and benefits | TC-041 to TC-049 | 9 |
| Journeys and contact compliance | TC-050 to TC-063 | 14 |
| Voice bot and telesales handoff | TC-064 to TC-070 | 7 |
| Quote, payment, issuance and e-certificate | TC-071 to TC-080, TC-080a | 11 |
| Partners and partner API | TC-081 to TC-089 | 9 |
| Rules engine and maker-checker | TC-090 to TC-099 | 10 |
| Claims first notice of loss | TC-100 to TC-104 | 5 |
| Privacy, encryption and audit | TC-105 to TC-111 | 7 |
| Operations, jobs and events | TC-112 to TC-116 | 5 |
| HTTP pipeline and platform security | TC-117 to TC-135 | 19 |
| Non-functional, resilience and DR | TC-136 to TC-143 | 8 |
| Accessibility and localisation | TC-144 to TC-149 | 6 |
| SIT with VETC, TASCO and Zalo | TC-150 to TC-155 | 6 |
| Assisted sales and review findings | TC-156 to TC-164 | 9 |
| TASCO core rating and product catalogue | TC-165 to TC-180 | 16 |
| Customer channels and vehicle confirmation | TC-181 to TC-183 | 3 |
| Data requests and quick renewal | TC-184 to TC-205 | 22 |
| Total | TC-001 to TC-205, TC-080a | 206 |

## Workbook alignment

The workbook holds all 206 cases (TC-001 to TC-205 and TC-080a). The workbook regenerated on 8 October 2026 records 178 Pass, 24 Not Run and 4 Blocked. The Blocked cases are TC-017, TC-029, TC-114 and TC-155, each tied to an open known issue. Not Run cases wait for SIT, UAT, the NFT window or a manual check; TC-180 waits for TASCO core UAT access. TC-080a passes; it cites KI-20 for context only, because the expected behaviour (one order, no double charge) is delivered.
