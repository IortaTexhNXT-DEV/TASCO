'use strict';

/**
 * Role-based dashboards and KPIs: growth funnel (new business + retention),
 * channel economics, data quality, AI/voice-bot governance, compliance, and
 * platform adoption.
 */

function createInsightsService({ store, rules, audit, clock }) {
  const c = (n) => store.collection(n);

  async function sumOrders(where) {
    let total = 0; let n = 0;
    for (let off = 0; ; off += 2000) {
      const page = await c('orders').find({ where, limit: 2000, offset: off });
      for (const o of page) { total += o.amount || 0; n++; }
      if (page.length < 2000) break;
    }
    return { total, n };
  }

  return {
    async overview() {
      const today = clock.today();
      const [profilesN, tiers, journeys, actions, dqOpen, dqTypes, msgs, calls, handoffs, completed, policiesN, claimsN, costs] = await Promise.all([
        c('profiles').count(),
        c('leads').countBy('tier'),
        c('leads').countBy('journey'),
        c('leads').countBy('action'),
        c('dq_issues').count({ status: 'open' }),
        c('dq_issues').countBy('type', { status: 'open' }),
        c('messages').countBy('channel', { status: 'sent' }),
        c('voice_sessions').countBy('outcome'),
        c('handoffs').countBy('status'),
        sumOrders({ status: 'completed' }),
        c('policies').countBy('product', { status: 'active' }),
        c('claims').countBy('status'),
        rules.get('costs'),
      ]);
      const ordersByJourney = await c('orders').countBy('journey', { status: 'completed' });
      const ordersByChannel = await c('orders').countBy('channel', { status: 'completed' });
      const expiring30 = await c('leads').count({ days_to_expiry: { gte: 0, lte: 30 } });
      const lapsed = await c('leads').count({ days_to_expiry: { lt: 0, gte: -60 } });
      // Usable = profiles whose expiry evidence meets the MDM threshold (no open reliable_expiry issue).
      const usableExpiry = profilesN - await c('dq_issues').count({ type: 'reliable_expiry', status: 'open' });
      const totalCalls = Object.values(calls).reduce((s, v) => s + v, 0);
      const botCost = totalCalls * costs.voiceBotPerMinute * costs.avgBotCallMinutes;
      const humanEquivalent = totalCalls * costs.telesalesPerMinute * costs.avgTelesalesCallMinutes;
      const msgCost = Object.entries(msgs).reduce((s, [ch, n]) => s + (costs[ch] || 0) * n, 0);
      const blocked = await c('messages').countBy('status');
      // One vehicle can have several open issues: report distinct vehicles as the headline.
      const issuesByProfile = await c('dq_issues').countBy('profile_id', { status: 'open' });
      const profilesWithOpenIssues = Object.keys(issuesByProfile).filter((k) => k && k !== 'null' && k !== 'undefined').length;
      // Forward pipeline: policies (and TNDS premium) falling due per month for the next 12 months, by objective.
      const months = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + i);
        months.push({ month: d.toISOString().slice(0, 7), retention: 0, newBusiness: 0, retentionPremium: 0, newBusinessPremium: 0 });
      }
      const byMonth = new Map(months.map((m) => [m.month, m]));
      const todayMs = new Date(`${today}T00:00:00Z`).getTime();
      for (let off = 0; ; off += 2000) {
        const page = await c('leads').find({ where: { days_to_expiry: { gte: 0 } }, limit: 2000, offset: off, orderBy: ['id', 'asc'] });
        for (const l of page) {
          const m = byMonth.get(new Date(todayMs + l.daysToExpiry * 86400000).toISOString().slice(0, 7));
          if (!m || !l.journey) continue;
          if (l.objective === 'retention') { m.retention++; m.retentionPremium += l.premium || 0; } else { m.newBusiness++; m.newBusinessPremium += l.premium || 0; }
        }
        if (page.length < 2000) break;
      }
      const weekAhead = new Date(todayMs + 7 * 86400000).toISOString().slice(0, 10);
      const [dqByStatus, dueTouchpoints, dueWeek, scheduledTouchpoints] = await Promise.all([
        c('dq_issues').countBy('status'),
        c('touchpoints').countBy('journey', { status: 'scheduled', due_date: { lte: today } }),
        c('touchpoints').countBy('journey', { status: 'scheduled', due_date: { lte: weekAhead } }),
        c('touchpoints').count({ status: 'scheduled' }),
      ]);
      return {
        asOf: today,
        pipeline: months,
        journeys: { dueToday: dueTouchpoints, dueNext7Days: dueWeek, scheduled: scheduledTouchpoints },
        base: { profiles: profilesN, expiring30, lapsedUninsured: lapsed, profilesWithUsableData: usableExpiry },
        leads: { byTier: tiers, byJourney: journeys, byAction: actions },
        dataQuality: { openIssues: dqOpen, profilesWithOpenIssues, byType: dqTypes, byStatus: dqByStatus },
        engagement: { messagesByChannel: msgs, messageStatus: blocked, voiceOutcomes: calls, handoffs },
        sales: { orders: completed.n, gwp: completed.total, byJourney: ordersByJourney, byChannel: ordersByChannel, activePoliciesByProduct: policiesN },
        claims: claimsN,
        economics: {
          voiceBotCost: Math.round(botCost),
          equivalentTelesalesCost: Math.round(humanEquivalent),
          savingVsTelesales: Math.round(humanEquivalent - botCost),
          messagingCost: Math.round(msgCost),
          costPerOrder: completed.n ? Math.round((botCost + msgCost) / completed.n) : null,
        },
      };
    },

    /** Adoption KPIs derived from the audit trail (who uses the platform, how). */
    async adoption() {
      const entries = await audit.list({ limit: 5000 });
      const logins = entries.filter((e) => e.action === 'auth.login');
      const users = new Set(logins.map((e) => e.actor));
      const actionsByType = {};
      for (const e of entries) actionsByType[e.action] = (actionsByType[e.action] || 0) + 1;
      const handoffActions = entries.filter((e) => e.action === 'handoff.updated').length;
      return {
        activeUsers: users.size,
        logins: logins.length,
        failedLogins: entries.filter((e) => e.action === 'auth.login_failed').length,
        handoffActions,
        actionsByType,
        targets: { weeklyActiveTelesales: '≥ 90%', avgClicksToRenew: '≤ 3', handoffFirstContactWithin: '2 business hours', ruleChangeLeadTime: '≤ 1 day' },
      };
    },

    async governance() {
      const [calls, ruleSets, chain] = await Promise.all([
        c('voice_sessions').countBy('outcome'),
        c('rulesets').countBy('status'),
        audit.verify(),
      ]);
      const total = Object.values(calls).reduce((s, v) => s + v, 0);
      return {
        voiceBot: {
          calls: total,
          outcomes: calls,
          plateVerificationFailureRate: total ? +(((calls.plate_mismatch || 0) + (calls.unverified || 0)) / total).toFixed(3) : 0,
          optOutRate: total ? +((calls.opted_out || 0) / total).toFixed(3) : 0,
          disclosure: 'automated assistant disclosed at call start; no payment or OTP requested',
        },
        rules: ruleSets,
        auditChain: chain,
      };
    },
  };
}

module.exports = { createInsightsService };
