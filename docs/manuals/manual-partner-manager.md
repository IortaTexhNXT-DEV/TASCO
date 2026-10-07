# Partner Manager Manual

**Role:** `partner_manager` · **Demo user:** `partners` · **MFA:** not required by default (recommended)

**Your permissions:** manage partners (`partners:manage`), read dashboards (`dashboard:read`), read policies (`policy:read`).

Partners already close most TNDS deals. Instead of competing with them, the platform gives them an **API** to quote and sell TASCO cover using VETC data, with **transparent, capped commission**. You onboard partners, control their API access and produce commission statements.

Read the [Staff User Manual](user-manual.md) first. Give partner developers the [Partner API Guide](partner-api-guide.md).

---

## 1. Partner types

| Type | Examples | Typical products |
|---|---|---|
| `bank` | Car-loan banks | TNDS, physical damage, PA |
| `showroom` | Car dealers | New-vehicle TNDS + physical damage (higher physical damage commission: 10 %) |
| `agent` | Independent agencies | TNDS, PA |
| `fleet` | Fleet operators, logistics | TNDS for many vehicles |
| `inspection_center` | Đăng kiểm centres | TNDS at inspection time |

**Commission** (from the active `commission` rule set, as a share of **net** premium, capped by statutory limits):

| Product | Rate | Statutory cap |
|---|---|---|
| TNDS (car, motorbike) | 5 % | 5 % |
| Physical damage (MOTOR_PD), showroom | 10 % | 10 % |
| Physical damage, other partners | 8 % | 10 % |
| Personal accident (PA_SEAT) | 15 % | 20 % |

Rates are configuration. TASCO Finance and Legal must confirm the figures, and changes go through the Rules studio with maker-checker approval.

---

## 2. Onboard a partner

**Before you start:** signed partner agreement, KYC/due diligence completed, the partner's technical contact identified, and the commercial terms matching the active commission rules.

1. Open **Partners**.
2. Select **Onboard partner**.
3. Enter **Name**, **Type** (Bank, Car showroom, Agent, Fleet, Inspection centre) and **Region** (or ALL).
4. Select **Create**.

**What you will see:** "Partner created" with an ID such as `P-1A2B3C4D`, status **active**. The action is audited (`partner.created`).

## 3. Issue an API key

1. Open the partner and select **Issue API key**.
2. **What you will see:** a dialog **"Copy this API key now — it will not be shown again"** with a key starting `tpk_`.
3. Select **Copy** and send it to the partner's named technical contact through a **secure channel** (for example an encrypted file plus a password by SMS). Never send it by plain email or chat.
4. Confirm you have saved it, then close the dialog.

The platform stores only a hash of the key, so a lost key cannot be recovered. Issue a new one and revoke the old one. Each key has a short visible **prefix** and an ID (`K-…`) to identify it.

> Issue **separate keys** for the partner's test and production systems, and rotate keys at least yearly.

## 4. Revoke a key
Revoke when a key may be exposed, when the partner rotates keys, or when staff leave the partner.
1. Open the partner and find the key by its ID and prefix.
2. Select **Revoke** and confirm.

**What you will see:** the key status changes to **revoked**. Calls with it fail at once with `401 UNAUTHENTICATED` ("Valid X-Api-Key required").

## 5. Suspend or reactivate a partner
1. Open the partner and select **Suspend** (or **Activate**).
2. While suspended, **all** the partner's keys stop working. Existing policies remain valid.

Use suspension for contract breaches, compliance investigations or unpaid balances.

## 6. Commission statements
1. Open the partner and select **Statement**.
2. Choose a period (**From**, **To**) and select **Apply**.
3. **What you will see:** number of completed orders, **total commission**, and lines per order and product: order ID, date, product, rate, amount and the applied rule.
4. Export the statement for Finance. Partners can download the same statement through the API, so both sides see identical figures.

Only **completed** orders (paid and issued) earn commission. Failed or refunded orders do not.

## 7. Monitoring partner performance
- **Home** → Sales → **by channel** shows orders through `partner_api`.
- Check policies sold by a partner through the partner's statement or the policies list.
- Watch for unusual patterns, such as spikes in quotes without orders, many new unknown plates, or repeated failures. Discuss them with Compliance.

## 8. Rules of engagement (channel conflict)
Agree these with each partner and with marketing:
- Vehicles **quoted through a partner** are attributed to that partner. Discuss suppression windows for VETC conquest journeys with the campaign manager. This is configured in the `nba` / `journeys` rules through maker-checker.
- Partners must not use discount wording for TNDS either.
- Partners must collect **marketing consent** properly if they pass `consentMarketing: true`.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Partner reports `401 Valid X-Api-Key required` | Key revoked, wrong key, partner suspended, or the header is missing. Check the status and issue a new key if needed. |
| Partner reports `404 Quote not found` on order | The quote belongs to another partner, or the ID is wrong |
| Partner reports `422 Quote expired — please re-quote` | Quotes last 24 hours |
| Statement total looks wrong | Check the period. Only completed orders count. Check the active `commission` version in the Rules studio. |

See also: [Partner API Guide](partner-api-guide.md).
