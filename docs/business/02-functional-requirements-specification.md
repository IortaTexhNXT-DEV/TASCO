# 02 — Functional Requirements Specification (FRS)

**TASCO Insurance × VETC Motor Insurance Growth Platform** · iorta TechNXT · Version 1.0 · October 2026

## 0. Conventions

| Item | Convention |
|---|---|
| **ID** | `FR-nnn`. IDs are stable and referenced by docs 04 (user stories) and 05 (traceability). |
| **Priority** | MoSCoW: **M** = Must for MVP, **S** = Should (MVP if capacity allows, else Phase 2), **C** = Could (Phase 2+), **W** = Won't in this release (recorded for scope clarity). |
| **Track** | **T1** AI voice bot · **T2** Lead scoring and enrichment · **T3** Renewal engine · **T4** Value beyond discount · **NB** New-business scope extension requested by the client · **PL** Platform, governance and compliance. |
| **Rule kind** | Business configuration that governs the behaviour. Rule kinds live in `config/rules/<kind>.json` and are changed only through the maker-checker workflow (FR-082 – FR-088). `rbac` lives in `config/security/rbac.json` and is changed through code review. |
| **Status** | Build status at the time of writing (codebase at `/src`). **Built** = implemented with API · **Partial** = implemented with a gap noted · **Planned** = UI or integration in progress, or not yet built. |
| **Actors** | Roles as in `config/security/rbac.json`: `admin`, `executive`, `campaign_manager`, `telesales_agent`, `telesales_supervisor`, `rule_author`, `rule_approver`, `compliance_officer`, `data_steward`, `claims_handler`, `partner_manager`, `auditor`, `support_engineer`, `customer`, `partner_api`. |

**Capability map**

| # | Capability | FR range |
|---|---|---|
| A | Data and master data management (MDM) | FR-001 – FR-011 |
| B | Lead intelligence | FR-012 – FR-019 |
| C | Journeys and messaging | FR-020 – FR-030 |
| D | AI voice bot | FR-031 – FR-039 |
| E | Telesales | FR-040 – FR-044 |
| F | Sales and issuance | FR-045 – FR-052 |
| G | Products and rating | FR-053 – FR-057 |
| H | Value and benefits | FR-058 – FR-062 |
| I | Partners and fleet | FR-063 – FR-070 |
| J | Claims FNOL | FR-071 – FR-073 |
| K | Customer self-service and privacy | FR-074 – FR-081 |
| L | Rules governance | FR-082 – FR-088 |
| M | Identity and access | FR-089 – FR-096 |
| N | Audit | FR-097 – FR-099 |
| O | Operations, reporting and user interfaces | FR-100 – FR-110 |

---

## A. Data and master data management (MDM)

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-001** | **Batch ingestion.** The system shall accept batches of up to 5,000 source records from an authorised user (`data:ingest`) or partner channel. Each batch is tagged with a batch ID, source name and lineage entry. Only allow-listed fields are kept: `recordId, source, plateRaw, phoneRaw, fullName, tollClass, seatsDeclared, usageDeclared, ownerType, tagActivatedAt, policy, lastInspectionDate, declaredExpiry, partnerId, firstRegisteredYear`. | `recordId` is mandatory. Unknown fields are dropped. PII fields are encrypted at rest. | M | T2 | Built |
| **FR-002** | **Licence plate normalisation.** The system shall normalise Vietnamese plates from dirty formats (for example `30a-123.45`, `30A 12345`) to a canonical key (`30A12345`) and display form (`30A-123.45`), and derive the province from the 2-digit code. Invalid plates are rejected and raise a DQ issue `invalid_plate`. | Format: 2-digit province + 1–2 letter series + 4–5 digits; province must be known. | M | T2 | Partial: motorbike formats not accepted (doc 05 E-03) |
| **FR-003** | **Phone normalisation.** The system shall normalise Vietnamese mobile numbers (`+84…`, `84…`, missing leading 0, spaces) to `0XXXXXXXXX` and E.164. Invalid numbers are ignored for survivorship. | Prefixes 03/05/07/08/09, 10 digits. | M | T2 | Built |
| **FR-004** | **Golden profile per vehicle.** The system shall merge all records for the same plate into one golden profile. Name and phone are chosen by **source trust** (survivorship). Alternative phones are retained. Source list and record IDs are kept. | `enrichment.sourceTrust` (e.g. `tasco_core` 1.0, `vetc_account` 0.85, `partner_agent` 0.5, `telesales_csv` 0.4). | M | T2 | Built |
| **FR-005** | **Expiry inference with confidence.** The system shall infer the current TNDS expiry from available evidence: verified certificate, partner policy record, customer declaration, inspection cycle (+365 days) or tag anniversary. Dates are rolled forward a year at a time until within 60 days of today. The best evidence is picked, and confidence is boosted when independent methods agree within 21 days. All candidates are kept. | `enrichment.expiryEvidence`, `corroboration` (+0.15 per agreement, cap 0.95), `rollForwardFloorDays` 60, `usableExpiryConfidence` 0.5. | M | T2 | Built |
| **FR-006** | **Vehicle category inference.** The system shall infer the tariff category (11 car categories) from declared seats, usage, owner type and toll class using a first-hit decision table, and record its confidence and basis. | `enrichment.categoryTable`; default `car_under6` at 0.3. | M | T2 | Built |
| **FR-007** | **Data-quality scoring and issue queue.** The system shall compute a DQ score (0–100) per profile and raise issues for missing `phone`, `name`, `reliable_expiry`, `vehicle_category` and `current_insurer`, and for `conflicting_phone`. Bot outcomes add `wrong_person` and `plate_mismatch`; ingestion adds `invalid_plate`. Data stewards list issues by type and status and resolve them with a written resolution. | `enrichment.dataQuality` weights 0.5 / 0.35 / 0.15; `categoryMinConfidence` 0.6. | M | T2 | Built |
| **FR-008** | **Field-level lineage.** For any profile, authorised staff shall see the source, confidence and rule behind each derived field (phone, name, category, expiry), the contributing record IDs and sources, and recent ingestion batches. | — | S | T2 | Built |
| **FR-009** | **Steward expiry correction.** A data steward (`profile:update`) shall be able to set expiry date and insurer with **mandatory evidence text**. The change is audited and the lead is recomputed immediately. | Correction confidence 0.9 (hardcoded; see E-05). | M | T2 | Built |
| **FR-010** | **Data-repair loop.** Facts captured on the platform shall update the golden profile and survive later source rebuilds when they carry higher confidence: customer-declared expiry, bot-captured "already renewed" (next expiry and competitor note), TASCO issuance (confidence 1.0, method `tasco_issued`) and consent changes. | Methods that survive rebuilds: `customer_declared`, `voice_bot`, `tasco_issued`; `consentOverrides`. | M | T2 | Built |
| **FR-011** | **Incremental rebuild.** Ingestion shall rebuild only the profiles whose plates appear in the batch (chunks of 500 plates), then emit `profiles.rebuilt` so that only the affected leads are re-scored. | Event-driven via the outbox. | M | T2 | Built |

## B. Lead intelligence

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-012** | **Fact model.** The system shall derive a standard fact set for every vehicle and use it consistently across all rule kinds: days to expiry, lapsed days, expiry confidence and method, insurer, tag age, owner type, region, category, seats, usage, vehicle age, reachability channels, consent, premium and engagement metrics. | `src/domain/leads.js#factsFor` | M | T2 | Built |
| **FR-013** | **Journey assignment.** Each vehicle shall be placed in the **first** journey (by priority) whose audience expression is true: `lapsed_uninsured` (1), `new_vehicle` (2), `renewal` (3), `conquest` (4). | `journeys` | M | T3 / NB | Built |
| **FR-014** | **Explainable lead score.** The system shall compute a 0–100 score as the weighted sum of five factors (urgency 35, data confidence 15, engagement 20, reachability 15, relationship 15). The score is damped by expiry confidence (×(0.6 + 0.4 × confidence)) and set to zero when the customer is on DNC. Tiers: **hot ≥ 70**, **warm ≥ 45**, else nurture. Each factor shows points, maximum and a plain-language reason. | `scoring` (weights must sum to 100; hot > warm, enforced by the validator) | M | T2 | Built |
| **FR-015** | **Next-best action (NBA).** The system shall choose one action per vehicle using a first-hit decision table: `suppress` (DNC), `route_b2b` (company), `verify_expiry` (confidence < 0.5), `welcome_new_vehicle`, `nurture` (> 45 days), `urgent_recovery` (lapsed), `voice_bot` (hot + call consent + phone), `digital_reminder`, `sms_reminder`, default `enrich`. Each action has a label and a reason. | `nba` | M | T2 | Built |
| **FR-016** | **Personalised benefits per lead.** The system shall rank eligible benefits by relevance and attach the top 3 (with a "why" text) to each lead. | `benefits` (`maxShown` 3) | M | T4 | Built |
| **FR-017** | **Prioritised lead queue.** Staff with `leads:read` shall list leads filtered by tier, journey, action, region, maximum days to expiry and minimum score, sorted by score or expiry, with pagination (≤ 500 per page). Users without `dashboard:read` and with a specific region see only their region. | ABAC `regional_data` | M | T2 | Built |
| **FR-018** | **Recompute.** Leads shall be recomputed (a) on demand by a campaign manager (`leads:recompute`), (b) on events (`profiles.rebuilt`, `lead.recompute_requested`, `policy.issued`) and (c) by a scheduled job (`npm run job recompute`). If the journey or tier changes, scheduled touchpoints are re-planned. | — | M | T2 | Built |
| **FR-019** | **Insured suppression.** A vehicle with an active TASCO TNDS policy beyond today shall have no journey and the NBA `insured`. All its scheduled touchpoints are cancelled at execution time. | — | M | T3 | Built |

## C. Journeys and messaging

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-020** | **Journey catalogue.** The system shall support configurable journeys, each with objective (`retention`, `new_business`, `cross_sell`), audience, anchor (`expiry`, `tagActivatedAt`, `today`) and timed steps (offset, channels, marketing flag, template, optional tier gate). It ships with: `lapsed_uninsured`, `new_vehicle`, `renewal`, `conquest` and post-purchase `cross_sell`. | `journeys` (validator: unique IDs, valid anchor, channels required) | M | T3 / NB | Built |
| **FR-021** | **Touchpoint planning.** For each lead the system shall plan touchpoints from the journey's steps relative to the anchor date. Steps more than `catchUpDays` (2) in the past are skipped, and tier-gated steps are omitted for other tiers. Touchpoint IDs are deterministic (`profile:journey:step:date`) so planning can safely be repeated. | `journeys.catchUpDays`, `onlyTiers` | M | T3 | Built |
| **FR-022** | **Execute due touchpoints.** On a schedule or on demand (`journeys:run`), the system shall execute every touchpoint due up to a given date. For each one it tries the step's channels in order and records the outcome (`done`, `skipped` with reasons, `cancelled`) and per-channel and per-journey totals. A `voice_bot` step starts an automated call; a `telesales` step creates a handoff task. | — | M | T3 | Built |
| **FR-023** | **Contact policy gate.** Every outbound contact shall pass a policy check before sending: channel reachable; not DNC; consent present (`marketing` for marketing; `call` for voice bot and telesales); marketing only between **08:00 and 20:00 ICT**; at most **1 marketing contact per day** and **3 per week**; at most **2 call attempts per week**. Service messages bypass the frequency caps. | `contact_policy` | M | PL | Built (journeys and triggers). Gap: campaign route (E-01) |
| **FR-024** | **Copy guard.** Customer copy shall never contain banned discount or rebate phrases. The check runs (a) when content, benefit or voice-bot rule sets are saved, which blocks the draft, and (b) at send time, where the message is recorded as `blocked` and not sent. Matching ignores diacritics. | `copy_guard` | M | T4 / PL | Built |
| **FR-025** | **Templated bilingual messages.** Messages shall be rendered from templates per key with Vietnamese for customers and English for staff review. Placeholders: `{{plate}}`, `{{expiry}}` (dd/mm/yyyy), `{{days}}`, `{{premium}}`, `{{benefit}}` (top benefit), `{{link}}` (signed renewal deep link), `{{certNo}}`. | `content.messages` (11 templates) | M | T3 | Built |
| **FR-026** | **Moments of truth (ecosystem triggers).** The system shall accept VETC events `vetc.tag_activated`, `vetc.inspection_booked`, `vetc.wallet_topped_up` and `vetc.long_trip_started`. Matching triggers either enrol the vehicle in a journey or send a templated message immediately, subject to the trigger condition and the contact policy. | `triggers` | S | NB / T3 | Built (API and simulator); live VETC event feed Planned |
| **FR-027** | **Purchase confirmation.** After issuance the system shall send a service message (`purchase_confirmation`) with certificate number, plate, expiry and a verification link, using the first available channel of app push or Zalo. | `content.messages` | M | T3 | Built |
| **FR-028** | **Post-purchase cross-sell.** After a TNDS-only purchase by a customer with marketing consent, the system shall schedule the `cross_sell` step (+1 day) via push or Zalo, highlighting cover the customer does not yet hold. | `journeys.crossSell` | S | NB / T4 | Built |
| **FR-029** | **Touchpoint schedule view.** Staff shall list touchpoints by profile and status (`scheduled`, `done`, `skipped`, `cancelled`). | — | S | T3 | Built |
| **FR-030** | **Journey integrity.** A touchpoint shall be cancelled when the profile is missing or anonymised, when the vehicle is already insured with TASCO, or when the lead's journey has changed since planning. | — | M | T3 | Built |

## D. AI voice bot

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-031** | **Disclosure.** Every call shall open by saying that this is VETC's **automated assistant**, that the call is recorded, and that VETC never asks for OTPs or payment by phone. It then asks for the licence plate. | `content.voicebot` → `disclosure`, `lines.intro` | M | T1 | Built |
| **FR-032** | **Plate-first verification.** The bot shall extract the plate from the customer's speech (Vietnamese and English spoken digits supported) and compare it with the record. The bot never reads the plate out. No plate recognised → retry (maximum 3 attempts) → outcome `unverified`. Mismatch → polite end with outcome `plate_mismatch`, and a DQ issue is raised. | `content.voicebot.maxPlateAttempts` | M | T1 | Built |
| **FR-033** | **Expiry confirmation.** After verification the bot shall state the expiry on file using the **masked** plate. Three variants: known (confidence ≥ 0.5), lapsed or unknown ("which month does it end?"). The customer's answer is captured as a signal. | Lines `expiryKnown`, `expiryLapsed`, `expiryUnknown` | M | T1 / T2 | Built |
| **FR-034** | **Intent recognition.** The bot shall classify each utterance into one of 12 intents: `opt_out`, `scam_concern`, `human`, `already_renewed`, `price`, `callback_later`, `send_link`, `buy_now`, `wrong_person`, `benefits`, `yes`, `no`. It uses accent-insensitive keyword matching, and an LLM or NLU classifier can be plugged in through the same interface. | `content.voicebot.intents` | M | T1 | Built (keyword); vendor NLU Planned |
| **FR-035** | **Price honesty and value pivot.** When asked about price, the bot shall state that TNDS premiums are set by regulation and identical at every insurer, give the customer's premium including VAT, and pivot to service value. It never offers a discount. | Line `price`; `copy_guard` | M | T1 / T4 | Built |
| **FR-036** | **Call outcomes and write-back.** Each call shall end in exactly one outcome, with an action for each:<br>• `hot_handoff` → telesales handoff<br>• `link_sent` → renewal link sent as a service message via app, Zalo or SMS<br>• `already_renewed` → next expiry = previous + 365 days at confidence 0.6; insurer `OTHER`; competitor note<br>• `opted_out` → DNC and call consent withdrawn, audited<br>• `wrong_person` / `plate_mismatch` → DQ issue<br>• `callback_later`, `not_interested`, `unverified` → logged | — | M | T1 / T2 | Built |
| **FR-037** | **Interactive console.** Authorised staff (`voice:operate`) shall be able to start a session for a customer (refused if DNC), send customer utterances as text and view the bilingual transcript. Used for rehearsal, QA and supervised calls. | — | S | T1 | Built |
| **FR-038** | **Automated call campaign.** A campaign manager (`journeys:run`) shall run a bot campaign over the top leads of a tier (hot or warm, up to 200 calls). Only individuals with a phone and call consent who are not on DNC are called. A summary of outcomes is returned. | Should apply `contact_policy` in full (E-01) | M | T1 | Partial |
| **FR-039** | **Voice governance KPIs.** The system shall report call volume, outcomes, plate-verification failure rate, opt-out rate and the disclosure statement. | — | S | T1 / PL | Built |

## E. Telesales

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-040** | **Structured handoff.** A hot bot call shall create a handoff holding only what the agent needs: plate, plate-verified flag, name, **masked** phone, journey, expiry, days to expiry, premium, score, outcome, price-asked and trust-concern flags, and **talking points**. Talking points include: call from the official hotline, never take payment by phone, the regulated-price message, the top benefits, and closing by sending the one-tap link. | Data minimisation | M | T1 | Built |
| **FR-041** | **Work queue.** Agents shall see open and assigned handoffs filtered by status, "mine" and region, with pagination. Agents see only handoffs that are unassigned or assigned to them. | ABAC `agent_own_handoffs`, region filter | M | T1 | Built |
| **FR-042** | **Handoff lifecycle.** Handoffs shall follow `open → claimed / callback / won / lost`, `claimed → won / lost / callback / open` and `callback → claimed / won / lost`. `won` and `lost` are terminal. Claiming assigns the handoff to the agent. Notes are appended with author and time. Optimistic version control prevents lost updates. | — | M | T1 | Built |
| **FR-043** | **Supervisor assignment.** A supervisor (`handoff:assign`) shall be able to assign or reassign any handoff. | RBAC | M | T1 | Built |
| **FR-044** | **Journey escalation to telesales.** A journey `telesales` step shall create a direct handoff (reason `journey_escalation`) with talking points for customers who have not responded to digital reminders. | `journeys` (`onlyTiers: ["hot"]`) | M | T3 | Built |

## F. Sales and issuance

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-045** | **Product catalogue.** The system shall expose active products (`TNDS_CAR`, `TNDS_MOTORBIKE`, `MOTOR_PD`, `PA_SEAT`) with their eligible channels, and bundles (`SAFE_DRIVE`, `FULL_MOTOR`). | `products` | M | NB | Built |
| **FR-046** | **Quotation.** For a profile the system shall quote 1–5 product lines for a channel. It checks that each product is sold on that channel. Cover starts the day after current expiry, or today if lapsed or unknown. Each line shows net premium, VAT, total, start and end dates and breakdown. The quote attaches benefits, detects a matching bundle and expires after **24 hours**. | `products`, rating kinds | M | T3 / NB | Built |
| **FR-047** | **Pay and issue (idempotent).** Purchase shall require an `Idempotency-Key`. The order ID is derived from quote + key, so a retry returns the original result (`idempotentReplay: true`). Flow: debit VETC wallet → issue each line through TASCO core → store policy with certificate number and verification URL → mark quote `converted`. | — | M | T3 | Built (sandbox ports); real wallet and core Planned |
| **FR-048** | **Failure compensation.** If payment fails, the order is set to `payment_failed`. If issuance fails after payment, the payment is refunded and the order set to `issuance_failed_refunded` for reconciliation. Both are audited. | — | M | PL | Built |
| **FR-049** | **Golden record update on issuance.** A TNDS issuance shall set the profile's expiry to the policy end date, method `tasco_issued`, confidence 1.0, insurer TASCO and verified = true. | — | M | T2 | Built |
| **FR-050** | **Public certificate verification.** Anyone holding a certificate number (QR) shall be able to verify validity, status, product, **masked** plate, insurer and period, with no PII. The endpoint is rate-limited. | — | M | T4 / PL | Built (API); page `/verify/:certNo` Planned |
| **FR-051** | **Policy listing.** Staff (`policy:read`) shall list policies by profile and product. | — | M | T3 | Built |
| **FR-052** | **Reconciliation.** A job shall check that every completed order has a payment reference and that each referenced policy exists, and flag orders stuck in `pending_payment` for more than 1 hour. | — | M | PL | Built |

## G. Products and rating

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-053** | **Regulated tariff rating (TNDS).** Annual premium by category, excluding VAT, pro-rata by days over 365. Term 1–3 years. VAT 10%. Car and motorbike tariffs per Decree 67/2023/ND-CP, to be confirmed by TASCO underwriting. | `tariff.tnds_car`, `tariff.tnds_motorbike` (validator: VAT 0–0.2, positive integer premiums) | M | T3 | Built |
| **FR-054** | **Physical damage rating (MOTOR_PD).** Premium = sum insured × rate (first-hit by usage and vehicle age) × (1 − deductible relief). Minimum VND 1,000,000. Sum insured above VND 5 bn is referred to an underwriter. Deductible options 0 / 500,000 / 1,000,000. | `rating.motor_pd` (ILLUSTRATIVE rates) | S | NB | Built; inspection prerequisite not enforced (E-06) |
| **FR-055** | **Personal accident per seat (PA_SEAT).** Premium = seats (1–60) × sum insured per seat (10 / 20 / 50 / 100 M) × rate per seat. VAT-exempt. | `rating.pa_seat` (ILLUSTRATIVE) | S | NB | Built |
| **FR-056** | **No-discount pricing.** Quotes for price-regulated products shall carry no discount field and shall state "Premium fixed by regulation — identical at every insurer". | `products.priceRegulated` | M | T4 / PL | Built |
| **FR-057** | **Products by configuration.** A new product shall be added by configuration: code, rating method (`tariff_table`, `rate_on_sum_insured`, `per_seat`), rate rule kind, channels and status. The validator rejects unknown methods, duplicate codes and bundles that reference unknown products. | `products` | S | PL | Built |

## H. Value and benefits

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-058** | **Benefits catalogue with legal gating.** Benefits shall have type (service, loyalty, convenience, cover upgrade), provider, bilingual title and description, eligibility, relevance and a "why" expression. **Only `legalStatus = approved` items are shown to customers.** Staff see all items, with pending ones flagged. | `benefits` | M | T4 | Built |
| **FR-059** | **Relevance and explanation.** Benefits shall be ranked by a per-customer relevance score (0–1) with a plain-language reason (for example "drives 1,850 km on highways per quarter"). | `benefits` | M | T4 | Built |
| **FR-060** | **Loyalty points and referral.** Non-cash VETC points for renewal or data verification, and a referral programme (200 points per referral, maximum 5 per month). Both are **disabled** pending legal approval. | `benefits.loyalty_points` (pending), `referral` (`enabled: false`) | C | T4 | Planned (gated) |
| **FR-061** | **Auto-renew opt-in.** The customer opts in once, is reminded 7 days before expiry and is renewed from the VETC wallet **only after confirming**. | `benefits.auto_renew` | S | T3 / T4 | Planned (benefit advertised; no endpoint, E-10) |
| **FR-062** | **Inspection (đăng kiểm) reminder and booking.** Track the inspection date, remind the customer and help book a slot. Use `vetc.inspection_booked` as a trigger to check TNDS validity. | `benefits.inspection_assist`, `triggers.inspection_booked` | S | T4 / NB | Partial (trigger built; booking integration Planned) |

## I. Partners and fleet

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-063** | **Partner onboarding and status.** A partner manager shall onboard partners of type `bank`, `showroom`, `agent`, `fleet` or `inspection_center` with a region, and activate or suspend them. A suspended partner's keys stop authenticating. | — | M | NB | Built |
| **FR-064** | **Partner API keys.** The system shall issue API keys (prefix `tpk_`) that are displayed **once** and stored only as SHA-256 hashes, with scopes `quote`, `purchase`, `policies:read`. Keys can be revoked. | — | M | NB / PL | Built |
| **FR-065** | **Partner quote by plate (new business).** A partner shall quote by plate, holder name, phone, seats, usage, current expiry and marketing consent. If the plate is unknown, or new facts are supplied, a partner source record is ingested so that the vehicle joins the base. Quotes are tagged with the partner and channel `partner_api`. | `products` (channel eligibility); `enrichment.sourceTrust.partner_*` | M | NB | Built (E-11) |
| **FR-066** | **Partner bind.** A partner shall bind only its own quotes, with an `Idempotency-Key`. | — | M | NB | Built |
| **FR-067** | **Partner self-service reporting.** A partner shall list the policies it sold and its own commission statement for a date range. | — | M | NB | Built |
| **FR-068** | **Commission calculation.** Commission per policy line = net premium × rate. The rate comes from a first-hit table by product and partner type and is **capped at the statutory cap**. The validator rejects any rule above the cap. | `commission` (TNDS 5%; PD 10% showroom / 8% other; PA 15%; caps TBC by TASCO finance and legal) | M | NB / PL | Built |
| **FR-069** | **Partner statement (staff).** A partner manager shall view any partner's commission statement: completed orders, lines and total. | — | M | NB | Built |
| **FR-070** | **Fleet / B2B.** Company-owned vehicles shall be routed to the B2B team (NBA `route_b2b`), excluded from automated bot campaigns, and offered a fleet renewal dashboard and consolidated VAT invoice. | `nba.fleet`, `benefits.fleet_dashboard` | S | NB | Partial (routing built; fleet dashboard and invoice Planned; journey exclusion gap E-07) |

## J. Claims FNOL

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-071** | **Report an accident (FNOL).** A customer shall report an incident against one of their own policies: incident date (must be within the policy period), description, location and photo count. The claim ID has the form `CL-XXXXXXXX`. An acknowledgement SLA due time (**4 hours**) is set. | SLA hardcoded (E-05) | S | T4 | Built (API); photo upload Planned |
| **FR-072** | **Claims queue and workflow.** Claims handlers shall list claims by status and advance them through `submitted → acknowledged → assessor_assigned → under_assessment → approved → paid`, with `rejected` allowed from early states. Every transition is recorded in history and the audit trail. | — | S | T4 | Built |
| **FR-073** | **My claims.** A customer shall see the status of their own claims. | — | S | T4 | Built |

## K. Customer self-service and privacy

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-074** | **Customer session.** The customer app (VETC app web view or Zalo mini app) shall exchange a **signed renewal link** (HMAC, no enumerable IDs) or a VETC SSO token for a 1-hour customer token scoped to one vehicle. Login is rate-limited. | ABAC `customer_self` | M | T3 | Built (signed link); VETC SSO Planned |
| **FR-075** | **Cover status home.** The customer shall see vehicle, cover (expiry, confidence, insurer, verified, days to expiry, and a "please confirm" prompt when confidence < 0.75), regulated premium, TASCO policies with certificate links, top approved benefits and current consent. | `benefits` | M | T3 / T4 | Built |
| **FR-076** | **Confirm my expiry.** The customer shall declare the current expiry date and insurer. This updates the golden record (`customer_declared`) and triggers recompute. | — | M | T2 | Built |
| **FR-077** | **One-tap renew with add-ons.** The customer shall get a quote for their vehicle (TNDS, optionally with PA_SEAT or MOTOR_PD, term 1–3 years) and pay from the VETC wallet with an `Idempotency-Key`. They receive the e-certificate with a QR immediately. | Channel `vetc_app` | M | T3 | Built (API); app UI Planned |
| **FR-078** | **Consent centre.** The customer shall switch marketing and call consent on or off. Changes are audited, survive data rebuilds and trigger recompute. | `contact_policy.consentRequired` | M | PL | Built |
| **FR-079** | **Download my data.** The customer shall download all data held about their vehicle: profile, lead, policies, messages, source records and voice sessions. | PDP right of access | M | PL | Built |
| **FR-080** | **Staff DSAR handling.** A compliance officer (`dsar:manage`) shall export a data subject's data and erase it by anonymisation. Erasure is **refused while an active policy is in force** (legal retention). Messages and transcripts are scrubbed and source PII nulled. | `retention` | M | PL | Partial (E-19: handoffs and claims not scrubbed) |
| **FR-081** | **PII masking by permission.** Customer 360 shall mask name and phone unless the viewer holds `profile:read_pii`. Every profile view is audited with a `piiVisible` flag. | `rbac` | M | PL | Built |

## L. Rules governance

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-082** | **Versioned rule registry.** All rule kinds shall be stored as versions (`kind@n`) with status `draft`, `pending_approval`, `active`, `retired` or `rejected`, plus checksum, author, approver and timestamps. Staff with `rules:read` list versions and view payloads. | All kinds | M | PL | Built |
| **FR-083** | **Draft with validation.** A rule author shall create a draft only if it passes validation: every embedded JSON Logic expression and decision table, the kind-specific checks (FR-014, FR-020, FR-053, FR-057, FR-068, contact window) and the copy guard for content and benefit kinds. | `src/rules/validators.js` | M | PL | Built |
| **FR-084** | **Validate without saving.** Authors shall be able to check a payload and see the list of errors. | — | S | PL | Built |
| **FR-085** | **Simulate.** Staff shall run a candidate `scoring`, `nba`, `journeys` or `benefits` payload against a real customer and compare the current and candidate evaluations (journey, score, tier, reasons, NBA, benefits) before submitting. | — | S | T2 / PL | Built (4 kinds) |
| **FR-086** | **Maker-checker approval.** Only the author can submit a draft. Only a **different** user with `rules:approve` can approve or reject it, with a comment. Approval retires the previous active version and activates the new one. All replicas pick up the change within about 15 seconds (cache TTL and `rules.activated` event). | — | M | PL | Built |
| **FR-087** | **Rollback.** Rolling back shall create a new draft copied from an earlier version, which still requires approval. | — | M | PL | Built |
| **FR-088** | **Default rule seeding.** On first start the system shall seed each kind from `config/rules/*.json` (copy guard first) as version 1, validated, with an audit entry. | — | M | PL | Built |

## M. Identity and access

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-089** | **Staff login with lockout.** Username and password login. After **5 failures** the account is locked for **15 minutes** (configurable). Timing is equalised for unknown users. Every attempt is audited. | Config `LOCKOUT_*` | M | PL | Built |
| **FR-090** | **MFA (TOTP).** A second factor is required for enrolled users and **mandatory** for `admin`, `rule_approver`, `compliance_officer` and `data_steward`. Unenrolled users in these roles are refused. | Config `MFA_REQUIRED_ROLES` | M | PL | Built |
| **FR-091** | **Sessions.** Short-lived access tokens (default **30 minutes**) carrying roles, region and authentication method. Logout revokes the token. | — | M | PL | Partial (revocation per replica, E-15) |
| **FR-092** | **RBAC.** 15 roles mapped to permissions, deny by default. Segregation of duties: the platform admin cannot author or approve rules or see customer PII. | `rbac` | M | PL | Built |
| **FR-093** | **ABAC.** Attribute policies evaluated after RBAC: agents see only their own or unassigned handoffs; telesales see profiles in their region; customers see only their own vehicle. | `abac` | M | PL | Partial (E-18) |
| **FR-094** | **User administration.** An admin shall create users (password policy, roles, region, optional MFA enrolment returning the TOTP secret once), change roles, region or status, and list users. An admin cannot remove their own admin role. | — | M | PL | Built |
| **FR-095** | **Partner and customer authentication.** Partner calls authenticate with `X-Api-Key` and receive role `partner_api`. Customer tokens (audience `customer`) are scoped to one profile. | — | M | PL | Built |
| **FR-096** | **Password management.** Users shall change their password after re-entering the current one. Policy: 12–128 characters (OWASP ASVS V2.1). | — | M | PL | Built |

## N. Audit

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-097** | **Audit every state change.** The system shall record actor, action, entity and details for authentication, user, rule, data, lead, journey, voice, handoff, quote, order, partner, claim, consent, DSAR, DQ and job events, including profile views with the PII-visibility flag. | — | M | PL | Built |
| **FR-098** | **Audit search.** Auditors and compliance staff (`audit:read`) shall search by entity, actor and action with pagination. | — | M | PL | Built |
| **FR-099** | **Tamper evidence.** Audit entries shall be hash-chained (each hash covers the previous one, using canonical JSON). A verify function reports `ok` or the index where the chain breaks. | — | M | PL | Built |

## O. Operations, reporting and user interfaces

| ID | Requirement | Business rules / rule kind | Pri | Track | Status |
|---|---|---|---|---|---|
| **FR-100** | **Growth overview dashboard.** Base size, expiring in 30 days, lapsed, usable-data profiles; leads by tier, journey and action; DQ issues by type; messages by channel and status; bot outcomes; handoffs; orders and premium by journey and channel; active policies by product; claims; **economics** (bot cost, telesales-equivalent cost, saving, messaging cost, cost per order). | `costs` | M | PL | Built (E-12, E-16) |
| **FR-101** | **Adoption dashboard.** Active users, logins, failed logins, handoff actions, actions by type, and adoption targets (weekly active telesales ≥ 90%, ≤ 3 clicks to renew, handoff first contact within 2 business hours, rule-change lead time ≤ 1 day). | — | S | PL | Built |
| **FR-102** | **Governance dashboard.** Voice-bot governance (FR-039), rule-set counts by status and audit-chain verification. | — | S | PL | Built |
| **FR-103** | **Operational status.** Store type, circuit-breaker state for each integration (wallet, core, telephony, push, ZNS, SMS), active rule versions with checksums, event backlog by status and audit entry count. | — | M | PL | Built |
| **FR-104** | **Jobs.** Support engineers (`ops:run_jobs`) shall run `reconciliation`, `retention` and `relay` (outbox) jobs and view job history. The same jobs run on a schedule via the CLI. | — | M | PL | Built |
| **FR-105** | **Retention execution.** Apply per-entity retention: source records deleted after 365 days, voice sessions after 180 days, profiles anonymised after 1,825 days of inactivity, and messages, orders, certificates and audit archived after the stated periods. Legal hold overrides deletion. | `retention` | M | PL | Partial (E-09) |
| **FR-106** | **Health, metrics and API description.** Liveness and readiness probes (readiness checks the DB), Prometheus metrics and an OpenAPI 3 document generated from the route table. | — | M | PL | Built |
| **FR-107** | **Demo and UAT sandbox.** Seed demo users (one per role), 5 demo partners and a synthetic VETC base that reproduces the brief's data problems (about 1 in 10 verified). A demo-only TOTP helper. Refuses to run in production unless explicitly allowed. | — | S | PL | Built |
| **FR-108** | **Staff web console.** Login with MFA; role-based home dashboard; leads queue with explainable score and NBA; Customer 360 (lineage, journey timeline, messages, policies, benefits); voice bot console; telesales inbox; journeys (run due, ecosystem event simulator); rules studio (draft, validate, simulate, submit, approve); partners (onboard, keys, statement); claims queue; data quality; audit (search, verify); users; operations; contextual help drawer. | — | M | All | Planned (in build under `public/`) |
| **FR-109** | **Customer mobile app (`/app/`).** Cover status card, confirm expiry, one-tap renew with add-ons, VETC wallet pay, e-certificate with QR, benefits, consent centre, report accident, download my data. Public certificate page `/verify/:certNo`. | — | M | T3 / T4 | Planned (in build under `public/app/`) |
| **FR-110** | **Localisation and themes.** Vietnamese and English toggle in the staff console and customer app (Vietnamese is the customer default), light and dark themes, and dates in dd/mm/yyyy for Vietnamese. | — | M | PL | Planned |

---

## Appendix A — Rule-kind index

| Rule kind | File | Governs FRs |
|---|---|---|
| `enrichment` | `config/rules/enrichment.json` | FR-004 – FR-007 |
| `scoring` | `scoring.json` | FR-014 |
| `nba` | `nba.json` | FR-015, FR-070 |
| `journeys` | `journeys.json` | FR-013, FR-020, FR-021, FR-028, FR-044 |
| `triggers` | `triggers.json` | FR-026, FR-062 |
| `contact_policy` | `contact_policy.json` | FR-023, FR-078 |
| `copy_guard` | `copy_guard.json` | FR-024, FR-035, FR-056 |
| `content.messages` | `content.messages.json` | FR-025, FR-027 |
| `content.voicebot` | `content.voicebot.json` | FR-031 – FR-035 |
| `benefits` | `benefits.json` | FR-016, FR-058 – FR-062 |
| `products` | `products.json` | FR-045, FR-046, FR-057 |
| `tariff.tnds_car`, `tariff.tnds_motorbike` | `tariff.*.json` | FR-053 |
| `rating.motor_pd`, `rating.pa_seat` | `rating.*.json` | FR-054, FR-055 |
| `commission` | `commission.json` | FR-068 |
| `referral` | `referral.json` | FR-060 |
| `retention` | `retention.json` | FR-080, FR-105 |
| `costs` | `costs.json` | FR-100 |
| `abac` | `abac.json` | FR-017, FR-041, FR-093 |
| `rbac` (security config) | `config/security/rbac.json` | FR-092 |

## Appendix B — Out of scope (this release)

- Claims adjudication, reserving and payment. These stay in TASCO core; the platform is the digital front door (FR-071 – FR-073).
- Underwriting of MOTOR_PD above VND 5 bn sum insured (referred to an underwriter).
- Pricing changes to regulated TNDS premiums. These are regulatory and are encoded, not decided, by the platform.
- Cash or premium-reducing incentives of any kind (prohibited).
