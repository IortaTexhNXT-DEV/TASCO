import { h, mount } from '../../shared/dom.js';
import { t, label } from '../../shared/i18n.js';
import { pageHeader, card, dataTable, chip, button, tierBadge, formatMoney, downloadCsv, formatDate, errorToast } from '../ui.js';
import { st, vehicleCell, scoreBar, expiryCell, filterChip, daysText } from './sales-common.js';

const JOURNEYS = ['renewal', 'conquest', 'new_vehicle', 'lapsed_uninsured'];
const ACTIONS = ['voice_bot', 'urgent_recovery', 'digital_reminder', 'sms_reminder', 'verify_expiry', 'welcome_new_vehicle', 'route_b2b', 'nurture', 'enrich'];
const LIMIT = 25;

export default {
  perm: 'leads:read',
  async render(main, { api, route, navigate, meta }) {
    const q = {
      tier: route.query.tier || '', journey: route.query.journey || '', action: route.query.action || '', region: route.query.region || '',
      q: route.query.q || '', sort: route.query.sort || 'score', offset: Number(route.query.offset || 0), limit: Number(route.query.limit || LIMIT),
    };
    const params = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null));
    const go = (patch) => {
      const next = { ...q, offset: 0, ...patch };
      if (next.sort === 'score') delete next.sort;
      if (next.limit === LIMIT) delete next.limit;
      if (!next.offset) delete next.offset;
      navigate(`leads?${params(next)}`);
    };
    const data = await api.get(`/api/leads?${params({ ...q })}`);

    const filters = [
      ...['hot', 'warm', 'nurture'].map((k) => chip({ label: label('tier', k), selected: q.tier === k, onClick: () => go({ tier: q.tier === k ? '' : k }) })),
      h('span', { class: 'toolbar-sep', 'aria-hidden': 'true' }),
      filterChip({ label: st('anyJourney'), value: q.journey, options: JOURNEYS.map((k) => [k, label('journey', k)]), onChange: (v) => go({ journey: v }) }),
      filterChip({ label: st('anyAction'), value: q.action, options: ACTIONS.map((k) => [k, label('nba', k)]), onChange: (v) => go({ action: v }) }),
      (data.facets?.regions || []).length > 1 ? filterChip({ label: st('anyRegion'), value: q.region, options: data.facets.regions.map((r) => [r, r]), onChange: (v) => go({ region: v }) }) : null,
      q.tier || q.journey || q.action || q.region || q.q ? button({ label: st('clearFilters'), variant: 'ghost', size: 'sm', onClick: () => navigate('leads') }) : null,
    ].filter(Boolean);

    const exportAll = async () => {
      try {
        const all = await api.get(`/api/leads?${params({ ...q, offset: 0, limit: 500 })}`);
        downloadCsv('leads.csv',
          [st('vehicle'), st('owner'), st('score'), st('tier'), st('journey'), st('expiry'), '', st('nba'), st('region'), st('premium')],
          all.items.map((r) => [r.plate, r.owner || '', r.score, label('tier', r.tier), label('journey', r.journey), r.expiryDate ? formatDate(r.expiryDate) : '', daysText(r.daysToExpiry), label('nba', r.nextBestAction?.action), r.region, r.premium]));
      } catch (e) { errorToast(e); }
    };

    const table = dataTable({
      caption: st('leadQueue'),
      rows: data.items,
      onRowClick: (r) => navigate(`customer/${encodeURIComponent(r.id)}`),
      columns: [
        { key: 'plate', label: st('vehicle'), render: (r) => vehicleCell(r.plate, r.owner, { company: r.ownerType === 'company' }), width: '200px' },
        { key: 'score', label: st('score'), sortable: true, render: (r) => scoreBar(r.score, r.tier), width: '120px' },
        { key: 'tier', label: st('tier'), render: (r) => tierBadge(r.tier) },
        { key: 'journey', label: st('journey'), render: (r) => (r.journey ? label('journey', r.journey) : h('span', { class: 'muted' }, label('journey', null))) },
        { key: 'expiry', label: st('expiry'), sortable: true, render: (r) => expiryCell(r.expiryDate, r.daysToExpiry, meta?.today) },
        { key: 'nba', label: st('nba'), render: (r) => h('span', { class: 'clamp-2' }, label('nba', r.nextBestAction?.action)) },
        { key: 'region', label: st('region'), nowrap: true },
        { key: 'premium', label: st('premium'), align: 'right', nowrap: true, render: (r) => formatMoney(r.premium) },
      ],
      sort: { key: q.sort === 'expiry' ? 'expiry' : 'score', dir: q.sort === 'expiry' ? 'asc' : 'desc', onSort: (key) => go({ sort: key === 'expiry' ? 'expiry' : 'score' }) },
      toolbar: {
        search: { placeholder: st('searchPlate'), value: q.q, onSearch: (v) => go({ q: v.trim() }) },
        filters,
        export: { onExport: exportAll },
      },
      pagination: { total: data.total, limit: q.limit, offset: q.offset, onPage: (o) => go({ offset: o, ...pick(q) }), onLimit: (n) => go({ limit: n }) },
      empty: { icon: 'users', title: st('noLeads'), text: st('noLeadsHint') },
    });
    function pick(x) { return { tier: x.tier, journey: x.journey, action: x.action, region: x.region, q: x.q, sort: x.sort, limit: x.limit }; }

    mount(main,
      pageHeader({ title: t('leads'), subtitle: st('leadsSubtitle') }),
      card({ flush: true, body: table, class: 'leads-card' }));
    const si = main.querySelector('.dt-search input');
    if (q.q && si) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
  },
};
