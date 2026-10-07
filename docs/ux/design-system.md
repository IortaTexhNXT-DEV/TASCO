# Design System — TASCO Growth Platform (v1 UI)

The design system covers three surfaces:

| Surface | URL | Users | Primary device |
|---|---|---|---|
| **Staff console** | `/` | TASCO / VETC staff (telesales, campaign, compliance, data, claims, partners, admin, executives) | Desktop and laptop (≥ 1280 px), usable on tablet |
| **Customer app** | `/app/` (in the VETC app webview or Zalo, opened from a signed renewal link) | VETC drivers | Mobile (360–430 px) |
| **Certificate check** | `/verify/<certNo>` | Police, inspectors, anyone scanning the QR code | Mobile |

Implementation: CSS custom properties in `public/css/tokens.css`, shared components in `public/css/components.css`, and surface styles in `console.css` and `customer.css`. Strings are in `public/js/shared/i18n.js` and contextual help in `public/js/console/help.js`.

---

## 1. Design principles

| # | Principle | What it means in practice | Example |
|---|---|---|---|
| 1 | **Consumer-grade** | Staff tools should feel as easy as a good consumer app. No training should be needed for the common path. | The telesales inbox shows one primary action per card: "Claim". |
| 2 | **Trust-first** | Every customer touch proves it is genuine and respects privacy. Staff see only what they need. | The customer app shows the plate *masked* until the session is verified. The certificate check shows no personal data. PII is masked for roles without `profile:read_pii`. |
| 3 | **Low-click** | Renewal in **≤ 3 taps** from the link. Agent "claim → call → quote → issue" in ≤ 6 clicks. | One-tap renew card with add-ons as toggles, not a new page. |
| 4 | **Mobile-first** (customer) / **keyboard-first** (staff) | Customer layouts are designed at 360 px and scale up. Staff power users can do everything from the keyboard. | 44 px tap targets. Skip link. Visible focus. |
| 5 | **Explain, don't just show** | Scores, actions and blocked sends always carry a reason. | Lead score shows its factor breakdown. A skipped touchpoint shows "outside allowed contact hours". |
| 6 | **Value, never discount** | TNDS pricing is regulated, so we sell service value. Copy never implies price reduction. | The benefits card lists roadside assistance, e-certificate and auto-renew. "Phí theo quy định Nhà nước, giống mọi nơi." |
| 7 | **Guided** | The next best action is always one obvious button. Help is one key away. | NBA button on lead and Customer 360. "?" opens the help drawer. |
| 8 | **Inclusive** | WCAG 2.2 AA. Readable by older drivers in sunlight. Works in both themes. | Base font 16 px. Contrast ≥ 4.5:1. Dark mode. |

---

## 2. Brand

| Element | Usage |
|---|---|
| **TASCO Insurance logo** (`public/assets/tasco-logo.png`) | Top-left of the staff console and the header of the customer app and certificate check. Minimum height 28 px on mobile and 32 px on desktop. Clear space equals the height of the "T". Never recolour or stretch it. On dark surfaces, place it on a white rounded tile (`--radius-sm`). |
| **TASCO navy** `#213368` | Primary brand colour: header, primary buttons, active navigation. Sampled from the logo (close to the brief's `#1B2A6B`). |
| **TASCO teal** `#70CAC8` | Brand accent: highlights, illustrations, progress, success moments (e-certificate). **Not for text on white** (contrast too low). Use `--brand-teal-ink` `#0B6B66` for teal text. Sampled from the logo (close to the brief's `#6CCFC6`). |
| **VETC co-brand** | In the customer app the header says "VETC × Bảo hiểm TASCO". Messages start with "VETC:" because they are sent from VETC channels. |
| **iorta TechNXT credit** | Footer of the staff console and the sign-in page: "Built by iorta TechNXT" with the logo (`public/assets/iorta-technxt-logo.jpg`) at 20 px height, `--text-muted`. Not shown in the customer app or on the certificate check, where the customer relationship belongs to TASCO and VETC. |

---

## 3. Design tokens

Tokens are CSS custom properties defined on `:root` and redefined for dark mode. Dark mode applies either automatically through `prefers-color-scheme: dark`, unless the user forced light with `data-theme="light"`, or explicitly through `:root[data-theme="dark"]`. The theme toggle in the top bar sets `data-theme` and remembers the choice per browser.

### 3.1 Colour

| Token | Light | Dark | Use | Contrast (on `--surface`) |
|---|---|---|---|---|
| `--brand-navy` | `#213368` | `#213368` | Logo areas, header band | ≈ 12:1 on white |
| `--brand-navy-600` | `#2C4386` | — | Primary hover | ≈ 9.3:1 |
| `--brand-teal` | `#70CAC8` | `#70CAC8` | Decorative accent only | 1.9:1 (non-text only) |
| `--brand-teal-ink` | `#0B6B66` | — | Teal text and links on light | ≈ 6.3:1 |
| `--bg` | `#F5F7FB` | `#0D1324` | Page background | — |
| `--surface` | `#FFFFFF` | `#141C33` | Cards, tables, drawers | — |
| `--surface-2` | `#EEF2F8` | `#1B2542` | Zebra rows, input backgrounds, hover | — |
| `--border` | `#D5DCE8` | `#2C3A60` | Dividers, input borders (with a 3:1 focus/hover state) | — |
| `--text` | `#121A33` | `#E9EEFB` | Body text | ≈ 17:1 / 14.6:1 |
| `--text-muted` | `#4A5573` | `#A9B4D0` | Secondary text, captions | ≈ 7.4:1 / 8.2:1 |
| `--primary` | navy | `#8FA6FF` | Primary buttons, links, active nav | ≥ 4.5:1 |
| `--primary-contrast` | `#FFFFFF` | `#0D1324` | Text on primary | ≥ 4.5:1 |
| `--accent` | `#0B6B66` | `#7FDCD8` | Secondary emphasis | ≥ 4.5:1 |
| `--focus` | `#1E6FFF` | `#1E6FFF` | Focus ring (2 px outline + 2 px offset) | ≥ 3:1 against adjacent colours |
| `--ok` / `--ok-bg` | `#11734B` / `#E2F5EC` | `#5FD39C` / `#12352A` | Success, active policy, "valid" | ≥ 4.5:1 |
| `--warn` / `--warn-bg` | `#8A5300` / `#FFF1D6` | `#FFC266` / `#3B2A0D` | Warnings, expiring soon, low confidence | ≥ 4.5:1 |
| `--danger` / `--danger-bg` | `#B3261E` / `#FDE7E6` | `#FF8A80` / `#3D1614` | Errors, lapsed cover, destructive | ≥ 4.5:1 |
| `--info` / `--info-bg` | `#1B4FA8` / `#E3EDFF` | `#9CBCFF` / `#152648` | Information, help | ≥ 4.5:1 |
| `--hot` / `--warm` / `--nurture` | danger / warn / muted | same mapping | Lead tier badges (always paired with a text label) | ≥ 4.5:1 |

Rules:
- Colour is **never the only signal**. Tier badges read "Hot", "Warm" and "Nurture". Status badges have text and an icon.
- Charts use the categorical palette `navy`, `teal-ink`, `#8A5300`, `#6B3FA0`, `#B3261E`, `#4A5573`, with a direct label or legend and a data table alternative.

### 3.2 Typography

Font stack: `"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif`. Be Vietnam Pro was designed for Vietnamese diacritics, which stack (ệ, ỗ, ữ). The system fallbacks render Vietnamese correctly. Monospace (`--mono`) is used for plates, certificate numbers, IDs and JSON in the Rules studio.

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `--fs-xs` | 12 px (0.75 rem) | 1.5 | 500 | Badges, table meta. Never for body copy. |
| `--fs-sm` | 14 px | 1.5 | 400 | Table cells, helper text |
| `--fs-md` | 16 px | 1.5 | 400 | Body (customer app minimum) |
| `--fs-lg` | 18 px | 1.4 | 600 | Card titles, customer app primary values |
| `--fs-xl` | 22 px | 1.3 | 700 | Page titles (h1) |
| `--fs-2xl` | 28 px | 1.2 | 700 | KPI values, the customer app's cover status |

Text sizes are in `rem`, so browser zoom and OS font scaling are honoured up to 200 % without loss of content. Plates use tabular numbers and `letter-spacing: 0.02em`.

### 3.3 Spacing (4-point scale)

| Token | Value | Typical use |
|---|---|---|
| `--sp-1` | 4 px | Icon to label |
| `--sp-2` | 8 px | Inside badges, dense tables |
| `--sp-3` | 12 px | Form field gap |
| `--sp-4` | 16 px | Card padding (mobile), page gutter on phones |
| `--sp-5` | 24 px | Card padding (desktop), section gap |
| `--sp-6` | 32 px | Page sections |
| `--sp-7` | 48 px | Hero / empty-state spacing |

### 3.4 Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6 px | Inputs, badges, small buttons |
| `--radius` | 10 px | Buttons, cards, table containers |
| `--radius-lg` | 16 px | Customer app cards, modals, drawers, bottom sheets |

### 3.5 Elevation

| Token | Value (light) | Use |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(18,26,51,.08), 0 1px 3px rgba(18,26,51,.06)` | Cards, sticky headers |
| `--shadow-2` | `0 6px 24px rgba(18,26,51,.14)` | Drawers, modals, toasts, menus |

Dark mode uses stronger, neutral shadows (`rgba(0,0,0,.4/.5)`) and relies on surface steps (`--surface` → `--surface-2`) for hierarchy.

### 3.6 Motion

| Token | Value | Use |
|---|---|---|
| `--motion` | `160ms cubic-bezier(0.2, 0, 0, 1)` | Hover, drawer and toast entry, accordion |
| Reduced motion | `0ms linear` under `prefers-reduced-motion: reduce` | All animations are disabled. Skeleton shimmer becomes static. |

Motion is functional only: it shows where something came from. There is no parallax, autoplay or animation longer than 300 ms. The success moment (certificate issued) uses a 300 ms teal check animation that is skipped when reduced motion is on.

### 3.7 Sizing

| Token | Value | Use |
|---|---|---|
| `--tap` | 44 px | Minimum target size for all interactive elements in the customer app. Staff console minimum 32 px with ≥ 8 px spacing (WCAG 2.2 2.5.8 requires 24 px). |

---

## 4. Components

Each component lists anatomy, variants, states and accessibility notes. States for every interactive component are default, hover, focus-visible, active, disabled and loading.

### 4.1 Buttons

| Variant | Use | Style |
|---|---|---|
| **Primary** | One per view: the main action ("Gia hạn ngay", "Claim", "Approve") | `--primary` background, `--primary-contrast` text |
| **Secondary** | Alternative actions ("Send link", "Simulate") | `--surface` with a `--primary` border and text |
| **Ghost / tertiary** | Low-emphasis ("Cancel", "Show details") | Text only, underline on hover |
| **Danger** | Destructive or irreversible ("Reject", "Revoke key", "Erase data") | `--danger`. Always confirmed in a modal that names the object. |
| **NBA (guided action)** | Next best action on Leads and Customer 360 | Primary style with a leading lightbulb icon and the reason as helper text underneath |
| **Icon button** | Help "?", theme, close | 40 × 40 px (44 in customer app), `aria-label` mandatory |

Rules: labels are verbs ("Gửi đường dẫn", not "OK"). While loading, the button keeps its width, shows a spinner and sets `aria-busy="true"`, and is disabled to prevent double submit. Purchase buttons also send an `Idempotency-Key`, so a retried tap never double-charges.

### 4.2 Inputs and forms
- A label is always visible above the field (no placeholder-only labels). Helper text sits under the label and is linked by `aria-describedby`.
- **Plate input:** uppercase, mono, accepts any format ("30a12345", "30A-123.45") and normalises it; the example is shown as helper text "Ví dụ: 30A-123.45".
- **Phone input:** `inputmode="tel"`; accepts +84, 84 or 0 prefixes.
- **Date input:** native date picker on mobile. Shown as `dd/mm/yyyy` (sent as ISO `yyyy-mm-dd`).
- **Money:** read-only display `480.700 ₫`. Users never type premiums.
- **Errors:** inline under the field in `--danger` with an icon and the text "Lỗi: …". The field gets `aria-invalid="true"`. On submit, an error summary at the top of the form links to each field, and focus moves to the summary.
- Required fields are marked "(bắt buộc)" in text, not just with an asterisk.

### 4.3 Cards
- **Standard card:** `--surface`, `--radius`, `--shadow-1`, padding `--sp-5` (desktop) or `--sp-4` (mobile). Title `--fs-lg`.
- **Cover status card (customer app):** large status ("Còn 12 ngày", "Đã hết hạn", "Đang hiệu lực đến 05/11/2027"), coloured left border (ok/warn/danger) **plus** an icon and text, the masked plate and the primary action.
- **Benefit card:** icon, title (vi), one-line description, "why this matters to you" (from the `why` expression). Shows only benefits with `legalStatus: approved`. The staff view flags pending items with a "Chờ pháp chế duyệt / pending legal review" badge.
- **Handoff card (telesales inbox):** masked phone, plate with a "verified by customer" check when `plateVerifiedByCustomer`, days to expiry, premium, score, outcome, trust/price flags, talking points (collapsed), primary "Claim".

### 4.4 KPI tiles
Label (`--fs-sm`, muted), value (`--fs-2xl`, tabular), optional delta with arrow **and** text ("+12 % so với tuần trước"), optional sparkline with `aria-hidden` and the numbers available in a table toggle. A tile can link to the filtered list behind it.

### 4.5 Tables
- Sticky header, zebra rows (`--surface-2`), right-aligned numbers, mono for IDs.
- Sortable columns use `<button>` in the header with `aria-sort`.
- Row click is matched by an explicit "Open" link in the first column, so it works for keyboard and screen readers.
- Pagination: "Trước / Tiếp" plus the count "1–50 / 2.431". The default page size is 50 (API max 500).
- On narrow screens tables collapse into stacked cards. Data is never hidden without a "show more".

### 4.6 Badges

| Badge | Values | Style |
|---|---|---|
| Tier | Hot ≥ 70, Warm ≥ 45, Nurture (thresholds from `scoring` rules) | `--hot`/`--warm`/`--nurture` text on a tinted background, with the text label |
| Handoff status | open, claimed, callback, won, lost | info, primary, warn, ok, muted |
| Rule status | draft, pending_approval, active, retired, rejected | muted, warn, ok, muted-strikethrough, danger |
| Claim status | submitted, acknowledged, assessor_assigned, under_assessment, approved, paid, rejected | Progress colours, with the SLA countdown chip when before acknowledgement |
| Data confidence | ≥ 0.75 "Đã xác minh", 0.5–0.75 "Ước tính", < 0.5 "Chưa chắc chắn" | ok / warn / danger |
| Legal status | approved, pending_legal_review | ok / warn |
| PII | "Đã che / Masked" | info. Shown wherever data is masked for the user's role. |

### 4.7 Stepper
Used for customer renewal (Xác nhận → Thanh toán → Giấy chứng nhận), claims status and the rule lifecycle (Draft → Submitted → Approved/Active). Steps have a number and label, with `aria-current="step"` on the current step. Completed steps show a check icon and the text "(đã xong)" for screen readers.

### 4.8 Toasts
Top-right on desktop, bottom on mobile (above the tab bar). Variants: ok, info, warn, danger. Toasts sit in an `aria-live="polite"` region (danger uses `assertive`). They auto-dismiss after 6 s, except danger, which needs dismissal. Toasts are never the only place a critical result is shown: an issued certificate also renders on the page.

### 4.9 Drawer
Right-side drawer (480 px on desktop, full screen on mobile) for the contextual help ("?"), transcript detail and rule diff. `role="dialog"`, `aria-modal="true"`, labelled by its title. Focus is trapped while open, Esc closes it and focus returns to the trigger.

### 4.10 Modal
Used only for confirmations and short forms: approve/reject with a comment, revoke a key, DSAR erase, show the API key once. Confirmation text names the object ("Thu hồi khóa K-1a2b3c4d của Partner Bank?"). Destructive confirmation needs typing or explicit selection for irreversible actions (DSAR erase). The API-key modal has a "Copy" button, the warning "Khóa chỉ hiển thị một lần" and needs the explicit acknowledgement "Tôi đã lưu khóa" before it closes.

### 4.11 Empty states
Illustration (teal, decorative, `aria-hidden`), a one-line explanation and a next step. For example, the telesales inbox empty state reads "Không có việc đang chờ. Trợ lý gọi tự động sẽ chuyển khách hàng quan tâm vào đây." Filtered empty states offer "Đặt lại bộ lọc".

### 4.12 Skeletons and loading
Skeleton blocks matching the layout appear for loads over 300 ms, with `aria-busy="true"` on the region and a visually hidden "Đang tải…". Shimmer is disabled under reduced motion. For loads over 10 s, show a message with retry.

### 4.13 Navigation
- **Staff left navigation:** grouped as Work (Home, Telesales inbox, Leads, Voice bot, Claims), Growth (Journeys, Partners), Governance (Rules studio, Data quality, Audit) and Administration (Users, Operations). Items are filtered by permission. `aria-current="page"` marks the active item. It collapses to a menu button below 960 px.
- **Top bar:** logo, page title, language toggle (VI/EN), theme toggle, help "?", user menu (name, roles, region, sign out).
- **Customer bottom tab bar:** Trang chủ, Mua / Gia hạn, Bồi thường, Tài khoản. 4 tabs, icons with labels, 56 px tall.

### 4.14 Explainability widgets
- **Score breakdown:** a horizontal bar per factor (urgency, data confidence, engagement, reachability, relationship) with points and the reason text from the `scoring` rule. A total with tier badge.
- **Lineage chip:** next to fields in Customer 360, "Nguồn: vetc_account · 85 %", which opens field lineage.
- **Blocked reason:** inline warn text on touchpoints and messages ("copy guard: giảm giá").

---

## 5. Content style guide

### 5.1 Voice and tone
- **Vietnamese-first.** All customer content is written in Vietnamese first, with English for staff review only. Staff UI defaults to Vietnamese with an EN toggle.
- **Polite and warm.** Address customers as "Quý khách" in formal and voice contexts and "bạn" in app microcopy (VETC app convention). Be consistent within a screen.
- **Plain language.** Short sentences (≤ 20 words), everyday words. Explain "TNDS" once as "bảo hiểm trách nhiệm dân sự bắt buộc".
- **Reassuring and honest about security:** "VETC không bao giờ yêu cầu mã OTP hay thanh toán qua điện thoại."

### 5.2 No discount wording (mandatory)
The copy guard (`config/rules/copy_guard.json`) blocks these phrases in customer-facing rule content and at send time: **giảm giá, chiết khấu, hoàn tiền, khuyến mãi phí, rẻ hơn, discount, cashback, rebate, % off, cheaper, lower premium, price cut**. UI copy hard-coded in the front end must follow the same rule. It is reviewed in design review, because the guard only checks rule content.

| Don't | Do |
|---|---|
| "Giảm 10 % khi gia hạn qua VETC" | "Gia hạn qua VETC: cứu hộ 24/7 và giấy chứng nhận điện tử ngay" |
| "Rẻ hơn mua ngoài" | "Phí theo quy định Nhà nước, giống mọi nơi" |
| "Hoàn tiền vào ví" | "Thanh toán bằng ví VETC, nhận giấy chứng nhận ngay" |
| "Tích điểm khi xác nhận ngày hết hạn" (while loyalty is pending legal review) | "Xác nhận ngày hết hạn để được nhắc đúng lúc" |

Loyalty points or referral copy may appear **only** after the benefit's `legalStatus` is `approved` (and `referral.enabled` is true).

### 5.3 Formats
| Item | Format | Example |
|---|---|---|
| Date | `dd/mm/yyyy` | 05/11/2026 |
| Date and time | `HH:mm dd/mm/yyyy` (24-hour, ICT) | 14:30 05/11/2026 |
| Money | VND, dot as thousands separator, "₫" or "đồng" (voice) | 480.700 ₫ |
| Plate | Display format from normalisation | 30A-123.45 |
| Phone (masked) | First 4 + `***` + last 3 | 0912***678 |
| Name (masked) | Initials + last name | N. V. An |
| Percent | No space in Vietnamese | 85% |

### 5.4 Microcopy patterns
- Buttons: verb + object ("Gia hạn ngay", "Gửi đường dẫn", "Nhận việc").
- Confirmations: past tense + what happens next ("Đã cấp giấy chứng nhận. Bạn có thể tra cứu bằng mã QR.").
- Errors: what happened + how to fix it, without blame (see `ux-standards-and-accessibility.md` §9).
- Product names: use the `nameVi` from the `products` rule set. Do not invent new names.

### 5.5 Terminology (vi ↔ en)

| Vietnamese | English | Notes |
|---|---|---|
| Bảo hiểm TNDS bắt buộc | Compulsory third-party liability (TNDS) | |
| Giấy chứng nhận điện tử | E-certificate | |
| Gia hạn | Renew | |
| Hết hạn | Expiry / expires | |
| Cứu hộ giao thông 24/7 | 24/7 roadside assistance | |
| Đăng kiểm | Vehicle inspection | |
| Báo tai nạn | Report an accident (FNOL) | |
| Bảo hiểm tai nạn người ngồi trên xe | Driver and passenger accident cover | `PA_SEAT` |
| Bảo hiểm vật chất xe | Physical damage cover | `MOTOR_PD` |
| Ví VETC | VETC wallet | |
| Hộp việc telesales | Telesales inbox | |
| Hành động đề xuất | Next best action | |
| Quy tắc nghiệp vụ | Rules studio | |

---

## 6. Iconography
- **Style:** outline, 1.5 px stroke, 24 px grid (20 px in dense tables), rounded joins, `currentColor`.
- **Library:** a single open-source outline set (for example Lucide, ISC licence) bundled locally under `public/vendor/`, never loaded from a third-party CDN at runtime. The v1 console uses Unicode glyphs as placeholders, to be replaced with the icon set.
- **Accessibility:** decorative icons get `aria-hidden="true"`. Icon-only buttons have an `aria-label` in the current language.
- **Core icon map:**

| Concept | Icon |
|---|---|
| Home / dashboard | layout-dashboard |
| Telesales inbox | phone-incoming |
| Leads | star |
| Voice bot | mic |
| Claims | life-buoy |
| Journeys | route |
| Partners | handshake |
| Rules studio | scale |
| Data quality | badge-check |
| Audit | link (chain) |
| Users | users |
| Operations | settings |
| Roadside assistance | truck |
| E-certificate | qr-code |
| Auto renew | refresh-cw |
| Inspection | clipboard-check |
| Help | circle-help |
| PII masked | eye-off |

---

## 7. Governance of the design system
- The UX Lead owns it. Changes are proposed in the weekly design review and versioned in this file and `public/css/tokens.css` together.
- New components need: a use case, all states, light and dark variants, keyboard behaviour, screen-reader behaviour, and vi/en copy.
- Contrast is checked for every new token pairing, light and dark (target AA: 4.5:1 for text, 3:1 for UI components and focus indicators).
