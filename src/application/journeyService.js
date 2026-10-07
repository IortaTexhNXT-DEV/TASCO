'use strict';

const crypto = require('crypto');
const { canContact, checkCopy } = require('../domain/contactPolicy');
const { template } = require('../rules/jsonLogic');
const { apply, truthy } = require('../rules/jsonLogic');
const { factsFor } = require('../domain/leads');
const { viDate } = require('../shared/util');

/**
 * Journey orchestration: executes due touchpoints (scheduled campaigns) and
 * reacts to ecosystem events (moments of truth). Every send is gated by
 * consent, contact windows, frequency caps and the copy guard.
 */

function createJourneyService({ store, rules, audit, events, clock, logger, metrics, gateways, voice, links }) {
  const touchpoints = store.collection('touchpoints');
  const messages = store.collection('messages');
  const profiles = store.collection('profiles');
  const leads = store.collection('leads');
  const policies = store.collection('policies');

  async function history(profileId) {
    const msgs = await messages.find({ where: { profile_id: profileId }, orderBy: ['sent_at', 'desc'], limit: 50 });
    return msgs.filter((m) => m.status === 'sent').map((m) => ({ at: m.sentAt, channel: m.channel, marketing: m.marketing }));
  }

  async function insured(profileId, today) {
    const active = await policies.find({ where: { profile_id: profileId, status: 'active', end_date: { gt: today } }, limit: 5 });
    return active.some((p) => p.product.startsWith('TNDS'));
  }

  /** Render + guard + send one message. Returns the message record. */
  async function sendMessage({ profile, lead, channel, templateKey, marketing, journey, step, touchpointId, now, extra = {} }) {
    const [content, guard] = await Promise.all([rules.get('content.messages'), rules.get('copy_guard')]);
    const tpl = content.templates[templateKey];
    if (!tpl) throw new Error(`unknown template ${templateKey}`);
    const topBenefit = lead?.benefits?.[0];
    const ctx = {
      plate: profile.plate,
      expiry: profile.policy.expiryDate ? viDate(profile.policy.expiryDate) : '',
      days: lead?.daysToExpiry ?? '',
      premium: lead?.premium ? `${lead.premium.toLocaleString('vi-VN')}đ` : '',
      benefit: topBenefit ? topBenefit.titleVi.toLowerCase() : 'cứu hộ 24/7',
      link: links.renew(profile.id, journey),
      ...extra,
    };
    const text = template(tpl.vi, ctx);
    const guardResult = checkCopy(guard, text);
    const msg = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      channel,
      templateKey,
      journey: journey || null,
      step: step || null,
      touchpointId: touchpointId || null,
      marketing,
      to: channel === 'app_push' ? `vetc-app:${profile.id}` : profile.phone,
      text,
      sentAt: now.toISOString(),
      status: 'pending',
    };
    if (!guardResult.ok) {
      msg.status = 'blocked';
      msg.blockReason = `copy guard: ${guardResult.violations.join(', ')}`;
    } else {
      try {
        const res = await gateways.notify[channel].exec(() => gateways.notify[channel].port.send({ to: msg.to, text, templateKey, idempotencyKey: msg.id }));
        msg.status = 'sent';
        msg.providerMessageId = res.providerMessageId;
      } catch (e) {
        msg.status = 'failed';
        msg.error = e.message;
      }
    }
    await messages.insert(msg);
    metrics?.inc('messages_total', { channel, status: msg.status, journey: journey || 'none' });
    return msg;
  }

  async function executeTouchpoint(tp, policy, now, today) {
    const profile = await profiles.get(tp.profileId);
    const lead = await leads.get(tp.profileId);
    if (!profile || !lead || profile.anonymised) return { status: 'cancelled', reason: 'profile not found' };
    if (await insured(profile.id, today)) return { status: 'cancelled', reason: 'already insured with TASCO' };
    if (lead.journey !== tp.journey) return { status: 'cancelled', reason: `journey changed to ${lead.journey}` };
    const hist = await history(profile.id);
    const blocked = [];
    for (const channel of tp.channels) {
      const chk = canContact(policy, profile, channel, { marketing: tp.marketing, now, history: hist });
      if (!chk.ok) { blocked.push(`${channel}: ${chk.reasons.join('; ')}`); continue; }
      if (channel === 'voice_bot') {
        const call = await voice.autoCall(profile.id, { actor: 'journey-engine', journey: tp.journey });
        await messages.insert({ id: crypto.randomUUID(), profileId: profile.id, channel, journey: tp.journey, step: tp.step, touchpointId: tp.id, marketing: tp.marketing, to: profile.phone, text: `[voice bot call: ${call.outcome}]`, sentAt: now.toISOString(), status: 'sent', sessionId: call.id });
        return { status: 'done', channel, outcome: call.outcome };
      }
      if (channel === 'telesales') {
        const h = await voice.createDirectHandoff(profile, lead, 'journey_escalation');
        await messages.insert({ id: crypto.randomUUID(), profileId: profile.id, channel, journey: tp.journey, step: tp.step, touchpointId: tp.id, marketing: tp.marketing, to: profile.phone, text: `[telesales task ${h.id}]`, sentAt: now.toISOString(), status: 'sent' });
        return { status: 'done', channel, handoffId: h.id };
      }
      const msg = await sendMessage({ profile, lead, channel, templateKey: tp.template, marketing: tp.marketing, journey: tp.journey, step: tp.step, touchpointId: tp.id, now });
      if (msg.status === 'sent') return { status: 'done', channel, messageId: msg.id };
      blocked.push(`${channel}: ${msg.status} ${msg.blockReason || msg.error || ''}`.trim());
    }
    return { status: 'skipped', reason: blocked.join(' | ') || 'no channel' };
  }

  const service = {
    sendMessage,

    /**
     * Execute all touchpoints due up to `date` (default: today). Contact-window
     * checks use `at` (default now) so the run can be scheduled within hours.
     */
    async runDue({ date, at, actor = 'scheduler', limit = 1000 } = {}) {
      const today = date || clock.today();
      const now = at ? new Date(at) : clock.now();
      const policy = await rules.get('contact_policy');
      const summary = { due: 0, done: 0, skipped: 0, cancelled: 0, deferred: 0, byChannel: {}, byJourney: {} };
      const seen = new Set();
      // Page through everything due (keyset by due date; processed rows leave the 'scheduled' set).
      for (;;) {
        const batch = (await touchpoints.find({ where: { status: 'scheduled', due_date: { lte: today } }, orderBy: ['due_date', 'asc'], limit: Math.min(limit, 1000) }))
          .filter((tp) => !seen.has(tp.id));
        if (!batch.length) break;
        for (const tp of batch) {
          seen.add(tp.id);
          summary.due++;
          const res = await executeTouchpoint(tp, policy, now, today);
          // Blocked only by the time-of-day window → keep it scheduled for the next in-window run.
          const onlyWindow = res.status === 'skipped' && res.reason && res.reason.split(' | ').every((r) => r.includes('outside allowed contact hours'));
          if (onlyWindow) {
            summary.deferred++;
            await touchpoints.upsert({ ...tp, lastAttemptAt: now.toISOString(), lastResult: res });
            continue;
          }
          await touchpoints.upsert({ ...tp, status: res.status, channel: res.channel || null, result: res, executedAt: now.toISOString() });
          summary[res.status]++;
          if (res.channel) summary.byChannel[res.channel] = (summary.byChannel[res.channel] || 0) + 1;
          summary.byJourney[tp.journey] = (summary.byJourney[tp.journey] || 0) + 1;
        }
        if (summary.due >= limit * 100) break; // hard safety stop
      }
      await audit.record({ actor, action: 'journeys.run', entityType: 'job', details: { date: today, ...summary } });
      logger?.info('journey run complete', { date: today, ...summary });
      return summary;
    },

    /** Moments of truth: ecosystem events (tag activated, inspection booked, wallet top-up…). */
    async handleEcosystemEvent({ type, profileId, at }, { actor = 'vetc-events' } = {}) {
      const trig = await rules.get('triggers');
      const matching = trig.triggers.filter((t) => t.event === type);
      const profile = await profiles.get(profileId);
      if (!profile || !matching.length) return { matched: 0, actions: [] };
      const lead = await leads.get(profileId);
      const facts = factsFor(profile, clock.today(), { premium: lead?.premium || 0 });
      const policy = await rules.get('contact_policy');
      const now = at ? new Date(at) : clock.now();
      const actions = [];
      for (const t of matching) {
        if (t.when && !truthy(apply(t.when, facts))) { actions.push({ trigger: t.id, result: 'condition not met' }); continue; }
        if (t.action === 'enrol_journey') {
          await events.publish('lead.recompute_requested', { profileIds: [profileId], reason: t.id }, { actor });
          actions.push({ trigger: t.id, result: `re-evaluate into ${t.journey}` });
          continue;
        }
        const hist = await history(profileId);
        let sent = null;
        for (const ch of t.channels) {
          const chk = canContact(policy, profile, ch, { marketing: t.marketing, now, history: hist });
          if (!chk.ok) continue;
          sent = await sendMessage({ profile, lead, channel: ch, templateKey: t.template, marketing: t.marketing, journey: `trigger:${t.id}`, step: t.id, now });
          if (sent.status === 'sent') break;
        }
        actions.push({ trigger: t.id, result: sent ? sent.status : 'no permitted channel' });
      }
      await audit.record({ actor, action: 'ecosystem.event_handled', entityType: 'profile', entityId: profileId, details: { type, actions } });
      return { matched: matching.length, actions };
    },

    async schedule({ profileId, status, limit = 100 }) {
      const where = {};
      if (profileId) where.profile_id = profileId;
      if (status) where.status = status;
      return touchpoints.find({ where, orderBy: ['due_date', 'asc'], limit });
    },
  };
  return service;
}

module.exports = { createJourneyService };
