'use strict';

const crypto = require('crypto');
const { rate, coverStartDate, commissionFor } = require('../domain/rating');
const { benefitsFor, factsFor } = require('../domain/leads');
const { errors } = require('../shared/errors');
const { maskPhone } = require('../shared/util');
const { maskPlate } = require('../domain/voicebot');

/**
 * Quote → pay → issue → e-certificate, for every channel (VETC app, Zalo,
 * telesales, partner API). Purchases are idempotent (Idempotency-Key) so a
 * retried tap can never double-charge.
 */

const QUOTE_TTL_HOURS = 24;

function createSalesService({ store, rules, audit, events, clock, logger, metrics, gateways }) {
  const quotes = store.collection('quotes');
  const orders = store.collection('orders');
  const policies = store.collection('policies');
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
      const lines = [];
      for (const req of input.products) {
        const prod = await product(req.code);
        if (!prod.channels.includes(input.channel)) throw errors.rule(`${prod.code} is not sold on channel ${input.channel}`);
        const rr = await rules.get(prod.rating.ruleKind);
        const o = req.options || {};
        const facts = {
          category: o.category || profile.vehicle.category,
          termYears: o.termYears || input.termYears || 1,
          startDate,
          sumInsured: o.sumInsured,
          vehicleAge: o.vehicleAge ?? (profile.vehicle.firstRegisteredYear ? new Date(today).getUTCFullYear() - profile.vehicle.firstRegisteredYear : 0),
          usage: profile.vehicle.usage,
          deductible: o.deductible ?? 0,
          seats: o.seats ?? profile.vehicle.seats ?? 5,
          sumInsuredPerSeat: o.sumInsuredPerSeat,
        };
        lines.push(rate(prod, rr, facts));
      }
      const facts = factsFor(profile, today);
      const benefitRules = await rules.get('benefits');
      const q = {
        id: `Q-${crypto.randomUUID()}`,
        profileId: profile.id,
        plate: profile.plate,
        channel: input.channel,
        partnerId: input.partnerId || null,
        journey: input.journey || null,
        lines,
        total: lines.reduce((s, l) => s + l.total, 0),
        benefits: benefitsFor(benefitRules, facts),
        bundle: cat.bundles.find((b) => b.status === 'active' && b.products.length === lines.length && b.products.every((c) => lines.some((l) => l.product === c)))?.code || null,
        status: 'open',
        createdBy: actor.id,
        createdAt: clock.now().toISOString(),
        expiresAt: new Date(clock.now().getTime() + QUOTE_TTL_HOURS * 3600000).toISOString(),
      };
      await quotes.insert(q);
      await audit.record({ actor: actor.id, action: 'quote.created', entityType: 'quote', entityId: q.id, details: { profileId: profile.id, products: lines.map((l) => l.product), total: q.total, channel: q.channel } });
      metrics?.inc('quotes_total', { channel: q.channel });
      return q;
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
      if (existing) return { order: existing, idempotentReplay: true };

      const q = await service.getQuote(input.quoteId);
      if (q.status !== 'open') throw errors.rule(`Quote is ${q.status}`);
      if (new Date(q.expiresAt) < clock.now()) throw errors.rule('Quote expired — please re-quote');
      const profile = await profiles.get(q.profileId);

      const order = {
        id: orderId, quoteId: q.id, profileId: q.profileId, channel: q.channel, partnerId: q.partnerId, journey: q.journey,
        amount: q.total, status: 'pending_payment', createdBy: actor.id, createdAt: clock.now().toISOString(), createdDate: clock.today(),
      };
      await orders.insert(order);

      let payment;
      try {
        payment = await gateways.payment.exec(() => gateways.payment.port.debit({ idempotencyKey: orderId, customerId: q.profileId, amount: q.total, description: `Insurance ${q.plate}` }));
      } catch (e) {
        await orders.upsert({ ...order, status: 'payment_failed', error: e.message });
        await audit.record({ actor: actor.id, action: 'order.payment_failed', entityType: 'order', entityId: orderId, details: { reason: e.message } });
        throw e;
      }

      const issued = [];
      try {
        for (const line of q.lines) {
          const pol = await gateways.policyAdmin.exec(() => gateways.policyAdmin.port.issuePolicy({
            product: line.product, plate: q.plate, holderName: input.holderName || profile.name, startDate: line.startDate, endDate: line.endDate,
            premiumNet: line.premiumNet, vat: line.vat, orderId,
          }));
          const rec = {
            id: pol.certNo, policyNo: pol.policyNo, certNo: pol.certNo, profileId: q.profileId, plate: q.plate, product: line.product,
            startDate: line.startDate, endDate: line.endDate, premiumNet: line.premiumNet, vat: line.vat, total: line.total,
            status: 'active', channel: q.channel, partnerId: q.partnerId, orderId, certificateUrl: pol.certificateUrl, issuedAt: pol.issuedAt, insurer: 'TASCO',
          };
          await policies.insert(rec);
          issued.push(rec);
        }
      } catch (e) {
        // Compensate: refund and flag for reconciliation. Issued lines (if any) stay and are reconciled by ops.
        await gateways.payment.port.refund({ transactionId: payment.transactionId, amount: q.total }).catch(() => {});
        await orders.upsert({ ...order, status: 'issuance_failed_refunded', paymentRef: payment.transactionId, error: e.message, policies: issued.map((p) => p.id) });
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
      const valid = p.status === 'active' && p.startDate <= today && p.endDate >= today;
      return {
        valid,
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
