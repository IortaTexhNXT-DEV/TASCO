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
    async list({ type, status } = {}) {
      const where = {};
      if (type) where.type = type;
      if (status) where.status = status;
      return partners.find({ where, orderBy: ['id', 'asc'], limit: 500 });
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
    async issueApiKey(partnerId, actor, { scopes = ['quote', 'purchase', 'policies:read'] } = {}) {
      await this.get(partnerId);
      const secret = `tpk_${randomToken(24)}`;
      const rec = { id: `K-${crypto.randomUUID().slice(0, 8)}`, partnerId, keyHash: sha256(secret), prefix: secret.slice(0, 8), scopes, status: 'active', createdAt: clock.now().toISOString(), createdBy: actor.id };
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
      return { partnerId, from: from || null, to: to || null, orders: rows.length, totalCommission: lines.reduce((s, l) => s + l.amount, 0), lines };
    },
  };
}

module.exports = { createPartnerService };
