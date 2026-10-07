import { h, mount } from '../../shared/dom.js';
import { label } from '../../shared/i18n.js';
import { pageHead, field, toast, errorToast, tierBadge, statusBadge } from '../ui.js';

const QUICK = ['30A 123 45', 'đúng rồi', 'phí bao nhiêu tiền vậy', 'sao biết số tôi, lừa đảo à', 'gửi link qua zalo cho tôi', 'tôi muốn mua ngay', 'tôi đã gia hạn rồi', 'đang lái xe, gọi lại sau', 'đừng gọi nữa'];

export default {
  perm: 'voice:operate',
  async render(main, { api, route, can, navigate }) {
    const head = pageHead('Voice bot console', 'Rehearse or supervise the AI assistant. It discloses it is automated, verifies the plate first, never takes payment and hands hot leads to telesales.');
    const profileId = route.query.profile;
    if (!profileId) {
      const hot = await api.get('/api/leads?tier=hot&limit=10');
      mount(main, head,
        h('section', { class: 'card stack' }, h('h2', {}, 'Pick a customer'),
          h('ul', {}, hot.items.map((l) => h('li', {}, h('a', { href: `#/voice?profile=${encodeURIComponent(l.id)}` }, l.plate), ' ', tierBadge(l.tier), ' ', h('span', { class: 'muted small', title: l.nextBestAction.action }, label('nba', l.nextBestAction.action)))))),
        can('journeys:run') ? campaignCard(api) : null);
      return;
    }
    const session = await api.post('/api/voice/sessions', { profileId });
    const chat = h('div', { class: 'chat', role: 'log', 'aria-live': 'polite', 'aria-label': 'Call transcript' });
    const status = h('div', { class: 'row' });
    const input = h('input', { maxlength: '500', autocomplete: 'off', placeholder: 'What the customer says…' });
    const sendBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Send');
    let s = session;

    function paint() {
      mount(chat, s.transcript.map((m) => h('div', { class: `bubble ${m.speaker}` }, h('span', { class: 'sr-only' }, m.speaker === 'bot' ? 'Assistant: ' : 'Customer: '), m.text, m.gloss ? h('span', { class: 'gloss' }, m.gloss) : null)));
      chat.scrollTop = chat.scrollHeight; // scroll the transcript, never the page
      mount(status, h('span', {}, 'State: '), statusBadge(s.state, 'voiceState'), s.verified ? h('span', { class: 'badge ok' }, 'plate verified') : h('span', { class: 'badge warn' }, 'not verified'), s.outcome ? h('span', { class: 'badge info', title: s.outcome }, `outcome: ${label('outcome', s.outcome)}`) : null);
      const ended = s.state === 'ended';
      input.disabled = ended;
      sendBtn.disabled = ended;
      if (ended && s.handoffId) toast(`Hot lead handed to telesales (${s.handoffId})`, 'ok');
    }
    async function say(text) {
      if (!text.trim()) return;
      try { s = await api.post(`/api/voice/sessions/${s.id}/turns`, { text }); paint(); } catch (e) { errorToast(e); }
      input.value = '';
      input.focus({ preventScroll: true });
    }
    const form = h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); say(input.value); } }, h('div', { style: 'flex:1;min-width:200px' }, field('Customer utterance (ASR text)', input)), sendBtn);
    mount(main, head,
      h('div', { class: 'grid cols-2' },
        h('section', { class: 'card stack' }, h('h2', {}, `Call with ${s.ctx.plateMasked}`), h('p', { class: 'small muted' }, `Customer must say the plate. Hint for rehearsal: open the Customer 360 to see the plate.`), status, chat, form),
        h('section', { class: 'card stack' }, h('h2', {}, 'Quick replies'), h('div', { class: 'demo-users' }, QUICK.map((q) => h('button', { class: 'btn small', onclick: () => say(q) }, q))),
          h('button', { class: 'btn', onclick: () => navigate(`customer/${encodeURIComponent(profileId)}`) }, 'Open Customer 360'),
          h('button', { class: 'btn', onclick: () => navigate(`voice?profile=${encodeURIComponent(profileId)}&r=${Date.now()}`) }, 'Restart call'))));
    paint();
    input.focus({ preventScroll: true });
  },
};

function campaignCard(api) {
  const limit = h('input', { type: 'number', min: '1', max: '200', value: '20' });
  const out = h('div', {});
  const form = h('form', { class: 'card stack' }, h('h2', {}, 'Run automated campaign'), h('p', { class: 'small muted' }, 'Calls top hot leads with call consent (sandbox telephony with simulated customers).'), field('Number of calls', limit), h('button', { class: 'btn primary', type: 'submit' }, 'Start campaign'), out);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/api/voice/campaign', { limit: Number(limit.value), tier: 'hot' });
      mount(out, h('div', { class: 'alert ok' }, `Called ${r.called}: ${Object.entries(r.outcomes).map(([k, v]) => `${label('outcome', k)} ${v}`).join(', ')}`));
    } catch (ex) { errorToast(ex); }
  });
  return form;
}
