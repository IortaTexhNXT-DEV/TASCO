'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createLogger } = require('../shared/logger');
const { createMetrics } = require('../shared/metrics');
const { createClock } = require('../shared/clock');
const { createFieldCipher } = require('../shared/crypto');
const { createCircuitBreaker } = require('../shared/resilience');
const { createCodec } = require('../adapters/persistence/codec');
const { createMemoryStore } = require('../adapters/persistence/memoryStore');
const { createOutboxEventBus } = require('../adapters/messaging/outboxEventBus');
const { createVetcWalletGateway, createTascoPaymentGateway, createTascoCoreGateway, createNotificationGateway } = require('../adapters/integrations/mockGateways');
const { createSimulatedCaller } = require('../adapters/integrations/simulatedCaller');
const { createTascoCoreRatingClient } = require('../adapters/integrations/tascoCoreRatingClient');
const { createSimulatedTascoCore } = require('../adapters/integrations/simulatedTascoCore');
const { createAuditService } = require('../application/auditService');
const { createRulesService } = require('../application/rulesService');
const { createIngestionService } = require('../application/ingestionService');
const { createLeadService } = require('../application/leadService');
const { createJourneyService } = require('../application/journeyService');
const { createVoiceService } = require('../application/voiceService');
const { createSalesService } = require('../application/salesService');
const { createRatingService } = require('../application/ratingService');
const { createCatalogueService } = require('../application/catalogueService');
const { createPartnerService } = require('../application/partnerService');
const { createClaimsService } = require('../application/claimsService');
const { createCustomerService } = require('../application/customerService');
const { createIdentityService } = require('../application/identityService');
const { createAccessPolicy } = require('../application/accessPolicy');
const { createInsightsService } = require('../application/insightsService');
const { createOpsService } = require('../application/opsService');
const { addDays, fmtDate } = require('../shared/util');

const ROOT = path.join(__dirname, '..', '..');

/**
 * Composition root (hexagonal architecture): the only place that knows which
 * adapter implements which port. Swap the in-memory store for Postgres, or a
 * sandbox gateway for the real VETC/TASCO/Zalo API, here — nowhere else.
 */
async function createContainer(config, { logSink, store: injectedStore } = {}) {
  const logger = createLogger({ level: config.logLevel, base: { service: 'tasco-growth-platform' }, sink: logSink });
  for (const w of config.warnings) logger.warn(w);
  const metrics = createMetrics();
  const clock = createClock(config.simToday);
  const cipher = createFieldCipher({ keys: config.dataKeys, activeKeyId: config.activeDataKey });
  const codec = createCodec({ cipher, blindKey: config.blindIndexKey });

  let store = injectedStore;
  if (!store) {
    if (config.databaseUrl) {
      const { createPostgresStore } = require('../adapters/persistence/postgresStore');  
      store = createPostgresStore({ codec, databaseUrl: config.databaseUrl, ssl: config.databaseSsl, poolMax: config.dbPoolMax, logger });
    } else {
      store = createMemoryStore({ codec });
    }
  }

  const rbac = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'security', 'rbac.json'), 'utf8'));
  const events = createOutboxEventBus({ store, logger, metrics });
  const audit = createAuditService({ store, logger });
  const rules = createRulesService({ store, audit, events, clock, logger, rbac });

  const breaker = (name, port, opts) => ({ port, ...createCircuitBreaker({ name, metrics, logger, ...opts }) });
  const gateways = {
    payment: breaker('vetc-wallet', createVetcWalletGateway()),
    paymentTasco: breaker('tasco-payment', createTascoPaymentGateway()),
    policyAdmin: breaker('tasco-core', createTascoCoreGateway({ publicBaseUrl: config.publicBaseUrl })),
    telephony: breaker('voice-ai', createSimulatedCaller({ seed: config.seed }), { timeoutMs: 30000, retries: 0 }),
    notify: {
      app_push: breaker('app-push', createNotificationGateway({ channel: 'app_push' })),
      zalo_zns: breaker('zalo-zns', createNotificationGateway({ channel: 'zalo_zns' })),
      sms: breaker('sms', createNotificationGateway({ channel: 'sms' })),
    },
    ...coreGateways({ config, rules, clock, logger, metrics, breaker }),
  };

  // Signed deep links (no enumerable ids in customer-facing URLs).
  const linkKey = crypto.createHash('sha256').update(`links:${config.jwtSecret}`).digest();
  // Token = <profileId>.<expiry epoch seconds>.<HMAC>; expires after LINK_TTL_DAYS.
  const mac = (payload) => crypto.createHmac('sha256', linkKey).update(payload).digest('base64url').slice(0, 22);
  const links = {
    sign: (profileId, ttlDays = config.linkTtlDays) => {
      const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
      return `${profileId}.${exp}.${mac(`${profileId}.${exp}`)}`;
    },
    verify(token) {
      const [id, exp, sig] = String(token || '').split('.');
      if (!id || !exp || !sig || !/^\d+$/.test(exp)) return null;
      if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
      const expected = mac(`${id}.${exp}`);
      return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
    },
    renew(profileId, journey) { return `${config.publicBaseUrl}/app/?r=${this.sign(profileId)}${journey ? `&j=${encodeURIComponent(journey)}` : ''}`; },
  };

  const deps = { store, rules, audit, events, clock, logger, metrics, gateways, config, links, rbac };
  const voice = createVoiceService(deps);
  const rating = createRatingService(deps);
  const ops = createOpsService(deps);
  const services = {
    rules,
    audit,
    ingestion: createIngestionService(deps),
    leads: createLeadService(deps),
    voice,
    journeys: createJourneyService({ ...deps, voice }),
    sales: createSalesService({ ...deps, rating }),
    rating,
    partners: createPartnerService(deps),
    claims: createClaimsService(deps),
    customers: createCustomerService(deps),
    identity: createIdentityService(deps),
    access: createAccessPolicy(deps),
    insights: createInsightsService(deps),
    ops,
    catalogue: createCatalogueService({ ...deps, ops }),
  };

  registerSubscribers({ events, services, store, clock, rules, config });

  return { config, logger, metrics, clock, store, events, gateways, links, rbac, services };
}

/**
 * TASCO core rating + product catalogue ports. With TASCO_CORE_BASE_URL the real
 * HTTP client is used (it carries its own retry/circuit breakers, so `exec` is a
 * pass-through); without it the simulated core keeps sandbox/UAT working.
 */
function coreGateways({ config, rules, clock, logger, metrics, breaker }) {
  const core = config.tascoCore || {};
  if (core.baseUrl) {
    const client = createTascoCoreRatingClient({ ...core, logger, metrics });
    const direct = (name, state) => ({ name, port: client, exec: (fn) => fn(), state, mode: client.mode, endpoint: client.endpoint });
    return {
      coreRating: direct('tasco-core-rating', client.circuit.rating),
      productCatalogue: direct('tasco-core-catalogue', client.circuit.catalogue),
    };
  }
  const sim = createSimulatedTascoCore({ rules, clock });
  return {
    coreRating: { ...breaker('tasco-core-rating', sim, { timeoutMs: core.timeoutMs || 5000, retries: 1 }), mode: sim.mode, endpoint: null },
    productCatalogue: { ...breaker('tasco-core-catalogue', sim, { timeoutMs: 30000, retries: 1 }), mode: sim.mode, endpoint: null },
  };
}

/** Event-driven reactions (idempotent handlers). */
function registerSubscribers({ events, services, store, clock, rules, config }) {
  events.subscribe('profiles.rebuilt', 'recompute-leads', async (e) => {
    await services.leads.recompute(e.payload.profileIds, { actor: 'event:profiles.rebuilt' });
  });
  events.subscribe('lead.recompute_requested', 'recompute-leads', async (e) => {
    await services.leads.recompute(e.payload.profileIds, { actor: `event:${e.payload.reason}` });
  });
  events.subscribe('policy.issued', 'stop-journeys', async (e) => {
    await services.leads.recompute([e.payload.profileId], { actor: 'event:policy.issued' });
  });
  events.subscribe('policy.issued', 'confirmation-and-cross-sell', async (e) => {
    const profile = await store.collection('profiles').get(e.payload.profileId);
    const lead = await store.collection('leads').get(e.payload.profileId);
    if (!profile) return;
    const tnds = e.payload.policies.find((p) => p.product.startsWith('TNDS'));
    const first = tnds || e.payload.policies[0];
    const now = clock.now();
    for (const ch of ['app_push', 'zalo_zns']) {
      if (!profile.channels[ch]) continue;
      await services.journeys.sendMessage({
        profile, lead, channel: ch, templateKey: 'purchase_confirmation', marketing: false, journey: 'service', step: 'confirmation', now,
        extra: { certNo: first.id, expiry: first.endDate.split('-').reverse().join('/'), link: `${config.publicBaseUrl}/verify/${encodeURIComponent(first.id)}` },
      });
      break;
    }
    // Cross-sell: only products not already bought, only for TNDS-only orders, only with marketing consent.
    const hasAddOns = e.payload.policies.some((p) => !p.product.startsWith('TNDS'));
    if (tnds && !hasAddOns && profile.consent.marketing) {
      const j = await rules.get('journeys');
      for (const s of j.crossSell.steps) {
        const due = fmtDate(addDays(clock.today(), s.offset));
        await store.collection('touchpoints').upsert({
          id: `${profile.id}:cross_sell:${s.step}:${due}`, profileId: profile.id, journey: 'cross_sell', step: s.step, dueDate: due,
          channels: s.channels, channel: null, marketing: s.marketing, template: s.template, status: 'scheduled',
        });
      }
    }
  });
  events.subscribe('renewal.link_requested', 'send-link', async (e) => {
    const profile = await store.collection('profiles').get(e.payload.profileId);
    const lead = await store.collection('leads').get(e.payload.profileId);
    if (!profile) return;
    for (const ch of ['app_push', 'zalo_zns', 'sms']) {
      if (!profile.channels[ch]) continue;
      // Customer asked for it on the call → service message, not marketing.
      const m = await services.journeys.sendMessage({ profile, lead, channel: ch, templateKey: 'first_reminder', marketing: false, journey: e.payload.journey, step: 'requested_link', now: clock.now() });
      if (m.status === 'sent') break;
    }
  });
  events.subscribe('claim.submitted', 'acknowledge-claim', async (e) => {
    const profile = await store.collection('profiles').get(e.payload.profileId);
    if (!profile) return;
    const sl = await rules.get('service_levels');
    for (const ch of ['app_push', 'zalo_zns', 'sms']) {
      if (!profile.channels[ch]) continue;
      const m = await services.journeys.sendMessage({ profile, lead: null, channel: ch, templateKey: 'claim_received', marketing: false, journey: 'service', step: 'claim_ack', now: clock.now(), extra: { claimId: e.payload.claimId, slaHours: sl.claimAckSlaHours } });
      if (m.status === 'sent') break;
    }
  });
  events.subscribe('rules.activated', 'invalidate-cache', async () => {
    services.rules.invalidate();
  });
}

module.exports = { createContainer, ROOT };
