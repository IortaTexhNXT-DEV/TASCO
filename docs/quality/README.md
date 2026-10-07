# Quality Engineering — TASCO Growth Platform

Quality engineering documentation for the TASCO Insurance × VETC motor insurance growth platform (built by iorta TechNXT).

| Document | Purpose | Primary audience |
|---|---|---|
| [test-strategy.md](test-strategy.md) | Scope, test levels and types (unit, integration, API/contract, SIT, UAT, NFT, security, resilience, DR, accessibility, localisation, compliance, data quality, migration), automation and CI gates, environments, test data, entry/exit criteria, defect severity, metrics, roles. **Appendix A is the known-issues register (KI-01 – KI-33)** found during code review | QA, engineering, TASCO IT, SteerCo |
| [test-case-catalogue.md](test-case-catalogue.md) | 164 test cases (TC-001 – TC-164) by module, with objective, preconditions, steps, expected result, type, priority and automation file | QA, developers, testers |
| [performance-and-capacity-test-plan.md](performance-and-capacity-test-plan.md) | Workload model for a 6 M-vehicle base, scenarios PERF-S1 – S13, SLO targets, tooling (`npm run test:perf`), environment sizing, pass/fail criteria, capacity model | Perf engineer, SRE, TASCO infrastructure |
| [uat-plan.md](uat-plan.md) | UAT approach, 46 business scenarios by persona, reference data, entry/exit criteria, triage, sign-off sheet, schedule (11–22 Jan 2027) | TASCO business, VETC CX, Compliance |

## Quick reference — test commands

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint over the repository |
| `npm test` | Unit + integration + API suites (`test/unit`, `test/integration`, `test/api`) with the spec reporter |
| `npm run test:unit` / `npm run test:api` | One layer only |
| `npm run test:coverage` | Same suites with the coverage gate: lines ≥ 80 %, functions ≥ 80 %, branches ≥ 70 % |
| `npm run test:security` | Abuse-case suite (`test/security`) |
| `npm run test:pg` | Postgres adapter, migrations, SQL injection, audit chain (`test/pg`; needs `TEST_DATABASE_URL`, default `postgres://postgres:postgres@localhost:5432/tasco_test`) |
| `npm run test:perf` | HTTP load generator (`test/perf/load.js`) reporting p50/p95/p99 and RPS |
| `npm run audit` | `npm audit --omit=dev --audit-level=high` |

## ID conventions used across quality and operations documents

| Prefix | Meaning | Defined in |
|---|---|---|
| TC-nnn | Test case | Test case catalogue |
| KI-nn | Known issue from code review | Test strategy, Appendix A |
| PERF-Sn | Performance scenario | Performance plan |
| UAT-XX-nn | UAT business scenario | UAT plan |
| RB-nn | Runbook incident procedure | [Runbook](../operations/runbook-and-support-guide.md) |
| SOP-nn | Standard operating procedure | Runbook |
| ALR-nn | Alert rule | [Monitoring and alerting](../operations/monitoring-and-alerting.md) |
| PRC-xxx-nn | Production readiness check | [Readiness checklist](../operations/production-readiness-checklist.md) |
| DR-Tn | DR test | [DR and BCP](../operations/dr-bcp.md) |
