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

export const fmtVnd = (n) => (n === null || n === undefined ? '—' : `${Math.round(n).toLocaleString('vi-VN')} ₫`);
export const fmtNum = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('vi-VN'));
export const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN', { hour12: false }) : '—');
