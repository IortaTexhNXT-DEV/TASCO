'use strict';

const crypto = require('crypto');
const { createDialogue, handoffSummary } = require('../domain/voicebot');
const { applyDeclaredExpiry } = require('../domain/enrichment');
const { errors } = require('../shared/errors');
const { fmtDate, addDays } = require('../shared/util');
const { canContact } = require('../domain/contactPolicy');

/**
 * Voice bot sessions (interactive console + automated campaign calls) and the
 * telesales handoff queue. Call outcomes feed back into data quality (expiry,
 * competitor, opt-out, wrong number) — every call improves the data.
 */

function createVoiceService({ store, rules, audit, events, clock, metrics, gateways }) {
  const sessions = store.collection('voice_sessions');
  const handoffs = store.collection('handoffs');
  const profiles = store.collection('profiles');
  const leads = store.collection('leads');
  const dq = store.collection('dq_issues');

  async function dialogue() {
    return createDialogue(await rules.get('content.voicebot'));
  }

  async function load(profileId) {
    const [profile, lead] = await Promise.all([profiles.get(profileId), leads.get(profileId)]);
    if (!profile || !lead) throw errors.notFound('Customer');
    return { profile, lead };
  }

  async function finalize(session, profile, lead, actor) {
    metrics?.inc('voice_calls_total', { outcome: session.outcome });
    const out = { handoffId: null };
    switch (session.outcome) {
      case 'hot_handoff': {
        const h = handoffSummary(session, profile, lead);
        await handoffs.upsert(h);
        out.handoffId = h.id;
        await events.publish('handoff.created', { handoffId: h.id, profileId: profile.id }, { actor });
        break;
      }
      case 'link_sent':
        await events.publish('renewal.link_requested', { profileId: profile.id, journey: lead.journey }, { actor });
        break;
      case 'opted_out': {
        const p = { ...profile, consent: { ...profile.consent, call: false, dnc: true }, consentOverrides: { ...(profile.consentOverrides || {}), call: false, dnc: true } };
        await profiles.update(p);
        await audit.record({ actor, action: 'consent.withdrawn', entityType: 'profile', entityId: profile.id, details: { channel: 'voice', via: session.id } });
        await events.publish('lead.recompute_requested', { profileIds: [profile.id], reason: 'opt_out' }, { actor });
        break;
      }
      case 'already_renewed': {
        // Renewed elsewhere: next expiry ≈ one year after the previous one.
        const nextExpiry = profile.policy.expiryDate ? fmtDate(addDays(profile.policy.expiryDate, 365)) : null;
        const { botRenewedElsewhereConfidence } = await rules.get('service_levels');
        const p = nextExpiry ? applyDeclaredExpiry(profile, { expiryDate: nextExpiry, insurer: 'OTHER', source: 'voice_bot', confidence: botRenewedElsewhereConfidence }) : { ...profile, policy: { ...profile.policy, insurer: 'OTHER' } };
        p.policy.competitorNote = session.signals.competitorInfo;
        await profiles.update({ ...p, version: profile.version });
        await events.publish('lead.recompute_requested', { profileIds: [profile.id], reason: 'already_renewed' }, { actor });
        break;
      }
      case 'wrong_person':
      case 'plate_mismatch':
        await dq.upsert({ id: `${profile.id}:${session.outcome}`, profileId: profile.id, type: session.outcome, status: 'open', detectedAt: clock.now().toISOString(), via: session.id });
        break;
      default:
        break;
    }
    await audit.record({ actor, action: 'voice.call_completed', entityType: 'profile', entityId: profile.id, details: { sessionId: session.id, outcome: session.outcome, verified: session.verified, turns: session.transcript.length } });
    return out;
  }

  const service = {
    async start(profileId, actor) {
      const { profile, lead } = await load(profileId);
      if (profile.consent.dnc) throw errors.rule('Customer is on the do-not-contact list');
      const d = await dialogue();
      const s = d.start(profile, lead);
      s.mode = 'console';
      s.startedBy = actor.id;
      await sessions.insert(s);
      return s;
    },

    async turn(sessionId, text, actor) {
      const s = await sessions.get(sessionId);
      if (!s) throw errors.notFound('Call session');
      if (s.state === 'ended') throw errors.rule('Call already ended');
      const d = await dialogue();
      d.turn(s, text);
      if (s.state === 'ended') {
        const { profile, lead } = await load(s.customerId);
        const out = await finalize(s, profile, lead, actor.id);
        s.handoffId = out.handoffId;
      }
      return sessions.update(s);
    },

    async get(sessionId) {
      const s = await sessions.get(sessionId);
      if (!s) throw errors.notFound('Call session');
      return s;
    },

    /** Consent, DNC, contact-hours and frequency caps for an outbound marketing call. */
    async canCall(profileId, now = clock.now()) {
      const profile = await profiles.get(profileId);
      if (!profile) return { ok: false, reasons: ['customer not found'] };
      const policy = await rules.get('contact_policy');
      const history = (await store.collection('messages').find({ where: { profile_id: profileId }, orderBy: ['sent_at', 'desc'], limit: 50 }))
        .filter((m) => m.status === 'sent').map((m) => ({ at: m.sentAt, channel: m.channel, marketing: m.marketing }));
      return canContact(policy, profile, 'voice_bot', { marketing: true, now, history });
    },

    /** Automated campaign call through the telephony port. */
    async autoCall(profileId, { actor = 'journey-engine' } = {}) {
      const { profile, lead } = await load(profileId);
      const d = await dialogue();
      const s = d.start(profile, lead);
      s.mode = 'campaign';
      await gateways.telephony.exec(() => gateways.telephony.port.runCall(d, s, profile.plate));
      await sessions.insert(s);
      const out = await finalize(s, profile, lead, actor);
      s.handoffId = out.handoffId;
      await sessions.upsert(s);
      return s;
    },

    async createDirectHandoff(profile, lead, reason) {
      const h = {
        id: `HO-${crypto.randomUUID().slice(0, 8)}`,
        customerId: profile.id,
        region: profile.province,
        plate: profile.plate,
        plateVerifiedByCustomer: false,
        name: profile.name,
        phoneMasked: profile.phone ? `${profile.phone.slice(0, 4)}***${profile.phone.slice(-3)}` : null,
        journey: lead.journey,
        expiryDate: profile.policy.expiryDate,
        daysToExpiry: lead.daysToExpiry,
        premium: lead.premium,
        score: lead.score,
        outcome: reason,
        talkingPoints: ['Customer has not responded to digital reminders.', ...lead.benefits.map((b) => `Benefit: ${b.title} — ${b.why}`)],
        status: 'open',
        assignedTo: null,
        createdAt: clock.now().toISOString(),
      };
      await handoffs.upsert(h);
      return h;
    },

    async listHandoffs({ status, assignedTo, region, limit = 50, offset = 0 }) {
      const where = {};
      if (status) where.status = status;
      if (assignedTo !== undefined) where.assigned_to = assignedTo;
      if (region) where.region = region;
      const [items, total] = await Promise.all([handoffs.find({ where, orderBy: ['created_at', 'desc'], limit, offset }), handoffs.count(where)]);
      return { items, total };
    },

    async getHandoff(id) {
      const h = await handoffs.get(id);
      if (!h) throw errors.notFound('Handoff');
      return h;
    },

    async updateHandoff(id, { status, note, assignTo, version }, actor) {
      const h = await service.getHandoff(id);
      const next = { ...h, version: version ?? h.version };
      if (assignTo !== undefined) next.assignedTo = assignTo;
      if (status) {
        const allowed = { open: ['claimed', 'won', 'lost', 'callback'], claimed: ['won', 'lost', 'callback', 'open'], callback: ['claimed', 'won', 'lost'], won: [], lost: [] };
        if (!allowed[h.status]?.includes(status)) throw errors.rule(`Cannot move handoff from ${h.status} to ${status}`);
        next.status = status;
        if (status === 'claimed' && !next.assignedTo) next.assignedTo = actor.id;
      }
      if (note) next.notes = [...(h.notes || []), { by: actor.id, at: clock.now().toISOString(), text: note }];
      const saved = await handoffs.update(next);
      await audit.record({ actor: actor.id, action: 'handoff.updated', entityType: 'handoff', entityId: id, details: { status: saved.status, assignedTo: saved.assignedTo } });
      return saved;
    },
  };
  return service;
}

module.exports = { createVoiceService };
