'use strict';

const { errors } = require('../shared/errors');
const { applyDeclaredExpiry } = require('../domain/enrichment');
const { benefitsFor, factsFor } = require('../domain/leads');
const { signJwt } = require('../shared/crypto');

/**
 * Customer self-service for the VETC app / Zalo mini app: my vehicle, my cover,
 * one-tap renew, verify expiry (closes the data gap), consent centre, and data
 * subject rights (access / erasure) under Vietnam's PDP law.
 */

function createCustomerService({ store, rules, audit, events, clock, config }) {
  const profiles = store.collection('profiles');
  const leads = store.collection('leads');
  const policies = store.collection('policies');
  const messages = store.collection('messages');
  const sources = store.collection('source_records');
  const sessions = store.collection('voice_sessions');

  async function mine(profileId) {
    const p = await profiles.get(profileId);
    if (!p || p.anonymised) throw errors.notFound('Vehicle');
    return p;
  }

  return {
    /**
     * Token exchange: in production the VETC app's SSO token is verified with
     * VETC's identity provider; the sandbox issues a customer token for a
     * profile so journeys can be demonstrated end-to-end.
     */
    issueCustomerToken(profileId) {
      return signJwt({ sub: `customer:${profileId}`, roles: ['customer'], customerId: profileId, aud: 'customer' }, config.jwtSecret, 3600);
    },

    async home(profileId) {
      const p = await mine(profileId);
      const [lead, pols, benefitRules] = await Promise.all([leads.get(profileId), policies.find({ where: { profile_id: profileId }, orderBy: ['end_date', 'desc'], limit: 20 }), rules.get('benefits')]);
      return {
        vehicle: { plate: p.plate, category: p.vehicle.category, province: p.province },
        cover: {
          expiryDate: p.policy.expiryDate, confidence: p.policy.expiryConfidence, insurer: p.policy.insurer, verified: p.policy.verified,
          daysToExpiry: lead?.daysToExpiry ?? null,
          needsConfirmation: p.policy.expiryConfidence < 0.75,
        },
        premium: lead?.premium || null,
        policies: pols.map((x) => ({ certNo: x.certNo, product: x.product, startDate: x.startDate, endDate: x.endDate, status: x.status, certificateUrl: x.certificateUrl })),
        benefits: benefitsFor(benefitRules, factsFor(p, clock.today())),
        consent: p.consent,
      };
    },

    async declareExpiry(profileId, { expiryDate, insurer }, actor) {
      const p = await mine(profileId);
      const updated = applyDeclaredExpiry(p, { expiryDate, insurer, source: 'customer_declared', confidence: 0.8 });
      await profiles.update(updated);
      await audit.record({ actor: actor.id, action: 'customer.expiry_declared', entityType: 'profile', entityId: profileId, details: { insurer: insurer || null } });
      await events.publish('lead.recompute_requested', { profileIds: [profileId], reason: 'customer_declared' }, { actor: actor.id });
      return { ok: true, expiryDate: updated.policy.expiryDate };
    },

    async updateConsent(profileId, consent, actor) {
      const p = await mine(profileId);
      const overrides = { ...(p.consentOverrides || {}), ...consent };
      await profiles.update({ ...p, consent: { ...p.consent, ...consent }, consentOverrides: overrides });
      await audit.record({ actor: actor.id, action: 'consent.updated', entityType: 'profile', entityId: profileId, details: consent });
      await events.publish('lead.recompute_requested', { profileIds: [profileId], reason: 'consent' }, { actor: actor.id });
      return { consent: { ...p.consent, ...consent } };
    },

    /** Right of access: everything we hold about the data subject. */
    async exportData(profileId, actor) {
      const p = await mine(profileId);
      const [lead, pols, msgs, recs, calls] = await Promise.all([
        leads.get(profileId),
        policies.find({ where: { profile_id: profileId }, limit: 500 }),
        messages.find({ where: { profile_id: profileId }, limit: 1000 }),
        sources.find({ where: { plate_key: profileId }, limit: 100 }),
        sessions.find({ where: { profile_id: profileId }, limit: 100 }),
      ]);
      await audit.record({ actor: actor.id, action: 'dsar.access_exported', entityType: 'profile', entityId: profileId });
      const strip = ({ _hidden, ...r }) => r; // eslint-disable-line no-unused-vars
      return { generatedAt: clock.now().toISOString(), profile: p, lead, policies: pols, messages: msgs, sourceRecords: recs.map(strip), voiceSessions: calls };
    },

    /**
     * Right to erasure: anonymise personal data while keeping records that the
     * law requires us to retain (policies, financial records) — de-linked from identity.
     */
    async erase(profileId, actor) {
      const p = await mine(profileId);
      const active = await policies.find({ where: { profile_id: profileId, status: 'active' }, limit: 5 });
      if (active.length) throw errors.rule('Active policy in force — personal data must be retained until expiry (legal obligation)');
      await profiles.update({ ...p, name: null, phone: null, altPhones: [], anonymised: true, consent: { marketing: false, call: false, dnc: true }, anonymisedAt: clock.now().toISOString() });
      await leads.delete(profileId);
      for (const r of await sources.find({ where: { plate_key: profileId }, limit: 100 })) await sources.upsert({ ...r, phoneRaw: null, fullName: null, anonymised: true });
      for (const m of await messages.find({ where: { profile_id: profileId }, limit: 1000 })) await messages.upsert({ ...m, to: null, text: '[erased]' });
      for (const s of await sessions.find({ where: { profile_id: profileId }, limit: 100 })) await sessions.upsert({ ...s, transcript: [] });
      await audit.record({ actor: actor.id, action: 'dsar.erased', entityType: 'profile', entityId: profileId });
      return { erased: true };
    },
  };
}

module.exports = { createCustomerService };
