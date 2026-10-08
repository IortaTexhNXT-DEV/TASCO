import { h, mount } from '../../shared/dom.js';
import { t, label, getLang } from '../../shared/i18n.js';
import {
  pageHeader, card, button, dataTable, drawer, formField, input, selectInput, dateInput, stepper, badge, banner, icon, keyValueList,
  toast, errorToast, formatNumber, formatPercent, formatDate, formatPlate, plateTag, tooltip, statusChip,
} from '../ui.js';
import { st, channelIcon, reasonText } from './sales-common.js';

const JOURNEY_ICON = { renewal: 'refresh', conquest: 'trending-up', new_vehicle: 'car', lapsed_uninsured: 'alert-triangle', cross_sell: 'layers' };
const EVENTS = [
  ['vetc.tag_activated', ['New ETC tag activated', 'Kích hoạt thẻ ETC mới']], ['vetc.inspection_booked', ['Inspection booked', 'Đặt lịch đăng kiểm']],
  ['vetc.wallet_topped_up', ['Wallet topped up', 'Nạp tiền vào ví']], ['vetc.long_trip_started', ['Long highway trip started', 'Bắt đầu chuyến đi dài trên cao tốc']],
];
/** Channels always listed in the same order (app, Zalo, SMS, voice, telesales). */
const CH_ORDER = ['app_push', 'vetc_app', 'zalo_zns', 'zalo', 'sms', 'email', 'voice_bot', 'telesales'];
const byChannelOrder = (a, b) => (CH_ORDER.indexOf(a) + 99 * (CH_ORDER.indexOf(a) < 0)) - (CH_ORDER.indexOf(b) + 99 * (CH_ORDER.indexOf(b) < 0));
const TRIGGER_RESULT = { sent: ['Message sent', 'Đã gửi tin nhắn'], blocked: ['Blocked by content rules', 'Bị chặn bởi kiểm soát nội dung'], failed: ['Delivery failed', 'Gửi thất bại'], 'condition not met': ['Conditions not met', 'Không thỏa điều kiện'], 'no permitted channel': ['No permitted channel', 'Không có kênh được phép'] };
const pick = (pair) => (getLang() === 'vi' ? pair[1] : pair[0]);
const dayLabel = (anchor, offset) => (anchor === 'expiry'
  ? (offset === 0 ? 'D0' : `D${offset < 0 ? '−' : '+'}${Math.abs(offset)}`)
  : `${getLang() === 'vi' ? 'Ngày' : 'Day'} ${offset}`);
const anchorText = (a) => st(a === 'expiry' ? 'anchorExpiry' : a === 'tagActivatedAt' ? 'anchorTag' : a === 'purchase' ? 'anchorPurchase' : 'anchorToday');

function journeyCard(j, ov, ctx) {
  const inJourney = j.id === 'cross_sell' ? ov?.sales?.orders || 0 : ov?.leads?.byJourney?.[j.id] || 0;
  const due7 = ov?.journeys?.dueNext7Days?.[j.id] || 0;
  const sold = ov?.sales?.byJourney?.[j.id] || 0;
  const steps = j.steps.map((s) => ({
    label: dayLabel(j.anchor || 'today', s.offset),
    description: h('span', { class: 'cadence-desc' }, label('step', s.step), h('span', { class: 'cadence-ch' }, (s.channels || []).map((c) => tooltip(h('span', { class: 'ch-ic', role: 'img', 'aria-label': label('channel', c), tabindex: '0' }, icon(channelIcon(c), { size: 13 })), label('channel', c))))),
  }));
  const stats = [
    [st('inJourney'), formatNumber(inJourney)],
    due7 ? [st('dueWeek'), formatNumber(due7)] : null,
    sold ? [st('cardSold'), formatNumber(sold)] : null,
    sold && inJourney ? [st('conversion'), formatPercent(sold / inJourney, { decimals: 1 })] : null,
  ].filter(Boolean);
  return card({
    class: `journey-card ${j.steps.length > 4 ? 'wide' : ''}`.trim(),
    title: h('span', { class: 'row tight' }, h('span', { class: 'journey-ic' }, icon(JOURNEY_ICON[j.id] || 'route', { size: 18 })), label('journey', j.id)),
    subtitle: anchorText(j.anchor || 'today'),
    actions: [badge(label('objective', j.objective), j.objective === 'retention' ? 'brand' : j.objective === 'cross_sell' ? 'info' : 'ok')],
    body: h('div', { class: 'stack' },
      h('div', { class: 'stat-row' }, stats.map(([l, v]) => h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, v), h('span', { class: 'stat-label' }, l)))),
      h('div', { class: 'stepper-scroll cadence' }, stepper(steps, { current: -1, label: `${st('cadence')}: ${label('journey', j.id)}` }))),
    footer: j.id !== 'cross_sell' ? button({ label: st('allLeads'), size: 'sm', variant: 'ghost', iconRight: 'chevron-right', onClick: () => ctx.navigate(`leads?journey=${j.id}`) }) : null,
  });
}

function runDrawer(ctx) {
  const { api, meta } = ctx;
  const date = dateInput({ value: meta?.today, required: true });
  const time = input({ type: 'time', value: '10:00' });
  const out = h('div', {});
  const dr = drawer({
    title: st('runDueNow'), size: 'sm',
    body: h('div', { class: 'stack' }, banner({ tone: 'info', text: st('runHelp') }),
      h('div', { class: 'form-grid' }, formField({ label: st('runDate'), control: date, required: true }), formField({ label: st('runTime'), control: time })), out),
    footer: [button({ label: t('close'), onClick: () => dr.close() }), button({ label: st('runNow'), icon: 'play', variant: 'primary', onClick: async () => {
      const d = date.isoValue;
      if (!d) { date.closest('.field').setError(t('invalidDate')); return; }
      const [hh, mm] = (time.value || '10:00').split(':').map(Number);
      const at = new Date(`${d}T00:00:00Z`);
      at.setUTCHours(hh - 7, mm);
      try {
        const r = await api.post('/api/journeys/run', { date: d, at: at.toISOString() });
        toast(st('runDone', formatNumber(r.done), formatNumber(r.skipped)), 'ok');
        mount(out, card({ title: st('results'), body: keyValueList([
          [st('dueNow'), formatNumber(r.due)], [st('touchpointsDone'), formatNumber(r.done)], [st('touchpointsSkipped'), formatNumber(r.skipped)],
          [st('byChannel'), Object.entries(r.byChannel).map(([k, v]) => `${label('channel', k)} ${formatNumber(v)}`).join(' · ') || '—'],
        ], { columns: 1 }) }));
        ctx.refreshSignals?.();
      } catch (e) { errorToast(e); }
    } })],
  });
}

function eventDrawer(ctx) {
  const { api } = ctx;
  const type = selectInput(EVENTS.map(([v, l]) => [v, pick(l)]), 'vetc.wallet_topped_up');
  const plate = input({ maxlength: '20', placeholder: st('plateHelp'), autocomplete: 'off' });
  const pf = formField({ label: st('customerPlate'), control: plate, help: st('plateHelp'), required: true });
  const out = h('div', {});
  const dr = drawer({
    title: st('simulateEvent'), size: 'sm',
    body: h('div', { class: 'stack' }, formField({ label: st('event'), control: type }), pf, out),
    footer: [button({ label: t('close'), onClick: () => dr.close() }), button({ label: st('sendEvent'), icon: 'send', variant: 'primary', onClick: async () => {
      const key = plate.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (key.length < 6) { pf.setError(st('plateHelp')); plate.focus(); return; }
      pf.setError('');
      try {
        const r = await api.post('/api/ecosystem/events', { type: type.value, profileId: key });
        mount(out, r.actions.length
          ? banner({ tone: 'ok', title: st('eventSent'), text: h('ul', { class: 'plain-list' }, r.actions.map((a) => h('li', {}, a.result?.startsWith('re-evaluate') ? label('journey', 'new_vehicle') : TRIGGER_RESULT[a.result] ? pick(TRIGGER_RESULT[a.result]) : reasonText(a.result)))) })
          : banner({ tone: 'info', text: st('noTrigger') }));
      } catch (e) { errorToast(e); }
    } })],
  });
}

export default {
  perm: 'journeys:run',
  async render(main, ctx) {
    const { api, can, navigate } = ctx;
    const [scheduled, rules, ov] = await Promise.all([
      api.get('/api/touchpoints?status=scheduled&limit=100'),
      can('rules:read') ? api.get('/api/rules?kind=journeys&status=active') : Promise.resolve([]),
      can('dashboard:read') ? api.get('/api/dashboard/overview') : Promise.resolve(null),
    ]);
    const def = rules[0] ? (await api.get(`/api/rules/${encodeURIComponent(rules[0].id)}`)).payload : { journeys: [] };
    const journeys = [...def.journeys].sort((a, b) => a.priority - b.priority);
    if (def.crossSell) journeys.push({ ...def.crossSell, anchor: 'purchase' });
    const order = ['renewal', 'conquest', 'new_vehicle', 'lapsed_uninsured', 'cross_sell'];
    journeys.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    const upcoming = scheduled.filter((x) => x.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    mount(main,
      pageHeader({
        title: t('journeys'), subtitle: st('journeysSubtitle'),
        actions: [button({ label: st('simulateEvent'), icon: 'activity', onClick: () => eventDrawer(ctx) }), button({ label: st('runDueNow'), icon: 'play', variant: 'primary', onClick: () => runDrawer(ctx) })],
      }),
      h('div', { class: 'journey-grid' }, journeys.map((j) => journeyCard(j, ov, ctx))),
      card({
        title: st('nextTouchpoints'), flush: true,
        body: dataTable({
          caption: st('nextTouchpoints'), rows: upcoming, pagination: { pageSize: 10 }, rowKey: (x) => x.id,
          onRowClick: (x) => navigate(`customer/${encodeURIComponent(x.profileId)}`),
          columns: [
            { key: 'dueDate', label: st('due'), sortable: true, nowrap: true, render: (x) => formatDate(x.dueDate) },
            { key: 'profileId', label: st('vehicle'), render: (x) => plateTag(x.profileId), value: (x) => formatPlate(x.profileId) },
            { key: 'journey', label: st('journey'), sortable: true, render: (x) => label('journey', x.journey), value: (x) => label('journey', x.journey) },
            { key: 'step', label: st('step'), render: (x) => label('step', x.step), value: (x) => label('step', x.step) },
            { key: 'channels', label: st('channel'), render: (x) => h('span', { class: 'row tight' }, [...x.channels].sort(byChannelOrder).map((c) => tooltip(h('span', { class: 'ch-ic', role: 'img', 'aria-label': label('channel', c), tabindex: '0' }, icon(channelIcon(c), { size: 14 })), label('channel', c)))), exportValue: (x) => x.channels.map((c) => label('channel', c)).join(' / ') },
            { key: 'status', label: st('status'), render: (x) => statusChip(x.status) },
          ],
          toolbar: { search: true, export: { filename: 'touchpoints.csv' } },
          empty: { icon: 'route', title: st('noTouchpoints') },
        }),
      }));
  },
};
