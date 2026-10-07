import { h, clear, mount, fmtVnd, fmtDate, fmtDateTime } from '../../shared/dom.js';
import { pageHead, table, statusBadge, select, field, toast, errorToast } from '../ui.js';

export default {
  perm: 'handoff:read',
  async render(main, { api, route, navigate, can, user }) {
    const status = route.query.status || 'open';
    const mine = route.query.mine === 'true';
    const data = await api.get(`/api/handoffs?status=${encodeURIComponent(status)}${mine ? '&mine=true' : ''}&limit=100`);
    const statusSel = select([['open', 'Open'], ['claimed', 'Claimed'], ['callback', 'Callback'], ['won', 'Won'], ['lost', 'Lost']], status);
    const detail = h('div', {});

    async function openDetail(id) {
      const hdo = await api.get(`/api/handoffs/${encodeURIComponent(id)}`);
      const note = h('textarea', { maxlength: '1000', rows: '3' });
      const act = async (next) => {
        try { await api.patch(`/api/handoffs/${encodeURIComponent(id)}`, { status: next, note: note.value || undefined, version: hdo.version }); toast(`Handoff ${next}`, 'ok'); navigate(`handoffs?status=${status}&t=${Date.now()}`); } catch (e) { errorToast(e); }
      };
      mount(detail, h('section', { class: 'card stack', 'aria-label': 'Handoff detail' },
        h('div', { class: 'row spread' }, h('h2', {}, `${hdo.plate}`), statusBadge(hdo.status)),
        h('dl', { class: 'kv' },
          h('dt', {}, 'Customer'), h('dd', {}, hdo.name || '—'),
          h('dt', {}, 'Phone'), h('dd', {}, hdo.phoneMasked || '—', h('span', { class: 'muted small' }, ' (dial from the official hotline)')),
          h('dt', {}, 'Plate verified'), h('dd', {}, hdo.plateVerifiedByCustomer ? 'Yes — by customer on the bot call' : 'No'),
          h('dt', {}, 'Expiry'), h('dd', {}, `${fmtDate(hdo.expiryDate)} (${hdo.daysToExpiry ?? '—'} days)`),
          h('dt', {}, 'Premium'), h('dd', {}, fmtVnd(hdo.premium)),
          h('dt', {}, 'Journey / reason'), h('dd', {}, `${hdo.journey || '—'} / ${hdo.outcome}`)),
        h('h3', {}, 'Talking points'),
        h('ol', {}, hdo.talkingPoints.map((t) => h('li', {}, t))),
        field('Note', note),
        h('div', { class: 'row' },
          hdo.status === 'open' ? h('button', { class: 'btn primary', onclick: () => act('claimed') }, 'Claim') : null,
          h('button', { class: 'btn accent', onclick: () => navigate(`customer/${encodeURIComponent(hdo.customerId)}`) }, 'Quote & issue →'),
          ['claimed', 'callback'].includes(hdo.status) ? h('button', { class: 'btn', onclick: () => act('won') }, 'Won') : null,
          ['claimed', 'open'].includes(hdo.status) ? h('button', { class: 'btn', onclick: () => act('callback') }, 'Callback') : null,
          ['claimed', 'callback', 'open'].includes(hdo.status) ? h('button', { class: 'btn danger', onclick: () => act('lost') }, 'Lost') : null),
        (hdo.notes || []).length ? h('div', {}, h('h3', {}, 'Notes'), h('ul', {}, hdo.notes.map((n) => h('li', {}, `${fmtDateTime(n.at)} · ${n.by}: ${n.text}`)))) : null));
      detail.querySelector('h2')?.focus();
    }

    mount(main, 
      pageHead('Telesales inbox', `Hot leads from the voice bot and journey escalations${user.region && user.region !== 'ALL' ? ` · ${user.region}` : ''}.`),
      h('form', { class: 'card filters', onsubmit: (e) => { e.preventDefault(); navigate(`handoffs?status=${statusSel.value}${mine ? '&mine=true' : ''}`); } },
        field('Status', statusSel),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: mine, onchange: (e) => navigate(`handoffs?status=${statusSel.value}&mine=${e.target.checked}`) }), 'Only mine'),
        h('button', { class: 'btn primary', type: 'submit' }, 'Apply')),
      h('div', { class: 'grid cols-2', style: 'margin-top:16px' },
        h('section', { class: 'card' }, table([
          { label: 'Plate', render: (r) => h('strong', {}, r.plate) },
          { label: 'Score', num: true, render: (r) => r.score },
          { label: 'Days', num: true, render: (r) => r.daysToExpiry ?? '—' },
          { label: 'Reason', render: (r) => r.outcome },
          { label: 'Status', render: (r) => statusBadge(r.status) },
          { label: 'Created', render: (r) => fmtDateTime(r.createdAt) },
        ], data.items, { onRowClick: (r) => openDetail(r.id), caption: 'Handoffs' })),
        detail));
    if (!can('handoff:work')) detail.append(h('p', { class: 'muted' }, 'Read-only access.'));
  },
};
