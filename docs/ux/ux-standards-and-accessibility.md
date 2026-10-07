# UX Standards and Accessibility

These standards apply to all three v1 surfaces: the staff console (`/`), the customer app (`/app/`) and the certificate check (`/verify/<certNo>`). They are part of the Definition of Done (see `docs/delivery/delivery-methodology.md`).

**Conformance target: WCAG 2.2 Level AA** on all surfaces. This also serves Vietnam's accessibility expectations for public-facing digital services and the VETC app's own webview standards.

---

## 1. WCAG 2.2 AA — requirements and how we apply them

### 1.1 Perceivable

| SC | Requirement | How applied |
|---|---|---|
| 1.1.1 Non-text content | Text alternatives | Logos have `alt="TASCO Insurance"`. Decorative icons have `aria-hidden="true"`. The QR code has alt text containing the certificate number and the verification URL in text below it. Charts have a data-table alternative. |
| 1.3.1 Info and relationships | Semantic structure | Real `<table>` with `<th scope>`. Form `<label for>`. Headings in order (one `h1` per page). Lists for navigation. |
| 1.3.2 Meaningful sequence | DOM order = visual order | No CSS reordering of interactive content. |
| 1.3.4 Orientation | Not locked | Customer app works in portrait and landscape. |
| 1.3.5 Identify input purpose | `autocomplete` | `username`, `current-password`, `one-time-code` (MFA), `tel`. |
| 1.4.1 Use of colour | Never colour alone | Tier, status and confidence badges always have text. Errors have an icon and text. |
| 1.4.3 Contrast (minimum) | 4.5:1 text, 3:1 large | Token pairs verified in light and dark (`design-system.md` §3.1). Teal `#70CAC8` is never used for text on white. |
| 1.4.4 Resize text | 200 % without loss | rem-based type. Layouts reflow. |
| 1.4.10 Reflow | 320 CSS px without horizontal scroll | Tables collapse to cards. Navigation collapses. The Rules studio JSON editor scrolls **inside** its own container only. |
| 1.4.11 Non-text contrast | 3:1 for UI components | Input borders on focus or hover, the focus ring (`--focus` `#1E6FFF`), toggle tracks, chart lines. |
| 1.4.12 Text spacing | Survives user spacing overrides | No fixed-height text containers. |
| 1.4.13 Content on hover or focus | Dismissible, hoverable, persistent | Tooltips (score reasons) open on focus and hover and close with Esc. |

### 1.2 Operable

| SC | Requirement | How applied |
|---|---|---|
| 2.1.1 Keyboard | Everything by keyboard | All actions reachable with Tab/Shift+Tab, Enter/Space. Custom widgets follow ARIA Authoring Practices patterns. Row "Open" links. |
| 2.1.2 No keyboard trap | | Drawers and modals trap focus intentionally but close with Esc and return focus. |
| 2.1.4 Character key shortcuts | Can be turned off or need a modifier | Shortcuts (section 1.5) only fire when focus is not in an input, and can be turned off in the user menu. |
| 2.2.1 Timing adjustable | Session timeout warning | Staff JWT lifetime is 30 min (`JWT_TTL_SECONDS`). The console warns 2 min before expiry with a "Stay signed in" option, and on expiry shows "Phiên đã hết hạn — vui lòng đăng nhập lại" while keeping unsent form input. The MFA step token lasts 5 min. Quotes are valid for 24 h, and the expiry time is shown on the quote. |
| 2.3.1 Three flashes | None | No flashing content. |
| 2.4.1 Bypass blocks | **Skip link** | "Bỏ qua đến nội dung chính / Skip to main content" is the first focusable element and targets `<main id="main" tabindex="-1">`. |
| 2.4.2 Page titled | `<title>` per view | "Hộp việc telesales — TASCO Growth Platform". Updated on route change (hash routes). |
| 2.4.3 Focus order | Logical | On route change, focus moves to the page `h1`. |
| 2.4.6 Headings and labels | Descriptive | |
| 2.4.7 Focus visible | Always | 2 px `--focus` outline with 2 px offset. Never `outline: none` without a replacement. |
| **2.4.11 Focus not obscured (min)** (new in 2.2) | Sticky header and toasts never hide the focused element | `scroll-padding-top` equals the header height. Toasts sit in a corner away from the focus path. |
| 2.5.3 Label in name | Visible label is part of the accessible name | |
| **2.5.7 Dragging movements** (new in 2.2) | Single-pointer alternative | No drag-only interaction. Assignment uses a select, not drag-and-drop. |
| **2.5.8 Target size (min)** (new in 2.2) | ≥ 24 × 24 px | Customer app 44 px (`--tap`). Staff console ≥ 32 px with spacing. |

### 1.3 Understandable

| SC | Requirement | How applied |
|---|---|---|
| 3.1.1 / 3.1.2 Language | `lang` set | `<html lang="vi">` or `"en"` follows the language toggle. Mixed-language fragments (English rule IDs) are marked `lang="en"`. |
| 3.2.1 / 3.2.2 Predictable | No context change on focus or input | Filters apply on "Áp dụng" or after a debounced change with a live-region announcement. Never navigates on select. |
| **3.2.6 Consistent help** (new in 2.2) | Help in the same place on every page | "?" in the top bar opens the contextual help drawer on every page. The customer app has "Trợ giúp" in the Tài khoản tab and the hotline in the footer. |
| 3.3.1 / 3.3.3 Error identification and suggestion | Clear errors with a fix | Section 9 patterns. Server validation `details` mapped to fields. |
| 3.3.2 Labels or instructions | Visible labels and format hints | "Ví dụ: 30A-123.45", "dd/mm/yyyy". |
| 3.3.4 Error prevention (legal, financial) | Review and confirm | Purchase shows a review step (products, premium incl. VAT, period, wallet) before "Thanh toán". DSAR erase and key revocation need confirmation. Rule approval shows the diff and needs a comment. |
| **3.3.7 Redundant entry** (new in 2.2) | Don't ask twice | The plate and vehicle are pre-filled from the session. The quote carries into payment. Expiry confirmed once is reused. |
| **3.3.8 Accessible authentication (min)** (new in 2.2) | No cognitive test | Password managers and paste allowed. The TOTP field allows paste and `autocomplete="one-time-code"`. No CAPTCHA puzzles. |

### 1.4 Robust

| SC | Requirement | How applied |
|---|---|---|
| 4.1.2 Name, role, value | Native elements first. ARIA only where needed. | Toggles are `<button aria-pressed>`. Tabs use `role="tablist"`. The drawer uses `role="dialog"`. |
| 4.1.3 Status messages | Live regions | See section 1.6. |

### 1.5 Keyboard map (staff console)

| Key | Action |
|---|---|
| Tab / Shift+Tab | Move focus |
| Enter / Space | Activate |
| Esc | Close drawer, modal or menu |
| `?` (Shift + /) | Open contextual help (when not typing) |
| `g` then `i` / `l` / `r` | Go to Telesales inbox / Leads / Rules studio (optional, can be turned off) |
| `/` | Focus the page search or filter |
| Arrow keys | Move within tabs, menus and radio groups |

### 1.6 ARIA landmarks and live regions

| Landmark | Element |
|---|---|
| Banner | `<header>` (top bar) |
| Navigation | `<nav aria-label="Main">` (left navigation), `<nav aria-label="Breadcrumb">` where used |
| Main | `<main id="main">` |
| Complementary | Help drawer `<aside>` (dialog when open) |
| Contentinfo | `<footer>` (iorta TechNXT credit, version from `/api/meta`) |

| Live region | Politeness | Announces |
|---|---|---|
| Toast region | polite (assertive for errors) | Saved, claimed, approved, copy-guard rejection |
| List status | polite | "Hiển thị 50 / 2.431 khách hàng tiềm năng" after filters |
| Voice console transcript | polite | New bot line (`role="log"`) |
| Purchase progress | polite | "Đang thanh toán…", "Đã cấp giấy chứng nhận" |
| Session warning | assertive | Expiry in 2 minutes |

### 1.7 Reduced motion and other preferences
- `prefers-reduced-motion: reduce` sets `--motion` to `0ms`, disables shimmer and replaces the success animation with a static check.
- `prefers-color-scheme` drives the default theme. The user's choice (`data-theme`) overrides it.
- `forced-colors: active` (Windows High Contrast): borders and focus use system colours. Badges keep their text.

### 1.8 Testing protocol (per story touching UI)
1. Automated: axe-core with zero serious or critical issues, run in CI on core routes.
2. Keyboard-only walkthrough of the changed flow.
3. Screen readers: NVDA + Firefox (Windows, staff) and VoiceOver + Safari iOS / TalkBack + Chrome Android (customer), in Vietnamese voice.
4. Zoom 200 % and 320 px reflow.
5. Contrast check of any new colour pairing in both themes.
6. Release accessibility audit by an external specialist before G3, then annually.

---

## 2. Responsive breakpoints

| Name | Min width | Staff console | Customer app |
|---|---|---|---|
| `xs` | 0 | Not supported for heavy work (read-only usable) | **Design target** (360 px). Single column, bottom tab bar. |
| `sm` | 480 px | Stacked cards | Single column, wider cards |
| `md` | 768 px | Navigation collapses behind a menu button. Tables become cards. | Centred column, max-width 560 px |
| `lg` | 960 px | Left navigation visible (240 px), 1–2 column content | Same |
| `xl` | 1280 px | **Design target**. Content max-width 1440 px. Customer 360 in 3 columns. | Same |

Page gutters are 16 px on phones and 24–32 px on desktop.

---

## 3. Performance budgets

| Metric | Customer app (mid-range Android, 4G) | Staff console (office laptop) | Certificate check |
|---|---|---|---|
| Largest Contentful Paint (p75) | ≤ 2.0 s | ≤ 2.5 s | ≤ 1.5 s |
| Interaction to Next Paint (p75) | ≤ 200 ms | ≤ 200 ms | ≤ 200 ms |
| Cumulative Layout Shift | ≤ 0.05 | ≤ 0.1 | ≤ 0.05 |
| JS shipped (gzip) | ≤ 70 KB | ≤ 150 KB | ≤ 20 KB |
| CSS (gzip) | ≤ 20 KB | ≤ 30 KB | ≤ 10 KB |
| Fonts | ≤ 2 files, `font-display: swap`, Vietnamese subset | same | System fonts only |
| API p95 (server) | Quote ≤ 300 ms, order ≤ 1.5 s (wallet + issuance) | Lists ≤ 400 ms, Customer 360 ≤ 600 ms | ≤ 150 ms |
| Taps to renew | ≤ 3 | — | — |

The v1 front end has no build step and uses ES modules, so the budgets are achievable without a framework. Static assets under `/assets/` are cached for 24 h and HTML is `no-cache` (`src/adapters/http/app.js`). Performance is checked with Lighthouse CI (front end) and `npm run test:perf` (API).

---

## 4. Internationalisation and localisation

| Aspect | Standard |
|---|---|
| Languages | `vi` (default) and `en`. The staff console toggle (VI/EN) is stored per browser. The customer app is Vietnamese, with English only where VETC enables it. |
| String management | All UI strings in the catalogue (`public/js/shared/i18n.js`), keyed, with no concatenated sentences. Customer message templates and voice lines are **rule content** (`content.messages`, `content.voicebot`) with `vi` and `en` variants, governed by maker-checker. |
| Data values | Not translated (plates, IDs, rule IDs). Product names use `name`/`nameVi`. Tariff categories use `label`/`labelVi`. Benefits use `title`/`titleVi`. |
| Dates | Display `dd/mm/yyyy`. Store and transmit ISO `yyyy-mm-dd`. The time zone is ICT (UTC+7, as `timezoneOffsetHours: 7` in `contact_policy`). |
| Numbers and currency | `Intl.NumberFormat('vi-VN')` gives `480.700 ₫`. Voice uses "đồng". English view: `480,700 VND`. |
| Names | Vietnamese full names in one field (family name first). Masking keeps the given name last ("N. V. An"). |
| Plates and phones | Normalised server-side (`src/domain/identity.js`). Display formats are `30A-123.45` and `0912***678`. |
| Diacritics | Search and voice intent matching ignore diacritics (`stripDiacritics`), so "gia han" matches "gia hạn". |
| Text expansion | Allow 30 % growth for English. No truncation of labels in buttons or navigation. |
| Sorting | Vietnamese collation (`Intl.Collator('vi')`) for name lists. |

---

## 5. Personalisation

| Mechanism | Behaviour | Source |
|---|---|---|
| **Role-based navigation** | Only pages the user's permissions allow are shown. The server enforces permissions on every API call regardless of what the UI shows. | `GET /api/auth/me` → `permissions`, `config/security/rbac.json` |
| **Role-based home** | Users with `dashboard:read` land on **Home** (role-relevant KPIs). Others land on their first permitted page: telesales agents → Telesales inbox, claims handlers → Claims, support engineers → Operations. | Console routing (`firstAllowedRoute`) |
| **Regional scope** | Agents see leads, handoffs and customers of their region (ABAC `regional_data`, `agent_own_handoffs`). The region shows in the user menu. | `config/rules/abac.json` |
| **PII masking by purpose** | Name and phone masked without `profile:read_pii`, with a "Đã che" badge. Every Customer 360 view is audited (`profile.viewed`). | `accessPolicy.maskProfile` |
| **Next best action (NBA)** | One guided button per lead or customer with the reason ("high intent and call consent on file"). It respects DNC, company-owned routing and low data confidence. | `config/rules/nba.json` |
| **Benefit relevance** | Customers see up to 3 benefits (`maxShown`) ranked by relevance to them (for example, roadside assistance for long-distance drivers, accident cover for 7+ seat vehicles), with a "why" line. Only approved items appear. | `config/rules/benefits.json` |
| **Saved preferences** | Language, theme, table density, dismissed tips, stored per browser (localStorage, wrapped in try/catch). | Front end |

---

## 6. Contextual help and guided actions

1. **Help drawer ("?")** on every console page. It holds a page-specific title and 2–4 short paragraphs (`public/js/console/help.js`), plus links to the relevant persona manual section in `docs/manuals/`. It opens with the "?" key or button and closes with Esc.
2. **Inline "why" affordances:** score reasons, NBA reasons, blocked-send reasons, copy-guard violations, rule validation errors with JSON path (`$.factors[2].value`).
3. **Guided action buttons:** the NBA button on Leads and Customer 360 (for example "AI voice bot call → telesales handoff", "Ask customer to confirm expiry in-app", "Route to fleet / B2B team"). Each opens the corresponding pre-filled action (start voice session, send link, quote).
4. **First-run tips:** a dismissible coach mark on the first visit to the Telesales inbox, Rules studio and Customer 360 (max 3 steps, keyboard accessible, never blocking).
5. **Empty states that teach:** see `design-system.md` §4.11.
6. **Demo mode helpers (sandbox only):** quick role picker and "Demo: fill code" for MFA on sign-in. The customer app has a vehicle picker. These are hidden when `/api/meta` reports `demoMode: false`.

---

## 7. Forms and data entry standards
- Single-column forms. Group related fields with `<fieldset>` and `<legend>`.
- Validate on blur and on submit. Never block typing.
- Preserve input on error and on session expiry.
- Destructive or financial actions need a confirmation step (WCAG 3.3.4).
- Show the server's rule message verbatim when it is user-meaningful (for example "Incident date is outside the policy period").

---

## 8. Data display standards
- Show **confidence** next to inferred data (expiry, vehicle category) as a badge with percentage.
- Show **provenance** (lineage chip) for golden-record fields.
- Show **as-of** time on dashboards (`asOf` from `/api/dashboard/overview`).
- Long IDs use mono with a copy button. UUID-like IDs are truncated in the middle (`Q-3f2a…9c1d`) with the full value in the accessible name.

---

## 9. Error message patterns

The API returns `{ "error": { "code", "message", "details", "requestId" } }`. The UI maps codes to the patterns below. User-facing text is Vietnamese-first, with the request ID shown in small text for support ("Mã hỗ trợ: 7f3c…").

| Code (HTTP) | Situation | Staff console message pattern | Customer app message pattern |
|---|---|---|---|
| `VALIDATION_FAILED` (400) | Bad input | Inline field errors from `details`, plus a summary "Vui lòng kiểm tra lại các trường được đánh dấu." | "Thông tin chưa hợp lệ: {field}. {hint}" |
| `UNAUTHENTICATED` (401) | Bad credentials or expired session | Sign-in: "Tên đăng nhập hoặc mật khẩu không đúng." Session: "Phiên đã hết hạn — vui lòng đăng nhập lại." | "Đường dẫn đã hết hạn hoặc không hợp lệ. Vui lòng mở lại từ ứng dụng VETC." |
| `FORBIDDEN` (403) | Missing permission or ABAC denial | "Bạn không có quyền thực hiện thao tác này ({permission}). Liên hệ quản trị viên nếu cần." | "Không thể thực hiện thao tác này." |
| `NOT_FOUND` (404) | Missing entity | "Không tìm thấy {đối tượng}. Có thể đã bị xóa hoặc bạn không có quyền xem." | "Không tìm thấy thông tin." |
| `CONFLICT` (409) | Concurrent edit (for example, the handoff was updated by someone else) | "Dữ liệu vừa được người khác cập nhật. Tải lại để xem thay đổi mới nhất." with a Reload button | — |
| `BUSINESS_RULE_VIOLATION` (422) | Valid input that breaks a rule (quote expired, DNC, maker-checker, invalid transition, active policy blocks erasure) | Show the server message (it is written for users), for example "Maker-checker: you cannot approve your own change" → "Bạn không thể tự duyệt thay đổi của chính mình." | "Báo giá đã hết hạn — vui lòng lấy báo giá mới." with a primary "Lấy báo giá mới" |
| `ACCOUNT_LOCKED` (423) | 5 failed attempts | "Tài khoản tạm khóa 15 phút do nhập sai nhiều lần." | — |
| `RATE_LIMITED` (429) | Too many requests or sign-ins | "Quá nhiều yêu cầu — vui lòng thử lại sau {Retry-After} giây." | Same, simplified |
| `UPSTREAM_UNAVAILABLE` (503) | Wallet, core or messaging down (circuit open) | "Hệ thống đối tác tạm thời gián đoạn ({integration}). Thao tác chưa được thực hiện; vui lòng thử lại." | "Thanh toán tạm thời gián đoạn. Bạn **chưa bị trừ tiền**. Vui lòng thử lại sau ít phút." Only claim "not charged" when the order status confirms it. |
| `INTERNAL_ERROR` (500) | Unexpected | "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại; nếu vẫn lỗi, gửi mã hỗ trợ {requestId} cho bộ phận hỗ trợ." | "Đã có lỗi. Vui lòng thử lại. Mã hỗ trợ: {requestId}" |

Principles: say what happened, say what to do next, never blame the user, never show stack traces, always keep the request ID available, and never lose the user's input.
