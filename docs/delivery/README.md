# Delivery Documentation

These documents describe how the TASCO Growth Platform (TASCO Insurance × VETC, delivered by iorta TechNXT) is planned, governed, delivered, handed over and adopted.

| Document | Purpose | Primary readers |
|---|---|---|
| [project-plan.md](project-plan.md) | Phases (Discovery → MVP → SIT/UAT → Pilot → Scale-out), milestones, Gantt chart, workstreams, dependencies, resource plan | Steering Committee, PMO, all leads |
| [delivery-methodology.md](delivery-methodology.md) | Hybrid agile (Scrum + stage gates), ceremonies, Definition of Ready/Done, quality gates, environments, governance cadence, reporting | Delivery team, Product Owner, QA, CAB |
| [raci.md](raci.md) | Who is Responsible, Accountable, Consulted and Informed for build, launch, run and compliance activities across TASCO, VETC, iorta TechNXT, vendors and partners | All parties |
| [risk-register.md](risk-register.md) | 30 scored risks with owners, mitigations and contingencies (regulatory, data, integration, adoption, AI, vendor, people) | Steering Committee, Delivery Lead |
| [kt-plan.md](kt-plan.md) | Knowledge transfer for 10+ year maintainability: phases, curriculum per role, how-tos, runbooks, code walkthroughs, sign-off | TASCO/VETC IT, future support team |
| [change-management-and-training.md](change-management-and-training.md) | Change impact, communications, champions, role-based training with sandbox practice, certification, adoption KPIs, reinforcement | Change Lead, managers, trainers |

## Related documentation
- `docs/ux/` covers the design system, accessibility and UX standards, information architecture and journey maps, and usability testing.
- `docs/manuals/` holds the user manual, persona manuals, partner API guide and customer app guide.
- `docs/business/` covers business context, requirements, user stories, traceability, personas and commercials.
- `docs/architecture/` holds the solution, data, integration, security and deployment architecture and the ADRs. The OpenAPI spec is generated with `npm run job -- openapi`.
- `docs/quality/` holds the test strategy (including the known-issues register KI-xx), test cases, UAT plan and performance plan.
- `docs/operations/` holds runbooks (RB-xx, SOP-xx), monitoring, DR/BCP and the production readiness checklist.

## Conventions
- Dates are indicative and assume kick-off on 19 October 2026, with a Tết freeze from 1 to 14 February 2027.
- KPI targets marked **proposed** need agreement at Gate G1/G3.
- Code references use repository paths (for example `src/application/rulesService.js`) so that the documents stay traceable to the implementation.
- The UI is described as the **v1 UI** design (staff console at `/`, customer app at `/app/`, certificate check at `/verify/<certNo>`).
