'use strict';

const { normalizePlate, normalizePhone } = require('./identity');
const { parseDate, fmtDate, addDays, daysBetween } = require('../shared/util');
const { evaluate } = require('../rules/decisionTable');

/**
 * Master data management: match, merge and survive many incomplete source
 * records into one golden profile per vehicle (keyed by licence plate), with
 * field-level lineage and confidence. All weights come from the `enrichment`
 * rule set.
 */

function trustOf(rules, src) {
  return rules.sourceTrust[src] ?? rules.sourceTrust.default ?? 0.4;
}

function rollForward(date, today, floorDays) {
  let d = parseDate(date);
  const floor = addDays(today, -floorDays);
  let guard = 0;
  while (d < floor && guard++ < 50) d = new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
  return d;
}

function inferCategory(rules, facts) {
  return evaluate(rules.categoryTable, {
    tollClass: facts.tollClass ?? null,
    seats: facts.seats ?? null,
    commercial: facts.usage === 'commercial' || facts.ownerType === 'company',
  });
}

/** Expiry inference: best evidence wins; independent agreeing evidence raises confidence. */
function inferExpiry(rules, records, today) {
  const ev = rules.expiryEvidence;
  const floor = rules.rollForwardFloorDays;
  const cands = [];
  for (const r of records) {
    if (r.policy?.expiryDate && r.policy.verified) {
      cands.push({ date: r.policy.expiryDate, source: r.policy.insurer === 'TASCO' ? 'tasco_core' : r.source, method: 'verified_certificate', confidence: ev.verified_certificate.confidence, insurer: r.policy.insurer, certNo: r.policy.certNo });
    } else if (r.policy?.expiryDate) {
      const e = ev.partner_policy_record;
      const conf = e.scaleBySourceTrust ? Math.min(e.confidence, (e.confidence * trustOf(rules, r.source)) / e.trustReference) : e.confidence;
      cands.push({ date: r.policy.expiryDate, source: r.source, method: 'partner_policy_record', confidence: conf, insurer: r.policy.insurer });
    }
    if (r.declaredExpiry) cands.push({ date: r.declaredExpiry, source: 'customer_declared', method: 'customer_declared', confidence: ev.customer_declared.confidence });
    if (r.lastInspectionDate) {
      cands.push({ date: fmtDate(rollForward(addDays(r.lastInspectionDate, ev.inspection_cycle.offsetDays), today, floor)), source: r.source, method: 'inspection_cycle', confidence: ev.inspection_cycle.confidence });
    }
    if (r.tagActivatedAt) {
      cands.push({ date: fmtDate(rollForward(r.tagActivatedAt, today, floor)), source: r.source, method: 'tag_anniversary', confidence: ev.tag_anniversary.confidence });
    }
  }
  if (!cands.length) return { date: null, method: 'unknown', confidence: 0, candidates: [] };
  cands.sort((a, b) => b.confidence - a.confidence || (a.date < b.date ? 1 : -1));
  const best = { ...cands[0] };
  const c = rules.corroboration;
  const agree = cands.slice(1).filter((x) => x.method !== best.method && Math.abs(daysBetween(x.date, best.date)) <= c.windowDays);
  if (agree.length && best.confidence < 1) best.confidence = Math.min(c.maxConfidence, best.confidence + c.boostPerAgreement * agree.length);
  best.confidence = +best.confidence.toFixed(2);
  best.candidates = cands.map(({ date, method, confidence, source }) => ({ date, method, source, confidence: +confidence.toFixed(2) }));
  return best;
}

function survivors(rules, records, field, normalize) {
  const opts = [];
  for (const r of records) {
    const v = r[field];
    if (v === undefined || v === null || v === '') continue;
    const n = normalize ? normalize(v) : { valid: true, value: v };
    if (!n.valid) continue;
    opts.push({ value: n.value ?? v, source: r.source, trust: trustOf(rules, r.source) });
  }
  return opts.sort((a, b) => b.trust - a.trust);
}

/**
 * Build golden profiles.
 * @returns {{profiles, rejects, dqIssues, stats}}
 */
function buildProfiles(rules, rawRecords, today) {
  const groups = new Map();
  const rejects = [];
  for (const rec of rawRecords) {
    const p = normalizePlate(rec.plateRaw);
    if (!p.valid) {
      rejects.push({ recordId: rec.recordId, source: rec.source, reason: `invalid plate (${p.reason})` });
      continue;
    }
    if (!groups.has(p.key)) groups.set(p.key, { plate: p, records: [] });
    groups.get(p.key).records.push(rec);
  }

  const profiles = [];
  const dqIssues = [];
  const dq = rules.dataQuality;
  for (const [key, { plate, records }] of groups) {
    const account = records.find((r) => r.source === 'vetc_account') || {};
    const lineage = [];

    const phones = survivors(rules, records, 'phoneRaw', normalizePhone);
    const uniquePhones = [...new Set(phones.map((p) => p.value))];
    if (phones[0]) lineage.push({ field: 'phone', source: phones[0].source, confidence: phones[0].trust });
    const names = survivors(rules, records, 'fullName');
    if (names[0]) lineage.push({ field: 'name', source: names[0].source, confidence: names[0].trust });
    const seats = survivors(rules, records, 'seatsDeclared')[0];
    const usage = survivors(rules, records, 'usageDeclared')[0];
    const tollClass = survivors(rules, records, 'tollClass')[0];
    const ownerType = account.ownerType || records[0].ownerType || 'individual';
    const cat = inferCategory(rules, { tollClass: tollClass?.value, seats: seats?.value, usage: usage?.value, ownerType });
    lineage.push({ field: 'vehicle.category', source: cat.basis, confidence: cat.confidence, rule: cat.ruleId });
    const expiry = inferExpiry(rules, records, today);
    lineage.push({ field: 'policy.expiryDate', source: `${expiry.method}${expiry.source ? ` (${expiry.source})` : ''}`, confidence: expiry.confidence });

    const insurer = records.find((r) => r.policy?.insurer)?.policy.insurer || expiry.insurer || null;
    const missing = [];
    if (!uniquePhones.length) missing.push('phone');
    if (!names.length) missing.push('name');
    if (expiry.confidence < rules.usableExpiryConfidence) missing.push('reliable_expiry');
    if (cat.confidence < dq.categoryMinConfidence) missing.push('vehicle_category');
    if (!insurer) missing.push('current_insurer');
    for (const m of missing) dqIssues.push({ id: `${key}:${m}`, profileId: key, type: m, status: 'open' });
    if (uniquePhones.length > 1) dqIssues.push({ id: `${key}:conflicting_phone`, profileId: key, type: 'conflicting_phone', status: 'open' });

    const completeness = 1 - missing.length / 5;
    const score = Math.round(100 * (dq.completenessWeight * completeness + dq.expiryWeight * expiry.confidence + dq.categoryWeight * cat.confidence));

    profiles.push({
      id: key,
      plate: plate.display,
      province: plate.province,
      name: names[0]?.value || null,
      phone: uniquePhones[0] || null,
      altPhones: uniquePhones.slice(1),
      sources: [...new Set(records.map((r) => r.source))],
      recordIds: records.map((r) => r.recordId),
      ownerType,
      tagActivatedAt: account.tagActivatedAt || null,
      vehicle: {
        tollClass: tollClass?.value ?? null,
        seats: seats?.value ?? null,
        usage: usage?.value ?? (/^(commercial|truck)/.test(cat.category) ? 'commercial' : 'personal'),
        category: cat.category,
        categoryConfidence: cat.confidence,
        categoryBasis: cat.basis,
        firstRegisteredYear: account.firstRegisteredYear || null,
      },
      policy: {
        expiryDate: expiry.date,
        expiryMethod: expiry.method,
        expiryConfidence: expiry.confidence,
        expiryCandidates: expiry.candidates,
        insurer,
        certNo: expiry.certNo || null,
        verified: expiry.method === 'verified_certificate',
      },
      engagement: {
        appUser: !!account.appUser,
        appSessions30d: account.appSessions30d || 0,
        tollTrips30d: account.tollTrips30d || 0,
        longTripsKm90d: account.longTripsKm90d || 0,
        walletBalance: account.walletBalance || 0,
        autoTopUp: !!account.autoTopUp,
        priorVetcInsurancePurchase: !!account.priorVetcInsurancePurchase,
        complaints12m: account.complaints12m || 0,
      },
      channels: {
        app_push: !!account.pushEnabled,
        zalo_zns: !!account.zaloLinked && uniquePhones.length > 0,
        sms: uniquePhones.length > 0,
        voice_bot: uniquePhones.length > 0,
        telesales: uniquePhones.length > 0,
      },
      consent: { marketing: !!account.marketingConsent, call: !!account.callConsent, dnc: !!account.dnc },
      dataQuality: { score, missing },
      lineage,
      partnerId: records.find((r) => r.partnerId)?.partnerId || null,
    });
  }

  const usable = profiles.filter((p) => p.policy.expiryConfidence >= rules.usableExpiryConfidence).length;
  return {
    profiles,
    rejects,
    dqIssues,
    stats: {
      rawRecords: rawRecords.length,
      profiles: profiles.length,
      duplicatesMerged: rawRecords.length - rejects.length - profiles.length,
      rejected: rejects.length,
      verifiedStampRateRaw: rawRecords.length ? +(rawRecords.filter((r) => r.policy?.verified).length / rawRecords.length).toFixed(3) : 0,
      usableExpiryRate: profiles.length ? +(usable / profiles.length).toFixed(3) : 0,
      withPhone: profiles.filter((p) => p.phone).length,
    },
  };
}

/** Apply a customer- or bot-captured fact to a profile (closes the data loop). */
function applyDeclaredExpiry(profile, { expiryDate, insurer, source = 'customer_declared', confidence = 0.75 }) {
  const p = structuredClone(profile);
  p.policy.expiryCandidates = [{ date: expiryDate, method: source, confidence }, ...(p.policy.expiryCandidates || [])];
  if (confidence >= p.policy.expiryConfidence) {
    p.policy.expiryDate = expiryDate;
    p.policy.expiryMethod = source;
    p.policy.expiryConfidence = confidence;
  }
  if (insurer) p.policy.insurer = insurer;
  p.dataQuality.missing = p.dataQuality.missing.filter((m) => m !== 'reliable_expiry' && (!insurer || m !== 'current_insurer'));
  p.lineage = [...(p.lineage || []), { field: 'policy.expiryDate', source, confidence, at: new Date().toISOString() }];
  return p;
}

module.exports = { buildProfiles, inferCategory, inferExpiry, applyDeclaredExpiry };
