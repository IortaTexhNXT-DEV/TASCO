'use strict';

const crypto = require('crypto');
const { errors } = require('../shared/errors');
const { maskName, fmtDate } = require('../shared/util');
const { normalizePlate, normalizePhone } = require('../domain/identity');
const { blindIndex } = require('../shared/crypto');
const { userNames } = require('./auditService');

/**
 * Data-subject request register (Decree 13/2023/ND-CP, PDP Law 91/2025/QH15): every access or erasure request is
 * logged with its channel, response deadline and outcome, so compliance can show that each one was answered in time.
 *
 *   received ──▶ in_progress ──▶ completed
 *        └──────────┴──────────▶ refused   (a reason is always recorded)
 *
 * The deadline is receivedAt + `dsarResponseHours` (service_levels rule set; to be confirmed by TASCO legal).
 * Fulfilment reuses the existing customer-service export and erasure, so their behaviour and audit stay identical.
 * List rows never carry raw personal data: a masked name and the plate only.
 */

const TYPES = ['access', 'erasure'];
const CHANNELS = ['hotline', 'email', 'app', 'branch', 'letter'];
const OPEN = ['received', 'in_progress'];
const DEFAULT_RESPONSE_HOURS = 72;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/** Business-language refusal for a policy in force (Vietnamese: the register is an operational record in Vietnam). */
const policyInForceReason = (endDate) => `Hợp đồng bảo hiểm còn hiệu lực${endDate ? ` đến ${fmtDate(new Date(`${endDate}T00:00:00Z`)).split('-').reverse().join('/')}` : ''} — dữ liệu cá nhân phải được lưu giữ đến khi hợp đồng hết hạn theo nghĩa vụ pháp lý.`;

function createDsarService({ store, rules, audit, clock, customers }) {
  const requests = store.collection('dsar_requests');
  const profiles = store.collection('profiles');
  const col = (n) => store.collection(n);

  async function responseHours() {
    const sl = await rules.get('service_levels');
    return Number.isInteger(sl?.dsarResponseHours) && sl.dsarResponseHours > 0 ? sl.dsarResponseHours : DEFAULT_RESPONSE_HOURS;
  }

  /** Readable reference, e.g. DSR-261008-4F2A (date received + random suffix). */
  const newId = (at) => `DSR-${at.slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  async function load(id) {
    const r = await requests.get(id);
    if (!r) throw errors.notFound('Data request');
    return r;
  }

  function assertOpen(r) {
    if (!OPEN.includes(r.status)) throw errors.rule(`This request is already ${r.status === 'completed' ? 'completed' : 'refused'}`, { status: r.status });
  }

  /** Identity must be verified before any data leaves the company or is erased. */
  function verified(r, opts, actor, now) {
    if (r.verifiedIdentity) return {};
    if (!opts?.verifiedIdentity) throw errors.rule('Verify the requester’s identity before fulfilling the request', { reason: 'identity_not_verified' });
    return { verifiedIdentity: true, identityVerifiedAt: now, identityVerifiedBy: actor.id };
  }

  /** Find the data subject by profile id, plate or phone (the same lookups as the console customer search). */
  async function resolveProfile({ profileId, plate, phone }, blindKey) {
    let p = null;
    if (profileId) p = await profiles.get(profileId);
    else if (plate) {
      const n = normalizePlate(plate);
      if (!n.valid) throw errors.validation('Invalid licence plate');
      p = await profiles.get(n.key);
    } else if (phone) {
      const n = normalizePhone(phone);
      if (!n.valid) throw errors.validation('Invalid phone');
      [p] = await profiles.find({ where: { phone_bidx: blindIndex(blindKey, n.value) }, limit: 1 });
    } else throw errors.validation('Choose the customer the request is about');
    if (!p) throw errors.notFound('Customer');
    return p;
  }

  /** What we hold about the data subject: counts only, never the data itself. */
  async function held(profileId) {
    const [policies, quotes, orders, claims, messages, sourceRecords, voiceSessions] = await Promise.all([
      col('policies').count({ profile_id: profileId }), col('quotes').count({ profile_id: profileId }), col('orders').count({ profile_id: profileId }),
      col('claims').count({ profile_id: profileId }), col('messages').count({ profile_id: profileId }), col('source_records').count({ plate_key: profileId }),
      col('voice_sessions').count({ profile_id: profileId }),
    ]);
    const activePolicies = await col('policies').count({ profile_id: profileId, status: 'active' });
    return { policies, activePolicies, quotes, orders, claims, messages, sourceRecords, voiceSessions };
  }

  /** List/detail view of a request: masked name and plate only, plus SLA state. */
  function view(r, names, nowMs) {
    const open = OPEN.includes(r.status);
    const dueMs = Date.parse(r.dueAt);
    const short = (id) => (id && names.has(id) ? names.get(id).replace(/\s*\([^)]*\)$/, '') : null);
    return {
      id: r.id, profileId: r.profileId, plate: r.plate, customerName: r.anonymised ? null : r.customerName || null, anonymised: !!r.anonymised,
      type: r.type, channel: r.channel, status: r.status, receivedAt: r.receivedAt, dueAt: r.dueAt,
      overdue: open && dueMs < nowMs, dueSoon: open && dueMs >= nowMs && dueMs - nowMs <= 24 * HOUR_MS,
      verifiedIdentity: !!r.verifiedIdentity, identityVerifiedAt: r.identityVerifiedAt || null, identityVerifiedByName: short(r.identityVerifiedBy),
      startedAt: r.startedAt || null, completedAt: r.completedAt || null, outcome: r.outcome || null, refusalReason: r.refusalReason || null, refusalCode: r.refusalCode || null,
      note: r.note || null, createdBy: r.createdBy, createdByName: String(r.createdBy || '').startsWith('customer:') ? null : short(r.createdBy), byCustomer: String(r.createdBy || '').startsWith('customer:'),
      handledBy: r.handledBy || null, handledByName: short(r.handledBy),
      history: (r.history || []).map((x) => ({ ...x, byName: short(x.by), byCustomer: String(x.by || '').startsWith('customer:') })),
    };
  }

  async function views(list) {
    const names = await userNames(store, list.flatMap((r) => [r.createdBy, r.handledBy, r.identityVerifiedBy, ...(r.history || []).map((x) => x.by)]).filter((x) => x && !String(x).startsWith('customer:')));
    const nowMs = clock.now().getTime();
    return list.map((r) => view(r, names, nowMs));
  }

  async function save(r, patch, step, actor, action, details = {}) {
    const now = clock.now().toISOString();
    const next = { ...r, ...patch, updatedAt: now, history: [...(r.history || []), { ...step, at: now, by: actor.id }] };
    const saved = await requests.update(next);
    await audit.record({ actor: actor.id, action, entityType: 'profile', entityId: r.profileId, details: { requestId: r.id, type: r.type, ...details } });
    return saved;
  }

  const service = {
    TYPES, CHANNELS,

    /** Log a request received through a channel (hotline, e-mail, app, branch, letter). */
    async log(input, actor, { blindKey } = {}) {
      if (!TYPES.includes(input.type)) throw errors.validation('Unknown request type');
      if (!CHANNELS.includes(input.channel)) throw errors.validation('Unknown channel');
      const p = await resolveProfile(input, blindKey);
      const nowMs = clock.now().getTime();
      let receivedMs = nowMs;
      if (input.receivedAt) {
        receivedMs = Date.parse(input.receivedAt);
        if (Number.isNaN(receivedMs)) throw errors.validation('receivedAt must be a date and time');
        if (receivedMs > nowMs + 5 * 60000) throw errors.validation('A request cannot be received in the future');
        if (receivedMs < nowMs - 365 * DAY_MS) throw errors.validation('A request received more than a year ago cannot be logged');
      }
      const receivedAt = new Date(receivedMs).toISOString();
      const now = clock.now().toISOString();
      const hours = await responseHours();
      const r = {
        id: newId(receivedAt), profileId: p.id, plate: p.plate, customerName: maskName(p.name), anonymised: !!p.anonymised,
        type: input.type, channel: input.channel, receivedAt, dueAt: new Date(receivedMs + hours * HOUR_MS).toISOString(), responseHours: hours,
        status: input.completed ? 'completed' : 'received', note: input.note || null, outcome: null, refusalReason: null,
        verifiedIdentity: !!input.verifiedIdentity, identityVerifiedAt: input.verifiedIdentity ? now : null, identityVerifiedBy: input.verifiedIdentity ? actor.id : null,
        createdBy: actor.id, handledBy: null, completedAt: null, createdAt: now,
        history: [{ status: 'received', at: receivedAt, by: actor.id }, ...(input.verifiedIdentity ? [{ status: 'identity_verified', at: now, by: actor.id }] : [])],
      };
      await requests.insert(r);
      await audit.record({ actor: actor.id, action: 'dsar.request_logged', entityType: 'profile', entityId: p.id, details: { requestId: r.id, type: r.type, channel: r.channel } });
      return r;
    },

    /**
     * The customer downloaded their own data in the app: recorded as an access request that was received,
     * verified (signed-in session) and completed at once.
     */
    async recordSelfServiceExport(profileId, actor) {
      const p = await profiles.get(profileId);
      if (!p) return null;
      const now = clock.now().toISOString();
      const hours = await responseHours();
      const r = {
        id: newId(now), profileId, plate: p.plate, customerName: maskName(p.name), anonymised: false, type: 'access', channel: 'app',
        receivedAt: now, dueAt: new Date(Date.parse(now) + hours * HOUR_MS).toISOString(), responseHours: hours, status: 'completed',
        note: null, outcome: 'exported', refusalReason: null, verifiedIdentity: true, identityVerifiedAt: now, identityVerifiedBy: actor.id,
        createdBy: actor.id, handledBy: actor.id, completedAt: now, createdAt: now, selfService: true,
        history: ['received', 'identity_verified', 'completed'].map((status) => ({ status, at: now, by: actor.id })),
      };
      await requests.insert(r);
      await audit.record({ actor: actor.id, action: 'dsar.request_completed', entityType: 'profile', entityId: profileId, details: { requestId: r.id, type: 'access', channel: 'app', outcome: 'exported', selfService: true } });
      return r;
    },

    /** Register with filters (status, type, overdue) and the KPI summary for the console. */
    async list({ status, type, overdue, profileId, limit = 200, offset = 0 } = {}) {
      const where = {};
      if (status) where.status = status;
      if (type) where.type = type;
      if (profileId) where.profile_id = profileId;
      const all = await requests.find({ where, orderBy: ['received_at', 'desc'], limit: 2000 });
      const rows = await views(all);
      const filtered = overdue === undefined ? rows : rows.filter((r) => r.overdue === !!overdue);
      const everything = (status || type || profileId) ? await views(await requests.find({ orderBy: ['received_at', 'desc'], limit: 2000 })) : rows;
      const nowMs = clock.now().getTime();
      const summary = {
        open: everything.filter((r) => OPEN.includes(r.status)).length,
        dueSoon: everything.filter((r) => r.dueSoon).length,
        overdue: everything.filter((r) => r.overdue).length,
        completed30d: everything.filter((r) => r.status === 'completed' && r.completedAt && nowMs - Date.parse(r.completedAt) <= 30 * DAY_MS).length,
      };
      return { items: filtered.slice(offset, offset + limit), total: filtered.length, summary, responseHours: await responseHours() };
    },

    /** Detail: the request, its timeline and a summary of what is held (counts only). */
    async get(id, actor) {
      const r = await load(id);
      const [v] = await views([r]);
      const [summary, profile] = await Promise.all([held(r.profileId), profiles.get(r.profileId)]);
      await audit.record({ actor: actor.id, action: 'dsar.request_viewed', entityType: 'profile', entityId: r.profileId, details: { requestId: r.id } });
      return { ...v, held: summary, customer: profile ? { plate: profile.plate, name: profile.anonymised ? null : maskName(profile.name), province: profile.province || null, anonymised: !!profile.anonymised } : null };
    },

    /** Start handling (optionally recording that the requester's identity was verified). */
    async start(id, { verifiedIdentity } = {}, actor) {
      const r = await load(id);
      assertOpen(r);
      const now = clock.now().toISOString();
      const patch = { status: 'in_progress', handledBy: actor.id, startedAt: r.startedAt || now };
      if (verifiedIdentity && !r.verifiedIdentity) Object.assign(patch, { verifiedIdentity: true, identityVerifiedAt: now, identityVerifiedBy: actor.id });
      let saved = r;
      if (patch.verifiedIdentity) saved = await save(saved, { verifiedIdentity: true, identityVerifiedAt: now, identityVerifiedBy: actor.id }, { status: 'identity_verified' }, actor, 'dsar.identity_verified');
      if (r.status === 'received') saved = await save(saved, { status: 'in_progress', handledBy: actor.id, startedAt: now }, { status: 'in_progress' }, actor, 'dsar.request_started');
      return (await views([saved]))[0];
    },

    /** Access request: run the existing export, mark completed, return the data for download. */
    async completeExport(id, opts, actor) {
      const r = await load(id);
      assertOpen(r);
      if (r.type !== 'access') throw errors.rule('Only an access request is fulfilled by exporting the data');
      const now = clock.now().toISOString();
      const ver = verified(r, opts, actor, now);
      const data = await customers.exportData(r.profileId, actor);
      const saved = await save(r, { ...ver, status: 'completed', outcome: 'exported', handledBy: actor.id, startedAt: r.startedAt || now, completedAt: now },
        { status: 'completed' }, actor, 'dsar.request_completed', { outcome: 'exported' });
      const plate = String(r.plate || r.profileId).replace(/[^0-9A-Za-z.-]/g, '');
      return { request: (await views([saved]))[0], filename: `TASCO-data-${plate}-${now.slice(0, 10)}.json`, data };
    },

    /**
     * Erasure request: run the existing anonymisation. When the law requires the data to be kept (a policy in force),
     * the request is refused with the reason in business language instead of failing.
     */
    async erase(id, { reason, confirmPlate, verifiedIdentity } = {}, actor) {
      const r = await load(id);
      assertOpen(r);
      if (r.type !== 'erasure') throw errors.rule('Only an erasure request can erase personal data');
      if (!reason || String(reason).trim().length < 5) throw errors.validation('Give the reason for erasing (at least 5 characters)');
      const typed = normalizePlate(confirmPlate || '');
      if (!typed.valid || typed.key !== normalizePlate(r.plate || r.profileId).key) throw errors.validation('Type the vehicle plate to confirm the erasure');
      const now = clock.now().toISOString();
      const ver = verified(r, { verifiedIdentity }, actor, now);
      const active = await col('policies').find({ where: { profile_id: r.profileId, status: 'active' }, orderBy: ['end_date', 'desc'], limit: 5 });
      try {
        await customers.erase(r.profileId, actor);
      } catch (e) {
        if (e.code !== 'BUSINESS_RULE_VIOLATION') throw e;
        const saved = await save(r, { ...ver, status: 'refused', refusalCode: 'policy_in_force', refusalReason: policyInForceReason(active[0]?.endDate), handledBy: actor.id, completedAt: now, eraseReason: reason },
          { status: 'refused', note: policyInForceReason(active[0]?.endDate) }, actor, 'dsar.request_refused', { refusal: 'policy_in_force' });
        return { erased: false, refused: true, request: (await views([saved]))[0] };
      }
      const saved = await save(r, { ...ver, status: 'completed', outcome: 'erased', anonymised: true, customerName: null, handledBy: actor.id, startedAt: r.startedAt || now, completedAt: now, eraseReason: reason },
        { status: 'completed', note: reason }, actor, 'dsar.request_completed', { outcome: 'erased' });
      // Other requests about the same person no longer show a name.
      for (const o of await requests.find({ where: { profile_id: r.profileId }, limit: 200 })) {
        if (o.id !== r.id && !o.anonymised) await requests.update({ ...o, anonymised: true, customerName: null });
      }
      return { erased: true, refused: false, request: (await views([saved]))[0] };
    },

    /** Refuse with a reason (e.g. identity could not be verified, manifestly unfounded request). */
    async refuse(id, { reason }, actor) {
      const r = await load(id);
      assertOpen(r);
      if (!reason || String(reason).trim().length < 5) throw errors.validation('Give the reason for refusing (at least 5 characters)');
      const now = clock.now().toISOString();
      const saved = await save(r, { status: 'refused', refusalCode: 'manual', refusalReason: String(reason).trim(), handledBy: actor.id, completedAt: now },
        { status: 'refused', note: String(reason).trim() }, actor, 'dsar.request_refused', { refusal: 'manual' });
      return (await views([saved]))[0];
    },

    /** Requests about one data subject (included in their own access export). */
    async forProfile(profileId) {
      return (await requests.find({ where: { profile_id: profileId }, orderBy: ['received_at', 'desc'], limit: 100 }))
        .map(({ id, type, channel, status, receivedAt, dueAt, completedAt, outcome, refusalReason }) => ({ id, type, channel, status, receivedAt, dueAt, completedAt, outcome, refusalReason }));
    },
  };
  return service;
}

module.exports = { createDsarService, DSAR_TYPES: TYPES, DSAR_CHANNELS: CHANNELS };
