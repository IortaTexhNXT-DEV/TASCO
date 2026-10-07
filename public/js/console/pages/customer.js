import { h, mount, fmtVnd, fmtDate, fmtDateTime, fmtPeriod } from '../../shared/dom.js';
import { t, label, getLang } from '../../shared/i18n.js';
import { pageHead, tierBadge, statusBadge, table, field, select, toast, errorToast, codeLabel, refCell } from '../ui.js';

const vi = () => getLang() === 'vi';
const productName = (l) => (vi() ? l.productNameVi : l.productName) || label('product', l.product);
const benefitTitle = (b) => (vi() ? b.titleVi || b.title : b.title || b.titleVi);
const insurerName = (x) => (x === 'OTHER' ? (vi() ? 'DN bảo hiểm khác' : 'Other insurer') : x || (vi() ? 'chưa rõ' : 'unknown'));

function reasonsList(lead) {
  return h('ul', { class: 'reasons', 'aria-label': 'Score breakdown' }, lead.reasons.map((r) => h('li', {},
    h('span', {}, h('strong', {}, r.label), r.why ? [' — ', h('span', { class: 'muted' }, r.why)] : null),
    h('span', {}, `${r.points} / ${r.max}`),
    h('div', { class: 'bar', role: 'img', 'aria-label': `${r.label} ${r.points} of ${r.max}` }, h('span', { style: `width:${Math.round((r.points / r.max) * 100)}%` })))));
}

/** Hide exact repeats of the same evidence (same date + method) so lineage reads cleanly. */
function dedupeCandidates(list) {
  const seen = new Set();
  return list.filter((c) => { const k = `${c.date}|${c.method}|${c.source || ''}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function quoteBuilder(ctx, profile, lead, refresh) {
  const { api } = ctx;
  const out = h('div', { class: 'stack' });
  const pd = h('input', { type: 'checkbox', id: 'opt-pd' });
  const pa = h('input', { type: 'checkbox', id: 'opt-pa', checked: true });
  const si = h('input', { type: 'number', min: '100000000', step: '10000000', value: '600000000' });
  const seatSi = select([10, 20, 50].map((m) => [String(m * 1000000), t('perSeat', m)]), '20000000');
  const term = select([1, 2, 3].map((n) => [String(n), t('years', n)]), '1');
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
        h('h3', { class: 'row' }, 'Quote ', refCell(q.id)),
        table([{ label: 'Product', render: (l) => h('span', { title: l.product }, productName(l)) }, { label: 'Period', render: (l) => fmtPeriod(l.startDate, l.endDate) }, { label: 'Net', num: true, render: (l) => fmtVnd(l.premiumNet) }, { label: 'VAT', num: true, render: (l) => fmtVnd(l.vat) }, { label: 'Total', num: true, render: (l) => fmtVnd(l.total) }], q.lines),
        h('p', {}, h('strong', {}, `Total: ${fmtVnd(q.total)}`), q.bundle ? h('span', { class: 'badge info', style: 'margin-left:8px', title: q.bundle }, label('product', q.bundle)) : null),
        h('p', { class: 'small muted' }, `Included value: ${q.benefits.map(benefitTitle).join(' · ')}`),
        h('p', { class: 'small muted' }, 'Payment happens only in the customer\'s VETC app — never on the phone.'),
        q.lines.some((l) => l.product === 'MOTOR_PD') ? h('button', { class: 'btn', onclick: async (ev) => {
          const evidence = window.prompt('Inspection evidence (assessor, photos reference)');
          if (!evidence) return;
          try { await api.post(`/api/quotes/${encodeURIComponent(q.id)}/inspection`, { passed: true, evidence }); toast('Inspection recorded', 'ok'); ev.target.disabled = true; } catch (ex) { errorToast(ex); }
        } }, 'Record vehicle inspection (physical damage)') : null,
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
          lead ? [h('div', { class: 'row' }, h('span', { class: 'kpi' }, h('span', { class: 'value' }, lead.score)), tierBadge(lead.tier), h('span', { class: 'badge info', title: lead.journey || null }, label('journey', lead.journey))), reasonsList(lead)] : h('p', {}, 'No lead record.')),
        h('section', { class: 'card stack' },
          h('h2', {}, 'Guided next action'),
          lead ? h('div', { class: 'alert info' }, h('strong', { title: lead.nextBestAction.action }, label('nba', lead.nextBestAction.action)), h('p', { class: 'small' }, lead.nextBestAction.reason)) : null,
          h('h3', {}, 'Value to offer (no discounts)'),
          h('ul', {}, d.benefits.map((b) => h('li', {}, h('strong', { title: b.id }, benefitTitle(b)), ' — ', b.why, b.legalStatus !== 'approved' ? h('span', { class: 'badge warn', style: 'margin-left:6px' }, 'staff only: pending legal') : null))))),
      () => h('div', { class: 'grid cols-2' },
        h('section', { class: 'card' }, h('h2', {}, 'Golden record'),
          h('dl', { class: 'kv' },
            h('dt', {}, 'Name'), h('dd', {}, p.name || '—', p.piiMasked ? h('span', { class: 'badge info', style: 'margin-left:6px' }, 'masked') : null),
            h('dt', {}, 'Phone'), h('dd', {}, p.phone || '—'),
            h('dt', {}, 'Province'), h('dd', {}, p.province),
            h('dt', {}, 'Owner type'), h('dd', {}, codeLabel('ownerType', p.ownerType)),
            h('dt', {}, 'Vehicle'), h('dd', {}, codeLabel('category', p.vehicle.category), ` (${Math.round(p.vehicle.categoryConfidence * 100)}% — ${p.vehicle.categoryBasis})`),
            h('dt', {}, 'Policy expiry'), h('dd', {}, `${fmtDate(p.policy.expiryDate)} · `, codeLabel('method', p.policy.expiryMethod), ` · ${Math.round(p.policy.expiryConfidence * 100)}%`),
            h('dt', {}, 'Insurer'), h('dd', {}, insurerName(p.policy.insurer),
              p.policy.renewalClaim ? h('span', { class: 'badge warn', style: 'margin-left:6px', title: p.policy.renewalClaim.note || '' }, vi() ? 'khách báo đã gia hạn nơi khác — chưa xác minh' : 'customer says renewed elsewhere — unverified') : null),
            h('dt', {}, 'Consent'), h('dd', {}, `marketing ${p.consent.marketing ? '✓' : '✗'} · call ${p.consent.call ? '✓' : '✗'}${p.consent.dnc ? ' · DO NOT CONTACT' : ''}`),
            h('dt', {}, 'Sources'), h('dd', {}, p.sources.join(', ')),
            h('dt', {}, 'Data quality'), h('dd', {}, `${p.dataQuality.score}/100 ${p.dataQuality.missing.length ? `— missing: ${p.dataQuality.missing.join(', ')}` : ''}`))),
        h('section', { class: 'card' }, h('h2', {}, 'Lineage'),
          table([{ label: 'Field', render: (l) => l.field }, { label: 'Source / rule', render: (l) => l.source }, { label: 'Confidence', num: true, render: (l) => `${Math.round(l.confidence * 100)}%` }], p.lineage || []),
          h('h3', { style: 'margin-top:16px' }, 'Expiry evidence'),
          table([{ label: 'Date', nowrap: true, render: (c) => fmtDate(c.date) },
            { label: 'Method', render: (c) => [codeLabel('method', c.method), c.source && c.source !== c.method ? h('span', { class: 'muted small' }, ` · ${c.source === 'tasco_core' ? 'TASCO core' : c.source}`) : null,
              c.superseded ? h('span', { class: 'badge warn', style: 'margin-left:6px', title: 'Outranked by stronger evidence; kept for lineage' }, vi() ? 'không áp dụng' : 'outranked') : null] },
            { label: 'Confidence', num: true, render: (c) => `${Math.round(c.confidence * 100)}%` }], dedupeCandidates(p.policy.expiryCandidates || [])),
          can('profile:update') ? correctExpiry(api, p, refresh) : null)),
      () => h('section', { class: 'card' }, h('h2', {}, 'Journey timeline'),
        d.touchpoints.length ? h('ol', { class: 'timeline' }, d.touchpoints.map((tp) => h('li', { class: tp.status === 'done' ? 'done' : null },
          h('div', { class: 'row' }, h('strong', {}, fmtDate(tp.dueDate)), codeLabel('step', tp.step), statusBadge(tp.status), h('span', { class: 'muted small' }, tp.channel ? label('channel', tp.channel) : tp.channels.map((c) => label('channel', c)).join(' / '))),
          tp.result?.reason ? h('div', { class: 'small muted' }, tp.result.reason) : null))) : h('p', { class: 'muted' }, 'No touchpoints scheduled.')),
      () => h('section', { class: 'card' }, h('h2', {}, 'Messages & calls'),
        table([{ label: 'When', nowrap: true, render: (m) => fmtDateTime(m.sentAt) }, { label: 'Channel', render: (m) => codeLabel('channel', m.channel) }, { label: 'Status', render: (m) => statusBadge(m.status) }, { label: 'Text', render: (m) => h('span', { class: 'small' }, m.text) }], d.messages)),
      () => h('div', { class: 'grid cols-2' },
        h('section', { class: 'card' }, h('h2', {}, 'Quote & issue'), can('quote:create') ? quoteBuilder(ctx, p, lead, refresh) : h('p', { class: 'muted' }, 'Your role cannot quote.')),
        h('section', { class: 'card' }, h('h2', {}, 'Policies'),
          table([{ label: 'Certificate', nowrap: true, render: (x) => h('a', { href: `/verify/${encodeURIComponent(x.certNo)}`, target: '_blank', rel: 'noopener' }, x.certNo) }, { label: 'Product', render: (x) => h('span', { title: x.product }, productName(x)) }, { label: 'Ends', nowrap: true, render: (x) => fmtDate(x.endDate) }, { label: 'Status', render: (x) => statusBadge(x.status) }], d.policies))),
      () => h('section', { class: 'card' }, h('h2', {}, 'Activity (audit)'),
        table([{ label: 'When', nowrap: true, render: (a) => fmtDateTime(a.at) }, { label: 'Actor', render: (a) => h('span', { title: a.actor }, a.actorName || a.actor) }, { label: 'Action', render: (a) => h('code', {}, a.action) }], d.activity)),
    ];

    mount(main, 
      pageHead(p.plate, `${p.province} · ${label('category', p.vehicle.category)} · premium ${fmtVnd(lead?.premium)} · expires ${fmtDate(p.policy.expiryDate)} (${lead?.daysToExpiry ?? '—'} days)`, ...actions),
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
