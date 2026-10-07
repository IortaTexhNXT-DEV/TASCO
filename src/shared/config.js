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

/** Production guard: TASCO core must price quotes unless local rating is explicitly allowed. */
function assertProductionRating({ ratingSource, allowLocalRating, coreBaseUrl, coreClientId, coreClientSecret }) {
  if (ratingSource === 'rules' && !allowLocalRating) {
    throw new Error('RATING_SOURCE=rules (local rule-set rating) is not allowed in production — TASCO core is the system of record for rating. Set RATING_SOURCE=core or core_with_fallback, or ALLOW_LOCAL_RATING=true to override explicitly.');
  }
  if (ratingSource !== 'rules' && !coreBaseUrl && !allowLocalRating) {
    throw new Error(`TASCO_CORE_BASE_URL is required in production with RATING_SOURCE=${ratingSource} (without it the simulated core would be used)`);
  }
  if (coreBaseUrl && coreBaseUrl.startsWith('http://')) throw new Error('TASCO_CORE_BASE_URL must use https in production');
  if (coreBaseUrl && (!coreClientId || !coreClientSecret)) {
    throw new Error('TASCO_CORE_CLIENT_ID and TASCO_CORE_CLIENT_SECRET (or TASCO_CORE_CLIENT_SECRET_FILE) are required in production when TASCO_CORE_BASE_URL is set');
  }
}

function ratingConfig(env, production, warnings) {
  // Rating: TASCO core is the system of record for products and premiums.
  //   rules              – local rule sets (sandbox / demo; current behaviour)
  //   core               – TASCO core prices every quote; fail closed (503) when core is down
  //   core_with_fallback – core first; if core is unreachable, a local *indicative* price
  //                        that cannot be paid until re-rated by core
  const ratingSource = (env.RATING_SOURCE || 'rules').trim().toLowerCase();
  const RATING_SOURCES = ['rules', 'core', 'core_with_fallback'];
  if (!RATING_SOURCES.includes(ratingSource)) throw new Error(`RATING_SOURCE must be one of ${RATING_SOURCES.join(', ')} (got ${ratingSource})`);
  const allowLocalRating = bool(env.ALLOW_LOCAL_RATING, false);
  const coreBaseUrl = (env.TASCO_CORE_BASE_URL || '').trim().replace(/\/+$/, '') || null;
  if (coreBaseUrl && !/^https?:\/\//.test(coreBaseUrl)) throw new Error('TASCO_CORE_BASE_URL must be an http(s) URL');
  const coreClientSecret = readSecret(env, 'TASCO_CORE_CLIENT_SECRET') || null;
  const coreClientId = env.TASCO_CORE_CLIENT_ID || null;
  if (production) assertProductionRating({ ratingSource, allowLocalRating, coreBaseUrl, coreClientId, coreClientSecret });
  if (ratingSource !== 'rules' && !coreBaseUrl) warnings.push(`RATING_SOURCE=${ratingSource} without TASCO_CORE_BASE_URL — using the simulated TASCO core (sandbox/UAT only)`);

  return {
    ratingSource,
    allowLocalRating,
    tascoCore: {
      baseUrl: coreBaseUrl,
      tokenUrl: (env.TASCO_CORE_TOKEN_URL || '').trim() || (coreBaseUrl ? `${coreBaseUrl}/oauth2/token` : null),
      clientId: coreClientId,
      clientSecret: coreClientSecret,
      scope: env.TASCO_CORE_SCOPE || 'rating:quote products:read',
      timeoutMs: int(env.TASCO_CORE_TIMEOUT_MS, 5000),
    },
  };
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

  const rating = ratingConfig(env, production, warnings);

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
    // UAT only: derive demo users' authenticator keys from this seed (so they can be
    // published to testers) and reset demo accounts (unlock, password) at start-up.
    demoTotpSeed: readSecret(env, 'DEMO_TOTP_SEED') || null,
    demoAccountSync: bool(env.DEMO_ACCOUNT_SYNC, false),
    seedRecords: int(env.SEED_RECORDS, 2500),
    seed: int(env.SEED, 20261007),
    simToday: env.SIM_TODAY || null,
    rulesDir: env.RULES_DIR || 'config/rules',
    trustProxy: bool(env.TRUST_PROXY, production),
    trustProxyHops: int(env.TRUST_PROXY_HOPS, 1),
    metricsToken: readSecret(env, 'METRICS_TOKEN') || null,
    linkTtlDays: int(env.LINK_TTL_DAYS, 30),
    ...rating,
    warnings,
  };
  return cfg;
}

module.exports = { loadConfig };
