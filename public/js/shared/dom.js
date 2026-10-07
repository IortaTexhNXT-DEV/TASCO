/**
 * Safe DOM builder. All dynamic text goes through textContent / attributes —
 * never innerHTML — so server data can never inject markup (XSS-safe by design).
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v; // CSSOM is CSP-safe (style attributes are not)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, ...children);
  return el;
}

export function append(el, ...children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Replace an element's children (accepts nested arrays; skips null/false). */
export function mount(el, ...children) {
  return append(clear(el), ...children);
}

const NBSP = ' ';
/** Money: grouped digits + non-breaking space before ₫ so the symbol never wraps alone. */
export const fmtVnd = (n) => (n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('vi-VN')}${NBSP}₫`);
export const fmtNum = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('vi-VN'));

/**
 * Dates are always dd/MM/yyyy and date-times dd/MM/yyyy HH:mm (24 h, Vietnam time)
 * in every language — formatted explicitly, never via locale defaults (which
 * produce US month-first order or time-first strings depending on the browser).
 */
const pad = (x) => String(x).padStart(2, '0');
export const fmtDate = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return '—';
  const v = new Date(dt.getTime() + 7 * 3600000); // Asia/Ho_Chi_Minh (UTC+7, no DST)
  return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
};
export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  const v = new Date(dt.getTime() + 7 * 3600000);
  return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
};
/** Period "dd/MM/yyyy → dd/MM/yyyy" that wraps only around the arrow. */
export const fmtPeriod = (from, to) => `${fmtDate(from)}${NBSP}→ ${fmtDate(to)}`;

/**
 * Short, readable reference for long ids: "Q-7558aa81-…" → "Q-7558AA81", "O-<20 hex>" → "O-XXXXXXXX" (prefix + first
 * 8 characters of the UUID). Shown in full — never with an ellipsis — the full id goes in
 * the tooltip and the copy button.
 */
export const shortRef = (id) => {
  if (!id) return '—';
  const m = String(id).match(/^([A-Za-z]+-)?([0-9a-fA-F]{8})(?:-[0-9a-fA-F-]{4,}|[0-9a-fA-F]{4,})$/);
  return m ? `${m[1] || ''}${m[2].toUpperCase()}` : String(id);
};
