import { h, mount } from '../../shared/dom.js';
import { t, label } from '../../shared/i18n.js';
import {
  pageHeader, card, button, iconButton, dropdownMenu, chip, switchControl, emptyState, keyValueList, badge, plateTag, avatar, timeline,
  modal, formField, textarea, selectInput, dateInput, input, scoreRing, icon, toast, errorToast, formatMoney, formatDate, skeleton,
} from '../ui.js';
import { st, slaChip, handoffReason, handoffStatusChip, talkingPoint, relTime, daysText } from './sales-common.js';

const STATUSES = ['open', 'claimed', 'callback', 'won', 'lost'];
const STATUS_KEY = { open: 'statusOpen', claimed: 'statusClaimed', callback: 'statusCallback', won: 'statusWon', lost: 'statusLost' };

export default {
  perm: 'handoff:read',
  async render(main, ctx) {
    const { api, route, navigate, can, user } = ctx;
    const state = { status: route.query.status || 'open', mine: route.query.mine === 'true', id: route.query.id || null };
    const queueEl = h('div', { class: 'queue-list', role: 'listbox', 'aria-label': st('queue') });
    const detailEl = h('div', { class: 'inbox-detail' });
    const countsEl = h('div', {});

    const qs = () => new URLSearchParams(Object.entries({ status: state.status === 'open' ? '' : state.status, mine: state.mine ? 'true' : '', id: state.id || '' }).filter(([, v]) => v)).toString();
    const syncUrl = () => history.replaceState(null, '', `#/handoffs${qs() ? `?${qs()}` : ''}`);

    // If a deep link points at a handoff in another status, open the right tab.
    if (state.id && !route.query.status) {
      try { const x = await api.get(`/api/handoffs/${encodeURIComponent(state.id)}`); state.status = x.status; } catch { state.id = null; }
    }

    async function loadCounts() {
      const res = await Promise.all(STATUSES.map((s) => api.get(`/api/handoffs?status=${s}&limit=1${state.mine ? '&mine=true' : ''}`).then((r) => r.total).catch(() => 0)));
      mount(countsEl, h('div', { class: 'chip-row', role: 'group', 'aria-label': st('queue') }, STATUSES.map((s, i) => chip({
        label: st(STATUS_KEY[s]), count: res[i], selected: state.status === s,
        onClick: () => { state.status = s; state.id = null; syncUrl(); loadCounts(); loadQueue(); },
      }))));
    }

    let items = [];
    async function loadQueue() {
      mount(queueEl, Array.from({ length: 4 }, () => h('div', { class: 'queue-item' }, skeleton({ lines: 2 }))));
      const r = await api.get(`/api/handoffs?status=${state.status}&limit=100${state.mine ? '&mine=true' : ''}`);
      items = r.items;
      if (!items.length) {
        mount(queueEl, emptyState({ icon: 'inbox', title: st('noHandoffs'), text: st('noHandoffsHint'), compact: true }));
        mount(detailEl, card({ body: emptyState({ icon: 'phone-call', title: st('selectHandoff'), text: st('selectHandoffHint') }) }));
        return;
      }
      // Oldest SLA first for waiting work; newest first for closed.
      if (['open', 'callback', 'claimed'].includes(state.status)) items.sort((a, b) => String(a.slaDueAt).localeCompare(String(b.slaDueAt)));
      mount(queueEl, items.map((x) => queueItem(x)));
      const sel = items.find((x) => x.id === state.id) || items[0];
      select(sel.id, false);
    }

    function queueItem(x) {
      const el = h('button', { type: 'button', class: 'queue-item', role: 'option', 'aria-selected': 'false', 'data-id': x.id, onclick: () => select(x.id, true) },
        h('div', { class: 'queue-top' }, plateTag(x.plate), h('span', { class: 'grow' }), slaChip(x.slaDueAt, x.status) || handoffStatusChip(x.status)),
        h('div', { class: 'queue-name' }, x.name || '—'),
        h('div', { class: 'queue-meta' }, h('span', { class: 'grow trunc-1' }, handoffReason(x.outcome)), x.assignedToName ? avatar(x.assignedToName, { size: 'sm', title: x.assignedToName }) : null, relTime(x.createdAt)));
      return el;
    }

    async function select(id, focus) {
      state.id = id;
      syncUrl();
      queueEl.querySelectorAll('.queue-item').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
      mount(detailEl, card({ body: skeleton({ lines: 8, height: 14 }) }));
      try {
        const x = await api.get(`/api/handoffs/${encodeURIComponent(id)}`);
        mount(detailEl, detail(x));
        if (focus) detailEl.querySelector('h2')?.focus();
      } catch (e) { errorToast(e); }
    }

    async function update(x, body, msg) {
      try {
        await api.patch(`/api/handoffs/${encodeURIComponent(x.id)}`, { ...body, version: x.version });
        toast(msg || st('handoffUpdated'), 'ok');
        ctx.refreshSignals?.();
        if (body.status && body.status !== state.status) state.status = body.status;
        await Promise.all([loadCounts(), loadQueue()]);
        return true;
      } catch (e) { errorToast(e); return false; }
    }

    function outcomeModal(x, kind) {
      const note = textarea({ rows: '3', maxlength: '800' });
      const parts = [];
      let reason = null;
      let date = null;
      let time = null;
      let assignee = null;
      if (kind === 'lost') { reason = selectInput(st('lostReasons'), 'price'); parts.push(formField({ label: st('lostReason'), control: reason, required: true })); }
      if (kind === 'callback') {
        date = dateInput({ value: new Date(Date.now() + 86400000).toISOString().slice(0, 10), required: true });
        time = input({ type: 'time', value: '10:00' });
        parts.push(h('div', { class: 'form-grid' }, formField({ label: st('callbackWhen'), control: date, required: true }), formField({ label: st('callbackTime'), control: time })));
      }
      if (kind === 'reassign') {
        assignee = selectInput([['', '…']], '');
        api.get('/api/handoffs/assignees').then((r) => mount(assignee, r.items.map((u) => h('option', { value: u.id, selected: u.id === x.assignedTo }, `${u.name}${u.region && u.region !== 'ALL' ? ` · ${u.region}` : ''}`)))).catch(errorToast);
        parts.push(formField({ label: st('reassignTo'), control: assignee, required: true }));
      }
      const noteField = formField({ label: kind === 'won' ? st('outcomeNote') : st('note'), control: note, help: kind === 'won' ? st('wonHelp') : null, optional: kind !== 'lost' });
      const titles = { won: st('markWon'), lost: st('markLost'), callback: st('scheduleCallback'), reassign: st('reassign'), note: st('addNote') };
      const m = modal({
        title: titles[kind], size: 'sm',
        body: h('div', { class: 'stack' }, h('div', { class: 'row tight' }, plateTag(x.plate), h('span', { class: 'muted' }, x.name || '')), parts, noteField),
        actions: [
          button({ label: t('cancel'), onClick: () => m.close() }),
          button({ label: titles[kind], variant: kind === 'lost' ? 'danger solid' : 'primary', onClick: async () => {
            const n = note.value.trim();
            let body = {};
            if (kind === 'won') body = { status: 'won', note: n || undefined };
            if (kind === 'lost') body = { status: 'lost', note: `${reason.selectedOptions[0].textContent}${n ? ` — ${n}` : ''}` };
            if (kind === 'callback') {
              if (!date.isoValue) { date.closest('.field').setError(t('invalidDate')); return; }
              body = { status: 'callback', note: `${st('callbackWhen')}: ${formatDate(date.isoValue)} ${time.value}${n ? ` — ${n}` : ''}` };
            }
            if (kind === 'reassign') { if (!assignee.value) return; body = { assignTo: assignee.value, note: n || undefined }; }
            if (kind === 'note') { if (!n) { noteField.setError(t('required')); return; } body = { note: n }; }
            if (await update(x, body)) m.close();
          } }),
        ],
      });
    }

    function detail(x) {
      const work = can('handoff:work');
      const closed = ['won', 'lost'].includes(x.status);
      const callNow = async () => {
        if (x.status === 'claimed') return;
        await update(x, { status: 'claimed' }, st('callStarted'));
      };
      const sendQuote = () => navigate(`customer/${encodeURIComponent(x.customerId)}?tab=policy`);
      let primary = null;
      if (!work || closed) primary = button({ label: st('viewCustomer'), icon: 'external-link', onClick: () => navigate(`customer/${encodeURIComponent(x.customerId)}`) });
      else if (x.status === 'claimed') primary = button({ label: st('sendQuote'), icon: 'send', variant: 'primary', onClick: sendQuote });
      else primary = button({ label: st('callCustomer'), icon: 'phone-call', variant: 'primary', onClick: callNow });
      let kebab = null;
      if (work) {
        kebab = iconButton({ icon: 'more-horizontal', label: t('moreActions'), variant: 'secondary' });
        dropdownMenu(kebab, [
          !closed && x.status !== 'claimed' ? { label: st('sendQuote'), icon: 'send', onClick: sendQuote } : null,
          !closed ? { label: st('scheduleCallback'), icon: 'calendar', onClick: () => outcomeModal(x, 'callback'), disabled: x.status === 'callback' } : null,
          !closed ? { label: st('markWon'), icon: 'check-circle', onClick: () => outcomeModal(x, 'won') } : null,
          !closed && can('handoff:assign') ? { label: st('reassign'), icon: 'user-check', onClick: () => outcomeModal(x, 'reassign') } : null,
          { label: st('addNote'), icon: 'edit', onClick: () => outcomeModal(x, 'note') },
          closed ? null : { separator: true },
          !closed ? { label: st('markLost'), icon: 'x-circle', danger: true, onClick: () => outcomeModal(x, 'lost') } : null,
          { separator: true },
          { label: st('viewCustomer'), icon: 'external-link', onClick: () => navigate(`customer/${encodeURIComponent(x.customerId)}`) },
        ].filter(Boolean), { label: t('moreActions') });
      }
      const signals = [
        x.plateVerifiedByCustomer ? badge(st('plateVerified'), 'ok', { icon: 'badge-check' }) : badge(st('plateNotVerified'), 'warn', { icon: 'alert-triangle' }),
        x.priceAsked ? badge(st('priceAsked'), 'info', { icon: 'wallet' }) : null,
        x.trustConcern ? badge(st('trustConcern'), 'warn', { icon: 'shield' }) : null,
      ].filter(Boolean);
      const notes = (x.notes || []).slice().reverse().map((n) => ({ title: n.text, meta: n.byName || '—', time: n.at, icon: 'message-square' }));
      return h('div', { class: 'stack' },
        card({
          class: 'ho-head',
          body: h('div', { class: 'ho-head-row' },
            scoreRing(x.score, { size: 52, tier: x.score >= 70 ? 'hot' : x.score >= 40 ? 'warm' : null, label: `${st('score')} ${x.score}` }),
            h('div', { class: 'grow stack-sm' },
              h('div', { class: 'row tight' }, h('h2', { tabindex: '-1', class: 'ho-title' }, x.name || '—'), plateTag(x.plate), handoffStatusChip(x.status), slaChip(x.slaDueAt, x.status)),
              h('div', { class: 'ho-sub' }, [handoffReason(x.outcome), x.region, x.assignedToName ? `${st('assignedTo')}: ${x.assignedToName}` : st('unassigned')].join(' · '))),
            h('div', { class: 'ph-actions' }, kebab, primary)),
        }),
        h('div', { class: 'grid-12' },
          h('div', { class: 'span-7 stack' },
            card({ title: st('botSummary'), body: h('div', { class: 'brief' },
              h('div', { class: 'chip-row' }, signals),
              keyValueList([
                [st('reason'), handoffReason(x.outcome)],
                [t('journey'), label('journey', x.journey)],
                [st('expiry'), x.expiryDate ? `${formatDate(x.expiryDate)} · ${daysText(x.daysToExpiry)}` : daysText(null)],
                [st('premium'), formatMoney(x.premium)],
              ], { columns: 2 })) }),
            card({ title: st('talkingPoints'), body: h('ol', { class: 'talking-points' }, x.talkingPoints.map((tp) => h('li', {}, icon('check', { size: 16 }), h('span', {}, talkingPoint(tp))))) })),
          h('div', { class: 'span-5 stack' },
            card({ title: st('customerSnapshot'), body: keyValueList([
              [st('phoneLabel'), h('span', { class: 'stack-sm' }, h('strong', {}, x.phoneMasked || '—'), h('span', { class: 'cell-sub' }, st('dialHint')))],
              [st('region'), x.region],
              [st('age'), relTime(x.createdAt)],
            ], { columns: 1 }) }),
            card({ title: st('notes'), body: timeline(notes, { empty: st('noNotes') }) }))));
    }

    const mineSwitch = switchControl({ label: st('onlyMine'), checked: state.mine, onChange: (v) => { state.mine = v; state.id = null; syncUrl(); loadCounts(); loadQueue(); } });
    mount(main,
      pageHeader({ title: t('handoffs'), subtitle: `${st('inboxSubtitle')}${user.region && user.region !== 'ALL' ? ` · ${user.region}` : ''}` }),
      h('div', { class: 'inbox' },
        h('section', { class: 'card c2 inbox-queue', 'aria-label': st('queue') },
          h('div', { class: 'inbox-queue-head' }, countsEl, mineSwitch),
          queueEl),
        detailEl));
    await Promise.all([loadCounts(), loadQueue()]);
  },
};
