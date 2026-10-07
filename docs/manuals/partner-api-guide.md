# Partner API Guide (v1)

For **developers at partner organisations** (banks, car showrooms, agencies, fleets, inspection centres) who quote and sell TASCO Insurance motor cover through the TASCO Growth Platform.

| Item | Value |
|---|---|
| Base path | `/api/partner/v1` |
| Base URL | Sandbox and production URLs are given to you by your TASCO partner manager |
| Format | JSON over HTTPS (`Content-Type: application/json`) |
| Authentication | `X-Api-Key` header |
| Idempotency | `Idempotency-Key` header **required** on `POST /orders` |
| Machine-readable spec | `GET /api/openapi.json` (OpenAPI 3.1; partner operations are tagged **Partner API**) |
| Support | Your partner manager. Quote the `requestId` from any error. |

---

## 1. Authentication

Every request must carry your API key:

```
X-Api-Key: tpk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- Keys start with `tpk_`. They are issued by your TASCO partner manager and **shown only once**. TASCO stores only a hash, so a lost key cannot be recovered. Ask for a new key and the old one will be revoked.
- Keep keys server-side only, in a secret store. **Never** put them in mobile apps, browsers or source code.
- Requests fail with `401` if the key is missing, wrong or revoked, or if your partner account is suspended.
- Use separate keys for test and production. Rotate at least yearly.

In the examples below:

```bash
export BASE="https://<platform-host>"         # provided by TASCO
export KEY="tpk_your_key_here"
```

---

## 2. Typical flow

```mermaid
sequenceDiagram
  autonumber
  participant P as Partner system
  participant API as TASCO Growth Platform
  participant W as Payment
  participant T as TASCO core
  P->>API: POST /api/partner/v1/quotes (plate, products)
  API-->>P: 200 quote {id, lines, total, expiresAt}
  Note over P: Show the quote to the customer; obtain their agreement
  P->>API: POST /api/partner/v1/orders (quoteId) + Idempotency-Key
  API->>W: debit (idempotent)
  API->>T: issue policy per line
  API-->>P: 200 {order, policies[certNo, certificateUrl]}
  P->>API: GET /api/partner/v1/policies
  P->>API: GET /api/partner/v1/statement?from&to
```

---

## 3. Endpoints

### 3.1 Create a quote: `POST /api/partner/v1/quotes`

Quotes one to five products for a vehicle identified by **licence plate**. If TASCO does not yet know the vehicle, it is **onboarded automatically** (new business) from the data you send. If you send `currentExpiry` or `seats`, those facts are added to the vehicle's record and attributed to you.

**Request body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `plate` | string (≤ 20) | ✓ | Any common format: `30A12345`, `30A-123.45`, `30a 123 45`. Must be a valid Vietnamese plate. |
| `products` | array (1–5) | ✓ | Each item `{ "code": "...", "options": { ... } }` (see the table below) |
| `holderName` | string (≤ 120) | | Policyholder name |
| `phone` | string (≤ 20) | | Vietnamese mobile (`09…`, `+849…`). Validated. |
| `seats` | integer 1–60 | | Declared seats (drives vehicle category and PA pricing) |
| `usage` | `personal` \| `commercial` | | Declared use |
| `currentExpiry` | date `YYYY-MM-DD` | | Expiry of the customer's current TNDS. Cover starts the next day. |
| `consentMarketing` | boolean | | Whether the customer gave marketing consent to TASCO/VETC |

**Products available on the partner channel**

| `code` | Product | `options` |
|---|---|---|
| `TNDS_CAR` | Compulsory TNDS (car), **price-regulated** | `category` (optional override, for example `car_under6`, `car_6_11`, `pickup_van`, `commercial_under6`, `truck_under3t` …), `termYears` 1–3 |
| `PA_SEAT` | Driver and passenger personal accident | `seats` (defaults to the vehicle's seats, or 5), `sumInsuredPerSeat`: one of `10000000`, `20000000`, `50000000`, `100000000` |
| `MOTOR_PD` | Voluntary physical damage | `sumInsured` (VND, ≤ 5,000,000,000 online), `deductible`: `0`, `500000` or `1000000`, `vehicleAge` (years). May require inspection before binding: follow your partner agreement. |

`TNDS_MOTORBIKE` is not available on the partner channel (VETC app and Zalo only).

**Example**

```bash
curl -sS -X POST "$BASE/api/partner/v1/quotes" \
  -H "X-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: bank01-req-000123" \
  -d '{
    "plate": "30A-123.45",
    "holderName": "Nguyễn Văn An",
    "phone": "0912345678",
    "seats": 5,
    "usage": "personal",
    "currentExpiry": "2026-11-05",
    "consentMarketing": false,
    "products": [
      { "code": "TNDS_CAR", "options": { "termYears": 1 } },
      { "code": "PA_SEAT",  "options": { "sumInsuredPerSeat": 20000000 } }
    ]
  }'
```

**Response `200`** (abridged)

```json
{
  "id": "Q-6f1c2d9e-3a4b-4c5d-8e9f-0a1b2c3d4e5f",
  "profileId": "30A12345",
  "plate": "30A-123.45",
  "channel": "partner_api",
  "partnerId": "P-BANK-01",
  "lines": [
    {
      "product": "TNDS_CAR",
      "productName": "Compulsory motor third-party liability (car)",
      "productNameVi": "Bảo hiểm TNDS bắt buộc ô tô",
      "startDate": "2026-11-06",
      "endDate": "2027-11-06",
      "termDays": 365,
      "premiumNet": 437000,
      "vat": 43700,
      "total": 480700,
      "priceRegulated": true,
      "breakdown": [{ "label": "Car < 6 seats (non-commercial)", "labelVi": "Xe dưới 6 chỗ (không kinh doanh)", "annual": 437000, "years": 1 }],
      "note": "Premium fixed by regulation — identical at every insurer."
    },
    {
      "product": "PA_SEAT",
      "startDate": "2026-11-06",
      "endDate": "2027-11-06",
      "premiumNet": 100000,
      "vat": 0,
      "total": 100000,
      "priceRegulated": false,
      "breakdown": [{ "label": "Personal accident", "seats": 5, "sumInsuredPerSeat": 20000000, "ratePerSeat": 0.001 }],
      "note": "Premium per TASCO filed rates."
    }
  ],
  "total": 580700,
  "benefits": [
    { "id": "roadside_24_7", "title": "24/7 roadside assistance", "titleVi": "Cứu hộ giao thông 24/7", "why": "peace of mind on every trip" }
  ],
  "bundle": "SAFE_DRIVE",
  "status": "open",
  "createdAt": "2026-10-07T03:12:44.120Z",
  "expiresAt": "2026-10-08T03:12:44.120Z"
}
```

Notes:
- Amounts are **integers in VND**. `total` = `premiumNet` + `vat`. Personal accident is VAT-exempt.
- **TNDS premiums are regulated and identical at every insurer.** Do not present any discount on them.
- Rates for `PA_SEAT` and `MOTOR_PD` in the sandbox are **illustrative**. Production uses TASCO's filed rates.
- A quote is valid for **24 hours** (`expiresAt`).
- `bundle` is set when the products match a published bundle (`SAFE_DRIVE` = TNDS + PA, `FULL_MOTOR` = TNDS + PD + PA). Bundle price is the sum of its components.

### 3.2 Bind (buy) a quote: `POST /api/partner/v1/orders`

Pays and issues every line of a quote. **Idempotent**: send an `Idempotency-Key` that is unique per purchase attempt and reuse it on retries. A retried request with the same key and quote returns the original order and **never charges twice**.

| Header | Required | Rules |
|---|---|---|
| `Idempotency-Key` | ✓ | 8–100 characters: letters, digits, `_` or `-`. Use a UUID or your own order reference. |

| Body field | Type | Required |
|---|---|---|
| `quoteId` | string | ✓ (must be a quote created with **your** key) |
| `holderName` | string (≤ 120) | Optional override of the policyholder name |

```bash
curl -sS -X POST "$BASE/api/partner/v1/orders" \
  -H "X-Api-Key: $KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: bank01-order-2026-000457" \
  -d '{ "quoteId": "Q-6f1c2d9e-3a4b-4c5d-8e9f-0a1b2c3d4e5f", "holderName": "Nguyễn Văn An" }'
```

**Response `200`** (first call)

```json
{
  "order": {
    "id": "O-9a8b7c6d5e4f3a2b1c0d",
    "quoteId": "Q-6f1c2d9e-3a4b-4c5d-8e9f-0a1b2c3d4e5f",
    "profileId": "30A12345",
    "channel": "partner_api",
    "partnerId": "P-BANK-01",
    "amount": 580700,
    "status": "completed",
    "paymentRef": "VW-1a2b3c4d5e6f",
    "policies": ["TAS-TNDSCA-2026-100001", "TAS-PASEAT-2026-100002"],
    "commission": [
      { "product": "TNDS_CAR", "rate": 0.05, "amount": 21850, "ruleId": "tnds_any", "capped": false },
      { "product": "PA_SEAT", "rate": 0.15, "amount": 15000, "ruleId": "pa", "capped": false }
    ],
    "completedAt": "2026-10-07T03:13:02.511Z"
  },
  "policies": [
    {
      "certNo": "TAS-TNDSCA-2026-100001",
      "policyNo": "POL-100001",
      "product": "TNDS_CAR",
      "plate": "30A-123.45",
      "startDate": "2026-11-06",
      "endDate": "2027-11-06",
      "total": 480700,
      "status": "active",
      "certificateUrl": "https://<platform-host>/verify/TAS-TNDSCA-2026-100001"
    }
  ],
  "idempotentReplay": false
}
```

**Retry with the same key** returns `200` with `"idempotentReplay": true` and the original `order` (the `policies` array is not repeated; fetch it with `GET /policies`).

**Certificate:** `certificateUrl` is the public verification page. Encode it as a QR code on your documents. Anyone (police, inspectors) can scan it to see validity, product, dates and a **masked** plate. No personal data is shown.

**Commission** is calculated on **net** premium, capped by statutory limits, and recorded on the order.

> **Payment settlement.** In v1, binding triggers payment through the platform's payment port (the VETC wallet in the sandbox). The settlement model for partner sales (partner-collected premium remitted to TASCO, or customer wallet payment with the customer's confirmation) is defined in your partner agreement and must be confirmed before production.

**Failure handling (read carefully):**

| Situation | What happened | What to do |
|---|---|---|
| Network timeout or no response | Unknown: the order may or may not have completed | Retry with the **same** `Idempotency-Key`. You get either the completed order (`idempotentReplay: true`) or the original attempt's outcome. |
| `503 UPSTREAM_UNAVAILABLE` (payment or issuance service down) | Nothing was charged, or the payment was refunded automatically if issuance failed after payment. The order is flagged for reconciliation. | Wait and retry with a **new** `Idempotency-Key` for the same quote (if it has not expired) |
| `200` with `"idempotentReplay": true` **and** `order.status` = `payment_failed` or `issuance_failed_refunded` | You re-sent the key of an attempt that had **failed** | **Always check `order.status`, not just the HTTP status.** Only `completed` means the policy was issued. Retry with a **new** key. |

> **Known v1 behaviour (KI-31).** Re-sending an `Idempotency-Key` whose attempt failed returns HTTP 200 with the failed order rather than the original error. Treat `order.status !== "completed"` as a failure.

### 3.3 List your policies: `GET /api/partner/v1/policies`

Returns policies sold through **your** partner account, newest expiry first.

| Query | Type | Default |
|---|---|---|
| `limit` | 1–500 | 50 |
| `offset` | ≥ 0 | 0 |

```bash
curl -sS "$BASE/api/partner/v1/policies?limit=100&offset=0" -H "X-Api-Key: $KEY"
```

Response: a JSON array of policy objects (fields as in the order response, plus `premiumNet`, `vat`, `channel`, `partnerId`, `orderId`, `issuedAt`, `insurer`).

### 3.4 Commission statement: `GET /api/partner/v1/statement`

| Query | Type | Notes |
|---|---|---|
| `from` | date `YYYY-MM-DD` | Inclusive (order creation date) |
| `to` | date `YYYY-MM-DD` | Inclusive |

```bash
curl -sS "$BASE/api/partner/v1/statement?from=2026-10-01&to=2026-10-31" -H "X-Api-Key: $KEY"
```

```json
{
  "partnerId": "P-BANK-01",
  "from": "2026-10-01",
  "to": "2026-10-31",
  "orders": 42,
  "totalCommission": 1287450,
  "lines": [
    { "orderId": "O-9a8b7c6d5e4f3a2b1c0d", "date": "2026-10-07", "product": "TNDS_CAR", "rate": 0.05, "amount": 21850, "ruleId": "tnds_any", "capped": false }
  ]
}
```

Only **completed** orders appear. This is the same statement your TASCO partner manager sees.

---

## 4. Errors

All errors use one format:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid licence plate",
    "details": null,
    "requestId": "bank01-req-000123"
  }
}
```

- `requestId` echoes your `X-Request-Id` header (8–64 characters: letters, digits, `_`, `-`) or is generated. It is also returned in the `X-Request-Id` response header. **Log it and quote it to support.**
- `details` may list field-level problems for validation errors.

| HTTP | `code` | Typical cause | What to do |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | Missing or invalid field; invalid plate or phone; missing or badly formed `Idempotency-Key`; unknown product; unsupported `sumInsuredPerSeat` or `deductible`; malformed JSON | Fix the request. Do not retry unchanged. |
| 401 | `UNAUTHENTICATED` | Missing, invalid or revoked `X-Api-Key`; partner suspended | Check the key. Contact your partner manager. |
| 403 | `FORBIDDEN` | Key not allowed for this operation; origin not allowed (CORS) | Contact your partner manager |
| 404 | `NOT_FOUND` | Quote not found **or created by another partner**; wrong path | Check the ID and path |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP method | Fix the method |
| 409 | `CONFLICT` | Concurrent update of the same record | Retry after a short delay |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Body sent without `Content-Type: application/json` | Set the header |
| 422 | `BUSINESS_RULE_VIOLATION` | Product not sold on this channel ("… is not sold on channel partner_api"); "Quote expired — please re-quote"; "Quote is converted" (already bought); sum insured above the online limit ("refer to underwriter") | Re-quote or change the request |
| 429 | `RATE_LIMITED` | Too many requests (default 300 per minute per client IP) | Wait for the `Retry-After` seconds, then retry with back-off |
| 503 | `UPSTREAM_UNAVAILABLE` | Payment or TASCO core temporarily unavailable | Retry with exponential back-off. For orders, use a **new** `Idempotency-Key` (see §3.2 Failure handling). |
| 500 | `INTERNAL_ERROR` | Unexpected error | Retry once. If it persists, contact support with the `requestId`. |

### Retry policy (recommended)
- Retry only `429`, `503` and network timeouts. Use exponential back-off with jitter (1 s, 2 s, 4 s, 8 s; maximum 5 attempts).
- For `POST /orders`, reuse the same `Idempotency-Key` only when the outcome is **unknown** (timeout). After a definite failure (`503`, or a replay whose `order.status` is not `completed`), use a **new** key.
- Never retry `400`, `401`, `403`, `404` or `422` without changing something.

---

## 5. Data protection obligations
- Send personal data (name, phone) only when needed for the policy, and only with a lawful basis under Vietnam's personal data protection rules (Decree 13/2023/ND-CP and the PDP Law).
- Set `consentMarketing: true` **only** when the customer explicitly agreed to marketing by TASCO/VETC.
- Do not store certificate data longer than your agreement allows. Do not scrape the public verification page.
- Never present TNDS with discount, rebate or cashback wording.

## 6. Testing checklist (sandbox certification)
1. Quote TNDS for a known plate and for a new plate (with `currentExpiry` and `seats`).
2. Quote TNDS + PA (expect bundle `SAFE_DRIVE`).
3. Order with an `Idempotency-Key`. Repeat the same call and expect `idempotentReplay: true`, `order.status: "completed"` and no second charge.
4. Order an expired quote and expect `422`.
5. Use another partner's quote ID and expect `404`.
6. Missing `Idempotency-Key`: expect `400`. Missing or invalid key: expect `401`.
7. Fetch policies and the statement for the test period. Check that commission matches the rates.
8. Scan the `certificateUrl` QR and check that the verification page shows **valid** and a masked plate.

Your partner manager signs off sandbox certification before issuing a production key.

## 7. Change log
| Version | Date | Change |
|---|---|---|
| v1 | 2026-10 | First release: quotes, orders (idempotent), policies, statement |
