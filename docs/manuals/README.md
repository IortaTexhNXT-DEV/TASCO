# User Manuals — TASCO Growth Platform (v1 UI)

Start with the **Staff User Manual**, then read the manual for your role. The in-app help drawer ("?") links here.

## Staff

| Manual | Role(s) (`config/security/rbac.json`) | Demo user (sandbox only) |
|---|---|---|
| [Staff User Manual](user-manual.md) — sign-in and MFA, navigation, common actions, help, troubleshooting, FAQ | All staff | — |
| [Telesales Agent](manual-telesales-agent.md) | `telesales_agent` | `agent.hn`, `agent.hcm` |
| [Telesales Supervisor](manual-telesales-supervisor.md) | `telesales_supervisor` | `supervisor` |
| [Campaign Manager](manual-campaign-manager.md) | `campaign_manager` | `campaign` |
| [Rule Author and Approver (maker-checker)](manual-rule-author-and-approver.md) | `rule_author`, `rule_approver` | `author`, `approver` (MFA) |
| [Compliance Officer](manual-compliance-officer.md) — approvals, audit, DSAR, governance dashboard | `compliance_officer` | `compliance` (MFA) |
| [Data Steward](manual-data-steward.md) | `data_steward` | `steward` (MFA) |
| [Claims Handler](manual-claims-handler.md) | `claims_handler` | `claims` |
| [Partner Manager](manual-partner-manager.md) | `partner_manager` | `partners` |
| [Administrator and Support](manual-administrator-and-support.md) — users, operations status, jobs, health | `admin`, `support_engineer` | `admin` (MFA), `support` |
| [Executive](manual-executive.md) | `executive` | `exec` |

The internal auditor role (`auditor`, demo user `auditor`) is read-only. Use the audit sections of the [Compliance Officer](manual-compliance-officer.md#4-searching-the-audit-trail) manual.

**Sandbox:** the demo password is `Tasco@Demo2026!`. MFA codes for demo users come from the sign-in page's demo helper (`GET /api/demo/totp/<username>`), which is available **only in demo mode**. None of this exists in production.

## Partners and customers

| Guide | Audience |
|---|---|
| [Partner API Guide](partner-api-guide.md) — `/api/partner/v1/quotes`, `/orders` (Idempotency-Key), `/policies`, `/statement`, `X-Api-Key`, error format, curl examples | Partner developers |
| [Customer App Guide](customer-app-guide.md) — Vietnamese with English summary | VETC drivers, and customer-service staff who support them |

## Conventions in these manuals
- **Numbered steps** for procedures. **"What you will see"** describes the expected result. **Tips** and **Troubleshooting** close each manual.
- Screen labels are in English, with the Vietnamese label in brackets where it helps. The console opens in Vietnamese by default (VI/EN toggle in the top bar).
- Dates are dd/mm/yyyy. Money is in VND.
- The no-discount rule applies everywhere: TNDS premiums are regulated and identical at every insurer.

Related: `docs/ux/` (design system, accessibility, information architecture), `docs/delivery/` (training plan, KT plan with runbooks).
