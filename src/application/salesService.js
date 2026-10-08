'use strict';

const crypto = require('crypto');
const { coverStartDate, commissionFor } = require('../domain/rating');
const { createRatingService } = require('./ratingService');
const { benefitsFor, factsFor } = require('../domain/leads');
const { errors } = require('../shared/errors');
const { maskPhone } = require('../shared/util');
const { maskPlate } = require('../domain/voicebot');

/**
 * Quote → pay → issue → e-certificate, for every channel (VETC app, Zalo,
 * telesales, partner API). Purchases are idempotent (Idempotency-Key) so a
 * retried tap can never double-charge.
 */

function createSalesService({ store, rules, audit, events, clock, logger, metrics, gateways, config, rating: ratingPort }) {
  const rating = ratingPort || createRatingService({ rules, gateways, config, logger, metrics });
  const quotes = store.collection('quotes');
  const orders = store.collection('orders');
  const policies = store.collection('policies');
  /** VETC wallet inside the VETC app and Zalo mini app; TASCO's own payment gateway inside TASCO's app and website. */
  const paymentFor = (channel) => ((channel === 'tasco_app' || channel === 'tasco_web') && gateways.paymentTasco ? gateways.paymentTasco : gateways.payment);
  const profiles = store.collection('profiles');
  const partners = store.collection('partners');

  async function product(code) {
    const catalogue = await rules.get('products');
    const p = catalogue.products.find((x) => x.code === code);
    if (!p) throw errors.validation(`Unknown product ${code}`);
    return p;
  }

  async function catalogue() {
    return rules.get('products');
  }

  /** CoreRating port request: risk attributes only — no plate, name or phone (identity goes to core at binding). */
  function ratingRequest(idempotencyKey, profile, input, startDate, today) {
    const v = profile.vehicle || {};
    return {
      idempotencyKey, channel: input.channel, partnerId: input.partnerId || null, quoteDate: today, startDate, termYears: input.termYears,
      holder: { type: profile.ownerType || 'individual' },
      vehicle: { category: v.category, usage: v.usage, seats: v.seats, firstRegisteredYear: v.firstRegisteredYear },
    };
  }

  /** Everything that must hold before a quote may be paid. */
  async function assertPayable(q) {
    if (q.status !== 'open') throw errors.rule(`Quote is ${q.status}`);
    if (new Date(q.expiresAt) < clock.now()) throw errors.rule('Quote expired — please re-quote');
    if (q.indicative) {
      // Priced locally while TASCO core was unavailable: core has not committed to this price.
      throw errors.rule('This price is indicative (TASCO core was unavailable when it was quoted) — it must be re-rated by TASCO core before payment', { quoteId: q.id, reason: 'indicative_quote' });
    }
    const cat = await rules.get('products');
    const needsInspection = q.lines.filter((l) => cat.products.find((p) => p.code === l.product)?.requiresInspection);
    if (needsInspection.length && !q.inspection?.passed) {
      throw errors.rule('Physical damage cover needs a vehicle inspection first — a TASCO assessor will contact you', { products: needsInspection.map((l) => l.product) });
    }
  }

  /** Platform quote TTL, never beyond the validity TASCO core gave its price. */
  async function quoteExpiry(coreValidUntil) {
    const platform = clock.now().getTime() + (await rules.get('service_levels')).quoteTtlHours * 3600000;
    const core = coreValidUntil ? new Date(coreValidUntil).getTime() : Infinity;
    return new Date(Math.min(platform, core)).toISOString();
  }

  const service = {
    catalogue,

    /**
     * @param input { profileId, products: [{ code, options }], channel, partnerId, termYears }
     */
    async quote(input, actor) {
      const profile = await profiles.get(input.profileId);
      if (!profile || profile.anonymised) throw errors.notFound('Customer');
      const cat = await catalogue();
      const today = clock.today();
      const startDate = coverStartDate(profile.policy.expiryDate, today);
      const products = [];
      for (const req of input.products) {
        const prod = await product(req.code);
        if (!prod.channels.includes(input.channel)) throw errors.rule(`${prod.code} is not sold on channel ${input.channel}`);
        if (prod.status !== 'active') throw errors.rule(`Product ${prod.code} is not on sale`);
        products.push({ prod, options: req.options || {} });
      }
      const id = `Q-${crypto.randomUUID()}`;
      // Priced by TASCO core or local rule sets, per RATING_SOURCE (see ratingService).
      const rated = await rating.rate({ products, request: ratingRequest(id, profile, input, startDate, today) });
      const lines = rated.lines;
      const facts = factsFor(profile, today);
      const benefitRules = await rules.get('benefits');
      const q = {
        id,
        profileId: profile.id,
        plate: profile.plate,
        channel: input.channel,
        partnerId: input.partnerId || null,
        journey: input.journey || null,
        // 'quick' = 3-step quick renewal in the customer app (eligibility checked by the route); null = standard flow.
        flow: input.flow || null,
        lines,
        total: lines.reduce((s, l) => s + l.total, 0),
        benefits: benefitsFor(benefitRules, facts),
        bundle: cat.bundles.find((b) => b.status === 'active' && b.products.length === lines.length && b.products.every((c) => lines.some((l) => l.product === c)))?.code || null,
        status: 'open',
        // Rating provenance: who priced this quote, and whether it can be bound as-is.
        ratingSource: rated.ratingSource,
        ratingVersion: rated.ratingVersion,
        coreQuoteRef: rated.coreQuoteRef,
        indicative: rated.indicative,
        ratingRequest: { products: input.products.map((p) => ({ code: p.code, ...(p.options ? { options: p.options } : {}) })), termYears: input.termYears || null },
        createdBy: actor.id,
        createdAt: clock.now().toISOString(),
        expiresAt: await quoteExpiry(rated.coreValidUntil),
      };
      await quotes.insert(q);
      await audit.record({ actor: actor.id, action: 'quote.created', entityType: 'quote', entityId: q.id, details: { profileId: profile.id, products: lines.map((l) => l.product), total: q.total, channel: q.channel, ratingSource: q.ratingSource, coreQuoteRef: q.coreQuoteRef, indicative: q.indicative } });
      metrics?.inc('quotes_total', { channel: q.channel });
      return q;
    },

    /**
     * Re-price an indicative quote (issued while TASCO core was unavailable) with
     * core. Core must answer — there is no fallback — and only then can it be paid.
     */
    async rerate(id, actor) {
      const q = await service.getQuote(id);
      if (q.status !== 'open') throw errors.rule(`Quote is ${q.status}`);
      if (!q.indicative) throw errors.rule('Quote is already priced by TASCO core — no re-rating needed');
      const profile = await profiles.get(q.profileId);
      if (!profile || profile.anonymised) throw errors.notFound('Customer');
      const today = clock.today();
      const startDate = coverStartDate(profile.policy.expiryDate, today);
      const reqProducts = q.ratingRequest?.products || q.lines.map((l) => ({ code: l.product }));
      const products = [];
      for (const r of reqProducts) products.push({ prod: await product(r.code), options: r.options || {} });
      const rated = await rating.rate({
        products, coreOnly: true,
        request: ratingRequest(`${q.id}:rerate`, profile, { channel: q.channel, partnerId: q.partnerId, termYears: q.ratingRequest?.termYears || undefined }, startDate, today),
      });
      const total = rated.lines.reduce((s, l) => s + l.total, 0);
      const saved = await quotes.update({
        ...q, lines: rated.lines, total, ratingSource: rated.ratingSource, ratingVersion: rated.ratingVersion, coreQuoteRef: rated.coreQuoteRef, indicative: false,
        previousTotal: q.total, reratedAt: clock.now().toISOString(), reratedBy: actor.id, expiresAt: await quoteExpiry(rated.coreValidUntil),
      });
      await audit.record({ actor: actor.id, action: 'quote.rerated', entityType: 'quote', entityId: id, details: { previousTotal: q.total, total, coreQuoteRef: rated.coreQuoteRef, ratingVersion: rated.ratingVersion } });
      return saved;
    },

    /** Open (unexpired, unpaid) quotes for a customer — shown in the app for confirmation. */
    async openQuotes(profileId) {
      const now = clock.now().toISOString();
      return (await quotes.find({ where: { profile_id: profileId, status: 'open' }, orderBy: ['created_at', 'desc'], limit: 10 })).filter((x) => x.expiresAt > now);
    },

    /** Record the vehicle inspection required by MOTOR_PD before the customer can pay. */
    async recordInspection(id, { passed, evidence }, actor) {
      const q = await service.getQuote(id);
      if (q.status !== 'open') throw errors.rule(`Quote is ${q.status}`);
      const saved = await quotes.update({ ...q, inspection: { passed, evidence, by: actor.id, at: clock.now().toISOString() } });
      await audit.record({ actor: actor.id, action: 'quote.inspection_recorded', entityType: 'quote', entityId: id, details: { passed } });
      return saved;
    },

    async markSent(id, actor) {
      const q = await service.getQuote(id);
      if (q.status !== 'open') throw errors.rule(`Quote is ${q.status}`);
      const saved = await quotes.update({ ...q, sentToCustomerAt: clock.now().toISOString(), sentBy: actor.id });
      await audit.record({ actor: actor.id, action: 'quote.sent_to_customer', entityType: 'quote', entityId: id, details: { profileId: q.profileId } });
      return saved;
    },

    async getQuote(id) {
      const q = await quotes.get(id);
      if (!q) throw errors.notFound('Quote');
      return q;
    },

    /**
     * Pay + issue. idempotencyKey makes retries safe.
     * @param input { quoteId, idempotencyKey, paymentMethod: 'vetc_wallet', holderName }
     */
    async purchase(input, actor) {
      const orderId = `O-${crypto.createHash('sha256').update(`${input.quoteId}:${input.idempotencyKey}`).digest('hex').slice(0, 20)}`;
      const existing = await orders.get(orderId);
      if (existing) {
        if (existing.status !== 'completed') throw errors.conflict(`A previous attempt with this Idempotency-Key ended as ${existing.status} — retry with a new key`, { orderId, status: existing.status });
        return { order: existing, idempotentReplay: true };
      }

      const q0 = await service.getQuote(input.quoteId);
      await assertPayable(q0);
      // Atomically claim the quote (optimistic lock): concurrent purchases with different
      // idempotency keys cannot both reach the payment step.
      let q;
      try {
        q = await quotes.update({ ...q0, status: 'paying', payingOrderId: orderId });
      } catch (e) {
        if (e.code === 'CONFLICT') throw errors.conflict('This quote is already being paid');
        throw e;
      }
      const profile = await profiles.get(q.profileId);

      const order = {
        id: orderId, quoteId: q.id, profileId: q.profileId, channel: q.channel, partnerId: q.partnerId, journey: q.journey,
        amount: q.total, status: 'pending_payment', createdBy: actor.id, createdAt: clock.now().toISOString(), createdDate: clock.today(),
        coreQuoteRef: q.coreQuoteRef || null, flow: q.flow || null,
      };
      await orders.insert(order);

      let payment;
      try {
        if (q.channel === 'partner_api') {
          // Partners collect the premium themselves and remit via the commission statement.
          payment = { transactionId: `PARTNER-${q.partnerId}-${orderId}`, status: 'partner_collected' };
        } else {
          // Customer-initiated only: staff can send a quote but never debit a wallet.
          if (!actor.roles?.includes('customer')) throw errors.forbidden('Only the customer can confirm payment, inside the customer app');
          const pay = paymentFor(q.channel);
          payment = await pay.exec(() => pay.port.debit({ idempotencyKey: orderId, customerId: q.profileId, amount: q.total, description: `Insurance ${q.plate}` }));
        }
      } catch (e) {
        await orders.upsert({ ...order, status: 'payment_failed', error: e.message });
        await quotes.upsert({ ...q, status: 'open', payingOrderId: null }); // release the quote for a retry
        await audit.record({ actor: actor.id, action: 'order.payment_failed', entityType: 'order', entityId: orderId, details: { reason: e.message } });
        throw e;
      }

      const issued = [];
      try {
        for (const line of q.lines) {
          const pol = await gateways.policyAdmin.exec(() => gateways.policyAdmin.port.issuePolicy({
            product: line.product, plate: q.plate, holderName: input.holderName || profile.name, startDate: line.startDate, endDate: line.endDate,
            premiumNet: line.premiumNet, vat: line.vat, orderId,
            // Core binds the quote it priced (null for locally rated sandbox quotes).
            coreQuoteRef: q.coreQuoteRef || null, coreLineRef: line.ratingRef || null,
          }));
          const rec = {
            id: pol.certNo, policyNo: pol.policyNo, certNo: pol.certNo, profileId: q.profileId, plate: q.plate, product: line.product, productName: line.productName, productNameVi: line.productNameVi,
            startDate: line.startDate, endDate: line.endDate, premiumNet: line.premiumNet, vat: line.vat, total: line.total,
            status: 'active', channel: q.channel, partnerId: q.partnerId, orderId, certificateUrl: pol.certificateUrl, issuedAt: pol.issuedAt, insurer: 'TASCO',
            coreQuoteRef: q.coreQuoteRef || null,
            // Vehicle as rated and issued by TASCO core (use and seats set the compulsory tariff category).
            vehicle: { usage: profile?.vehicle?.usage ?? null, seats: profile?.vehicle?.seats ?? null, category: profile?.vehicle?.category ?? null },
          };
          await policies.insert(rec);
          issued.push(rec);
        }
      } catch (e) {
        // Saga compensation: cancel any lines already issued, then refund in full.
        // Anything that cannot be compensated is left in a *_failed state for reconciliation.
        const cancelFailures = [];
        for (const pol of issued) {
          try {
            await gateways.policyAdmin.exec(() => gateways.policyAdmin.port.cancelPolicy({ policyNo: pol.policyNo, reason: 'order issuance failed' }));
            await policies.upsert({ ...pol, status: 'cancelled', cancelledAt: clock.now().toISOString(), cancelReason: 'order issuance failed' });
          } catch (ce) { cancelFailures.push({ policy: pol.id, error: ce.message }); }
        }
        let refund = { status: payment.status === 'partner_collected' ? 'not_applicable' : 'pending' };
        if (payment.status !== 'partner_collected') {
          try {
            const pay = paymentFor(q.channel);
            const r = await pay.exec(() => pay.port.refund({ transactionId: payment.transactionId, amount: q.total }));
            refund = { status: 'refunded', refundId: r.refundId };
          } catch (re) { refund = { status: 'refund_failed', error: re.message }; }
        }
        const status = refund.status === 'refund_failed' || cancelFailures.length ? 'compensation_failed' : 'issuance_failed_refunded';
        await orders.upsert({ ...order, status, paymentRef: payment.transactionId, error: e.message, policies: issued.map((p) => p.id), refund, cancelFailures });
        metrics?.inc('orders_compensation_total', { status });
        await quotes.upsert({ ...q, status: 'open', payingOrderId: null });
        await audit.record({ actor: actor.id, action: 'order.issuance_failed', entityType: 'order', entityId: orderId, details: { reason: e.message } });
        throw e;
      }

      let commission = null;
      if (q.partnerId) {
        const partner = await partners.get(q.partnerId);
        const crules = await rules.get('commission');
        commission = q.lines.map((l) => ({ product: l.product, ...commissionFor(crules, { product: l.product, partnerType: partner?.type, premiumNet: l.premiumNet }) }));
      }

      const done = await orders.upsert({ ...order, status: 'completed', paymentRef: payment.transactionId, policies: issued.map((p) => p.id), commission, completedAt: clock.now().toISOString() });
      await quotes.upsert({ ...q, status: 'converted', orderId });

      // TASCO-issued cover is the strongest evidence: update the golden record.
      const tnds = issued.find((p) => p.product.startsWith('TNDS'));
      if (tnds) {
        const fresh = await profiles.get(q.profileId);
        await profiles.update({
          ...fresh,
          policy: { ...fresh.policy, expiryDate: tnds.endDate, expiryMethod: 'tasco_issued', expiryConfidence: 1, insurer: 'TASCO', certNo: tnds.certNo, verified: true },
          lineage: [...(fresh.lineage || []), { field: 'policy.expiryDate', source: 'tasco_issued', confidence: 1, at: clock.now().toISOString() }],
        });
      }
      await audit.record({ actor: actor.id, action: 'order.completed', entityType: 'order', entityId: orderId, details: { amount: q.total, policies: issued.map((p) => p.id), channel: q.channel, partnerId: q.partnerId } });
      await events.publish('policy.issued', { orderId, profileId: q.profileId, policies: issued.map((p) => ({ id: p.id, product: p.product, endDate: p.endDate })), channel: q.channel, journey: q.journey }, { actor: actor.id });
      metrics?.inc('orders_completed_total', { channel: q.channel, journey: q.journey || 'none' });
      logger?.info('order completed', { orderId, channel: q.channel });
      return { order: done, policies: issued, idempotentReplay: false };
    },

    /** Public, minimal certificate check (QR) — no PII disclosed. */
    async verifyCertificate(certNo, today = clock.today()) {
      const p = await policies.get(certNo);
      if (!p) return { valid: false, reason: 'not_found' };
      let state = 'in_force';
      if (p.status !== 'active') state = p.status;
      else if (p.startDate > today) state = 'not_yet_in_force';
      else if (p.endDate < today) state = 'expired';
      return {
        valid: state === 'in_force',
        issued: true,
        state,
        status: p.status,
        certNo: p.certNo,
        product: p.product,
        plate: maskPlate(p.plate),
        insurer: 'TASCO Insurance',
        startDate: p.startDate,
        endDate: p.endDate,
      };
    },

    async listPolicies({ profileId, partnerId, product, limit = 50, offset = 0 }) {
      const where = {};
      if (profileId) where.profile_id = profileId;
      if (partnerId) where.partner_id = partnerId;
      if (product) where.product = product;
      return policies.find({ where, orderBy: ['end_date', 'desc'], limit, offset });
    },

    async listOrders({ profileId, partnerId, status, limit = 50, offset = 0 }) {
      const where = {};
      if (profileId) where.profile_id = profileId;
      if (partnerId) where.partner_id = partnerId;
      if (status) where.status = status;
      return orders.find({ where, orderBy: ['created_at', 'desc'], limit, offset });
    },

    maskPhone,
  };
  return service;
}

module.exports = { createSalesService };
