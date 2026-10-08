'use strict';

/**
 * Quick renewal (3 taps: open, tick the declaration, confirm payment) versus the full 6-step purchase flow.
 *
 * Pure decision: the customer service gathers the facts, this function applies the `quickRenewal` settings of the
 * `service_levels` rule set. The server decides; the app only shows the quick path when `eligible` is true.
 *
 * Eligible when ALL of these hold:
 *   1. the setting is enabled;
 *   2. the lead's journey is one of `journeys`, or the customer is renewing a TASCO policy;
 *   3. nothing has been renewed already (no TASCO compulsory policy starting in the future);
 *   4. vehicle use and seats are known — from TASCO core, or from the customer's own confirmation within
 *      `vehicleConfirmationMaxAgeDays` (when `requireConfirmedVehicle`; otherwise it is enough that both are on file);
 *   5. the cover is compulsory TNDS, with personal accident only when `allowAddOns` and the customer had it before;
 *      a customer whose TASCO cover includes physical damage needs the full flow (that cover needs an inspection);
 *   6. the price will not be indicative: either local filed rates price the quote, or TASCO core is available;
 *   7. in the VETC app and Zalo mini app (VETC wallet), when `requireWalletBalance`, the last known wallet balance
 *      covers the estimated premium (skipped when either is unknown).
 *
 * Reasons are short Vietnamese sentences for the customer app (business language, never codes); `codes` carries the
 * matching machine-readable reason for tests and analytics.
 */

const DEFAULTS = Object.freeze({
  enabled: false, journeys: ['renewal'], requireConfirmedVehicle: true, vehicleConfirmationMaxAgeDays: 365, allowAddOns: false, requireWalletBalance: true,
});

/** Vietnamese, customer-facing explanation for each reason code. */
const REASONS = Object.freeze({
  disabled: 'Gia hạn nhanh hiện chưa áp dụng',
  journey: 'Gia hạn nhanh chỉ áp dụng khi tái tục hợp đồng TASCO',
  already_renewed: 'Xe đã được gia hạn bảo hiểm',
  vehicle_unconfirmed: 'Cần xác nhận thông tin xe',
  vehicle_confirmation_expired: 'Cần xác nhận lại thông tin xe',
  physical_damage: 'Bảo hiểm vật chất xe cần giám định trước khi gia hạn',
  product_unavailable: 'Sản phẩm chưa mở bán trên kênh này',
  core_unavailable: 'Hệ thống định phí TASCO đang bận',
  wallet_low: 'Số dư ví VETC chưa đủ để thanh toán',
});

const VETC_WALLET_CHANNELS = ['vetc_app', 'zalo_mini_app'];
const DAY_MS = 86400000;
const TNDS = 'TNDS_CAR';
const PA = 'PA_SEAT';
const PA_SUM_PER_SEAT = 20000000;

/** Settings with defaults applied (older service_levels versions have no `quickRenewal`). */
function quickRenewalSettings(serviceLevels) {
  return { ...DEFAULTS, ...((serviceLevels && serviceLevels.quickRenewal) || {}) };
}

/**
 * @param {object} f facts
 * @param {object} f.settings          quickRenewalSettings(...)
 * @param {object} f.profile           golden profile
 * @param {object|null} f.lead         lead (journey, premium)
 * @param {Array}  f.policies          the customer's policies on the platform
 * @param {Array}  f.vehicleEvidence   [{ source: 'tasco_core'|'customer_vehicle_confirmed', at: ISO|null }]
 * @param {object} f.catalogue         products rule set payload
 * @param {string} f.channel           host channel of the session
 * @param {boolean} f.coreAvailable    true when the quote will not be indicative
 * @param {string} f.today             yyyy-mm-dd
 * @param {number} f.nowMs             epoch ms
 * @returns {{eligible: boolean, reasons: string[], codes: string[], products: Array, termYears: number}}
 */
/** The customer's TASCO compulsory cover on the platform: latest policy, its term and the add-ons bought with it. */
function currentCover(f) {
  const pols = f.policies || [];
  const tnds = pols.filter((p) => String(p.product || '').startsWith('TNDS') && p.status === 'active' && (p.insurer || 'TASCO') === 'TASCO')
    .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
  const latest = tnds[0] || null;
  const years = latest ? Math.round((Date.parse(latest.endDate) - Date.parse(latest.startDate)) / (365 * DAY_MS)) : 1;
  const sameOrder = latest ? pols.filter((p) => p.orderId && p.orderId === latest.orderId && p.status === 'active') : [];
  return {
    latest,
    renewedAlready: tnds.some((p) => p.startDate > f.today),
    termYears: Math.min(3, Math.max(1, years || 1)),
    hadPa: sameOrder.some((p) => p.product === PA),
    hadPd: pols.some((p) => p.product === 'MOTOR_PD' && p.status === 'active' && p.endDate >= f.today),
  };
}

/** null when use and seats are known well enough, else the reason code. */
function vehicleReason(f, s) {
  const v = f.profile?.vehicle || {};
  if (v.seats === null || v.seats === undefined || !v.usage) return 'vehicle_unconfirmed';
  if (!s.requireConfirmedVehicle) return null;
  const evidence = f.vehicleEvidence || [];
  if (evidence.some((e) => e.source === 'tasco_core')) return null;
  const confirmations = evidence.filter((e) => e.source === 'customer_vehicle_confirmed' && e.at);
  if (confirmations.some((e) => f.nowMs - Date.parse(e.at) <= s.vehicleConfirmationMaxAgeDays * DAY_MS)) return null;
  return confirmations.length ? 'vehicle_confirmation_expired' : 'vehicle_unconfirmed';
}

/** VETC wallet hosts: the last known balance must cover the estimated premium (skipped when either is unknown). */
function walletLow(f, s, termYears) {
  if (!s.requireWalletBalance || !VETC_WALLET_CHANNELS.includes(f.channel)) return false;
  const balance = f.profile?.engagement?.walletBalance;
  const premium = Number(f.lead?.premium) > 0 ? Number(f.lead.premium) * termYears : null;
  return typeof balance === 'number' && premium !== null && balance < premium;
}

function evaluateQuickRenewal(f) {
  const s = f.settings;
  const cover = currentCover(f);
  const renewingTasco = !!cover.latest || f.profile?.policy?.insurer === 'TASCO';
  const products = [{ code: TNDS, options: { termYears: cover.termYears } }];
  if (s.allowAddOns && cover.hadPa) products.push({ code: PA, options: { sumInsuredPerSeat: PA_SUM_PER_SEAT } });
  const sellable = (code) => (f.catalogue?.products || []).some((p) => p.code === code && p.status === 'active' && (p.channels || []).includes(f.channel));

  const codes = [
    s.enabled ? null : 'disabled',
    (f.lead?.journey && (s.journeys || []).includes(f.lead.journey)) || renewingTasco ? null : 'journey',
    cover.renewedAlready ? 'already_renewed' : null,
    vehicleReason(f, s),
    cover.hadPd ? 'physical_damage' : null,
    products.every((p) => sellable(p.code)) ? null : 'product_unavailable',
    f.coreAvailable ? null : 'core_unavailable',
    walletLow(f, s, cover.termYears) ? 'wallet_low' : null,
  ].filter(Boolean);
  return { eligible: codes.length === 0, reasons: codes.map((c) => REASONS[c]), codes, products, termYears: cover.termYears };
}

module.exports = { evaluateQuickRenewal, quickRenewalSettings, QUICK_RENEWAL_REASONS: REASONS, QUICK_RENEWAL_DEFAULTS: DEFAULTS };
