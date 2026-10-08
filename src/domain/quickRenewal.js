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
function evaluateQuickRenewal(f) {
  const s = f.settings;
  const codes = [];
  const tascoTnds = (f.policies || []).filter((p) => String(p.product || '').startsWith('TNDS') && p.status === 'active' && (p.insurer || 'TASCO') === 'TASCO')
    .sort((a, b) => String(b.endDate).localeCompare(String(a.endDate)));
  const latest = tascoTnds[0] || null;
  const renewingTasco = !!latest || (f.profile?.policy?.insurer === 'TASCO');

  // Term and cover carried over from the current TASCO policy (default: one year, compulsory TNDS only).
  const termYears = latest ? Math.min(3, Math.max(1, Math.round((Date.parse(latest.endDate) - Date.parse(latest.startDate)) / (365 * DAY_MS)))) : 1;
  const sameOrder = latest ? (f.policies || []).filter((p) => p.orderId && p.orderId === latest.orderId && p.status === 'active') : [];
  const hadPa = sameOrder.some((p) => p.product === PA);
  const hadPd = sameOrder.some((p) => p.product === 'MOTOR_PD') || (f.policies || []).some((p) => p.product === 'MOTOR_PD' && p.status === 'active' && p.endDate >= f.today);
  const products = [{ code: TNDS, options: { termYears } }];
  if (s.allowAddOns && hadPa) products.push({ code: PA, options: { sumInsuredPerSeat: PA_SUM_PER_SEAT } });

  if (!s.enabled) codes.push('disabled');
  if (!(f.lead?.journey && (s.journeys || []).includes(f.lead.journey)) && !renewingTasco) codes.push('journey');
  if (tascoTnds.some((p) => p.startDate > f.today)) codes.push('already_renewed');

  // Vehicle use and seats: TASCO core, or the customer's own recent confirmation.
  const v = f.profile?.vehicle || {};
  const known = v.seats !== null && v.seats !== undefined && !!v.usage;
  const evidence = f.vehicleEvidence || [];
  if (!known) codes.push('vehicle_unconfirmed');
  else if (s.requireConfirmedVehicle) {
    const core = evidence.some((e) => e.source === 'tasco_core');
    const confirmations = evidence.filter((e) => e.source === 'customer_vehicle_confirmed' && e.at);
    const fresh = confirmations.some((e) => f.nowMs - Date.parse(e.at) <= s.vehicleConfirmationMaxAgeDays * DAY_MS);
    if (!core && !fresh) codes.push(confirmations.length ? 'vehicle_confirmation_expired' : 'vehicle_unconfirmed');
  }

  if (hadPd) codes.push('physical_damage');
  const sellable = (code) => (f.catalogue?.products || []).some((p) => p.code === code && p.status === 'active' && (p.channels || []).includes(f.channel));
  if (!products.every((p) => sellable(p.code))) codes.push('product_unavailable');
  if (!f.coreAvailable) codes.push('core_unavailable');

  if (s.requireWalletBalance && VETC_WALLET_CHANNELS.includes(f.channel)) {
    const balance = f.profile?.engagement?.walletBalance;
    const premium = Number(f.lead?.premium) > 0 ? Number(f.lead.premium) * termYears : null;
    if (typeof balance === 'number' && premium !== null && balance < premium) codes.push('wallet_low');
  }

  const unique = [...new Set(codes)];
  return { eligible: unique.length === 0, reasons: unique.map((c) => REASONS[c]), codes: unique, products, termYears };
}

module.exports = { evaluateQuickRenewal, quickRenewalSettings, QUICK_RENEWAL_REASONS: REASONS, QUICK_RENEWAL_DEFAULTS: DEFAULTS };
