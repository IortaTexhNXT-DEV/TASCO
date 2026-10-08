import { h, mount } from '../../shared/dom.js';
import { t, label } from '../../shared/i18n.js';
import {
  pageHeader, card, button, dataTable, kpiStrip, kpiTile, drawer, keyValueList, badge, segmented, formField, input, selectInput, dateInput,
  barChart, banner, statusChip, emptyState, toast, errorToast, formatNumber, formatPercent, formatDate, formatDateTime, icon,
} from '../ui.js';
import { st, outcomeLabel, reasonText } from './sales-common.js';

const JOURNEYS = ['renewal', 'conquest', 'new_vehicle', 'lapsed_uninsured'];
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0);
const isJourney = (r) => r.kind === 'journey_run';
const nameOf = (r) => (isJourney(r) ? st('journeyRunName', formatDate(r.result?.date)) : r.result?.name || st('untitled'));
const reachedOf = (r) => (isJourney(r) ? r.result?.done || 0 : r.result?.called || 0);
/** Group engine reasons ("no call consent") into business sentences with counts. */
function heldBack(map) {
  const out = {};
  for (const [k, v] of Object.entries(map || {})) { const lab = reasonText(k); out[lab] = (out[lab] || 0) + v; }
  return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([lab, value]) => ({ label: lab, value }));
}
function audienceText(a) {
  if (!a) return '—';
  return [a.tier ? label('tier', a.tier) : null, a.journey ? label('journey', a.journey) : st('allJourneys'), a.region || st('allRegions')].filter(Boolean).join(' · ');
}
function audienceChips(a, { wrap = false } = {}) {
  if (!a) return null;
  return h('span', { class: 'row tight audience-cell' }, a.tier ? badge(label('tier', a.tier), a.tier === 'hot' ? 'danger' : 'warn') : null,
    h('span', { class: wrap ? 'cell-sub' : 'cell-sub trunc-1' }, audienceText({ ...a, tier: null })));
}
/** Business time of a run (the scheduled calling/sending time), falling back to when it was recorded. */
const whenOf = (r) => r.result?.at || r.startedAt;

function resultsDrawer(r) {
  const res = r.result || {};
  const body = isJourney(r)
    ? [
      keyValueList([[st('channel'), st('channelJourney')], [st('started'), formatDateTime(whenOf(r))], [st('by'), r.by || '—'],
        [st('dueNow'), formatNumber(res.due)], [st('touchpointsDone'), formatNumber(res.done)], [st('touchpointsSkipped'), formatNumber(res.skipped)]], { columns: 3 }),
      card({ title: st('byChannel'), body: barChart({ title: st('byChannel'), data: Object.entries(res.byChannel || {}).map(([k, v]) => ({ label: label('channel', k), value: v })).sort((a, b) => b.value - a.value) }) }),
      card({ title: st('byJourney'), body: barChart({ title: st('byJourney'), data: Object.entries(res.byJourney || {}).map(([k, v]) => ({ label: label('journey', k), value: v })).sort((a, b) => b.value - a.value) }) }),
    ]
    : [
      keyValueList([[st('channel'), st('channelVoice')], [st('started'), formatDateTime(whenOf(r))], [st('by'), r.by || '—'],
        [st('audience'), audienceChips(res.audience, { wrap: true })], [st('maxCalls'), formatNumber(res.limit)], [st('reached'), formatNumber(res.called)]], { columns: 3 }),
      card({ title: st('outcomes'), body: barChart({ title: st('outcomes'), data: Object.entries(res.outcomes || {}).map(([k, v]) => ({ label: outcomeLabel(k), value: v })).sort((a, b) => b.value - a.value) }) }),
      sum(res.skipped) ? card({ title: st('heldBack'), body: barChart({ title: st('heldBack'), data: heldBack(res.skipped) }) }) : null,
    ];
  drawer({ title: nameOf(r), subtitle: st('campaignResults'), size: 'lg', body: h('div', { class: 'stack' }, body) });
}

function newCampaignDrawer(ctx, regions, onDone) {
  const { api, meta } = ctx;
  const today = meta?.today || new Date().toISOString().slice(0, 10);
  let channel = 'voice';
  const name = input({ maxlength: '80' });
  const tier = segmented({ options: [['hot', label('tier', 'hot')], ['warm', label('tier', 'warm')]], value: 'hot', label: st('audienceTier'), onChange: () => schedulePreview() });
  const journey = selectInput([['', st('allJourneys')], ...JOURNEYS.map((j) => [j, label('journey', j)])], '');
  const region = selectInput([['', st('allRegions')], ...regions.map((r) => [r, r])], '');
  const limit = input({ type: 'number', min: '1', max: '200', value: '20', inputmode: 'numeric' });
  const date = dateInput({ value: today, onChange: () => schedulePreview() });
  const time = input({ type: 'time', value: '10:00' });
  [journey, region, limit, time].forEach((el) => el.addEventListener('change', () => schedulePreview()));
  const limitField = formField({ label: st('maxCalls'), control: limit, help: st('limitHelp'), required: true });
  const previewEl = h('div', { class: 'preview-panel', 'aria-live': 'polite' });
  const voiceFields = h('div', { class: 'stack' },
    formField({ label: st('name'), control: name, help: st('nameHelp'), optional: true }),
    h('fieldset', { class: 'plain form-section' }, h('legend', {}, st('audience')),
      h('div', { class: 'grid-3' }, formField({ label: st('audienceTier'), control: tier }), formField({ label: st('audienceJourney'), control: journey }), formField({ label: st('audienceRegion'), control: region }))),
    h('fieldset', { class: 'plain form-section' }, h('legend', {}, st('schedule')),
      h('div', { class: 'grid-3' }, formField({ label: st('scheduleDate'), control: date }), formField({ label: st('scheduleTime'), control: time }), limitField),
      h('p', { class: 'help-line' }, icon('clock', { size: 14 }), st('scheduleHelp'))),
  );
  const journeyFields = h('div', { class: 'stack' }, banner({ tone: 'info', text: st('messagingInfo') }));
  const fieldsEl = h('div', { class: 'stack' });
  const atIso = () => {
    const d = date.isoValue || today;
    const [hh, mm] = (time.value || '10:00').split(':').map(Number);
    const at = new Date(`${d}T00:00:00Z`);
    at.setUTCHours(hh - 7, mm); // Asia/Ho_Chi_Minh
    return at.toISOString();
  };
  const body = () => ({ tier: tier.value, journey: journey.value || undefined, region: region.value || undefined, limit: Math.max(1, Math.min(200, Number(limit.value) || 20)), at: atIso() });

  let timer = null;
  let seq = 0;
  function schedulePreview() { clearTimeout(timer); timer = setTimeout(preview, 250); }
  async function preview() {
    const my = ++seq;
    mount(previewEl, h('p', { class: 'muted small' }, st('previewLoading')));
    try {
      if (channel === 'journey') {
        const ov = await api.get('/api/dashboard/overview');
        if (my !== seq) return;
        const due = Object.entries(ov.journeys?.dueToday || {}).filter(([k]) => k !== 'null');
        mount(previewEl, card({ title: st('preview'), body: due.length
          ? barChart({ title: st('dueNow'), data: due.map(([k, v]) => ({ label: label('journey', k), value: v })) })
          : emptyState({ icon: 'check-circle', title: st('nothingDueToday'), text: st('nothingDueTodayHint'), compact: true }) }));
        return;
      }
      const p = await api.post('/api/voice/campaign', { ...body(), dryRun: true });
      if (my !== seq) return;
      const held = heldBack(p.blocked);
      mount(previewEl, card({ title: st('preview'), class: 'preview-card', body: h('div', { class: 'stack' },
        h('div', { class: 'funnel' },
          [[st('inAudience'), p.audience], [st('eligible'), p.eligible], [st('willCall'), p.willCall]].map(([l, v], i) => h('div', { class: `funnel-step s${i + 1}` }, h('span', { class: 'funnel-value' }, formatNumber(v)), h('span', { class: 'funnel-label' }, l)))),
        held.length ? h('div', { class: 'mini-list' }, h('p', { class: 'mini-list-title' }, st('heldBack')),
          held.map((x) => h('div', { class: 'mini-row' }, h('span', {}, x.label), h('strong', { class: 'num' }, formatNumber(x.value))))) : null,
        p.routedToFleet ? h('p', { class: 'help-line' }, icon('building', { size: 14 }), `${st('routedFleet')}: ${formatNumber(p.routedToFleet)}`) : null) }));
    } catch (e) { if (my === seq) mount(previewEl, banner({ tone: 'danger', text: e.message })); }
  }
  const channelSeg = segmented({
    label: st('channel'), value: 'voice',
    options: [['voice', st('channelVoice'), 'mic'], ['journey', st('channelJourney'), 'send']],
    onChange: (v) => { channel = v; mount(fieldsEl, v === 'voice' ? voiceFields : journeyFields, previewEl); preview(); },
  });
  mount(fieldsEl, voiceFields, previewEl);
  const dr = drawer({
    title: st('newCampaign'), size: 'lg',
    body: h('div', { class: 'stack' }, formField({ label: st('channel'), control: channelSeg }), fieldsEl),
    footer: [
      button({ label: t('cancel'), onClick: () => dr.close() }),
      button({ label: st('launch'), icon: 'play', variant: 'primary', onClick: async () => {
        try {
          if (channel === 'journey') {
            const r = await api.post('/api/journeys/run', { date: date.isoValue || today, at: atIso() });
            toast(st('runDone', formatNumber(r.done), formatNumber(r.skipped)), 'ok', { title: st('launched') });
          } else {
            const n = Number(limit.value);
            if (!(n >= 1 && n <= 200)) { limitField.setError(st('limitHelp')); limit.focus(); return; }
            const r = await api.post('/api/voice/campaign', { ...body(), name: name.value.trim() || undefined });
            toast(`${st('reached')}: ${formatNumber(r.called)} · ${st('hotHandoffs')}: ${formatNumber(r.outcomes.hot_handoff || 0)}`, 'ok', { title: st('launched') });
          }
          ctx.refreshSignals?.();
          dr.close();
          onDone();
        } catch (e) { errorToast(e); }
      } }),
    ],
  });
  preview();
}

export default {
  perm: 'journeys:run',
  async render(main, ctx) {
    const { api, route, navigate } = ctx;
    const [runs, leadsMeta] = await Promise.all([api.get('/api/campaigns?limit=100'), api.get('/api/leads?limit=1')]);
    const items = runs.items;
    const voiceRuns = items.filter((r) => !isJourney(r));
    const reached = items.reduce((a, r) => a + reachedOf(r), 0);
    const hot = voiceRuns.reduce((a, r) => a + (r.result?.outcomes?.hot_handoff || 0), 0);
    const links = voiceRuns.reduce((a, r) => a + (r.result?.outcomes?.link_sent || 0), 0);
    const called = voiceRuns.reduce((a, r) => a + (r.result?.called || 0), 0);
    const reload = () => navigate(`campaigns?r=${Date.now()}`);
    const open = () => newCampaignDrawer(ctx, leadsMeta.facets?.regions || [], reload);
    const table = dataTable({
      caption: t('campaigns'), rows: items, pagination: { pageSize: 25 },
      onRowClick: resultsDrawer,
      columns: [
        { key: 'name', label: st('campaignName'), primary: true, sortable: true, value: nameOf, width: '26%', render: (r) => h('span', { class: 'cell-stack' }, h('span', { class: 'strong campaign-name' }, nameOf(r)), h('span', { class: 'channel-sub' }, icon(isJourney(r) ? 'send' : 'mic', { size: 13 }), [isJourney(r) ? st('channelJourney') : st('channelVoice'), r.by].filter(Boolean).join(' · '))) },
        { key: 'audience', label: st('audience'), render: (r) => (isJourney(r) ? h('span', { class: 'muted' }, st('allJourneys')) : audienceChips(r.result?.audience)), exportValue: (r) => (isJourney(r) ? st('allJourneys') : audienceText(r.result?.audience)) },
        { key: 'startedAt', label: st('started'), sortable: true, nowrap: true, value: whenOf, render: (r) => formatDateTime(whenOf(r)), exportValue: (r) => formatDateTime(whenOf(r)) },
        { key: 'reached', label: st('reached'), align: 'right', sortable: true, value: reachedOf, render: (r) => formatNumber(reachedOf(r)) },
        { key: 'hot', label: st('hotHandoffs'), align: 'right', render: (r) => (isJourney(r) ? '—' : formatNumber(r.result?.outcomes?.hot_handoff || 0)) },
        { key: 'links', label: st('linksSent'), align: 'right', render: (r) => (isJourney(r) ? '—' : formatNumber(r.result?.outcomes?.link_sent || 0)) },
        { key: 'status', label: st('status'), render: (r) => statusChip(r.status) },
      ],
      toolbar: { search: true, export: { filename: 'campaigns.csv' } },
      empty: { icon: 'megaphone', title: st('noCampaigns'), text: st('noCampaignsHint'), action: button({ label: st('newCampaign'), icon: 'plus', onClick: open }) },
    });
    mount(main,
      pageHeader({ title: t('campaigns'), subtitle: st('campaignsSubtitle'), actions: [button({ label: st('newCampaign'), icon: 'plus', variant: 'primary', onClick: open })] }),
      items.length ? kpiStrip([
        kpiTile({ label: st('campaignsRun'), icon: 'megaphone', value: formatNumber(items.length) }),
        reached ? kpiTile({ label: st('customersReached'), icon: 'users', value: formatNumber(reached) }) : null,
        hot ? kpiTile({ label: st('hotHandoffs'), icon: 'inbox', value: formatNumber(hot), hint: called ? st('ofCalls', formatPercent(hot / called)) : null }) : null,
        links ? kpiTile({ label: st('linksSent'), icon: 'send', value: formatNumber(links), hint: called ? st('ofCalls', formatPercent(links / called)) : null }) : null,
      ].filter(Boolean)) : null,
      card({ flush: true, body: table }));
    if (route.query.new) { history.replaceState(null, '', '#/campaigns'); open(); }
    if (route.query.id) { const r = items.find((x) => x.id === route.query.id); history.replaceState(null, '', '#/campaigns'); if (r) resultsDrawer(r); }
  },
};
