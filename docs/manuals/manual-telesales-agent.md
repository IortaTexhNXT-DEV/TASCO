# Telesales Agent Manual

**Role:** `telesales_agent` · **Demo users:** `agent.hn` (Hà Nội), `agent.hcm` (TP.HCM) · **MFA:** not required by default

**Your permissions:** read and work handoffs (`handoff:read`, `handoff:work`), view customers including personal data (`profile:read`, `profile:read_pii`), quote (`quote:create`), issue policies (`policy:issue`), view policies (`policy:read`), use the voice bot console (`voice:operate`), read leads (`leads:read`).

**Your data scope:** customers and handoffs in **your region**. You see handoffs that are unassigned or assigned to you. Other agents' claimed handoffs are hidden.

Read the [Staff User Manual](user-manual.md) first for sign-in, navigation and help.

---

## 1. Your job with the platform

The AI voice assistant does the first contact. It discloses that it is automated, **verifies the licence plate first**, confirms the expiry date and answers basic questions. When a customer wants a person, or a hot lead reaches the telesales step in a journey, the platform puts a **handoff** in your **Telesales inbox**.

Your job: **claim → prepare → call → quote → send the one-tap link (or issue) → record the outcome**.

> **Three promises we always keep**
> 1. We call from the **official VETC hotline** and refer to the assistant's call.
> 2. We **never ask for OTP codes, card details or payment over the phone**. Payment happens only in the official VETC app.
> 3. We **never offer discounts**. TNDS price is set by regulation and is the same everywhere. We sell service value.

---

## 2. Your landing page: Telesales inbox

**What you will see:** a list of handoff cards for your region, newest first. Each card shows:

| Field | Meaning |
|---|---|
| Plate + **Plate verified** ✓ | The customer said the plate to the voice bot and it matched our record |
| Name, phone (masked on the card) | Full details are in Customer 360 |
| Journey | Renewal, conquest, lapsed recovery or new vehicle |
| Expiry / Days | Current cover end date and days left (negative means lapsed) |
| Premium | TNDS premium including VAT |
| Score | Lead score 0–100 |
| Outcome / reason | Why it was handed over, for example `hot_handoff` (customer asked for an advisor) or `journey_escalation` (no response to digital reminders) |
| Flags | **Customer asked about price**, **Customer raised a trust concern** |
| Status | open, claimed, callback, won, lost |

Use **Only mine** to show only handoffs assigned to you, and the status filter to find callbacks.

---

## 3. Working a handoff step by step

### Step 1 — Claim
1. In the **Telesales inbox**, choose the most urgent card. Hot leads with few days left come first.
2. Select **Claim**.

**What you will see:** status changes to **Claimed** and the handoff is assigned to you. Other agents no longer see it.

> **Tip:** claim only what you can call within the next hour. The target is first contact within **2 business hours** of the handoff.

### Step 2 — Prepare (about 30 seconds)
1. Open the handoff and read the **Talking points**. They are generated for this customer, for example:
   - "Call from the official VETC hotline and reference the assistant call."
   - "Customer raised a trust concern: complete everything inside the VETC app; never take payment by phone."
   - "Customer asked about price: TNDS premium is regulated and identical everywhere — lead with service value."
   - "Benefit: 24/7 roadside assistance — drives 2,400 km on highways per quarter."
   - "Close by sending the one-tap link to the VETC app / Zalo OA while on the call."
2. Select **Open** to go to **Customer 360** and check:
   - **Policy expiry** and its confidence. If it shows *estimated* or low confidence, confirm the date with the customer first.
   - **Why this customer** (score breakdown).
   - **Value to offer (no discounts)**: the benefits relevant to this customer. Do **not** offer anything marked *pending legal review* (for example loyalty points).
   - **Messages & calls**: what we already sent and the voice bot transcript outcome.
   - **Consent**: if the customer has opted out, the page shows **Customer opted out — do not contact.** Stop.

### Step 3 — Call
1. Call from the official hotline (click-to-call where your telephony is integrated, otherwise dial manually).
2. Suggested opening (Vietnamese):
   > "Chào anh/chị, em là [tên] tư vấn viên của VETC. Em gọi lại theo yêu cầu của anh/chị trong cuộc gọi với trợ lý tự động của VETC về bảo hiểm TNDS cho xe [biển số đã che]. Em sẽ không hỏi mã OTP hay thông tin thẻ của anh/chị."
3. Do **not** read the full plate or personal details aloud until the customer confirms who they are.
4. If the customer is driving, offer to call back (set **Callback**).

### Step 4 — Quote
1. In Customer 360, open **Quote & issue** (or **Sell**).
2. **TNDS** is pre-selected for the vehicle's category. Choose the **TNDS term** (1–3 years) if the customer asks for multi-year cover.
3. Optional add-ons, if the customer is interested:
   - **Add driver & passenger accident cover**: choose the **Sum insured per seat**. The number of seats comes from the vehicle record.
   - **Add physical damage (own vehicle)**: enter **Vehicle value (VND)**. Physical damage may need an inspection before cover can start. Explain this.
4. Select **Get quote**.

**What you will see:** each product line with period, net premium, VAT and total, plus the order total. TNDS shows the note "Premium fixed by regulation — identical at every insurer." Quotes are valid for **24 hours**.

Handling price questions (script):
> "Phí bảo hiểm TNDS do Nhà nước quy định, giống nhau ở mọi công ty bảo hiểm. Khi mua qua VETC cùng Bảo hiểm TASCO, anh/chị được gia hạn một chạm, nhận giấy chứng nhận điện tử ngay và cứu hộ giao thông 24/7."

### Step 5 — Close: send the link (preferred) or issue
**Preferred: send the one-tap link.** The customer completes payment in their own VETC app while you are on the call.
1. Use the guided action **One-tap renew link via app / Zalo** (or ask the customer to open the renewal notification already in their app).
2. Stay on the line while they tap **Gia hạn ngay** and pay with their VETC wallet.
3. Confirm they see the e-certificate.

**Issue from the console** (only when the customer has confirmed payment in their VETC app, as per your team's procedure):
1. In **Quote & issue**, check the holder name and the quote.
2. Select **Pay from VETC wallet & issue**.

**What you will see:** the certificate number(s) and validity dates. The customer automatically receives a confirmation message with a verification link. The journey reminders stop.

> **Never** ask the customer for their wallet PIN, OTP or card number. If a customer offers them, stop them politely.

> The **Issue** button is protected against double charging: a repeated click with the same quote does not charge twice.

### Step 6 — Record the outcome
Back in the handoff:

| Outcome | Use when | Effect |
|---|---|---|
| **Won** | Customer bought (in app or issued) | Handoff closed. Journeys stop once the policy exists. |
| **Callback** | Customer asked to be called later | Stays in your queue as *callback*. Add the agreed time in **Note**. |
| **Lost** | Customer declined, bought elsewhere or is unreachable after attempts | Closed. Add the reason (for example "renewed at inspection centre, insurer X, expires 03/2027"), because it improves next year's data. |

Always add a short **Note**. Notes are visible to your supervisor and are kept in the audit trail.

Allowed status changes: open → claimed / callback / won / lost; claimed → won / lost / callback / open (release); callback → claimed / won / lost. Won and lost are final.

---

## 4. The voice bot console (practice and supervision)

Use **Voice bot** to rehearse what the assistant says, or to understand a customer's call.
1. Open **Voice bot** and pick a customer (or start from Customer 360).
2. Select **Start**. The bot speaks the introduction (Vietnamese, with an English gloss).
3. Type what the customer says, as speech-to-text would capture it, for example "30A 123 45" or digit by digit "ba không A một hai ba bốn năm", then "đúng rồi", then "gửi link cho tôi". (v1 does not yet understand tens words such as "ba mươi", known issue KI-25. Say plates digit by digit.)

**What you will see:** the transcript and the final outcome: `hot_handoff`, `link_sent`, `callback_later`, `already_renewed`, `opted_out`, `wrong_person`, `plate_mismatch`, `unverified` or `not_interested`. A `hot_handoff` creates a handoff in the inbox.

> Calls started here are real platform actions. In production, use only customers you are working on. In the sandbox, practise freely.

---

## 5. Objection handling quick guide

| Customer says | Do | Don't |
|---|---|---|
| "Is this a scam? Where did you get my number?" | Explain that VETC calls the toll account holder who registered this number. We never ask for OTP or payment by phone. Offer to send a notice to their VETC app so they can check. | Push for a sale |
| "Can you make it cheaper?" | The price is regulated and the same everywhere. Explain the service benefits. | Promise discounts, gifts or cashback |
| "I already renewed." | Thank them. Ask which insurer and the new expiry date. Record **Lost** with the details. | Argue |
| "Call me later." | Agree on a time and record **Callback** with a note | Call outside 08:00–20:00 |
| "Don't call me again." | Apologise, confirm, and tell your supervisor to record the opt-out. The customer can also turn off calls in the app's consent centre. | Continue the call |
| "You've got the wrong person / I sold the car." | Apologise, end the call, record **Lost** with "wrong person" | Reveal any vehicle details |

---

## 6. Tips
- Work **hot and urgent** first: negative days (lapsed) and ≤ 7 days.
- Read the **flags** before you call. A trust concern means you should open with reassurance.
- Use the **benefits shown for this customer**, which are chosen for them. Mention one, not five.
- Record outcomes immediately. Stale handoffs hurt the whole team's SLA.

## 7. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| I can't see a handoff my colleague mentioned | It's claimed by someone else or in another region | Ask your supervisor to reassign it |
| "Policy agent_own_handoffs denies update…" | The handoff is assigned to another agent | Supervisor reassigns |
| "Cannot move handoff from won to …" | Won and lost are final | Ask your supervisor if it was a mistake |
| "Customer is on the do-not-contact list" when starting a voice session | Customer opted out | Do not contact |
| "Quote expired — please re-quote" | More than 24 h since the quote | Select **Get quote** again |
| "TNDS_MOTORBIKE is not sold on channel telesales" | Motorbike TNDS is app/Zalo only | Send the app link |
| "Sum insured exceeds the online limit — refer to underwriter" | Physical damage value above the online limit | Refer to underwriting |
| "Upstream service unavailable" on issue | Wallet or TASCO core temporarily down | Nothing was completed. Try again later or send the link. |

See also: [Supervisor manual](manual-telesales-supervisor.md), [Staff User Manual](user-manual.md).
