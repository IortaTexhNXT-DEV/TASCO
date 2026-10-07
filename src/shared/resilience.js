'use strict';

const { errors } = require('./errors');

/**
 * Resilience wrapper for outbound integrations: timeout + retry with
 * exponential backoff and jitter + circuit breaker. Every external adapter is
 * wrapped so a slow or failing partner degrades one feature, not the platform.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, name) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(errors.upstream(`${name} timed out after ${ms}ms`)), ms); }),
  ]);
}

function createCircuitBreaker({ name, failureThreshold = 5, resetMs = 30000, timeoutMs = 5000, retries = 2, baseDelayMs = 100, metrics, logger } = {}) {
  let state = 'closed';
  let failures = 0;
  let openedAt = 0;

  const isRetryable = (e) => !(e && e.status && e.status < 500 && e.status !== 429);

  async function exec(fn) {
    if (state === 'open') {
      if (Date.now() - openedAt < resetMs) {
        metrics?.inc('integration_short_circuit_total', { integration: name });
        throw errors.upstream(`${name} unavailable (circuit open)`);
      }
      state = 'half_open';
    }
    let attempt = 0;
    for (;;) {
      try {
        const out = await withTimeout(Promise.resolve().then(fn), timeoutMs, name);
        failures = 0;
        if (state !== 'closed') logger?.info('circuit closed', { integration: name });
        state = 'closed';
        metrics?.inc('integration_calls_total', { integration: name, result: 'ok' });
        return out;
      } catch (e) {
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

  return { exec, state: () => state, name };
}

module.exports = { createCircuitBreaker, withTimeout, sleep };
