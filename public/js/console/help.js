/** Contextual help per page (shown in the help drawer). */
export const HELP = {
  home: {
    title: 'Home dashboard',
    body: [
      'KPIs are computed live from the platform: base size, leads by tier and journey, data-quality issues, engagement, sales and economics.',
      'Use the journey mix to see new business (conquest, new vehicle, uninsured) versus retention (TASCO renewals).',
      'Economics compare voice-bot cost with the equivalent human telesales cost using the "costs" rule set.',
    ],
  },
  leads: {
    title: 'Lead queue',
    body: [
      'Leads are ranked by an explainable score (0–100). Open a lead to see exactly which factors contributed.',
      'Hot ≥ 70, Warm ≥ 45 (configurable in the "scoring" rule set).',
      'The next best action tells you what to do — it already respects consent, do-not-contact and data quality.',
    ],
  },
  customer: {
    title: 'Customer 360',
    body: [
      'Golden record built from all VETC and partner sources. Every field shows where it came from (lineage) and how confident we are.',
      'Phone and name are masked unless your role is allowed to see personal data. Every view is logged.',
      'If the expiry date is uncertain, fix the data first (ask the customer in-app) — calling with a wrong date destroys trust.',
    ],
  },
  voice: {
    title: 'Voice bot console',
    body: [
      'Rehearse or supervise the AI voice assistant. Type what the customer says (as ASR text).',
      'The bot always discloses it is automated, verifies the licence plate FIRST, never asks for OTP or payment, and offers a human or an in-app link.',
      'Hot leads are handed to telesales with a summary and talking points.',
    ],
  },
  handoffs: {
    title: 'Telesales inbox',
    body: [
      'Work your queue: Claim → call from the official hotline → quote → issue in the app or send the link.',
      'Lead with service value (roadside assistance, e-certificate, auto-renew). TNDS price is regulated — never promise discounts.',
      'Record the outcome (won / lost / callback) so the journey engine stops or reschedules reminders.',
    ],
  },
  journeys: {
    title: 'Journeys',
    body: [
      'Journeys cover new business (uninsured recovery, new vehicle, conquest) and retention (TASCO renewal), plus cross-sell after purchase.',
      '"Run due touchpoints" executes everything due today, respecting consent, contact hours and frequency caps.',
      'Ecosystem events (new tag, inspection booked, wallet top-up) trigger moments-of-truth messages instantly.',
    ],
  },
  rules: {
    title: 'Rules studio (maker-checker)',
    body: [
      'All business rules are versioned data: products, tariffs, scoring, next best action, journeys, contact policy, messages, voice script, commissions.',
      '1) Create a draft and validate. 2) Simulate against a real customer. 3) Submit. 4) A different person approves. The previous version is retired automatically.',
      'Customer-facing copy is checked against the copy guard (no discount wording) before it can be saved.',
    ],
  },
  partners: { title: 'Partners', body: ['Onboard banks, showrooms, agents, fleets and inspection centres.', 'Issue an API key (shown once) and download commission statements. Commission is capped at statutory limits.'] },
  claims: { title: 'Claims (FNOL)', body: ['Customers report accidents from the VETC app with photos and location.', 'Acknowledge within the 4-hour SLA and move the claim through the status flow.'] },
  dq: { title: 'Data quality', body: ['Every gap found while building golden records becomes an issue (missing phone, unreliable expiry, invalid plate…).', 'Resolve with evidence; journeys automatically ask customers to fix their own data.'] },
  audit: { title: 'Audit trail', body: ['Append-only and hash-chained: any tampering breaks the chain.', 'Use "Verify chain" before audits and regulator requests.'] },
  users: { title: 'Users', body: ['Create users with least-privilege roles and a region.', 'MFA is mandatory for privileged roles.'] },
  ops: { title: 'Operations', body: ['Integration circuit breakers, event backlog, rule versions and job history.', 'Run reconciliation daily; retention applies the "retention" rule set.'] },
};
