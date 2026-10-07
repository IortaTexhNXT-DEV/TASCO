import { h, clear, mount, fmtDateTime } from '../../shared/dom.js';
import { pageHead, table, statusBadge, field, toast, errorToast, confirmDialog } from '../ui.js';

/** Flat JSON-path diff for reviewing a version against the active one. */
function diff(a, b, path = '$', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const isObj = (x) => x && typeof x === 'object';
  if (isObj(a) && isObj(b) && Array.isArray(a) === Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}${Array.isArray(a) ? `[${k}]` : `.${k}`}`, out);
    return out;
  }
  out.push({ path, from: a === undefined ? '∅' : JSON.stringify(a), to: b === undefined ? '∅' : JSON.stringify(b) });
  return out;
}

export default {
  perm: 'rules:read',
  async render(main, { api, route, can, navigate, user }) {
    const id = route.params[0];
    if (!id) return renderList(main, api, navigate);
    const r = await api.get(`/api/rules/${encodeURIComponent(id)}`);
    const active = (await api.get(`/api/rules?kind=${encodeURIComponent(r.kind)}&status=active`))[0];
    const activePayload = active && active.id !== r.id ? (await api.get(`/api/rules/${encodeURIComponent(active.id)}`)).payload : null;
    const editor = h('textarea', { class: 'code', spellcheck: 'false', 'aria-label': 'Rule payload (JSON)' });
    editor.value = JSON.stringify(r.payload, null, 2);
    const out = h('div', { 'aria-live': 'polite' });
    const parse = () => { try { return JSON.parse(editor.value); } catch (e) { mount(out, h('div', { class: 'alert danger' }, `JSON error: ${e.message}`)); return null; } };
    const simId = h('input', { placeholder: 'Plate key, e.g. 30A12345', maxlength: '20' });
    const comment = h('input', { maxlength: '500', placeholder: 'Comment (optional)' });

    const actions = [];
    if (can('rules:author')) {
      actions.push(h('button', { class: 'btn', onclick: async () => { const p = parse(); if (!p) return; const res = await api.post('/api/rules/validate', { kind: r.kind, payload: p }); mount(out, res.errors.length ? h('div', { class: 'alert danger' }, h('strong', {}, 'Invalid'), h('ul', {}, res.errors.map((e) => h('li', {}, e)))) : h('div', { class: 'alert ok' }, 'Valid ✓')); } }, 'Validate'));
      actions.push(h('button', { class: 'btn primary', onclick: async () => { const p = parse(); if (!p) return; try { const d = await api.post('/api/rules', { kind: r.kind, payload: p, description: `Edited from ${r.id}` }); toast(`Draft ${d.id} created`, 'ok'); navigate(`rules/${encodeURIComponent(d.id)}`); } catch (e) { errorToast(e); } } }, 'Save as new draft'));
      if (r.status === 'draft' && r.createdBy === user.id) actions.push(h('button', { class: 'btn accent', onclick: async () => { try { await api.post(`/api/rules/${encodeURIComponent(r.id)}/submit`, {}); toast('Submitted for approval', 'ok'); navigate(`rules/${encodeURIComponent(r.id)}?t=${Date.now()}`); } catch (e) { errorToast(e); } } }, 'Submit for approval'));
      if (['retired', 'rejected'].includes(r.status)) actions.push(h('button', { class: 'btn', onclick: async () => { try { const d = await api.post(`/api/rules/${encodeURIComponent(r.id)}/rollback`, {}); toast(`Rollback draft ${d.id}`, 'ok'); navigate(`rules/${encodeURIComponent(d.id)}`); } catch (e) { errorToast(e); } } }, 'Roll back to this version'));
    }
    if (can('rules:approve') && r.status === 'pending_approval') {
      actions.push(h('button', { class: 'btn primary', onclick: async () => { if (!(await confirmDialog('Approve and activate?', `${r.id} will replace the active ${r.kind} rules immediately.`, 'Approve'))) return; try { await api.post(`/api/rules/${encodeURIComponent(r.id)}/approve`, { comment: comment.value || undefined }); toast('Activated', 'ok'); navigate(`rules/${encodeURIComponent(r.id)}?t=${Date.now()}`); } catch (e) { errorToast(e); } } }, 'Approve'));
      actions.push(h('button', { class: 'btn danger', onclick: async () => { try { await api.post(`/api/rules/${encodeURIComponent(r.id)}/reject`, { comment: comment.value || undefined }); toast('Rejected'); navigate(`rules/${encodeURIComponent(r.id)}?t=${Date.now()}`); } catch (e) { errorToast(e); } } }, 'Reject'));
    }
    const simulatable = ['scoring', 'nba', 'journeys', 'benefits'].includes(r.kind);
    const changes = activePayload ? diff(activePayload, r.payload) : [];

    mount(main, 
      pageHead(`${r.kind} · v${r.version_no}`, r.description || '', h('a', { class: 'btn', href: '#/rules' }, '← All rule sets')),
      h('div', { class: 'grid cols-2' },
        h('section', { class: 'card stack' },
          h('div', { class: 'row' }, statusBadge(r.status), h('span', { class: 'small muted' }, `checksum ${r.checksum} · by ${r.createdBy} ${r.approvedBy ? `· approved by ${r.approvedBy}` : ''}`)),
          editor,
          (can('rules:approve') && r.status === 'pending_approval') ? field('Review comment', comment) : null,
          h('div', { class: 'row' }, actions), out),
        h('div', { class: 'stack' },
          activePayload ? h('section', { class: 'card' }, h('h2', {}, `Changes vs active (${active.id})`), changes.length ? table([{ label: 'Path', render: (c) => h('code', {}, c.path) }, { label: 'Active', render: (c) => h('code', {}, c.from.slice(0, 80)) }, { label: 'This version', render: (c) => h('code', {}, c.to.slice(0, 80)) }], changes.slice(0, 100)) : h('p', {}, 'No differences.')) : null,
          simulatable ? h('section', { class: 'card stack' }, h('h2', {}, 'Simulate against a customer'), field('Customer', simId),
            h('button', { class: 'btn', onclick: async () => {
              const p = parse(); if (!p) return;
              try {
                const s = await api.post('/api/rules/simulate', { profileId: simId.value.trim().toUpperCase(), kind: r.kind, payload: p });
                mount(out, h('div', { class: 'alert info' }, h('strong', {}, 'Simulation'), h('p', {}, `Current: score ${s.current.score} (${s.current.tier}), ${s.current.journey}, NBA ${s.current.nextBestAction.action}`), h('p', {}, `Candidate: score ${s.candidate.score} (${s.candidate.tier}), ${s.candidate.journey}, NBA ${s.candidate.nextBestAction.action}`)));
              } catch (e) { errorToast(e); }
            } }, 'Run simulation')) : null,
          h('section', { class: 'card' }, h('h2', {}, 'Governance'), h('ol', {}, h('li', {}, 'Author edits and validates; customer copy is checked by the copy guard.'), h('li', {}, 'Simulate on real customers before submitting.'), h('li', {}, 'A different user approves (maker-checker). Previous version is retired; all steps are audited.'), h('li', {}, 'Roll back by creating a draft from an older version.'))))));
    return undefined;
  },
};

async function renderList(main, api, navigate) {
  const all = await api.get('/api/rules');
  const pending = all.filter((r) => r.status === 'pending_approval');
  mount(main, 
    pageHead('Rules studio', 'Every business rule is versioned configuration with maker-checker approval — no code changes needed.'),
    pending.length ? h('div', { class: 'alert warn' }, `${pending.length} change(s) awaiting approval: `, pending.map((p) => h('a', { href: `#/rules/${encodeURIComponent(p.id)}`, style: 'margin-right:8px' }, p.id))) : null,
    h('section', { class: 'card', style: 'margin-top:16px' }, table([
      { label: 'Kind', render: (r) => h('strong', {}, r.kind) },
      { label: 'Version', num: true, render: (r) => r.version_no },
      { label: 'Status', render: (r) => statusBadge(r.status) },
      { label: 'Description', render: (r) => h('span', { class: 'small' }, (r.description || '').slice(0, 140)) },
      { label: 'Author', render: (r) => r.createdBy },
      { label: 'Activated', render: (r) => fmtDateTime(r.activatedAt) },
    ], all.sort((a, b) => (a.kind === b.kind ? b.version_no - a.version_no : a.kind < b.kind ? -1 : 1)), { onRowClick: (r) => navigate(`rules/${encodeURIComponent(r.id)}`), caption: 'Rule sets' })));
}
