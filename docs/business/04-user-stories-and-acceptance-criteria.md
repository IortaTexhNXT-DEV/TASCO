# 04 — User Stories and Acceptance Criteria

**TASCO Insurance × VETC Motor Insurance Growth Platform** · iorta TechNXT · Version 1.0 · October 2026

## 0. Conventions

- **IDs.** Stories are `US-nnn`, epics are `EP-nn`, personas `PC-n` (customer) and `PS-nn` (staff), as defined in doc 06. FR IDs refer to doc 02.
- **Format.** *As a … I want … so that …*, followed by acceptance criteria in Gherkin (Given / When / Then). Thresholds quoted in criteria are the **current rule values** from `config/rules/*.json`. If the business changes a rule through maker-checker, the criteria follow the active rule, not the literal number.
- **Priority** uses MoSCoW, as in doc 02.
- **Gherkin background used throughout:** "today" is the platform clock (`SIM_TODAY` in UAT), the timezone is ICT (UTC+7), and the rule sets in `config/rules` are active at version 1.

### Epic overview

| Epic | Name | Track | Stories |
|---|---|---|---|
| EP-01 | Data foundation and repair | T2 | US-001 – US-006 |
| EP-02 | Lead prioritisation | T2 | US-007 – US-011 |
| EP-03 | Renewal journeys (TASCO book) | T3 | US-012 – US-016 |
| EP-04 | New-business journeys and moments of truth | NB | US-017 – US-022 |
| EP-05 | AI voice bot | T1 | US-023 – US-031 |
| EP-06 | Telesales closing | T1 | US-032 – US-035 |
| EP-07 | Customer app: renew and self-service | T3 | US-036 – US-042 |
| EP-08 | Value beyond discount and cross-sell | T4 | US-043 – US-048 |
| EP-09 | Partner channel | NB | US-049 – US-053 |
| EP-10 | Fleet / B2B | NB | US-054 – US-055 |
| EP-11 | Claims FNOL | T4 | US-056 – US-058 |
| EP-12 | Privacy and consent | PL | US-059 – US-062 |
| EP-13 | Rule governance | PL | US-063 – US-068 |
| EP-14 | Identity, access and audit | PL | US-069 – US-072 |
| EP-15 | Operations, insights and UX | PL | US-073 – US-077 |

---

## EP-01 Data foundation and repair

### US-001: Ingest a partner list into golden profiles
**As a** data steward (PS-06) **I want** to upload a partner or telesales list of vehicles **so that** duplicates merge into one profile per plate and bad records are quarantined.
**FR:** FR-001, FR-002, FR-003, FR-004, FR-011 · **Priority:** M

```gherkin
Scenario: Duplicate records for the same vehicle merge into one golden profile
  Given a VETC account record with plate "30a-123.45" and phone "+84912345678"
  And a partner_bank record with plate "30A 12345" and phone "0912 345 678"
  When I POST both records to /api/data/ingest with source "partner_bank"
  Then exactly one profile with id "30A12345" and plate "30A-123.45" exists
  And its phone is "0912345678"
  And its sources include "vetc_account" and "partner_bank"

Scenario: Invalid plate is rejected and raised as a DQ issue
  Given a record with plate "30-12345"
  When the batch is ingested
  Then the response reports rejected = 1
  And a DQ issue of type "invalid_plate" is open for that record id

Scenario: Batch size limit
  When I post a batch of 5,001 records
  Then the request is rejected with a validation error
```

### US-002: See how reliable an expiry date is
**As a** campaign manager (PS-03) **I want** each vehicle's expiry date to show its confidence and evidence **so that** I don't run sales journeys on guesses.
**FR:** FR-005, FR-008 · **Priority:** M

```gherkin
Scenario: Verified certificate wins
  Given a vehicle has a verified certificate expiring 2027-03-01 and an inspection-cycle estimate of 2027-03-10
  When the profile is built
  Then policy.expiryDate is "2027-03-01"
  And expiryMethod is "verified_certificate" with confidence 1.0

Scenario: Agreeing weak evidence is corroborated
  Given only an inspection-cycle estimate (0.5) and a tag-anniversary estimate (0.25) within 21 days of each other
  When the profile is built
  Then the chosen method is "inspection_cycle"
  And confidence is 0.65

Scenario: Lineage shows the evidence
  When I GET /api/customers/{id}/lineage
  Then I see a field entry "policy.expiryDate" with its source and confidence
```

### US-003: Correct an expiry with evidence
**As a** data steward (PS-06) **I want** to correct a vehicle's expiry and insurer when a customer sends proof **so that** reminders go out at the right time.
**FR:** FR-009, FR-097 · **Priority:** M

```gherkin
Scenario: Correction requires evidence and is audited
  Given I hold permission "profile:update"
  When I PATCH /api/customers/30A12345/expiry with expiryDate "2027-05-10", insurer "PVI" and evidence "photo of certificate via hotline"
  Then the profile expiry is "2027-05-10" with confidence 0.9
  And the audit trail contains "profile.expiry_corrected" with my user id and the evidence text
  And the lead is recomputed immediately

Scenario: Missing evidence
  When I omit "evidence"
  Then the request fails validation
```

### US-004: Work the data-quality queue
**As a** data steward (PS-06) **I want** a queue of data-quality issues by type **so that** I can fix the records that block revenue first.
**FR:** FR-007 · **Priority:** M

```gherkin
Scenario: Filter and resolve
  Given open DQ issues of types "reliable_expiry" and "conflicting_phone"
  When I GET /api/dq/issues?type=conflicting_phone
  Then only "conflicting_phone" issues are returned with a byType summary
  When I POST /api/dq/issues/{id}/resolve with resolution "confirmed primary number by call"
  Then the issue status is "resolved" with my id and timestamp
```

### US-005: Platform-captured facts survive source reloads
**As a** campaign manager (PS-03) **I want** customer confirmations and bot findings to persist when VETC reloads its source data **so that** we never forget what a customer told us.
**FR:** FR-010 · **Priority:** M

```gherkin
Scenario: Customer declaration beats a weaker reload
  Given a customer declared expiry "2027-01-15" (customer_declared, 0.8)
  When the nightly VETC batch re-ingests that plate with only a tag-anniversary estimate (0.25)
  Then the profile keeps expiry "2027-01-15" with method "customer_declared"

Scenario: Consent withdrawal survives reload
  Given the customer withdrew call consent in the consent centre
  When the source batch says callConsent = true
  Then the profile consent.call remains false
```

### US-006: Infer vehicle category and premium
**As a** campaign manager (PS-03) **I want** the platform to infer the TNDS category when seats are missing **so that** quotes and premiums are right.
**FR:** FR-006, FR-053 · **Priority:** M

```gherkin
Scenario: Declared seats beat toll class
  Given a vehicle with seatsDeclared 7 and tollClass 1, used personally
  Then its category is "car_6_11" with confidence 0.85
  And its lead premium is 873,400 VND incl. VAT for a 365-day term

Scenario: Toll class only
  Given a vehicle with tollClass 1 and no seats
  Then its category is "car_under6" with confidence 0.55 and a DQ issue "vehicle_category" is open
```

---

## EP-02 Lead prioritisation

### US-007: Call the right customer first
**As a** telesales agent (PS-01) **I want** a lead queue sorted by score with plain-language reasons **so that** I spend my time on the customers most likely to renew.
**FR:** FR-012, FR-014, FR-017 · **Priority:** M

```gherkin
Scenario: Score, tier and reasons
  Given a TASCO customer expiring in 10 days, expiry confidence 1.0, 8 app sessions, push enabled and call consent
  When leads are computed
  Then the score is between 0 and 100 and the tier is "hot" when score >= 70
  And reasons list each factor with points, max and a "why" such as "expires in 10 days"

Scenario: Do-not-contact zeroes the score
  Given the same customer is on DNC
  Then the score is 0 and the NBA is "suppress"

Scenario: Filtering
  When I GET /api/leads?tier=hot&maxDays=30&sort=score
  Then only hot leads with daysToExpiry <= 30 are returned in descending score order
```

### US-008: Know the next best action
**As a** campaign manager (PS-03) **I want** one recommended action per vehicle **so that** every contact is consistent and explainable.
**FR:** FR-015 · **Priority:** M

```gherkin
Scenario Outline: First matching NBA rule wins
  Given a lead with <facts>
  Then nextBestAction.action is "<action>"
  Examples:
    | facts                                               | action              |
    | consent.dnc = true                                  | suppress            |
    | ownerType = company                                 | route_b2b           |
    | expiryConfidence = 0.3                              | verify_expiry       |
    | journey = new_vehicle, confidence 0.8               | welcome_new_vehicle |
    | days = 60, confidence 0.8                           | nurture             |
    | journey = lapsed_uninsured                          | urgent_recovery     |
    | tier hot, consent.call, hasPhone, days 20           | voice_bot           |
    | tier warm, channels.app_push, days 20               | digital_reminder    |
    | phone only, days 20                                 | sms_reminder        |
    | no phone, no app, no Zalo, days 20                  | enrich              |
```

### US-009: See only my region
**As a** regional telesales agent (PS-01, region "Hà Nội") **I want** the queue limited to my region **so that** I only work customers I am allowed to see.
**FR:** FR-017, FR-093 · **Priority:** M

```gherkin
Scenario: Region scoping
  Given I am "agent.hn" with region "Hà Nội" and no dashboard:read permission
  When I GET /api/leads?region=TP. Hồ Chí Minh
  Then only leads with region "Hà Nội" are returned

Scenario: Profile outside region
  When I GET /api/customers/{id} for a profile in "TP. Hồ Chí Minh"
  Then the response is 403 with policy "regional_data"
```

### US-010: Stop selling to insured customers
**As a** customer (PC-1) **I want** reminders to stop as soon as I have renewed with TASCO **so that** I am not spammed.
**FR:** FR-019, FR-030 · **Priority:** M

```gherkin
Scenario: Purchase stops journeys
  Given I have scheduled renewal touchpoints
  When a TNDS policy is issued to me
  Then my lead has no journey and NBA "insured"
  And any scheduled touchpoint executed later is "cancelled" with reason "already insured with TASCO"
```

### US-011: Re-score after a rule change
**As a** campaign manager (PS-03) **I want** to re-score all leads on demand **so that** an approved scoring change takes effect immediately.
**FR:** FR-018 · **Priority:** S

```gherkin
Scenario: Recompute
  Given I hold "leads:recompute"
  When I POST /api/leads/recompute
  Then every non-anonymised profile is re-evaluated with the active rules
  And the audit trail has "leads.recomputed" with the count
  And leads whose journey or tier changed have their touchpoints re-planned
```

---

## EP-03 Renewal journeys (TASCO book)

### US-012: Timely renewal reminders
**As a** TASCO customer (PC-1) **I want** reminders before my TNDS ends, through the VETC app first **so that** I renew on time without effort.
**FR:** FR-020, FR-021, FR-022, FR-025, FR-029 · **Priority:** M

```gherkin
Scenario: Renewal cadence is planned from expiry
  Given my insurer is TASCO and my expiry is 60 days from today
  When my lead is computed
  Then touchpoints are planned at -45 (verify_expiry), -30 (first_reminder), -21 (value_reminder), -7 (urgent_reminder) and 0 (expiry_day)
  And a voice_bot step at -14 exists only if my tier is hot or warm
  And a telesales step at -3 exists only if my tier is hot

Scenario: App push first, then fallback
  Given a due first_reminder with channels app_push, zalo_zns, sms and I have push disabled but Zalo linked
  When the journey run executes
  Then the message is sent on zalo_zns, rendered in Vietnamese with my plate, expiry dd/mm/yyyy and a signed link
```

### US-013: Respect contact hours and caps
**As a** compliance officer (PS-05) **I want** marketing contacts limited by time and frequency **so that** we comply with anti-spam rules and keep customer trust.
**FR:** FR-023 · **Priority:** M

```gherkin
Scenario: Outside the contact window
  Given a due marketing touchpoint
  When the journey run executes at 21:15 ICT
  Then the touchpoint is "skipped" with reason "outside allowed contact hours"

Scenario: Weekly cap
  Given the customer received 3 marketing messages in the last 7 days
  When another marketing touchpoint is due
  Then it is skipped with reason "weekly contact cap reached"

Scenario: No marketing consent
  Given consent.marketing = false
  Then marketing messages are skipped with reason "no marketing consent"
```

### US-014: Never send discount language
**As a** compliance officer (PS-05) **I want** any customer message containing discount wording to be blocked **so that** we never breach the ban on premium discounts.
**FR:** FR-024 · **Priority:** M

```gherkin
Scenario: Send-time block
  Given a template rendered to text containing "giảm giá"
  When the journey engine sends it
  Then the message status is "blocked" with reason starting "copy guard:"
  And no provider call is made

Scenario: Diacritic-insensitive
  Given a text containing "giam gia"
  Then it is also blocked
```

### US-015: Service messages still reach the customer
**As a** customer (PC-1) **I want** the expiry-day notice even if I recently got marketing messages **so that** I know I am about to be uninsured.
**FR:** FR-023, FR-025 · **Priority:** M

```gherkin
Scenario: Service message bypasses caps but not DNC
  Given I received 3 marketing messages this week
  When the expiry_day step (marketing = false) is due
  Then it is sent
  But if I am on DNC it is skipped with reason "customer is on do-not-contact list"
```

### US-016: Escalate unresponsive hot customers to a human
**As a** telesales supervisor (PS-02) **I want** hot customers who ignore digital reminders to land in the telesales queue 3 days before expiry **so that** we don't lose the renewal.
**FR:** FR-044 · **Priority:** M

```gherkin
Scenario: Journey escalation
  Given a hot TASCO-renewal lead with call consent and no purchase
  When the -3 day telesales step runs
  Then a handoff with outcome "journey_escalation" is created with talking points
  And a message log entry "[telesales task HO-…]" is recorded
```

---

## EP-04 New-business journeys and moments of truth

### US-017: Recover uninsured vehicles
**As a** lapsed owner (PC-4) **I want** to be told clearly that my car may be uninsured, with an easy way to fix it **so that** I avoid fines and failed inspection.
**FR:** FR-013, FR-020, FR-022 · **Priority:** M

```gherkin
Scenario: Lapsed vehicle enters the recovery journey
  Given my expiry was 20 days ago with confidence 0.75
  When my lead is computed
  Then my journey is "lapsed_uninsured" and the NBA is "urgent_recovery"
  And a lapsed_notice (service) is planned for today on app_push, zalo_zns, sms
  And a voice_bot step is planned at +2 days if I am hot or warm, and telesales at +5 days if hot

Scenario: Lapsed too long is not assumed uninsured
  Given my expiry was 90 days ago
  Then I am not in "lapsed_uninsured" and the urgency reason says "likely renewed elsewhere"
```

### US-018: Welcome new cars
**As a** new car buyer (PC-3) **I want** VETC to help me store my insurance and remind me **so that** I never lapse.
**FR:** FR-013, FR-026 · **Priority:** M

```gherkin
Scenario: Tag activation triggers onboarding
  Given VETC emits "vetc.tag_activated" for my plate
  When POST /api/ecosystem/events is processed
  Then my lead is re-evaluated into journey "new_vehicle" (unless I am already a TASCO customer)
  And a welcome message (service) is planned at tag date +1, verify_expiry at +7 and value_reminder (marketing) at +14
```

### US-019: Win customers insured elsewhere
**As a** private car owner insured elsewhere (PC-1) **I want** a reason to renew via VETC that is not price **so that** switching is worth it.
**FR:** FR-016, FR-020, FR-025 · **Priority:** M

```gherkin
Scenario: Conquest copy is benefit-led and lawful
  Given my insurer is "PVI" and I expire in 30 days
  When first_reminder is due
  Then the "conquest_reminder" template is used with my top approved benefit (e.g. "cứu hộ giao thông 24/7")
  And the text contains no copy_guard phrase
  And a voice_bot step at -14 days is planned only if I am hot
```

### US-020: Inspection is a moment of truth
**As a** car owner (PC-1) booking an inspection (*đăng kiểm*) **I want** a check that my TNDS is valid **so that** I don't fail on the day.
**FR:** FR-026, FR-062 · **Priority:** S

```gherkin
Scenario: Inspection booked with expiry soon
  Given my TNDS expires in 40 days
  When "vetc.inspection_booked" is received
  Then an "inspection_tnds_check" service message is sent via app_push or zalo_zns

Scenario: Expiry far away
  Given my TNDS expires in 200 days
  Then the trigger result is "condition not met" and nothing is sent
```

### US-021: Remind when I am in the app with money
**As a** customer (PC-2) topping up my VETC wallet **I want** a renewal prompt at that moment **so that** I can pay in one tap.
**FR:** FR-026 · **Priority:** S

```gherkin
Scenario: Wallet top-up within ±30 days of expiry
  Given my expiry is in 12 days and I have marketing consent
  When "vetc.wallet_topped_up" is received between 08:00 and 20:00 ICT
  Then a first_reminder push is sent
  And if I already received 1 marketing contact today the result is "no permitted channel"
```

### US-022: Rehearse moments of truth
**As a** campaign manager (PS-03) **I want** to simulate VETC events from the console **so that** I can test triggers before the live event feed is connected.
**FR:** FR-026, FR-108 · **Priority:** S

```gherkin
Scenario: Simulator
  Given I hold "journeys:run"
  When I choose a customer and event type "vetc.long_trip_started" in the Journeys screen
  Then the console shows matched triggers and per-trigger results
  And the audit trail has "ecosystem.event_handled"
```

---

## EP-05 AI voice bot

### US-023: Know I am talking to a bot from VETC
**As a** customer (PC-1) **I want** the caller to say upfront that it is VETC's automated assistant and will never ask for OTPs or payment **so that** I can trust the call.
**FR:** FR-031 · **Priority:** M

```gherkin
Scenario: Opening line
  When a bot session starts
  Then the first bot line (key "intro") states it is VETC's automated assistant, the call is recorded, VETC never asks for OTP or payment by phone
  And it asks me to say my licence plate
  And it does not say my plate, name or expiry
```

### US-024: Prove it's really my car before discussing it
**As a** customer (PC-1) **I want** to be asked for my plate first **so that** my data is not disclosed to the wrong person.
**FR:** FR-032, FR-033 · **Priority:** M

```gherkin
Scenario: Spoken plate matches
  Given my plate is "30A-123.45"
  When I say "ba không A một hai ba bốn năm"
  Then the session is verified and the bot states my expiry using the masked plate "30A-***.45"

Scenario: Plate mismatch
  When I say "29A 999 99"
  Then the bot ends politely (line "plateMismatch") with outcome "plate_mismatch"
  And a DQ issue "plate_mismatch" is opened for the profile

Scenario: Plate not understood three times
  When I say three utterances with no recognisable plate
  Then the call ends with outcome "unverified"
```

### US-025: Honest answer about price
**As a** price-sensitive customer (PC-1) **I want** a straight answer about price **so that** I don't feel tricked.
**FR:** FR-035, FR-056 · **Priority:** M

```gherkin
Scenario: Price asked
  Given I am verified and my premium is 480,700 VND incl. VAT
  When I say "phí bao nhiêu tiền"
  Then the bot says TNDS premiums are set by regulation and identical at every insurer, states "480.700 đồng" incl. VAT
  And mentions one-tap renewal, instant e-certificate and 24/7 roadside assistance
  And the handoff (if any) flags priceAsked = true
```

### US-026: Handle "is this a scam?"
**As a** sceptical customer (PC-4) **I want** the bot to explain how I can verify it **so that** I don't hang up on a genuine service.
**FR:** FR-034 · **Priority:** M

```gherkin
Scenario: Scam concern at any point
  When I say "sao biết số tôi, lừa đảo à"
  Then the bot replies with the "trust" line and offers an in-app notice
  And signals.trustConcern = true is passed to telesales
```

### US-027: Tell the bot I already renewed
**As a** customer insured elsewhere (PC-1) **I want** to say I already renewed **so that** VETC stops calling me this year.
**FR:** FR-010, FR-036 · **Priority:** M

```gherkin
Scenario: Already renewed
  Given I am verified and my expiry on file is 2026-10-20
  When I say "tôi đã gia hạn rồi" and then "mua bên Bảo Việt, hết hạn tháng 9 năm sau"
  Then the outcome is "already_renewed"
  And my profile expiry becomes 2027-10-20 with method "voice_bot", confidence 0.6, insurer "OTHER" and a competitor note
  And my lead is recomputed
```

### US-028: Stop calling me
**As a** customer (PC-1) **I want** to opt out by voice **so that** I never get sales calls again.
**FR:** FR-036, FR-078 · **Priority:** M

```gherkin
Scenario: Opt-out
  When I say "đừng gọi nữa"
  Then the bot apologises and ends with outcome "opted_out"
  And my consent becomes call = false, dnc = true (persisting across reloads)
  And the audit trail has "consent.withdrawn" via the session id
```

### US-029: Run an automated campaign
**As a** campaign manager (PS-03) **I want** to launch bot calls to the top hot leads **so that** humans only talk to interested customers.
**FR:** FR-038 · **Priority:** M

```gherkin
Scenario: Eligible customers only
  Given 50 hot leads of which 10 lack call consent, 2 are DNC and 5 are company-owned
  When I POST /api/voice/campaign with tier "hot" and limit 20
  Then at most 20 calls are made, none to the 17 ineligible customers
  And the response summarises outcomes (e.g. hot_handoff, link_sent, already_renewed)

Scenario: Contact policy applies to campaigns (target behaviour)
  Given it is 21:00 ICT
  When I launch a campaign
  Then no calls are placed and the response explains "outside allowed contact hours"
  # Note: not enforced by the current campaign route — see doc 05 E-01
```

### US-030: Rehearse a call
**As a** telesales supervisor (PS-02) **I want** to play the customer in a console session **so that** I can QA script changes before activation.
**FR:** FR-037 · **Priority:** S

```gherkin
Scenario: Console session
  Given I hold "voice:operate"
  When I POST /api/voice/sessions for a non-DNC customer and send turns as text
  Then I see the Vietnamese bot lines with English gloss for each turn
  And when the call ends the outcome and any handoff id are shown

Scenario: DNC customer
  When I start a session for a DNC customer
  Then the request is refused with "Customer is on the do-not-contact list"
```

### US-031: Govern the bot
**As a** compliance officer (PS-05) **I want** bot governance KPIs **so that** I can show the regulator the bot is safe.
**FR:** FR-039, FR-102 · **Priority:** S

```gherkin
Scenario: Governance dashboard
  When I GET /api/dashboard/governance
  Then I see total calls, outcomes, plateVerificationFailureRate, optOutRate and the disclosure statement
  And the audit-chain verification result
```

---

## EP-06 Telesales closing

### US-032: Receive a warm handoff
**As a** telesales agent (PS-01) **I want** a handoff with everything I need and nothing more **so that** I can close in one call.
**FR:** FR-040 · **Priority:** M

```gherkin
Scenario: Handoff content
  Given a bot call ended with "hot_handoff" after the customer asked about price
  Then a handoff exists with plate, plateVerifiedByCustomer = true, masked phone, journey, expiry, premium and score
  And talking points include "Call from the official VETC hotline…", the regulated-price point and the customer's top benefits
  And the full phone number is visible only to users with profile:read_pii via Customer 360
```

### US-033: Work my queue
**As a** telesales agent (PS-01) **I want** to claim, update and close handoffs **so that** the team doesn't call the same customer twice.
**FR:** FR-041, FR-042, FR-093 · **Priority:** M

```gherkin
Scenario: Claim
  Given an open unassigned handoff
  When I PATCH it with status "claimed"
  Then it is assigned to me

Scenario: Invalid transition
  Given a handoff with status "won"
  When I PATCH status "open"
  Then the request fails with "Cannot move handoff from won to open"

Scenario: Someone else's handoff
  Given a handoff assigned to another agent
  When I GET it
  Then I receive 403 (policy agent_own_handoffs)
```

### US-034: Balance the team
**As a** telesales supervisor (PS-02) **I want** to assign handoffs **so that** workload and skills are matched.
**FR:** FR-043 · **Priority:** M

```gherkin
Scenario: Assign
  Given I hold "handoff:assign"
  When I PATCH a handoff with assignTo "U-agent01"
  Then it is assigned and the audit trail records "handoff.updated"

Scenario: Agent cannot assign
  Given I am a telesales agent
  When I PATCH with assignTo
  Then I receive 403 "Missing permission handoff:assign"
```

### US-035: Close without taking payment by phone
**As a** telesales agent (PS-01) **I want** to build the right quote and send the one-tap link while on the call **so that** the customer pays safely in the VETC app.
**FR:** FR-045, FR-046, FR-047, FR-051, FR-077 · **Priority:** M

```gherkin
Scenario: Quote on the call, pay in app
  Given the customer agrees to renew with passenger cover
  When I POST /api/quotes with TNDS_CAR and PA_SEAT (5 seats, 20,000,000 per seat), channel "telesales"
  Then the quote shows 480,700 + 100,000 = 580,700 VND and bundle "SAFE_DRIVE"
  And I mark the handoff "won" only after the customer confirms payment in the VETC app

Scenario: Payment is customer-confirmed (target behaviour)
  Then staff-initiated orders must not debit the wallet without in-app customer confirmation
  # See doc 05 E-22
```

---

## EP-07 Customer app: renew and self-service

### US-036: Open my renewal from a message
**As a** customer (PC-1) **I want** the link in my reminder to open my vehicle directly **so that** I don't have to log in or search.
**FR:** FR-074, FR-095 · **Priority:** M

```gherkin
Scenario: Signed link
  Given a reminder link containing r=<profileId>.<signature>
  When the app POSTs it to /api/customer/session
  Then a 1-hour customer token scoped to my profile is returned

Scenario: Tampered link
  When the signature does not match
  Then the response is 401 "Link invalid or expired"
```

### US-037: See my cover at a glance
**As a** customer (PC-1) **I want** a status card with my expiry, insurer and price **so that** I know whether I need to act.
**FR:** FR-075 · **Priority:** M

```gherkin
Scenario: Low confidence asks for confirmation
  Given my expiry confidence is 0.5
  When I open the home screen
  Then the cover card shows the expiry with needsConfirmation = true and a "Confirm my expiry" action
  And up to 3 approved benefits with reasons are shown
```

### US-038: Confirm my expiry
**As a** customer (PC-1) **I want** to confirm or correct my expiry date in the app **so that** VETC reminds me at the right time.
**FR:** FR-076 · **Priority:** M

```gherkin
Scenario: Declare expiry
  When I POST /api/customer/expiry with expiryDate "2027-02-14" and insurer "PTI"
  Then my profile expiry becomes "2027-02-14" (customer_declared) and my journey and touchpoints are re-planned
```

### US-039: Renew in one tap with my VETC wallet
**As a** customer (PC-1) **I want** to pay from my VETC wallet and get my certificate immediately **so that** renewing takes under a minute.
**FR:** FR-046, FR-047, FR-049, FR-053, FR-056, FR-077 · **Priority:** M

```gherkin
Scenario: Happy path
  Given my current TNDS ends 2026-11-30 and my category is car_under6
  When I request a TNDS_CAR quote
  Then the start date is 2026-12-01 and total is 480,700 VND (437,000 + 43,700 VAT)
  When I confirm with an Idempotency-Key
  Then my wallet is debited once, a policy with certificate number "TAS-…" is issued and my journeys stop

Scenario: Double tap
  When the same order request is retried with the same Idempotency-Key
  Then the original order is returned with idempotentReplay = true and no second debit occurs

Scenario: Expired quote
  Given the quote was created more than 24 hours ago
  Then purchase fails with "Quote expired — please re-quote"
```

### US-040: Prove I am insured
**As a** customer (PC-1) **I want** a QR on my e-certificate that anyone can scan **so that** police or an inspection centre can check my cover.
**FR:** FR-027, FR-050 · **Priority:** M

```gherkin
Scenario: Verification without PII
  Given my certificate "TAS-TNDSCA-2026-100123" is active today
  When anyone opens /verify/TAS-TNDSCA-2026-100123
  Then they see valid = true, product, masked plate "30A-***.45", insurer "TASCO Insurance", start and end date
  And no name or phone is shown

Scenario: Unknown certificate
  Then valid = false with reason "not_found"
```

### US-041: Buy for several years
**As a** customer (PC-1) **I want** to buy 2–3 years aligned with my inspection cycle **so that** I don't have to renew every year.
**FR:** FR-046, FR-053 · **Priority:** S

```gherkin
Scenario: Multi-year
  When I request a TNDS_CAR quote with termYears 3
  Then the premium equals annual × (days in term ÷ 365) with VAT 10%, and the end date is 3 years after start

Scenario: Out of range
  When I request termYears 4
  Then the request fails validation (1..3)
```

### US-042: Don't lose my money if issuance fails
**As a** customer (PC-1) **I want** an automatic refund if the certificate cannot be issued **so that** I'm never charged for nothing.
**FR:** FR-048 · **Priority:** M

```gherkin
Scenario: Issuance failure after payment
  Given the wallet debit succeeded and TASCO core issuance fails
  Then the payment is refunded, the order status is "issuance_failed_refunded" and "order.issuance_failed" is audited
```

---

## EP-08 Value beyond discount and cross-sell

### US-043: Relevant benefits, not discounts
**As a** long-haul driver (PC-2) **I want** to see the benefits that matter to my driving **so that** I see value in renewing via VETC.
**FR:** FR-058, FR-059 · **Priority:** M

```gherkin
Scenario: Personalised ranking
  Given I drove 2,400 km on highways in 90 days and made 40 toll trips in 30 days
  Then "24/7 roadside assistance" ranks first with why "drives 2400 km on highways per quarter"

Scenario: Legal gating
  Given "loyalty_points" has legalStatus "pending_legal_review"
  Then it is never returned by /api/customer/home
  But staff see it flagged in Customer 360
```

### US-044: Protect my passengers in the same checkout
**As a** family car owner (PC-1, 7 seats) **I want** to add passenger accident cover **so that** my family is protected, which TNDS does not do.
**FR:** FR-046, FR-055 · **Priority:** S

```gherkin
Scenario: PA add-on
  When I quote TNDS_CAR with PA_SEAT (7 seats × 10,000,000)
  Then the PA line premium is 70,000 VND with VAT 0
  And the benefit "upsell_pa_seat" explains "family-size vehicle — passengers are not covered by TNDS"
```

### US-045: Quote own-damage cover
**As a** new car buyer (PC-3) **I want** a physical-damage quote in two taps **so that** my new car is protected.
**FR:** FR-054 · **Priority:** S

```gherkin
Scenario: PD rating
  Given my car is 2 years old, personal use
  When I quote MOTOR_PD with sumInsured 700,000,000 and deductible 1,000,000
  Then net premium is 700,000,000 × 1.5% × (1 − 10%) = 9,450,000 VND plus 10% VAT

Scenario: Referral above the online limit
  When sumInsured is 6,000,000,000
  Then the quote fails with "Sum insured exceeds the online limit — refer to underwriter"
```

### US-046: Offer the upgrade after purchase
**As a** campaign manager (PS-03) **I want** a cross-sell message the day after a TNDS-only purchase **so that** we lift value per customer.
**FR:** FR-028 · **Priority:** S

```gherkin
Scenario: Cross-sell scheduled
  Given a customer with marketing consent bought TNDS only
  When policy.issued is processed
  Then a "cross_sell" touchpoint is scheduled for tomorrow on app_push/zalo_zns

Scenario: Already bought add-ons or no consent
  Given the order included PA_SEAT, or consent.marketing = false
  Then no cross_sell touchpoint is scheduled
```

### US-047: Loyalty and referral only when lawful
**As a** compliance officer (PS-05) **I want** loyalty and referral switched off until legal approves **so that** no unlawful inducement reaches customers.
**FR:** FR-060 · **Priority:** C

```gherkin
Scenario: Referral disabled
  Given referral.enabled = false and legalStatus "pending_legal_review"
  Then no referral offer appears in any customer channel
  When legal approves and a new referral version with enabled = true is approved by a second user
  Then referral rewards are non-cash VETC points only, max 5 referrals per month
```

### US-048: Never lapse with auto-renew (planned)
**As a** customer with wallet auto top-up (PC-2) **I want** to opt in to auto-renewal **so that** I am never uninsured.
**FR:** FR-061 · **Priority:** S

```gherkin
Scenario: Confirm-before-debit
  Given I opted in to auto-renew
  When my expiry is 7 days away
  Then I receive a confirmation request in the VETC app
  And my wallet is debited only after I confirm
  And if I do not confirm, no debit happens and normal reminders continue
```

---

## EP-09 Partner channel

### US-049: Onboard a partner
**As a** partner manager (PS-08) **I want** to onboard a bank or showroom and give them an API key **so that** they can sell TASCO cover from their own systems.
**FR:** FR-063, FR-064, FR-095 · **Priority:** M

```gherkin
Scenario: Onboard and issue key
  When I POST /api/partners with name "ABC Showroom", type "showroom", region "Hà Nội"
  Then a partner "P-XXXXXXXX" with status "active" exists
  When I POST /api/partners/{id}/keys
  Then a key starting "tpk_" is shown once, only its hash and an 8-character prefix are stored, and "partner.api_key_issued" is audited
```

### US-050: Quote a brand-new car at the showroom
**As a** showroom salesperson using the partner API (PS-09) **I want** to quote TNDS by plate at delivery **so that** the customer drives away insured.
**FR:** FR-065 · **Priority:** M

```gherkin
Scenario: Unknown plate becomes a new profile
  Given plate "51K-888.99" is not in the VETC base
  When I POST /api/partner/v1/quotes with plate, holderName, phone, seats 5, usage "personal", consentMarketing true and product TNDS_CAR
  Then a partner_showroom source record is ingested and a profile "51K88899" is created
  And a quote with channel "partner_api" and my partnerId is returned

Scenario: Product not sold on partner channel
  When I quote TNDS_MOTORBIKE
  Then the request fails with "TNDS_MOTORBIKE is not sold on channel partner_api"
```

### US-051: Bind safely
**As a** bank partner integration (PS-09) **I want** idempotent binding **so that** network retries never create duplicate policies.
**FR:** FR-047, FR-066 · **Priority:** M

```gherkin
Scenario: Own quote
  When I POST /api/partner/v1/orders with my quoteId and an Idempotency-Key
  Then the policy is issued and the order records my commission lines

Scenario: Another partner's quote
  When I bind a quote created by another partner
  Then I receive 404 "Quote not found"
```

### US-052: Transparent commission
**As a** partner (PS-09) **I want** my commission statement for any period **so that** reconciliation with TASCO is effortless.
**FR:** FR-067, FR-068, FR-069 · **Priority:** M

```gherkin
Scenario: Statement
  Given I sold one TNDS_CAR (net 437,000) and one PA_SEAT (net 100,000) as a showroom
  When I GET /api/partner/v1/statement?from=2026-10-01&to=2026-10-31
  Then lines show TNDS 5% = 21,850 and PA 15% = 15,000, total 36,850 VND

Scenario: Cap enforced
  Given a draft commission rule sets TNDS rate 0.07
  Then validation fails with "exceeds statutory cap 0.05 for TNDS_CAR"
```

### US-053: Suspend a partner
**As a** partner manager (PS-08) **I want** to suspend a partner instantly **so that** misuse stops immediately.
**FR:** FR-063 · **Priority:** M

```gherkin
Scenario: Suspension blocks API access
  When I PATCH /api/partners/{id} with status "suspended"
  Then subsequent calls with that partner's keys are rejected as unauthenticated
```

---

## EP-10 Fleet / B2B

### US-054: Route company vehicles to account management
**As a** fleet manager (PC-5) **I want** to deal with one account manager, not robocalls per vehicle **so that** renewal is managed for the whole fleet.
**FR:** FR-015, FR-038, FR-070 · **Priority:** S

```gherkin
Scenario: Fleet routing
  Given a profile with ownerType "company"
  Then its NBA is "route_b2b"
  And it is skipped by /api/voice/campaign

Scenario: No B2C journeys for fleet (target behaviour)
  Then company-owned vehicles are not enrolled in renewal or conquest B2C journeys
  # Not yet enforced by journeys.json audiences — see doc 05 E-07
```

### US-055: Fleet renewal dashboard (planned)
**As a** fleet manager (PC-5) **I want** one view of every vehicle's cover and one VAT invoice **so that** my admin cost drops.
**FR:** FR-070 · **Priority:** S

```gherkin
Scenario: Fleet view
  Given my company has 40 vehicles in the VETC base
  When I open the fleet dashboard
  Then I see each plate's cover status and expiry, sorted by soonest expiry
  And I can renew a selection in one order and receive one consolidated VAT invoice
```

---

## EP-11 Claims FNOL

### US-056: Report an accident from the app
**As a** customer (PC-1) **I want** to report an accident with photos and location **so that** TASCO helps me quickly.
**FR:** FR-071 · **Priority:** S

```gherkin
Scenario: Valid FNOL
  Given I hold active policy "TAS-TNDSCA-2026-100123" valid from 2026-01-01 to 2026-12-31
  When I POST /api/customer/claims with incidentDate "2026-10-05", description, location and photos 3
  Then a claim "CL-XXXXXXXX" with status "submitted" and slaDueAt = now + 4 hours is created

Scenario: Outside policy period
  When incidentDate is "2027-02-01"
  Then the request fails with "Incident date is outside the policy period"

Scenario: Not my policy
  When I reference another customer's policy
  Then I receive 404 "Policy not found"
```

### US-057: Progress a claim
**As a** claims handler (PS-07) **I want** to move claims through clear statuses **so that** customers and auditors see progress.
**FR:** FR-072 · **Priority:** S

```gherkin
Scenario: Valid transition
  Given claim status "submitted"
  When I PATCH status "acknowledged" with a note
  Then history records the transition with my id and "claim.status_changed" is audited

Scenario: Skipping steps
  When I PATCH a "submitted" claim to "paid"
  Then it fails with "Cannot move claim from submitted to paid"
```

### US-058: Track my claim
**As a** customer (PC-1) **I want** to see my claim status **so that** I don't have to call the hotline.
**FR:** FR-073 · **Priority:** S

```gherkin
Scenario: My claims only
  When I GET /api/customer/claims
  Then only claims for my profile are returned with current status and history
```

---

## EP-12 Privacy and consent

### US-059: Control how VETC contacts me
**As a** customer (PC-1) **I want** to switch marketing and call consent on or off **so that** I decide how I am contacted.
**FR:** FR-078 · **Priority:** M

```gherkin
Scenario: Withdraw call consent
  When I PUT /api/customer/consent with call = false
  Then no voice_bot or telesales contact is made to me
  And the change is audited as "consent.updated" and survives source reloads
```

### US-060: Download my data
**As a** customer (PC-1) **I want** to download what VETC/TASCO hold about me **so that** I can exercise my right of access.
**FR:** FR-079 · **Priority:** M

```gherkin
Scenario: Self-service export
  When I GET /api/customer/data-export
  Then I receive my profile, lead, policies, messages, source records (without internal hidden fields) and voice sessions
  And "dsar.access_exported" is audited
```

### US-061: Erase personal data lawfully
**As a** compliance officer (PS-05) **I want** to anonymise a data subject's personal data **so that** we honour erasure requests without breaking legal retention.
**FR:** FR-080 · **Priority:** M

```gherkin
Scenario: Active policy blocks erasure
  Given the customer has an active policy
  When I POST /api/dsar/{id}/erase
  Then it fails with "Active policy in force — personal data must be retained until expiry (legal obligation)"

Scenario: Erasure
  Given no active policy
  When I erase
  Then name and phone are removed, consent becomes dnc, the lead is deleted, message text is "[erased]", transcripts are emptied
  And PII in handoffs and claims is also scrubbed  # target — see doc 05 E-19
```

### US-062: See only what my role needs
**As a** campaign manager (PS-03) without PII permission **I want** masked names and phones in Customer 360 **so that** I can do my job without exposing personal data.
**FR:** FR-081, FR-097 · **Priority:** M

```gherkin
Scenario: Masking
  Given I lack "profile:read_pii"
  When I GET /api/customers/{id}
  Then name and phone are masked and piiMasked = true
  And "profile.viewed" is audited with piiVisible = false
```

---

## EP-13 Rule governance

### US-063: Change scoring without a release
**As a** rule author (PS-04) **I want** to edit scoring weights as a draft **so that** the business can tune prioritisation itself.
**FR:** FR-057, FR-082, FR-083, FR-084 · **Priority:** M

```gherkin
Scenario: Invalid weights rejected
  When I POST /api/rules/validate for kind "scoring" with weights summing to 95
  Then errors include "factor weights must sum to 100 (got 95)"

Scenario: Valid draft
  When I POST /api/rules with a valid scoring payload
  Then a version "scoring@2" with status "draft" and a checksum is created and audited
```

### US-064: Simulate before I submit
**As a** rule author (PS-04) **I want** to see how a change affects a real customer **so that** I avoid surprises.
**FR:** FR-085 · **Priority:** S

```gherkin
Scenario: Current vs candidate
  When I POST /api/rules/simulate with profileId, kind "nba" and a candidate payload
  Then the response contains "current" and "candidate" evaluations (journey, score, tier, reasons, nextBestAction, benefits)
```

### US-065: Four-eyes approval
**As a** compliance approver (PS-05) **I want** to approve or reject rule changes made by others **so that** no single person can change customer-facing behaviour.
**FR:** FR-086 · **Priority:** M

```gherkin
Scenario: Self-approval forbidden
  Given "author" submitted "scoring@2"
  When "author" tries to approve it
  Then the response is 403 "Maker-checker: you cannot approve your own change"

Scenario: Approval activates and retires
  When "approver" approves with comment "OK per campaign review"
  Then "scoring@2" is active, "scoring@1" is retired with supersededBy "scoring@2"
  And all replicas use the new version within 15 seconds
```

### US-066: Roll back quickly
**As a** rule author (PS-04) **I want** to roll back to an earlier version **so that** a bad change can be reversed safely.
**FR:** FR-087 · **Priority:** M

```gherkin
Scenario: Rollback is a governed change
  When I POST /api/rules/scoring@1/rollback
  Then a new draft "scoring@3" with the payload of scoring@1 is created
  And it requires submission and approval by another user
```

### US-067: Copy guard on content changes
**As a** compliance approver (PS-05) **I want** content drafts with banned phrases to be impossible to save **so that** I never need to catch them by eye.
**FR:** FR-024, FR-083 · **Priority:** M

```gherkin
Scenario: Banned phrase in template
  When I create a "content.messages" draft containing "Giảm giá 10% khi gia hạn"
  Then the draft is rejected with a copy guard error naming "giảm giá"
```

### US-068: Commission within the law
**As a** partner manager (PS-08) **I want** commission rules validated against statutory caps **so that** we never overpay.
**FR:** FR-068, FR-083 · **Priority:** M

```gherkin
Scenario: Cap
  When a commission draft sets PA_SEAT rate 0.25 with cap 0.2
  Then validation fails
```

---

## EP-14 Identity, access and audit

### US-069: Strong sign-in for privileged roles
**As a** rule approver (PS-05) **I want** MFA on my account **so that** approvals cannot be forged with a stolen password.
**FR:** FR-089, FR-090, FR-091 · **Priority:** M

```gherkin
Scenario: Two-step login
  When I POST /api/auth/login with correct credentials
  Then I receive mfaRequired = true and a 5-minute mfaToken
  When I POST /api/auth/mfa with a valid TOTP code
  Then I receive a 30-minute access token with amr ["pwd","otp"]

Scenario: Privileged role without MFA enrolment
  Given a data_steward account with no TOTP secret
  Then login fails with "MFA enrolment required for your role"
```

### US-070: Lock out brute force
**As a** security officer (PS-12) **I want** accounts locked after repeated failures **so that** password guessing fails.
**FR:** FR-089 · **Priority:** M

```gherkin
Scenario: Lockout
  When 5 wrong passwords are submitted for "agent.hn"
  Then the 6th attempt within 15 minutes returns "locked" even with the right password
  And each failure is audited as "auth.login_failed"
```

### US-071: Manage users with segregation of duties
**As a** platform admin (PS-12) **I want** to create users with roles and regions **so that** access matches the job.
**FR:** FR-092, FR-094, FR-096 · **Priority:** M

```gherkin
Scenario: Create agent
  When I POST /api/users with username "agent.dn", roles ["telesales_agent"], region "Đà Nẵng" and a 14-character password
  Then the user exists and "user.created" is audited

Scenario: Weak password
  When the password has 8 characters
  Then validation fails with "at least 12 characters"

Scenario: Admin cannot read PII or approve rules
  Given I am admin
  When I GET /api/customers/{id} or approve a rule
  Then I receive 403
```

### US-072: Prove the audit trail is intact
**As an** internal auditor (PS-13) **I want** to verify the audit hash chain **so that** I can attest nothing was altered.
**FR:** FR-098, FR-099 · **Priority:** M

```gherkin
Scenario: Verify
  When I GET /api/audit/verify
  Then the result is ok = true with the number of entries and the head hash

Scenario: Tampering detected
  Given an audit entry's details were altered in the database
  Then verify returns ok = false with brokenAt = <index> and reason "hash mismatch"
```

---

## EP-15 Operations, insights and UX

### US-073: See growth and economics at a glance
**As an** executive (PS-10) **I want** a one-page dashboard of policies, premium, channels and cost **so that** I can steer investment.
**FR:** FR-100 · **Priority:** M

```gherkin
Scenario: Overview
  When I GET /api/dashboard/overview
  Then I see base size, expiring in 30 days, lapsed (≤ 60 days), orders and premium by journey and channel, active policies by product
  And economics: voice bot cost = calls × 1,500 × 1.6, telesales-equivalent = calls × 6,000 × 4.5, and the saving
```

### US-074: Keep integrations healthy
**As a** support engineer (PS-11) **I want** integration status and reconciliation on demand **so that** I can find and fix issues before customers notice.
**FR:** FR-052, FR-103, FR-104 · **Priority:** M

```gherkin
Scenario: Status
  When I GET /api/ops/status
  Then I see circuit state for vetc-wallet, tasco-core, voice-ai, app-push, zalo-zns and sms, active rule versions with checksums and the event backlog

Scenario: Reconciliation
  When I POST /api/ops/jobs/reconciliation
  Then a job run is recorded with checked count and any mismatches (missing payment ref, missing policy, stuck > 1h)
```

### US-075: Apply data retention
**As a** compliance officer (PS-05) **I want** retention applied automatically **so that** we don't keep personal data longer than needed.
**FR:** FR-105 · **Priority:** M

```gherkin
Scenario: Retention job
  When the retention job runs
  Then source records older than 365 days and voice sessions older than 180 days are deleted
  And the job result lists each entity's action and cutoff date
```

### US-076: Work in my language
**As a** telesales agent (PS-01) **I want** to switch the console between Vietnamese and English **so that** I work comfortably and can share screens with English-speaking reviewers.
**FR:** FR-108, FR-110 · **Priority:** M

```gherkin
Scenario: Language toggle
  When I switch to "VI"
  Then all labels, help text and dates (dd/mm/yyyy) appear in Vietnamese without reloading
  And my choice is remembered on this device
```

### US-077: Verify a certificate at the roadside
**As a** traffic police officer or inspection-centre clerk (external) **I want** to scan the QR and see validity instantly **so that** I can trust a digital certificate.
**FR:** FR-050, FR-109 · **Priority:** M

```gherkin
Scenario: Scan
  When I scan the QR on the e-certificate
  Then /verify/{certNo} shows VALID or NOT VALID, product, masked plate, insurer and validity dates, in Vietnamese by default
  And the page works on a basic mobile browser without login
```
