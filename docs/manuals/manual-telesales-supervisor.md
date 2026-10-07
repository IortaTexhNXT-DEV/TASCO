# Telesales Supervisor Manual

**Role:** `telesales_supervisor` · **Demo user:** `supervisor` (region ALL) · **MFA:** not required by default

**Your permissions:** everything a telesales agent can do (`handoff:read`, `handoff:work`, `profile:read`, `profile:read_pii`, `quote:create`, `policy:issue`, `policy:read`, `voice:operate`, `leads:read`), plus **assign handoffs** (`handoff:assign`) and **read dashboards** (`dashboard:read`).

**Your data scope:** handoffs and customers in your region, or all regions if your region is ALL. Unlike agents, you see handoffs claimed by any agent in your scope.

Read the [Telesales Agent Manual](manual-telesales-agent.md) first. Everything there applies to you as well.

---

## 1. Your job with the platform
- Keep the **queue healthy**: no handoff waits more than 2 business hours for first contact (proposed target).
- **Balance workload** by assigning and reassigning handoffs.
- **Coach** agents on talking points, trust handling and recording outcomes.
- **Monitor** results on the dashboard and escalate issues (data, script, integrations).

---

## 2. Daily routine

| Time | Task | Where |
|---|---|---|
| Start of shift | Check open and callback volumes. Assign the backlog. | Telesales inbox, Home |
| Every 1–2 hours | Look for handoffs older than 2 business hours. Reassign them. | Telesales inbox (status **open**, oldest first) |
| Midday | Spot-check 3–5 handoffs per agent: notes, outcomes, links sent | Handoff detail, Customer 360 |
| End of shift | Make sure callbacks have notes and times. Release or reassign handoffs of absent agents. | Telesales inbox |
| Weekly | Review KPIs with the team. Feed script and data issues back. | Home dashboard, champion forum |

---

## 3. Managing the queue

### 3.1 See the whole queue
1. Open **Telesales inbox**. As a supervisor you see all handoffs in your scope, including those claimed by agents.
2. Filter by status: **open** (not yet claimed), **claimed**, **callback**, **won**, **lost**.
3. Clear **Only mine** to see the team view.

### 3.2 Assign or reassign a handoff
1. Open the handoff (**Handoff detail**).
2. In **Assign to**, choose the agent.
3. Add a **Note** explaining why (for example "Reassigned — An on leave").
4. Select **Save**.

**What you will see:** the handoff shows the new assignee and moves into that agent's queue. The change is recorded in the audit trail (`handoff.updated`).

> Agents can work only handoffs that are unassigned or assigned to them, so reassigning is how you move work between agents.

### 3.3 Release a handoff back to the pool
Set status from **claimed** back to **open**, optionally clearing the assignee. Any agent in the region can then claim it.

### 3.4 Correct an outcome
Won and lost are **final**. If an agent recorded the wrong final status, add a note on the handoff, and ask the campaign manager or data steward to correct the customer record where needed (for example an expiry date). Coach the agent.

---

## 4. Monitoring performance

### 4.1 Home dashboard
Open **Home**. Relevant sections:

| Section | What to look at |
|---|---|
| Engagement → handoffs | Count by status (open, claimed, callback, won, lost) |
| Engagement → voice outcomes | How many calls ended `hot_handoff`, `link_sent`, `opted_out`, `plate_mismatch`… |
| Sales → by channel | Orders through `telesales` vs `vetc_app` / `zalo`. Telesales success often shows as app orders when agents send links. |
| Adoption tab | Active users, handoff actions, and targets (weekly active telesales ≥ 90 %, handoff first contact within 2 business hours) |

### 4.2 Team KPIs (proposed targets)

| KPI | Target |
|---|---|
| Handoff first-contact time (median) | ≤ 2 business hours (pilot), ≤ 1 (scale) |
| Open handoffs older than 1 business day | ≤ 10 % |
| Outcomes recorded with a note | 100 % |
| Weekly active agents | ≥ 90 % |
| Opt-out complaints after human calls | 0 |

### 4.3 Coaching checklist (per sampled handoff)
- [ ] Claimed within target time?
- [ ] Talking points and trust/price flags addressed?
- [ ] One relevant benefit offered, no discount language?
- [ ] One-tap link sent (rather than issuing by phone where the customer could pay in-app)?
- [ ] Outcome and note recorded? For "lost", insurer and expiry captured?

---

## 5. Escalations

| Issue | Escalate to | How |
|---|---|---|
| Wrong expiry dates or wrong-person calls in volume | Data steward | List the plates and customer IDs (no phone numbers in chat) |
| Voice bot script causes confusion | Campaign manager / Compliance | Example transcripts (session IDs). Changes go through the Rules studio. |
| Customer complaint about contact frequency | Compliance | Customer ID and dates. Consent can be withdrawn by the customer in the app. |
| Wallet or issuance failures | Support (service desk) | Support code and time |
| Agent needs a different region or role | Platform administrator | Access request |

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| "Missing permission handoff:assign" | Your account lacks the supervisor role. Contact the administrator. |
| An agent cannot see a handoff you assigned | Check the agent's region matches the handoff's region |
| "… was modified by someone else" | The agent updated it at the same time. Reload and retry. |
| "Cannot move handoff from callback to open" | Callback can go to claimed, won or lost only. Set **claimed** and reassign. |

See also: [Telesales Agent Manual](manual-telesales-agent.md), [Campaign Manager Manual](manual-campaign-manager.md).
