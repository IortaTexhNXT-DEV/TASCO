'use strict';

const { errors } = require('../../shared/errors');
const { normalizePlate, normalizePhone } = require('../../domain/identity');
const { evaluateLead } = require('../../domain/leads');
const { createRuleSimulation } = require('../../application/ruleSimulation');
const { AUDIT_CATEGORIES } = require('../../application/auditService');

/**
 * API route table (API-first). Each route declares:
 *   auth:  public | staff | customer | partner
 *   perm:  RBAC permission (staff/partner)
 *   body/query: allow-list validation schemas
 *   tag/summary: OpenAPI metadata
 */

const S = {
  id: { type: 'string', max: 80, pattern: /^[A-Za-z0-9_\-:@.]+$/ },
  date: { type: 'date' },
  limit: { type: 'integer', min: 1, max: 500 },
  offset: { type: 'integer', min: 0, max: 1000000 },
  text: (max = 500) => ({ type: 'string', max }),
};

const PRODUCT_LINES = {
  type: 'array', max: 5, required: true,
  items: {
    type: 'object',
    schema: {
      code: { type: 'string', max: 40, required: true, pattern: /^[A-Z][A-Z0-9_]+$/ },
      options: {
        type: 'object',
        schema: {
          category: { type: 'string', max: 40 }, termYears: { type: 'integer', min: 1, max: 3 }, sumInsured: { type: 'integer', min: 1, max: 100000000000 },
          deductible: { type: 'integer', min: 0, max: 10000000 }, seats: { type: 'integer', min: 1, max: 60 }, sumInsuredPerSeat: { type: 'integer', min: 1, max: 1000000000 },
          vehicleAge: { type: 'integer', min: 0, max: 60 },
        },
      },
    },
  },
};

/**
 * Hosts that embed the same customer journeys (one set of services, reused across TASCO and VETC channels):
 * the VETC app web view, a Zalo mini app, TASCO's own customer app and the TASCO website.
 */
const CUSTOMER_CHANNELS = ['vetc_app', 'zalo_mini_app', 'tasco_app', 'tasco_web'];
const CHANNELS = ['vetc_app', 'zalo', 'telesales', 'voice_bot', 'partner_api', 'zalo_mini_app', 'tasco_app', 'tasco_web'];

/**
 * Global search for the console top bar. Plates match by prefix on the normalised
 * key (e.g. "30E949" → 30E-949.35); phone numbers match exactly through the blind
 * index (names are encrypted at rest and are not searchable). Results respect
 * region ABAC and PII masking; nothing is returned for very short queries.
 */
async function searchCustomers(c, principal, q, limit) {
  const { access } = c.services;
  const profiles = c.store.collection('profiles');
  const raw = String(q || '').trim();
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let found = [];
  const phone = normalizePhone(raw);
  if (phone.valid) {
    const { blindIndex } = require('../../shared/crypto');
    found = await profiles.find({ where: { phone_bidx: blindIndex(c.config.blindIndexKey, phone.value) }, limit: limit * 3 });
  } else if (compact.length >= 3 && /^\d{2}[A-Z]/.test(compact)) {
    found = await profiles.find({ where: { id: { gte: compact, lt: `${compact}\uffff` } }, orderBy: ['id', 'asc'], limit: limit * 3 });
  }
  const items = [];
  for (const p of found) {
    if (p.anonymised) continue;
    try { await access.check(principal, 'read', { type: 'profile', region: p.province }); } catch { continue; }
    const m = access.maskProfile(principal, p);
    items.push({ id: p.id, plate: p.plate, name: m.name || null, phone: m.phone || null, region: p.province || null, expiryDate: p.policy?.expiryDate || null });
    if (items.length >= limit) break;
  }
  return { items, total: items.length };
}

/**
 * Work-queue display fields for leads: owner name (masked per permission), owner type, vehicle category and the
 * expiry date. Read-time join only — the lead record itself is unchanged.
 */
async function withOwner(c, principal, items) {
  const profiles = c.store.collection('profiles');
  return Promise.all(items.map(async (l) => {
    const p = await profiles.get(l.id);
    if (!p) return l;
    const m = c.services.access.maskProfile(principal, p);
    return { ...l, owner: m.name || null, ownerType: p.ownerType || null, category: p.vehicle?.category || null, expiryDate: p.policy?.expiryDate || null };
  }));
}

/** Staff display names for handoff assignees and note authors (read-time only). */
async function withHandoffNames(c, handoffs) {
  const { userNames } = require('../../application/auditService');
  const ids = handoffs.flatMap((x) => [x.assignedTo, ...(x.notes || []).map((n) => n.by)]);
  const names = await userNames(c.store, ids);
  const short = (id) => (names.has(id) ? names.get(id).replace(/\s*\([^)]*\)$/, '') : null);
  const { handoffFirstContactHours = 2 } = await c.services.rules.get('service_levels');
  return handoffs.map((x) => ({
    ...x,
    assignedToName: x.assignedTo ? short(x.assignedTo) : null,
    slaDueAt: x.createdAt ? new Date(new Date(x.createdAt).getTime() + handoffFirstContactHours * 3600000).toISOString() : null,
    notes: x.notes ? x.notes.map((n) => ({ ...n, byName: short(n.by) })) : x.notes,
  }));
}

async function customerDetail(c, principal, id) {
  const { access } = c.services;
  const s = (n) => c.store.collection(n);
  const profile = await s('profiles').get(id);
  if (!profile) throw errors.notFound('Customer');
  await access.check(principal, 'read', { type: 'profile', region: profile.province });
  const [lead, touchpoints, messages, policies, sessions, benefits, audit] = await Promise.all([
    s('leads').get(id),
    s('touchpoints').find({ where: { profile_id: id }, orderBy: ['due_date', 'asc'], limit: 50 }),
    s('messages').find({ where: { profile_id: id }, orderBy: ['sent_at', 'desc'], limit: 50 }),
    s('policies').find({ where: { profile_id: id }, orderBy: ['end_date', 'desc'], limit: 20 }),
    s('voice_sessions').find({ where: { profile_id: id }, orderBy: ['created_at', 'desc'], limit: 10 }),
    c.services.leads.benefitsForStaff(profile),
    c.services.audit.list({ entityId: id, limit: 50 }),
  ]);
  await c.services.audit.record({ actor: principal.id, action: 'profile.viewed', entityType: 'profile', entityId: id, details: { piiVisible: access.has(principal, 'profile:read_pii') } });
  const pii = access.has(principal, 'profile:read_pii');
  return {
    profile: access.maskProfile(principal, profile),
    lead,
    touchpoints,
    messages: messages.map((m) => ({ ...m, to: pii ? m.to : undefined })),
    policies,
    voiceSessions: sessions.map((v) => ({ id: v.id, outcome: v.outcome, startedAt: v.startedAt, mode: v.mode, verified: v.verified })),
    benefits,
    activity: audit,
  };
}

function buildRoutes() {
  return [
    // ---------- Public ----------
    { method: 'GET', path: '/api/meta', auth: 'public', tag: 'Platform', summary: 'Client bootstrap metadata',
      handler: async ({ c }) => {
        const meta = { name: 'TASCO Growth Platform', version: require('../../../package.json').version, demoMode: c.config.demoMode, today: c.clock.today(), store: c.store.kind, supportHotline: c.config.supportHotline || null, supportEmail: c.config.supportEmail || null, supportWebsite: c.config.supportWebsite || null, supportZaloUrl: c.config.supportZaloUrl || null, supportZaloName: c.config.supportZaloName || null, supportFacebookUrl: c.config.supportFacebookUrl || null, supportMessengerUrl: c.config.supportMessengerUrl || null };
        if (c.config.demoMode) {
          // Demo only: a few customers per journey so the customer app can be explored without a real link.
          meta.demoCustomers = await c.services.customers.demoCustomers();
        }
        return meta;
      } },
    { method: 'GET', path: '/api/public/certificates/:certNo', auth: 'public', tag: 'Public', summary: 'Verify an e-certificate (QR target, no PII)', rateCost: 2,
      handler: async ({ c, params }) => c.services.sales.verifyCertificate(params.certNo) },

    // ---------- Auth ----------
    { method: 'POST', path: '/api/auth/login', auth: 'public', tag: 'Auth', summary: 'Password login (step 1)', loginLimited: true,
      body: { username: { type: 'string', max: 100, required: true }, password: { type: 'string', max: 200, required: true } },
      handler: async ({ c, body, ip }) => c.services.identity.login(body, { ip }) },
    { method: 'POST', path: '/api/auth/mfa', auth: 'public', tag: 'Auth', summary: 'TOTP verification (step 2)', loginLimited: true,
      body: { mfaToken: { type: 'string', max: 2000, required: true }, code: { type: 'string', max: 10, required: true } },
      handler: async ({ c, body, ip }) => c.services.identity.verifyMfa(body, { ip }) },
    { method: 'POST', path: '/api/auth/logout', auth: 'staff', tag: 'Auth', summary: 'Revoke current token',
      handler: async ({ c, principal }) => c.services.identity.logout(principal.claims) },
    { method: 'GET', path: '/api/auth/me', auth: 'staff', tag: 'Auth', summary: 'Current user and permissions',
      handler: async ({ c, principal }) => {
        const u = await c.store.collection('users').get(principal.id);
        return { id: principal.id, username: principal.username, displayName: u?.displayName || principal.username, roles: principal.roles, region: principal.region, permissions: [...c.services.access.permissions(principal)] };
      } },
    { method: 'POST', path: '/api/auth/password', auth: 'staff', tag: 'Auth', summary: 'Change password',
      body: { currentPassword: { type: 'string', max: 200, required: true }, newPassword: { type: 'string', max: 200, required: true } },
      handler: async ({ c, principal, body }) => c.services.identity.changePassword(principal.id, body) },
    { method: 'GET', path: '/api/demo/totp/:username', auth: 'public', tag: 'Demo', summary: 'DEMO ONLY: current TOTP code for a seeded user', demoOnly: true,
      handler: async ({ c, params }) => {
        const r = await c.services.identity.demoCode(params.username);
        if (!r) throw errors.notFound('MFA user');
        return r;
      } },

    // ---------- Dashboards ----------
    { method: 'GET', path: '/api/dashboard/overview', auth: 'staff', perm: 'dashboard:read', tag: 'Insights', summary: 'Growth, channel, DQ and economics KPIs',
      handler: async ({ c }) => c.services.insights.overview() },
    { method: 'GET', path: '/api/dashboard/adoption', auth: 'staff', perm: 'dashboard:read', tag: 'Insights', summary: 'Platform adoption KPIs',
      handler: async ({ c }) => c.services.insights.adoption() },
    { method: 'GET', path: '/api/dashboard/governance', auth: 'staff', perm: 'audit:read', tag: 'Insights', summary: 'AI, rules and audit-chain governance',
      handler: async ({ c }) => c.services.insights.governance() },

    // ---------- Leads & customers ----------
    { method: 'GET', path: '/api/leads', auth: 'staff', perm: 'leads:read', tag: 'Leads', summary: 'Prioritised lead queue',
      query: {
        tier: { type: 'string', enum: ['hot', 'warm', 'nurture'] }, journey: { type: 'string', max: 40 }, action: { type: 'string', max: 40 }, region: { type: 'string', max: 60 },
        maxDays: { type: 'integer', min: -365, max: 3650 }, minScore: { type: 'integer', min: 0, max: 100 }, limit: S.limit, offset: S.offset, sort: { type: 'string', enum: ['score', 'expiry'] },
        q: { type: 'string', max: 20 },
      },
      handler: async ({ c, query, principal }) => {
        const q = { ...query };
        if (principal.region && principal.region !== 'ALL' && !c.services.access.has(principal, 'dashboard:read')) q.region = principal.region;
        const r = await c.services.leads.list(q);
        const regions = Object.keys(await c.store.collection('leads').countBy('region')).filter((x) => x && x !== 'null' && x !== 'undefined').sort((a, b) => a.localeCompare(b, 'vi'));
        return { ...r, items: await withOwner(c, principal, r.items), facets: { regions: q.region && !query.region ? [q.region] : regions } };
      } },
    { method: 'POST', path: '/api/leads/recompute', auth: 'staff', perm: 'leads:recompute', tag: 'Leads', summary: 'Re-score all leads with active rules',
      handler: async ({ c, principal }) => c.services.leads.recompute(null, { actor: principal.id }) },
    { method: 'GET', path: '/api/search/customers', auth: 'staff', perm: 'profile:read', tag: 'Customers', summary: 'Global customer search by licence plate (prefix) or phone (exact)',
      query: { q: { type: 'string', max: 40, required: true }, limit: { type: 'integer', min: 1, max: 20 } },
      handler: async ({ c, principal, query }) => searchCustomers(c, principal, query.q, query.limit || 8) },
    { method: 'GET', path: '/api/customers/:id', auth: 'staff', perm: 'profile:read', tag: 'Customers', summary: 'Customer 360 (PII masked by permission)',
      handler: async ({ c, principal, params }) => customerDetail(c, principal, params.id) },
    { method: 'GET', path: '/api/customers/:id/lineage', auth: 'staff', perm: 'profile:read', tag: 'Customers', summary: 'Field-level data lineage',
      handler: async ({ c, principal, params }) => {
        const p = await c.store.collection('profiles').get(params.id);
        if (!p) throw errors.notFound('Customer');
        await c.services.access.check(principal, 'read', { type: 'profile', region: p.province });
        return c.services.ops.lineage(params.id);
      } },
    { method: 'PATCH', path: '/api/customers/:id/expiry', auth: 'staff', perm: 'profile:update', tag: 'Customers', summary: 'Data steward correction of policy expiry',
      body: { expiryDate: { type: 'date', required: true }, insurer: { type: 'string', max: 60 }, evidence: { type: 'string', max: 300, required: true } },
      handler: async ({ c, principal, params, body }) => {
        const { applyDeclaredExpiry } = require('../../domain/enrichment');  
        const col = c.store.collection('profiles');
        const p = await col.get(params.id);
        if (!p) throw errors.notFound('Customer');
        await c.services.access.check(principal, 'update', { type: 'profile', region: p.province });
        const { stewardCorrectionConfidence } = await c.services.rules.get('service_levels');
        await col.update(applyDeclaredExpiry(p, { expiryDate: body.expiryDate, insurer: body.insurer, source: 'data_steward', confidence: stewardCorrectionConfidence }));
        await c.services.audit.record({ actor: principal.id, action: 'profile.expiry_corrected', entityType: 'profile', entityId: params.id, details: { evidence: body.evidence } });
        await c.services.leads.recompute([params.id], { actor: principal.id });
        return { ok: true };
      } },

    // ---------- Journeys & events ----------
    { method: 'GET', path: '/api/touchpoints', auth: 'staff', perm: 'leads:read', tag: 'Journeys', summary: 'Scheduled / executed touchpoints',
      query: { profileId: S.id, status: { type: 'string', enum: ['scheduled', 'done', 'skipped', 'cancelled'] }, limit: S.limit },
      handler: async ({ c, query }) => c.services.journeys.schedule(query) },
    { method: 'POST', path: '/api/journeys/run', auth: 'staff', perm: 'journeys:run', tag: 'Journeys', summary: 'Execute due touchpoints',
      body: { date: S.date, at: { type: 'string', max: 40 } },
      handler: async ({ c, principal, body }) => {
        // Simulated dates/times are a demo/UAT feature; production always uses the real clock.
        const opts = c.config.demoMode ? body : {};
        const startedAt = c.clock.now().toISOString();
        const r = await c.services.journeys.runDue({ ...opts, actor: principal.id });
        await c.events.drain();
        await c.store.collection('job_runs').insert({ id: `J-${require('crypto').randomUUID().slice(0, 8)}`, kind: 'journey_run', actor: principal.id, startedAt, finishedAt: c.clock.now().toISOString(), status: 'succeeded', result: { channel: 'journeys', date: opts.date || c.clock.today(), ...r } });
        return r;
      } },
    { method: 'POST', path: '/api/ecosystem/events', auth: 'staff', perm: 'journeys:run', tag: 'Journeys', summary: 'Ingest a VETC ecosystem event (moment of truth)',
      body: { type: { type: 'string', enum: ['vetc.tag_activated', 'vetc.inspection_booked', 'vetc.wallet_topped_up', 'vetc.long_trip_started'], required: true }, profileId: { ...S.id, required: true }, at: { type: 'string', max: 40 } },
      handler: async ({ c, principal, body }) => { const r = await c.services.journeys.handleEcosystemEvent(body, { actor: principal.id }); await c.events.drain(); return r; } },

    // ---------- Voice bot & handoffs ----------
    { method: 'POST', path: '/api/voice/sessions', auth: 'staff', perm: 'voice:operate', tag: 'Voice bot', summary: 'Start a voice bot session (console)',
      body: { profileId: { ...S.id, required: true } },
      handler: async ({ c, principal, body }) => {
        const p = await c.store.collection('profiles').get(body.profileId);
        if (p) await c.services.access.check(principal, 'read', { type: 'profile', region: p.province });
        return c.services.voice.start(body.profileId, principal);
      } },
    { method: 'GET', path: '/api/voice/sessions', auth: 'staff', perm: 'voice:operate', tag: 'Voice bot', summary: 'Recent calls (newest first) with outcome, verification and handoff',
      query: { outcome: { type: 'string', max: 40 }, profileId: S.id, limit: S.limit, offset: S.offset },
      handler: async ({ c, principal, query }) => {
        const where = {};
        if (query.outcome) where.outcome = query.outcome;
        if (query.profileId) where.profile_id = query.profileId;
        const col = c.store.collection('voice_sessions');
        const limit = query.limit || 50;
        const [rows, total] = await Promise.all([col.find({ where, orderBy: ['created_at', 'desc'], limit: Math.min(500, limit + (query.offset || 0) + 200) }), col.count(where)]);
        const items = [];
        let skipped = 0;
        for (const s of rows) {
          try { await c.services.access.check(principal, 'read', { type: 'profile', region: s.region }); } catch { continue; }
          if (skipped < (query.offset || 0)) { skipped++; continue; }
          items.push({ id: s.id, customerId: s.customerId, plateMasked: s.ctx?.plateMasked || null, region: s.region, mode: s.mode || 'console', state: s.state === 'ended' ? 'ended' : 'in_progress',
            outcome: s.outcome, verified: !!s.verified, turns: (s.transcript || []).length, startedAt: s.startedAt, endedAt: s.endedAt || null, handoffId: s.handoffId || null });
          if (items.length >= limit) break;
        }
        return { items, total: principal.region && principal.region !== 'ALL' ? items.length : total };
      } },
    { method: 'GET', path: '/api/voice/sessions/:id', auth: 'staff', perm: 'voice:operate', tag: 'Voice bot', summary: 'Get session transcript',
      handler: async ({ c, principal, params }) => {
        const s = await c.services.voice.get(params.id);
        await c.services.access.check(principal, 'read', { type: 'profile', region: s.region });
        return s;
      } },
    { method: 'POST', path: '/api/voice/sessions/:id/turns', auth: 'staff', perm: 'voice:operate', tag: 'Voice bot', summary: 'Send a customer utterance (ASR text)',
      body: { text: { type: 'string', max: 500, required: true } },
      handler: async ({ c, principal, params, body }) => { const s = await c.services.voice.turn(params.id, body.text, principal); await c.events.drain(); return s; } },
    { method: 'POST', path: '/api/voice/campaign', auth: 'staff', perm: 'journeys:run', tag: 'Voice bot', summary: 'Run an automated call campaign over top leads',
      body: {
        limit: { type: 'integer', min: 1, max: 200, default: 20 }, tier: { type: 'string', enum: ['hot', 'warm'], default: 'hot' }, at: { type: 'string', max: 40 },
        name: { type: 'string', max: 80 }, journey: { type: 'string', max: 40 }, region: { type: 'string', max: 60 }, dryRun: { type: 'boolean' },
      },
      handler: async ({ c, principal, body }) => {
        const now = body.at && c.config.demoMode ? new Date(body.at) : c.clock.now();
        const audience = { tier: body.tier, journey: body.journey || null, region: body.region || null };
        const leads = await c.services.leads.list({ tier: body.tier, journey: body.journey || undefined, region: body.region || undefined, limit: 500 });
        if (body.dryRun) {
          // Preview of the contact-policy effect: who would be called vs. held back (and why), without calling anyone.
          const blocked = {};
          let eligible = 0; let companies = 0;
          for (const l of leads.items) {
            const p = await c.store.collection('profiles').get(l.id);
            if (!p) continue;
            if (p.ownerType === 'company') { companies++; continue; }
            const chk = await c.services.voice.canCall(l.id, now);
            if (chk.ok) eligible++; else for (const r of chk.reasons) blocked[r] = (blocked[r] || 0) + 1;
          }
          return { audience: leads.total, eligible, willCall: Math.min(eligible, body.limit), routedToFleet: companies, blocked };
        }
        const run = async () => {
        const outcomes = {};
        const skipped = {};
        let called = 0;
        for (const l of leads.items) {
          if (called >= body.limit) break;
          const p = await c.store.collection('profiles').get(l.id);
          if (!p || p.ownerType === 'company') continue;
          const chk = await c.services.voice.canCall(l.id, now);
          if (!chk.ok) { for (const r of chk.reasons) skipped[r] = (skipped[r] || 0) + 1; continue; }
          const s = await c.services.voice.autoCall(l.id, { actor: principal.id });
          await c.store.collection('messages').insert({ id: require('crypto').randomUUID(), profileId: l.id, channel: 'voice_bot', journey: l.journey, step: 'campaign', marketing: true, to: p.phone, text: `[voice bot call: ${s.outcome}]`, sentAt: now.toISOString(), status: 'sent', sessionId: s.id });
          outcomes[s.outcome] = (outcomes[s.outcome] || 0) + 1;
          called++;
        }
        await c.events.drain();
        return { called, outcomes, skipped };
        };
        // Recorded as a campaign run (job history + audit) so results can be reviewed later.
        const r = await c.services.ops.recordRun('voice_campaign', principal.id, async () => ({ name: body.name || null, channel: 'voice_bot', audience, limit: body.limit, at: now.toISOString(), ...(await run()) }));
        return { called: r.called, outcomes: r.outcomes, skipped: r.skipped, campaignId: r.runId };
      } },
    { method: 'GET', path: '/api/campaigns', auth: 'staff', perm: 'journeys:run', tag: 'Voice bot', summary: 'Campaign runs (voice campaigns and journey runs) with results',
      query: { limit: S.limit },
      handler: async ({ c, query }) => {
        const runs = await c.store.collection('job_runs').find({ where: { kind: { in: ['voice_campaign', 'journey_run'] } }, orderBy: ['started_at', 'desc'], limit: query.limit || 50 });
        const { userNames } = require('../../application/auditService');
        const names = await userNames(c.store, runs.map((r) => r.actor));
        return { items: runs.map((r) => ({ id: r.id, kind: r.kind, status: r.status, startedAt: r.startedAt, finishedAt: r.finishedAt || null, by: names.get(r.actor)?.replace(/\s*\([^)]*\)$/, '') || null, result: r.result || null })) };
      } },
    { method: 'GET', path: '/api/handoffs', auth: 'staff', perm: 'handoff:read', tag: 'Telesales', summary: 'Telesales work queue',
      query: { status: { type: 'string', enum: ['open', 'claimed', 'callback', 'won', 'lost'] }, mine: { type: 'boolean' }, limit: S.limit, offset: S.offset },
      handler: async ({ c, principal, query }) => {
        const q = { status: query.status, limit: query.limit, offset: query.offset };
        if (query.mine) q.assignedTo = principal.id;
        if (principal.region && principal.region !== 'ALL') q.region = principal.region;
        const r = await c.services.voice.listHandoffs(q);
        const visible = [];
        for (const h of r.items) {
          try { await c.services.access.check(principal, 'read', { type: 'handoff', assignedTo: h.assignedTo, region: h.region }); visible.push(h); } catch { /* filtered by ABAC */ }
        }
        return { items: await withHandoffNames(c, visible), total: r.total };
      } },
    { method: 'GET', path: '/api/handoffs/assignees', auth: 'staff', perm: 'handoff:assign', tag: 'Telesales', summary: 'Telesales staff a supervisor can assign handoffs to',
      handler: async ({ c, principal }) => {
        const users = await c.store.collection('users').find({ limit: 1000 });
        const items = users
          .filter((u) => u.status !== 'disabled' && (u.roles || []).some((r) => r === 'telesales_agent' || r === 'telesales_supervisor'))
          .filter((u) => !principal.region || principal.region === 'ALL' || !u.region || u.region === 'ALL' || u.region === principal.region)
          .map((u) => ({ id: u.id, name: u.displayName || u.username, region: u.region || 'ALL', roles: u.roles }));
        return { items };
      } },
    { method: 'GET', path: '/api/handoffs/:id', auth: 'staff', perm: 'handoff:read', tag: 'Telesales', summary: 'Handoff detail',
      handler: async ({ c, principal, params }) => {
        const h = await c.services.voice.getHandoff(params.id);
        await c.services.access.check(principal, 'read', { type: 'handoff', assignedTo: h.assignedTo, region: h.region });
        return (await withHandoffNames(c, [h]))[0];
      } },
    { method: 'PATCH', path: '/api/handoffs/:id', auth: 'staff', perm: 'handoff:work', tag: 'Telesales', summary: 'Claim / update / assign a handoff',
      body: { status: { type: 'string', enum: ['open', 'claimed', 'callback', 'won', 'lost'] }, note: S.text(1000), assignTo: { type: 'string', max: 40 }, version: { type: 'integer', min: 1 } },
      handler: async ({ c, principal, params, body }) => {
        const h = await c.services.voice.getHandoff(params.id);
        await c.services.access.check(principal, 'update', { type: 'handoff', assignedTo: h.assignedTo, region: h.region });
        if (body.assignTo !== undefined) c.services.access.require(principal, 'handoff:assign');
        return (await withHandoffNames(c, [await c.services.voice.updateHandoff(params.id, body, principal)]))[0];
      } },

    // ---------- Products, quotes, orders, policies ----------
    { method: 'GET', path: '/api/products', auth: 'staff', perm: 'quote:create', tag: 'Sales', summary: 'Active product catalogue and bundles',
      handler: async ({ c }) => c.services.sales.catalogue() },
    { method: 'POST', path: '/api/quotes', auth: 'staff', perm: 'quote:create', tag: 'Sales', summary: 'Quote one or more products for a customer',
      body: { profileId: { ...S.id, required: true }, products: PRODUCT_LINES, channel: { type: 'string', enum: CHANNELS, default: 'telesales' }, termYears: { type: 'integer', min: 1, max: 3 }, journey: { type: 'string', max: 40 } },
      handler: async ({ c, principal, body }) => {
        const p = await c.store.collection('profiles').get(body.profileId);
        if (p) await c.services.access.check(principal, 'read', { type: 'profile', region: p.province });
        return c.services.sales.quote(body, principal);
      } },
    { method: 'POST', path: '/api/quotes/:id/inspection', auth: 'staff', perm: 'quote:create', tag: 'Sales', summary: 'Record the vehicle inspection required for physical-damage cover',
      body: { passed: { type: 'boolean', required: true }, evidence: { type: 'string', max: 500, required: true } },
      handler: async ({ c, principal, params, body }) => c.services.sales.recordInspection(params.id, body, principal) },
    { method: 'POST', path: '/api/quotes/:id/rerate', auth: 'staff', perm: 'quote:create', tag: 'Sales', summary: 'Re-rate an indicative quote with TASCO core (required before payment)',
      handler: async ({ c, principal, params }) => {
        const pending = await c.services.sales.getQuote(params.id);
        const profile = await c.store.collection('profiles').get(pending.profileId);
        if (profile) await c.services.access.check(principal, 'read', { type: 'profile', region: profile.province });
        return c.services.sales.rerate(params.id, principal);
      } },
    { method: 'POST', path: '/api/quotes/:id/send', auth: 'staff', perm: 'quote:create', tag: 'Sales', summary: 'Send a quote to the customer\'s VETC app / Zalo to confirm and pay (staff never take payment)',
      handler: async ({ c, principal, params }) => {
        const pending = await c.services.sales.getQuote(params.id);
        const profile = await c.store.collection('profiles').get(pending.profileId);
        await c.services.access.check(principal, 'read', { type: 'profile', region: profile.province });
        const q = await c.services.sales.markSent(params.id, principal);
        const lead = await c.store.collection('leads').get(q.profileId);
        const sent = [];
        for (const ch of ['app_push', 'zalo_zns', 'sms']) {
          if (!profile.channels[ch]) continue;
          // Customer asked for it during the conversation → service message, not marketing.
          const m = await c.services.journeys.sendMessage({ profile, lead, channel: ch, templateKey: 'quote_ready', marketing: false, journey: q.journey, step: 'quote_sent', now: c.clock.now(), extra: { premium: `${q.total.toLocaleString('vi-VN')}đ`, link: c.links.renew(profile.id, q.journey) } });
          sent.push({ channel: ch, status: m.status });
          if (m.status === 'sent') break;
        }
        return { quoteId: q.id, sent };
      } },
    { method: 'GET', path: '/api/policies', auth: 'staff', perm: 'policy:read', tag: 'Sales', summary: 'List issued policies',
      query: { profileId: S.id, product: { type: 'string', max: 40 }, limit: S.limit, offset: S.offset },
      handler: async ({ c, query }) => c.services.sales.listPolicies(query) },

    // ---------- Rules (maker-checker) ----------
    { method: 'GET', path: '/api/rules', auth: 'staff', perm: 'rules:read', tag: 'Rules', summary: 'List rule sets (all versions)',
      query: { kind: { type: 'string', max: 60 }, status: { type: 'string', enum: ['draft', 'pending_approval', 'active', 'retired', 'rejected'] } },
      handler: async ({ c, query }) => c.services.rules.list(query) },
    { method: 'GET', path: '/api/rules/context', auth: 'staff', perm: 'rules:read', tag: 'Rules', summary: 'Rules studio context: rating source, restricted rule kinds, simulatable kinds',
      handler: async ({ c }) => createRuleSimulation(c).context() },
    { method: 'GET', path: '/api/rules/sample-customers', auth: 'staff', perm: 'rules:read', tag: 'Rules', summary: 'Customers to simulate against (plate prefix or a spread across tiers; no personal data)',
      query: { q: { type: 'string', max: 40 }, limit: { type: 'integer', min: 1, max: 20 } },
      handler: async ({ c, query }) => createRuleSimulation(c).sampleCustomers(query) },
    { method: 'POST', path: '/api/rules/simulate-sample', auth: 'staff', perm: 'rules:read', tag: 'Rules', summary: 'Aggregate dry-run of a candidate payload over a sample of customers (tier, action and journey movements)',
      body: { kind: { type: 'string', enum: ['scoring', 'nba', 'journeys', 'benefits'], required: true }, payload: { type: 'object', required: true }, size: { type: 'integer', min: 3, max: 200 } },
      handler: async ({ c, body }) => createRuleSimulation(c).simulateSample(body) },
    { method: 'GET', path: '/api/rules/:id', auth: 'staff', perm: 'rules:read', tag: 'Rules', summary: 'Rule set detail incl. payload',
      handler: async ({ c, params }) => c.services.rules.byId(params.id) },
    { method: 'PATCH', path: '/api/rules/:id', auth: 'staff', perm: 'rules:author', tag: 'Rules', summary: 'Edit one\'s own draft in place (payload and/or description)',
      body: { payload: { type: 'object' }, description: S.text(500) },
      handler: async ({ c, principal, params, body }) => c.services.rules.updateDraft(params.id, body, principal) },
    { method: 'POST', path: '/api/rules', auth: 'staff', perm: 'rules:author', tag: 'Rules', summary: 'Create a draft version',
      body: { kind: { type: 'string', max: 60, required: true }, payload: { type: 'object', required: true }, description: S.text(500) },
      handler: async ({ c, principal, body }) => c.services.rules.createDraft(body, principal) },
    { method: 'POST', path: '/api/rules/validate', auth: 'staff', perm: 'rules:author', tag: 'Rules', summary: 'Validate a payload without saving',
      body: { kind: { type: 'string', max: 60, required: true }, payload: { type: 'object', required: true } },
      handler: async ({ c, body }) => ({ errors: await c.services.rules.validate(body.kind, body.payload) }) },
    { method: 'POST', path: '/api/rules/simulate', auth: 'staff', perm: 'rules:read', tag: 'Rules', summary: 'Dry-run a scoring/NBA/journey/benefit payload against a customer',
      body: { profileId: { ...S.id, required: true }, kind: { type: 'string', enum: ['scoring', 'nba', 'journeys', 'benefits'], required: true }, payload: { type: 'object', required: true } },
      handler: async ({ c, body }) => {
        const errs = await c.services.rules.validate(body.kind, body.payload);
        if (errs.length) throw errors.validation('Rule set is invalid', errs);
        const p = await c.store.collection('profiles').get(body.profileId);
        if (!p) throw errors.notFound('Customer');
        const r = await c.services.leads.leadRules();
        const today = c.clock.today();
        const premium = c.services.leads.tndsPremium(r, p, today);
        const current = evaluateLead(r, p, today, premium);
        const candidate = evaluateLead({ ...r, [body.kind]: body.payload }, p, today, premium);
        return { current, candidate };
      } },
    ...['submit', 'withdraw', 'approve', 'reject', 'rollback'].map((action) => ({
      method: 'POST', path: `/api/rules/:id/${action}`, auth: 'staff', perm: ['approve', 'reject'].includes(action) ? 'rules:approve' : 'rules:author', tag: 'Rules',
      summary: `${action[0].toUpperCase()}${action.slice(1)} a rule set version`, body: { comment: S.text(500) },
      handler: async ({ c, principal, params, body }) => c.services.rules[action](params.id, principal, body),
    })),

    // ---------- Partners ----------
    { method: 'GET', path: '/api/partners', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'List partners',
      handler: async ({ c }) => c.services.partners.list() },
    { method: 'POST', path: '/api/partners', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'Onboard a partner',
      body: { name: { type: 'string', max: 120, required: true }, type: { type: 'string', enum: ['bank', 'showroom', 'agent', 'fleet', 'inspection_center'], required: true }, region: { type: 'string', max: 60 } },
      handler: async ({ c, principal, body }) => c.services.partners.create(body, principal) },
    { method: 'PATCH', path: '/api/partners/:id', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'Activate / suspend a partner',
      body: { status: { type: 'string', enum: ['active', 'suspended'], required: true } },
      handler: async ({ c, principal, params, body }) => c.services.partners.setStatus(params.id, body.status, principal) },
    { method: 'POST', path: '/api/partners/:id/keys', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'Issue an API key (shown once)',
      body: { scopes: { type: 'array', max: 3, items: { type: 'string', enum: ['quote', 'purchase', 'policies:read'] } }, expiresInDays: { type: 'integer', min: 1, max: 730 } },
      handler: async ({ c, principal, params, body }) => c.services.partners.issueApiKey(params.id, principal, body || {}) },
    { method: 'GET', path: '/api/partners/:id/keys', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'API keys of a partner (prefix, scopes, status — never the secret)',
      handler: async ({ c, params }) => c.services.partners.listKeys(params.id) },
    { method: 'DELETE', path: '/api/partners/keys/:keyId', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'Revoke an API key',
      handler: async ({ c, principal, params }) => c.services.partners.revokeApiKey(params.keyId, principal) },
    { method: 'GET', path: '/api/partners/:id/statement', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'Commission statement',
      query: { from: S.date, to: S.date },
      handler: async ({ c, params, query }) => c.services.partners.statement(params.id, query) },

    // ---------- Partner API (X-Api-Key) ----------
    { method: 'POST', path: '/api/partner/v1/quotes', auth: 'partner', perm: 'partner:transact', scope: 'quote', tag: 'Partner API', summary: 'Quote by plate; unknown vehicles are onboarded (new business)',
      body: {
        plate: { type: 'string', max: 20, required: true }, products: PRODUCT_LINES, holderName: { type: 'string', max: 120 }, phone: { type: 'string', max: 20 },
        seats: { type: 'integer', min: 1, max: 60 }, usage: { type: 'string', enum: ['personal', 'commercial'] }, ownerType: { type: 'string', enum: ['individual', 'company'] }, currentExpiry: S.date,
      },
      handler: async ({ c, principal, body }) => {
        const plate = normalizePlate(body.plate);
        if (!plate.valid) throw errors.validation('Invalid licence plate');
        if (body.phone && !normalizePhone(body.phone).valid) throw errors.validation('Invalid phone');
        if (!(await c.store.collection('profiles').get(plate.key)) || body.currentExpiry || body.seats) {
          await c.services.ingestion.ingest([{
            recordId: `PR-${principal.partnerId}-${plate.key}-${Date.now()}`, source: `partner_${principal.partnerType}`, partnerId: principal.partnerId,
            plateRaw: body.plate, phoneRaw: body.phone || '', fullName: body.holderName || '', seatsDeclared: body.seats ?? null, usageDeclared: body.usage ?? null,
            // Partner-declared expiry is unverified evidence: weighted by source trust, never overrides verified data.
            ownerType: body.ownerType || 'individual', policy: body.currentExpiry ? { insurer: null, expiryDate: body.currentExpiry, verified: false } : null,
          }], { actor: principal.id, sourceName: principal.partnerId });
          await c.events.drain();
        }
        return c.services.sales.quote({ profileId: plate.key, products: body.products, channel: 'partner_api', partnerId: principal.partnerId }, principal);
      } },
    { method: 'POST', path: '/api/partner/v1/orders', auth: 'partner', perm: 'partner:transact', scope: 'purchase', tag: 'Partner API', summary: 'Bind a partner quote (Idempotency-Key)', idempotent: true,
      body: { quoteId: { type: 'string', max: 80, required: true }, holderName: { type: 'string', max: 120 } },
      handler: async ({ c, principal, body, idempotencyKey }) => {
        const q = await c.services.sales.getQuote(body.quoteId);
        if (q.partnerId !== principal.partnerId) throw errors.notFound('Quote');
        const r = await c.services.sales.purchase({ ...body, idempotencyKey }, principal);
        await c.events.drain();
        return r;
      } },
    { method: 'GET', path: '/api/partner/v1/policies', auth: 'partner', perm: 'partner:transact', scope: 'policies:read', tag: 'Partner API', summary: 'Policies sold by this partner',
      query: { limit: S.limit, offset: S.offset },
      handler: async ({ c, principal, query }) => c.services.sales.listPolicies({ ...query, partnerId: principal.partnerId }) },
    { method: 'GET', path: '/api/partner/v1/statement', auth: 'partner', perm: 'partner:transact', scope: 'policies:read', tag: 'Partner API', summary: 'Own commission statement',
      query: { from: S.date, to: S.date },
      handler: async ({ c, principal, query }) => c.services.partners.statement(principal.partnerId, query) },

    // ---------- Claims ----------
    { method: 'GET', path: '/api/claims', auth: 'staff', perm: 'claims:read', tag: 'Claims', summary: 'FNOL queue',
      query: { status: { type: 'string', max: 30 }, limit: S.limit, offset: S.offset },
      handler: async ({ c, query }) => c.services.claims.list(query) },
    { method: 'GET', path: '/api/claims/:id', auth: 'staff', perm: 'claims:read', tag: 'Claims', summary: 'Claim detail',
      handler: async ({ c, params }) => c.services.claims.get(params.id) },
    { method: 'PATCH', path: '/api/claims/:id', auth: 'staff', perm: 'claims:update', tag: 'Claims', summary: 'Advance claim status',
      body: {
        status: { type: 'string', max: 30, required: true }, note: S.text(1000),
        assessor: S.text(120), approvedAmount: { type: 'integer', min: 1, max: 100000000000 }, reason: S.text(500), paymentRef: S.text(80),
      },
      handler: async ({ c, principal, params, body }) => c.services.claims.transition(params.id, body.status, principal, body.note, body) },
    { method: 'POST', path: '/api/claims/:id/notes', auth: 'staff', perm: 'claims:update', tag: 'Claims', summary: 'Add an internal handler note',
      body: { text: { type: 'string', max: 1000, required: true } },
      handler: async ({ c, principal, params, body }) => c.services.claims.addNote(params.id, body.text, principal) },

    // ---------- Data quality, ingestion, lineage ----------
    { method: 'GET', path: '/api/dq/issues', auth: 'staff', perm: 'dq:read', tag: 'Data', summary: 'Data-quality issues',
      query: { type: { type: 'string', max: 40 }, status: { type: 'string', enum: ['open', 'resolved'] }, profileId: S.id, limit: S.limit, offset: S.offset },
      handler: async ({ c, query }) => c.services.ops.dqIssues(query) },
    { method: 'GET', path: '/api/dq/issues/:id', auth: 'staff', perm: 'dq:read', tag: 'Data', summary: 'One DQ issue with source, lineage and conflict context',
      handler: async ({ c, params }) => c.services.ops.dqIssue(params.id) },
    { method: 'GET', path: '/api/dq/assignees', auth: 'staff', perm: 'dq:read', tag: 'Data', summary: 'Staff who can work the data-quality queue',
      handler: async ({ c }) => c.services.ops.dqAssignees(c.rbac) },
    { method: 'POST', path: '/api/dq/issues/bulk', auth: 'staff', perm: 'dq:resolve', tag: 'Data', summary: 'Bulk assign or dismiss DQ issues',
      body: { ids: { type: 'array', max: 200, required: true, items: { type: 'string', max: 200 } }, action: { type: 'string', enum: ['assign', 'dismiss'], required: true }, assignee: { type: 'string', max: 80 }, reason: S.text(500) },
      handler: async ({ c, principal, body }) => c.services.ops.bulkDq(body, principal, c.rbac) },
    { method: 'POST', path: '/api/dq/issues/:id/resolve', auth: 'staff', perm: 'dq:resolve', tag: 'Data', summary: 'Resolve a DQ issue',
      body: { resolution: { type: 'string', max: 500, required: true }, outcome: { type: 'string', enum: ['confirmed', 'corrected', 'merged', 'dismissed'] }, evidence: S.text(300) },
      handler: async ({ c, principal, params, body }) => { const r = await c.services.ops.resolveDq(params.id, body, principal); if (!r) throw errors.notFound('Issue'); return r; } },
    { method: 'POST', path: '/api/data/ingest', auth: 'staff', perm: 'data:ingest', tag: 'Data', summary: 'Ingest a batch of source records (≤ 5,000)',
      body: { source: { type: 'string', max: 60, required: true }, records: { type: 'array', max: 5000, required: true, items: { type: 'object' } } },
      handler: async ({ c, principal, body }) => {
        const allowed = ['recordId', 'source', 'plateRaw', 'phoneRaw', 'fullName', 'tollClass', 'seatsDeclared', 'usageDeclared', 'ownerType', 'tagActivatedAt', 'policy', 'lastInspectionDate', 'declaredExpiry', 'partnerId', 'firstRegisteredYear',
          // VETC account signals used by MDM (consent and engagement must travel with the record).
          'appUser', 'appSessions30d', 'tollTrips30d', 'longTripsKm90d', 'walletBalance', 'autoTopUp', 'pushEnabled', 'zaloLinked', 'marketingConsent', 'callConsent', 'dnc', 'complaints12m', 'priorVetcInsurancePurchase'];
        const records = body.records.map((r, i) => {
          const out = {};
          for (const k of allowed) if (r[k] !== undefined) out[k] = r[k];
          if (!out.recordId || typeof out.recordId !== 'string') throw errors.validation(`records[${i}].recordId required`);
          out.source = out.source || body.source;
          return out;
        });
        const r = await c.services.ingestion.ingest(records, { actor: principal.id, sourceName: body.source });
        await c.events.drain();
        return r;
      } },

    // ---------- Audit, users, ops, DSAR ----------
    { method: 'GET', path: '/api/audit', auth: 'staff', perm: 'audit:read', tag: 'Audit', summary: 'Audit trail search',
      query: {
        entityId: { type: 'string', max: 80 }, actor: { type: 'string', max: 80 }, action: { type: 'string', max: 80 }, limit: S.limit, offset: S.offset,
        category: { type: 'string', enum: Object.keys(AUDIT_CATEGORIES) }, from: S.date, to: S.date,
      },
      handler: async ({ c, query, principal }) => c.services.audit.list(query, { principal, access: c.services.access }) },
    { method: 'GET', path: '/api/audit/actors', auth: 'staff', perm: 'audit:read', tag: 'Audit', summary: 'Staff who can appear in the audit trail (display name and roles, for filtering)',
      handler: async ({ c }) => c.services.audit.actors() },
    { method: 'GET', path: '/api/audit/verify', auth: 'staff', perm: 'audit:read', tag: 'Audit', summary: 'Verify the audit hash chain',
      handler: async ({ c }) => c.services.audit.verify() },
    { method: 'GET', path: '/api/users', auth: 'staff', perm: 'users:manage', tag: 'Users', summary: 'List users',
      handler: async ({ c }) => c.services.identity.list() },
    { method: 'GET', path: '/api/users/role-policy', auth: 'staff', perm: 'users:manage', tag: 'Users', summary: 'Assignable roles, separation-of-duties pairs and roles that require MFA',
      handler: async ({ c }) => ({
        roles: Object.keys(c.rbac.roles).filter((r) => !['customer', 'partner_api'].includes(r)),
        separationOfDuties: c.rbac.separationOfDuties || [],
        mfaRequiredRoles: c.config.mfaRequiredRoles || [],
      }) },
    { method: 'POST', path: '/api/users', auth: 'staff', perm: 'users:manage', tag: 'Users', summary: 'Create a user',
      body: { username: { type: 'string', max: 60, required: true, pattern: /^[a-z0-9._-]+$/ }, password: { type: 'string', max: 128, required: true }, displayName: { type: 'string', max: 120, required: true }, roles: { type: 'array', max: 10, required: true, items: { type: 'string', max: 40 } }, region: { type: 'string', max: 60 }, enableMfa: { type: 'boolean' } },
      handler: async ({ c, principal, body }) => c.services.identity.createUser(body, principal) },
    { method: 'PATCH', path: '/api/users/:id', auth: 'staff', perm: 'users:manage', tag: 'Users', summary: 'Change roles / region / status',
      body: { roles: { type: 'array', max: 10, items: { type: 'string', max: 40 } }, region: { type: 'string', max: 60 }, status: { type: 'string', enum: ['active', 'disabled'] } },
      handler: async ({ c, principal, params, body }) => c.services.identity.update(params.id, body, principal) },
    { method: 'POST', path: '/api/users/:id/reset', auth: 'staff', perm: 'users:manage', tag: 'Users', summary: 'Unlock an account and/or reset MFA (user re-enrols at next sign-in)',
      body: { unlock: { type: 'boolean' }, resetMfa: { type: 'boolean' }, resetPassword: { type: 'boolean' } },
      handler: async ({ c, principal, params, body }) => c.services.identity.reset(params.id, body, principal) },
    { method: 'GET', path: '/api/ops/status', auth: 'staff', perm: 'ops:read', tag: 'Operations', summary: 'Integrations, store, rules and backlog status',
      handler: async ({ c }) => ({
        store: c.store.kind,
        integrations: [c.gateways.payment, c.gateways.paymentTasco, c.gateways.policyAdmin, c.gateways.coreRating, c.gateways.productCatalogue, c.gateways.telephony, ...Object.values(c.gateways.notify)].filter(Boolean).map((g) => {
          // Additive health fields: last call latency and times (null until the integration is first used).
          const st = g.stats ? g.stats() : {};
          return { name: g.name, circuit: g.state(), mode: g.mode || null, latencyMs: st.lastLatencyMs ?? null, lastCallAt: st.lastCallAt || null, lastSuccessAt: st.lastSuccessAt || null, lastFailureAt: st.lastFailureAt || null, calls: st.calls ?? null, failures: st.failures ?? null };
        }),
        checkedAt: new Date().toISOString(),
        jobs: await c.services.ops.jobSchedule(),
        rules: await c.services.rules.snapshot(),
        eventBacklog: await c.store.collection('domain_events').countBy('status'),
        auditEntries: await c.services.audit.count(),
      }) },
    { method: 'GET', path: '/api/ops/jobs', auth: 'staff', perm: 'ops:read', tag: 'Operations', summary: 'Job history',
      handler: async ({ c }) => c.services.ops.jobRuns() },
    { method: 'GET', path: '/api/integrations/status', auth: 'staff', perm: 'ops:read', tag: 'Operations', summary: 'TASCO core integration: rating source, circuit states, last catalogue sync',
      handler: async ({ c }) => {
        const { coreRating, productCatalogue, policyAdmin } = c.gateways;
        const source = c.config.ratingSource;
        return {
          rating: {
            source,
            failClosed: source === 'core',
            fallbackToIndicative: source === 'core_with_fallback',
            core: { mode: coreRating.mode, endpoint: coreRating.endpoint || null, circuit: coreRating.state() },
          },
          catalogue: { circuit: productCatalogue.state(), lastSync: await c.services.catalogue.lastSync() },
          policyAdministration: { circuit: policyAdmin.state() },
        };
      } },
    { method: 'POST', path: '/api/ops/jobs/:kind', auth: 'staff', perm: 'ops:run_jobs', tag: 'Operations', summary: 'Run a job: reconciliation | retention | relay | catalogue-sync',
      handler: async ({ c, principal, params }) => {
        if (params.kind === 'catalogue-sync') return c.services.catalogue.sync(principal.id);
        if (params.kind === 'reconciliation') return c.services.ops.reconcile(principal.id);
        if (params.kind === 'retention') return c.services.ops.applyRetention(principal.id);
        if (params.kind === 'relay') return c.services.ops.recordRun('relay', principal.id, async () => ({ processed: await c.events.drain() }));
        throw errors.notFound('Job kind');
      } },
    { method: 'POST', path: '/api/dsar/:id/export', auth: 'staff', perm: 'dsar:manage', tag: 'Privacy', summary: 'Data subject access export',
      handler: async ({ c, principal, params }) => c.services.customers.exportData(params.id, principal) },
    { method: 'POST', path: '/api/dsar/:id/erase', auth: 'staff', perm: 'dsar:manage', tag: 'Privacy', summary: 'Data subject erasure (anonymise)',
      handler: async ({ c, principal, params }) => c.services.customers.erase(params.id, principal) },

    // ---------- Customer (VETC app / Zalo mini app) ----------
    { method: 'POST', path: '/api/customer/session', auth: 'public', tag: 'Customer', summary: 'Exchange a signed renewal link (or VETC SSO token) for a customer session', loginLimited: true,
      body: { link: { type: 'string', max: 200 }, demoProfileId: S.id, channel: { type: 'string', enum: CUSTOMER_CHANNELS } },
      handler: async ({ c, body }) => {
        let id = body.link ? c.links.verify(body.link) : null;
        if (!id && body.demoProfileId && c.config.demoMode) id = body.demoProfileId;
        const prof = id ? await c.store.collection('profiles').get(id) : null;
        if (!prof || prof.anonymised) throw errors.unauthenticated('Link invalid or expired');
        const channel = body.channel || 'vetc_app';
        return { token: c.services.customers.issueCustomerToken(id, channel), profileId: id, channel };
      } },
    { method: 'GET', path: '/api/customer/home', auth: 'customer', tag: 'Customer', summary: 'My vehicle, cover and benefits',
      handler: async ({ c, principal }) => c.services.customers.home(principal.customerId) },
    { method: 'POST', path: '/api/customer/expiry', auth: 'customer', tag: 'Customer', summary: 'Confirm my current expiry (fixes data, earns points)',
      body: { expiryDate: { type: 'date', required: true }, insurer: { type: 'string', max: 60 } },
      handler: async ({ c, principal, body }) => { const r = await c.services.customers.declareExpiry(principal.customerId, body, principal); await c.events.drain(); return r; } },
    { method: 'POST', path: '/api/customer/vehicle', auth: 'customer', tag: 'Customer', summary: 'Confirm my vehicle use and seats before quoting (sets the TNDS tariff category)',
      body: { usage: { type: 'string', enum: ['personal', 'commercial'], required: true }, seats: { type: 'integer', min: 1, max: 60, required: true } },
      handler: async ({ c, principal, body }) => {
        const p = await c.store.collection('profiles').get(principal.customerId);
        if (!p) throw errors.notFound('Vehicle');
        // The owner's own confirmation in an authenticated session: recorded as evidence and re-merged
        // through the normal survivorship rules, so lineage shows where the category came from.
        await c.services.ingestion.ingest([{
          recordId: `CV-${p.plateKey || principal.customerId}-${Date.now()}`, source: 'customer_vehicle_confirmed',
          plateRaw: p.plate, seatsDeclared: body.seats, usageDeclared: body.usage, ownerType: p.ownerType || 'individual',
        }], { actor: principal.id, sourceName: 'customer_app' });
        await c.events.drain();
        await c.services.audit.record({ actor: principal.id, action: 'customer.vehicle_confirmed', entityType: 'profile', entityId: principal.customerId, details: { usage: body.usage, seats: body.seats } });
        const after = await c.store.collection('profiles').get(principal.customerId);
        return { ok: true, category: after.vehicle.category, seats: after.vehicle.seats ?? body.seats, usage: after.vehicle.usage ?? body.usage };
      } },
    { method: 'POST', path: '/api/customer/quotes', auth: 'customer', tag: 'Customer', summary: 'Quote for my vehicle',
      body: { products: PRODUCT_LINES, termYears: { type: 'integer', min: 1, max: 3 }, journey: { type: 'string', max: 40 } },
      handler: async ({ c, principal, body }) => c.services.sales.quote({ ...body, profileId: principal.customerId, channel: principal.channel || 'vetc_app' }, principal) },
    { method: 'POST', path: '/api/customer/quotes/:id/rerate', auth: 'customer', tag: 'Customer', summary: 'Confirm the final TASCO price of an indicative quote',
      handler: async ({ c, principal, params }) => {
        const q = await c.services.sales.getQuote(params.id);
        if (q.profileId !== principal.customerId) throw errors.notFound('Quote');
        return c.services.sales.rerate(params.id, principal);
      } },
    { method: 'GET', path: '/api/customer/quotes', auth: 'customer', tag: 'Customer', summary: 'Quotes waiting for my confirmation',
      handler: async ({ c, principal }) => c.services.sales.openQuotes(principal.customerId) },
    { method: 'POST', path: '/api/customer/orders', auth: 'customer', tag: 'Customer', summary: 'One-tap pay with VETC wallet (Idempotency-Key)', idempotent: true,
      body: { quoteId: { type: 'string', max: 80, required: true } },
      handler: async ({ c, principal, body, idempotencyKey }) => {
        const q = await c.services.sales.getQuote(body.quoteId);
        if (q.profileId !== principal.customerId) throw errors.notFound('Quote');
        const r = await c.services.sales.purchase({ ...body, idempotencyKey }, principal);
        await c.events.drain();
        return r;
      } },
    { method: 'PUT', path: '/api/customer/consent', auth: 'customer', tag: 'Customer', summary: 'Consent centre',
      body: { marketing: { type: 'boolean' }, call: { type: 'boolean' } },
      handler: async ({ c, principal, body }) => { const r = await c.services.customers.updateConsent(principal.customerId, body, principal); await c.events.drain(); return r; } },
    { method: 'POST', path: '/api/customer/claims', auth: 'customer', tag: 'Customer', summary: 'Report an accident (FNOL)',
      body: { policyId: { type: 'string', max: 80, required: true }, incidentDate: { type: 'date', required: true }, description: { type: 'string', max: 2000, required: true }, location: { type: 'string', max: 200 }, photos: { type: 'integer', min: 0, max: 20 } },
      handler: async ({ c, principal, body }) => { const r = await c.services.claims.submit({ ...body, profileId: principal.customerId }, principal); await c.events.drain(); return r; } },
    { method: 'GET', path: '/api/customer/claims', auth: 'customer', tag: 'Customer', summary: 'My claims',
      handler: async ({ c, principal }) => c.services.claims.list({ profileId: principal.customerId }) },
    { method: 'GET', path: '/api/customer/data-export', auth: 'customer', tag: 'Customer', summary: 'Download my data (right of access)',
      handler: async ({ c, principal }) => c.services.customers.exportData(principal.customerId, principal) },
  ];
}

module.exports = { buildRoutes, CHANNELS, CUSTOMER_CHANNELS };
