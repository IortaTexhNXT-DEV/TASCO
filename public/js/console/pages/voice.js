import { h, mount } from '../../shared/dom.js';
import { t, getLang } from '../../shared/i18n.js';
import {
  pageHeader, card, button, dataTable, kpiStrip, kpiTile, drawer, keyValueList, badge, plateTag, stepper, switchControl, icon, chip,
  emptyState, skeleton, toast, errorToast, formatNumber, formatPercent, formatDateTime, formatPlate, tierBadge,
} from '../ui.js';
import { st, outcomeChip, outcomeLabel, filterChip, relTime, vehicleCell, scoreBar } from './sales-common.js';

const QUICK = ['đúng rồi', 'phí bao nhiêu tiền vậy', 'sao biết số tôi, lừa đảo à', 'gửi link qua zalo cho tôi', 'tôi muốn mua ngay', 'tôi đã gia hạn rồi', 'đang lái xe, gọi lại sau', 'đừng gọi nữa'];
const OUTCOMES = ['hot_handoff', 'link_sent', 'callback_later', 'already_renewed', 'opted_out', 'plate_mismatch', 'unverified', 'wrong_person', 'no_answer', 'scam_concern'];
const spokenPlate = (key) => formatPlate(key).replace('-', ' ').replace('.', ' ');

/** Plates spoken by the customer are masked like everywhere else in the console (e.g. "92G 514 73" → "92G ***73"). */
const maskSpokenPlate = (text) => String(text || '').replace(/\b(\d{2}[A-Z]{1,2}\d?)([\s.-]*)(\d)[\s.]*(\d)[\s.]*(\d)[\s.]*(\d)[\s.]*(\d)\b/gi, (m, pre, sep, a, b2, c, d, e) => `${pre}${sep || ' '}***${d}${e}`);

function bubbles(transcript, showGloss) {
  return transcript.map((m) => h('div', { class: `bubble-row ${m.speaker === 'bot' ? 'bot' : 'customer'}` },
    m.speaker === 'bot' ? h('span', { class: 'bubble-avatar', 'aria-hidden': 'true' }, icon('mic', { size: 16 })) : null,
    h('div', { class: `bubble ${m.speaker === 'bot' ? 'bot' : 'customer'}` },
      h('span', { class: 'sr-only' }, m.speaker === 'bot' ? `${st('assistant')}: ` : `${st('customer')}: `),
      m.speaker === 'bot' ? m.text : maskSpokenPlate(m.text),
      showGloss && m.gloss ? h('span', { class: 'gloss' }, m.gloss) : null)));
}

function transcriptView(transcript) {
  const chat = h('div', { class: 'chat call-chat', role: 'log', 'aria-label': st('transcript') });
  const sw = switchControl({ label: st('showTranslation'), checked: getLang() === 'en', onChange: (v) => mount(chat, bubbles(transcript, v)) });
  mount(chat, bubbles(transcript, getLang() === 'en'));
  return h('div', { class: 'stack-sm' }, h('div', { class: 'row spread' }, h('h3', { class: 'eyebrow' }, st('transcript')), sw), chat);
}

async function openCall(api, id, navigate, onClose) {
  const dr = drawer({ title: st('callDetail'), size: 'lg', body: h('div', { class: 'stack' }, skeleton({ height: 240 })), onClose });
  try {
    const s = await api.get(`/api/voice/sessions/${encodeURIComponent(id)}`);
    const dur = s.endedAt && s.startedAt ? Math.max(0, Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 1000)) : null;
    dr.setBody(h('div', { class: 'call-detail' },
      h('div', { class: 'row tight' }, plateTag(s.ctx?.plateMasked || s.customerId), outcomeChip(s.outcome),
        s.verified ? badge(st('verified'), 'ok', { icon: 'badge-check' }) : badge(st('notVerified'), 'warn', { icon: 'alert-triangle' })),
      keyValueList([
        [st('callType'), s.mode === 'campaign' ? st('typeCampaign') : st('typeRehearsal')],
        [st('when'), formatDateTime(s.startedAt)],
        [st('verification'), s.verified ? st('verified') : st('notVerified')],
        [st('outcome'), outcomeLabel(s.outcome)],
        [st('turns'), formatNumber(s.transcript.length)],
        dur ? [st('duration'), `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}`] : [st('region'), s.region],
      ], { columns: 3 }),
      transcriptView(s.transcript)));
    dr.setFooter(
      button({ label: st('viewCustomer'), icon: 'external-link', onClick: () => { dr.close(); navigate(`customer/${encodeURIComponent(s.customerId)}`); } }),
      s.handoffId ? button({ label: st('openHandoff'), icon: 'inbox', variant: 'primary', onClick: () => { dr.close(); navigate(`handoffs?id=${encodeURIComponent(s.handoffId)}`); } }) : null);
  } catch (e) { errorToast(e); dr.close(); }
}

function rehearsePicker(api, navigate) {
  const dr = drawer({ title: st('rehearse'), subtitle: st('pickCustomer'), size: 'md', body: skeleton({ height: 200 }) });
  api.get('/api/leads?tier=hot&limit=25').then((r) => {
    dr.setBody(dataTable({
      caption: st('pickCustomer'), pagination: false, rows: r.items,
      onRowClick: (l) => { dr.close(); navigate(`voice?profile=${encodeURIComponent(l.id)}`); },
      columns: [
        { key: 'v', label: st('vehicle'), render: (l) => vehicleCell(l.plate, l.owner, { company: l.ownerType === 'company' }) },
        { key: 'score', label: st('score'), render: (l) => scoreBar(l.score, l.tier) },
        { key: 'tier', label: st('tier'), render: (l) => tierBadge(l.tier) },
      ],
      empty: { icon: 'users', title: st('noLeads') },
    }));
  }).catch((e) => { errorToast(e); dr.close(); });
}

/* ---------------- Rehearsal simulator (phone-call panel) ---------------- */
async function simulator(main, ctx, profileId) {
  const { api, navigate } = ctx;
  let s = await api.post('/api/voice/sessions', { profileId });
  const chat = h('div', { class: 'chat call-chat', role: 'log', 'aria-live': 'polite', 'aria-label': st('transcript') });
  const stageEl = h('div', {});
  const statusEl = h('div', { class: 'call-status' });
  const timerEl = h('span', { class: 'call-timer' }, '00:00');
  const input = h('input', { maxlength: '500', autocomplete: 'off', placeholder: st('typeReply'), 'aria-label': st('typeReply') });
  const sendBtn = button({ label: st('send'), icon: 'send', variant: 'primary', type: 'submit' });
  let showGloss = getLang() === 'en';
  const t0 = Date.now();
  const timer = setInterval(() => {
    if (!document.contains(timerEl)) { clearInterval(timer); return; }
    if (s.state === 'ended') return;
    const sec = Math.round((Date.now() - t0) / 1000);
    timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  }, 1000);

  const stageIdx = () => (s.state === 'ended' ? 4 : s.state === 'verify_plate' ? 1 : 2);
  function paint() {
    mount(chat, bubbles(s.transcript, showGloss));
    chat.scrollTop = chat.scrollHeight;
    mount(stageEl, stepper([st('stageIntro'), st('stageVerify'), st('stageOffer'), st('stageWrap')], { current: stageIdx(), label: st('rehearsalTitle') }));
    const ended = s.state === 'ended';
    mount(statusEl,
      h('span', { class: `call-dot ${ended ? 'ended' : 'live'}`, 'aria-hidden': 'true' }), ended ? st('callEnded') : st('calling'), ' · ', timerEl,
      h('span', { class: 'grow' }),
      s.verified ? badge(st('verified'), 'ok', { icon: 'badge-check' }) : badge(st('notVerified'), 'neutral', { icon: 'shield' }),
      ended ? outcomeChip(s.outcome) : null);
    input.disabled = ended;
    sendBtn.disabled = ended;
    if (ended && s.handoffId) toast(st('handedOff'), 'ok');
  }
  async function say(text) {
    if (!text.trim() || s.state === 'ended') return;
    try { s = await api.post(`/api/voice/sessions/${encodeURIComponent(s.id)}/turns`, { text }); paint(); ctx.refreshSignals?.(); } catch (e) { errorToast(e); }
    input.value = '';
    input.focus({ preventScroll: true });
  }
  const form = h('form', { class: 'call-input', onsubmit: (e) => { e.preventDefault(); say(input.value); } }, input, sendBtn);
  const glossSw = switchControl({ label: st('showTranslation'), checked: showGloss, onChange: (v) => { showGloss = v; paint(); } });
  const phone = h('section', { class: 'call-panel', 'aria-label': st('rehearsalTitle') },
    h('header', { class: 'call-head' },
      h('span', { class: 'call-avatar', 'aria-hidden': 'true' }, icon('mic', { size: 22 })),
      h('div', { class: 'grow' }, h('p', { class: 'call-name' }, st('callerId')), h('p', { class: 'call-to' }, `→ ${s.ctx.plateMasked} · ${s.phoneMasked || ''}`)),
      button({ label: st('endCall'), icon: 'phone', variant: 'danger solid', size: 'sm', onClick: () => navigate('voice') })),
    statusEl, stageEl, chat, form);
  const quick = card({ title: st('quickReplies'), body: h('div', { class: 'stack' },
    h('div', { class: 'chip-row' }, [spokenPlate(profileId), ...QUICK].map((q) => chip({ label: q, onClick: () => say(q) }))),
    glossSw) });
  const actions = card({ body: h('div', { class: 'stack-sm' },
    button({ label: st('viewCustomer'), icon: 'external-link', block: true, onClick: () => navigate(`customer/${encodeURIComponent(profileId)}`) }),
    button({ label: st('restart'), icon: 'refresh', block: true, onClick: () => navigate(`voice?profile=${encodeURIComponent(profileId)}&r=${Date.now()}`) })) });
  mount(main,
    pageHeader({ title: st('rehearsalTitle'), breadcrumb: [{ label: t('groupSell') }, { label: t('voice'), href: '#/voice' }, { label: st('rehearsalTitle') }], back: { href: '#/voice', label: t('voice') } }),
    h('div', { class: 'grid-12' }, h('div', { class: 'span-7' }, phone), h('div', { class: 'span-5 stack' }, quick, actions)));
  paint();
  input.focus({ preventScroll: true });
}

export default {
  perm: 'voice:operate',
  async render(main, ctx) {
    const { api, route, can, navigate } = ctx;
    if (route.query.profile) { await simulator(main, ctx, route.query.profile); return; }
    const outcome = route.query.outcome || '';
    const data = await api.get(`/api/voice/sessions?limit=200${outcome ? `&outcome=${encodeURIComponent(outcome)}` : ''}`);
    const calls = data.items;
    const n = calls.length;
    const verified = calls.filter((c) => c.verified).length;
    const hot = calls.filter((c) => c.outcome === 'hot_handoff').length;
    const links = calls.filter((c) => c.outcome === 'link_sent').length;
    const table = dataTable({
      caption: t('voice'), rows: calls, pagination: { pageSize: 25 },
      onRowClick: (r) => { history.replaceState(null, '', `#/voice?call=${encodeURIComponent(r.id)}`); openCall(api, r.id, navigate, () => history.replaceState(null, '', '#/voice')); },
      columns: [
        { key: 'startedAt', label: st('when'), sortable: true, nowrap: true, render: (r) => relTime(r.startedAt), value: (r) => r.startedAt, exportValue: (r) => formatDateTime(r.startedAt) },
        { key: 'plate', label: st('vehicle'), render: (r) => plateTag(r.plateMasked || r.customerId), value: (r) => r.plateMasked },
        { key: 'region', label: st('region'), sortable: true },
        { key: 'mode', label: st('callType'), render: (r) => (r.mode === 'campaign' ? st('typeCampaign') : st('typeRehearsal')) },
        { key: 'verified', label: st('verification'), render: (r) => (r.verified ? badge(st('verified'), 'ok', { icon: 'badge-check' }) : badge(st('notVerified'), 'neutral')), exportValue: (r) => (r.verified ? st('verified') : st('notVerified')) },
        { key: 'outcome', label: st('outcome'), sortable: true, render: (r) => outcomeChip(r.outcome), value: (r) => outcomeLabel(r.outcome) },
        { key: 'turns', label: st('turns'), align: 'right', sortable: true },
        { key: 'handoff', label: st('handoff'), render: (r) => (r.handoffId ? h('a', { href: `#/handoffs?id=${encodeURIComponent(r.handoffId)}`, class: 'row tight' }, icon('inbox', { size: 14 }), st('openHandoff')) : ''), exportValue: (r) => (r.handoffId ? '✓' : '') },
      ],
      toolbar: {
        search: true,
        filters: [filterChip({ label: st('outcome'), value: outcome, options: OUTCOMES.map((o) => [o, outcomeLabel(o)]), onChange: (v) => navigate(`voice${v ? `?outcome=${v}` : ''}`) })],
        export: { filename: 'calls.csv' },
      },
      empty: { icon: 'mic', title: st('noCalls'), text: st('noCallsHint') },
    });
    mount(main,
      pageHeader({
        title: t('voice'), subtitle: st('voiceSubtitle'),
        actions: [
          can('journeys:run') ? button({ label: st('newCampaign'), icon: 'megaphone', onClick: () => navigate('campaigns?new=1') }) : null,
          button({ label: st('rehearse'), icon: 'phone-call', variant: 'primary', onClick: () => rehearsePicker(api, navigate) }),
        ].filter(Boolean),
      }),
      n ? kpiStrip([
        kpiTile({ label: st('calls'), icon: 'mic', value: formatNumber(data.total) }),
        kpiTile({ label: st('verification'), icon: 'badge-check', value: formatPercent(verified / n), hint: `${formatNumber(verified)} / ${formatNumber(n)}` }),
        hot ? kpiTile({ label: st('hotHandoffs'), icon: 'inbox', value: formatNumber(hot), hint: formatPercent(hot / n) }) : null,
        links ? kpiTile({ label: st('linksSent'), icon: 'send', value: formatNumber(links), hint: formatPercent(links / n) }) : null,
      ].filter(Boolean)) : null,
      card({ flush: true, class: 'wf-dense', body: n || outcome ? table : emptyState({ icon: 'mic', title: st('noCalls'), text: st('noCallsHint'), action: button({ label: st('rehearse'), icon: 'phone-call', onClick: () => rehearsePicker(api, navigate) }) }) }));
    if (route.query.call) openCall(api, route.query.call, navigate, () => history.replaceState(null, '', '#/voice'));
  },
};
