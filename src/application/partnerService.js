'use strict';

const crypto = require('crypto');
const { sha256, randomToken } = require('../shared/crypto');
const { errors } = require('../shared/errors');

/**
 * Partner channel (banks, car showrooms, agents, fleets, inspection centres).
 * Partners already close most TNDS deals — instead of competing with them, the
 * platform gives them a white-label API/portal to sell TASCO through VETC data,
 * with transparent commission statements. API keys are stored only as hashes.
 */

function createPartnerService({ store, audit, clock }) {
  const partners = store.collection('partners');
  const keys = store.collection('api_keys');
  const orders = store.collection('orders');

  return {
    async create({ id, name, type, region }, actor) {
      const p = { id: id || `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, name, type, region: region || 'ALL', status: 'active', createdAt: clock.now().toISOString() };
      await partners.insert(p);
      await audit.record({ actor: actor.id, action: 'partner.created', entityType: 'partner', entityId: p.id, details: { type } });
      return p;
    },
    /** Partners with additive month-to-date stats (policies sold, commission) and active API key count. */
    async list({ type, status } = {}) {
      const where = {};
      if (type) where.type = type;
      if (status) where.status = status;
      const rows = await partners.find({ where, orderBy: ['id', 'asc'], limit: 500 });
      const today = clock.today();
      const monthStart = `${today.slice(0, 7)}-01`;
      return Promise.all(rows.map(async (p) => {
        const [mtd, activeKeys] = await Promise.all([
          orders.find({ where: { partner_id: p.id, status: 'completed', created_date: { gte: monthStart } }, limit: 5000 }),
          keys.count({ partner_id: p.id, status: 'active' }),
        ]);
        return {
          ...p,
          stats: {
            month: monthStart.slice(0, 7), orders: mtd.length, policies: mtd.reduce((s, o) => s + (o.policies?.length || 0), 0),
            commission: mtd.reduce((s, o) => s + (o.commission || []).reduce((a, c) => a + c.amount, 0), 0), activeKeys,
          },
        };
      }));
    },
    /** API keys of a partner (never the secret or its hash). */
    async listKeys(partnerId) {
      await this.get(partnerId);
      const rows = await keys.find({ where: { partner_id: partnerId }, limit: 200 });
      return rows.map((k) => ({ id: k.id, prefix: k.prefix, scopes: k.scopes, status: k.status, createdAt: k.createdAt, expiresAt: k.expiresAt || null, revokedAt: k.revokedAt || null }))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    async get(id) {
      const p = await partners.get(id);
      if (!p) throw errors.notFound('Partner');
      return p;
    },
    async setStatus(id, status, actor) {
      const p = await this.get(id);
      const saved = await partners.update({ ...p, status });
      await audit.record({ actor: actor.id, action: 'partner.status_changed', entityType: 'partner', entityId: id, details: { status } });
      return saved;
    },
    /** Returns the plaintext key ONCE; only its SHA-256 is stored. */
    async issueApiKey(partnerId, actor, { scopes, expiresInDays } = {}) {
      await this.get(partnerId);
      const secret = `tpk_${randomToken(24)}`;
      const now = clock.now();
      const rec = {
        id: `K-${crypto.randomUUID().slice(0, 8)}`, partnerId, keyHash: sha256(secret), prefix: secret.slice(0, 8), scopes: scopes?.length ? [...new Set(scopes)] : ['quote', 'purchase', 'policies:read'],
        status: 'active', createdAt: now.toISOString(), createdBy: actor.id, expiresAt: expiresInDays ? new Date(now.getTime() + expiresInDays * 86400000).toISOString() : null,
      };
      await keys.insert(rec);
      await audit.record({ actor: actor.id, action: 'partner.api_key_issued', entityType: 'partner', entityId: partnerId, details: { keyId: rec.id, prefix: rec.prefix } });
      return { ...rec, apiKey: secret };
    },
    async revokeApiKey(keyId, actor) {
      const k = await keys.get(keyId);
      if (!k) throw errors.notFound('API key');
      await keys.update({ ...k, status: 'revoked', revokedAt: clock.now().toISOString() });
      await audit.record({ actor: actor.id, action: 'partner.api_key_revoked', entityType: 'partner', entityId: k.partnerId, details: { keyId } });
      return { revoked: true };
    },
    async authenticateKey(secret) {
      if (typeof secret !== 'string' || !secret.startsWith('tpk_') || secret.length > 100) return null;
      const [k] = await keys.find({ where: { key_hash: sha256(secret), status: 'active' }, limit: 1 });
      if (!k) return null;
      if (k.expiresAt && new Date(k.expiresAt) <= clock.now()) return null;
      const p = await partners.get(k.partnerId);
      if (!p || p.status !== 'active') return null;
      return { id: `partner:${p.id}`, partnerId: p.id, partnerType: p.type, roles: ['partner_api'], scopes: k.scopes, region: p.region };
    },
    /** Commission statement for a period (from completed orders). */
    async statement(partnerId, { from, to } = {}) {
      const where = { partner_id: partnerId, status: 'completed' };
      if (from || to) where.created_date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
      const rows = await orders.find({ where, orderBy: ['created_at', 'asc'], limit: 5000 });
      const lines = rows.flatMap((o) => (o.commission || []).map((c) => ({ orderId: o.id, date: o.createdDate, ...c })));
      // Grouped view: one entry per order with its product lines and a subtotal (lines kept flat for API compatibility).
      const byOrder = rows.map((o) => {
        const ol = (o.commission || []).map((c) => ({ product: c.product, rate: c.rate, amount: c.amount }));
        // Additive business references for the console: vehicle, certificates issued and premium collected.
        return { orderId: o.id, date: o.createdDate, products: ol.map((l) => l.product), lines: ol, subtotal: ol.reduce((s, l) => s + l.amount, 0), vehicle: o.profileId || null, certificates: o.policies || [], premium: o.amount ?? null };
      });
      return { partnerId, from: from || null, to: to || null, orders: rows.length, totalCommission: lines.reduce((s, l) => s + l.amount, 0), lines, byOrder };
    },
  };
}

module.exports = { createPartnerService };
