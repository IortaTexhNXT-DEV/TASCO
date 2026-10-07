# Data Steward Manual

**Role:** `data_steward` · **Demo user:** `steward` · **MFA: required**

**Your permissions:** data-quality issues (`dq:read`, `dq:resolve`), customer records **with personal data** (`profile:read`, `profile:read_pii`), **correct customer data** (`profile:update`), **ingest data batches** (`data:ingest`), leads (`leads:read`), dashboards (`dashboard:read`).

You keep the golden record trustworthy. Only about 1 in 10 source records carries a reliable policy stamp, so the platform infers missing facts and scores its confidence. Your corrections, together with customer and voice bot confirmations, turn estimates into facts.

Read the [Staff User Manual](user-manual.md) first.

---

## 1. How the golden record works

1. **Source records** arrive from VETC (accounts, tags, toll class, app activity), TASCO core, partners and telesales files. Each is stored with its batch and lineage.
2. Records are matched **by licence plate**. The plate is normalised, for example "30a-123.45" becomes key `30A12345`, and the province is checked from the plate prefix. Invalid plates are rejected and logged as DQ issues.
3. **Survivorship** picks each field from the most trusted source (`enrichment.sourceTrust`). From highest to lowest: `tasco_core` 1.0, VETC app purchase 0.95, VETC account 0.85, customer declared 0.75, inspection centre 0.65, bank/showroom/fleet 0.6, agent 0.5, telesales CSV 0.4.
4. **Expiry inference** uses evidence: a verified certificate (1.0), customer declared (0.75), a partner policy record (0.7, scaled by source trust), the inspection cycle (0.5), the tag anniversary (0.25). Agreeing evidence within 21 days raises confidence (+0.15 each, max 0.95).
5. **Vehicle category** is inferred from declared seats, use and toll class (decision table), with confidence and the basis shown.
6. A **DQ score** combines completeness (50 %), expiry confidence (35 %) and category confidence (15 %).
7. Facts confirmed **on the platform** (customer declared, voice bot, TASCO-issued, steward corrections) survive later rebuilds when they are more confident.

**Thresholds to remember:** expiry confidence **< 0.5** means "not reliable — fix data before selling" (the NBA sends a confirmation request). Customers are asked to confirm in the app when confidence is **< 0.75**.

---

## 2. Your daily work: the Data quality queue

1. Open **Data quality**.
2. **What you will see:** open issues with **Type**, **Customer**, **Source**, **Detected** time and batch, plus counts **by type**.

| Issue type | Raised when | Typical resolution |
|---|---|---|
| `invalid_plate` | A source record's plate cannot be normalised (format or unknown province code) | Correct it at source, or reject the record. Resolve with a note. |
| `wrong_person` | The voice bot reached someone who says it's not their car or number | Check the phone. Remove or replace it from a better source. Resolve. |
| `plate_mismatch` | The person on the call gave a different plate | Check for a sold vehicle, a transfer or a wrong phone link. Resolve. |
| `phone` / `name` | No phone number or name in any source | Enrich from a trusted source (VETC account update, partner file), or leave it to journeys (app push needs no phone) |
| `reliable_expiry` | Expiry confidence below the usable threshold (0.5) | Correct with evidence (section 3), or let the `verify_expiry` journey step ask the customer |
| `vehicle_category` | Category confidence below 0.6, so the premium may be wrong | Confirm seats and use from a reliable source and re-ingest. Ask underwriting if unsure. |
| `current_insurer` | Current insurer unknown | Usually resolved by customer or voice bot confirmation. Correct when evidence exists. |
| `conflicting_phone` | Sources disagree on the phone number | Check lineage and keep the most trusted. Remove numbers known to be wrong at source. |

3. Filter by **Type** and work the highest volumes first. Issues tied to hot leads (open the customer to see the tier) come before the rest.

### 2.1 Resolve an issue
1. Select the issue, then **Open** the customer if needed (Customer 360).
2. Investigate (see 2.2) and make any correction.
3. Back on the issue, enter a **Resolution note** (what you found and did, for example "Phone belongs to previous owner; removed per VETC account update 12/10/2026").
4. Select **Resolve**.

**What you will see:** the issue disappears from the open list (filter **Resolved** to see it). It is audited as `dq.resolved` with your user ID. If new conflicting data arrives later, a new issue may be raised.

### 2.2 Investigate with lineage
1. In Customer 360, open **Data & lineage**.
2. **What you will see:**
   - **Sources**: the source systems and record IDs that built this profile;
   - **Lineage**: for each field (for example `policy.expiryDate`), the source, method, confidence and time;
   - **Expiry evidence**: each piece of evidence and its weight;
   - **Recent batches**: the latest ingestion batches.
3. Decide which evidence is right. When in doubt, prefer TASCO core or a verified certificate.

---

## 3. Correct a policy expiry date

Use this when you have **evidence**: a certificate photo sent by the customer, a TASCO core record, a partner confirmation or a call note.

1. Open the customer in **Customer 360**.
2. Select **Correct expiry (data steward)**.
3. Enter:
   - **New expiry date** (dd/mm/yyyy);
   - **Insurer** (optional, for example `TASCO`, `OTHER` or the insurer name);
   - **Evidence** (required, up to 300 characters): what the evidence is and where it is stored, for example "Certificate photo, ticket SR-5521".
4. Select **Save correction**.

**What you will see:** "Corrected and re-scored". The expiry now shows source `data_steward` with confidence 0.9. The lead is **recomputed at once**: tier, journey and scheduled touchpoints may change. The audit trail records `profile.expiry_corrected` with your evidence note.

> **Do not guess.** A wrong date sends reminders at the wrong time and destroys customer trust. If you have no evidence, leave the customer in the `verify_expiry` path so they confirm it themselves.

---

## 4. Ingest a data batch

Use this for partner files, telesales lists or corrected extracts. Routine VETC/TASCO feeds run automatically.

1. Prepare the records in the agreed JSON format. Each record **must** have a unique `recordId`. Allowed fields: `recordId`, `source`, `plateRaw`, `phoneRaw`, `fullName`, `tollClass`, `seatsDeclared`, `usageDeclared`, `ownerType`, `tagActivatedAt`, `policy` (`insurer`, `expiryDate`, `verified`), `lastInspectionDate`, `declaredExpiry`, `partnerId`, `firstRegisteredYear`. Any other field is ignored.
2. Open **Data quality → Ingest batch**.
3. Enter the **Source** name (for example `partner_inspection_center`, `telesales_csv`). This drives source trust.
4. Upload or paste the records (up to **5,000 per batch**).
5. Select **Ingest**.

**What you will see:** batch ID (`B-<date>-…`), records received, rejected (invalid plates), profiles touched and rebuilt, and new DQ issues. Affected leads are re-scored automatically.

> Only ingest data that has a lawful basis and a data-sharing agreement. Personal data in source records is encrypted at rest. Raw source records are deleted after 365 days (`retention` rule set).

---

## 5. KPIs (proposed)

| KPI | Target |
|---|---|
| Profiles with usable expiry (confidence ≥ 0.5) | Rising every month. ≥ 50 % of the base at scale. |
| Open DQ issues older than 5 business days | ≤ 10 % |
| `wrong_person` + `plate_mismatch` per 100 voice calls | Falling trend |
| Corrections with evidence notes | 100 % |

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| "records[3].recordId required" | Every record needs a string `recordId` |
| "Ingest a batch of source records (≤ 5,000)" error on size | Split into smaller batches |
| Many `invalid_plate` issues from one source | Check the source's plate format and province codes. Feed back to the provider. |
| Correction "not found" | The customer may have been anonymised (DSAR erasure) |
| My correction was overwritten | Only a more trusted, more confident source (for example a TASCO-issued policy) can override it. Check lineage. |

See also: [Compliance Officer Manual](manual-compliance-officer.md), [Campaign Manager Manual](manual-campaign-manager.md).
