# UX Documentation

UX documentation for the TASCO Growth Platform **v1 UI**:

- **Staff console** at `/`: sign-in with MFA, permission-filtered navigation, contextual help.
- **Customer app** at `/app/`: cover status, confirm expiry, one-tap renewal with add-ons, VETC wallet payment, e-certificate with QR, benefits, consent centre, accident reporting, data download.
- **Public certificate check** at `/verify/<certNo>`.

| Document | Contents |
|---|---|
| [design-system.md](design-system.md) | Principles (consumer-grade, trust-first, low-click, mobile-first), brand (TASCO navy and teal, iorta TechNXT credit), design tokens with light and dark values, components, content style guide (Vietnamese-first, no discount wording), iconography |
| [ux-standards-and-accessibility.md](ux-standards-and-accessibility.md) | WCAG 2.2 AA requirements and how each is applied, keyboard map, landmarks and live regions, breakpoints, performance budgets, i18n/l10n (vi/en, VND, dd/mm/yyyy), personalisation, contextual help and guided actions, error message patterns |
| [journey-maps-and-information-architecture.md](journey-maps-and-information-architecture.md) | Sitemaps for the staff console and customer app, page inventory with permissions, navigation by role, task flows with click counts, customer and staff journey maps |
| [usability-testing-plan.md](usability-testing-plan.md) | Research questions, methods, recruitment in Hà Nội and TP.HCM, task scripts, metrics and targets (SUS, task success, time on task), iteration loop |

Implementation references: `public/css/tokens.css`, `public/css/components.css`, `public/js/shared/i18n.js`, `public/js/console/help.js`.

Related: user and persona manuals are in `docs/manuals/`. Delivery, change and training plans are in `docs/delivery/`. Business personas and journey maps are in `docs/business/06-personas-and-journey-maps.md`, and UI architecture decisions in `docs/architecture/adr/ADR-011-vanilla-spa-design-tokens.md`.
