'use strict';

const { errors } = require('./errors');

/**
 * Resilience wrapper for outbound integrations: timeout + retry with
 * exponential backoff and jitter + circuit breaker. Every external adapter is
 * wrapped so a slow or failing partner degrades one feature, not the platform.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Machine-readable cause on upstream errors (timeout | circuit_open | …) for fallback decisions. */
function tagged(err, reason) {
  err.reason = reason;
  return err;
}

function withTimeout(promise, ms, name) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(tagged(errors.upstream(`${name} timed out after ${ms}ms`), 'timeout')), ms); }),
  ]);
}

function createCircuitBreaker({ name, failureThreshold = 5, resetMs = 30000, timeoutMs = 5000, retries = 2, baseDelayMs = 100, metrics, logger } = {}) {
  let state = 'closed';
  let failures = 0;
  let openedAt = 0;
  // Read-only health counters for the operations console (latency of the last call, last success/failure time).
  const st = { calls: 0, failures: 0, lastLatencyMs: null, lastCallAt: null, lastSuccessAt: null, lastFailureAt: null };

  const isRetryable = (e) => !(e && e.status && e.status < 500 && e.status !== 429);

  async function exec(fn) {
    if (state === 'open') {
      if (Date.now() - openedAt < resetMs) {
        metrics?.inc('integration_short_circuit_total', { integration: name });
        throw tagged(errors.upstream(`${name} unavailable (circuit open)`), 'circuit_open');
      }
      state = 'half_open';
    }
    let attempt = 0;
    for (;;) {
      const started = Date.now();
      try {
        const out = await withTimeout(Promise.resolve().then(fn), timeoutMs, name);
        Object.assign(st, { calls: st.calls + 1, lastLatencyMs: Date.now() - started, lastCallAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString() });
        failures = 0;
        if (state !== 'closed') logger?.info('circuit closed', { integration: name });
        state = 'closed';
        metrics?.inc('integration_calls_total', { integration: name, result: 'ok' });
        return out;
      } catch (e) {
        Object.assign(st, { calls: st.calls + 1, failures: st.failures + 1, lastLatencyMs: Date.now() - started, lastCallAt: new Date().toISOString(), lastFailureAt: new Date().toISOString() });
        metrics?.inc('integration_calls_total', { integration: name, result: 'error' });
        if (state === 'half_open' || !isRetryable(e) || attempt >= retries) {
          if (isRetryable(e)) {
            failures++;
            if (failures >= failureThreshold || state === 'half_open') {
              state = 'open';
              openedAt = Date.now();
              logger?.warn('circuit opened', { integration: name, failures });
            }
          }
          throw e;
        }
        attempt++;
        await sleep(baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random()));
      }
    }
  }

  return { exec, state: () => state, stats: () => ({ ...st }), name };
}

module.exports = { createCircuitBreaker, withTimeout, sleep, tagged };
