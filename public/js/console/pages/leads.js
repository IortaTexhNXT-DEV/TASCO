import { h, mount, fmtNum, fmtVnd } from '../../shared/dom.js';
import { t, label } from '../../shared/i18n.js';
import { pageHead, table, pager, tierBadge, select, field, codeLabel } from '../ui.js';

export default {
  perm: 'leads:read',
  async render(main, { api, route, navigate }) {
    const q = { tier: route.query.tier || '', journey: route.query.journey || '', action: route.query.action || '', sort: route.query.sort || 'score', offset: Number(route.query.offset || 0), limit: 25 };
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== '' && v !== undefined));
    const data = await api.get(`/api/leads?${params}`);

    const tier = select([['', 'All tiers'], ...['hot', 'warm', 'nurture'].map((k) => [k, label('tier', k)])], q.tier);
    const journey = select([['', 'All journeys'], ...['lapsed_uninsured', 'new_vehicle', 'renewal', 'conquest'].map((k) => [k, label('journey', k)])], q.journey);
    const action = select([['', 'All actions'], ...['voice_bot', 'urgent_recovery', 'digital_reminder', 'sms_reminder', 'verify_expiry', 'welcome_new_vehicle', 'route_b2b', 'nurture', 'enrich'].map((k) => [k, label('nba', k)])], q.action);
    const sort = select([['score', 'Highest score'], ['expiry', 'Soonest expiry']], q.sort);
    const go = (offset = 0) => navigate(`leads?${new URLSearchParams(Object.entries({ tier: tier.value, journey: journey.value, action: action.value, sort: sort.value, offset }).filter(([, v]) => v !== '' && v !== 0))}`);

    mount(main, 
      pageHead(t('leads'), 'Ranked by explainable score. Click a row for the Customer 360 and the guided next action.'),
      h('form', { class: 'card filters', onsubmit: (e) => { e.preventDefault(); go(); } },
        field(t('tier'), tier), field(t('journey'), journey), field(t('nba'), action), field('Sort', sort),
        h('button', { class: 'btn primary', type: 'submit' }, t('apply'))),
      h('div', { class: 'card stack', style: 'margin-top:16px' },
        table([
          { label: t('plate'), nowrap: true, render: (r) => h('strong', {}, r.plate) },
          { label: t('score'), num: true, render: (r) => fmtNum(r.score) },
          { label: t('tier'), render: (r) => tierBadge(r.tier) },
          { label: t('journey'), render: (r) => codeLabel('journey', r.journey) },
          { label: t('days'), num: true, render: (r) => (r.daysToExpiry === null ? '—' : fmtNum(r.daysToExpiry)) },
          { label: t('nba'), render: (r) => h('span', { title: `${r.nextBestAction.action}: ${r.nextBestAction.reason}` }, label('nba', r.nextBestAction.action)) },
          { label: 'Top reason', render: (r) => h('span', { class: 'small muted' }, r.reasons[0]?.why || '') },
          { label: t('premium'), num: true, render: (r) => fmtVnd(r.premium) },
          { label: t('region'), render: (r) => r.region },
        ], data.items, { onRowClick: (r) => navigate(`customer/${encodeURIComponent(r.id)}`), caption: 'Lead queue' }),
        pager({ total: data.total, limit: q.limit, offset: q.offset, onPage: go })));
  },
};
