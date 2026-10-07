'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse YYYY-MM-DD as a UTC date at midnight. */
function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function addDays(d, n) {
  return new Date(parseDate(d).getTime() + n * DAY_MS);
}

function daysBetween(from, to) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / DAY_MS);
}

/** Remove Vietnamese diacritics and lowercase, for robust keyword matching. */
function stripDiacritics(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

/** Deterministic PRNG (mulberry32) so demo data is reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted: (pairs) => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of pairs) {
        r -= w;
        if (r <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
  };
}

function maskPhone(phone) {
  if (!phone) return null;
  const s = String(phone);
  return s.length <= 6 ? '***' : `${s.slice(0, 4)}***${s.slice(-3)}`;
}

function maskName(name) {
  if (!name) return null;
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return `${parts[0][0]}***`;
  return [...parts.slice(0, -1).map((p) => `${p[0]}.`), parts[parts.length - 1]].join(' ');
}

function formatVnd(n) {
  return `${Math.round(n).toLocaleString('vi-VN')} ₫`;
}

module.exports = {
  DAY_MS, parseDate, fmtDate, addDays, daysBetween, stripDiacritics, clamp, rng, maskPhone, maskName, formatVnd,
};

/** "2026-10-07" → "07/10/2026" (Vietnamese date format). */
function viDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

module.exports.viDate = viDate;
