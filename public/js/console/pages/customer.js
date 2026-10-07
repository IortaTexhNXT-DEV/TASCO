import { h, clear, mount, fmtNum, fmtVnd, fmtDate, fmtDateTime } from '../../shared/dom.js';
import { pageHead, tierBadge, statusBadge, table, field, select, toast, errorToast } from '../ui.js';

function reasonsList(lead) {
  return h('ul', { class: 'reasons', 'aria-label': 'Score breakdown' }, lead.reasons.map((r) => h('li', {},
    h('span', {}, h('strong', {}, r.label), ' — ', h('span', { class: 'muted' }, r.why)),
    h('span', {}, `${r.points} / ${r.max}`),
    h('div', { class: 'bar', role: 'img', 'aria-label': `${r.label} ${r.points} of ${r.max}` }, h('span', { style: `width:${Math.round((r.points / r.max) * 100)}%` })))));
}

function quoteBuilder(ctx, profile, lead, refresh) {
  const { api, can } = ctx;
  const out = h('div', { class: 'stack' });
  const pd = h('input', { type: 'checkbox', id: 'opt-pd' });
  const pa = h('input', { type: 'checkbox', id: 'opt-pa', checked: true });
  const si = h('input', { type: 'number', min: '100000000', step: '10000000', value: '600000000' });
  const seatSi = select([['10000000', '10 triệu/seat'], ['20000000', '20 triệu/seat'], ['50000000', '50 triệu/seat']], '20000000');
  const term = select([['1', '1 year'], ['2', '2 years'], ['3', '3 years']], '1');
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Get quote');
  const form = h('form', { class: 'stack' },
    h('p', { class: 'small muted' }, 'TNDS premium is regulated (same at every insurer). Add-on covers are optional and priced per TASCO filed rates.'),
    field('TNDS term', term),
    h('label', { class: 'check', for: 'opt-pa' }, pa, 'Add driver & passenger accident cover'), field('Sum insured per seat', seatSi),
    h('label', { class: 'check', for: 'opt-pd' }, pd, 'Add physical damage (own vehicle)'), field('Vehicle value (VND)', si),
    btn, out);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      const products = [{ code: 'TNDS_CAR', options: { termYears: Number(term.value) } }];
      if (pa.checked) products.push({ code: 'PA_SEAT', options: { sumInsuredPerSeat: Number(seatSi.value) } });
      if (pd.checked) products.push({ code: 'MOTOR_PD', options: { sumInsured: Number(si.value) } });
      const q = await api.post('/api/quotes', { profileId: profile.id, products, channel: 'telesales', journey: lead?.journey || undefined });
      mount(out, h('div', { class: 'card stack' },
        h('h3', {}, `Quote ${q.id.slice(0, 10)}…`),
        table([{ label: 'Product', render: (l) => l.productNameVi }, { label: 'Period', render: (l) => `${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}` }, { label: 'Net', num: true, render: (l) => fmtVnd(l.premiumNet) }, { label: 'VAT', num: true, render: (l) => fmtVnd(l.vat) }, { label: 'Total', num: true, render: (l) => fmtVnd(l.total) }], q.lines),
        h('p', {}, h('strong', {}, `Total: ${fmtVnd(q.total)}`), q.bundle ? h('span', { class: 'badge info', style: 'margin-left:8px' }, q.bundle) : null),
        h('p', { class: 'small muted' }, `Included value: ${q.benefits.map((b) => b.title).join(' · ')}`),
        h('p', { class: 'small muted' }, 'Payment happens only in the customer\'s VETC app — never on the phone.'),
        h('button', { class: 'btn accent', onclick: async (ev) => {
          ev.target.disabled = true;
          try {
            const r = await api.post(`/api/quotes/${encodeURIComponent(q.id)}/send`);
            toast(`Sent to customer: ${r.sent.map((x) => `${x.channel} ${x.status}`).join(', ') || 'no channel available'}`, 'ok');
            refresh();
          } catch (ex) { errorToast(ex); ev.target.disabled = false; }
        } }, 'Send to customer\'s VETC app to confirm & pay')));
    } catch (ex) { errorToast(ex); }
    btn.disabled = false;
  });
  return form;
}

export default {
  perm: 'profile:read',
  async render(main, ctx) {
    const { api, route, can, navigate } = ctx;
    const id = route.params[0];
    const d = await api.get(`/api/customers/${encodeURIComponent(id)}`);
    const { profile: p, lead } = d;
    const refresh = () => ctx.rerender();

    const actions = [];
    if (lead && can('voice:operate') && !p.consent.dnc) actions.push(h('button', { class: 'btn primary', onclick: () => navigate(`voice?profile=${encodeURIComponent(p.id)}`) }, '🎙 Start voice bot'));
    if (can('journeys:run')) actions.push(h('button', { class: 'btn', onclick: async () => {
      try { const r = await api.post('/api/ecosystem/events', { type: 'vetc.wallet_topped_up', profileId: p.id }); toast(`Trigger: ${r.actions.map((a) => `${a.trigger} → ${a.result}`).join('; ') || 'no matching trigger'}`); refresh(); } catch (e) { errorToast(e); }
    } }, 'Simulate wallet top-up event'));

    const tabs = ['Overview', 'Data & lineage', 'Journey', 'Messages', 'Sell', 'Activity'];
    const panel = h('div', { class: 'stack', style: 'margin-top:16px' });
    const tablist = h('div', { class: 'tabs', role: 'tablist' });
    const show = (i) => {
      [...tablist.children].forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
      mount(panel, views[i]());
    };
    tabs.forEach((label, i) => tablist.append(h('button', { role: 'tab', 'aria-selected': String(i === 0), onclick: () => show(i) }, label)));

    const views = [
      () => h('div', { class: 'grid cols-2' },
        h('section', { class: 'card stack' },
          h('h2', {}, 'Why this customer'),
          lead ? [h('div', { class: 'row' }, h('span', { class: 'kpi' }, h('span', { class: 'value' }, lead.score)), tierBadge(lead.tier), h('span', { class: 'badge info' }, lead.journey || 'no journey')), reasonsList(lead)] : h('p', {}, 'No lead record.')),
        h('section', { class: 'card stack' },
          h('h2', {}, 'Guided next action'),
          lead ? h('div', { class: 'alert info' }, h('strong', {}, lead.nextBestAction.label), h('p', { class: 'small' }, lead.nextBestAction.reason)) : null,
          h('h3', {}, 'Value to offer (no discounts)'),
          h('ul', {}, d.benefits.map((b) => h('li', {}, h('strong', {}, b.title), ' — ', b.why, b.legalStatus !== 'approved' ? h('span', { class: 'badge warn', style: 'margin-left:6px' }, 'staff only: pending legal') : null))))),
      () => h('div', { class: 'grid cols-2' },
        h('section', { class: 'card' }, h('h2', {}, 'Golden record'),
          h('dl', { class: 'kv' },
            h('dt', {}, 'Name'), h('dd', {}, p.name || '—', p.piiMasked ? h('span', { class: 'badge info', style: 'margin-left:6px' }, 'masked') : null),
            h('dt', {}, 'Phone'), h('dd', {}, p.phone || '—'),
            h('dt', {}, 'Province'), h('dd', {}, p.province),
            h('dt', {}, 'Owner type'), h('dd', {}, p.ownerType),
            h('dt', {}, 'Vehicle'), h('dd', {}, `${p.vehicle.category} (${Math.round(p.vehicle.categoryConfidence * 100)}% — ${p.vehicle.categoryBasis})`),
            h('dt', {}, 'Policy expiry'), h('dd', {}, `${fmtDate(p.policy.expiryDate)} · ${p.policy.expiryMethod} · ${Math.round(p.policy.expiryConfidence * 100)}%`),
            h('dt', {}, 'Insurer'), h('dd', {}, p.policy.insurer || 'unknown'),
            h('dt', {}, 'Consent'), h('dd', {}, `marketing ${p.consent.marketing ? '✓' : '✗'} · call ${p.consent.call ? '✓' : '✗'}${p.consent.dnc ? ' · DO NOT CONTACT' : ''}`),
            h('dt', {}, 'Sources'), h('dd', {}, p.sources.join(', ')),
            h('dt', {}, 'Data quality'), h('dd', {}, `${p.dataQuality.score}/100 ${p.dataQuality.missing.length ? `— missing: ${p.dataQuality.missing.join(', ')}` : ''}`))),
        h('section', { class: 'card' }, h('h2', {}, 'Lineage'),
          table([{ label: 'Field', render: (l) => l.field }, { label: 'Source / rule', render: (l) => l.source }, { label: 'Confidence', num: true, render: (l) => `${Math.round(l.confidence * 100)}%` }], p.lineage || []),
          h('h3', { style: 'margin-top:16px' }, 'Expiry evidence'),
          table([{ label: 'Date', render: (c) => fmtDate(c.date) }, { label: 'Method', render: (c) => c.method }, { label: 'Confidence', num: true, render: (c) => `${Math.round(c.confidence * 100)}%` }], p.policy.expiryCandidates || []),
          can('profile:update') ? correctExpiry(api, p, refresh) : null)),
      () => h('section', { class: 'card' }, h('h2', {}, 'Journey timeline'),
        d.touchpoints.length ? h('ol', { class: 'timeline' }, d.touchpoints.map((tp) => h('li', { class: tp.status === 'done' ? 'done' : null },
          h('div', { class: 'row' }, h('strong', {}, fmtDate(tp.dueDate)), h('span', {}, tp.step), statusBadge(tp.status), h('span', { class: 'muted small' }, tp.channel || tp.channels.join(' / '))),
          tp.result?.reason ? h('div', { class: 'small muted' }, tp.result.reason) : null))) : h('p', { class: 'muted' }, 'No touchpoints scheduled.')),
      () => h('section', { class: 'card' }, h('h2', {}, 'Messages & calls'),
        table([{ label: 'When', render: (m) => fmtDateTime(m.sentAt) }, { label: 'Channel', render: (m) => m.channel }, { label: 'Status', render: (m) => statusBadge(m.status) }, { label: 'Text', render: (m) => h('span', { class: 'small' }, m.text) }], d.messages)),
      () => h('div', { class: 'grid cols-2' },
        h('section', { class: 'card' }, h('h2', {}, 'Quote & issue'), can('quote:create') ? quoteBuilder(ctx, p, lead, refresh) : h('p', { class: 'muted' }, 'Your role cannot quote.')),
        h('section', { class: 'card' }, h('h2', {}, 'Policies'),
          table([{ label: 'Certificate', render: (x) => h('a', { href: `/verify/${encodeURIComponent(x.certNo)}`, target: '_blank', rel: 'noopener' }, x.certNo) }, { label: 'Product', render: (x) => x.product }, { label: 'Ends', render: (x) => fmtDate(x.endDate) }, { label: 'Status', render: (x) => statusBadge(x.status) }], d.policies))),
      () => h('section', { class: 'card' }, h('h2', {}, 'Activity (audit)'),
        table([{ label: 'When', render: (a) => fmtDateTime(a.at) }, { label: 'Actor', render: (a) => a.actor }, { label: 'Action', render: (a) => a.action }], d.activity)),
    ];

    mount(main, 
      pageHead(p.plate, `${p.province} · ${p.vehicle.category} · premium ${fmtVnd(lead?.premium)} · expires ${fmtDate(p.policy.expiryDate)} (${lead?.daysToExpiry ?? '—'} days)`, ...actions),
      p.consent.dnc ? h('div', { class: 'alert danger', role: 'alert' }, 'Customer opted out — do not contact.') : null,
      tablist, panel);
    show(0);
  },
};

function correctExpiry(api, p, refresh) {
  const date = h('input', { type: 'date', required: true });
  const insurer = h('input', { maxlength: '60', placeholder: 'e.g. TASCO, PVI, PTI' });
  const evidence = h('input', { maxlength: '300', required: true, placeholder: 'e.g. certificate photo from customer' });
  const form = h('form', { class: 'stack', style: 'margin-top:16px' }, h('h3', {}, 'Correct expiry (data steward)'), field('New expiry date', date), field('Insurer', insurer), field('Evidence', evidence), h('button', { class: 'btn', type: 'submit' }, 'Save correction'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api.patch(`/api/customers/${encodeURIComponent(p.id)}/expiry`, { expiryDate: date.value, insurer: insurer.value || undefined, evidence: evidence.value }); toast('Corrected and re-scored', 'ok'); refresh(); } catch (ex) { errorToast(ex); }
  });
  return form;
}
