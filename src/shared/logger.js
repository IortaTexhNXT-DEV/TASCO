'use strict';

/**
 * Structured JSON logger (one line per event) with PII redaction. Ships to
 * stdout so the platform (Kubernetes / Railway / Docker) collects it.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT_KEYS = /^(password|pass|secret|token|authorization|cookie|phone|altPhones|name|totpSecret|apiKey|otp|code|mfaToken|refreshToken|accessToken)$/i;

function redact(value, depth = 0) {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

function createLogger({ level = 'info', base = {}, sink = (line) => process.stdout.write(`${line}\n`) } = {}) {
  const min = LEVELS[level] ?? LEVELS.info;
  const log = (lvl, msg, fields) => {
    if (LEVELS[lvl] < min) return;
    const entry = { ts: new Date().toISOString(), level: lvl, msg, ...base, ...redact(fields || {}) };
    if (fields && fields.err instanceof Error) {
      entry.err = { message: fields.err.message, code: fields.err.code, stack: fields.err.stack };
    }
    sink(JSON.stringify(entry));
  };
  return {
    debug: (m, f) => log('debug', m, f),
    info: (m, f) => log('info', m, f),
    warn: (m, f) => log('warn', m, f),
    error: (m, f) => log('error', m, f),
    child: (extra) => createLogger({ level, base: { ...base, ...extra }, sink }),
  };
}

module.exports = { createLogger, redact };
