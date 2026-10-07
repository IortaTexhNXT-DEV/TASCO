# Campaign Manager Manual

**Role:** `campaign_manager` · **Demo user:** `campaign` · **MFA:** not required by default

**Your permissions:** dashboards (`dashboard:read`), leads (`leads:read`, `leads:recompute`), run journeys, events and voice campaigns (`journeys:run`), view customers with personal data masked (`profile:read`), voice bot console (`voice:operate`), read rules (`rules:read`), read the telesales inbox (`handoff:read`).

You **cannot** author or approve rules. Ask a rule author to change journeys, templates or scoring (see the [Rule Author and Approver Manual](manual-rule-author-and-approver.md)). You also cannot see customer phone numbers or names unmasked.

---

## 1. Your job with the platform

You run growth across **new business** and **retention**:

| Journey | Objective | Who is in it (first match wins, by priority) |
|---|---|---|
| **Uninsured vehicle recovery** (`lapsed_uninsured`) | New business | Cover lapsed 1–60 days ago, expiry confidence ≥ 0.5 |
| **New vehicle onboarding** (`new_vehicle`) | New business | ETC tag activated ≤ 60 days ago, not insured with TASCO |
| **TASCO renewal** (`renewal`) | Retention | Current insurer is TASCO |
| **Conquest** (`conquest`) | New business | Insured elsewhere or insurer unknown |
| **Cross-sell** (after purchase) | Cross-sell | TNDS-only buyers with marketing consent |

Each journey has timed steps across **app push, Zalo ZNS, SMS, AI voice bot and telesales**. Every send passes the **contact policy** (consent, 08:00–20:00, max 1 marketing contact per day, 3 per week, 2 call attempts per week) and the **copy guard** (no discount wording). The journey stops as soon as the vehicle is insured with TASCO.

---

## 2. Monitor: Home dashboard

Open **Home**. Key blocks:

| Block | Use it to… |
|---|---|
| **Base**: profiles, expiring in 30 days, lapsed/uninsured, profiles with usable data | Size the opportunity and data gap |
| **Leads by tier / journey / action** | See the mix of new business vs retention, and how many need data repair (`verify_expiry`) |
| **Data quality issues** | Spot data problems that hurt targeting |
| **Engagement**: messages by channel, message status (sent/blocked/failed), voice outcomes, handoffs | Check delivery and blocks |
| **Sales**: orders, GWP, by journey and channel, active policies by product | Conversion and channel mix (aim: in-app share rising) |
| **Channel economics**: voice-bot cost vs equivalent telesales cost, messaging cost, acquisition cost per order | Business case. Unit costs come from the `costs` rule set. |

The **as-of** date is shown at the top.

---

## 3. Work with leads

### 3.1 Find a target segment
1. Open **Leads**.
2. Set filters: **Tier** (hot / warm / nurture), **Journey**, **Action** (next best action), **Region**, **Days to expiry** (maximum, for example 14), **Min score**.
3. Sort by **Score** or **Expiry**. Select **Apply**.

**What you will see:** plate, score, tier badge, journey, next best action with reason, days to expiry, premium, region. Select **Open** for Customer 360 (personal data masked for your role).

### 3.2 Recompute leads
After a rule change is approved or a large data load, select **Recompute** on the Leads page. It re-scores all leads with the active rules. Large bases take several minutes, so run it outside peak hours. Leads are also recomputed automatically for affected customers after data changes, purchases, opt-outs and expiry confirmations.

---

## 4. Run journeys

### 4.1 See what is scheduled
1. Open **Journeys**.
2. The **touchpoints** list shows scheduled and executed steps with due date, journey, step, channels and status (`scheduled`, `done`, `skipped`, `cancelled`). Filter by status.

### 4.2 Run due touchpoints
In production this runs automatically each morning (scheduled job). To run it manually, for example after an outage:
1. Select **Run due touchpoints**.
2. Optionally set the **date** (run as of a date) and **time**. The time matters because marketing messages are only sent within the 08:00–20:00 window.
3. Confirm.

**What you will see:** a summary with **due**, **done**, **skipped** and **cancelled** counts, by channel and by journey.

| Status | Meaning |
|---|---|
| done | Sent (or call placed, or telesales task created) on the first permitted channel |
| skipped | No channel was allowed. The reason is listed per channel (for example "outside allowed contact hours", "weekly contact cap reached", "no marketing consent", "copy guard: …") |
| cancelled | No longer relevant: already insured with TASCO, journey changed, or profile removed |

> **Tip:** many skips with "outside allowed contact hours" mean the run happened too early or late. Re-run within the window.

### 4.3 Ecosystem events (moments of truth)
VETC events trigger immediate, relevant messages. In production they arrive automatically. To test or replay one:
1. Open **Journeys** → **Ecosystem event**, or from Customer 360 use **Simulate wallet top-up event**.
2. Choose the event type and the customer (plate ID):

| Event | Trigger | Action |
|---|---|---|
| `vetc.tag_activated` | New ETC tag (likely new car) | Re-evaluate into the **new vehicle** journey |
| `vetc.inspection_booked` | Inspection booked and expiry < 60 days | Service message `inspection_tnds_check` (app/Zalo) |
| `vetc.wallet_topped_up` | Expiry within ±30 days | Push `first_reminder`: the customer is in the app with funds |
| `vetc.long_trip_started` | Vehicle uninsured (lapsed ≤ 60 days) | Push `value_reminder` |

**What you will see:** how many triggers matched and the result of each (`sent`, "condition not met", "no permitted channel").

### 4.4 Voice bot campaign
1. Open **Journeys** (or **Voice bot**) → **Voice campaign**.
2. Choose **Tier** (hot or warm) and **Limit** (1–200 calls).
3. Select **Run**.

The platform calls the top leads that have **call consent**, are **not** on do-not-contact, have a phone number and are **not company-owned**.

**What you will see:** number called and outcomes (`hot_handoff`, `link_sent`, `callback_later`, `already_renewed`, `opted_out`, `wrong_person`, `plate_mismatch`, `unverified`, `not_interested`). Hot handoffs go to the telesales inbox. Requested links are sent automatically. Opt-outs are recorded at once. Wrong-person and plate-mismatch outcomes create data-quality issues.

> **Known v1 gap (KI-09):** voice campaigns check call consent and do-not-contact, but **not** the contact window or the weekly call cap. Until this is fixed, run campaigns **only between 08:00 and 20:00** (Vietnam time), and do not run a campaign for the same tier more than once in a few days.

> Watch the **opt-out rate** (proposed target ≤ 5 %) and the **plate-verification failure rate** (≤ 15 %) on the governance figures. High rates mean you are calling the wrong people or the data is poor.

---

## 5. Requesting changes to journeys, templates or scoring
You can read every rule set in the **Rules studio** but not change it. To request a change:
1. Describe the change and the business reason (for example "move the first reminder from D−30 to D−35 for conquest").
2. A **rule author** drafts it, validates it and simulates it on sample customers.
3. A **rule approver or compliance officer** approves it. New Zalo templates also need **Zalo ZNS approval** before use.
4. After activation, monitor the effect for 7 days.

**Copy rules:** never use **giảm giá, chiết khấu, hoàn tiền, khuyến mãi phí, rẻ hơn, discount, cashback, rebate, % off, cheaper, lower premium, price cut**. The platform rejects them. Lead with service value. Placeholders available in templates: `{{plate}}`, `{{expiry}}`, `{{days}}`, `{{premium}}`, `{{link}}`, `{{benefit}}`.

---

## 6. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Most touchpoints skipped "weekly contact cap reached" | Overlapping journeys or triggers | Review the schedule. Ask the author to space steps. |
| Messages "blocked" with "copy guard: …" | A template contains a banned phrase | Request a template fix (Rules studio) |
| Messages "failed" | Provider outage (Zalo/SMS) | Check with support (Operations → integrations). Re-run later. |
| Voice campaign "called 0" | No eligible hot leads with call consent | Try warm, or check consent levels |
| Customer details masked | Your role does not include personal data | Expected |
| "Active rule set … not found" | A required rule kind is missing in this environment | Contact support |

See also: [Rule Author and Approver Manual](manual-rule-author-and-approver.md), [Executive Manual](manual-executive.md).
