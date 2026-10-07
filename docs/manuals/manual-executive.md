# Executive Manual

**Role:** `executive` · **Demo user:** `exec` · **MFA:** recommended

**Your permission:** dashboards (`dashboard:read`). You see **Home** only, with live KPIs computed directly from the platform, so no manual reporting is needed. You do not see individual customers' personal data.

Read sections 3–4 of the [Staff User Manual](user-manual.md) for sign-in and navigation (about 5 minutes).

---

## 1. Reading the dashboard in 5 minutes

Open **Home**. The **as-of** date is shown at the top ("Growth across new business and retention").

| # | Block | Question it answers | What good looks like (proposed) |
|---|---|---|---|
| 1 | **Base**: profiles, expiring in 30 days, lapsed/uninsured (≤ 60 days), profiles with usable data | How big is the opportunity right now? | Expiring-in-30 is the near-term pipeline. Lapsed vehicles are a new-business and road-safety opportunity. |
| 2 | **Hot leads** and **leads by tier** | How much high-intent demand do we have? | A stable or rising hot share as data quality improves |
| 3 | **Journey mix**: renewal (retention), conquest (other insurer), new vehicle, lapsed/uninsured, cross-sell | Are we growing new business as well as retaining? | Conquest + new vehicle + uninsured together larger than renewal is healthy growth |
| 4 | **Data quality issues** and **profiles with usable data** | Can we trust the targeting? | Usable-data share rising month on month (baseline ≈ 10 %) |
| 5 | **Engagement**: messages by channel, delivery status, voice bot outcomes, handoffs | Are we reaching customers without spamming? | Low blocked and failed share. Opt-outs ≤ 5 % of calls. |
| 6 | **Sales**: orders, GWP, by journey and channel | Is it converting, and where? | In-app (VETC app / Zalo) share ≥ 50 % in pilot. Partner API growing after launch. |
| 7 | **Active policies by product** | Product mix | Add-on attach (PA_SEAT, MOTOR_PD) rising |
| 8 | **Claims** by status | Are we keeping the claims promise? | Few claims stuck in `submitted` |
| 9 | **Channel economics**: voice-bot cost vs equivalent telesales cost, messaging cost, **acquisition cost per order (bot + messaging)** | Is the model efficient? | Saving vs telesales positive. Cost per order falling. |

Notes on economics: unit costs come from the `costs` rule set (for example voice bot 1,500 ₫/min, telesales 6,000 ₫/min, Zalo ZNS 300 ₫, SMS 700 ₫ per message). These are **assumptions** until replaced with contracted rates.

## 2. Adoption tab
Shows how the organisation uses the platform: active users, sign-ins, failed sign-ins, handoff actions, and actions by type. Built-in targets: weekly active telesales ≥ 90 %, average clicks to renew ≤ 3, handoff first contact within 2 business hours, rule change lead time ≤ 1 day.

## 3. Questions to ask your teams

| If you see… | Ask… |
|---|---|
| Many hot leads but few orders | "Are handoffs worked within 2 hours? Are links sent?" (Telesales supervisor) |
| High blocked messages | "Which contact-policy reason is blocking? Are journeys overlapping?" (Campaign manager) |
| High voice opt-out or plate-mismatch rates | "Are we calling the right people? What does the data steward see?" |
| Usable-data share flat | "Is the confirm-expiry step working in the app?" (Product, Data) |
| Cost per order rising | "Is the channel mix shifting to telesales? Are bot calls converting?" |
| Partner orders flat after launch | "Which partners are certified? Any channel-conflict issues?" (Partner manager) |

## 4. Important reminders
- **TNDS premiums are regulated and identical everywhere.** Growth comes from service value, not price. Any request for discounting must be refused (Law on Insurance Business 08/2022/QH15).
- KPI targets in the delivery documents are **proposals** to be agreed by the Steering Committee.
- Dashboards are live. Numbers can change during the day as journeys and sales run.

## 5. Troubleshooting
| Problem | Fix |
|---|---|
| Dashboard empty in the sandbox | The sandbox is seeded nightly. Ask support if it stays empty. |
| A number looks wrong | Note the as-of date and the block, and ask the Product Owner. Each number is traceable to platform data. |
| Want customer-level detail | Ask the campaign manager or supervisor (role-based access protects personal data). |
