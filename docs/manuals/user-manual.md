# Staff User Manual — TASCO Growth Platform (v1 UI)

This manual is for **all staff users** of the TASCO Growth Platform staff console. It covers signing in, finding your way around, the actions common to every role, getting help, and fixing common problems. For the details of your own job, read your **persona manual** (see [README.md](README.md)).

> **About this version.** This manual describes the **v1 UI**. Screen labels are shown in English with the Vietnamese label in brackets where useful. The console opens in Vietnamese by default. Small wording differences may appear while the UI is being finalised. The steps and permissions stay the same.

---

## 1. What the platform does

The platform helps TASCO Insurance and VETC sell and renew motor insurance, mainly compulsory third-party liability (TNDS), through the VETC ecosystem. It:

- builds a **trusted customer record** for each vehicle from VETC, TASCO and partner data, and shows how confident it is about each fact (for example, the policy expiry date);
- **scores and prioritises leads** and tells you the **next best action**, with reasons;
- runs **journeys**: reminders through the VETC app, Zalo and SMS, AI voice calls and telesales follow-up, within consent and anti-spam limits;
- lets customers **renew in the VETC app in a few taps** and receive an **e-certificate with a QR code**;
- lets partners sell through an **API**, and supports **claims notification**, **governed business rules** and a full **audit trail**.

**Golden rule for everyone:** TNDS premiums are set by regulation and are the same at every insurer. **Never offer or mention discounts, rebates or cashback.** We compete on service: roadside assistance, e-certificate, auto-renewal, inspection reminders and fast claims.

---

## 2. Before you start

| You need | Notes |
|---|---|
| A user account | Created by the platform administrator after you complete training. Your account has one or more **roles** and a **region** (for example "Hà Nội", or ALL). |
| A supported browser | Latest Chrome, Edge, Firefox or Safari. Screen width of 1280 px or more is recommended. |
| An authenticator app (some roles) | Required for **Administrator, Rule approver, Compliance officer, Data steward** (and any role your organisation adds). Use Microsoft Authenticator, Google Authenticator or similar. |
| The console address | Production: provided by TASCO IT. Training sandbox: provided by your trainer. |

---

## 3. Signing in

### 3.1 Sign in with password (all users)
1. Open the console address. The **Sign in (Đăng nhập)** page appears with the TASCO Insurance logo.
2. Enter your **Username (Tên đăng nhập)** and **Password (Mật khẩu)**.
3. Select **Sign in (Đăng nhập)**.

**What you will see:** if your role does not need MFA, you go straight to your landing page (section 4.2). If it does, the **6-digit authentication code (Mã xác thực 6 số)** step appears.

### 3.2 Second step: authentication code (MFA)
1. Open your authenticator app and find the **TASCO Growth Platform** entry.
2. Type the current 6-digit code into **Authentication code** and select **Verify (Xác minh)**.
3. Codes change every 30 seconds. If the code is about to change, wait for the new one.

You have **5 minutes** to complete this step. After that, start again from the password.

> **Training sandbox only:** the sign-in page shows a demo role picker and a **"Demo: fill code"** button that fills the MFA code for seeded demo users. The demo password is `Tasco@Demo2026!`. These helpers **do not exist in production**.

### 3.3 Session length and signing out
- Your session lasts **30 minutes**. When it expires you see "Session expired — please sign in again". Sign in again; unsent form input is kept where possible.
- To sign out, open the **user menu** (your name, top right) and select **Sign out (Đăng xuất)**. Always sign out on shared computers.

### 3.4 Changing your password
1. Open the user menu and select **Change password**. If your organisation signs you in with corporate single sign-on, change your password there instead.
2. Enter your current password and the new one twice. Passwords must be at least 12 characters and follow the password policy shown on screen.
3. Select **Save**. Your next sign-in uses the new password.

### 3.5 Account lockout
After **5 failed attempts** (wrong password or wrong code), your account is locked for **15 minutes**. You see "Account temporarily locked". Wait, or contact the service desk. Repeated sign-in attempts from the same computer are also rate limited ("Too many sign-in attempts — wait a minute").

---

## 4. Finding your way around

### 4.1 Screen layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Skip to main content]                                                   │
│ TASCO logo   Page title           [VI/EN] [Theme] [?] [Your name ▾]      │  ← top bar
├──────────────┬───────────────────────────────────────────────────────────┤
│ Work         │                                                           │
│  Home        │                    Main content                           │
│  Telesales…  │       (lists, cards, guided next-action buttons)          │
│  Leads       │                                                           │
│  Voice bot   │                                                           │
│  Claims      │                                                           │
│ Growth       │                                                           │
│  Journeys    │                                                           │
│  Partners    │                                                           │
│ Governance   │                                                           │
│  Rules studio│                                                           │
│  Data quality│                                                           │
│  Audit       │                                                           │
│ Administration                                                           │
│  Users       │                                                           │
│  Operations  │                                                           │
├──────────────┴───────────────────────────────────────────────────────────┤
│ Built by iorta TechNXT · version                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Left navigation** shows only the pages your role may use. If you expect a page that is not there, ask your manager whether your role is correct.
- **Top bar:**
  - **VI/EN**: switches the language between Tiếng Việt and English. Your choice is remembered on this computer.
  - **Theme**: switches between light and dark.
  - **? (Help / Trợ giúp)**: opens the **help drawer** for the page you are on.
  - **User menu**: your name, roles and region, change password, sign out.
- **Skip to main content**: press Tab once after the page loads to jump past the navigation (useful for keyboard users).

### 4.2 Where you land after sign-in

| If your role… | You land on |
|---|---|
| can read dashboards (executive, campaign manager, supervisor, rule author, approver, compliance, data steward, partner manager, auditor, administrator) | **Home**: dashboard with KPIs relevant to the platform |
| is telesales agent | **Telesales inbox** |
| is claims handler | **Claims** |
| is support engineer | **Operations** |

### 4.3 Pages and who uses them

| Page (Vietnamese) | What it is for | Roles that see it |
|---|---|---|
| Home (Tổng quan) | KPIs: base, leads by tier and journey, data quality, engagement, sales, claims, economics; adoption and governance tabs | Users with dashboard access |
| Telesales inbox (Hộp việc telesales) | Customers handed over by the voice bot or journeys for a human call | Agents, supervisors, campaign managers (read) |
| Leads (Khách hàng tiềm năng) | Prioritised list of vehicles with score, tier, journey and next best action | Campaign, agents, supervisors, data stewards |
| Customer 360 | Everything about one vehicle/customer; opens from Leads, the inbox or Data quality | Roles with customer access |
| Voice bot (Trợ lý gọi tự động) | Rehearse or supervise AI voice calls | Campaign, agents, supervisors |
| Claims (Bồi thường) | Accident reports (FNOL) from the app | Claims handlers |
| Journeys (Hành trình) | Run due reminders, ecosystem events, voice campaigns | Campaign managers |
| Partners (Đối tác) | Partner onboarding, API keys, commission statements | Partner managers |
| Rules studio (Quy tắc nghiệp vụ) | Versioned business rules with maker-checker | Authors, approvers, compliance, auditors; read-only for campaign and admin |
| Data quality (Chất lượng dữ liệu) | Data issues, corrections, data loads | Data stewards |
| Audit (Nhật ký kiểm toán) | Who did what and when; chain verification; data subject requests | Compliance, approvers, auditors, admin |
| Users (Người dùng) | Accounts and roles | Administrators |
| Operations (Vận hành) | Integration status, jobs, health | Administrators, support engineers |

### 4.4 Keyboard use
| Key | Action |
|---|---|
| Tab / Shift+Tab | Move between controls |
| Enter / Space | Activate a button or link |
| Esc | Close the help drawer, a dialog or a menu |
| ? | Open help for this page (when you are not typing in a field) |
| / | Jump to the search or filter box |

---

## 5. Common actions

### 5.1 Lists: filter, sort and page
1. Use the filter bar above the list (for example Tier, Journey, Region, Days to expiry).
2. Select **Apply (Áp dụng)**. The list updates and the count is announced ("Showing 50 of 2,431").
3. Select **Reset (Đặt lại)** to clear filters.
4. Select a column header to sort (where offered).
5. Use **Previous / Next (Trước / Tiếp)** to move between pages.

### 5.2 Opening a customer (Customer 360)
1. From **Leads** or the **Telesales inbox**, select **Open (Mở)** on a row or card.
2. Customer 360 opens with tabs such as **Overview**, **Journey timeline**, **Messages & calls**, **Policies**, **Data & lineage**, **Activity (audit)** and, if your role can sell, **Quote & issue**.

**What you will see:**
- **Golden record**: plate, vehicle category, province, owner type, policy expiry with **confidence** and **source**.
- **Score breakdown**: the lead score (0–100) and the points from each factor (renewal urgency, data confidence, engagement, reachability, relationship), each with a plain-language reason.
- **Guided next action**: one button with the recommended action and why.
- **Value to offer (no discounts)**: benefits relevant to this customer. Items not yet legally approved are marked *pending legal review* and **must not be offered**.
- **Masked data**: if your role may not see personal data, name and phone appear masked (for example "N. V. An", "0912***678") with a *Masked* badge.

> Every time you open a customer, the platform records it in the audit trail. Open customers only when your work needs it.

### 5.3 Using the guided "next best action"
The **Guided next action** button on Leads and Customer 360 shows the single most useful step, based on the approved `nba` rules. Common actions:

| Action label | Meaning | What to do |
|---|---|---|
| Do not contact | Customer opted out | Nothing. Do not call or message. |
| Route to fleet / B2B team | Company-owned vehicle | Pass to the B2B team. |
| Ask customer to confirm expiry in-app | Expiry date is unreliable | Send the confirmation request. Do not sell on an uncertain date. |
| Welcome pack: verify cover + e-certificate offer | New vehicle (new ETC tag) | Welcome; check existing cover first. |
| Schedule reminders | Renewal window not open yet (> 45 days) | Let the journey run. |
| Urgent: vehicle uninsured — service notice + call | Cover lapsed recently | Service notice, then call. |
| AI voice bot call → telesales handoff | Hot lead with call consent | Start or schedule a voice bot call. |
| One-tap renew link via app / Zalo | Reachable digitally | Send the renewal link. |
| SMS reminder with renew link | Phone only | Send an SMS link. |
| Find a contact channel | No usable contact data | Data stewards enrich the record. |

### 5.4 Messages you will see
- **Toasts** (small messages in the corner) confirm actions, for example "Saved" or "Handoff claimed". Errors stay until you close them.
- **Inline errors** appear under the field that needs fixing.
- **Support code (Mã hỗ trợ)**: unexpected errors show a request ID. Give it to the service desk.

### 5.5 Language and theme
- Select **VI/EN** to switch language. Data values such as plates, IDs and rule names are not translated.
- Select **Theme** to switch light or dark. The default follows your computer's setting.

---

## 6. Getting help

1. **Help drawer:** select **?** in the top bar, or press **?**. It explains the page and links to your manual. Press **Esc** to close it.
2. **Your champion:** each team has a trained champion for "how do I…?" questions.
3. **Persona manual:** see [README.md](README.md).
4. **Service desk:** for access, lockouts, errors and anything that looks wrong. Include the **support code**, the page, the time and what you were doing. **Never send customer personal data in a ticket.** Use the plate or customer ID only.

---

## 7. Troubleshooting

| Problem | Likely cause | What to do |
|---|---|---|
| "Invalid username or password" | Typo, Caps Lock, wrong account | Check and retry. After 5 failures the account locks for 15 minutes. |
| "Account temporarily locked" | 5 failed attempts | Wait 15 minutes or contact the service desk. |
| "Invalid code" at MFA | Code expired or phone clock wrong | Use the newest code. Set your phone time to automatic. |
| "MFA session expired — sign in again" | More than 5 minutes on the MFA step | Start again from the password. |
| "MFA enrolment required for your role — contact an administrator" | Your role needs MFA but no authenticator is enrolled | Contact the administrator to enrol MFA. |
| Lost or replaced phone with the authenticator | — | Contact the service desk to disable the account and re-enrol (see the administrator manual). |
| "Session expired — please sign in again" | 30-minute session ended | Sign in again. |
| A page is missing from the menu | Your role does not include it | Ask your manager to request a role change through the administrator. |
| "You do not have access to this page" / "Missing permission …" | Role does not allow the action | As above. Do not share accounts. |
| Customer name or phone is masked | Your role is not allowed to see personal data | Expected behaviour. |
| "Policy … denies read on this profile" | Customer is outside your region | Expected. Ask your supervisor to reassign. |
| "… was modified by someone else" | Someone else updated the same record | Reload and repeat your change. |
| "Too many requests" | Rate limit | Wait the number of seconds shown. |
| "Upstream service unavailable" | VETC wallet, TASCO core or a messaging provider is temporarily down | Retry later. Nothing was completed. Report it if it persists. |
| The screen looks wrong or blank | Browser cache, or an unsupported browser | Refresh (Ctrl+F5). Use a supported browser. |

---

## 8. Frequently asked questions

**Why is the TNDS price the same as everywhere else? Can I offer a better price?**
No. TNDS premiums are fixed by regulation (Decree 67/2023/ND-CP), and discounts are not allowed. Offer the service benefits shown on the customer page instead.

**Why can't I see the customer's phone number?**
Personal data is shown only to roles that need it for their task (for example telesales). Everyone else sees it masked.

**Why is a customer's expiry date marked "estimated"?**
Many records do not have a verified certificate. The platform infers the date from evidence (for example inspection cycles or partner records) and shows its confidence. Ask the customer to confirm it in the app before selling.

**Why did a reminder not go out?**
The journey engine respects consent, contact hours (08:00–20:00), daily and weekly limits, and the copy guard. The touchpoint shows the reason it was skipped.

**Who changes the business rules?**
Rule authors draft changes in the Rules studio and a **different person** approves them. Every change is recorded.

**Is my activity recorded?**
Yes. Sign-ins, customer views and all changes are recorded in a tamper-evident audit trail, for security and regulatory reasons.

**Can I use the training sandbox data in production or the other way round?**
No. The sandbox uses synthetic data and demo accounts. Never enter real customer data in the sandbox.

---

## 9. Responsible use
- Use only your own account. Never share passwords or authenticator codes.
- Open customer records only when your work requires it.
- Do not copy customer data into spreadsheets, chat apps or email.
- Do not take payment details or OTPs over the phone. Payment happens only in the VETC app.
- Report suspected security or privacy incidents to the service desk immediately.
