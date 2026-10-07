'use strict';

const { stripDiacritics } = require('../shared/util');

/**
 * Vietnamese licence plate + phone normalisation.
 *
 * Plates come in many dirty forms across VETC sources ("30a-123.45", "30A 12345",
 * "51G1-678.90" for motorbikes, legacy 4-digit "29A-1234"). The canonical key is
 * the uppercase alphanumeric form, e.g. "30A12345".
 */

const PROVINCES = {
  11: 'Cao Bằng', 12: 'Lạng Sơn', 14: 'Quảng Ninh', 15: 'Hải Phòng', 16: 'Hải Phòng', 17: 'Thái Bình', 18: 'Nam Định',
  19: 'Phú Thọ', 20: 'Thái Nguyên', 21: 'Yên Bái', 22: 'Tuyên Quang', 23: 'Hà Giang', 24: 'Lào Cai', 25: 'Lai Châu',
  26: 'Sơn La', 27: 'Điện Biên', 28: 'Hòa Bình', 29: 'Hà Nội', 30: 'Hà Nội', 31: 'Hà Nội', 32: 'Hà Nội', 33: 'Hà Nội',
  34: 'Hải Dương', 35: 'Ninh Bình', 36: 'Thanh Hóa', 37: 'Nghệ An', 38: 'Hà Tĩnh', 40: 'Hà Nội', 43: 'Đà Nẵng',
  47: 'Đắk Lắk', 48: 'Đắk Nông', 49: 'Lâm Đồng', 41: 'TP. Hồ Chí Minh', 50: 'TP. Hồ Chí Minh', 51: 'TP. Hồ Chí Minh',
  52: 'TP. Hồ Chí Minh', 53: 'TP. Hồ Chí Minh', 54: 'TP. Hồ Chí Minh', 55: 'TP. Hồ Chí Minh', 56: 'TP. Hồ Chí Minh',
  57: 'TP. Hồ Chí Minh', 58: 'TP. Hồ Chí Minh', 59: 'TP. Hồ Chí Minh', 60: 'Đồng Nai', 61: 'Bình Dương', 62: 'Long An',
  63: 'Tiền Giang', 64: 'Vĩnh Long', 65: 'Cần Thơ', 66: 'Đồng Tháp', 67: 'An Giang', 68: 'Kiên Giang', 69: 'Cà Mau',
  70: 'Tây Ninh', 71: 'Bến Tre', 72: 'Bà Rịa - Vũng Tàu', 73: 'Quảng Bình', 74: 'Quảng Trị', 75: 'Thừa Thiên Huế',
  76: 'Quảng Ngãi', 77: 'Bình Định', 78: 'Phú Yên', 79: 'Khánh Hòa', 81: 'Gia Lai', 82: 'Kon Tum', 83: 'Sóc Trăng',
  84: 'Trà Vinh', 85: 'Ninh Thuận', 86: 'Bình Thuận', 88: 'Vĩnh Phúc', 89: 'Hưng Yên', 90: 'Hà Nam', 92: 'Quảng Nam',
  93: 'Bình Phước', 94: 'Bạc Liêu', 95: 'Hậu Giang', 97: 'Bắc Kạn', 98: 'Bắc Giang', 99: 'Bắc Ninh',
};

// Car plates: 2-digit province, 1–2 letter series (optionally followed by a digit
// for some special series), then 4 (legacy) or 5 digits.
const PLATE_RE = /^(\d{2})([A-Z]{1,2})(\d{4,5})$/;

function normalizePlate(raw) {
  if (!raw) return { valid: false, reason: 'missing' };
  const compact = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = PLATE_RE.exec(compact);
  if (!m) return { valid: false, reason: 'format', compact };
  const province = PROVINCES[Number(m[1])];
  if (!province) return { valid: false, reason: 'province', compact };
  const digits = m[3];
  const display = digits.length === 5
    ? `${m[1]}${m[2]}-${digits.slice(0, 3)}.${digits.slice(3)}`
    : `${m[1]}${m[2]}-${digits}`;
  return { valid: true, key: compact, display, province, provinceCode: m[1], series: m[2], digits };
}

/** Vietnamese mobile numbers: 10 digits, prefixes 03/05/07/08/09. Canonical form: 0XXXXXXXXX. */
function normalizePhone(raw) {
  if (!raw) return { valid: false, reason: 'missing' };
  let d = String(raw).replace(/[^\d+]/g, '');
  if (d.startsWith('+84')) d = `0${d.slice(3)}`;
  else if (d.startsWith('84') && d.length === 11) d = `0${d.slice(2)}`;
  else if (d.length === 9 && /^[35789]/.test(d)) d = `0${d}`;
  if (!/^0[35789]\d{8}$/.test(d)) return { valid: false, reason: 'format', compact: d };
  return { valid: true, value: d, e164: `+84${d.slice(1)}` };
}

const DIGIT_WORDS = {
  khong: '0', linh: '0', le: '0', mot: '1', hai: '2', ba: '3', bon: '4', tu: '4', nam: '5', lam: '5',
  sau: '6', bay: '7', tam: '8', chin: '9',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

/**
 * Pull a plate out of free speech (ASR output), e.g.
 *   "biển số của tôi là 30A 123 45" or "ba không A một hai ba bốn năm".
 * Spoken Vietnamese digits are mapped word-by-word; "chữ"/"chu" (letter) is ignored.
 * Returns the canonical key or null.
 */
function extractPlateFromSpeech(text) {
  const tokens = stripDiacritics(text).replace(/[.,\-–]/g, ' ').split(/\s+/).filter(Boolean);
  const mapped = tokens.map((t) => {
    if (DIGIT_WORDS[t] !== undefined) return DIGIT_WORDS[t];
    // Digit groups, short letter series ("a", "ld") or mixed tokens like "30a".
    if (/^\d+$/.test(t) || /^[a-z]{1,2}$/.test(t) || /^\d+[a-z]{1,2}\d*$/.test(t)) {
      if (t === 'la' || t === 'so') return ' ';
      return t.toUpperCase();
    }
    return ' ';
  });
  // Try every contiguous window of tokens, longest first, for a valid plate.
  for (let len = Math.min(mapped.length, 14); len >= 1; len--) {
    for (let i = 0; i + len <= mapped.length; i++) {
      const candidate = mapped.slice(i, i + len).join('');
      if (candidate.includes(' ')) continue;
      const p = normalizePlate(candidate);
      if (p.valid) return p.key;
    }
  }
  return null;
}

module.exports = { PROVINCES, normalizePlate, normalizePhone, extractPlateFromSpeech };
