'use strict';

const fs = require('fs');
const crypto = require('crypto');

/**
 * 12-factor configuration. Every setting comes from the environment; secrets
 * may instead be supplied as files via the `<NAME>_FILE` convention (Docker /
 * Kubernetes secrets, Vault agent). Production refuses to boot with missing or
 * placeholder secrets.
 */

function readSecret(env, name) {
  const fileVar = env[`${name}_FILE`];
  if (fileVar) return fs.readFileSync(fileVar, 'utf8').trim();
  return env[name];
}

function bool(v, dflt) {
  if (v === undefined || v === '') return dflt;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function int(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== undefined ? n : dflt;
}

function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const production = nodeEnv === 'production';
  const warnings = [];

  const secret = (name, bytes = 32) => {
    const v = readSecret(env, name);
    if (v) return v;
    if (production) throw new Error(`Missing required secret ${name} (or ${name}_FILE) in production`);
    warnings.push(`${name} not set — using an ephemeral development value`);
    return crypto.randomBytes(bytes).toString('base64');
  };

  const dataKeysRaw = readSecret(env, 'DATA_KEYS'); // "k1:<base64-32-bytes>,k2:<...>"
  let dataKeys;
  if (dataKeysRaw) {
    dataKeys = Object.fromEntries(dataKeysRaw.split(',').map((pair) => {
      const [id, b64] = pair.split(':');
      const key = Buffer.from(b64 || '', 'base64');
      if (key.length !== 32) throw new Error(`DATA_KEYS entry ${id} must be 32 bytes base64`);
      return [id, key];
    }));
  } else {
    if (production) throw new Error('Missing required secret DATA_KEYS in production');
    warnings.push('DATA_KEYS not set — PII encrypted with an ephemeral development key');
    dataKeys = { dev: crypto.randomBytes(32) };
  }
  const activeDataKey = env.DATA_KEY_ACTIVE || Object.keys(dataKeys)[Object.keys(dataKeys).length - 1];
  if (!dataKeys[activeDataKey]) throw new Error(`DATA_KEY_ACTIVE ${activeDataKey} not present in DATA_KEYS`);

  // Demo features (seeded users, TOTP helper, demo customer picker) are opt-in only.
  const demoMode = bool(env.DEMO_MODE, false);
  if (production && demoMode && !bool(env.ALLOW_DEMO_IN_PRODUCTION, false)) {
    // Use NODE_ENV=uat for hosted demo/UAT environments instead.
    throw new Error('DEMO_MODE must not be enabled in production');
  }

  const databaseUrl = readSecret(env, 'DATABASE_URL') || null;
  if (production && !databaseUrl && !bool(env.ALLOW_MEMORY_STORE, false)) {
    throw new Error('DATABASE_URL is required in production (the in-memory store loses all data on restart)');
  }

  const cfg = {
    nodeEnv,
    production,
    port: int(env.PORT, 3000),
    publicBaseUrl: env.PUBLIC_BASE_URL || `http://localhost:${int(env.PORT, 3000)}`,
    databaseUrl,
    databaseSsl: bool(env.DATABASE_SSL, production),
    dbPoolMax: int(env.DB_POOL_MAX, 10),
    jwtSecret: secret('JWT_SECRET', 48),
    jwtTtlSeconds: int(env.JWT_TTL_SECONDS, 1800),
    mfaRequiredRoles: (env.MFA_REQUIRED_ROLES || 'admin,rule_approver,compliance_officer,data_steward').split(',').map((s) => s.trim()).filter(Boolean),
    blindIndexKey: Buffer.from(secret('BLIND_INDEX_KEY'), 'base64'),
    dataKeys,
    activeDataKey,
    corsOrigins: (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    rateLimit: { windowMs: int(env.RATE_LIMIT_WINDOW_MS, 60000), max: int(env.RATE_LIMIT_MAX, 300), loginMax: int(env.RATE_LIMIT_LOGIN_MAX, 10) },
    lockout: { maxFailures: int(env.LOCKOUT_MAX_FAILURES, 5), minutes: int(env.LOCKOUT_MINUTES, 15) },
    bodyLimitBytes: int(env.BODY_LIMIT_BYTES, 1024 * 1024),
    logLevel: env.LOG_LEVEL || (production ? 'info' : 'debug'),
    demoMode,
    demoPassword: readSecret(env, 'DEMO_PASSWORD') || null,
    seedRecords: int(env.SEED_RECORDS, 2500),
    seed: int(env.SEED, 20261007),
    simToday: env.SIM_TODAY || null,
    rulesDir: env.RULES_DIR || 'config/rules',
    trustProxy: bool(env.TRUST_PROXY, production),
    trustProxyHops: int(env.TRUST_PROXY_HOPS, 1),
    metricsToken: readSecret(env, 'METRICS_TOKEN') || null,
    linkTtlDays: int(env.LINK_TTL_DAYS, 30),
    warnings,
  };
  return cfg;
}

module.exports = { loadConfig };
