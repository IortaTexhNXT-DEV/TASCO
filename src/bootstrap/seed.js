'use strict';

const path = require('path');
const { generate } = require('../adapters/integrations/syntheticVetcSource');
const { ROOT } = require('./container');

/**
 * Demo / UAT seed: rule sets, staff users (one per role), partners and a
 * synthetic VETC base. Never runs in production (guarded by DEMO_MODE).
 */

const DEMO_PASSWORD = 'Tasco@Demo2026!';

/** Demo staff: realistic Vietnamese display names (the role is shown separately, translated through i18n). */
const DEMO_USERS = [
  { username: 'admin', displayName: 'Đỗ Minh Quân', roles: ['admin'], mfa: true },
  { username: 'exec', displayName: 'Nguyễn Hoàng Long', roles: ['executive'] },
  { username: 'campaign', displayName: 'Trần Thu Hà', roles: ['campaign_manager'] },
  { username: 'agent.hn', displayName: 'Phạm Thị Lan', roles: ['telesales_agent'], region: 'Hà Nội' },
  { username: 'agent.hcm', displayName: 'Lê Văn Tài', roles: ['telesales_agent'], region: 'TP. Hồ Chí Minh' },
  { username: 'supervisor', displayName: 'Vũ Đức Thắng', roles: ['telesales_supervisor'] },
  { username: 'author', displayName: 'Hoàng Mai Anh', roles: ['rule_author'] },
  { username: 'approver', displayName: 'Bùi Quang Huy', roles: ['rule_approver'], mfa: true },
  { username: 'compliance', displayName: 'Đặng Thu Trang', roles: ['compliance_officer'], mfa: true },
  { username: 'steward', displayName: 'Ngô Thanh Tùng', roles: ['data_steward'], mfa: true },
  { username: 'claims', displayName: 'Đinh Văn Khoa', roles: ['claims_handler'] },
  { username: 'partners', displayName: 'Lý Ngọc Diệp', roles: ['partner_manager'] },
  { username: 'auditor', displayName: 'Trịnh Hải Yến', roles: ['auditor'] },
  { username: 'support', displayName: 'Phan Gia Bảo', roles: ['support_engineer'] },
];

const DEMO_PARTNERS = [
  { id: 'P-BANK-01', name: 'Partner Bank', type: 'bank' },
  { id: 'P-SHOWROOM-01', name: 'Car Showroom Network', type: 'showroom' },
  { id: 'P-AGENT-01', name: 'Independent Agency', type: 'agent' },
  { id: 'P-FLEET-01', name: 'Fleet Operator', type: 'fleet' },
  { id: 'P-INSPECTION_CENTER-01', name: 'Inspection Centre', type: 'inspection_center' },
];

/** Deterministic authenticator key for a demo user (UAT only; seed is a secret env var). */
function demoTotpSecret(seed, username) {
  const { base32Encode } = require('../shared/crypto'); // eslint-disable-line global-require
  return base32Encode(require('crypto').createHmac('sha256', seed).update(`totp:${username}`).digest().subarray(0, 20)); // eslint-disable-line global-require
}

/**
 * UAT only (DEMO_MODE + DEMO_ACCOUNT_SYNC): bring every seeded demo account back to
 * the published state — unlocked, demo password, published authenticator key.
 */
async function syncDemoAccounts(c) {
  const { config, store, services } = c;
  if (!config.demoMode || !config.demoAccountSync) return { synced: 0 };
  const { hashPassword } = require('../shared/crypto'); // eslint-disable-line global-require
  const col = store.collection('users');
  let synced = 0;
  for (const d of DEMO_USERS) {
    const u = await services.identity.byUsername(d.username);
    if (!u) continue;
    const next = { ...u, failedLogins: 0, lockedUntil: null, status: 'active', lastTotpStep: null, mustChangePassword: false,
      passwordHash: hashPassword(config.demoPassword || DEMO_PASSWORD), tokensValidAfter: new Date().toISOString() };
    if (d.mfa && config.demoTotpSeed) Object.assign(next, { totpSecret: demoTotpSecret(config.demoTotpSeed, d.username), mfaEnrolled: true });
    await col.update(next);
    synced++;
  }
  await services.audit.record({ actor: 'system', action: 'demo.accounts_synced', details: { synced } });
  return { synced };
}

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
  await syncDemoAccounts(c);
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

module.exports = { seedDemo, seedRules, syncDemoAccounts, demoTotpSecret, DEMO_USERS, DEMO_PASSWORD, DEMO_PARTNERS };
