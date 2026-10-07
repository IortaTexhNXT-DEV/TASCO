import { h, mount, fmtDate } from '../../shared/dom.js';
import { label, hasLabel } from '../../shared/i18n.js';
import { pageHead, table, statusBadge, field, select, toast, errorToast, codeLabel } from '../ui.js';

export default {
  perm: 'journeys:run',
  async render(main, { api, meta, navigate }) {
    const [scheduled, rule] = await Promise.all([api.get('/api/touchpoints?status=scheduled&limit=50'), api.get('/api/rules?kind=journeys&status=active')]);
    const result = h('div', {});
    const date = h('input', { type: 'date', value: meta.today });
    const time = h('input', { type: 'time', value: '10:00' });
    const runForm = h('form', { class: 'card stack' },
      h('h2', {}, 'Run due touchpoints'),
      h('p', { class: 'small muted' }, 'Executes every touchpoint due on or before the date. Consent, contact hours (local time), frequency caps and the copy guard are enforced per message.'),
      h('div', { class: 'grid cols-2' }, field('Business date', date), field('Local send time', time)),
      h('button', { class: 'btn primary', type: 'submit' }, 'Run now'), result);
    runForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const [hh, mm] = time.value.split(':').map(Number);
        const at = new Date(`${date.value}T00:00:00Z`);
        at.setUTCHours(hh - 7, mm); // Asia/Ho_Chi_Minh (UTC+7)
        const r = await api.post('/api/journeys/run', { date: date.value, at: at.toISOString() });
        mount(result, h('div', { class: 'alert ok' }, `Due ${r.due}: done ${r.done}, skipped ${r.skipped}, cancelled ${r.cancelled}. Channels: ${Object.entries(r.byChannel).map(([k, v]) => `${label('channel', k)} ${v}`).join(', ') || '—'}`));
        toast('Journey run complete', 'ok');
      } catch (ex) { errorToast(ex); }
    });

    const evType = select([['vetc.tag_activated', 'New ETC tag activated'], ['vetc.inspection_booked', 'Inspection booked'], ['vetc.wallet_topped_up', 'Wallet topped up'], ['vetc.long_trip_started', 'Long trip started']], 'vetc.inspection_booked');
    const pid = h('input', { placeholder: 'Plate key e.g. 30A12345', required: true, maxlength: '20' });
    const evOut = h('div', {});
    const evForm = h('form', { class: 'card stack' }, h('h2', {}, 'Simulate ecosystem event'), h('p', { class: 'small muted' }, 'Moments of truth from VETC trigger instant, relevant messages (see "triggers" rule set).'), field('Event', evType), field('Customer (plate key)', pid), h('button', { class: 'btn', type: 'submit' }, 'Send event'), evOut);
    evForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { const r = await api.post('/api/ecosystem/events', { type: evType.value, profileId: pid.value.trim().toUpperCase() }); mount(evOut, h('div', { class: 'alert info' }, r.actions.length ? r.actions.map((a) => `${a.trigger}: ${a.result}`).join(' · ') : 'No trigger matched / customer not found')); } catch (ex) { errorToast(ex); }
    });

    const journeys = rule[0] ? (await api.get(`/api/rules/${encodeURIComponent(rule[0].id)}`)).payload.journeys : [];
    mount(main, 
      pageHead('Journeys', 'New business (uninsured recovery, new vehicle, conquest) and retention (TASCO renewal), with cross-sell after purchase.'),
      h('div', { class: 'grid cols-2' }, runForm, evForm),
      h('section', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'Journey definitions (active rule set)'),
        table([{ label: 'Priority', num: true, render: (j) => j.priority }, { label: 'Journey', render: (j) => h('strong', { title: j.id }, hasLabel('journey', j.id) ? label('journey', j.id) : j.name) }, { label: 'Objective', render: (j) => codeLabel('objective', j.objective) }, { label: 'Anchor', render: (j) => ({ expiry: 'Policy expiry', today: 'Enrolment date', tagActivatedAt: 'Tag activation' }[j.anchor] || j.anchor) },
          { label: 'Steps', render: (j) => j.steps.map((s) => `${s.offset >= 0 ? '+' : ''}${s.offset}d ${label('step', s.step)}`).join(' → ') }], journeys)),
      h('section', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'Next scheduled touchpoints'),
        table([{ label: 'Due', nowrap: true, render: (t) => fmtDate(t.dueDate) }, { label: 'Customer', nowrap: true, render: (t) => h('a', { href: `#/customer/${encodeURIComponent(t.profileId)}` }, t.profileId) }, { label: 'Journey', render: (t) => codeLabel('journey', t.journey) }, { label: 'Step', render: (t) => codeLabel('step', t.step) }, { label: 'Channels', render: (t) => t.channels.map((c) => label('channel', c)).join(' / ') }, { label: 'Status', render: (t) => statusBadge(t.status) }], scheduled, { onRowClick: (t) => navigate(`customer/${encodeURIComponent(t.profileId)}`) })));
  },
};
