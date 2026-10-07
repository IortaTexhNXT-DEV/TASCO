import { h, mount, shortRef } from '../shared/dom.js';
import { t, label } from '../shared/i18n.js';

export function toast(message, kind = 'info') {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast ${kind}`, role: kind === 'danger' ? 'alert' : 'status' }, message);
  box.append(el);
  setTimeout(() => el.remove(), 6000);
}

export function errorToast(err) {
  const details = Array.isArray(err.details) ? ` — ${err.details.slice(0, 3).join('; ')}` : '';
  toast(`${err.message}${details}${err.requestId ? ` (ref ${err.requestId.slice(0, 8)})` : ''}`, 'danger');
}

export function tierBadge(tier) {
  return h('span', { class: `badge ${tier}`, title: tier || null }, tier ? label('tier', tier) : '—');
}

const STATUS_TONE = { active: 'ok', completed: 'ok', done: 'ok', sent: 'ok', won: 'ok', resolved: 'ok', approved: 'ok', paid: 'ok', succeeded: 'ok', converted: 'ok', insured: 'ok',
  open: 'info', scheduled: 'info', claimed: 'info', submitted: 'info', pending_approval: 'warn', draft: 'info', callback: 'warn', acknowledged: 'info', assessor_assigned: 'info', under_assessment: 'info',
  skipped: 'warn', cancelled: 'warn', blocked: 'danger', failed: 'danger', lost: 'danger', rejected: 'danger', retired: 'warn', dead_letter: 'danger', disabled: 'warn', suspended: 'warn', payment_failed: 'danger' };

/** Status badge with a human label (UI language); the raw code stays in the tooltip. */
export function statusBadge(status, group = 'status') {
  return h('span', { class: `badge ${STATUS_TONE[status] || 'info'}`, title: status || null }, status ? label(group, status) : '—');
}

/** Human label for a business code, with the code in a tooltip. */
export function codeLabel(group, code) {
  return h('span', { title: code ?? null }, label(group, code));
}

/** Readable short reference (shown fully) + full id in tooltip + copy button. */
export function refCell(id) {
  if (!id) return '—';
  const btn = h('button', { class: 'btn ghost copy', type: 'button', title: `${t('copy')} ${id}`, 'aria-label': `${t('copy')} ${id}`, onclick: async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(id); toast(`${t('copied')}: ${id}`, 'ok'); } catch { toast(id); }
  } }, '⧉');
  return h('span', { class: 'ref' }, h('code', { title: id }, shortRef(id)), btn);
}

/** Single-line cell that ellipsises long text; the full text is in the tooltip. */
export function trunc(text, cls = '') {
  const s = text === null || text === undefined ? '' : String(text);
  return h('span', { class: `trunc ${cls}`.trim(), title: s || null }, s || '—');
}

export function kpi(label, value, hint) {
  return h('div', { class: 'card kpi' }, h('span', { class: 'label' }, label), h('span', { class: 'value' }, value), hint ? h('span', { class: 'hint' }, hint) : null);
}

const cellClass = (c) => [c.num ? 'num' : null, c.nowrap ? 'nowrap' : null, c.cls || null].filter(Boolean).join(' ') || null;

/** Accessible data table. columns: [{ label, render(row) → node|string, num, nowrap, cls }] */
export function table(columns, rows, { onRowClick, caption } = {}) {
  if (!rows.length) return h('div', { class: 'empty' }, t('empty'));
  return h('div', { class: 'table-wrap' },
    h('table', {},
      caption ? h('caption', { class: 'sr-only' }, caption) : null,
      h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col', class: cellClass(c) }, c.label)))),
      h('tbody', {}, rows.map((r) => {
        const tr = h('tr', { class: onRowClick ? 'clickable' : null }, columns.map((c) => h('td', { class: cellClass(c) }, c.render(r))));
        if (onRowClick) {
          tr.tabIndex = 0;
          tr.addEventListener('click', () => onRowClick(r));
          tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') onRowClick(r); });
        }
        return tr;
      }))));
}

export function pager({ total, limit, offset, onPage }) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return h('nav', { class: 'row spread', 'aria-label': 'Pagination' },
    h('span', { class: 'muted small' }, `${total.toLocaleString('vi-VN')} · ${page}/${pages}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', disabled: offset === 0, onclick: () => onPage(Math.max(0, offset - limit)) }, `‹ ${t('previous')}`),
      h('button', { class: 'btn small', disabled: offset + limit >= total, onclick: () => onPage(offset + limit) }, `${t('next')} ›`)));
}

export function field(label, input, help) {
  const id = input.id || `f-${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), input, help ? h('span', { class: 'help' }, help) : null);
}

export function select(options, value, attrs = {}) {
  return h('select', attrs, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
}

export function confirmDialog(title, message, confirmLabel = 'OK') {
  return new Promise((resolve) => {
    const dlg = h('dialog', { 'aria-labelledby': 'dlg-title' },
      h('h2', { id: 'dlg-title' }, title),
      h('p', {}, message),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => { dlg.close(); resolve(true); } }, confirmLabel),
        h('button', { class: 'btn', onclick: () => { dlg.close(); resolve(false); } }, t('cancel'))));
    dlg.addEventListener('close', () => { dlg.remove(); resolve(false); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function loading(el) {
  mount(el, h('div', { class: 'stack', 'aria-busy': 'true' }, h('div', { class: 'skeleton', style: 'height:28px;width:40%' }), h('div', { class: 'skeleton', style: 'height:120px' }), h('div', { class: 'skeleton', style: 'height:240px' })));
}

export function pageHead(title, subtitle, ...actions) {
  return h('div', { class: 'page-head' }, h('div', { class: 'page-head-text' }, h('h1', { tabindex: '-1', id: 'page-title' }, title), subtitle ? h('p', {}, subtitle) : null), h('div', { class: 'row page-head-actions' }, actions));
}
