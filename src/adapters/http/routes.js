'use strict';

const { errors } = require('../../shared/errors');
const { normalizePlate, normalizePhone } = require('../../domain/identity');
const { evaluateLead } = require('../../domain/leads');
const { totp } = require('../../shared/crypto');

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

const CHANNELS = ['vetc_app', 'zalo', 'telesales', 'voice_bot', 'partner_api'];

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
      handler: async ({ c }) => ({ name: 'TASCO Growth Platform', version: require('../../../package.json').version, demoMode: c.config.demoMode, today: c.clock.today(), store: c.store.kind }) },
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
      handler: async ({ c, principal }) => ({ id: principal.id, username: principal.username, roles: principal.roles, region: principal.region, permissions: [...c.services.access.permissions(principal)] }) },
    { method: 'POST', path: '/api/auth/password', auth: 'staff', tag: 'Auth', summary: 'Change password',
      body: { currentPassword: { type: 'string', max: 200, required: true }, newPassword: { type: 'string', max: 200, required: true } },
      handler: async ({ c, principal, body }) => c.services.identity.changePassword(principal.id, body) },
    { method: 'GET', path: '/api/demo/totp/:username', auth: 'public', tag: 'Demo', summary: 'DEMO ONLY: current TOTP code for a seeded user', demoOnly: true,
      handler: async ({ c, params }) => {
        const secret = await c.services.identity.getTotpSecretForDemo(params.username);
        if (!secret) throw errors.notFound('MFA user');
        return { code: totp(secret), validForSeconds: 30 - (Math.floor(Date.now() / 1000) % 30) };
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
      },
      handler: async ({ c, query, principal }) => {
        const q = { ...query };
        if (principal.region && principal.region !== 'ALL' && !c.services.access.has(principal, 'dashboard:read')) q.region = principal.region;
        return c.services.leads.list(q);
      } },
    { method: 'POST', path: '/api/leads/recompute', auth: 'staff', perm: 'leads:recompute', tag: 'Leads', summary: 'Re-score all leads with active rules',
      handler: async ({ c, principal }) => c.services.leads.recompute(null, { actor: principal.id }) },
    { method: 'GET', path: '/api/customers/:id', auth: 'staff', perm: 'profile:read', tag: 'Customers', summary: 'Customer 360 (PII masked by permission)',
      handler: async ({ c, principal, params }) => customerDetail(c, principal, params.id) },
    { method: 'GET', path: '/api/customers/:id/lineage', auth: 'staff', perm: 'profile:read', tag: 'Customers', summary: 'Field-level data lineage',
      handler: async ({ c, params }) => c.services.ops.lineage(params.id) },
    { method: 'PATCH', path: '/api/customers/:id/expiry', auth: 'staff', perm: 'profile:update', tag: 'Customers', summary: 'Data steward correction of policy expiry',
      body: { expiryDate: { type: 'date', required: true }, insurer: { type: 'string', max: 60 }, evidence: { type: 'string', max: 300, required: true } },
      handler: async ({ c, principal, params, body }) => {
        const { applyDeclaredExpiry } = require('../../domain/enrichment'); // eslint-disable-line global-require
        const col = c.store.collection('profiles');
        const p = await col.get(params.id);
        if (!p) throw errors.notFound('Customer');
        await col.update(applyDeclaredExpiry(p, { expiryDate: body.expiryDate, insurer: body.insurer, source: 'data_steward', confidence: 0.9 }));
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
      handler: async ({ c, principal, body }) => { const r = await c.services.journeys.runDue({ ...body, actor: principal.id }); await c.events.drain(); return r; } },
    { method: 'POST', path: '/api/ecosystem/events', auth: 'staff', perm: 'journeys:run', tag: 'Journeys', summary: 'Ingest a VETC ecosystem event (moment of truth)',
      body: { type: { type: 'string', enum: ['vetc.tag_activated', 'vetc.inspection_booked', 'vetc.wallet_topped_up', 'vetc.long_trip_started'], required: true }, profileId: { ...S.id, required: true }, at: { type: 'string', max: 40 } },
      handler: async ({ c, principal, body }) => { const r = await c.services.journeys.handleEcosystemEvent(body, { actor: principal.id }); await c.events.drain(); return r; } },

    // ---------- Voice bot & handoffs ----------
    { method: 'POST', path: '/api/voice/sessions', auth: 'staff', perm: 'voice:operate', tag: 'Voice bot', summary: 'Start a voice bot session (console)',
      body: { profileId: { ...S.id, required: true } },
      handler: async ({ c, principal, body }) => c.services.voice.start(body.profileId, principal) },
    { method: 'GET', path: '/api/voice/sessions/:id', auth: 'staff', perm: 'voice:operate', tag: 'Voice bot', summary: 'Get session transcript',
      handler: async ({ c, params }) => c.services.voice.get(params.id) },
    { method: 'POST', path: '/api/voice/sessions/:id/turns', auth: 'staff', perm: 'voice:operate', tag: 'Voice bot', summary: 'Send a customer utterance (ASR text)',
      body: { text: { type: 'string', max: 500, required: true } },
      handler: async ({ c, principal, params, body }) => { const s = await c.services.voice.turn(params.id, body.text, principal); await c.events.drain(); return s; } },
    { method: 'POST', path: '/api/voice/campaign', auth: 'staff', perm: 'journeys:run', tag: 'Voice bot', summary: 'Run an automated call campaign over top leads',
      body: { limit: { type: 'integer', min: 1, max: 200, default: 20 }, tier: { type: 'string', enum: ['hot', 'warm'], default: 'hot' } },
      handler: async ({ c, principal, body }) => {
        const leads = await c.services.leads.list({ tier: body.tier, limit: 500 });
        const outcomes = {};
        let called = 0;
        for (const l of leads.items) {
          if (called >= body.limit) break;
          const p = await c.store.collection('profiles').get(l.id);
          if (!p?.consent.call || p.consent.dnc || !p.phone || p.ownerType === 'company') continue;
          const s = await c.services.voice.autoCall(l.id, { actor: principal.id });
          outcomes[s.outcome] = (outcomes[s.outcome] || 0) + 1;
          called++;
        }
        await c.events.drain();
        return { called, outcomes };
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
        return { items: visible, total: r.total };
      } },
    { method: 'GET', path: '/api/handoffs/:id', auth: 'staff', perm: 'handoff:read', tag: 'Telesales', summary: 'Handoff detail',
      handler: async ({ c, principal, params }) => {
        const h = await c.services.voice.getHandoff(params.id);
        await c.services.access.check(principal, 'read', { type: 'handoff', assignedTo: h.assignedTo, region: h.region });
        return h;
      } },
    { method: 'PATCH', path: '/api/handoffs/:id', auth: 'staff', perm: 'handoff:work', tag: 'Telesales', summary: 'Claim / update / assign a handoff',
      body: { status: { type: 'string', enum: ['open', 'claimed', 'callback', 'won', 'lost'] }, note: S.text(1000), assignTo: { type: 'string', max: 40 }, version: { type: 'integer', min: 1 } },
      handler: async ({ c, principal, params, body }) => {
        const h = await c.services.voice.getHandoff(params.id);
        await c.services.access.check(principal, 'update', { type: 'handoff', assignedTo: h.assignedTo, region: h.region });
        if (body.assignTo !== undefined) c.services.access.require(principal, 'handoff:assign');
        return c.services.voice.updateHandoff(params.id, body, principal);
      } },

    // ---------- Products, quotes, orders, policies ----------
    { method: 'GET', path: '/api/products', auth: 'staff', perm: 'quote:create', tag: 'Sales', summary: 'Active product catalogue and bundles',
      handler: async ({ c }) => c.services.sales.catalogue() },
    { method: 'POST', path: '/api/quotes', auth: 'staff', perm: 'quote:create', tag: 'Sales', summary: 'Quote one or more products for a customer',
      body: { profileId: { ...S.id, required: true }, products: PRODUCT_LINES, channel: { type: 'string', enum: CHANNELS, default: 'telesales' }, termYears: { type: 'integer', min: 1, max: 3 }, journey: { type: 'string', max: 40 } },
      handler: async ({ c, principal, body }) => c.services.sales.quote(body, principal) },
    { method: 'POST', path: '/api/orders', auth: 'staff', perm: 'policy:issue', tag: 'Sales', summary: 'Pay and issue (Idempotency-Key header required)', idempotent: true,
      body: { quoteId: { type: 'string', max: 80, required: true }, holderName: { type: 'string', max: 120 } },
      handler: async ({ c, principal, body, idempotencyKey }) => { const r = await c.services.sales.purchase({ ...body, idempotencyKey }, principal); await c.events.drain(); return r; } },
    { method: 'GET', path: '/api/policies', auth: 'staff', perm: 'policy:read', tag: 'Sales', summary: 'List issued policies',
      query: { profileId: S.id, product: { type: 'string', max: 40 }, limit: S.limit, offset: S.offset },
      handler: async ({ c, query }) => c.services.sales.listPolicies(query) },

    // ---------- Rules (maker-checker) ----------
    { method: 'GET', path: '/api/rules', auth: 'staff', perm: 'rules:read', tag: 'Rules', summary: 'List rule sets (all versions)',
      query: { kind: { type: 'string', max: 60 }, status: { type: 'string', enum: ['draft', 'pending_approval', 'active', 'retired', 'rejected'] } },
      handler: async ({ c, query }) => c.services.rules.list(query) },
    { method: 'GET', path: '/api/rules/:id', auth: 'staff', perm: 'rules:read', tag: 'Rules', summary: 'Rule set detail incl. payload',
      handler: async ({ c, params }) => c.services.rules.byId(params.id) },
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
    ...['submit', 'approve', 'reject', 'rollback'].map((action) => ({
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
      handler: async ({ c, principal, params }) => c.services.partners.issueApiKey(params.id, principal) },
    { method: 'DELETE', path: '/api/partners/keys/:keyId', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'Revoke an API key',
      handler: async ({ c, principal, params }) => c.services.partners.revokeApiKey(params.keyId, principal) },
    { method: 'GET', path: '/api/partners/:id/statement', auth: 'staff', perm: 'partners:manage', tag: 'Partners', summary: 'Commission statement',
      query: { from: S.date, to: S.date },
      handler: async ({ c, params, query }) => c.services.partners.statement(params.id, query) },

    // ---------- Partner API (X-Api-Key) ----------
    { method: 'POST', path: '/api/partner/v1/quotes', auth: 'partner', perm: 'partner:transact', tag: 'Partner API', summary: 'Quote by plate; unknown vehicles are onboarded (new business)',
      body: {
        plate: { type: 'string', max: 20, required: true }, products: PRODUCT_LINES, holderName: { type: 'string', max: 120 }, phone: { type: 'string', max: 20 },
        seats: { type: 'integer', min: 1, max: 60 }, usage: { type: 'string', enum: ['personal', 'commercial'] }, currentExpiry: S.date, consentMarketing: { type: 'boolean' },
      },
      handler: async ({ c, principal, body }) => {
        const plate = normalizePlate(body.plate);
        if (!plate.valid) throw errors.validation('Invalid licence plate');
        if (body.phone && !normalizePhone(body.phone).valid) throw errors.validation('Invalid phone');
        if (!(await c.store.collection('profiles').get(plate.key)) || body.currentExpiry || body.seats) {
          await c.services.ingestion.ingest([{
            recordId: `PR-${principal.partnerId}-${plate.key}-${Date.now()}`, source: `partner_${principal.partnerType}`, partnerId: principal.partnerId,
            plateRaw: body.plate, phoneRaw: body.phone || '', fullName: body.holderName || '', seatsDeclared: body.seats ?? null, usageDeclared: body.usage ?? null,
            ownerType: 'individual', policy: body.currentExpiry ? { insurer: null, expiryDate: body.currentExpiry, verified: false } : null,
          }], { actor: principal.id, sourceName: principal.partnerId });
          await c.events.drain();
        }
        return c.services.sales.quote({ profileId: plate.key, products: body.products, channel: 'partner_api', partnerId: principal.partnerId }, principal);
      } },
    { method: 'POST', path: '/api/partner/v1/orders', auth: 'partner', perm: 'partner:transact', tag: 'Partner API', summary: 'Bind a partner quote (Idempotency-Key)', idempotent: true,
      body: { quoteId: { type: 'string', max: 80, required: true }, holderName: { type: 'string', max: 120 } },
      handler: async ({ c, principal, body, idempotencyKey }) => {
        const q = await c.services.sales.getQuote(body.quoteId);
        if (q.partnerId !== principal.partnerId) throw errors.notFound('Quote');
        const r = await c.services.sales.purchase({ ...body, idempotencyKey }, principal);
        await c.events.drain();
        return r;
      } },
    { method: 'GET', path: '/api/partner/v1/policies', auth: 'partner', perm: 'partner:transact', tag: 'Partner API', summary: 'Policies sold by this partner',
      query: { limit: S.limit, offset: S.offset },
      handler: async ({ c, principal, query }) => c.services.sales.listPolicies({ ...query, partnerId: principal.partnerId }) },
    { method: 'GET', path: '/api/partner/v1/statement', auth: 'partner', perm: 'partner:transact', tag: 'Partner API', summary: 'Own commission statement',
      query: { from: S.date, to: S.date },
      handler: async ({ c, principal, query }) => c.services.partners.statement(principal.partnerId, query) },

    // ---------- Claims ----------
    { method: 'GET', path: '/api/claims', auth: 'staff', perm: 'claims:read', tag: 'Claims', summary: 'FNOL queue',
      query: { status: { type: 'string', max: 30 }, limit: S.limit, offset: S.offset },
      handler: async ({ c, query }) => c.services.claims.list(query) },
    { method: 'PATCH', path: '/api/claims/:id', auth: 'staff', perm: 'claims:update', tag: 'Claims', summary: 'Advance claim status',
      body: { status: { type: 'string', max: 30, required: true }, note: S.text(1000) },
      handler: async ({ c, principal, params, body }) => c.services.claims.transition(params.id, body.status, principal, body.note) },

    // ---------- Data quality, ingestion, lineage ----------
    { method: 'GET', path: '/api/dq/issues', auth: 'staff', perm: 'dq:read', tag: 'Data', summary: 'Data-quality issues',
      query: { type: { type: 'string', max: 40 }, status: { type: 'string', enum: ['open', 'resolved'] }, limit: S.limit, offset: S.offset },
      handler: async ({ c, query }) => c.services.ops.dqIssues(query) },
    { method: 'POST', path: '/api/dq/issues/:id/resolve', auth: 'staff', perm: 'dq:resolve', tag: 'Data', summary: 'Resolve a DQ issue',
      body: { resolution: { type: 'string', max: 500, required: true } },
      handler: async ({ c, principal, params, body }) => { const r = await c.services.ops.resolveDq(params.id, body, principal); if (!r) throw errors.notFound('Issue'); return r; } },
    { method: 'POST', path: '/api/data/ingest', auth: 'staff', perm: 'data:ingest', tag: 'Data', summary: 'Ingest a batch of source records (≤ 5,000)',
      body: { source: { type: 'string', max: 60, required: true }, records: { type: 'array', max: 5000, required: true, items: { type: 'object' } } },
      handler: async ({ c, principal, body }) => {
        const allowed = ['recordId', 'source', 'plateRaw', 'phoneRaw', 'fullName', 'tollClass', 'seatsDeclared', 'usageDeclared', 'ownerType', 'tagActivatedAt', 'policy', 'lastInspectionDate', 'declaredExpiry', 'partnerId', 'firstRegisteredYear'];
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
      query: { entityId: { type: 'string', max: 80 }, actor: { type: 'string', max: 80 }, action: { type: 'string', max: 80 }, limit: S.limit, offset: S.offset },
      handler: async ({ c, query }) => c.services.audit.list(query) },
    { method: 'GET', path: '/api/audit/verify', auth: 'staff', perm: 'audit:read', tag: 'Audit', summary: 'Verify the audit hash chain',
      handler: async ({ c }) => c.services.audit.verify() },
    { method: 'GET', path: '/api/users', auth: 'staff', perm: 'users:manage', tag: 'Users', summary: 'List users',
      handler: async ({ c }) => c.services.identity.list() },
    { method: 'POST', path: '/api/users', auth: 'staff', perm: 'users:manage', tag: 'Users', summary: 'Create a user',
      body: { username: { type: 'string', max: 60, required: true, pattern: /^[a-z0-9._-]+$/ }, password: { type: 'string', max: 128, required: true }, displayName: { type: 'string', max: 120, required: true }, roles: { type: 'array', max: 10, required: true, items: { type: 'string', max: 40 } }, region: { type: 'string', max: 60 }, enableMfa: { type: 'boolean' } },
      handler: async ({ c, principal, body }) => c.services.identity.createUser(body, principal) },
    { method: 'PATCH', path: '/api/users/:id', auth: 'staff', perm: 'users:manage', tag: 'Users', summary: 'Change roles / region / status',
      body: { roles: { type: 'array', max: 10, items: { type: 'string', max: 40 } }, region: { type: 'string', max: 60 }, status: { type: 'string', enum: ['active', 'disabled'] } },
      handler: async ({ c, principal, params, body }) => c.services.identity.update(params.id, body, principal) },
    { method: 'GET', path: '/api/ops/status', auth: 'staff', perm: 'ops:read', tag: 'Operations', summary: 'Integrations, store, rules and backlog status',
      handler: async ({ c }) => ({
        store: c.store.kind,
        integrations: [c.gateways.payment, c.gateways.policyAdmin, c.gateways.telephony, ...Object.values(c.gateways.notify)].map((g) => ({ name: g.name, circuit: g.state() })),
        rules: await c.services.rules.snapshot(),
        eventBacklog: await c.store.collection('domain_events').countBy('status'),
        auditEntries: await c.services.audit.count(),
      }) },
    { method: 'GET', path: '/api/ops/jobs', auth: 'staff', perm: 'ops:read', tag: 'Operations', summary: 'Job history',
      handler: async ({ c }) => c.services.ops.jobRuns() },
    { method: 'POST', path: '/api/ops/jobs/:kind', auth: 'staff', perm: 'ops:run_jobs', tag: 'Operations', summary: 'Run a job: reconciliation | retention | relay',
      handler: async ({ c, principal, params }) => {
        if (params.kind === 'reconciliation') return c.services.ops.reconcile(principal.id);
        if (params.kind === 'retention') return c.services.ops.applyRetention(principal.id);
        if (params.kind === 'relay') return { processed: await c.events.drain() };
        throw errors.notFound('Job kind');
      } },
    { method: 'POST', path: '/api/dsar/:id/export', auth: 'staff', perm: 'dsar:manage', tag: 'Privacy', summary: 'Data subject access export',
      handler: async ({ c, principal, params }) => c.services.customers.exportData(params.id, principal) },
    { method: 'POST', path: '/api/dsar/:id/erase', auth: 'staff', perm: 'dsar:manage', tag: 'Privacy', summary: 'Data subject erasure (anonymise)',
      handler: async ({ c, principal, params }) => c.services.customers.erase(params.id, principal) },

    // ---------- Customer (VETC app / Zalo mini app) ----------
    { method: 'POST', path: '/api/customer/session', auth: 'public', tag: 'Customer', summary: 'Exchange a signed renewal link (or VETC SSO token) for a customer session', loginLimited: true,
      body: { link: { type: 'string', max: 200 }, demoProfileId: S.id },
      handler: async ({ c, body }) => {
        let id = body.link ? c.links.verify(body.link) : null;
        if (!id && body.demoProfileId && c.config.demoMode) id = body.demoProfileId;
        if (!id || !(await c.store.collection('profiles').get(id))) throw errors.unauthenticated('Link invalid or expired');
        return { token: c.services.customers.issueCustomerToken(id), profileId: id };
      } },
    { method: 'GET', path: '/api/customer/home', auth: 'customer', tag: 'Customer', summary: 'My vehicle, cover and benefits',
      handler: async ({ c, principal }) => c.services.customers.home(principal.customerId) },
    { method: 'POST', path: '/api/customer/expiry', auth: 'customer', tag: 'Customer', summary: 'Confirm my current expiry (fixes data, earns points)',
      body: { expiryDate: { type: 'date', required: true }, insurer: { type: 'string', max: 60 } },
      handler: async ({ c, principal, body }) => { const r = await c.services.customers.declareExpiry(principal.customerId, body, principal); await c.events.drain(); return r; } },
    { method: 'POST', path: '/api/customer/quotes', auth: 'customer', tag: 'Customer', summary: 'Quote for my vehicle',
      body: { products: PRODUCT_LINES, termYears: { type: 'integer', min: 1, max: 3 }, journey: { type: 'string', max: 40 } },
      handler: async ({ c, principal, body }) => c.services.sales.quote({ ...body, profileId: principal.customerId, channel: 'vetc_app' }, principal) },
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
      handler: async ({ c, principal, body }) => c.services.claims.submit({ ...body, profileId: principal.customerId }, principal) },
    { method: 'GET', path: '/api/customer/claims', auth: 'customer', tag: 'Customer', summary: 'My claims',
      handler: async ({ c, principal }) => c.services.claims.list({ profileId: principal.customerId }) },
    { method: 'GET', path: '/api/customer/data-export', auth: 'customer', tag: 'Customer', summary: 'Download my data (right of access)',
      handler: async ({ c, principal }) => c.services.customers.exportData(principal.customerId, principal) },
  ];
}

module.exports = { buildRoutes, CHANNELS };
