'use strict';

const path = require('path');
const { generate } = require('../adapters/integrations/syntheticVetcSource');
const { ROOT } = require('./container');

/**
 * Demo / UAT seed: rule sets, staff users (one per role), partners and a
 * synthetic VETC base. Never runs in production (guarded by DEMO_MODE).
 */

const DEMO_PASSWORD = 'Tasco@Demo2026!';

const DEMO_USERS = [
  { username: 'admin', displayName: 'Platform Admin', roles: ['admin'], mfa: true },
  { username: 'exec', displayName: 'Executive (CEO office)', roles: ['executive'] },
  { username: 'campaign', displayName: 'Campaign Manager', roles: ['campaign_manager'] },
  { username: 'agent.hn', displayName: 'Telesales Agent (Hà Nội)', roles: ['telesales_agent'], region: 'Hà Nội' },
  { username: 'agent.hcm', displayName: 'Telesales Agent (TP.HCM)', roles: ['telesales_agent'], region: 'TP. Hồ Chí Minh' },
  { username: 'supervisor', displayName: 'Telesales Supervisor', roles: ['telesales_supervisor'] },
  { username: 'author', displayName: 'Rule Author (Product)', roles: ['rule_author'] },
  { username: 'approver', displayName: 'Rule Approver (Compliance)', roles: ['rule_approver'], mfa: true },
  { username: 'compliance', displayName: 'Compliance Officer', roles: ['compliance_officer'], mfa: true },
  { username: 'steward', displayName: 'Data Steward', roles: ['data_steward'], mfa: true },
  { username: 'claims', displayName: 'Claims Handler', roles: ['claims_handler'] },
  { username: 'partners', displayName: 'Partner Manager', roles: ['partner_manager'] },
  { username: 'auditor', displayName: 'Internal Auditor', roles: ['auditor'] },
  { username: 'support', displayName: 'Production Support', roles: ['support_engineer'] },
];

const DEMO_PARTNERS = [
  { id: 'P-BANK-01', name: 'Partner Bank (demo)', type: 'bank' },
  { id: 'P-SHOWROOM-01', name: 'Car Showroom Network (demo)', type: 'showroom' },
  { id: 'P-AGENT-01', name: 'Independent Agency (demo)', type: 'agent' },
  { id: 'P-FLEET-01', name: 'Fleet Operator (demo)', type: 'fleet' },
  { id: 'P-INSPECTION_CENTER-01', name: 'Inspection Centre (demo)', type: 'inspection_center' },
];

async function seedRules(c) {
  return c.services.rules.loadDefaults(path.join(ROOT, c.config.rulesDir));
}

async function seedDemo(c, { records } = {}) {
  const { services, config, store } = c;
  const system = { id: 'system' };
  await seedRules(c);
  if (!(await store.collection('users').count())) {
    for (const u of DEMO_USERS) {
      await services.identity.createUser({ username: u.username, password: config.demoPassword || DEMO_PASSWORD, displayName: u.displayName, roles: u.roles, region: u.region || 'ALL', enableMfa: !!u.mfa, preEnrolled: true }, system);
    }
  }
  if (!(await store.collection('partners').count())) {
    for (const p of DEMO_PARTNERS) await services.partners.create(p, system);
  }
  if (!(await store.collection('profiles').count())) {
    const raw = records || generate({ count: config.seedRecords, seed: config.seed, today: c.clock.today() });
    await services.ingestion.ingest(raw, { actor: 'seed', sourceName: 'synthetic-vetc' });
    await c.events.drain();
  }
  return { users: DEMO_USERS.length, partners: DEMO_PARTNERS.length };
}

module.exports = { seedDemo, seedRules, DEMO_USERS, DEMO_PASSWORD, DEMO_PARTNERS };
