import { h, mount } from '../../shared/dom.js';
import { t, label, getLang } from '../../shared/i18n.js';
import {
  pageHeader, card, tabs, button, iconButton, dropdownMenu, badge, tierBadge, statusChip, scoreRing, meter, keyValueList, confidenceMeter, timeline,
  stepper, dataTable, emptyState, banner, drawer, modal, formField, input, textarea, selectInput, switchControl, segmented, dateInput, checkbox,
  icon, tooltip, toast, errorToast, formatMoney, formatDate, formatPlate, formatNumber, formatPercent, formatDateTime,
} from '../ui.js';
import {
  st, sourceName, fieldName, factorName, policyState, channelTag, channelIcon, outcomeChip, outcomeLabel, reasonText, messageText, explain,
} from './sales-common.js';

const vi = () => getLang() === 'vi';
const benefitTitle = (b) => (vi() ? b.titleVi || b.title : b.title || b.titleVi);
const benefitDesc = (b) => (vi() ? b.descVi || b.desc : b.desc || b.descVi);
const BENEFIT_ICON = { service: 'sparkles', cover_upgrade: 'shield', loyalty: 'badge-check', convenience: 'clock' };

/* ---------------- Header ---------------- */
function consentIcons(p) {
  const items = [
    ['megaphone', st('consentMarketing'), p.consent.marketing],
    ['phone', st('consentCall'), p.consent.call],
    ['bell', st('reachApp'), p.channels?.app_push],
    ['message-square', st('reachZalo'), p.channels?.zalo_zns],
    ['send', st('reachSms'), p.channels?.sms],
  ];
  return h('ul', { class: 'consent-icons', 'aria-label': st('consentMarketing') }, items.map(([ic, lab, on], i) => {
    const text = `${lab}: ${on ? (i < 2 ? st('given') : st('available')) : (i < 2 ? st('notGiven') : st('notAvailable'))}`;
    return h('li', {}, tooltip(h('span', { class: `consent-icon ${on ? 'on' : 'off'}`, role: 'img', 'aria-label': text, tabindex: '0' }, icon(ic, { size: 16 })), text));
  }));
}

function summaryCard(p, lead, d, today) {
  const ps = policyState(p, lead, d.policies, today);
  const insurer = p.policy.insurer === 'TASCO' ? 'TASCO' : p.policy.insurer === 'OTHER' ? st('otherInsurer') : p.policy.insurer || st('unknownInsurer');
  return card({
    class: 'c360-summary',
    body: h('div', { class: 'c360-grid' },
      h('div', { class: 'c360-score' },
        lead ? scoreRing(lead.score, { tier: lead.tier, size: 64, label: `${st('score')} ${lead.score}` }) : null,
        h('div', { class: 'c360-fact' }, h('span', { class: 'eyebrow' }, st('score')), lead ? tierBadge(lead.tier) : h('span', { class: 'muted' }, '—'))),
      h('div', { class: 'c360-fact' }, h('span', { class: 'eyebrow' }, st('policyExpiry')),
        h('strong', { class: 'fact-value' }, p.policy.expiryDate ? formatDate(p.policy.expiryDate) : '—'),
        badge(ps.text, ps.tone, { icon: ps.icon })),
      h('div', { class: 'c360-fact' }, h('span', { class: 'eyebrow' }, st('premium')),
        h('strong', { class: 'fact-value' }, formatMoney(lead?.premium)), h('span', { class: 'fact-sub' }, insurer)),
      h('div', { class: 'c360-fact' }, h('span', { class: 'eyebrow' }, st('nba')),
        h('strong', { class: 'fact-value text' }, lead ? label('nba', lead.nextBestAction?.action) : '—'),
        h('span', { class: 'fact-sub' }, lead?.journey ? label('journey', lead.journey) : '')),
      h('div', { class: 'c360-fact' }, h('span', { class: 'eyebrow' }, st('consentReach')),
        consentIcons(p),
        meter({ value: p.dataQuality.score, label: st('dataScore'), valueText: formatPercent(p.dataQuality.score / 100) }))),
  });
}

/* ---------------- Overview ---------------- */
function overviewTab(d, ctx, actions) {
  const { lead } = d;
  if (!lead) return emptyState({ icon: 'users', title: st('noLead') });
  const why = card({ title: st('whyThisCustomer'), body: h('ul', { class: 'factor-list' }, lead.reasons.map((r) => h('li', {},
    meter({ value: r.points, max: r.max, label: factorName(r), valueText: st('scoreOf', formatNumber(Math.round(r.points)), formatNumber(r.max)), tone: r.points / r.max >= 0.7 ? 'brand' : '' }),
    r.why ? h('p', { class: 'factor-why' }, explain(r.why)) : null))) });
  const nba = card({ title: st('guidedAction'), class: 'nba-card', body: h('div', { class: 'nba' },
    h('span', { class: 'nba-icon' }, icon('sparkles', { size: 20 })),
    h('div', { class: 'stack-sm grow' }, h('p', { class: 'nba-title' }, label('nba', lead.nextBestAction?.action)), lead.nextBestAction?.reason ? h('p', { class: 'nba-reason' }, explain(lead.nextBestAction.reason)) : null),
    actions.primary ? actions.primary() : null) });
  const value = card({ title: st('valueToOffer'), body: h('div', { class: 'benefit-grid' }, d.benefits.slice(0, 4).map((b) => h('article', { class: 'benefit-card' },
    h('span', { class: 'benefit-icon' }, icon(BENEFIT_ICON[b.type] || 'sparkles', { size: 18 })),
    h('div', { class: 'stack-sm' },
      h('h3', {}, benefitTitle(b)),
      h('p', {}, b.why ? explain(b.why) : benefitDesc(b)),
      b.legalStatus !== 'approved' ? badge(st('staffOnly'), 'warn', { icon: 'lock' }) : null)))) });
  return h('div', { class: 'grid-12' }, h('div', { class: 'span-5' }, why), h('div', { class: 'span-7 stack' }, nba, value));
}

/* ---------------- Policy & quotes ---------------- */
function policiesCard(d) {
  const products = (l) => label('product', l.product);
  return card({ title: st('currentPolicies'), flush: true, body: dataTable({
    caption: st('currentPolicies'), pagination: false, rows: d.policies, rowKey: (x) => x.certNo || x.id,
    empty: { icon: 'file-text', title: st('noPolicies') },
    columns: [
      { key: 'product', label: st('products'), render: (x) => h('span', { class: 'cell-stack' }, h('span', {}, products(x)), h('a', { class: 'cell-sub', href: `/verify/${encodeURIComponent(x.certNo)}`, target: '_blank', rel: 'noopener' }, x.certNo)) },
      { key: 'period', label: st('period'), nowrap: true, render: (x) => h('span', { class: 'cell-stack' }, h('span', {}, formatDate(x.startDate)), h('span', { class: 'cell-sub' }, `→ ${formatDate(x.endDate)}`)) },
      { key: 'status', label: st('status'), render: (x) => statusChip(x.status) },
    ],
  }) });
}

function productCard({ title, desc, tag, control, extra }) {
  return h('div', { class: 'product-card' },
    h('div', { class: 'product-head' }, h('div', { class: 'product-text' }, h('span', { class: 'product-title' }, title), h('span', { class: 'product-desc' }, desc)), tag, control),
    extra ? h('div', { class: 'product-extra' }, extra) : null);
}

function quoteTab(d, ctx) {
  const { api, can } = ctx;
  const p = d.profile;
  const policies = policiesCard(d);
  if (!can('quote:create')) return h('div', { class: 'grid-12' }, h('div', { class: 'span-12' }, policies));
  const summary = h('div', {});
  const pa = switchControl({ label: '', checked: true });
  const pd = switchControl({ label: '' });
  pa.querySelector('input').setAttribute('aria-label', label('product', 'PA_SEAT'));
  pd.querySelector('input').setAttribute('aria-label', label('product', 'MOTOR_PD'));
  const term = segmented({ options: [1, 2, 3].map((n) => [n, t('years', n)]), value: 1, label: st('term') });
  const seat = selectInput([10, 20, 50].map((m) => [String(m * 1000000), formatMoney(m * 1000000)]), '20000000');
  const value = input({ type: 'number', min: '100000000', step: '10000000', value: '600000000', inputmode: 'numeric' });
  const seatField = formField({ label: st('seatCover'), control: seat });
  const valueField = formField({ label: st('vehicleValue'), control: value, help: st('vehicleValueHelp') });
  const valueEcho = h('span', { class: 'value-echo', 'aria-live': 'polite' }, formatMoney(Number(value.value)));
  value.addEventListener('input', () => { valueEcho.textContent = Number(value.value) ? formatMoney(Number(value.value)) : ''; });
  valueField.querySelector('.help')?.append(' · ', valueEcho);
  const sync = () => { seatField.hidden = !pa.input.checked; valueField.hidden = !pd.input.checked; };
  pa.input.addEventListener('change', sync);
  pd.input.addEventListener('change', sync);
  sync();

  const renderSummary = (q, state = {}) => {
    const needsInspection = q.lines.some((l) => l.product === 'MOTOR_PD');
    const inspected = !!q.inspection?.passed;
    const steps = needsInspection ? st('quoteSteps') : st('quoteStepsNoInspect');
    const current = state.sent ? steps.length : needsInspection && !inspected ? 1 : steps.length - 1;
    const source = q.indicative ? null : q.ratingSource === 'core' ? st('pricedByCore') : st('pricedByRules');
    const sendBtn = button({ label: st('sendToApp'), icon: 'send', variant: 'primary', block: true, disabled: state.sent || q.indicative || (needsInspection && !inspected), onClick: async () => {
      try {
        const r = await api.post(`/api/quotes/${encodeURIComponent(q.id)}/send`);
        const ok = r.sent.some((x) => x.status === 'sent');
        toast(ok ? st('quoteSent') : st('noChannel'), ok ? 'ok' : 'warn');
        if (ok) renderSummary(q, { sent: true, via: r.sent.find((x) => x.status === 'sent')?.channel });
      } catch (e) { errorToast(e); }
    } });
    mount(summary, card({
      title: st('quoteSummary'),
      actions: [q.bundle ? badge(`${st('bundleApplied')}: ${label('product', q.bundle)}`, 'brand', { icon: 'layers' }) : null].filter(Boolean),
      body: h('div', { class: 'stack' },
        stepper(steps, { current, label: st('quoteSummary') }),
        h('ul', { class: 'quote-lines' }, q.lines.map((l) => h('li', {},
          h('div', { class: 'ql-main' }, h('span', { class: 'ql-name' }, label('product', l.product)), h('strong', { class: 'ql-total' }, formatMoney(l.total))),
          h('div', { class: 'ql-sub' }, h('span', {}, `${formatDate(l.startDate)} → ${formatDate(l.endDate)}${l.priceRegulated ? ` · ${st('regulated')}` : ''}`),
            h('span', { class: 'nowrap' }, `${st('net')} ${formatMoney(l.premiumNet)} · ${st('vat')} ${formatMoney(l.vat)}`))))),
        h('div', { class: 'quote-total-row' }, h('span', {}, st('total')), h('strong', { class: 'quote-total' }, formatMoney(q.total))),
        q.indicative
          ? banner({ tone: 'warn', title: st('indicativeTitle'), text: st('indicativeText'), actions: [button({ label: st('rerate'), icon: 'refresh', size: 'sm', onClick: async () => {
            try { renderSummary(await api.post(`/api/quotes/${encodeURIComponent(q.id)}/rerate`)); } catch (e) { errorToast(e); }
          } })] })
          : h('p', { class: 'rating-source' }, icon('badge-check', { size: 16 }), source),
        needsInspection ? h('div', { class: `inspection-step ${inspected ? 'done' : ''}`.trim() },
          icon(inspected ? 'check-circle' : 'clipboard-check', { size: 18 }),
          h('div', { class: 'grow' }, h('strong', {}, st('inspection')), h('p', {}, inspected ? st('inspectionPassed') : st('inspectionNeeded'))),
          inspected ? null : button({ label: st('recordInspection'), size: 'sm', onClick: () => inspectionModal(q) })) : null,
        state.sent ? banner({ tone: 'ok', title: st('quoteSent'), text: label('channel', state.via) }) : sendBtn,
        h('p', { class: 'help-line' }, icon('lock', { size: 14 }), st('quoteEmptyHint'))),
    }));
  };

  function inspectionModal(q) {
    const ev = textarea({ rows: '3', maxlength: '500' });
    const passed = checkbox({ label: st('inspectionPassed'), checked: true });
    const f = formField({ label: st('inspectionEvidence'), control: ev, help: st('inspectionEvidenceHelp'), required: true });
    const m = modal({
      title: st('recordInspection'), size: 'sm', body: h('div', { class: 'stack' }, f, passed),
      actions: [button({ label: t('cancel'), onClick: () => m.close() }), button({ label: st('recordInspection'), variant: 'primary', onClick: async () => {
        if (!ev.value.trim()) { f.setError(t('required')); ev.focus(); return; }
        try {
          const r = await api.post(`/api/quotes/${encodeURIComponent(q.id)}/inspection`, { passed: passed.input.checked, evidence: ev.value.trim() });
          toast(st('inspectionRecorded'), 'ok');
          m.close();
          renderSummary({ ...q, inspection: r.inspection || { passed: passed.input.checked } });
        } catch (e) { errorToast(e); }
      } })],
    });
  }

  const calc = button({ label: st('calculate'), icon: 'sparkles', variant: 'primary', onClick: async () => {
    const products = [{ code: 'TNDS_CAR', options: { termYears: Number(term.value) } }];
    if (pa.input.checked) products.push({ code: 'PA_SEAT', options: { sumInsuredPerSeat: Number(seat.value) } });
    if (pd.input.checked) {
      if (!(Number(value.value) >= 100000000)) { valueField.setError(st('vehicleValueHelp')); value.focus(); return; }
      valueField.setError('');
      products.push({ code: 'MOTOR_PD', options: { sumInsured: Number(value.value) } });
    }
    try { renderSummary(await api.post('/api/quotes', { profileId: p.id, products, channel: 'telesales', journey: d.lead?.journey || undefined })); } catch (e) { errorToast(e); }
  } });

  mount(summary, card({ title: st('quoteSummary'), body: emptyState({ icon: 'file-text', title: st('quoteEmpty'), text: st('quoteEmptyHint'), compact: true }) }));
  const builder = card({
    title: st('quoteBuilder'),
    body: h('div', { class: 'stack' },
      h('fieldset', { class: 'plain stack-sm' }, h('legend', { class: 'eyebrow' }, st('products')),
        productCard({ title: label('product', 'TNDS_CAR'), desc: st('tndsDesc'), tag: badge(st('compulsory'), 'brand'), control: null }),
        productCard({ title: label('product', 'PA_SEAT'), desc: st('paSeatDesc'), tag: badge(st('optional'), 'neutral'), control: pa, extra: seatField }),
        productCard({ title: label('product', 'MOTOR_PD'), desc: st('pdDesc'), tag: badge(st('optional'), 'neutral'), control: pd, extra: valueField })),
      formField({ label: st('term'), control: term }),
      h('div', { class: 'form-actions' }, calc)),
  });
  return h('div', { class: 'grid-12' },
    h('div', { class: 'span-7 stack' }, builder, policies),
    h('div', { class: 'span-5 sticky-col' }, summary));
}

/* ---------------- Data & sources ---------------- */
function dataTab(d, ctx) {
  const { can } = ctx;
  const p = d.profile;
  const masked = (v) => (p.piiMasked && v ? h('span', { class: 'row tight' }, v, tooltip(h('span', { class: 'muted', role: 'img', 'aria-label': st('masked2'), tabindex: '0' }, icon('lock', { size: 14 })), st('masked2'))) : v);
  const insurer = p.policy.insurer === 'TASCO' ? 'TASCO' : p.policy.insurer === 'OTHER' ? st('otherInsurer') : p.policy.insurer || st('unknownInsurer');
  const golden = card({ title: st('goldenRecord'), body: keyValueList([
    [st('ownerName'), masked(p.name)],
    [st('phone'), masked(p.phone)],
    [st('ownerType'), p.ownerType === 'company' ? st('company') : st('personal')],
    [st('province'), p.province],
    [st('vehicleCategory'), label('category', p.vehicle.category)],
    [st('policyExpiry'), p.policy.expiryDate ? formatDate(p.policy.expiryDate) : null],
    [st('insurer'), [insurer, p.policy.renewalClaim ? [' ', badge(st('renewedElsewhere'), 'warn')] : null]],
    [st('sources'), p.sources.map(sourceName).join(' · ')],
  ], { columns: 2 }) });
  const lineage = card({ title: st('lineage'), flush: true, body: dataTable({
    caption: st('lineage'), pagination: false, rows: p.lineage || [], rowKey: (r) => r.field,
    columns: [
      { key: 'field', label: st('field'), render: (r) => fieldName(r.field), nowrap: true },
      { key: 'source', label: st('source'), render: (r) => sourceName(r.source) },
      { key: 'confidence', label: st('confidence'), render: (r) => confidenceMeter(r.confidence) },
    ],
  }) });
  const seen = new Set();
  const cands = (p.policy.expiryCandidates || []).filter((c) => { const k = `${c.date}|${c.method}|${c.source}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const best = cands.reduce((a, c) => (!a || c.confidence > a.confidence ? c : a), null);
  const evidence = card({ title: st('expiryEvidence'), body: timeline(cands.map((c) => ({
    title: [formatDate(c.date), ' · ', label('method', c.method)],
    meta: [sourceName(c.source || c.method)],
    icon: c === best ? 'check-circle' : 'circle-dot', tone: c === best ? 'ok' : '',
    body: h('div', { class: 'row tight' }, confidenceMeter(c.confidence), c === best ? badge(st('used'), 'ok') : c.superseded || c !== best ? badge(st('outranked'), 'neutral') : null),
  })), { empty: st('expiryUnknown') }) });
  const issues = p.dataQuality.missing || [];
  const dq = card({ title: st('dqIssues'), body: issues.length ? h('ul', { class: 'issue-list' }, issues.map((type) => h('li', {},
    icon('alert-triangle', { size: 16 }), h('span', { class: 'grow' }, label('dq', type)),
    can('dq:read') ? h('a', { href: `#/dq?q=${encodeURIComponent(p.id)}` }, st('resolve')) : null))) : emptyState({ icon: 'check-circle', title: st('noDqIssues'), compact: true }) });
  return h('div', { class: 'grid-12' }, h('div', { class: 'span-7 stack' }, golden, lineage), h('div', { class: 'span-5 stack' }, evidence, dq));
}

/* ---------------- Journey ---------------- */
function journeyTab(d) {
  const tps = [...d.touchpoints].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!tps.length) return card({ body: emptyState({ icon: 'route', title: st('noTouchpoints'), compact: true }) });
  const cur = tps.findIndex((x) => x.status === 'scheduled');
  const failed = tps.findIndex((x) => x.status === 'skipped');
  const j = tps[0].journey;
  return h('div', { class: 'stack' },
    card({ title: label('journey', j), body: h('div', { class: 'stepper-scroll' }, stepper(tps.map((x) => ({ label: label('step', x.step), description: formatDate(x.dueDate) })), { current: cur === -1 ? tps.length : cur, error: failed >= 0 && failed < cur ? failed : null, label: st('touchpoints') })) }),
    card({ title: st('touchpoints'), body: timeline(tps.map((x) => ({
      title: [label('step', x.step), ' · ', (x.channel ? [x.channel] : x.channels).map((c) => label('channel', c)).join(' / ')],
      meta: x.status === 'scheduled' ? st('scheduledFor', formatDate(x.dueDate)) : st('executed', formatDate(x.executedAt || x.dueDate)),
      icon: channelIcon(x.channel || x.channels[0]),
      tone: x.status === 'done' ? 'ok' : x.status === 'skipped' ? 'warn' : x.status === 'cancelled' ? '' : 'info',
      body: h('div', { class: 'row tight' }, statusChip(x.status), x.result?.outcome ? outcomeChip(x.result.outcome) : null,
        x.status === 'skipped' && x.result?.reason ? h('span', { class: 'muted small' }, reasonText(x.result.reason)) : null),
    }))) }));
}

/* ---------------- Contact history ---------------- */
function contactTab(d, ctx) {
  const rows = [
    ...d.messages.filter((m) => !m.sessionId && m.channel !== 'voice_bot').map((m) => ({ id: m.id, at: m.sentAt, channel: m.channel, kind: 'msg', m })),
    ...d.voiceSessions.map((v) => ({ id: v.id, at: v.startedAt, channel: 'voice_bot', kind: 'call', v })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return card({ title: st('messagesCalls'), flush: true, body: dataTable({
    caption: st('contactHistory'), rows, pagination: { pageSize: 10 },
    empty: { icon: 'message-square', title: st('noContact') },
    onRowClick: (r) => (r.kind === 'call' ? ctx.navigate(`voice?call=${encodeURIComponent(r.id)}`) : null),
    columns: [
      { key: 'at', label: st('when'), nowrap: true, render: (r) => formatDateTime(r.at), value: (r) => r.at },
      { key: 'channel', label: st('channel'), nowrap: true, render: (r) => channelTag(r.channel) },
      { key: 'content', label: st('message'), render: (r) => (r.kind === 'call'
        ? h('span', { class: 'row tight' }, st('assistantCall'), outcomeChip(r.v.outcome))
        : r.m.channel === 'telesales' ? st('openInbox') : h('span', { class: 'clamp-2' }, messageText(r.m.text))) },
      { key: 'status', label: st('status'), render: (r) => (r.kind === 'call' ? badge(r.v.verified ? st('verified') : st('notVerified'), r.v.verified ? 'ok' : 'warn', { dot: true }) : statusChip(r.m.status)) },
    ],
  }) });
}

/* ---------------- Activity ---------------- */
const ACT = {
  'profile.viewed': ['eye', 'Viewed the customer record', 'Đã xem hồ sơ khách hàng'],
  'voice.call_completed': ['bot', 'Assistant call completed', 'Hoàn tất cuộc gọi trợ lý'],
  'consent.withdrawn': ['x-circle', 'Customer withdrew consent', 'Khách rút lại đồng ý liên hệ'],
  'consent.updated': ['check-circle', 'Consent preferences updated', 'Cập nhật tùy chọn đồng ý'],
  'customer.expiry_declared': ['calendar', 'Customer confirmed the expiry date in the app', 'Khách xác nhận ngày hết hạn trên ứng dụng'],
  'profile.expiry_corrected': ['edit', 'Expiry date corrected by a data steward', 'Cán bộ dữ liệu hiệu chỉnh ngày hết hạn'],
  'ecosystem.event_handled': ['activity', 'VETC ecosystem event processed', 'Đã xử lý sự kiện hệ sinh thái VETC'],
  'dq.resolved': ['check-circle', 'Data issue resolved', 'Đã xử lý vấn đề dữ liệu'],
  'dq.assigned': ['user-check', 'Data issue assigned', 'Đã phân công vấn đề dữ liệu'],
  'order.completed': ['wallet', 'Customer paid in the VETC app', 'Khách đã thanh toán trên ứng dụng VETC'],
  'claim.submitted': ['shield-check', 'Claim reported', 'Khách báo tai nạn'],
  'dsar.access_exported': ['download', 'Personal data exported on request', 'Xuất dữ liệu cá nhân theo yêu cầu'],
};
function activityTab(d) {
  const items = [];
  // Customer-facing events (messages, calls, policies) alongside staff activity from the audit trail.
  const events = [
    ...d.messages.filter((m) => m.status === 'sent' && !m.sessionId && m.channel !== 'voice_bot' && m.channel !== 'telesales').map((m) => ({
      at: m.sentAt, icon: channelIcon(m.channel), tone: '',
      title: m.step === 'quote_sent' ? st('quoteSentEvent') : st('sentVia', label('step', m.step || m.templateKey), label('channel', m.channel)), who: 'TASCO',
    })),
    ...d.policies.map((x) => ({ at: x.issuedAt || x.createdAt || x.startDate, icon: 'file-check', tone: 'ok', title: st('policyIssued', label('product', x.product)), who: 'TASCO' })),
  ];
  for (const a of d.activity) {
    const def = ACT[a.action] || ['circle-dot', 'Record updated', 'Cập nhật hồ sơ'];
    const who = a.actorName ? a.actorName.replace(/\s*\([^)]*\)$/, '') : a.actor === 'system' || !a.actor?.startsWith('U-') ? 'TASCO' : '—';
    const prev = items[items.length - 1];
    // Collapse consecutive views by the same person into one line.
    if (prev && a.action === 'profile.viewed' && prev.action === a.action && prev.who === who) continue;
    let title = vi() ? def[2] : def[1];
    if (a.action === 'voice.call_completed' && a.details?.outcome) title = `${title}: ${outcomeLabel(a.details.outcome).toLowerCase()}`;
    items.push({ action: a.action, who, title, meta: who, time: a.at, icon: def[0], tone: a.action === 'consent.withdrawn' ? 'danger' : a.action === 'order.completed' ? 'ok' : '' });
  }
  const all = [...items, ...events.map((e) => ({ ...e, meta: e.who, time: e.at }))].sort((a, b) => String(b.time).localeCompare(String(a.time)));
  return card({ body: timeline(all.slice(0, 40), { empty: st('noActivity') }) });
}

/* ---------------- Secondary actions ---------------- */
function correctExpiryDrawer(api, p, rerender) {
  const date = dateInput({ value: p.policy.expiryDate, required: true });
  const insurer = input({ maxlength: '60', value: p.policy.insurer && p.policy.insurer !== 'OTHER' ? p.policy.insurer : '' });
  const evidence = textarea({ rows: '3', maxlength: '300' });
  const fd = formField({ label: st('newExpiry'), control: date, required: true });
  const fe = formField({ label: st('evidence'), control: evidence, help: st('evidenceHelp'), required: true });
  const dr = drawer({
    title: st('correctExpiry'), subtitle: formatPlate(p.plate), size: 'sm',
    body: h('div', { class: 'stack' }, fd, formField({ label: st('insurer'), control: insurer, optional: true }), fe),
    footer: [button({ label: t('cancel'), onClick: () => dr.close() }), button({ label: st('saveCorrection'), variant: 'primary', onClick: async () => {
      const iso = date.isoValue;
      if (!iso) { fd.setError(t('invalidDate')); return; }
      if (!evidence.value.trim()) { fe.setError(t('required')); return; }
      try {
        await api.patch(`/api/customers/${encodeURIComponent(p.id)}/expiry`, { expiryDate: iso, insurer: insurer.value.trim() || undefined, evidence: evidence.value.trim() });
        toast(st('corrected'), 'ok');
        dr.close();
        rerender();
      } catch (e) { errorToast(e); }
    } })],
  });
}

export default {
  perm: 'profile:read',
  async render(main, ctx) {
    const { api, route, can, navigate, meta } = ctx;
    const id = route.params[0];
    const d = await api.get(`/api/customers/${encodeURIComponent(id)}`);
    const { profile: p, lead } = d;
    const today = meta?.today || new Date().toISOString().slice(0, 10);
    const dnc = !!p.consent.dnc;
    let tabsEl = null;

    const startCall = () => navigate(`voice?profile=${encodeURIComponent(p.id)}`);
    const sendQuote = () => tabsEl?.select('policy', true);
    const primary = can('quote:create')
      ? () => button({ label: st('sendQuote'), icon: 'send', variant: 'primary', onClick: sendQuote })
      : can('voice:operate') && lead && !dnc ? () => button({ label: st('startCall'), icon: 'phone-call', variant: 'primary', onClick: startCall }) : null;
    const menuItems = [
      can('quote:create') && can('voice:operate') && lead && !dnc ? { label: st('startCall'), icon: 'bot', onClick: startCall } : null,
      can('handoff:read') ? { label: st('openInbox'), icon: 'inbox', onClick: () => navigate('handoffs') } : null,
      can('profile:update') ? { label: st('correctExpiry'), icon: 'edit', onClick: () => correctExpiryDrawer(api, p, ctx.rerender) } : null,
      can('journeys:run') ? { label: st('simulateTopUp'), icon: 'wallet', onClick: async () => {
        try {
          const r = await api.post('/api/ecosystem/events', { type: 'vetc.wallet_topped_up', profileId: p.id });
          toast(r.actions.length ? st('eventSent') : st('noTrigger'), r.actions.length ? 'ok' : 'info');
          ctx.rerender();
        } catch (e) { errorToast(e); }
      } } : null,
    ].filter(Boolean);
    const nbaAction = can('quote:create') ? () => button({ label: st('sendQuote'), icon: 'send', size: 'sm', onClick: sendQuote })
      : can('voice:operate') && lead && !dnc ? () => button({ label: st('startCall'), icon: 'phone-call', size: 'sm', onClick: startCall }) : null;
    let kebab = null;
    if (menuItems.length) {
      kebab = iconButton({ icon: 'more-horizontal', label: t('moreActions'), variant: 'secondary' });
      dropdownMenu(kebab, menuItems, { label: t('moreActions') });
    }
    const ownerLine = [p.name || (p.ownerType === 'company' ? st('company') : null), label('category', p.vehicle.category), p.province].filter(Boolean).join(' · ');
    const tab = route.query.tab || 'overview';
    tabsEl = tabs({
      label: t('customer'), active: tab,
      items: [
        { id: 'overview', label: st('overview'), render: () => overviewTab(d, ctx, { primary: nbaAction }) },
        { id: 'policy', label: st('policyQuotes'), count: d.policies.length || null, render: () => quoteTab(d, ctx) },
        { id: 'data', label: st('dataSources'), count: (p.dataQuality.missing || []).length || null, render: () => dataTab(d, ctx) },
        { id: 'journey', label: st('journeyTab'), render: () => journeyTab(d) },
        { id: 'contact', label: st('contactHistory'), count: (d.messages.filter((m) => !m.sessionId && m.channel !== 'voice_bot').length + d.voiceSessions.length) || null, render: () => contactTab(d, ctx) },
        { id: 'activity', label: st('activity'), render: () => activityTab(d) },
      ],
    });
    mount(main,
      pageHeader({
        breadcrumb: [{ label: t('groupSell') }, { label: t('leads'), href: '#/leads' }, { label: formatPlate(p.plate) }],
        back: { href: '#/leads', label: t('leads') },
        title: h('span', { class: 'c360-title' }, h('span', { class: 'plate-tag lg' }, formatPlate(p.plate)), dnc ? badge(st('dnc'), 'danger', { icon: 'x-circle' }) : null),
        subtitle: ownerLine,
        actions: [kebab, primary ? primary() : null].filter(Boolean),
      }),
      dnc ? banner({ tone: 'danger', title: st('dnc'), text: st('dncText') }) : null,
      summaryCard(p, lead, d, today),
      tabsEl);
  },
};
