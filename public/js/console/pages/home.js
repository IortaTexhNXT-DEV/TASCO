import { h, clear, mount, fmtNum, fmtVnd } from '../../shared/dom.js';
import { kpi, pageHead, table } from '../ui.js';

const JOURNEY_LABELS = {
  renewal: 'Renewal (TASCO book)', conquest: 'Conquest (other insurer)', new_vehicle: 'New vehicle', lapsed_uninsured: 'Uninsured recovery', cross_sell: 'Cross-sell', null: 'No journey',
};

function bars(obj, labels = {}) {
  const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return h('p', { class: 'muted' }, '—');
  return h('ul', { class: 'reasons' }, entries.map(([k, v]) => h('li', {},
    h('span', {}, labels[k] || k), h('strong', {}, fmtNum(v)),
    h('div', { class: 'bar', role: 'img', 'aria-label': `${labels[k] || k}: ${v}` }, h('span', { style: `width:${Math.round((v / max) * 100)}%` })))));
}

export default {
  perm: 'dashboard:read',
  async render(main, { api, can, navigate, user }) {
    const ov = await api.get('/api/dashboard/overview');
    const isExec = user.roles.includes('executive');
    const head = pageHead(
      `Xin chào, ${user.displayName || user.username}`,
      `Snapshot as of ${ov.asOf}. ${isExec ? 'Growth across new business and retention.' : 'Your priorities for today.'}`,
      can('leads:read') ? h('button', { class: 'btn primary', onclick: () => navigate('leads?tier=hot') }, 'Work hot leads') : null,
      can('handoff:read') ? h('button', { class: 'btn', onclick: () => navigate('handoffs') }, 'Open telesales inbox') : null,
    );
    const newBiz = (ov.leads.byJourney.conquest || 0) + (ov.leads.byJourney.new_vehicle || 0) + (ov.leads.byJourney.lapsed_uninsured || 0);
    mount(main, head,
      h('section', { 'aria-labelledby': 'k1' }, h('h2', { id: 'k1', class: 'sr-only' }, 'Key indicators'),
        h('div', { class: 'grid cols-4' },
          kpi('Vehicles in golden record', fmtNum(ov.base.profiles), `${fmtNum(ov.base.profilesWithUsableData)} with usable data`),
          kpi('Expiring in 30 days', fmtNum(ov.base.expiring30), 'renewal window open'),
          kpi('Uninsured (lapsed ≤ 60d)', fmtNum(ov.base.lapsedUninsured), 'legal risk for the driver'),
          kpi('New-business leads', fmtNum(newBiz), 'conquest + new vehicle + uninsured'),
          kpi('Policies sold', fmtNum(ov.sales.orders), `GWP ${fmtVnd(ov.sales.gwp)}`),
          kpi('Hot leads', fmtNum(ov.leads.byTier.hot || 0), `${fmtNum(ov.leads.byTier.warm || 0)} warm`),
          kpi('Open data issues', fmtNum(ov.dataQuality.openIssues), 'fixed by customers in-app + stewards'),
          kpi('Voice bot saving', fmtVnd(ov.economics.savingVsTelesales), `vs ${fmtVnd(ov.economics.equivalentTelesalesCost)} human cost`))),
      h('div', { class: 'grid cols-3', style: 'margin-top:16px' },
        h('section', { class: 'card' }, h('h2', {}, 'Journey mix'), bars(ov.leads.byJourney, JOURNEY_LABELS)),
        h('section', { class: 'card' }, h('h2', {}, 'Next best actions'), bars(ov.leads.byAction)),
        h('section', { class: 'card' }, h('h2', {}, 'Data quality issues'), bars(ov.dataQuality.byType))),
      h('div', { class: 'grid cols-3', style: 'margin-top:16px' },
        h('section', { class: 'card' }, h('h2', {}, 'Messages sent by channel'), bars(ov.engagement.messagesByChannel)),
        h('section', { class: 'card' }, h('h2', {}, 'Voice bot outcomes'), bars(ov.engagement.voiceOutcomes)),
        h('section', { class: 'card' }, h('h2', {}, 'Sales by journey'), bars(ov.sales.byJourney, JOURNEY_LABELS))),
      h('section', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'Channel economics'),
        table([{ label: 'Metric', render: (r) => r[0] }, { label: 'Value', num: true, render: (r) => r[1] }], [
          ['Voice bot cost', fmtVnd(ov.economics.voiceBotCost)],
          ['Equivalent telesales cost', fmtVnd(ov.economics.equivalentTelesalesCost)],
          ['Messaging cost', fmtVnd(ov.economics.messagingCost)],
          ['Acquisition cost per order (bot + messaging)', ov.economics.costPerOrder === null ? '—' : fmtVnd(ov.economics.costPerOrder)],
          ['Active policies by product', Object.entries(ov.sales.activePoliciesByProduct).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'],
        ])));
  },
};
