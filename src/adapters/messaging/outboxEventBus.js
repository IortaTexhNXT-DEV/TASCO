'use strict';

const crypto = require('crypto');

/**
 * Event-driven backbone using the transactional outbox pattern.
 *
 * publish() persists the event in `domain_events` (same database as the state
 * change). relay() claims pending events (SKIP LOCKED in Postgres, so any
 * number of replicas can run it) and dispatches them to subscribers with
 * at-least-once delivery and bounded retries. Subscribers must be idempotent.
 *
 * In a later phase the relay can forward to Kafka / Pub/Sub / SNS without
 * changing publishers (see ADR-005).
 */

function createOutboxEventBus({ store, logger, metrics, maxAttempts = 5 }) {
  const col = store.collection('domain_events');
  const handlers = new Map();

  async function publish(type, payload, { actor = 'system', correlationId } = {}) {
    const evt = {
      id: crypto.randomUUID(),
      type,
      payload,
      actor,
      correlationId: correlationId || null,
      occurredAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };
    await col.insert(evt);
    metrics?.inc('events_published_total', { type });
    return evt;
  }

  function subscribe(type, name, fn) {
    if (!handlers.has(type)) handlers.set(type, []);
    handlers.get(type).push({ name, fn });
  }

  async function relay(limit = 100) {
    const batch = await store.claimEvents(limit);
    let ok = 0;
    for (const evt of batch) {
      const subs = [...(handlers.get(evt.type) || []), ...(handlers.get('*') || [])];
      const done = new Set(evt.handled || []);
      let failed = null;
      for (const h of subs) {
        if (done.has(h.name)) continue;
        try {
          await h.fn(evt);
          done.add(h.name);
        } catch (err) {
          failed = err;
          logger?.error('event handler failed', { type: evt.type, handler: h.name, eventId: evt.id, err });
          break;
        }
      }
      const attempts = (evt.attempts || 0) + 1;
      const status = failed ? (attempts >= maxAttempts ? 'dead_letter' : 'pending') : 'done';
      await col.upsert({ ...evt, status, attempts, handled: [...done], lastError: failed ? failed.message : null, processedAt: new Date().toISOString() });
      metrics?.inc('events_processed_total', { type: evt.type, status });
      if (!failed) ok++;
    }
    return { claimed: batch.length, ok };
  }

  /** Drain until no pending events remain (used by jobs and tests). */
  async function drain(maxRounds = 50) {
    let total = 0;
    for (let i = 0; i < maxRounds; i++) {
      const r = await relay(500);
      total += r.claimed;
      if (!r.claimed) break;
    }
    return total;
  }

  return { publish, subscribe, relay, drain };
}

module.exports = { createOutboxEventBus };
