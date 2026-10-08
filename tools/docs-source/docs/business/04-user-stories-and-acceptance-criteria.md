---
id: TGP-BUS-04
title: User Stories and Acceptance Criteria
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 08/10/2026
prepared_by: iorta TechNXT, Business Analysis
reviewed_by: TASCO Insurance, Product Owner
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [AI, Artificial intelligence]
  - [API, Application Programming Interface]
  - [B2B, Business to business]
  - [DNC, Do not contact]
  - [DQ, Data quality]
  - [FNOL, First notice of loss]
  - [FR, Functional requirement]
  - [HTTP, Hypertext Transfer Protocol]
  - [ID, Identifier]
  - [KPI, Key performance indicator]
  - [MFA, Multi-factor authentication]
  - [MVP, Minimum viable product]
  - [NBA, Next best action]
  - [OTP, One-time password]
  - [PA, Personal accident]
  - [PD, Physical damage]
  - [PII, Personally identifiable information]
  - [QA, Quality assurance]
  - [QR, Quick response (code)]
  - [SMS, Short message service]
  - [TNDS, Compulsory motor third-party liability insurance (Bảo hiểm TNDS bắt buộc)]
  - [UAT, User acceptance testing]
  - [US, User story]
  - [UTC, Coordinated Universal Time]
  - [VAT, Value-added tax]
  - [ZNS, Zalo Notification Service]
signoff:
  - ["Acceptance criteria of in-scope stories agreed as the UAT baseline", "TASCO Product Owner", Open]
  - ["Rule values quoted in the criteria (thresholds, caps, rates) confirmed for production", "TASCO Product Owner and Compliance", Open]
  - ["Manual scenarios US-055, US-076 and US-077 scheduled in UAT", "TASCO UAT Lead", Open]
---

# Introduction

## Purpose

This document holds the product backlog of the TASCO Growth Platform as user stories with acceptance criteria. It is the basis for user acceptance testing: TASCO accepts the MVP against the criteria of the stories in scope.

## Scope

There are 79 stories in 15 epics, with 135 acceptance scenarios. Each story names the functional requirements it delivers (TGP-BUS-02) and the persona it serves (TGP-BUS-06). The TASCO core integration (FR-111 to FR-115) and the host apps (FR-117) are verified by the integration and API tests listed in TGP-BUS-05 and have no stories here.

## Audience

The TASCO product owner and UAT users, and the iorta TechNXT delivery and QA teams.

## Related documents

| ID | Title |
|---|---|
| TGP-BUS-02 | Functional Requirements Specification |
| TGP-BUS-05 | Requirements Traceability Matrix |
| TGP-BUS-06 | Personas and Customer Journeys |
| TGP-QA-02 | Test Case Catalogue |
| TGP-QA-04 | User Acceptance Test Plan |

## Conventions

Stories are numbered US-nnn and grouped in epics EP-nn. Personas are PC-n (customers) and PS-nn (staff and partners), as defined in TGP-BUS-06. Priority uses MoSCoW as in TGP-BUS-02.

Each story is written "As a … I want … so that …", followed by acceptance criteria in Given, When, Then form. Thresholds quoted in the criteria are the current rule values. If the business changes a rule through maker-checker approval, the criteria follow the active rule, not the number written here. "Today" is the platform date, times are Vietnam time (UTC+7), and the delivered rule sets are active at version 1.

The scenarios of US-001 to US-077 are also automated tests with the same title, prefixed with the story number. The scenarios of US-078 and US-079 are covered by the data-request and quick-renewal API and unit tests named in TGP-BUS-05. Of the 135 scenarios, 132 are automated and pass; three are verified manually in UAT (US-055 fleet view, US-076 language switch, US-077 physical QR scan). Results are recorded in the test cases and results workbook described in TGP-QA-02. Scenario titles marked "(target behaviour)" keep their original names for traceability; the behaviour is implemented.

## Epics

| Epic | Name | Track | Stories |
|---|---|---|---|
| EP-01 | Data foundation and repair | T2 | US-001 to US-006 |
| EP-02 | Lead prioritisation | T2 | US-007 to US-011 |
| EP-03 | Renewal journeys (TASCO book) | T3 | US-012 to US-016 |
| EP-04 | New-business journeys and moments of truth | NB | US-017 to US-022 |
| EP-05 | AI voice assistant | T1 | US-023 to US-031 |
| EP-06 | Telesales closing | T1 | US-032 to US-035 |
| EP-07 | Customer app: renew and self-service | T3 | US-036 to US-042, US-079 |
| EP-08 | Value beyond discount and cross-sell | T4 | US-043 to US-048 |
| EP-09 | Partner channel | NB | US-049 to US-053 |
| EP-10 | Fleet and B2B | NB | US-054 to US-055 |
| EP-11 | Claims first notice | T4 | US-056 to US-058 |
| EP-12 | Privacy and consent | PL | US-059 to US-062, US-078 |
| EP-13 | Rule governance | PL | US-063 to US-068 |
| EP-14 | Identity, access and audit | PL | US-069 to US-072 |
| EP-15 | Operations, insights and usability | PL | US-073 to US-077 |

# EP-01 Data foundation and repair

## US-001 Ingest a partner list into one profile per vehicle

As a data steward (PS-06), I want to upload a partner or telesales list of vehicles, so that duplicates merge into one profile per plate and bad records are quarantined. Requirements FR-001, FR-002, FR-003, FR-004, FR-011. Priority M.

```gherkin
Scenario: Duplicate records for the same vehicle merge into one golden profile
  Given a VETC account record with plate "30a-123.45" and phone "+84912345678"
  And a bank partner record with plate "30A 12345" and phone "0912 345 678"
  When both records are ingested in one batch from the bank partner source
  Then exactly one profile exists with key "30A12345" and plate "30A-123.45"
  And its phone is "0912345678"
  And its sources include the VETC account and the bank partner

Scenario: Invalid plate is rejected and raised as a DQ issue
  Given a record with plate "30-12345"
  When the batch is ingested
  Then the result reports 1 rejected record
  And an open "Invalid plate" data issue exists for that record

Scenario: Batch size limit
  When a batch of 5,001 records is submitted
  Then it is rejected with a validation error
```

## US-002 See how reliable an expiry date is

As a campaign manager (PS-03), I want each vehicle's expiry date to show its confidence and evidence, so that I do not run sales journeys on guesses. Requirements FR-005, FR-008. Priority M.

```gherkin
Scenario: Verified certificate wins
  Given a vehicle with a verified certificate expiring 01/03/2027 and an inspection-cycle estimate of 10/03/2027
  When the profile is built
  Then the expiry date is 01/03/2027
  And the method is "Verified certificate" with confidence 1.0

Scenario: Agreeing weak evidence is corroborated
  Given only an inspection-cycle estimate (0.5) and a tag-anniversary estimate (0.25) within 21 days of each other
  When the profile is built
  Then the chosen method is "Inspection cycle"
  And confidence is 0.65

Scenario: Lineage shows the evidence
  When I open the vehicle's data lineage
  Then the expiry date shows its source and confidence
```

## US-003 Correct an expiry with evidence

As a data steward (PS-06), I want to correct a vehicle's expiry and insurer when a customer sends proof, so that reminders go out at the right time. Requirements FR-009, FR-097. Priority M.

```gherkin
Scenario: Correction requires evidence and is audited
  Given I am allowed to update profiles
  When I correct the expiry of 30A12345 to 10/05/2027, insurer "PVI", evidence "photo of certificate via hotline"
  Then the profile expiry is 10/05/2027 with confidence 0.9
  And the audit trail records the correction with my user and the evidence text
  And the lead is recomputed at once

Scenario: Missing evidence
  When I save a correction without evidence
  Then the correction is refused as invalid
```

## US-004 Work the data-quality queue

As a data steward (PS-06), I want a queue of data-quality issues by type, so that I fix the records that block revenue first. Requirement FR-007. Priority M.

```gherkin
Scenario: Filter and resolve
  Given open issues of types "Unreliable expiry date" and "Conflicting phone numbers"
  When I filter the queue by "Conflicting phone numbers"
  Then only those issues are listed, with a count by type
  When I resolve one with the note "confirmed primary number by call"
  Then its status is "Resolved" with my name and the time
```

## US-005 Keep platform-captured facts when sources reload

As a campaign manager (PS-03), I want customer confirmations and assistant findings to persist when VETC reloads its data, so that we never forget what a customer told us. Requirement FR-010. Priority M.

```gherkin
Scenario: Customer declaration beats a weaker reload
  Given a customer declared expiry 15/01/2027 (customer declaration, 0.75)
  When the nightly VETC batch reloads that plate with only a tag-anniversary estimate (0.25)
  Then the profile keeps expiry 15/01/2027 from the customer declaration

Scenario: Consent withdrawal survives reload
  Given the customer withdrew call consent in the consent centre
  When the source batch says call consent is given
  Then the profile's call consent remains withdrawn
```

## US-006 Infer the vehicle category and premium

As a campaign manager (PS-03), I want the platform to infer the TNDS category when seats are missing, so that quotes and premiums are right. Requirements FR-006, FR-053. Priority M.

```gherkin
Scenario: Declared seats beat toll class
  Given a vehicle with 7 declared seats and toll class 1, personal use
  Then its category is "Car 6–11 seats (non-commercial)" with confidence 0.85
  And its lead premium is VND 873,400 including VAT for 365 days

Scenario: Toll class only
  Given a vehicle with toll class 1 and no seats
  Then its category is "Car < 6 seats (non-commercial)" with confidence 0.55
  And an "Uncertain vehicle category" data issue is open
```

# EP-02 Lead prioritisation

## US-007 Call the right customer first

As a telesales agent (PS-01), I want a lead queue sorted by score with plain reasons, so that I spend my time on the customers most likely to renew. Requirements FR-012, FR-014, FR-017. Priority M.

```gherkin
Scenario: Score, tier and reasons
  Given a TASCO customer expiring in 10 days, expiry confidence 1.0, 8 app sessions, push enabled and call consent
  When leads are computed
  Then the score is between 0 and 100 and the tier is "Hot" when the score is 70 or more
  And each factor shows points, maximum and a reason such as "expires in 10 days"

Scenario: Do-not-contact zeroes the score
  Given the same customer is on the do-not-contact list
  Then the score is 0 and the next best action is "Do not contact"

Scenario: Filtering
  When I filter for hot leads expiring within 30 days, sorted by score
  Then only hot leads with 30 days or fewer to expiry are listed, highest score first
```

## US-008 Know the next best action

As a campaign manager (PS-03), I want one recommended action per vehicle, so that every contact is consistent and explainable. Requirement FR-015. Priority M.

```gherkin
Scenario Outline: First matching NBA rule wins
  Given a lead with <facts>
  Then the next best action is "<action>"
  Examples:
    | facts                                          | action                          |
    | on the do-not-contact list                     | Do not contact                  |
    | owned by a company                             | Route to fleet / B2B team       |
    | expiry confidence 0.3                          | Ask customer to confirm expiry  |
    | new-vehicle journey, confidence 0.8            | Welcome new vehicle             |
    | 60 days to expiry, confidence 0.8              | Schedule reminders              |
    | uninsured recovery journey                     | Urgent: vehicle uninsured       |
    | hot, call consent, has phone, 20 days          | AI voice assistant → telesales  |
    | warm, app push enabled, 20 days                | One-tap renew link (app / Zalo) |
    | phone only, 20 days                            | SMS reminder                    |
    | no phone, app or Zalo, 20 days                 | Find a contact channel          |
```

## US-009 See only my region

As a regional telesales agent (PS-01, region Hà Nội), I want the queue limited to my region, so that I only work customers I am allowed to see. Requirements FR-017, FR-093. Priority M.

```gherkin
Scenario: Region scoping
  Given I am "agent.hn" with region "Hà Nội" and no dashboard access
  When I filter leads for "TP. Hồ Chí Minh"
  Then only leads in "Hà Nội" are returned

Scenario: Profile outside region
  When I open a customer in "TP. Hồ Chí Minh"
  Then access is refused under the regional data policy
```

## US-010 Stop selling to insured customers

As a customer (PC-1), I want reminders to stop as soon as I have renewed with TASCO, so that I am not spammed. Requirements FR-019, FR-030. Priority M.

```gherkin
Scenario: Purchase stops journeys
  Given I have renewal touchpoints scheduled
  When a TNDS policy is issued to me
  Then my lead has no journey and the action "Insured"
  And any touchpoint that falls due later is cancelled with reason "already insured with TASCO"
```

## US-011 Re-score after a rule change

As a campaign manager (PS-03), I want to re-score all leads on demand, so that an approved scoring change takes effect at once. Requirement FR-018. Priority S.

```gherkin
Scenario: Recompute
  Given I am allowed to recompute leads
  When I start a recompute
  Then every profile that is not anonymised is re-evaluated with the active rules
  And the audit trail records the recompute with the count
  And leads whose journey or tier changed have their touchpoints re-planned
```

# EP-03 Renewal journeys (TASCO book)

## US-012 Timely renewal reminders

As a TASCO customer (PC-1), I want reminders before my TNDS ends, through the VETC app first, so that I renew on time without effort. Requirements FR-020, FR-021, FR-022, FR-025, FR-029. Priority M.

```gherkin
Scenario: Renewal cadence is planned from expiry
  Given my insurer is TASCO and my expiry is 60 days from today
  When my lead is computed
  Then touchpoints are planned at 45 days before expiry (verify expiry), 30 (first reminder), 21 (value reminder), 7 (urgent reminder) and 0 (expiry day)
  And an assistant call at 14 days exists only if my tier is hot or warm
  And a telesales call at 3 days exists only if my tier is hot

Scenario: App push first, then fallback
  Given a first reminder is due on app push, Zalo ZNS and SMS, and I have push disabled but Zalo linked
  When the journey run executes
  Then the message is sent on Zalo ZNS in Vietnamese with my plate, my expiry as dd/mm/yyyy and a signed link
```

## US-013 Respect contact hours and caps

As a compliance officer (PS-05), I want marketing contact limited by time and frequency, so that we comply with the spam rules and keep customer trust. Requirement FR-023. Priority M.

```gherkin
Scenario: Outside the contact window
  Given a marketing touchpoint is due
  When the journey run executes at 21:15
  Then it is not sent, with reason "outside allowed contact hours"
  And it stays scheduled for the next run between 08:00 and 20:00

Scenario: Weekly cap
  Given the customer received 3 marketing messages in the last 7 days
  When another marketing touchpoint is due
  Then it is skipped with reason "weekly contact cap reached"

Scenario: No marketing consent
  Given the customer has not given marketing consent
  Then marketing messages are skipped with reason "no marketing consent"
```

## US-014 Never send discount language

As a compliance officer (PS-05), I want any customer message containing discount wording to be blocked, so that we never breach the ban on premium discounts. Requirement FR-024. Priority M.

```gherkin
Scenario: Send-time block
  Given a template whose text contains "giảm giá"
  When the journey engine sends it
  Then the message status is "Blocked" with a reason starting "copy guard:"
  And nothing is sent to the provider

Scenario: Diacritic-insensitive
  Given a text containing "giam gia", "giảm  giá" or "cash back"
  Then it is also blocked
```

## US-015 Service messages still reach the customer

As a customer (PC-1), I want the expiry-day notice even if I recently received marketing messages, so that I know I am about to be uninsured. Requirements FR-023, FR-025. Priority M.

```gherkin
Scenario: Service message bypasses caps but not DNC
  Given I received 3 marketing messages this week
  When the expiry-day service message is due
  Then it is sent
  But if I am on the do-not-contact list it is skipped with reason "customer is on do-not-contact list"
```

## US-016 Escalate unresponsive hot customers to a person

As a telesales supervisor (PS-02), I want hot customers who ignore digital reminders to reach the telesales inbox 3 days before expiry, so that we do not lose the renewal. Requirement FR-044. Priority M.

```gherkin
Scenario: Journey escalation
  Given a hot TASCO renewal lead with call consent and no purchase
  When the telesales step at 3 days before expiry runs
  Then a handoff with outcome "journey escalation" is created with talking points
  And the message log records the telesales task
```

# EP-04 New-business journeys and moments of truth

## US-017 Recover uninsured vehicles

As a lapsed owner (PC-4), I want to be told clearly that my car may be uninsured, with an easy way to fix it, so that I avoid fines and a failed inspection. Requirements FR-013, FR-020, FR-022. Priority M.

```gherkin
Scenario: Lapsed vehicle enters the recovery journey
  Given my expiry was 20 days ago with confidence 0.75
  When my lead is computed
  Then my journey is "Uninsured recovery" and the next best action is "Urgent: vehicle uninsured"
  And a lapsed notice (service) is planned for today on app push, Zalo ZNS and SMS
  And an assistant call is planned at day 2 if I am hot or warm, and a telesales call at day 5 if I am hot

Scenario: Lapsed too long is not assumed uninsured
  Given my expiry was 90 days ago
  Then I am not in "Uninsured recovery" and the urgency reason says "likely renewed elsewhere"
```

## US-018 Welcome new cars

As a new car buyer (PC-3), I want VETC to help me store my insurance and remind me, so that I never lapse. Requirements FR-013, FR-026. Priority M.

```gherkin
Scenario: Tag activation triggers onboarding
  Given VETC sends a tag-activated event for my plate
  When the event is processed
  Then my lead is re-evaluated into the "New vehicle" journey, unless I am already a TASCO customer
  And a welcome message (service) is planned at tag date + 1 day, verify expiry at + 7 days and a value reminder (marketing) at + 14 days
```

## US-019 Win customers insured elsewhere

As a private car owner insured elsewhere (PC-1), I want a reason to renew through VETC that is not price, so that switching is worth it. Requirements FR-016, FR-020, FR-025. Priority M.

```gherkin
Scenario: Conquest copy is benefit-led and lawful
  Given my insurer is "PVI" and I expire in 30 days
  When the first reminder is due
  Then the conquest reminder template is used with my top approved benefit, for example "cứu hộ giao thông 24/7"
  And the text contains no copy-guard phrase
  And an assistant call at 14 days before expiry is planned only if I am hot
```

## US-020 Use the inspection booking as a moment of truth

As a car owner (PC-1) booking an inspection (đăng kiểm), I want a check that my TNDS is valid, so that I do not fail on the day. Requirements FR-026, FR-062. Priority S.

```gherkin
Scenario: Inspection booked with expiry soon
  Given my TNDS expires in 40 days
  When an inspection-booked event is received
  Then a TNDS check service message is sent by app push or Zalo ZNS

Scenario: Expiry far away
  Given my TNDS expires in 200 days
  Then the trigger result is "condition not met" and nothing is sent
```

## US-021 Remind me when I am in the app with money

As a customer (PC-2) topping up my VETC wallet, I want a renewal prompt at that moment, so that I can pay in one tap. Requirement FR-026. Priority S.

```gherkin
Scenario: Wallet top-up within ±30 days of expiry
  Given my expiry is in 12 days and I have given marketing consent
  When a wallet top-up event is received between 08:00 and 20:00
  Then a first reminder is sent by push
  And if I already received 1 marketing contact today the result is "no permitted channel"
```

## US-022 Rehearse moments of truth

As a campaign manager (PS-03), I want to simulate VETC events from the console, so that I can test triggers before the live event feed is connected. Requirements FR-026, FR-108. Priority S.

```gherkin
Scenario: Simulator
  Given I am allowed to run journeys
  When I choose a customer and the event "long trip started" on the Journeys screen
  Then the console shows the matched triggers and the result of each
  And the audit trail records the handled event
```

# EP-05 AI voice assistant

## US-023 Know I am talking to VETC's automated assistant

As a customer (PC-1), I want the caller to say at the start that it is VETC's automated assistant and will never ask for an OTP or payment, so that I can trust the call. Requirement FR-031. Priority M.

```gherkin
Scenario: Opening line
  When an assistant call starts
  Then the first line says it is VETC's automated assistant, the call is recorded and VETC never asks for an OTP or payment by phone
  And it asks me to say my licence plate
  And it does not say my plate, name or expiry
```

## US-024 Prove it is my car before discussing it

As a customer (PC-1), I want to be asked for my plate first, so that my data is not disclosed to the wrong person. Requirements FR-032, FR-033. Priority M.

```gherkin
Scenario: Spoken plate matches
  Given my plate is "30A-123.45"
  When I say "ba không A một hai ba bốn năm"
  Then I am verified and the assistant states my expiry using the masked plate "30A-***.45"

Scenario: Plate mismatch
  When I say "29A 999 99"
  Then the assistant ends the call politely with outcome "Plate mismatch"
  And a "Plate mismatch (call)" data issue is opened for the profile

Scenario: Plate not understood three times
  When I say three things with no recognisable plate
  Then the call ends with outcome "Not verified"
```

## US-025 Get an honest answer about price

As a price-sensitive customer (PC-1), I want a straight answer about price, so that I do not feel tricked. Requirements FR-035, FR-056. Priority M.

```gherkin
Scenario: Price asked
  Given I am verified and my premium is VND 480,700 including VAT
  When I say "phí bao nhiêu tiền"
  Then the assistant says TNDS premiums are set by regulation and identical at every insurer, and states "480.700 đồng" including VAT
  And mentions quick renewal in the app, the instant e-certificate and roadside assistance
  And any handoff records that I asked about price
```

## US-026 Handle "is this a scam?"

As a sceptical customer (PC-4), I want the assistant to explain how I can verify it, so that I do not hang up on a genuine service. Requirement FR-034. Priority M.

```gherkin
Scenario: Scam concern at any point
  When I say "sao biết số tôi, lừa đảo à"
  Then the assistant replies with the trust script and offers a notice in the app
  And the handoff to telesales records a trust concern
```

## US-027 Tell the assistant I already renewed

As a customer insured elsewhere (PC-1), I want to say I already renewed, so that VETC stops calling me this year. Requirements FR-010, FR-036. Priority M.

```gherkin
Scenario: Already renewed
  Given I am verified and my expiry on file is 20/10/2026
  When I say "tôi đã gia hạn rồi" and then "mua bên Bảo Việt, hết hạn tháng 9 năm sau"
  Then the outcome is "Already renewed elsewhere"
  And my expiry becomes 20/10/2027 from an assistant call, confidence 0.6, insurer "other", with a competitor note
  And my lead is recomputed
```

## US-028 Stop calling me

As a customer (PC-1), I want to opt out by voice, so that I never get sales calls again. Requirements FR-036, FR-078. Priority M.

```gherkin
Scenario: Opt-out
  When I say "đừng gọi nữa"
  Then the assistant apologises and ends with outcome "Opted out"
  And my call consent is withdrawn and I am on the do-not-contact list, also after data reloads
  And the audit trail records the consent withdrawal against the call
```

## US-029 Run an automated campaign

As a campaign manager (PS-03), I want to launch assistant calls to the top hot leads, so that people only talk to interested customers. Requirement FR-038. Priority M.

```gherkin
Scenario: Eligible customers only
  Given 50 hot leads, of which 10 lack call consent, 2 are on the do-not-contact list and 5 are company-owned
  When I launch a campaign for tier "Hot" with a limit of 20
  Then at most 20 calls are made, none to the 17 ineligible customers
  And the result summarises outcomes such as hot handoff, link sent and already renewed

Scenario: Contact policy applies to campaigns (target behaviour)
  Given it is 21:00
  When I launch a campaign
  Then no calls are placed and the result explains "outside allowed contact hours"
```

## US-030 Rehearse a call

As a telesales supervisor (PS-02), I want to play the customer in a console session, so that I can check script changes before they go live. Requirement FR-037. Priority S.

```gherkin
Scenario: Console session
  Given I am allowed to operate the voice assistant
  When I start a session for a customer who is not on the do-not-contact list and type each turn
  Then I see the Vietnamese assistant lines with an English gloss for each turn
  And when the call ends the outcome and any handoff are shown

Scenario: DNC customer
  When I start a session for a customer on the do-not-contact list
  Then it is refused with "Customer is on the do-not-contact list"
```

## US-031 Govern the assistant

As a compliance officer (PS-05), I want assistant governance KPIs, so that I can show the regulator the assistant is safe. Requirements FR-039, FR-102. Priority S.

```gherkin
Scenario: Governance dashboard
  When I open the governance dashboard
  Then I see total calls, outcomes, the plate-verification failure rate, the opt-out rate and the disclosure statement
  And the result of the audit-chain verification
```

# EP-06 Telesales closing

## US-032 Receive a warm handoff

As a telesales agent (PS-01), I want a handoff with everything I need and nothing more, so that I can close in one call. Requirement FR-040. Priority M.

```gherkin
Scenario: Handoff content
  Given an assistant call ended with a hot handoff after the customer asked about price
  Then the handoff shows the plate, "plate verified by customer", masked phone, journey, expiry, premium and score
  And the talking points include "Call from the official VETC hotline", the regulated-price point and the customer's top benefits
  And the full phone number is visible only in Customer 360 to users allowed to see personal data
```

## US-033 Work my queue

As a telesales agent (PS-01), I want to claim, update and close handoffs, so that the team does not call the same customer twice. Requirements FR-041, FR-042, FR-093. Priority M.

```gherkin
Scenario: Claim
  Given an open, unassigned handoff
  When I claim it
  Then it is assigned to me

Scenario: Invalid transition
  Given a handoff with status "Won"
  When I try to set it back to "Open"
  Then the change is refused with "Cannot move handoff from won to open"

Scenario: Someone else's handoff
  Given a handoff assigned to another agent
  When I open it
  Then access is refused under the own-handoff policy
```

## US-034 Balance the team

As a telesales supervisor (PS-02), I want to assign handoffs, so that workload and skills are matched. Requirement FR-043. Priority M.

```gherkin
Scenario: Assign
  Given I am allowed to assign handoffs
  When I assign a handoff to agent "U-agent01"
  Then it is assigned and the audit trail records the update

Scenario: Agent cannot assign
  Given I am a telesales agent
  When I try to assign a handoff
  Then it is refused with "Missing permission handoff:assign"
```

## US-035 Close without taking payment by phone

As a telesales agent (PS-01), I want to build the right quote and send it to the customer's VETC app while on the call, so that the customer pays safely in the app. Requirements FR-045, FR-046, FR-047, FR-051, FR-077. Priority M.

```gherkin
Scenario: Quote on the call, pay in app
  Given the customer agrees to renew with passenger cover
  When I quote TNDS for a car with personal accident cover for 5 seats at VND 20,000,000 per seat, on the telesales channel
  Then the quote shows VND 480,700 + VND 100,000 = VND 580,700 and the Safe Drive bundle
  When I send the quote to the customer
  Then it reaches the customer's VETC app or Zalo as a service message
  And the customer sees it under quotes waiting for confirmation
  And I mark the handoff "Won" only after the customer pays in the VETC app

Scenario: Payment is customer-confirmed (target behaviour)
  Then staff have no way to take payment
  And only the customer can pay, in the app, with an idempotency key
```

# EP-07 Customer app: renew and self-service

## US-036 Open my renewal from a message

As a customer (PC-1), I want the link in my reminder to open my vehicle directly, so that I do not have to sign in or search. Requirements FR-074, FR-095. Priority M.

```gherkin
Scenario: Signed link
  Given a reminder link signed for my profile
  When the app opens it
  Then I get a one-hour session limited to my vehicle

Scenario: Tampered link
  When the signature does not match
  Then I see "Link invalid or expired"
```

## US-037 See my cover at a glance

As a customer (PC-1), I want a status card with my expiry, insurer and price, so that I know whether I need to act. Requirement FR-075. Priority M.

```gherkin
Scenario: Low confidence asks for confirmation
  Given my expiry confidence is 0.5
  When I open Home
  Then the cover card shows the expiry with a "Confirm my expiry" action
  And up to 3 approved benefits with reasons are shown
```

## US-038 Confirm my expiry

As a customer (PC-1), I want to confirm or correct my expiry date in the app, so that VETC reminds me at the right time. Requirement FR-076. Priority M.

```gherkin
Scenario: Declare expiry
  When I declare expiry 14/02/2027 with insurer "PTI"
  Then my expiry becomes 14/02/2027 from my declaration, and my journey and touchpoints are re-planned
```

## US-039 Renew in the app with my VETC wallet

As a customer (PC-1), I want to pay from my VETC wallet and get my certificate immediately, so that renewing takes under a minute. Requirements FR-046, FR-047, FR-049, FR-053, FR-056, FR-077. Priority M.

```gherkin
Scenario: Happy path
  Given my TNDS ends 30/11/2026 and my category is car under 6 seats
  When I ask for a TNDS quote
  Then cover starts 01/12/2026 and the total is VND 480,700 (VND 437,000 + VND 43,700 VAT)
  When I confirm with an idempotency key
  Then my wallet is debited once, a policy with a certificate number starting "TAS-" is issued and my journeys stop

Scenario: Double tap
  When the same purchase is retried with the same idempotency key
  Then the original order is returned and no second debit occurs
  And if the earlier attempt failed, reusing its key is refused (HTTP 409)

Scenario: Expired quote
  Given the quote was created more than 24 hours ago
  Then the purchase fails with "Quote expired — please re-quote"
```

## US-040 Prove I am insured

As a customer (PC-1), I want a QR on my e-certificate that anyone can scan, so that police or an inspection centre can check my cover. Requirements FR-027, FR-050. Priority M.

```gherkin
Scenario: Verification without PII
  Given my certificate "TAS-TNDSCA-2026-100123" is in force today
  When anyone opens its verification page
  Then they see "valid", the product, masked plate "30A-***.45", insurer "TASCO Insurance" and the start and end dates
  And no name or phone is shown

Scenario: Unknown certificate
  Then the page shows "not valid" with reason "not found"
```

## US-041 Buy for several years

As a customer (PC-1), I want to buy two or three years in line with my inspection cycle, so that I do not have to renew every year. Requirements FR-046, FR-053. Priority S.

```gherkin
Scenario: Multi-year
  When I ask for a TNDS quote for 3 years
  Then the premium equals the annual premium × (days in term ÷ 365) plus 10% VAT, and cover ends 3 years after it starts

Scenario: Out of range
  When I ask for 4 years
  Then the request is refused (1 to 3 years)
```

## US-042 Do not lose my money if issuance fails

As a customer (PC-1), I want an automatic refund if the certificate cannot be issued, so that I am never charged for nothing. Requirement FR-048. Priority M.

```gherkin
Scenario: Issuance failure after payment
  Given the wallet debit succeeded and TASCO core issuance fails
  Then any issued lines are cancelled, the payment is refunded in full, the order shows "issuance failed, refunded" and the failure is audited
```

## US-079 Renew in three steps when nothing has changed

As a customer renewing my TASCO cover (PC-1), I want to renew without going through the whole purchase again, so that renewal takes less than a minute. Requirements FR-119, FR-116, FR-077, FR-047. Priority S.

```gherkin
Scenario: Quick renewal is offered
  Given my TASCO TNDS policy is due for renewal and has no physical damage cover
  And I confirmed my vehicle use and seats within the last 365 days
  And my VETC wallet balance covers the premium
  When I open Home
  Then I see "Gia hạn nhanh", and "Tùy chỉnh gói bảo hiểm" for the full flow

Scenario: Renew in three steps
  When I tap "Gia hạn nhanh", tick the declaration and tap "Xác nhận thanh toán"
  Then my wallet is debited once and a TNDS policy is issued for the same term as my current one
  And Home no longer offers quick renewal because the vehicle is renewed

Scenario: Vehicle details not confirmed
  Given I have not confirmed my vehicle use and seats
  When I open Home
  Then quick renewal is not offered and the reason "Cần xác nhận thông tin xe" is shown
  And the full renewal flow is still available

Scenario: The server decides the cover
  Given I qualify for quick renewal
  When the app asks for a quick quote with physical damage cover added
  Then the quote contains TNDS only

Scenario: Switched off by the business
  Given an approved rule change switches quick renewal off
  When I open Home
  Then quick renewal is not offered and the full flow is shown
```

# EP-08 Value beyond discount and cross-sell

## US-043 See relevant benefits, not discounts

As a long-haul driver (PC-2), I want to see the benefits that matter to my driving, so that I see value in renewing through VETC. Requirements FR-058, FR-059. Priority M.

```gherkin
Scenario: Personalised ranking
  Given I drove 2,400 km on highways in 90 days and made 40 toll trips in 30 days
  Then "24/7 roadside assistance" ranks first with the reason "drives 2400 km on highways per quarter"

Scenario: Legal gating
  Given "VETC loyalty points" are pending legal review
  Then they never appear on my Home screen
  But staff see them, flagged, in Customer 360
```

## US-044 Protect my passengers in the same checkout

As a family car owner (PC-1, 7 seats), I want to add passenger accident cover, so that my family is protected, which TNDS does not do. Requirements FR-046, FR-055. Priority S.

```gherkin
Scenario: PA add-on
  When I quote TNDS with personal accident cover for 7 seats at VND 10,000,000
  Then the accident cover premium is VND 70,000 with no VAT
  And the "Protect your passengers" benefit explains that passengers are not covered by TNDS in a family-size vehicle
```

## US-045 Quote physical damage cover

As a new car buyer (PC-3), I want a physical damage quote in two taps, so that my new car is protected. Requirement FR-054. Priority S.

```gherkin
Scenario: PD rating
  Given my car is 2 years old, personal use
  When I quote physical damage cover with sum insured VND 700,000,000 and deductible VND 1,000,000
  Then the net premium is 700,000,000 × 1.5% × (1 − 10%) = VND 9,450,000 plus 10% VAT
  And payment is blocked until a vehicle inspection is recorded

Scenario: Referral above the online limit
  When the sum insured is VND 6,000,000,000
  Then the quote fails with "Sum insured exceeds the online limit — refer to underwriter"
```

## US-046 Offer the upgrade after purchase

As a campaign manager (PS-03), I want a cross-sell message the day after a TNDS-only purchase, so that we raise value per customer. Requirement FR-028. Priority S.

```gherkin
Scenario: Cross-sell scheduled
  Given a customer with marketing consent bought TNDS only
  When the issued policy is processed
  Then a cross-sell touchpoint is scheduled for tomorrow by app push or Zalo ZNS

Scenario: Already bought add-ons or no consent
  Given the order included personal accident cover, or the customer has not given marketing consent
  Then no cross-sell touchpoint is scheduled
```

## US-047 Offer loyalty and referral only when lawful

As a compliance officer (PS-05), I want loyalty and referral switched off until legal approves them, so that no unlawful inducement reaches customers. Requirement FR-060. Priority C.

```gherkin
Scenario: Referral disabled
  Given referral is switched off and pending legal review
  Then no referral offer appears in any customer channel
  When legal approves and a new referral version, switched on, is approved by a second user
  Then referral rewards are non-cash VETC points only, at most 5 referrals a month
```

## US-048 Never lapse with auto-renew (roadmap)

As a customer with wallet auto top-up (PC-2), I want to opt in to auto-renewal, so that I am never uninsured. Requirement FR-061. Priority S.

```gherkin
Scenario: Confirm-before-debit
  Given I opted in to auto-renew
  When my expiry is 7 days away
  Then I receive a confirmation request in the VETC app
  And my wallet is debited only after I confirm
  And if I do not confirm, no debit happens and normal reminders continue
```

Auto-renew is on the roadmap. The automated test checks the guarantee that holds today: staff cannot debit a customer's wallet.

# EP-09 Partner channel

## US-049 Onboard a partner

As a partner manager (PS-08), I want to onboard a bank or showroom and give it an API key, so that it can sell TASCO cover from its own systems. Requirements FR-063, FR-064, FR-095. Priority M.

```gherkin
Scenario: Onboard and issue key
  When I onboard "ABC Showroom", type "Car showroom", region "Hà Nội"
  Then an active partner "P-XXXXXXXX" exists
  When I issue an API key
  Then a key starting "tpk_" is shown once, only its hash and an 8-character prefix are stored, and the issue is audited
```

## US-050 Quote a brand-new car at the showroom

As showroom staff using the partner API (PS-09), I want to quote TNDS by plate at delivery, so that the customer drives away insured. Requirement FR-065. Priority M.

```gherkin
Scenario: Unknown plate becomes a new profile
  Given plate "51K-888.99" is not in the VETC base
  When I quote TNDS for a car with plate, holder name, phone, 5 seats, personal use and marketing consent
  Then a showroom partner record is ingested and a profile "51K88899" is created
  And a quote on the partner channel, tagged with my partner ID, is returned

Scenario: Product not sold on partner channel
  When I quote TNDS for a motorbike
  Then it fails with "TNDS_MOTORBIKE is not sold on channel partner_api"
```

## US-051 Bind safely

As a bank partner integration (PS-09), I want idempotent binding, so that network retries never create duplicate policies. Requirements FR-047, FR-066. Priority M.

```gherkin
Scenario: Own quote
  When I bind my own quote with an idempotency key
  Then the policy is issued and the order records my commission lines
  And no VETC wallet is debited; the payment reference starts "PARTNER-" because I collected the premium

Scenario: Another partner's quote
  When I bind a quote created by another partner
  Then I receive "Quote not found"
```

## US-052 See transparent commission

As a partner (PS-09), I want my commission statement for any period, so that reconciliation with TASCO is simple. Requirements FR-067, FR-068, FR-069. Priority M.

```gherkin
Scenario: Statement
  Given as a showroom I sold one TNDS car policy (net VND 437,000) and one personal accident policy (net VND 100,000)
  When I request my statement from 01/10/2026 to 31/10/2026
  Then it shows TNDS at 5% = VND 21,850 and personal accident at 15% = VND 15,000, total VND 36,850

Scenario: Cap enforced
  Given a draft commission rule sets the TNDS rate at 7%
  Then validation fails with "exceeds statutory cap 0.05 for TNDS_CAR"
```

## US-053 Suspend a partner

As a partner manager (PS-08), I want to suspend a partner at once, so that misuse stops immediately. Requirement FR-063. Priority M.

```gherkin
Scenario: Suspension blocks API access
  When I suspend a partner
  Then later calls with that partner's keys are rejected as unauthenticated
```

# EP-10 Fleet and B2B

## US-054 Route company vehicles to account management

As a fleet manager (PC-5), I want to deal with one account manager, not automated calls for each vehicle, so that renewal is managed for the whole fleet. Requirements FR-015, FR-038, FR-070. Priority S.

```gherkin
Scenario: Fleet routing
  Given a company-owned vehicle
  Then its next best action is "Route to fleet / B2B team"
  And assistant campaigns skip it

Scenario: No B2C journeys for fleet (target behaviour)
  Then company-owned vehicles are not enrolled in any consumer journey and have no touchpoints scheduled
```

## US-055 Fleet renewal dashboard (roadmap)

As a fleet manager (PC-5), I want one view of every vehicle's cover and one VAT invoice, so that my administration cost falls. Requirement FR-070. Priority S.

```gherkin
Scenario: Fleet view
  Given my company has 40 vehicles in the VETC base
  When I open the fleet dashboard
  Then I see each plate's cover status and expiry, soonest first
  And I can renew a selection in one order and receive one consolidated VAT invoice
```

The fleet dashboard is on the roadmap; this scenario is recorded as a manual roadmap test.

# EP-11 Claims first notice

## US-056 Report an accident from the app

As a customer (PC-1), I want to report an accident with photos and location, so that TASCO helps me quickly. Requirement FR-071. Priority S.

```gherkin
Scenario: Valid FNOL
  Given I hold policy "TAS-TNDSCA-2026-100123", in force from 01/01/2026 to 31/12/2026
  When I report an incident on 05/10/2026 with a description, location and 3 photos
  Then a claim "CL-XXXXXXXX" with status "Submitted" and an acknowledgement due 4 hours from now is created
  And I receive an acknowledgement message

Scenario: Outside policy period
  When the incident date is 01/02/2027
  Then the report fails with "Incident date is outside the policy period"

Scenario: Not my policy
  When I refer to another customer's policy
  Then I receive "Policy not found"
```

## US-057 Progress a claim

As a claims handler (PS-07), I want to move claims through clear statuses, so that customers and auditors see progress. Requirement FR-072. Priority S.

```gherkin
Scenario: Valid transition
  Given a claim with status "Submitted"
  When I set it to "Acknowledged" with a note
  Then its history records the change with my name and the audit trail records it

Scenario: Skipping steps
  When I try to set a "Submitted" claim to "Paid"
  Then it fails with "Cannot move claim from submitted to paid"
```

## US-058 Track my claim

As a customer (PC-1), I want to see my claim status, so that I do not have to call the hotline. Requirement FR-073. Priority S.

```gherkin
Scenario: My claims only
  When I open my claims
  Then only claims for my vehicle are listed, with current status and history
```

# EP-12 Privacy and consent

## US-059 Control how VETC contacts me

As a customer (PC-1), I want to switch marketing and call consent on or off, so that I decide how I am contacted. Requirement FR-078. Priority M.

```gherkin
Scenario: Withdraw call consent
  When I switch call consent off
  Then no assistant or telesales call is made to me
  And the change is audited and survives source reloads
```

## US-060 Download my data

As a customer (PC-1), I want to download what VETC and TASCO hold about me, so that I can exercise my right of access. Requirement FR-079. Priority M.

```gherkin
Scenario: Self-service export
  When I download my data
  Then I receive my profile, lead, policies, quotes, orders, claims, telesales tasks, messages, source records (without internal fields) and assistant sessions
  And the export is audited
```

## US-061 Erase personal data lawfully

As a compliance officer (PS-05), I want to anonymise a data subject's personal data, so that we honour erasure requests without breaking legal retention. Requirement FR-080. Priority M.

```gherkin
Scenario: Active policy blocks erasure
  Given the customer has a policy in force
  When I request erasure
  Then it fails with "Active policy in force — personal data must be retained until expiry (legal obligation)"

Scenario: Erasure
  Given no policy is in force
  When I erase the subject's data
  Then name and phone are removed, the subject is set to do-not-contact, the lead is deleted, message text reads "[erased]" and transcripts are emptied
  And personal data in handoffs, claim text and assistant signals is scrubbed, and the subject's sessions end
```

## US-062 See only what my role needs

As a campaign manager (PS-03) without permission to see personal data, I want masked names and phones in Customer 360, so that I can do my job without exposing personal data. Requirements FR-081, FR-097. Priority M.

```gherkin
Scenario: Masking
  Given I am not allowed to see personal data
  When I open a customer in Customer 360
  Then name and phone are masked
  And the view is audited as "personal data not visible"
```

## US-078 Answer a data request on time

As a compliance officer (PS-05), I want every request to see or erase personal data logged with a due time, so that TASCO can show that each request was answered lawfully and on time. Requirements FR-118, FR-079, FR-080, FR-097. Priority M.

```gherkin
Scenario: Log a request with its due time
  Given a customer phones the hotline at 09:00 on 08/10/2026 and asks for a copy of their data
  When I log an access request for plate "30A-123.45" on channel "Hotline"
  Then the request is "Received" and due at 09:00 on 11/10/2026, 72 hours later
  And the register shows the masked name and the plate only
  And the request is audited

Scenario: Identity is verified before data leaves TASCO
  Given an open access request whose requester's identity is not yet verified
  When I try to export the data
  Then the export is refused until I record that identity was verified
  When I record the verification and export
  Then a file named "TASCO-data-30A-123.45-2026-10-08.json" is downloaded and the request is "Completed"
  And its timeline shows received, in progress, identity verified and completed

Scenario: Erasure while a policy is in force
  Given an erasure request with identity verified from a customer whose policy is in force until 31/12/2026
  When I give a reason, type the plate and erase
  Then nothing is erased and the request is "Refused" with a reason that starts "Hợp đồng bảo hiểm còn hiệu lực đến 31/12/2026"

Scenario: Erasure needs a reason and the plate
  Given an erasure request with identity verified and no policy in force
  When I erase without a reason, or type a different plate
  Then the erasure is refused and nothing changes
  When I give a reason and type the plate
  Then the customer's personal data is anonymised and the request is "Completed" with the outcome "Erased"
  And no request for that customer shows a name any more

Scenario: The customer's own download is recorded
  Given a customer downloads their data in the app
  Then the register shows a completed access request on channel "App", logged by the customer

Scenario: Only compliance handles data requests
  Given I am signed in with a role other than compliance officer
  When I open the data-request register
  Then access is refused
```

# EP-13 Rule governance

## US-063 Change scoring without a release

As a rule author (PS-04), I want to edit scoring weights as a draft, so that the business can tune prioritisation itself. Requirements FR-057, FR-082, FR-083, FR-084. Priority M.

```gherkin
Scenario: Invalid weights rejected
  When I validate a lead scoring draft whose weights total 95
  Then the errors include "factor weights must sum to 100 (got 95)"

Scenario: Valid draft
  When I save a valid lead scoring draft
  Then version 2 of lead scoring is created as a draft with a checksum, and audited
```

## US-064 Simulate before I submit

As a rule author (PS-04), I want to see how a change affects a real customer, so that I avoid surprises. Requirement FR-085. Priority S.

```gherkin
Scenario: Current vs candidate
  When I simulate a next best action draft for a customer
  Then I see the current and candidate results: journey, score, tier, reasons, next best action and benefits
```

## US-065 Four-eyes approval

As a compliance approver (PS-05), I want to approve or reject rule changes made by others, so that no single person can change what customers experience. Requirement FR-086. Priority M.

```gherkin
Scenario: Self-approval forbidden
  Given "author" submitted lead scoring version 2
  When "author" tries to approve it
  Then it is refused with "Maker-checker: you cannot approve your own change"

Scenario: Approval activates and retires
  When "approver" approves it with the comment "OK per campaign review"
  Then version 2 is active and version 1 is retired, superseded by version 2
  And all servers use version 2 within 15 seconds
```

## US-066 Roll back quickly

As a rule author (PS-04), I want to roll back to an earlier version, so that a bad change can be reversed safely. Requirement FR-087. Priority M.

```gherkin
Scenario: Rollback is a governed change
  When I roll lead scoring back to version 1
  Then a new draft, version 3, with the content of version 1 is created
  And it needs submission and approval by another user
```

## US-067 Apply the copy guard to content changes

As a compliance approver (PS-05), I want message drafts with banned phrases to be impossible to save, so that I never need to catch them by eye. Requirements FR-024, FR-083. Priority M.

```gherkin
Scenario: Banned phrase in template
  When I create a message content draft containing "Giảm giá 10% khi gia hạn"
  Then the draft is rejected with a copy-guard error naming "giảm giá"
```

## US-068 Keep commission within the law

As a partner manager (PS-08), I want commission rules checked against statutory caps, so that we never overpay. Requirements FR-068, FR-083. Priority M.

```gherkin
Scenario: Cap
  When a commission draft sets personal accident cover at 25% against a cap of 20%
  Then validation fails
```

# EP-14 Identity, access and audit

## US-069 Strong sign-in for privileged roles

As a rule approver (PS-05), I want two-factor authentication on my account, so that approvals cannot be forged with a stolen password. Requirements FR-089, FR-090, FR-091. Priority M.

```gherkin
Scenario: Two-step login
  When I sign in with the correct username and password
  Then I am asked for a code, with 5 minutes to enter it
  When I enter a valid authenticator code
  Then I receive a 30-minute session that records both password and code

Scenario: Privileged role without MFA enrolment
  Given a new data steward account that has not enrolled
  When I sign in with the correct username and password
  Then I am shown an enrolment QR code, visible only to me
  And my first valid code completes enrolment; codes cannot be reused
```

## US-070 Lock out password guessing

As a security officer (PS-12), I want accounts locked after repeated failures, so that password guessing fails. Requirement FR-089. Priority M.

```gherkin
Scenario: Lockout
  When 5 wrong passwords are entered for "agent.hn"
  Then the 6th attempt within 15 minutes is refused as locked (HTTP 423), even with the right password
  And wrong authenticator codes count towards the same lockout
  And each failure is audited
```

## US-071 Manage users with separation of duties

As a platform admin (PS-12), I want to create users with roles and regions, so that access matches the job. Requirements FR-092, FR-094, FR-096. Priority M.

```gherkin
Scenario: Create agent
  When I create user "agent.dn", role telesales agent, region "Đà Nẵng", with a 14-character password
  Then the user exists and the creation is audited
  And the user must change the password at first sign-in

Scenario: Weak password
  When the password has fewer than 12 characters
  Then it is refused with "at least 12 characters"

Scenario: Admin cannot read PII or approve rules
  Given I am the admin
  When I open a customer or try to approve a rule
  Then access is refused
```

## US-072 Prove the audit trail is intact

As an internal auditor (PS-13), I want to verify the audit hash chain, so that I can attest that nothing was altered. Requirements FR-098, FR-099. Priority M.

```gherkin
Scenario: Verify
  When I verify the audit trail
  Then the result is "intact" with the number of entries and the latest hash

Scenario: Tampering detected
  Given the details of one audit entry were altered in the database
  Then verification reports "broken" at that entry with reason "hash mismatch"
```

# EP-15 Operations, insights and usability

## US-073 See growth and economics at a glance

As an executive (PS-10), I want a one-page dashboard of policies, premium, channels and cost, so that I can steer investment. Requirement FR-100. Priority M.

```gherkin
Scenario: Overview
  When I open the dashboard
  Then I see base size, vehicles expiring in 30 days, lapsed (up to 60 days), orders and premium by journey and channel, and active policies by product
  And the economics: assistant cost = calls × VND 1,500 × 1.6, telesales-equivalent cost = calls × VND 6,000 × 4.5, and the saving
```

## US-074 Keep integrations healthy

As a support engineer (PS-11), I want integration status and reconciliation on demand, so that I find and fix issues before customers notice. Requirements FR-052, FR-103, FR-104. Priority M.

```gherkin
Scenario: Status
  When I open Operations
  Then I see the circuit state of the VETC wallet, TASCO core, voice AI, app push, Zalo ZNS and SMS, the active rule versions with checksums and the event backlog

Scenario: Reconciliation
  When I run reconciliation
  Then a job run is recorded with the number checked and any mismatches (missing payment reference, missing policy, stuck for more than 1 hour)
```

## US-075 Apply data retention

As a compliance officer (PS-05), I want retention applied automatically, so that we do not keep personal data longer than needed. Requirement FR-105. Priority M.

```gherkin
Scenario: Retention job
  When the retention job runs
  Then source records older than 365 days and assistant sessions older than 180 days are deleted
  And the result lists the action and cut-off date for each data type
```

## US-076 Work in my language

As a telesales agent (PS-01), I want to switch the console between Vietnamese and English, so that I work comfortably and can share screens with English-speaking reviewers. Requirements FR-108, FR-110. Priority M.

```gherkin
Scenario: Language toggle
  When I switch to Vietnamese
  Then all labels, help text and dates (dd/mm/yyyy) appear in Vietnamese without reloading
  And my choice is remembered on this device
```

## US-077 Verify a certificate at the roadside

As a traffic police officer or inspection-centre clerk (external), I want to scan the QR and see validity at once, so that I can trust a digital certificate. Requirements FR-050, FR-109. Priority M.

```gherkin
Scenario: Scan
  When I scan the QR on the e-certificate
  Then the verification page shows valid or not valid, the product, masked plate, insurer and validity dates, in Vietnamese by default
  And it works on a basic mobile browser without signing in
```
