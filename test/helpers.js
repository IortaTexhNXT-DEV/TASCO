'use strict';

const crypto = require('crypto');
const { loadConfig } = require('../src/shared/config');
const { createContainer } = require('../src/bootstrap/container');
const { seedDemo } = require('../src/bootstrap/seed');
const { createHttpApp } = require('../src/adapters/http/app');
const { totp } = require('../src/shared/crypto');

const KEY = (b) => crypto.createHash('sha256').update(b).digest().toString('base64');

function testEnv(extra = {}) {
  return {
    NODE_ENV: 'test',
    SIM_TODAY: '2026-10-07',
    LOG_LEVEL: 'error',
    SEED_RECORDS: '400',
    SEED: '42',
    JWT_SECRET: 'test-jwt-secret-test-jwt-secret-0123456789',
    DATA_KEYS: `k1:${KEY('k1')}`,
    BLIND_INDEX_KEY: KEY('blind'),
    DEMO_MODE: 'true',
    PUBLIC_BASE_URL: 'http://test.local',
    RATE_LIMIT_MAX: '100000',
    RATE_LIMIT_LOGIN_MAX: '100000',
    ...extra,
  };
}

async function makeContainer({ env = {}, seed = true, records } = {}) {
  const c = await createContainer(loadConfig(testEnv(env)), { logSink: () => {} });
  if (seed) await seedDemo(c, { records });
  return c;
}

const ACTOR = (id = 'tester', roles = ['admin']) => ({ id, roles, region: 'ALL' });

async function startServer(c) {
  const app = createHttpApp(c);
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  app.setReady(true);
  const { port } = app.server.address();
  const base = `http://127.0.0.1:${port}`;
  async function call(method, path, { body, token, headers = {}, raw } = {}) {
    const h = { ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  }
  async function login(username, password = 'Tasco@Demo2026!') {
    const r = await call('POST', '/api/auth/login', { body: { username, password } });
    if (r.body.mfaRequired) {
      const secret = await c.services.identity.getTotpSecretForDemo(username);
      const m = await call('POST', '/api/auth/mfa', { body: { mfaToken: r.body.mfaToken, code: totp(secret) } });
      return m.body.accessToken;
    }
    return r.body.accessToken;
  }
  return { base, call, login, close: () => new Promise((r) => app.server.close(r)), app };
}

/** Find a profile id matching a predicate. */
async function findProfile(c, pred) {
  const all = await c.store.collection('profiles').find({ limit: 5000 });
  return all.find(pred);
}

module.exports = { testEnv, makeContainer, ACTOR, startServer, findProfile, KEY };
