'use strict';

const { rng, addDays, fmtDate, parseDate } = require('../../shared/util');

/**
 * Synthetic VETC-like source records.
 *
 * Reproduces the real data problems from the challenge brief:
 *  - only ~1 in 10 records carries a verified policy (valid stamp/certificate)
 *  - plates and phones in inconsistent formats, some invalid or missing
 *  - the same vehicle appearing in several sources with different completeness
 *  - partner/bank/showroom channels owning many existing policies
 *
 * No real personal data is used anywhere.
 */

const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const MIDDLE = ['Văn', 'Thị', 'Minh', 'Quốc', 'Thanh', 'Hữu', 'Đức', 'Ngọc', 'Gia', 'Hoàng'];
const GIVEN = ['An', 'Bình', 'Cường', 'Dũng', 'Hà', 'Hải', 'Hùng', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Tuấn', 'Vy'];
const PROVINCE_CODES = [29, 30, 30, 30, 51, 51, 51, 50, 43, 15, 36, 37, 61, 60, 72, 65, 99, 98, 88, 92, 79, 47];
const SERIES = ['A', 'A', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'LD'];
const INSURERS = ['TASCO', 'TASCO', 'PVI', 'PTI', 'Bảo Việt', 'PJICO', 'BIC', 'MIC'];
const PARTNER_CHANNELS = ['bank', 'showroom', 'agent', 'fleet', 'inspection_center'];

function makePlate(r) {
  const code = r.pick(PROVINCE_CODES);
  const series = r.pick(SERIES);
  const digits = String(r.int(10000, 99999));
  return { code, series, digits };
}

function dirtyPlate(r, p) {
  const style = r.int(0, 6);
  const base = `${p.code}${p.series}`;
  switch (style) {
    case 0: return `${base}-${p.digits.slice(0, 3)}.${p.digits.slice(3)}`;
    case 1: return `${base}${p.digits}`;
    case 2: return `${base.toLowerCase()} ${p.digits}`;
    case 3: return ` ${base}-${p.digits} `;
    case 4: return `${base}.${p.digits.slice(0, 3)}.${p.digits.slice(3)}`;
    case 5: return r.chance(0.5) ? `${base}-${p.digits.slice(0, 3)}` : `${p.code}-${p.digits}`; // broken
    default: return `${base} ${p.digits.slice(0, 3)} ${p.digits.slice(3)}`;
  }
}

function makePhone(r) {
  const prefix = r.pick(['090', '091', '093', '094', '096', '097', '098', '032', '033', '035', '038', '070', '077', '079', '081', '083', '085', '088', '056', '058']);
  return `${prefix}${String(r.int(1000000, 9999999))}`;
}

function dirtyPhone(r, phone) {
  const style = r.int(0, 7);
  switch (style) {
    case 0: return `+84${phone.slice(1)}`;
    case 1: return phone.slice(1); // missing leading zero
    case 2: return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
    case 3: return phone.slice(0, 8); // truncated
    case 4: return `84${phone.slice(1)}`;
    default: return phone;
  }
}

/** Toll class → plausible true vehicle category and seats. */
function vehicleFor(r) {
  const kind = r.weighted([
    ['car_under6', 52], ['car_6_11', 22], ['pickup_van', 8], ['commercial_under6', 5], ['commercial_6_8', 3],
    ['truck_under3t', 4], ['truck_3_8t', 3], ['car_12_24', 1.5], ['truck_8_15t', 1], ['truck_over15t', 0.5],
  ]);
  const map = {
    car_under6: { tollClass: 1, seats: r.pick([4, 5]), usage: 'personal' },
    car_6_11: { tollClass: 1, seats: r.pick([7, 7, 7, 8, 9]), usage: 'personal' },
    pickup_van: { tollClass: 1, seats: 5, usage: 'personal' },
    commercial_under6: { tollClass: 1, seats: 5, usage: 'commercial' },
    commercial_6_8: { tollClass: 1, seats: 7, usage: 'commercial' },
    truck_under3t: { tollClass: 1, seats: 2, usage: 'commercial' },
    truck_3_8t: { tollClass: 2, seats: 2, usage: 'commercial' },
    car_12_24: { tollClass: 2, seats: 16, usage: 'personal' },
    truck_8_15t: { tollClass: 3, seats: 2, usage: 'commercial' },
    truck_over15t: { tollClass: 4, seats: 2, usage: 'commercial' },
  };
  return { trueCategory: kind, ...map[kind] };
}

function generate({ count, seed, today }) {
  const r = rng(seed);
  const todayD = parseDate(today);
  const records = [];
  let recNo = 1;

  for (let i = 0; i < count; i++) {
    const plate = makePlate(r);
    const phone = makePhone(r);
    const name = `${r.pick(FAMILY)} ${r.pick(MIDDLE)} ${r.pick(GIVEN)}`;
    const vehicle = vehicleFor(r);
    const isFleet = vehicle.usage === 'commercial' && r.chance(0.35);
    // True (hidden) policy expiry: spread over the coming year, some already lapsed.
    const trueExpiry = addDays(todayD, r.int(-60, 330));
    // `hidden` ground truth is kept only for model evaluation in demos; never shown to users.
    const insurer = r.pick(INSURERS);
    const boughtVia = r.weighted([['partner', 62], ['vetc_app', 6], ['telesales', 2], ['unknown', 30]]);
    const appUser = r.chance(0.75);
    const lastInspection = addDays(trueExpiry, -365 + r.int(-20, 5));
    // ~4% of tags activated in the last 60 days (new vehicles → new-business journey).
    const tagActivated = addDays(todayD, -(r.chance(0.04) ? r.int(1, 60) : r.int(61, 1800)));

    const hidden = { trueExpiry: fmtDate(trueExpiry), trueCategory: vehicle.trueCategory, insurer, boughtVia };

    // Primary VETC account record (toll tag holder).
    const primary = {
      recordId: `R${String(recNo++).padStart(6, '0')}`,
      source: 'vetc_account',
      plateRaw: dirtyPlate(r, plate),
      phoneRaw: r.chance(0.88) ? dirtyPhone(r, phone) : '',
      fullName: r.chance(0.8) ? name : '',
      tollClass: r.chance(0.93) ? vehicle.tollClass : null,
      seatsDeclared: r.chance(0.35) ? vehicle.seats : null,
      usageDeclared: r.chance(0.25) ? vehicle.usage : null,
      ownerType: isFleet ? 'company' : 'individual',
      tagActivatedAt: fmtDate(tagActivated),
      firstRegisteredYear: todayD.getUTCFullYear() - r.int(0, 14),
      appUser,
      appSessions30d: appUser ? r.weighted([[0, 25], [r.int(1, 4), 40], [r.int(5, 15), 25], [r.int(16, 40), 10]]) : 0,
      tollTrips30d: r.weighted([[0, 10], [r.int(1, 6), 45], [r.int(7, 25), 35], [r.int(26, 90), 10]]),
      longTripsKm90d: r.int(0, 3500),
      walletBalance: r.weighted([[0, 25], [r.int(50, 400) * 1000, 45], [r.int(400, 3000) * 1000, 30]]),
      autoTopUp: r.chance(0.3),
      pushEnabled: appUser && r.chance(0.7),
      zaloLinked: r.chance(0.55),
      marketingConsent: r.chance(0.62),
      callConsent: r.chance(0.48),
      dnc: r.chance(0.03),
      complaints12m: r.weighted([[0, 92], [1, 6], [2, 2]]),
      priorVetcInsurancePurchase: boughtVia === 'vetc_app',
      lastInspectionDate: r.chance(0.3) ? fmtDate(lastInspection) : null,
      declaredExpiry: r.chance(0.12) ? fmtDate(trueExpiry) : null,
      policy: null,
      _hidden: hidden,
    };

    // ~1 in 10 records has a verified policy (valid stamp / e-certificate on file).
    if (r.chance(0.1)) {
      primary.policy = {
        insurer,
        certNo: `${insurer === 'TASCO' ? 'TAS' : 'EXT'}-${r.int(100000, 999999)}`,
        expiryDate: fmtDate(trueExpiry),
        verified: true,
      };
    }
    records.push(primary);

    // Some vehicles also appear in partner / telesales lists (duplicates to merge).
    if (r.chance(0.22)) {
      const partner = r.pick(PARTNER_CHANNELS);
      records.push({
        recordId: `R${String(recNo++).padStart(6, '0')}`,
        source: r.chance(0.6) ? `partner_${partner}` : 'telesales_csv',
        partnerId: `P-${partner.toUpperCase()}-01`,
        plateRaw: dirtyPlate(r, plate),
        phoneRaw: r.chance(0.7) ? dirtyPhone(r, r.chance(0.85) ? phone : makePhone(r)) : '',
        fullName: r.chance(0.9) ? name : '',
        tollClass: null,
        seatsDeclared: r.chance(0.6) ? vehicle.seats : null,
        usageDeclared: r.chance(0.6) ? vehicle.usage : null,
        ownerType: isFleet ? 'company' : 'individual',
        policy: r.chance(0.25)
          ? { insurer, certNo: null, expiryDate: fmtDate(trueExpiry), verified: false }
          : null,
        lastInspectionDate: r.chance(0.4) ? fmtDate(lastInspection) : null,
        _hidden: hidden,
      });
    }
  }
  return records;
}

/** Source adapter shape: the real VETC CDC/batch feed implements the same `fetchBatch()`. */
function createSyntheticVetcSource({ count, seed, today }) {
  return {
    name: 'synthetic-vetc',
    async fetchBatch() { return generate({ count, seed, today }); },
  };
}

module.exports = { generate, createSyntheticVetcSource };
