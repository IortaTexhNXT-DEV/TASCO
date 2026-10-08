/**
 * TASCO console — shared UI component library (v2).
 *
 * Every component builds DOM through h() (textContent/attributes only, never innerHTML) and the
 * vendored icon() set, so it is XSS-safe and CSP-strict. Styles live in /css/components.css.
 * Full API reference with examples: docs in scratchpad ux-components.md (kept in sync with this header).
 *
 * Layout      pageHeader, setBreadcrumb, card, kpiStrip, kpiTile, tabs, drawer, modal, confirmDialog,
 *             emptyState, skeleton, loading, banner, technicalDetails
 * Actions     button, iconButton, dropdownMenu, popover, chip
 * Data        dataTable, keyValueList, timeline, stepper, statusChip, badge, avatar, meter, progress,
 *             confidenceMeter, barChart, lineChart, donutChart, sparkline, plateTag
 * Forms       formField, input, textarea, selectInput, switchControl, checkbox, radioGroup, segmented, dateInput
 * Feedback    toast, errorToast, tooltip, infoTip
 * Formatters  formatNumber, formatMoney, formatPercent, formatDate, formatDateTime, formatRelative, formatPlate,
 *             businessLabel
 * Legacy      kpi, table, pager, field, select, pageHead, statusBadge, tierBadge, codeLabel, refCell, trunc
 *             (kept working — new code should use the v2 components above)
 */
import { h, mount, append, shortRef, fmtDate, fmtDateTime } from '../shared/dom.js';
import { t, label, locale } from '../shared/i18n.js';
import { icon } from '../shared/icons.js';

export { icon };
export const businessLabel = label;

let uid = 0;
const nextId = (p = 'ui') => `${p}-${++uid}`;
const NBSP = ' ';
const isNode = (x) => x instanceof Node;
const asArray = (x) => (x === null || x === undefined || x === false ? [] : Array.isArray(x) ? x : [x]);
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* =========================================================================
 * Formatters (UI-language aware: 1,234 en / 1.234 vi; dates always dd/MM/yyyy)
 * ========================================================================= */

/** @param {number|null} n @param {{decimals?: number, compact?: boolean}} [o] */
export function formatNumber(n, { decimals = 0, compact = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(locale(), { maximumFractionDigits: decimals, minimumFractionDigits: compact ? 0 : decimals, notation: compact ? 'compact' : 'standard' });
}
/** Money in VND: "831,600 ₫" (en) / "831.600 ₫" (vi) with a non-breaking space. compact → "1.2B ₫". */
export function formatMoney(n, { compact = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Number(Math.round(n)).toLocaleString(locale(), compact ? { notation: 'compact', maximumFractionDigits: 1 } : {})}${NBSP}₫`;
}
/** 0.234 → "23.4%" (ratio) ; pass {ratio:false} for 23.4 → "23.4%". */
export function formatPercent(v, { decimals = 0, ratio = true } = {}) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return `${Number(ratio ? v * 100 : v).toLocaleString(locale(), { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}%`;
}
/** dd/MM/yyyy (Vietnam time). */
export const formatDate = fmtDate;
/** dd/MM/yyyy HH:mm (Vietnam time). */
export const formatDateTime = fmtDateTime;
/** "2 hours ago" / "2 giờ trước"; "in 3 days". Falls back to dd/MM/yyyy beyond 30 days. */
export function formatRelative(iso, now = Date.now()) {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '—';
  const diff = (ts - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(iso);
}
/**
 * Vietnamese plate display: "30E94935" → "30E-949.35", "30E9493" → "30E-9493", "59X112345" → "59X1-123.45".
 * Already-formatted or unrecognised input is returned unchanged.
 */
export function formatPlate(raw) {
  if (!raw) return '—';
  const compact = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^(\d{2})([A-Z]{1,2}|[A-Z]\d)(\d{4,5})$/.exec(compact);
  if (!m) return String(raw);
  const d = m[3];
  return d.length === 5 ? `${m[1]}${m[2]}-${d.slice(0, 3)}.${d.slice(3)}` : `${m[1]}${m[2]}-${d}`;
}

/* =========================================================================
 * Feedback: toast, errorToast, tooltip, infoTip
 * ========================================================================= */

const TOAST_ICON = { info: 'info', ok: 'check-circle', warn: 'alert-triangle', danger: 'alert-circle' };
const TOAST_KIND = { success: 'ok', error: 'danger', warning: 'warn' };
/**
 * Show a toast. kind: 'info' | 'ok' (success) | 'warn' | 'danger' (error).
 * @param {string} message @param {string} [kind] @param {{title?: string, ref?: string, timeout?: number}} [o]
 */
export function toast(message, kind = 'info', { title, ref, timeout = 6000 } = {}) {
  const k = TOAST_KIND[kind] || kind;
  const box = document.getElementById('toasts') || document.body.appendChild(h('div', { class: 'toasts', id: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const el = h('div', { class: `toast ${k}`, role: k === 'danger' ? 'alert' : 'status' },
    h('span', { class: 'toast-icon' }, icon(TOAST_ICON[k] || 'info', { size: 18 })),
    h('div', { class: 'toast-body' }, title ? h('div', { class: 'toast-title' }, title) : null, h('div', {}, message), ref ? h('span', { class: 'toast-ref' }, ref) : null),
    iconButton({ icon: 'x', label: t('dismiss'), size: 'sm', variant: 'ghost', onClick: () => el.remove() }));
  box.append(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

export function errorToast(err) {
  const details = Array.isArray(err.details) ? ` — ${err.details.slice(0, 3).join('; ')}` : '';
  toast(`${err.message}${details}`, 'danger', { ref: err.requestId ? `Ref. ${err.requestId.slice(0, 8).toUpperCase()}` : undefined });
}

/** Attach a CSS tooltip to an element (also used as its accessible description when it has no text). */
export function tooltip(el, text, { pos } = {}) {
  if (!text) return el;
  el.setAttribute('data-tooltip', text);
  if (pos) el.setAttribute('data-tooltip-pos', pos);
  return el;
}

/** Small (i) button that shows one line of help on hover/focus. */
export function infoTip(text) {
  return tooltip(h('button', { type: 'button', class: 'info-tip', 'aria-label': text }, icon('info', { size: 15 })), text);
}

/* =========================================================================
 * Buttons
 * ========================================================================= */

/**
 * Button. variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'; size: 'sm' | 'md' | 'lg'.
 * Returns the <button>; call btn.setLoading(true|false) for a spinner (keeps width, sets aria-busy).
 * @param {{label: string, variant?: string, size?: string, icon?: string, iconRight?: string, loading?: boolean,
 *          disabled?: boolean, type?: string, onClick?: Function, title?: string, attrs?: object, block?: boolean}} o
 */
export function button({ label: text, variant = 'secondary', size = 'md', icon: ic, iconRight, loading: busy, disabled, type = 'button', onClick, title, attrs = {}, block } = {}) {
  const cls = ['btn', variant, size !== 'md' ? size : null, block ? 'block' : null].filter(Boolean).join(' ');
  const b = h('button', { type, class: cls, disabled: !!disabled, title, ...attrs },
    ic ? icon(ic, { size: size === 'sm' ? 15 : 16 }) : null, text ? h('span', {}, text) : null, iconRight ? icon(iconRight, { size: 15 }) : null);
  if (onClick) {
    b.addEventListener('click', async (e) => {
      const r = onClick(e);
      if (r && typeof r.then === 'function') {
        b.setLoading(true);
        try { await r; } finally { b.setLoading(false); }
      }
    });
  }
  b.setLoading = (on) => { if (on) { b.setAttribute('aria-busy', 'true'); b.disabled = true; } else { b.removeAttribute('aria-busy'); b.disabled = !!disabled; } };
  if (busy) b.setLoading(true);
  return b;
}

/**
 * Icon-only button with aria-label + tooltip. badge: number shown as a red counter (hidden when 0).
 * @param {{icon: string, label: string, onClick?: Function, variant?: string, size?: string, badge?: number, tooltipPos?: string, attrs?: object}} o
 */
export function iconButton({ icon: ic, label: text, onClick, variant = 'ghost', size = 'md', badge: count, tooltipPos, attrs = {}, noTooltip } = {}) {
  const b = h('button', { type: 'button', class: `btn icon-btn ${variant}${size !== 'md' ? ` ${size}` : ''}`, 'aria-label': text, ...attrs, onclick: onClick || null },
    icon(ic, { size: size === 'sm' ? 16 : 18 }));
  if (!noTooltip) tooltip(b, text, { pos: tooltipPos });
  b.setBadge = (n) => {
    b.querySelector('.btn-badge')?.remove();
    if (n) b.append(h('span', { class: 'btn-badge', 'aria-hidden': 'true' }, n > 99 ? '99+' : String(n)));
    b.setAttribute('aria-label', n ? `${text} (${n})` : text);
  };
  if (count) b.setBadge(count);
  return b;
}

/* =========================================================================
 * Badges, chips, avatar
 * ========================================================================= */

/** Neutral/semantic badge. tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'brand'. */
export function badge(text, tone = 'neutral', { icon: ic, dot = false, title } = {}) {
  return h('span', { class: `badge ${tone}`, title }, dot ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : null, ic ? icon(ic, { size: 12 }) : null, text);
}

const STATUS_TONE = {
  active: 'ok', completed: 'ok', done: 'ok', sent: 'ok', won: 'ok', resolved: 'ok', approved: 'ok', paid: 'ok', succeeded: 'ok', converted: 'ok', insured: 'ok', in_force: 'ok', published: 'ok', verified: 'ok',
  open: 'info', scheduled: 'info', claimed: 'info', submitted: 'info', draft: 'neutral', acknowledged: 'info', assessor_assigned: 'info', under_assessment: 'info', running: 'info', processing: 'info', paying: 'info', not_yet_in_force: 'info',
  pending_approval: 'warn', callback: 'warn', pending: 'warn', pending_payment: 'warn', skipped: 'neutral', cancelled: 'neutral', retired: 'neutral', disabled: 'neutral', suspended: 'warn', ended: 'neutral', expired: 'warn', prospect: 'neutral', refunded: 'neutral',
  blocked: 'danger', failed: 'danger', lost: 'danger', rejected: 'danger', dead_letter: 'danger', payment_failed: 'danger', revoked: 'danger',
};
/** Tone for a status code (override/extend with toneFor.map). */
export const statusTone = (status) => STATUS_TONE[status] || 'neutral';

/**
 * Status chip with a dot and the business label (via i18n group, default 'status'); the code stays in the tooltip.
 * @param {string} status @param {string} [group] @param {{tone?: string}} [o]
 */
export function statusChip(status, group = 'status', { tone } = {}) {
  if (status === null || status === undefined || status === '') return h('span', { class: 'muted' }, '—');
  return badge(label(group, status), tone || statusTone(status), { dot: true });
}
/** Legacy alias (kept for existing pages). */
export function statusBadge(status, group = 'status') {
  return statusChip(status, group);
}

export function tierBadge(tier) {
  return h('span', { class: `badge ${tier || 'neutral'}` }, tier ? label('tier', tier) : '—');
}

/** Human label for a business code (legacy; returns a span). */
export function codeLabel(group, code) {
  return h('span', {}, label(group, code));
}

/**
 * Toggle chip (filter chips, quick filters). aria-pressed reflects `selected`.
 * @param {{label: string, selected?: boolean, count?: number, icon?: string, onClick?: Function}} o
 */
export function chip({ label: text, selected = false, count, icon: ic, onClick } = {}) {
  const c = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!selected), onclick: onClick || null },
    ic ? icon(ic, { size: 14 }) : null, text, count !== undefined && count !== null ? h('span', { class: 'chip-count' }, formatNumber(count)) : null);
  return c;
}

/** Initials avatar; colour is stable per name. size: 'sm' | 'md' | 'lg'. */
export function avatar(name, { size = 'md', title } = {}) {
  const words = String(name || '?').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return h('span', { class: `avatar ${size !== 'md' ? size : ''} t${(hash % 6) + 1}`.replace('  ', ' '), 'aria-hidden': title ? null : 'true', title }, initials);
}

/** Licence plate as a compact tag ("30E-949.35"). */
export function plateTag(raw) {
  return h('span', { class: 'plate-tag' }, formatPlate(raw));
}

/* =========================================================================
 * Layout
 * ========================================================================= */

/** Update the top-bar breadcrumb: [{label, href?}] (last item = current page). */
export function setBreadcrumb(items) {
  document.dispatchEvent(new CustomEvent('tasco:breadcrumb', { detail: items }));
}

/**
 * Standard page header. Breadcrumb goes to the top bar (not repeated in the page).
 * @param {{breadcrumb?: Array<{label: string, href?: string}>, title: string|Node, subtitle?: string, actions?: Node[],
 *          meta?: Node[], back?: {href: string, label: string}}} o
 */
export function pageHeader({ breadcrumb, title, subtitle, actions, meta, back } = {}) {
  if (breadcrumb) setBreadcrumb(breadcrumb);
  return h('header', { class: 'page-header' },
    h('div', { class: 'ph-text' },
      back ? h('a', { class: 'ph-back', href: back.href }, icon('chevron-left', { size: 16 }), back.label || t('back')) : null,
      h('h1', { tabindex: '-1', id: 'page-title' }, title),
      subtitle ? h('p', { class: 'ph-sub' }, subtitle) : null,
      meta && asArray(meta).length ? h('div', { class: 'ph-meta' }, meta) : null),
    actions && asArray(actions).filter(Boolean).length ? h('div', { class: 'ph-actions' }, actions) : null);
}

/** Legacy page header: pageHead(title, subtitle, ...actions). */
export function pageHead(title, subtitle, ...actions) {
  return pageHeader({ title, subtitle, actions: actions.flat().filter(Boolean) });
}

/**
 * Card with optional header (title, subtitle, actions), body and footer.
 * @param {{title?: string|Node, subtitle?: string, actions?: Node[], body?: Node|Node[], footer?: Node, flush?: boolean,
 *          class?: string, id?: string, headingLevel?: number}} o
 */
export function card({ title, subtitle, actions, body, footer, flush = false, class: cls = '', id, headingLevel = 2 } = {}) {
  const hid = title ? nextId('card') : null;
  return h('section', { class: `card c2 ${title ? '' : 'no-header'} ${cls}`.replace(/\s+/g, ' ').trim(), id, 'aria-labelledby': hid },
    title ? h('div', { class: 'card-header' },
      h('div', { class: 'grow' }, h(`h${headingLevel}`, { id: hid }, title), subtitle ? h('p', { class: 'card-sub' }, subtitle) : null),
      actions && asArray(actions).length ? h('div', { class: 'card-actions' }, actions) : null) : null,
    h('div', { class: `card-body${flush ? ' flush' : ''}` }, body),
    footer ? h('div', { class: 'card-footer' }, footer) : null);
}

/** Row of KPI tiles that wraps responsively. */
export function kpiStrip(tiles, { label: aria } = {}) {
  return h('section', { class: 'kpi-strip', 'aria-label': aria || null }, tiles);
}

/**
 * KPI tile. delta: {value: string|number, direction: 'up'|'down'|'flat', good?: boolean (default: up is good)}.
 * With onClick the tile is a button (keyboard accessible).
 * @param {{label: string, value: string|number, delta?: object, hint?: string, icon?: string, onClick?: Function, sparkline?: number[], loading?: boolean}} o
 */
export function kpiTile({ label: lab, value, delta, hint, icon: ic, onClick, sparkline: spark, loading: busy } = {}) {
  let deltaEl = null;
  if (delta && delta.value !== undefined && delta.value !== null) {
    const dir = delta.direction || (Number(delta.value) > 0 ? 'up' : Number(delta.value) < 0 ? 'down' : 'flat');
    const good = dir === 'flat' ? null : (delta.good ?? (dir === 'up'));
    deltaEl = h('span', { class: `delta ${good === null ? 'flat' : good ? 'good' : 'bad'}` },
      icon(dir === 'up' ? 'trending-up' : dir === 'down' ? 'trending-down' : 'minus', { size: 12 }), String(delta.value));
  }
  const inner = [
    h('span', { class: 'kpi-label' }, ic ? icon(ic, { size: 16 }) : null, lab),
    busy ? skeleton({ height: 28, width: '60%' }) : h('div', { class: 'kpi-value-row' }, h('span', { class: 'kpi-value' }, value), deltaEl),
    hint ? h('span', { class: 'kpi-hint' }, hint) : null,
    spark && spark.length > 1 ? h('span', { class: 'kpi-spark' }, sparkline(spark)) : null,
  ];
  return onClick ? h('button', { type: 'button', class: 'kpi-tile', onclick: onClick }, inner) : h('div', { class: 'kpi-tile' }, inner);
}

/** Legacy KPI card: kpi(label, value, hint). */
export function kpi(lab, value, hint) {
  return kpiTile({ label: lab, value, hint });
}

/**
 * Empty state: icon + title + one line + optional action.
 * @param {{icon?: string, title: string, text?: string, action?: Node, compact?: boolean}} o
 */
export function emptyState({ icon: ic = 'inbox', title, text, action, compact = false } = {}) {
  return h('div', { class: `empty-state${compact ? ' compact' : ''}` },
    h('span', { class: 'es-icon' }, icon(ic, { size: 22 })),
    h('p', { class: 'es-title' }, title || t('empty')),
    text ? h('p', { class: 'es-text' }, text) : null,
    action ? h('div', { class: 'es-action' }, action) : null);
}

/** Skeleton block(s). lines>1 renders a paragraph placeholder. */
export function skeleton({ width = '100%', height = 12, lines = 1, radius } = {}) {
  const one = (w) => h('div', { class: 'skeleton', style: `width:${typeof w === 'number' ? `${w}px` : w};height:${height}px${radius ? `;border-radius:${radius}px` : ''}`, 'aria-hidden': 'true' });
  if (lines <= 1) return one(width);
  return h('div', { class: 'skeleton-lines', 'aria-hidden': 'true' }, Array.from({ length: lines }, (_, i) => one(i === lines - 1 ? '60%' : width)));
}

/** Full-page loading placeholder (used by the router while a page loads). */
export function loading(el) {
  mount(el, h('div', { 'aria-busy': 'true', 'aria-label': t('loading') },
    h('div', { class: 'page-header' }, h('div', { class: 'ph-text' }, skeleton({ width: 280, height: 28 }), h('div', { style: 'height:8px' }), skeleton({ width: 420, height: 14 }))),
    h('div', { class: 'kpi-strip' }, Array.from({ length: 4 }, () => h('div', { class: 'kpi-tile' }, skeleton({ width: '50%', height: 12 }), skeleton({ width: '70%', height: 26 })))),
    h('div', { class: 'card' }, skeleton({ lines: 6, height: 14 }))));
}

/**
 * Banner / inline alert. tone: 'info' | 'ok' | 'warn' | 'danger'.
 * @param {{tone?: string, title?: string, text?: string|Node, actions?: Node[], dismissible?: boolean, icon?: string}} o
 */
export function banner({ tone = 'info', title, text, actions, dismissible = false, icon: ic } = {}) {
  const el = h('div', { class: `banner ${tone}`, role: tone === 'danger' || tone === 'warn' ? 'alert' : 'status' },
    h('span', { class: 'banner-icon' }, icon(ic || TOAST_ICON[tone] || 'info', { size: 18 })),
    h('div', { class: 'banner-body' },
      title ? h('p', { class: 'banner-title' }, title) : null,
      text ? h(title ? 'p' : 'div', { class: title ? 'banner-text' : '' }, text) : null,
      actions ? h('div', { class: 'banner-actions' }, actions) : null),
    dismissible ? iconButton({ icon: 'x', label: t('dismiss'), size: 'sm', onClick: () => el.remove() }) : null);
  return el;
}

/** Collapsed "Technical details" disclosure (for technical roles only — the caller decides). */
export function technicalDetails(body, { summary = t('technicalDetails'), open = false } = {}) {
  return h('details', { class: 'disclosure', open: open || null }, h('summary', {}, icon('chevron-right', { size: 14 }), summary), h('div', { class: 'disclosure-body' }, body));
}

/* =========================================================================
 * Popover & dropdown menu (positioned fixed, so they never get clipped by tables)
 * ========================================================================= */

let openPopover = null;
/** Close whichever popover/menu is open (the router calls this on navigation). */
export function closePopovers() { openPopover?.close(false); }
function placePopover(pop, anchor, align) {
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = align === 'start' ? r.left : r.right - pw;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

/**
 * Non-modal popover anchored to a trigger button. content: Node or () => Node (rebuilt on each open).
 * Esc / outside click close it and focus returns to the trigger.
 * @returns {{open: Function, close: Function, isOpen: Function}}
 */
export function popover(trigger, content, { align = 'end', role = 'dialog', label: aria, onOpen, onClose, class: cls = '', width } = {}) {
  const id = nextId('pop');
  trigger.setAttribute('aria-haspopup', role === 'menu' ? 'menu' : 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', id);
  let pop = null;
  const api = {
    isOpen: () => !!pop,
    close(restore = true) {
      if (!pop) return;
      pop.remove(); pop = null; openPopover = null;
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      if (restore) trigger.focus();
      onClose?.();
    },
    open() {
      if (openPopover && openPopover !== api) openPopover.close(false);
      if (pop) return;
      pop = h('div', { class: `popover ${cls}`.trim(), id, role, 'aria-label': aria || null, tabindex: '-1' }, typeof content === 'function' ? content(api) : content);
      if (width) pop.style.width = `${width}px`;
      pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); api.close(); } });
      document.body.append(pop);
      placePopover(pop, trigger, align);
      openPopover = api;
      trigger.setAttribute('aria-expanded', 'true');
      setTimeout(() => document.addEventListener('mousedown', outside, true));
      window.addEventListener('resize', onWin);
      window.addEventListener('scroll', onWin, true);
      onOpen?.(pop);
    },
    get el() { return pop; },
  };
  function outside(e) { if (pop && !pop.contains(e.target) && !trigger.contains(e.target)) api.close(false); }
  function onWin(e) {
    if (!pop) return;
    if (e?.type === 'scroll') { if (!pop.contains(e.target)) placePopover(pop, trigger, align); return; }
    api.close(false);
  }
  trigger.addEventListener('click', (e) => { e.stopPropagation(); if (pop) api.close(); else api.open(); });
  trigger.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop) api.close(); });
  return api;
}

/**
 * Dropdown menu (ARIA menu pattern: arrows, Home/End, Esc, Tab closes).
 * items: [{label, icon?, onClick?, href?, danger?, disabled?, description?} | {heading} | {separator: true} |
 *         {label, checked: bool, onClick} (menuitemradio) | {node}]
 * @returns popover api
 */
export function dropdownMenu(trigger, items, { align = 'end', label: aria, width } = {}) {
  const build = (api) => {
    const menu = h('div', { class: 'menu' });
    const list = typeof items === 'function' ? items() : items;
    for (const it of list) {
      if (!it) continue;
      if (it.separator) { menu.append(h('div', { role: 'separator' })); continue; }
      if (it.heading) { menu.append(h('div', { class: 'menu-heading', role: 'presentation' }, it.heading)); continue; }
      if (it.node) { menu.append(it.node); continue; }
      const role = it.checked !== undefined ? 'menuitemradio' : 'menuitem';
      const el = h(it.href ? 'a' : 'button', {
        role, class: it.danger ? 'danger' : null, tabindex: '-1', href: it.href || null, type: it.href ? null : 'button',
        'aria-checked': it.checked !== undefined ? String(!!it.checked) : null, 'aria-disabled': it.disabled ? 'true' : null,
      }, it.icon ? icon(it.icon, { size: 16 }) : null,
      h('span', { class: 'menu-label' }, it.label, it.description ? h('span', { class: 'menu-desc' }, it.description) : null),
      it.checked !== undefined ? h('span', { class: 'menu-check' }, icon('check', { size: 16 })) : null);
      el.addEventListener('click', (e) => {
        if (it.disabled) { e.preventDefault(); return; }
        api.close(!it.href);
        it.onClick?.(e);
      });
      menu.append(el);
    }
    menu.addEventListener('keydown', (e) => {
      const els = [...menu.querySelectorAll('[role^="menuitem"]:not([aria-disabled="true"])')];
      const i = els.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
      else if (e.key === 'Tab') { api.close(false); }
    });
    return menu;
  };
  return popover(trigger, build, {
    align, role: 'menu', label: aria, width,
    onOpen: (pop) => (pop.querySelector('[role^="menuitem"][aria-checked="true"]') || pop.querySelector('[role^="menuitem"]'))?.focus(),
  });
}

/* =========================================================================
 * Drawer & modal
 * ========================================================================= */

function trapFocus(container, e) {
  if (e.key !== 'Tab') return;
  const els = [...container.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
  if (!els.length) { e.preventDefault(); return; }
  const first = els[0];
  const last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/**
 * Right-side drawer (modal): focus trap, Esc and backdrop close, focus restored to the opener.
 * size: 'sm' (400) | 'md' (480) | 'lg' (720).
 * @param {{title: string, subtitle?: string, body?: Node|Node[], footer?: Node[], size?: string, onClose?: Function, headerExtra?: Node}} o
 * @returns {{el: HTMLElement, body: HTMLElement, close: Function, setBody: Function, setFooter: Function}}
 */
export function drawer({ title, subtitle, body, footer, size = 'md', onClose, headerExtra } = {}) {
  const opener = document.activeElement;
  const tid = nextId('drawer');
  const bodyEl = h('div', { class: 'drawer-body' }, body);
  const footEl = h('div', { class: 'drawer-footer' }, footer);
  if (!footer) footEl.hidden = true;
  const backdrop = h('div', { class: 'backdrop', onclick: () => close() });
  const el = h('aside', { class: `drawer ${size}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': tid },
    h('div', { class: 'drawer-header' },
      h('div', { class: 'drawer-titles' }, h('h2', { id: tid }, title), subtitle ? h('p', { class: 'drawer-sub' }, subtitle) : null),
      headerExtra || null,
      iconButton({ icon: 'x', label: t('close'), onClick: () => close(), noTooltip: true })),
    bodyEl, footEl);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else trapFocus(el, e); });
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    el.setAttribute('data-open', 'false');
    backdrop.remove();
    setTimeout(() => el.remove(), 200);
    if (opener && opener.focus && document.contains(opener)) opener.focus();
    onClose?.();
  }
  document.body.append(backdrop, el);
  requestAnimationFrame(() => {
    el.setAttribute('data-open', 'true');
    (bodyEl.querySelector(FOCUSABLE) || el.querySelector('.drawer-header button'))?.focus();
  });
  return { el, body: bodyEl, close, setBody: (...n) => mount(bodyEl, ...n), setFooter: (...n) => { mount(footEl, ...n); footEl.hidden = !n.flat().filter(Boolean).length; } };
}

/**
 * Modal dialog built on native <dialog> (focus trap + Esc by the browser).
 * actions: buttons for the footer. dismissible=false blocks Esc/close (forced flows).
 * @param {{title: string, body?: Node|Node[], actions?: Node[], size?: string, onClose?: Function, dismissible?: boolean}} o
 * @returns {{el: HTMLDialogElement, close: Function}}
 */
export function modal({ title, body, actions, size = 'md', onClose, dismissible = true } = {}) {
  const tid = nextId('modal');
  const dlg = h('dialog', { class: `modal ${size}`, 'aria-labelledby': tid },
    h('div', { class: 'modal-header' }, h('h2', { id: tid }, title), dismissible ? iconButton({ icon: 'x', label: t('close'), size: 'sm', onClick: () => dlg.close(), noTooltip: true }) : null),
    h('div', { class: 'modal-body' }, body),
    actions && asArray(actions).length ? h('div', { class: 'modal-footer' }, actions) : null);
  if (!dismissible) dlg.addEventListener('cancel', (e) => e.preventDefault());
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  document.body.append(dlg);
  dlg.showModal();
  return { el: dlg, close: () => dlg.close() };
}

/** Confirm dialog → Promise<boolean>. */
export function confirmDialog(title, message, confirmLabel = t('confirm'), { danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const m = modal({
      title, size: 'sm', body: h('p', {}, message), onClose: () => resolve(result),
      actions: [
        button({ label: t('cancel'), onClick: () => m.close() }),
        button({ label: confirmLabel, variant: danger ? 'danger solid' : 'primary', onClick: () => { result = true; m.close(); } }),
      ],
    });
  });
}

/* =========================================================================
 * Tabs
 * ========================================================================= */

/**
 * Tabs (ARIA tabs pattern with roving tabindex; ←/→/Home/End). Each item may provide render(panel) — then the
 * component manages the panel; otherwise handle onChange(id) yourself.
 * @param {{items: Array<{id: string, label: string, count?: number, icon?: string, render?: Function}>, active?: string, onChange?: Function, label?: string}} o
 * @returns {HTMLElement} wrapper with .select(id) and .panel
 */
export function tabs({ items, active, onChange, label: aria } = {}) {
  const base = nextId('tabs');
  let current = active || items[0]?.id;
  const panel = h('div', { class: 'tab-panel', role: 'tabpanel', tabindex: '0' });
  const btns = items.map((it) => h('button', { type: 'button', role: 'tab', id: `${base}-${it.id}`, 'aria-controls': `${base}-panel` },
    it.icon ? icon(it.icon, { size: 16 }) : null, it.label, it.count !== undefined && it.count !== null ? h('span', { class: 'tab-count' }, formatNumber(it.count)) : null));
  panel.id = `${base}-panel`;
  const list = h('div', { class: 'tabs', role: 'tablist', 'aria-label': aria || null }, btns);
  const wrap = h('div', { class: 'tabs-wrap' }, list, panel);
  function select(id, focus = false) {
    current = id;
    btns.forEach((b, i) => {
      const on = items[i].id === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) { panel.setAttribute('aria-labelledby', b.id); if (focus) b.focus(); }
    });
    const it = items.find((x) => x.id === id);
    if (it?.render) { mount(panel); const r = it.render(panel); if (r && !r.then && isNode(r)) panel.append(r); }
    onChange?.(id);
  }
  btns.forEach((b, i) => b.addEventListener('click', () => select(items[i].id)));
  list.addEventListener('keydown', (e) => {
    const i = items.findIndex((x) => x.id === current);
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = items.length - 1;
    if (n !== null) { e.preventDefault(); select(items[n].id, true); }
  });
  wrap.select = select;
  wrap.panel = panel;
  // initial state without firing onChange
  btns.forEach((b, i) => { const on = items[i].id === current; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on) panel.setAttribute('aria-labelledby', b.id); });
  const first = items.find((x) => x.id === current);
  if (first?.render) { const r = first.render(panel); if (r && !r.then && isNode(r)) panel.append(r); }
  return wrap;
}

/* =========================================================================
 * Forms
 * ========================================================================= */

/**
 * Form field: label above, control, one-line help, inline error. Wires id/for, aria-describedby, aria-invalid.
 * @param {{label: string, control: HTMLElement, help?: string, error?: string, required?: boolean, optional?: boolean, info?: string, id?: string}} o
 * @returns {HTMLElement} .field with setError(msg)
 */
export function formField({ label: lab, control, help, error, required = false, optional = false, info, id } = {}) {
  const cid = id || control.id || nextId('f');
  control.id = cid;
  const helpId = `${cid}-help`;
  const errId = `${cid}-err`;
  const errEl = h('div', { class: 'error', id: errId, role: 'alert' });
  if (required) control.setAttribute('aria-required', 'true');
  control.setAttribute('aria-describedby', [help ? helpId : null, errId].filter(Boolean).join(' '));
  const el = h('div', { class: 'field' },
    h('label', { for: cid }, lab, required ? h('span', { class: 'req', 'aria-hidden': 'true' }, '*') : null, required ? h('span', { class: 'sr-only' }, ` (${t('required')})`) : null,
      optional ? h('span', { class: 'opt' }, `(${t('optional')})`) : null, info ? infoTip(info) : null),
    control,
    help ? h('span', { class: 'help', id: helpId }, help) : null,
    errEl);
  el.setError = (msg) => {
    mount(errEl, msg ? [icon('alert-circle', { size: 14 }), msg] : null);
    if (msg) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid');
  };
  if (error) el.setError(error);
  return el;
}

/** Legacy field(label, input, help). */
export function field(lab, input, help) {
  return formField({ label: lab, control: input, help });
}

/** Text input. Pass any attributes ({type, value, placeholder, …}); icon adds a leading icon. */
export function input({ icon: ic, size, ...attrs } = {}) {
  const el = h('input', { type: 'text', class: size === 'sm' ? 'sm' : null, ...attrs });
  if (!ic) return el;
  const wrap = h('div', { class: 'input-group' }, icon(ic, { size: 16 }), el);
  wrap.input = el;
  return wrap;
}

export function textarea(attrs = {}) {
  const { value, ...rest } = attrs;
  const el = h('textarea', rest);
  if (value !== undefined) el.value = value;
  return el;
}

/**
 * Select. options: [[value, label]] or [{value, label, disabled}].
 * @returns {HTMLSelectElement}
 */
export function selectInput(options, value, attrs = {}) {
  return h('select', attrs, options.map((o) => {
    const [v, l, dis] = Array.isArray(o) ? o : [o.value, o.label, o.disabled];
    return h('option', { value: v, selected: String(v) === String(value ?? ''), disabled: !!dis }, l);
  }));
}
/** Legacy select(options, value, attrs). */
export const select = selectInput;

/** Switch (checkbox with role="switch"). Returns the label; .input is the checkbox. */
export function switchControl({ label: lab, checked = false, onChange, disabled = false, id } = {}) {
  const inp = h('input', { type: 'checkbox', role: 'switch', id: id || nextId('sw'), checked: !!checked, disabled: !!disabled });
  if (onChange) inp.addEventListener('change', () => onChange(inp.checked));
  const el = h('label', { class: 'switch', for: inp.id }, inp, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), lab ? h('span', {}, lab) : null);
  el.input = inp;
  return el;
}

/** Checkbox with label (+ optional one-line description). Returns the label; .input is the checkbox. */
export function checkbox({ label: lab, checked = false, onChange, name, value, description, disabled } = {}) {
  const inp = h('input', { type: 'checkbox', name, value, checked: !!checked, disabled: !!disabled });
  if (onChange) inp.addEventListener('change', () => onChange(inp.checked));
  const el = h('label', { class: 'check' }, inp, h('span', {}, lab, description ? h('span', { class: 'check-desc' }, description) : null));
  el.input = inp;
  return el;
}

/**
 * Radio group in a fieldset. options: [[value, label, description?]] or [{value, label, description}].
 * @returns {HTMLFieldSetElement} with .value getter
 */
export function radioGroup({ name = nextId('rg'), legend, options, value, onChange, inline = false } = {}) {
  const fs = h('fieldset', { class: 'plain' }, legend ? h('legend', {}, legend) : null,
    h('div', { class: `radio-group${inline ? ' inline' : ''}` }, options.map((o) => {
      const [v, l, d] = Array.isArray(o) ? o : [o.value, o.label, o.description];
      const inp = h('input', { type: 'radio', name, value: v, checked: String(v) === String(value) });
      inp.addEventListener('change', () => { if (inp.checked) onChange?.(v); });
      return h('label', { class: 'check' }, inp, h('span', {}, l, d ? h('span', { class: 'check-desc' }, d) : null));
    })));
  Object.defineProperty(fs, 'value', { get: () => fs.querySelector('input:checked')?.value ?? null });
  return fs;
}

/**
 * Segmented control (radiogroup of buttons; arrow keys move selection).
 * options: [[value, label, icon?]] or [{value, label, icon}]
 */
export function segmented({ options, value, onChange, label: aria } = {}) {
  let current = value;
  const opts = options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1], icon: o[2] } : o));
  const btns = opts.map((o) => h('button', { type: 'button', role: 'radio' }, o.icon ? icon(o.icon, { size: 14 }) : null, o.label));
  const el = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': aria || null }, btns);
  const sync = () => btns.forEach((b, i) => { const on = opts[i].value === current; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  const set = (v, focus) => { current = v; sync(); if (focus) btns[opts.findIndex((o) => o.value === v)]?.focus(); onChange?.(v); };
  btns.forEach((b, i) => b.addEventListener('click', () => set(opts[i].value)));
  el.addEventListener('keydown', (e) => {
    const i = opts.findIndex((o) => o.value === current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); set(opts[(i + 1) % opts.length].value, true); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); set(opts[(i - 1 + opts.length) % opts.length].value, true); }
  });
  if (!opts.some((o) => o.value === current)) current = opts[0]?.value;
  sync();
  Object.defineProperty(el, 'value', { get: () => current });
  return el;
}

/**
 * Date input in dd/MM/yyyy (auto-inserts slashes, validates on blur).
 * value / onChange use ISO yyyy-mm-dd (or null). Returns the <input>; read .isoValue.
 */
export function dateInput({ value, onChange, id, required, placeholder = t('dateHint') } = {}) {
  const toDisplay = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const parse = (s) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s).trim());
    if (!m) return null;
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
  };
  const el = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder, id, maxlength: '10', required: !!required, value: toDisplay(value) });
  el.addEventListener('input', () => {
    const digits = el.value.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    el.value = parts.join('/');
  });
  el.addEventListener('blur', () => {
    if (!el.value) { el.removeAttribute('aria-invalid'); el.closest('.field')?.setError?.(''); onChange?.(null); return; }
    const iso = parse(el.value);
    if (!iso) { el.setAttribute('aria-invalid', 'true'); el.closest('.field')?.setError?.(t('invalidDate')); return; }
    el.removeAttribute('aria-invalid');
    el.closest('.field')?.setError?.('');
    onChange?.(iso);
  });
  Object.defineProperty(el, 'isoValue', { get: () => parse(el.value) });
  return el;
}

/* =========================================================================
 * Data display
 * ========================================================================= */

/**
 * Key–value list (definition list). items: [[label, value]] or [{label, value, info}]. columns: 1–3.
 */
export function keyValueList(items, { columns = 2, inline = false } = {}) {
  return h('dl', { class: `kv-list cols-${columns}${inline ? ' inline' : ''}` }, items.filter(Boolean).map((it) => {
    const [l, v, info] = Array.isArray(it) ? it : [it.label, it.value, it.info];
    return h('div', {}, h('dt', {}, l, info ? infoTip(info) : null), h('dd', {}, v === null || v === undefined || v === '' ? '—' : v));
  }));
}

/**
 * Activity timeline. items: [{title, meta?, time? (ISO → relative + exact in tooltip), icon?, tone?: ok|warn|danger|info, body?}]
 */
export function timeline(items, { empty } = {}) {
  if (!items.length) return emptyState({ icon: 'history', title: empty || t('empty'), compact: true });
  return h('ol', { class: 'tl' }, items.map((it) => h('li', { class: `tl-item ${it.tone || ''}`.trim() },
    h('span', { class: 'tl-marker', 'aria-hidden': 'true' }, icon(it.icon || 'circle-dot', { size: 16 })),
    h('div', { class: 'tl-content' },
      h('p', { class: 'tl-title' }, it.title),
      it.meta || it.time ? h('div', { class: 'tl-meta' }, it.meta || null, it.meta && it.time ? ' · ' : null,
        it.time ? h('time', { datetime: it.time, title: fmtDateTime(it.time) }, formatRelative(it.time)) : null) : null,
      it.body ? h('div', { class: 'tl-body' }, it.body) : null))));
}

/**
 * Stepper (workflow). steps: [{label, description?}] or strings; current: index of the active step;
 * error: index of a failed/rejected step.
 */
export function stepper(steps, { current = 0, error = null, label: aria } = {}) {
  return h('ol', { class: 'stepper', 'aria-label': aria || null }, steps.map((s, i) => {
    const st = typeof s === 'string' ? { label: s } : s;
    const state = error === i ? 'error' : i < current ? 'complete' : i === current ? 'current' : 'upcoming';
    return h('li', { class: state, 'aria-current': state === 'current' ? 'step' : null },
      h('span', { class: 'step-marker' }, state === 'complete' ? icon('check', { size: 14, strokeWidth: 2.5 }) : state === 'error' ? icon('x', { size: 14, strokeWidth: 2.5 }) : String(i + 1)),
      h('span', { class: 'step-text' }, st.label, st.description ? h('span', { class: 'step-desc' }, st.description) : null));
  }));
}

/**
 * Meter with label and value. tone: 'ok' | 'warn' | 'danger' | 'brand' | (default teal).
 * @param {{value: number, max?: number, label?: string, valueText?: string, tone?: string}} o
 */
export function meter({ value, max = 100, label: lab, valueText, tone = '' } = {}) {
  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100 || 0));
  return h('div', { class: `meter ${tone}`.trim() },
    lab || valueText ? h('div', { class: 'meter-head' }, h('span', {}, lab || ''), h('span', { class: 'meter-value' }, valueText ?? formatNumber(value))) : null,
    h('div', { class: 'meter-track', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(value), 'aria-label': lab || null },
      h('span', { class: 'meter-fill', style: `width:${pct.toFixed(1)}%` })));
}
/** Progress bar (role=progressbar). */
export function progress({ value, max = 100, label: lab, tone = 'brand' } = {}) {
  const m = meter({ value, max, label: lab, valueText: formatPercent(value / max), tone });
  m.querySelector('.meter-track').setAttribute('role', 'progressbar');
  return m;
}

/**
 * Data confidence as a 5-segment meter + label (High ≥ 80%, Medium ≥ 50%, Low).
 * value: 0..1 or 0..100.
 */
export function confidenceMeter(value, { showLabel = true } = {}) {
  if (value === null || value === undefined) return h('span', { class: 'muted' }, '—');
  const v = value > 1 ? value / 100 : value;
  const level = v >= 0.8 ? 'high' : v >= 0.5 ? 'medium' : 'low';
  const on = Math.max(1, Math.round(v * 5));
  const text = `${t('confidence')}: ${t(level === 'high' ? 'confidenceHigh' : level === 'medium' ? 'confidenceMedium' : 'confidenceLow')} (${formatPercent(v)})`;
  return h('span', { class: `confidence ${level}`, role: 'img', 'aria-label': text, title: text },
    h('span', { class: 'segs', 'aria-hidden': 'true' }, Array.from({ length: 5 }, (_, i) => h('span', { class: `seg${i < on ? ' on' : ''}` }))),
    showLabel ? h('span', { 'aria-hidden': 'true' }, t(level === 'high' ? 'confidenceHigh' : level === 'medium' ? 'confidenceMedium' : 'confidenceLow')) : null);
}

/* =========================================================================
 * DataTable
 * ========================================================================= */

const cellText = (v) => (v === null || v === undefined ? '' : isNode(v) ? v.textContent : Array.isArray(v) ? v.map(cellText).join(' ') : String(v));
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** Download rows as CSV (UTF-8 with BOM so Excel shows Vietnamese correctly). */
export function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Data table in a card: toolbar (search, filters, export), sortable headers, row actions (kebab), selection + bulk
 * actions, pagination, empty & loading states.
 *
 * Client mode (default): sorting, search and paging happen in the browser over `rows`.
 * Server mode: pass `pagination.total` + `onPage`, `sort.onSort`, `toolbar.search.onSearch` and re-render with new rows.
 *
 * @param {object} o
 * @param {Array<{key: string, label: string, align?: 'left'|'right'|'center', sortable?: boolean, render?: (row) => any,
 *         value?: (row) => any, width?: string, nowrap?: boolean, exportValue?: (row) => any, primary?: boolean}>} o.columns
 * @param {object[]} o.rows
 * @param {(row) => string} [o.rowKey]
 * @param {(row) => void} [o.onRowClick]
 * @param {(row) => Array<object>} [o.rowActions]  dropdownMenu items for a kebab button per row
 * @param {{search?: boolean|{placeholder?: string, value?: string, onSearch?: Function}, filters?: Node[], export?: boolean|{filename?: string, onExport?: Function}, actions?: Node[]}} [o.toolbar]
 * @param {{total?: number, limit?: number, offset?: number, onPage?: Function, onLimit?: Function, limits?: number[], pageSize?: number}|false} [o.pagination]
 * @param {{key?: string, dir?: 'asc'|'desc', onSort?: Function}} [o.sort]
 * @param {{selectable?: boolean, bulkActions?: Array<{label: string, icon?: string, onClick: (rows) => void}>}} [o.selection]
 * @param {{icon?: string, title?: string, text?: string, action?: Node}} [o.empty]
 * @param {boolean} [o.loading]
 * @param {string} [o.caption]  accessible caption (visually hidden)
 * @returns {HTMLElement} with .update(partial) to re-render with new rows/loading/pagination
 */
export function dataTable(o) {
  const opts = { rowKey: (r) => r.id, pagination: { pageSize: 25 }, ...o };
  const state = {
    sortKey: opts.sort?.key || null, sortDir: opts.sort?.dir || 'asc', q: (typeof opts.toolbar?.search === 'object' && opts.toolbar.search.value) || '',
    page: 0, pageSize: opts.pagination?.pageSize || opts.pagination?.limit || 25, selected: new Set(),
  };
  const root = h('div', { class: 'data-table' });
  const server = !!(opts.pagination && opts.pagination.onPage);
  const serverSort = !!opts.sort?.onSort;
  const serverSearch = typeof opts.toolbar?.search === 'object' && !!opts.toolbar.search.onSearch;
  const colVal = (c, r) => (c.value ? c.value(r) : r[c.key]);
  const alignCls = (c) => [c.align === 'right' ? 'num' : c.align === 'center' ? 'align-center' : null, c.nowrap ? 'nowrap' : null].filter(Boolean).join(' ') || null;
  let searchTimer = null;

  function visibleRows() {
    let rows = opts.rows || [];
    if (state.q && !serverSearch) {
      const q = state.q.toLowerCase();
      rows = rows.filter((r) => opts.columns.some((c) => cellText(c.value ? c.value(r) : c.render ? c.render(r) : r[c.key]).toLowerCase().includes(q)));
    }
    if (state.sortKey && !serverSort) {
      const c = opts.columns.find((x) => x.key === state.sortKey);
      if (c) {
        const s = state.sortDir === 'desc' ? -1 : 1;
        rows = [...rows].sort((a, b) => {
          const av = colVal(c, a); const bv = colVal(c, b);
          if (av === bv) return 0;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), locale())) * s;
        });
      }
    }
    return rows;
  }

  function toolbar() {
    const tb = opts.toolbar;
    if (!tb) return null;
    const parts = [];
    if (tb.search) {
      const so = typeof tb.search === 'object' ? tb.search : {};
      const inp = h('input', { type: 'search', placeholder: so.placeholder || t('search'), 'aria-label': so.placeholder || t('search'), value: state.q });
      inp.addEventListener('input', () => {
        state.q = inp.value; state.page = 0;
        clearTimeout(searchTimer);
        if (serverSearch) searchTimer = setTimeout(() => so.onSearch(state.q), 300);
        else { renderBody(); }
      });
      parts.push(h('div', { class: 'dt-search input-group' }, icon('search', { size: 16 }), inp));
    }
    if (tb.filters && asArray(tb.filters).length) parts.push(h('div', { class: 'dt-filters' }, tb.filters));
    parts.push(h('span', { class: 'dt-spacer' }));
    if (tb.actions) parts.push(...asArray(tb.actions));
    if (tb.export) {
      parts.push(button({ label: t('exportCsv'), icon: 'download', size: 'sm', onClick: () => {
        if (typeof tb.export === 'object' && tb.export.onExport) return tb.export.onExport();
        const cols = opts.columns.filter((c) => c.label && c.key !== '_actions');
        downloadCsv((typeof tb.export === 'object' && tb.export.filename) || 'export.csv', cols.map((c) => c.label),
          visibleRows().map((r) => cols.map((c) => (c.exportValue ? c.exportValue(r) : cellText(c.render ? c.render(r) : r[c.key])))));
        return undefined;
      } }));
    }
    return h('div', { class: 'dt-toolbar' }, parts);
  }

  const bulkBar = h('div', { class: 'dt-bulk', hidden: true });
  const body = h('div', {});
  function renderBulk() {
    const n = state.selected.size;
    bulkBar.hidden = !n;
    if (!n) return;
    const rows = (opts.rows || []).filter((r) => state.selected.has(opts.rowKey(r)));
    mount(bulkBar, h('span', {}, t('selectedCount', formatNumber(n))), h('span', { class: 'dt-spacer grow' }),
      (opts.selection?.bulkActions || []).map((a) => button({ label: a.label, icon: a.icon, size: 'sm', onClick: () => a.onClick(rows) })),
      button({ label: t('clearSelection'), size: 'sm', variant: 'ghost', onClick: () => { state.selected.clear(); renderBody(); } }));
  }

  function header(rowsOnPage) {
    const sel = opts.selection?.selectable;
    const allOn = sel && rowsOnPage.length && rowsOnPage.every((r) => state.selected.has(opts.rowKey(r)));
    return h('thead', {}, h('tr', {},
      sel ? h('th', { class: 'select-cell', scope: 'col' }, h('input', { type: 'checkbox', 'aria-label': t('selectAll'), checked: !!allOn, onchange: (e) => {
        rowsOnPage.forEach((r) => (e.target.checked ? state.selected.add(opts.rowKey(r)) : state.selected.delete(opts.rowKey(r))));
        renderBody();
      } })) : null,
      opts.columns.map((c) => {
        const cls = [alignCls(c), c.sortable ? 'sortable' : null].filter(Boolean).join(' ') || null;
        const ariaSort = state.sortKey === c.key ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : null;
        const th = h('th', { scope: 'col', class: cls, 'aria-sort': ariaSort, style: c.width ? `width:${c.width}` : null });
        if (!c.sortable) { append(th, c.label ? c.label : h('span', { class: 'sr-only' }, t('moreActions'))); return th; }
        const ic = state.sortKey === c.key ? (state.sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down';
        append(th, h('button', { type: 'button', class: 'sort-btn', onclick: () => {
          if (state.sortKey === c.key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          else { state.sortKey = c.key; state.sortDir = c.align === 'right' ? 'desc' : 'asc'; }
          state.page = 0;
          if (serverSort) opts.sort.onSort(state.sortKey, state.sortDir);
          else renderBody();
        } }, c.label, icon(ic, { size: 14 })));
        return th;
      }),
      opts.rowActions ? h('th', { scope: 'col', class: 'actions-cell' }, h('span', { class: 'sr-only' }, t('moreActions'))) : null));
  }

  function footer(total) {
    const p = opts.pagination;
    if (!p) return null;
    const limit = server ? (p.limit || state.pageSize) : state.pageSize;
    const offset = server ? (p.offset || 0) : state.page * state.pageSize;
    if (!total) return null;
    const from = offset + 1;
    const to = Math.min(offset + limit, total);
    const limits = p.limits || [10, 25, 50, 100];
    const sizeSel = selectInput(limits.map((n) => [String(n), String(n)]), String(limit), { 'aria-label': t('rowsPerPage') });
    sizeSel.addEventListener('change', () => {
      const n = Number(sizeSel.value);
      if (server) (p.onLimit || (() => {}))(n);
      else { state.pageSize = n; state.page = 0; renderBody(); }
    });
    const go = (off) => { if (server) p.onPage(off); else { state.page = Math.floor(off / state.pageSize); renderBody(); } };
    return h('nav', { class: 'dt-footer', 'aria-label': t('page') },
      (server && !p.onLimit) ? null : h('label', { class: 'row tight' }, h('span', {}, t('rowsPerPage')), sizeSel),
      h('span', { class: 'dt-range' }, t('rangeOf', formatNumber(from), formatNumber(to), formatNumber(total))),
      h('div', { class: 'row tight' },
        iconButton({ icon: 'chevron-left', label: t('previous'), size: 'sm', variant: 'secondary', attrs: { disabled: offset === 0 }, onClick: () => go(Math.max(0, offset - limit)) }),
        iconButton({ icon: 'chevron-right', label: t('next'), size: 'sm', variant: 'secondary', attrs: { disabled: offset + limit >= total }, onClick: () => go(offset + limit) })));
  }

  function renderBody() {
    const cols = opts.columns.length + (opts.selection?.selectable ? 1 : 0) + (opts.rowActions ? 1 : 0);
    if (opts.loading) {
      mount(body, h('div', { class: 'table-wrap' }, h('table', {}, header([]),
        h('tbody', {}, Array.from({ length: 6 }, () => h('tr', { class: 'skeleton-row' }, Array.from({ length: cols }, (_, i) => h('td', {}, skeleton({ width: i === 0 ? '70%' : '50%' })))))))));
      return;
    }
    const all = visibleRows();
    const total = server ? (opts.pagination.total ?? all.length) : all.length;
    const pageRows = server || !opts.pagination ? all : all.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize);
    if (!pageRows.length) {
      const e = opts.empty || {};
      mount(body, h('div', { class: 'dt-empty' }, emptyState(state.q ? { icon: 'search', title: t('noResults'), text: t('noResultsHint'), compact: true } : { icon: e.icon || 'inbox', title: e.title || t('empty'), text: e.text, action: e.action, compact: true })));
      renderBulk();
      return;
    }
    const tbody = h('tbody', {}, pageRows.map((r) => {
      const key = opts.rowKey(r);
      const tr = h('tr', { class: opts.onRowClick ? 'clickable' : null, 'aria-selected': opts.selection?.selectable ? String(state.selected.has(key)) : null },
        opts.selection?.selectable ? h('td', { class: 'select-cell' }, h('input', { type: 'checkbox', 'aria-label': t('selectRow'), checked: state.selected.has(key), onclick: (e) => e.stopPropagation(), onchange: (e) => {
          if (e.target.checked) state.selected.add(key); else state.selected.delete(key);
          tr.setAttribute('aria-selected', String(e.target.checked));
          renderBulk();
        } })) : null,
        opts.columns.map((c) => {
          const v = c.render ? c.render(r) : r[c.key];
          return h('td', { class: [alignCls(c), c.primary ? 'cell-primary' : null].filter(Boolean).join(' ') || null }, v === null || v === undefined || v === '' ? '—' : v);
        }),
        opts.rowActions ? h('td', { class: 'actions-cell' }, (() => {
          const items = opts.rowActions(r);
          if (!items || !items.length) return null;
          const b = iconButton({ icon: 'more-horizontal', label: t('moreActions'), size: 'sm', noTooltip: true });
          b.addEventListener('click', (e) => e.stopPropagation());
          dropdownMenu(b, items, { label: t('moreActions') });
          return b;
        })()) : null);
      if (opts.onRowClick) {
        tr.tabIndex = 0;
        tr.addEventListener('click', (e) => { if (!e.target.closest('button, a, input, select, label')) opts.onRowClick(r); });
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === tr) opts.onRowClick(r); });
      }
      return tr;
    }));
    mount(body, h('div', { class: 'table-wrap' }, h('table', {}, opts.caption ? h('caption', { class: 'sr-only' }, opts.caption) : null, header(pageRows), tbody)), footer(total));
    renderBulk();
  }

  function render() {
    mount(root, toolbar(), bulkBar, body);
    renderBody();
  }
  root.update = (partial = {}) => { Object.assign(opts, partial); if (partial.rows) state.selected.clear(); renderBody(); };
  root.getSelected = () => (opts.rows || []).filter((r) => state.selected.has(opts.rowKey(r)));
  render();
  return root;
}

/** Legacy accessible table: table(columns [{label, render, num, nowrap, cls}], rows, {onRowClick, caption}). */
export function table(columns, rows, { onRowClick, caption } = {}) {
  if (!rows.length) return emptyState({ title: t('empty'), compact: true });
  const cellClass = (c) => [c.num ? 'num' : null, c.nowrap ? 'nowrap' : null, c.cls || null].filter(Boolean).join(' ') || null;
  return h('div', { class: 'table-wrap' },
    h('table', {},
      caption ? h('caption', { class: 'sr-only' }, caption) : null,
      h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col', class: cellClass(c) }, c.label)))),
      h('tbody', {}, rows.map((r) => {
        const tr = h('tr', { class: onRowClick ? 'clickable' : null }, columns.map((c) => h('td', { class: cellClass(c) }, c.render(r))));
        if (onRowClick) {
          tr.tabIndex = 0;
          tr.addEventListener('click', (e) => { if (!e.target.closest('button, a, input, select')) onRowClick(r); });
          tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === tr) onRowClick(r); });
        }
        return tr;
      }))));
}

/** Legacy pager({total, limit, offset, onPage}) → "1–25 of 2,223  ‹ ›". */
export function pager({ total, limit, offset, onPage }) {
  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + limit, total);
  return h('nav', { class: 'pager', 'aria-label': t('page') },
    h('span', { class: 'muted' }, t('rangeOf', formatNumber(from), formatNumber(to), formatNumber(total))),
    h('div', { class: 'row tight' },
      button({ label: t('previous'), icon: 'chevron-left', size: 'sm', disabled: offset === 0, onClick: () => onPage(Math.max(0, offset - limit)) }),
      button({ label: t('next'), iconRight: 'chevron-right', size: 'sm', disabled: offset + limit >= total, onClick: () => onPage(offset + limit) })));
}

/** Readable short reference + copy button (technical contexts only). */
export function refCell(id) {
  if (!id) return '—';
  const btn = h('button', { class: 'btn ghost copy', type: 'button', 'aria-label': `${t('copy')} ${id}`, onclick: async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(id); toast(t('copied'), 'ok'); } catch { toast(id); }
  } }, icon('copy', { size: 14 }));
  tooltip(btn, t('copy'));
  return h('span', { class: 'ref' }, h('code', { title: id }, shortRef(id)), btn);
}

/** Single-line cell that ellipsises long text; the full text is in the tooltip. */
export function trunc(text, cls = '') {
  const s = text === null || text === undefined ? '' : String(text);
  return h('span', { class: `trunc ${cls}`.trim(), title: s || null }, s || '—');
}

/* =========================================================================
 * Charts (SVG, accessible: role=img + <title>/<desc> + "Show as table" fallback)
 * ========================================================================= */

const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, String(v));
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
function chartSvg(width, height, title, desc) {
  const tid = nextId('ct');
  const did = nextId('cd');
  return s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': `${tid} ${did}` }, s('title', { id: tid }, title || ''), s('desc', { id: did }, desc || ''));
}
function dataFallback(headers, rows) {
  return h('details', { class: 'chart-data' }, h('summary', {}, icon('chevron-right', { size: 12 }), t('showDataTable')),
    h('table', {}, h('thead', {}, h('tr', {}, headers.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c, i) => h('td', { class: i ? 'num' : null }, c)))))));
}
/** Redraw on container resize so SVG text never scales. */
function responsive(container, draw, minWidth = 240) {
  let last = 0;
  const run = (w) => { const width = Math.max(minWidth, Math.floor(w)); if (width === last) return; last = width; draw(width); };
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver((entries) => { for (const e of entries) run(e.contentRect.width); });
    ro.observe(container);
  }
  run(560);
}
const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};
const clip = (str, n) => (String(str).length > n ? `${String(str).slice(0, n - 1)}…` : String(str));

/**
 * Bar chart. data: [{label, value}] (sorted as given). orientation 'horizontal' (default; good for long business labels)
 * or 'vertical' (time buckets). format: value formatter (default formatNumber).
 * @param {{title: string, desc?: string, data: Array<{label: string, value: number}>, orientation?: string, format?: Function, height?: number, series?: number}} o
 */
export function barChart({ title, desc, data, orientation = 'horizontal', format = formatNumber, height, series = 1, onBarClick } = {}) {
  const wrap = h('div', { class: 'chart' });
  const holder = h('div', {});
  wrap.append(holder);
  if (!data.length) { mount(holder, emptyState({ icon: 'activity', title: t('empty'), compact: true })); return wrap; }
  const max = Math.max(...data.map((d) => d.value), 0);
  const summary = desc || data.map((d) => `${d.label}: ${format(d.value)}`).join('; ');
  responsive(holder, (W) => {
    let svg;
    if (orientation === 'horizontal') {
      const row = 28;
      const labelW = Math.min(Math.round(W * 0.42), 220);
      const valueW = 72;
      const H = height || data.length * row + 4;
      const plotW = Math.max(40, W - labelW - valueW);
      const maxChars = Math.floor(labelW / 6.6);
      svg = chartSvg(W, H, title, summary);
      data.forEach((d, i) => {
        const y = i * row;
        const bw = max ? Math.max(2, (d.value / max) * plotW) : 2;
        const g = s('g', { class: onBarClick ? 'clickable' : null });
        g.append(
          s('text', { x: 0, y: y + row / 2 + 4 }, clip(d.label, maxChars), s('title', {}, d.label)),
          s('rect', { x: labelW, y: y + 7, width: plotW, height: row - 14, rx: 3, class: 'donut-track', fill: 'var(--surface-3)', stroke: 'none' }),
          s('rect', { x: labelW, y: y + 7, width: bw, height: row - 14, rx: 3, class: `bar-rect s${d.series || series}` }, s('title', {}, `${d.label}: ${format(d.value)}`)),
          s('text', { x: W, y: y + row / 2 + 4, 'text-anchor': 'end', class: 'value-label' }, format(d.value)));
        if (onBarClick) g.addEventListener('click', () => onBarClick(d));
        svg.append(g);
      });
    } else {
      const H = height || 220;
      const pad = { l: 44, r: 8, t: 8, b: 28 };
      const plotW = W - pad.l - pad.r;
      const plotH = H - pad.t - pad.b;
      const top = niceMax(max);
      svg = chartSvg(W, H, title, summary);
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + plotH - (plotH * i) / 4;
        svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: i ? 'grid-line' : 'baseline' }),
          s('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, formatNumber((top * i) / 4, { compact: true })));
      }
      const slot = plotW / data.length;
      const bw = Math.min(40, slot * 0.6);
      const every = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56)));
      data.forEach((d, i) => {
        const x = pad.l + slot * i + (slot - bw) / 2;
        const bh = (d.value / top) * plotH;
        svg.append(s('rect', { x, y: pad.t + plotH - bh, width: bw, height: Math.max(0, bh), rx: 3, class: `bar-rect s${d.series || series}` }, s('title', {}, `${d.label}: ${format(d.value)}`)));
        if (i % every === 0) svg.append(s('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', class: 'axis-label' }, clip(d.label, 12)));
      });
    }
    mount(holder, svg);
  });
  wrap.append(dataFallback(['', title || ''], data.map((d) => [d.label, format(d.value)])));
  return wrap;
}

/**
 * Line chart. labels: x categories; series: [{name, values: number[]}] (≤ 6 series, palette order).
 * @param {{title: string, desc?: string, labels: string[], series: Array<{name: string, values: number[]}>, format?: Function, height?: number, area?: boolean}} o
 */
export function lineChart({ title, desc, labels, series, format = formatNumber, height = 220, area = true } = {}) {
  const wrap = h('div', { class: 'chart' });
  const holder = h('div', {});
  wrap.append(holder);
  const all = series.flatMap((x) => x.values).filter((v) => v !== null && v !== undefined);
  if (!labels.length || !all.length) { mount(holder, emptyState({ icon: 'activity', title: t('empty'), compact: true })); return wrap; }
  const top = niceMax(Math.max(...all, 0));
  const summary = desc || series.map((x) => `${x.name}: ${x.values.map((v, i) => `${labels[i]} ${format(v)}`).join(', ')}`).join('; ');
  responsive(holder, (W) => {
    const pad = { l: 48, r: 12, t: 10, b: 28 };
    const plotW = W - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;
    const svg = chartSvg(W, height, title, summary);
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + plotH - (plotH * i) / 4;
      svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: i ? 'grid-line' : 'baseline' }),
        s('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }, formatNumber((top * i) / 4, { compact: true })));
    }
    const xAt = (i) => pad.l + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1));
    const yAt = (v) => pad.t + plotH - (v / top) * plotH;
    const every = Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 64)));
    labels.forEach((l, i) => { if (i % every === 0 || i === labels.length - 1) svg.append(s('text', { x: xAt(i), y: height - 8, 'text-anchor': i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle', class: 'axis-label' }, clip(l, 12))); });
    series.slice(0, 6).forEach((ser, si) => {
      const pts = ser.values.map((v, i) => (v === null || v === undefined ? null : [xAt(i), yAt(v)])).filter(Boolean);
      if (!pts.length) return;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
      if (area && series.length === 1) svg.append(s('path', { d: `${d}L${pts[pts.length - 1][0]},${pad.t + plotH}L${pts[0][0]},${pad.t + plotH}Z`, class: `area s${si + 1}` }));
      svg.append(s('path', { d, class: `line s${si + 1}`, fill: 'none' }));
      ser.values.forEach((v, i) => { if (v !== null && v !== undefined) svg.append(s('circle', { cx: xAt(i), cy: yAt(v), r: 3.5, class: `dot s${si + 1}` }, s('title', {}, `${ser.name} · ${labels[i]}: ${format(v)}`))); });
    });
    mount(holder, svg);
  });
  if (series.length > 1) wrap.append(h('ul', { class: 'chart-legend' }, series.map((x, i) => h('li', {}, h('span', { class: `swatch s${i + 1}` }), x.name))));
  wrap.append(dataFallback(['', ...series.map((x) => x.name)], labels.map((l, i) => [l, ...series.map((x) => format(x.values[i]))])));
  return wrap;
}

/**
 * Donut chart with legend (value + share). data: [{label, value}] — at most 6 slices; extra slices are grouped as "Other".
 * @param {{title: string, desc?: string, data: Array<{label: string, value: number}>, format?: Function, centerLabel?: string, size?: number}} o
 */
export function donutChart({ title, desc, data, format = formatNumber, centerLabel, size = 160 } = {}) {
  let rows = data.filter((d) => d.value > 0);
  if (rows.length > 6) {
    const sorted = [...rows].sort((a, b) => b.value - a.value);
    rows = [...sorted.slice(0, 5), { label: getOtherLabel(), value: sorted.slice(5).reduce((a, b) => a + b.value, 0) }];
  }
  const total = rows.reduce((a, b) => a + b.value, 0);
  const wrap = h('div', { class: 'chart' });
  if (!total) { wrap.append(emptyState({ icon: 'activity', title: t('empty'), compact: true })); return wrap; }
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const svg = chartSvg(size, size, title, desc || rows.map((d) => `${d.label}: ${format(d.value)} (${formatPercent(d.value / total)})`).join('; '));
  svg.append(s('circle', { cx: size / 2, cy: size / 2, r, class: 'donut-track', 'stroke-width': 18 }));
  let acc = 0;
  rows.forEach((d, i) => {
    const len = (d.value / total) * c;
    const gap = rows.length > 1 ? Math.min(2, len / 2) : 0;
    svg.append(s('circle', { cx: size / 2, cy: size / 2, r, class: `donut-seg s${i + 1}`, fill: 'none', 'stroke-width': 18, 'stroke-dasharray': `${Math.max(0, len - gap)} ${c}`, 'stroke-dashoffset': -acc, transform: `rotate(-90 ${size / 2} ${size / 2})` }, s('title', {}, `${d.label}: ${format(d.value)}`)));
    acc += len;
  });
  svg.append(s('text', { x: size / 2, y: size / 2 + (centerLabel ? 2 : 7), 'text-anchor': 'middle', class: 'donut-total' }, format(total)));
  if (centerLabel) svg.append(s('text', { x: size / 2, y: size / 2 + 20, 'text-anchor': 'middle', class: 'axis-label' }, centerLabel));
  wrap.append(h('div', { class: 'donut-layout' }, svg,
    h('ul', { class: 'chart-legend' }, rows.map((d, i) => h('li', {}, h('span', { class: `swatch s${i + 1}` }), h('span', {}, d.label), h('span', { class: 'lv' }, `${format(d.value)} · ${formatPercent(d.value / total)}`))))));
  wrap.append(dataFallback(['', title || ''], rows.map((d) => [d.label, format(d.value)])));
  return wrap;
}
const getOtherLabel = () => (locale() === 'vi-VN' ? 'Khác' : 'Other');

/** Tiny inline trend line (decorative; pair it with a text value). */
export function sparkline(values, { width = 96, height = 24 } = {}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join('');
  return s('svg', { class: 'sparkline', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' }, s('path', { d }));
}
