---
id: TGP-DEL-04
title: Risk Register
subtitle: TASCO Motor Insurance Growth Platform
version: "1.0"
date: 07/10/2026
prepared_by: iorta TechNXT, Delivery Management
reviewed_by: TASCO Insurance, Programme Management
approved_by: TASCO Insurance, Programme Sponsor
change_history: Initial issue for submission
acronyms:
  - [AI, Artificial Intelligence]
  - [API, Application Programming Interface]
  - [MFA, Multi-Factor Authentication]
  - [MVP, Minimum Viable Product]
  - [RACI, "Responsible, Accountable, Consulted, Informed"]
  - [SMS, Short Message Service]
  - [TNDS, Compulsory motor third-party liability insurance (Bảo hiểm TNDS bắt buộc)]
  - [UAT, User Acceptance Testing]
  - [VETC, VETC Automatic Toll Collection Company]
signoff:
  - [Risk owners named for each TASCO and VETC party at mobilisation, TASCO Product Owner, Open]
  - ["Data-sharing basis for VETC data (R-02), to be confirmed by TASCO legal", TASCO Compliance and Legal, Open]
  - ["Regulatory positions on consent wording and loyalty benefits (R-04), to be confirmed by TASCO legal", TASCO Compliance and Legal, Open]
---

# Introduction

This register lists the main risks to the delivery of the TASCO Growth Platform (the platform) MVP and its pilot, with an owner, a mitigation and a contingency for each. It starts from the risks in the proposal, section 27, and adds the risks that the delivery team will track during the sprints.

The audience is the steering committee, the product council and the engagement manager. Owner codes are the party codes in TGP-DEL-03 RACI Matrix.

Related documents:

| ID | Title | Relationship |
|---|---|---|
| TGP-DEL-01 | Project Plan | Milestones and dependencies the risks affect |
| TGP-DEL-02 | Delivery Methodology | Forums that review the register |
| TGP-DEL-03 | RACI Matrix | Party codes used as owners |
| TGP-ARC-04 | Security Architecture | Security controls referred to in R-16 |
| TGP-ARC-06 | AI Governance | Controls for the voice assistant and scoring |

# Scoring

Each risk is scored for likelihood and impact on a scale of 1 to 5. The score is likelihood multiplied by impact.

| Value | Likelihood | Impact |
|---|---|---|
| 1 | Rare | Negligible: no milestone or customer effect |
| 2 | Unlikely | Minor: absorbed within the sprint |
| 3 | Possible | Moderate: a milestone moves by up to two weeks, or a feature is held back |
| 4 | Likely | Major: a milestone moves by more than two weeks, or the pilot result is weakened |
| 5 | Almost certain | Severe: regulatory breach, customer harm or the pilot cannot run |

| Score | Rating | Handling |
|---|---|---|
| 1 to 6 | Low | Owner monitors |
| 8 to 12 | Medium | Mitigation plan tracked by the product council |
| 15 to 25 | High | Reported to the next steering committee with a mitigation plan |

# Risks

| ID | Risk and effect | Owner | Mitigation | Contingency |
|---|---|---|---|---|
| R-01 | TASCO core does not expose a rating API in time, so live pricing is delayed | TIT | Decide the path in week 2; the interim path uses approved tariff tables with core re-rating at issue | Launch on the interim path; move to live rating in the scale phase |
| R-02 | VETC data access is delayed or restricted by the data-sharing basis, so the cohort cannot be selected | VS | Draft the data-sharing basis and field list in discovery; build on synthetic data meanwhile | Start the pilot on TASCO's own policy book with renewal journeys only |
| R-03 | Integration sandboxes or credentials arrive late, so M2 is delayed | TIT | Simulated adapters exist for every interface, so build continues | Dates move day for day by agreement |
| R-04 | Legal positions take time (data sharing, consent wording, loyalty benefits), so features are held back | CMP | Conservative defaults; features stay switched off until approved | Launch without the held feature |
| R-05 | TASCO core specification differs from the assumptions in the existing core connector; issuance still runs on a sandbox adapter | SA | Agree the specification in discovery; contract tests in Sprint 1 | Adapt the connector behind the same interface; use Sprint 4 buffer |
| R-06 | VETC data quality is lower than expected, so fewer vehicles are actionable | DAT | Data repair is the first journey; customers confirm their expiry date; data steward queue | Restrict early contact to records with a usable expiry date |
| R-07 | Customers distrust the voice assistant, so call completion is low | PO | Plate-first verification, disclosure, app-first journeys, calls only with consent, script approved by compliance | Shift the mix to the app and Zalo; reduce call volume |
| R-08 | Voice recognition misreads Vietnamese plates or accents | SA | Benchmark the vendor on regional accents; limited retries; handoff to telesales on failure | Route failed verifications to telesales; change vendor behind the same interface |
| R-09 | The launch falls close to Tết, when staff are scarce | EM | Soft launch, change freeze and 24-hour on-call cover over the holiday | Delay the ramp-up to the full cohort |
| R-10 | Partners see the platform as channel conflict and resist | PO | Channel rules that protect partner-quoted vehicles; the partner API makes partners part of the solution | Suppress journeys for partner-protected vehicles |
| R-11 | Scope grows during the MVP, putting pressure on budget | PO | Clear MVP boundary; change control; USD 5,200 reserve under TASCO's control | Move the change to the scale phase |
| R-12 | Telesales agents keep working from old call lists | TS | Training in UAT, super users, warm verified leads instead of cold lists | Supervisor coaching; retire the old lists by a set date |
| R-13 | Customer wording is read as a discount or inducement on TNDS | CMP | Wording control on every message; compliance approves templates and the voice script; only approved benefits reach customers | Withdraw the template through an approved rule change within the hour |
| R-14 | Personal data is processed without a valid basis, or reaches the wrong person | CMP | Consent per purpose and channel; plate-first verification; data requests register with identity checks before export or erasure and a response time to be confirmed by TASCO legal; retention rules | Data protection incident procedure; suspend the affected processing |
| R-15 | Zalo template approval or SMS brandname registration is late | PO | Submit templates early in Sprint 3; channel fallback order in journeys | Use app push and SMS only, or app push only |
| R-16 | Staff or partner credentials are compromised | SEC | MFA for privileged roles, lockout, scoped partner keys, security testing before go-live | Revoke tokens and keys; incident response from the audit trail |
| R-17 | Knowledge is held by one or two iorta TechNXT engineers | EM | Pairing, architecture decision records, runbooks, technical handover | Accelerate knowledge transfer under TGP-DEL-05 |
| R-18 | The pilot does not give a clear answer (small sample, seasonality) | SP | Random control group of about 10%; read-out in early May 2027; criteria confirmed in discovery | Extend the measurement period |
| R-19 | TASCO's app, website or payment gateway cannot host the shared journeys as planned, so TASCO's own channels open later | TIT | Check web-view and gateway capability in discovery; keep the journeys usable as a plain link from TASCO's site; S3 sits outside the MVP critical path | Launch TASCO channels as links first, embed later |
| R-20 | Prices, wording or contacts differ between the VETC app, TASCO's channels and Tasco360, which confuses customers | PO | One core rating for every channel; shared message templates and official contacts; the channel recorded on every sale | Correct the template or contact in the rules studio through maker-checker |
| R-21 | Quick renewal is offered where the vehicle or cover needs review, so a customer renews with the wrong cover | PO | The server decides eligibility from the approved quick-renewal rule: use and seats confirmed within 365 days, TNDS only without physical damage cover, price from TASCO core, wallet balance checked; explicit declaration; full flow always available | Switch quick renewal off through an approved service-level rule change |

# Current scores

Scores reflect the position at submission, before discovery.

| ID | Likelihood | Impact | Score | Rating |
|---|---:|---:|---:|---|
| R-01 | 3 | 4 | 12 | Medium |
| R-02 | 3 | 5 | 15 | High |
| R-03 | 3 | 4 | 12 | Medium |
| R-04 | 3 | 4 | 12 | Medium |
| R-05 | 3 | 3 | 9 | Medium |
| R-06 | 4 | 3 | 12 | Medium |
| R-07 | 3 | 4 | 12 | Medium |
| R-08 | 3 | 3 | 9 | Medium |
| R-09 | 3 | 3 | 9 | Medium |
| R-10 | 3 | 4 | 12 | Medium |
| R-11 | 3 | 3 | 9 | Medium |
| R-12 | 3 | 4 | 12 | Medium |
| R-13 | 2 | 5 | 10 | Medium |
| R-14 | 2 | 5 | 10 | Medium |
| R-15 | 3 | 3 | 9 | Medium |
| R-16 | 2 | 5 | 10 | Medium |
| R-17 | 2 | 4 | 8 | Medium |
| R-18 | 2 | 4 | 8 | Medium |
| R-19 | 2 | 3 | 6 | Low |
| R-20 | 2 | 3 | 6 | Low |
| R-21 | 2 | 4 | 8 | Medium |

# Review

The engagement manager and the TASCO product owner review the register every two weeks before the product council. High risks go to the next steering committee. Anyone may raise a risk; the engagement manager assigns an owner and a score within two business days. A risk is closed when its owner and the engagement manager agree that the cause has gone, or when the accountable party in TGP-DEL-03 RACI Matrix accepts the remaining risk.
