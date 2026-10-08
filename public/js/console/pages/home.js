import { h, mount } from '../../shared/dom.js';
import { t, label, getLang } from '../../shared/i18n.js';
import {
  pageHeader, kpiStrip, kpiTile, card, button, icon, lineChart, donutChart, barChart, segmented, meter, progress, dataTable, emptyState,
  formatMoney, formatNumber, formatPercent, formatDate, plateTag, tierBadge, toast, errorToast,
} from '../ui.js';
import { st, greeting, expiryCell, vehicleCell, scoreBar, slaChip, slaState, outcomeLabel, handoffReason, handoffStatusChip, relTime } from './sales-common.js';

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (Number(b) || 0), 0);
const entries = (o, group, { skipNull = true } = {}) => Object.entries(o || {})
  .filter(([k, v]) => v > 0 && (!skipNull || (k !== 'null' && k !== '')))
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => ({ label: group ? label(group, k === 'null' ? null : k) : k, value: v, code: k }));
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return getLang() === 'vi' ? `T${m}/${String(y).slice(2)}` : `${new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ’${String(y).slice(2)}`;
};
/** Only tiles with a meaningful (non-zero) value are shown. */
const tiles = (list) => kpiStrip(list.filter(Boolean));

/* ---------------- Executive ---------------- */
function pipelineCard(ov) {
  const p = [...(ov.pipeline || [])];
  while (p.length > 3 && !(p[p.length - 1].retention + p[p.length - 1].newBusiness)) p.pop(); // no empty tail months
  const max = Math.max(...p.map((m) => m.retention + m.newBusiness), 0);
  while (p.length > 3 && p[p.length - 1].retention + p[p.length - 1].newBusiness < max * 0.05) p.pop(); // horizon edge
  const holder = h('div', {});
  const draw = (metric) => mount(holder, lineChart({
    title: st('pipelineTitle'), height: 196,
    labels: p.map((m) => monthLabel(m.month)),
    format: metric === 'premium' ? (v) => formatMoney(v, { compact: true }) : formatNumber,
    series: metric === 'premium'
      ? [{ name: st('seriesNewBusiness'), values: p.map((m) => m.newBusinessPremium) }, { name: st('seriesRenewal'), values: p.map((m) => m.retentionPremium) }]
      : [{ name: st('seriesNewBusiness'), values: p.map((m) => m.newBusiness) }, { name: st('seriesRenewal'), values: p.map((m) => m.retention) }],
  }));
  const seg = segmented({ options: [['policies', st('pipelinePolicies')], ['premium', st('pipelinePremium')]], value: 'policies', onChange: draw, label: st('pipelineTitle') });
  draw('policies');
  return card({ title: st('pipelineTitle'), actions: [seg], body: holder });
}

function journeyMixCard(ov) {
  return card({ title: st('journeyMix'), body: donutChart({ title: st('journeyMix'), data: entries(ov.leads.byJourney, 'journey'), size: 136, centerLabel: st('leadsCol') }) });
}

function voiceCard(ov) {
  const o = ov.engagement.voiceOutcomes || {};
  const calls = sum(o);
  if (!calls) return null;
  return card({ title: st('voicePerformance'), body: h('div', { class: 'stack' },
    h('div', { class: 'stat-row' },
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, formatNumber(calls)), h('span', { class: 'stat-label' }, st('callsMade'))),
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, formatNumber(o.hot_handoff || 0)), h('span', { class: 'stat-label' }, st('hotHandoffs'))),
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, formatNumber(o.link_sent || 0)), h('span', { class: 'stat-label' }, st('linksSent')))),
    h('div', { class: 'stack-sm' }, entries(o).slice(0, 4).map((d) => meter({ value: d.value, max: calls, label: outcomeLabel(d.code), valueText: `${formatNumber(d.value)} · ${formatPercent(d.value / calls)}` })))) });
}

function dataRepairCard(ov, can, navigate) {
  const dq = ov.dataQuality;
  const usable = ov.base.profilesWithUsableData;
  const resolved = dq.byStatus?.resolved || 0;
  const top = entries(dq.byType, 'dq').slice(0, 3);
  return card({
    title: st('dataRepair'),
    actions: can('dq:read') ? [button({ label: st('viewQueue'), size: 'sm', variant: 'ghost', iconRight: 'chevron-right', onClick: () => navigate('dq') })] : null,
    body: h('div', { class: 'stack' },
      progress({ value: usable, max: ov.base.profiles || 1, label: st('usableExpiry') }),
      resolved ? progress({ value: resolved, max: resolved + dq.openIssues, label: `${st('resolvedIssues')} · ${formatNumber(resolved)}`, tone: 'ok' }) : null,
      h('div', { class: 'mini-list' }, h('p', { class: 'mini-list-title' }, st('topIssues')),
        top.map((x) => h('div', { class: 'mini-row' }, h('span', {}, x.label), h('strong', { class: 'num' }, formatNumber(x.value)))))),
  });
}

function salesChannelCard(ov) {
  const byChannel = entries(ov.sales.byChannel, 'channel');
  // One channel only → show the product mix instead (a 100% donut says nothing).
  const useProducts = byChannel.length < 2;
  const data = useProducts ? entries(ov.sales.activePoliciesByProduct, 'product') : byChannel;
  if (!data.length) return null;
  const title = useProducts ? st('policiesByProduct') : st('salesByChannel');
  return card({ title, body: donutChart({ title, data, size: 136, centerLabel: st('policiesSold') }) });
}

function executive(ov, ctx) {
  const premium90 = (ov.pipeline || []).slice(0, 3).reduce((a, m) => a + m.retentionPremium + m.newBusinessPremium, 0);
  const vehicles90 = (ov.pipeline || []).slice(0, 3).reduce((a, m) => a + m.retention + m.newBusiness, 0);
  const sold = ov.sales.orders;
  return [
    tiles([
      { show: sold > 0, node: kpiTile({ label: st('gwp'), icon: 'wallet', value: formatMoney(ov.sales.gwp, { compact: true }), hint: st('gwpHint', formatNumber(sold)) }) },
      { show: premium90 > 0, node: kpiTile({ label: st('premiumDue90'), icon: 'calendar', value: formatMoney(premium90, { compact: true }), hint: st('premiumDueHint', formatNumber(vehicles90)), sparkline: (ov.pipeline || []).map((m) => m.retentionPremium + m.newBusinessPremium) }) },
      { show: ov.base.expiring30 > 0, node: kpiTile({ label: st('expiring30'), icon: 'clock', value: formatNumber(ov.base.expiring30), hint: st('expiringHint') }) },
      { show: ov.base.lapsedUninsured > 0, node: kpiTile({ label: st('uninsured'), icon: 'alert-triangle', value: formatNumber(ov.base.lapsedUninsured), hint: st('uninsuredHint') }) },
      { show: ov.economics.savingVsTelesales > 0, node: kpiTile({ label: st('voiceSaving'), icon: 'mic', value: formatMoney(ov.economics.savingVsTelesales, { compact: true }), hint: st('voiceSavingHint', formatMoney(ov.economics.equivalentTelesalesCost, { compact: true })) }) },
    ].filter((x) => x.show).map((x) => x.node)),
    h('div', { class: 'grid-12' },
      h('div', { class: 'span-8' }, pipelineCard(ov)),
      h('div', { class: 'span-4' }, journeyMixCard(ov))),
    h('div', { class: 'grid-12' },
      h('div', { class: 'span-4' }, salesChannelCard(ov) || card({ title: st('salesByChannel'), body: emptyState({ icon: 'wallet', title: t('empty'), compact: true }) })),
      h('div', { class: 'span-4' }, voiceCard(ov) || card({ title: st('voicePerformance'), body: emptyState({ icon: 'mic', title: st('noCalls'), compact: true }) })),
      h('div', { class: 'span-4' }, dataRepairCard(ov, ctx.can, ctx.navigate))),
  ];
}

/* ---------------- Campaign manager ---------------- */
function campaignManager(ov, campaigns, ctx) {
  const { api, navigate, meta, rerender } = ctx;
  const dueToday = sum(ov.journeys?.dueToday);
  const dueWeek = sum(ov.journeys?.dueNext7Days);
  const msgs = sum(ov.engagement.messagesByChannel);
  const calls = sum(ov.engagement.voiceOutcomes);
  const journeys = entries(ov.leads.byJourney, 'journey');
  const pipeTable = dataTable({
    caption: st('pipelineByJourney'), pagination: false, rowKey: (r) => r.code,
    columns: [
      { key: 'label', label: st('journey'), primary: true, nowrap: true },
      { key: 'value', label: st('leadsCol'), align: 'right', render: (r) => formatNumber(r.value) },
      dueToday ? { key: 'today', label: st('dueToday'), align: 'right', render: (r) => formatNumber(ov.journeys?.dueToday?.[r.code] || 0) } : null,
      { key: 'week', label: st('dueWeek'), align: 'right', render: (r) => formatNumber(ov.journeys?.dueNext7Days?.[r.code] || 0) },
      { key: 'share', label: '', width: '28%', render: (r) => meter({ value: r.value, max: journeys[0]?.value || 1 }) },
    ].filter(Boolean),
    rows: journeys,
    onRowClick: (r) => navigate(`leads?journey=${encodeURIComponent(r.code)}`),
  });
  const runBtn = button({ label: st('runDueNow'), icon: 'play', variant: dueToday ? 'primary' : 'secondary', size: 'sm', onClick: async () => {
    try {
      const r = await api.post('/api/journeys/run', { date: meta.today });
      toast(st('runDone', formatNumber(r.done), formatNumber(r.skipped)), 'ok');
      rerender();
    } catch (e) { errorToast(e); }
  } });
  const dueCard = card({
    title: dueToday ? st('dueToday') : st('dueWeek'), actions: [runBtn],
    body: dueToday
      ? barChart({ title: st('dueToday'), data: entries(ov.journeys.dueToday, 'journey') })
      : dueWeek
        ? h('div', { class: 'stack' }, h('p', { class: 'help-line' }, icon('check-circle', { size: 14 }), st('nothingDueToday')), barChart({ title: st('dueWeek'), data: entries(ov.journeys.dueNext7Days, 'journey') }))
        : emptyState({ icon: 'check-circle', title: st('nothingDueToday'), compact: true }),
  });
  const camp = (campaigns || []).slice(0, 5);
  const perf = dataTable({
    caption: st('campaignPerformance'), pagination: false,
    columns: [
      { key: 'name', label: st('campaignName'), primary: true, render: (r) => h('span', { class: 'cell-stack' }, h('span', {}, r.kind === 'journey_run' ? st('journeyRunName', formatDate(r.result?.date)) : r.result?.name || st('untitled')), h('span', { class: 'cell-sub' }, r.kind === 'journey_run' ? st('channelJourney') : st('channelVoice'))) },
      { key: 'reached', label: st('reached'), align: 'right', render: (r) => formatNumber(r.kind === 'journey_run' ? r.result?.done : r.result?.called) },
      { key: 'hot', label: st('hotHandoffs'), align: 'right', render: (r) => (r.kind === 'journey_run' ? '—' : formatNumber(r.result?.outcomes?.hot_handoff || 0)) },
      { key: 'when', label: st('started'), nowrap: true, render: (r) => relTime(r.startedAt) },
    ],
    rows: camp,
    empty: { icon: 'megaphone', title: st('noCampaigns') },
    onRowClick: (r) => navigate(`campaigns?id=${encodeURIComponent(r.id)}`),
  });
  return [
    tiles([
      ov.leads.byTier.hot ? kpiTile({ label: st('hotLeads'), icon: 'trending-up', value: formatNumber(ov.leads.byTier.hot), hint: st('warmCount', formatNumber(ov.leads.byTier.warm || 0)), onClick: () => navigate('leads?tier=hot') }) : null,
      dueWeek ? kpiTile({ label: dueToday ? st('dueToday') : st('dueWeek'), icon: 'calendar', value: formatNumber(dueToday || dueWeek), hint: `${formatNumber(ov.journeys.scheduled)} ${st('scheduledTouchpoints').toLowerCase()}` }) : null,
      msgs ? kpiTile({ label: st('messagesSent'), icon: 'send', value: formatNumber(msgs) }) : null,
      calls ? kpiTile({ label: st('callsMade'), icon: 'mic', value: formatNumber(calls), hint: `${formatNumber(ov.engagement.voiceOutcomes.hot_handoff || 0)} ${st('hotHandoffs').toLowerCase()}` }) : null,
      ov.sales.orders ? kpiTile({ label: st('policiesSold'), icon: 'file-check', value: formatNumber(ov.sales.orders), hint: formatMoney(ov.sales.gwp, { compact: true }) }) : null,
    ].filter(Boolean)),
    h('div', { class: 'grid-12' },
      h('div', { class: 'span-7' }, card({ title: st('pipelineByJourney'), flush: true, body: pipeTable })),
      h('div', { class: 'span-5' }, dueCard)),
    h('div', { class: 'grid-12' },
      h('div', { class: 'span-7' }, card({ title: st('campaignPerformance'), flush: true, actions: [button({ label: st('newCampaign'), icon: 'plus', size: 'sm', onClick: () => navigate('campaigns?new=1') })], body: perf })),
      h('div', { class: 'span-5' }, card({ title: st('messagesByChannel'), body: donutChart({ title: st('messagesByChannel'), data: entries(ov.engagement.messagesByChannel, 'channel'), size: 140 }) }))),
  ];
}

/* ---------------- Supervisor ---------------- */
async function loadHandoffs(api, statuses) {
  const res = await Promise.all(statuses.map((s) => api.get(`/api/handoffs?status=${s}&limit=500`)));
  return Object.fromEntries(statuses.map((s, i) => [s, res[i]]));
}

function supervisor(ov, ho, ctx) {
  const { navigate } = ctx;
  const active = [...ho.open.items, ...ho.claimed.items, ...ho.callback.items];
  const waiting = [...ho.open.items, ...ho.callback.items];
  const breached = waiting.filter((x) => slaState(x.slaDueAt, x.status) === 'breached').length;
  const soon = waiting.filter((x) => slaState(x.slaDueAt, x.status) === 'due_soon').length;
  const won = ho.won.total;
  const lost = ho.lost.total;
  const byAgent = {};
  const byRegion = {};
  for (const x of active) {
    const a = x.assignedToName || st('unassigned');
    byAgent[a] = (byAgent[a] || 0) + 1;
    byRegion[x.region || '—'] = (byRegion[x.region || '—'] || 0) + 1;
  }
  const watch = [...waiting].sort((a, b) => new Date(a.slaDueAt) - new Date(b.slaDueAt)).slice(0, 6);
  return [
    tiles([
      kpiTile({ label: st('openHandoffs'), icon: 'inbox', value: formatNumber(active.length), hint: `${formatNumber(ho.open.total)} ${st('statusOpen').toLowerCase()} · ${formatNumber(ho.callback.total)} ${st('statusCallback').toLowerCase()}`, onClick: () => navigate('handoffs') }),
      waiting.length ? kpiTile({ label: st('withinSla'), icon: 'clock', value: formatPercent((waiting.length - breached) / waiting.length), hint: st('slaHint', formatNumber(breached), formatNumber(soon)) }) : null,
      won + lost ? kpiTile({ label: st('winRate'), icon: 'trending-up', value: formatPercent(won / (won + lost)), hint: st('wonLost', formatNumber(won), formatNumber(lost)) }) : null,
      ov.leads.byTier.hot ? kpiTile({ label: st('hotLeads'), icon: 'users', value: formatNumber(ov.leads.byTier.hot), hint: st('warmCount', formatNumber(ov.leads.byTier.warm || 0)), onClick: () => navigate('leads?tier=hot') }) : null,
      ov.sales.orders ? kpiTile({ label: st('policiesSold'), icon: 'file-check', value: formatNumber(ov.sales.orders), hint: formatMoney(ov.sales.gwp, { compact: true }) }) : null,
    ].filter(Boolean)),
    h('div', { class: 'grid-12' },
      h('div', { class: 'span-7' }, card({
        title: st('slaWatchlist'), flush: true,
        actions: [button({ label: st('workQueue'), size: 'sm', variant: 'ghost', iconRight: 'chevron-right', onClick: () => navigate('handoffs') })],
        body: dataTable({
          caption: st('slaWatchlist'), pagination: false, rows: watch,
          empty: { icon: 'check-circle', title: st('noHandoffs'), text: st('noHandoffsHint') },
          onRowClick: (r) => navigate(`handoffs?id=${encodeURIComponent(r.id)}`),
          columns: [
            { key: 'plate', label: st('vehicle'), render: (r) => vehicleCell(r.plate, r.name) },
            { key: 'sla', label: 'SLA', nowrap: true, render: (r) => slaChip(r.slaDueAt, r.status) },
            { key: 'reason', label: st('reason'), render: (r) => h('span', { class: 'cell-stack cell-w' }, h('span', {}, handoffReason(r.outcome)),
              h('span', { class: 'cell-sub' }, r.assignedToName ? `${st('assignedTo')}: ${r.assignedToName}` : st('unassigned'))) },
          ],
        }),
      })),
      h('div', { class: 'span-5 stack' },
        card({ title: st('openByAgent'), body: barChart({ title: st('openByAgent'), data: entries(byAgent).slice(0, 6) }) }),
        card({ title: st('openByRegion'), body: barChart({ title: st('openByRegion'), data: entries(byRegion).slice(0, 6) }) }))),
  ];
}

/* ---------------- Telesales agent ---------------- */
function agentView(data, ctx) {
  const { navigate, meta, user } = ctx;
  const { mine, callbacks, unassigned, hot } = data;
  const myOpen = mine.items.filter((x) => ['open', 'claimed'].includes(x.status));
  const list = (items, emptyTitle, emptyText) => (items.length ? h('ul', { class: 'work-list' }, items.slice(0, 6).map((x) => h('li', {},
    h('a', { href: `#/handoffs?id=${encodeURIComponent(x.id)}`, class: 'work-item' },
      plateTag(x.plate),
      h('span', { class: 'work-main' }, h('span', { class: 'work-title' }, x.name || '—'), h('span', { class: 'work-sub' }, handoffReason(x.outcome))),
      slaChip(x.slaDueAt, x.status) || handoffStatusChip(x.status),
      h('span', { class: 'work-time' }, relTime(x.createdAt)))))) : emptyState({ icon: 'inbox', title: emptyTitle, text: emptyText, compact: true }));
  const toCall = [...myOpen, ...unassigned];
  return [
    tiles([
      kpiTile({ label: st('myOpenHandoffs'), icon: 'phone-call', value: formatNumber(toCall.length), hint: `${formatNumber(myOpen.length)} ${st('statusClaimed').toLowerCase()}`, onClick: () => navigate('handoffs') }),
      callbacks.total ? kpiTile({ label: st('callbacksDue'), icon: 'calendar', value: formatNumber(callbacks.total), onClick: () => navigate('handoffs?status=callback') }) : null,
      unassigned.length ? kpiTile({ label: st('newHotLeads'), icon: 'inbox', value: formatNumber(unassigned.length), hint: user.region && user.region !== 'ALL' ? user.region : null, onClick: () => navigate('handoffs') }) : null,
      hot.total ? kpiTile({ label: st('hotLeads'), icon: 'trending-up', value: formatNumber(hot.total), onClick: () => navigate('leads?tier=hot') }) : null,
    ].filter(Boolean)),
    h('div', { class: 'grid-12' },
      h('div', { class: 'span-6' }, card({ title: st('myOpenHandoffs'), actions: [button({ label: st('workQueue'), size: 'sm', variant: 'ghost', iconRight: 'chevron-right', onClick: () => navigate('handoffs') })], body: list(toCall.slice(0, 6), st('noHandoffs'), st('noHandoffsHint')) })),
      h('div', { class: 'span-6' }, card({ title: st('callbacksDue'), body: list(callbacks.items, st('noCallbacks'), st('noCallbacksHint')) }))),
    card({
      title: st('myHotLeads'), flush: true,
      actions: [button({ label: st('allLeads'), size: 'sm', variant: 'ghost', iconRight: 'chevron-right', onClick: () => navigate('leads?tier=hot') })],
      body: dataTable({
        caption: st('myHotLeads'), pagination: false, rows: hot.items.slice(0, 6),
        onRowClick: (r) => navigate(`customer/${encodeURIComponent(r.id)}`),
        columns: [
          { key: 'v', label: st('vehicle'), render: (r) => vehicleCell(r.plate, r.owner, { company: r.ownerType === 'company' }) },
          { key: 'score', label: st('score'), render: (r) => scoreBar(r.score, r.tier) },
          { key: 'tier', label: st('tier'), render: (r) => tierBadge(r.tier) },
          { key: 'exp', label: st('expiry'), render: (r) => expiryCell(r.expiryDate, r.daysToExpiry, meta.today) },
          { key: 'nba', label: st('nba'), render: (r) => label('nba', r.nextBestAction?.action) },
          { key: 'premium', label: st('premium'), align: 'right', render: (r) => formatMoney(r.premium) },
        ],
      }),
    }),
  ];
}

/* ---------------- Others ---------------- */
function generic(ov, ctx) {
  const { can, navigate } = ctx;
  return [
    tiles([
      kpiTile({ label: st('vehicles'), icon: 'car', value: formatNumber(ov.base.profiles), hint: st('vehiclesHint', formatNumber(ov.base.profilesWithUsableData)) }),
      ov.base.expiring30 ? kpiTile({ label: st('expiring30'), icon: 'clock', value: formatNumber(ov.base.expiring30), hint: st('expiringHint') }) : null,
      ov.base.lapsedUninsured ? kpiTile({ label: st('uninsured'), icon: 'alert-triangle', value: formatNumber(ov.base.lapsedUninsured), hint: st('uninsuredHint') }) : null,
      ov.sales.orders ? kpiTile({ label: st('policiesSold'), icon: 'file-check', value: formatNumber(ov.sales.orders), hint: formatMoney(ov.sales.gwp, { compact: true }) }) : null,
      ov.dataQuality.profilesWithOpenIssues ? kpiTile({ label: st('vehiclesWithIssues'), icon: 'database', value: formatNumber(ov.dataQuality.profilesWithOpenIssues), hint: `${formatNumber(ov.dataQuality.openIssues)} ${st('openIssues').toLowerCase()}`, onClick: can('dq:read') ? () => navigate('dq') : undefined }) : null,
    ].filter(Boolean)),
    h('div', { class: 'grid-12' },
      h('div', { class: 'span-8' }, pipelineCard(ov)),
      h('div', { class: 'span-4' }, dataRepairCard(ov, can, navigate))),
  ];
}

function quickLinks(ctx) {
  const { can } = ctx;
  const links = [['claims', 'claims:read', 'shield-check'], ['partners', 'partners:manage', 'handshake'], ['ops', 'ops:read', 'activity'], ['users', 'users:manage', 'user-cog'], ['dq', 'dq:read', 'database']]
    .filter(([, p]) => can(p));
  return card({ title: st('quickLinks'), body: h('div', { class: 'chip-row' }, links.map(([r, , ic]) => button({ label: t(r), icon: ic, onClick: () => ctx.navigate(r) }))) });
}

export default {
  // Everyone signed in may open the dashboard; the content adapts to the role (agents get "My work today").
  perm: null,
  async render(main, ctx) {
    const { api, can, user, meta } = ctx;
    const roles = user.roles || [];
    const name = (user.displayName || user.username).replace(/\s*\(.*\)$/, '');
    const header = (actions) => pageHeader({ title: greeting(name), subtitle: st('asOf', formatDate(meta?.today || new Date().toISOString().slice(0, 10))), actions });
    let body;
    let actions = [];
    if (!can('dashboard:read')) {
      if (can('handoff:work')) {
        const [mine, callbacks, open, hot] = await Promise.all([
          api.get('/api/handoffs?mine=true&limit=100'), api.get('/api/handoffs?status=callback&mine=true&limit=50'),
          api.get('/api/handoffs?status=open&limit=100'), can('leads:read') ? api.get('/api/leads?tier=hot&limit=6') : { items: [], total: 0 },
        ]);
        body = agentView({ mine, callbacks, unassigned: open.items.filter((x) => !x.assignedTo), hot }, ctx);
        actions = [button({ label: st('workQueue'), icon: 'inbox', variant: 'primary', onClick: () => ctx.navigate('handoffs') })];
        mount(main, pageHeader({ title: st('myWorkToday'), subtitle: greeting(name), actions }), h('div', { class: 'dash' }, body));
        return;
      }
      mount(main, header(), quickLinks(ctx));
      return;
    }
    const ov = await api.get('/api/dashboard/overview');
    if (roles.includes('executive')) body = executive(ov, ctx);
    else if (roles.includes('campaign_manager')) {
      const camps = await api.get('/api/campaigns?limit=10').catch(() => ({ items: [] }));
      body = campaignManager(ov, camps.items, ctx);
      actions = [button({ label: st('newCampaign'), icon: 'plus', variant: 'primary', onClick: () => ctx.navigate('campaigns?new=1') })];
    } else if (roles.includes('telesales_supervisor')) {
      const ho = await loadHandoffs(api, ['open', 'claimed', 'callback', 'won', 'lost']);
      body = supervisor(ov, ho, ctx);
      actions = [button({ label: st('workQueue'), icon: 'inbox', variant: 'primary', onClick: () => ctx.navigate('handoffs') })];
    } else body = generic(ov, ctx);
    mount(main, header(actions), h('div', { class: 'dash stack-lg' }, body));
  },
};

