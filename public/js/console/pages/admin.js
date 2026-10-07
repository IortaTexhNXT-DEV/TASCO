import { h, clear, mount, fmtDate, fmtDateTime, fmtVnd } from '../../shared/dom.js';
import { pageHead, table, statusBadge, field, select, toast, errorToast } from '../ui.js';

export const partners = {
  perm: 'partners:manage',
  async render(main, { api, navigate }) {
    const list = await api.get('/api/partners');
    const out = h('div', {});
    const name = h('input', { required: true, maxlength: '120' });
    const type = select([['bank', 'Bank'], ['showroom', 'Car showroom'], ['agent', 'Agent'], ['fleet', 'Fleet'], ['inspection_center', 'Inspection centre']], 'showroom');
    const form = h('form', { class: 'card stack' }, h('h2', {}, 'Onboard partner'), field('Name', name), field('Type', type), h('button', { class: 'btn primary', type: 'submit' }, 'Create'));
    form.addEventListener('submit', async (e) => { e.preventDefault(); try { await api.post('/api/partners', { name: name.value, type: type.value }); toast('Partner created', 'ok'); navigate(`partners?t=${Date.now()}`); } catch (ex) { errorToast(ex); } });
    const rows = list.map((p) => ({ ...p }));
    mount(main, 
      pageHead('Partners', 'Arm the partners that already close most deals: API access, white-label quotes, transparent commission (statutory caps enforced).'),
      h('div', { class: 'grid cols-2' },
        h('section', { class: 'card' }, table([
          { label: 'ID', render: (p) => h('code', {}, p.id) }, { label: 'Name', render: (p) => p.name }, { label: 'Type', render: (p) => p.type }, { label: 'Status', render: (p) => statusBadge(p.status) },
          { label: 'Actions', render: (p) => h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: async () => { try { const k = await api.post(`/api/partners/${encodeURIComponent(p.id)}/keys`); mount(out, h('div', { class: 'alert warn' }, h('strong', {}, 'Copy this API key now — it will not be shown again: '), h('code', {}, k.apiKey))); } catch (ex) { errorToast(ex); } } }, 'Issue API key'),
            h('button', { class: 'btn small', onclick: async () => { try { const s = await api.get(`/api/partners/${encodeURIComponent(p.id)}/statement`); mount(out, h('div', { class: 'card' }, h('h3', {}, `Statement ${p.id}`), h('p', {}, `${s.orders} orders · commission ${fmtVnd(s.totalCommission)}`), table([{ label: 'Order', render: (l) => l.orderId.slice(0, 12) }, { label: 'Date', render: (l) => fmtDate(l.date) }, { label: 'Product', render: (l) => l.product }, { label: 'Rate', num: true, render: (l) => `${(l.rate * 100).toFixed(1)}%` }, { label: 'Amount', num: true, render: (l) => fmtVnd(l.amount) }], s.lines))); } catch (ex) { errorToast(ex); } } }, 'Statement'),
            h('button', { class: 'btn small', onclick: async () => { try { await api.patch(`/api/partners/${encodeURIComponent(p.id)}`, { status: p.status === 'active' ? 'suspended' : 'active' }); navigate(`partners?t=${Date.now()}`); } catch (ex) { errorToast(ex); } } }, p.status === 'active' ? 'Suspend' : 'Activate')) },
        ], rows), out),
        h('div', { class: 'stack' }, form, h('section', { class: 'card' }, h('h2', {}, 'Partner API'), h('p', { class: 'small' }, 'POST /api/partner/v1/quotes · POST /api/partner/v1/orders (Idempotency-Key) · GET /api/partner/v1/policies · GET /api/partner/v1/statement — header X-Api-Key. Full OpenAPI at /api/openapi.json.')))));
  },
};

export const claims = {
  perm: 'claims:read',
  async render(main, { api, can, navigate }) {
    const list = await api.get('/api/claims?limit=100');
    const NEXT = { submitted: ['acknowledged', 'rejected'], acknowledged: ['assessor_assigned', 'rejected'], assessor_assigned: ['under_assessment'], under_assessment: ['approved', 'rejected'], approved: ['paid'] };
    mount(main, 
      pageHead('Claims — first notice of loss', 'Reported from the VETC app. Fast, transparent claims build the trust that drives renewals.'),
      h('section', { class: 'card' }, table([
        { label: 'Claim', render: (c) => h('code', {}, c.id) }, { label: 'Policy', render: (c) => c.policyId }, { label: 'Incident', render: (c) => fmtDate(c.incidentDate) },
        { label: 'Status', render: (c) => statusBadge(c.status) }, { label: 'SLA due', render: (c) => fmtDateTime(c.slaDueAt) },
        { label: 'Next', render: (c) => (can('claims:update') ? h('div', { class: 'row' }, (NEXT[c.status] || []).map((s) => h('button', { class: 'btn small', onclick: async () => { try { await api.patch(`/api/claims/${encodeURIComponent(c.id)}`, { status: s }); toast(`Claim ${s}`, 'ok'); navigate(`claims?t=${Date.now()}`); } catch (e) { errorToast(e); } } }, s))) : '—') },
      ], list)));
  },
};

export const dq = {
  perm: 'dq:read',
  async render(main, { api, route, can, navigate }) {
    const type = route.query.type || '';
    const d = await api.get(`/api/dq/issues?limit=50${type ? `&type=${encodeURIComponent(type)}` : ''}`);
    mount(main, 
      pageHead('Data quality', 'Every gap found while building golden records. Journeys also ask customers to repair their own data in-app.'),
      h('div', { class: 'row', style: 'margin-bottom:16px' }, h('a', { class: `btn small ${!type ? 'primary' : ''}`, href: '#/dq' }, 'All'), Object.entries(d.byType).map(([k, v]) => h('a', { class: `btn small ${type === k ? 'primary' : ''}`, href: `#/dq?type=${encodeURIComponent(k)}` }, `${k} (${v})`))),
      h('section', { class: 'card' }, table([
        { label: 'Issue', render: (i) => i.type }, { label: 'Customer', render: (i) => (i.profileId ? h('a', { href: `#/customer/${encodeURIComponent(i.profileId)}` }, i.profileId) : i.recordId) },
        { label: 'Source', render: (i) => i.source || i.batchId || '—' }, { label: 'Detected', render: (i) => fmtDateTime(i.detectedAt) },
        { label: 'Resolve', render: (i) => (can('dq:resolve') ? h('button', { class: 'btn small', onclick: async () => { const res = prompt('Resolution note'); if (!res) return; try { await api.post(`/api/dq/issues/${encodeURIComponent(i.id)}/resolve`, { resolution: res }); toast('Resolved', 'ok'); navigate(`dq?type=${type}&t=${Date.now()}`); } catch (e) { errorToast(e); } } }, 'Resolve') : '—') },
      ], d.items)));
  },
};

export const audit = {
  perm: 'audit:read',
  async render(main, { api, route, navigate }) {
    const q = { entityId: route.query.entityId || '', actor: route.query.actor || '', action: route.query.action || '' };
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    params.set('limit', '100');
    const [entries, gov] = await Promise.all([api.get(`/api/audit?${params}`), api.get('/api/dashboard/governance')]);
    const inputs = { entityId: h('input', { value: q.entityId, maxlength: '80' }), actor: h('input', { value: q.actor, maxlength: '80' }), action: h('input', { value: q.action, maxlength: '80', placeholder: 'e.g. rules.approved' }) };
    const chain = gov.auditChain;
    mount(main, 
      pageHead('Audit trail', 'Append-only, hash-chained record of every material action.'),
      h('div', { class: `alert ${chain.ok ? 'ok' : 'danger'}`, role: 'status' }, chain.ok ? `Hash chain verified: ${chain.entries} entries, head ${String(chain.head).slice(0, 16)}…` : `CHAIN BROKEN at entry ${chain.brokenAt}: ${chain.reason}`),
      h('div', { class: 'grid cols-3', style: 'margin-top:16px' },
        h('div', { class: 'card kpi' }, h('span', { class: 'label' }, 'Voice bot calls'), h('span', { class: 'value' }, gov.voiceBot.calls), h('span', { class: 'hint' }, `opt-out ${(gov.voiceBot.optOutRate * 100).toFixed(1)}% · plate fail ${(gov.voiceBot.plateVerificationFailureRate * 100).toFixed(1)}%`)),
        h('div', { class: 'card kpi' }, h('span', { class: 'label' }, 'Rule sets by status'), h('span', { class: 'value' }, Object.values(gov.rules).reduce((s, v) => s + v, 0)), h('span', { class: 'hint' }, Object.entries(gov.rules).map(([k, v]) => `${k} ${v}`).join(' · '))),
        h('div', { class: 'card kpi' }, h('span', { class: 'label' }, 'Disclosure policy'), h('span', { class: 'hint' }, gov.voiceBot.disclosure))),
      h('form', { class: 'card filters', style: 'margin-top:16px', onsubmit: (e) => { e.preventDefault(); navigate(`audit?${new URLSearchParams(Object.entries(inputs).map(([k, v]) => [k, v.value]).filter(([, v]) => v))}`); } },
        field('Entity id', inputs.entityId), field('Actor', inputs.actor), field('Action', inputs.action), h('button', { class: 'btn primary', type: 'submit' }, 'Search')),
      h('section', { class: 'card', style: 'margin-top:16px' }, table([
        { label: 'When', render: (a) => fmtDateTime(a.at) }, { label: 'Actor', render: (a) => a.actor }, { label: 'Action', render: (a) => h('code', {}, a.action) },
        { label: 'Entity', render: (a) => `${a.entityType || ''} ${a.entityId || ''}` }, { label: 'Details', render: (a) => h('code', { class: 'xs' }, a.details ? JSON.stringify(a.details).slice(0, 160) : '') },
        { label: 'Hash', render: (a) => h('code', { class: 'xs' }, a.hash.slice(0, 10)) },
      ], entries)));
  },
};

export const users = {
  perm: 'users:manage',
  async render(main, { api, navigate }) {
    const list = await api.get('/api/users');
    const f = { username: h('input', { required: true, pattern: '[a-z0-9._-]+', maxlength: '60' }), displayName: h('input', { required: true, maxlength: '120' }), password: h('input', { type: 'password', required: true, minlength: '12', autocomplete: 'new-password' }), region: h('input', { value: 'ALL', maxlength: '60' }) };
    const roles = h('select', { multiple: true, size: '6' }, ['telesales_agent', 'telesales_supervisor', 'campaign_manager', 'rule_author', 'rule_approver', 'compliance_officer', 'data_steward', 'claims_handler', 'partner_manager', 'auditor', 'executive', 'support_engineer', 'admin'].map((r) => h('option', { value: r }, r)));
    const mfa = h('input', { type: 'checkbox', checked: true });
    const out = h('div', {});
    const form = h('form', { class: 'card stack' }, h('h2', {}, 'Create user'), field('Username', f.username), field('Display name', f.displayName), field('Temporary password (≥ 12 chars)', f.password), field('Region', f.region), field('Roles', roles, 'Least privilege — choose only what the person needs'), h('label', { class: 'check' }, mfa, 'Enrol MFA (mandatory for privileged roles)'), h('button', { class: 'btn primary', type: 'submit' }, 'Create'), out);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const r = await api.post('/api/users', { username: f.username.value, displayName: f.displayName.value, password: f.password.value, region: f.region.value || 'ALL', roles: [...roles.selectedOptions].map((o) => o.value), enableMfa: mfa.checked });
        mount(out, h('div', { class: 'alert ok' }, `Created ${r.user.username}.`, r.totpSecret ? [' Authenticator secret (show once): ', h('code', {}, r.totpSecret)] : ''));
      } catch (ex) { errorToast(ex); }
    });
    mount(main, pageHead('Users', 'Identity, roles and regions. Admins cannot read customer data or approve rules (segregation of duties).'),
      h('div', { class: 'grid cols-2' },
        h('section', { class: 'card' }, table([
          { label: 'User', render: (u) => h('strong', {}, u.username) }, { label: 'Name', render: (u) => u.displayName }, { label: 'Roles', render: (u) => u.roles.join(', ') }, { label: 'Region', render: (u) => u.region },
          { label: 'MFA', render: (u) => (u.mfaEnabled ? '✓' : '—') }, { label: 'Status', render: (u) => statusBadge(u.status) }, { label: 'Last login', render: (u) => fmtDateTime(u.lastLoginAt) },
          { label: '', render: (u) => h('button', { class: 'btn small', onclick: async () => { try { await api.patch(`/api/users/${encodeURIComponent(u.id)}`, { status: u.status === 'active' ? 'disabled' : 'active' }); navigate(`users?t=${Date.now()}`); } catch (ex) { errorToast(ex); } } }, u.status === 'active' ? 'Disable' : 'Enable') },
        ], list)), form));
  },
};

export const ops = {
  perm: 'ops:read',
  async render(main, { api, can, navigate }) {
    const [status, jobs] = await Promise.all([api.get('/api/ops/status'), api.get('/api/ops/jobs')]);
    const run = (kind) => async () => { try { const r = await api.post(`/api/ops/jobs/${kind}`); toast(`${kind}: ${JSON.stringify(r).slice(0, 140)}`, 'ok'); navigate(`ops?t=${Date.now()}`); } catch (e) { errorToast(e); } };
    mount(main, pageHead('Operations', `Store: ${status.store} · audit entries ${status.auditEntries}`,
      can('ops:run_jobs') ? h('div', { class: 'row' }, ['reconciliation', 'retention', 'relay'].map((k) => h('button', { class: 'btn small', onclick: run(k) }, `Run ${k}`))) : null),
    h('div', { class: 'grid cols-3' },
      h('section', { class: 'card' }, h('h2', {}, 'Integrations'), table([{ label: 'Integration', render: (i) => i.name }, { label: 'Circuit', render: (i) => statusBadge(i.circuit === 'closed' ? 'active' : i.circuit === 'open' ? 'failed' : 'pending_approval') }], status.integrations)),
      h('section', { class: 'card' }, h('h2', {}, 'Event backlog'), table([{ label: 'Status', render: (r) => r[0] }, { label: 'Count', num: true, render: (r) => r[1] }], Object.entries(status.eventBacklog))),
      h('section', { class: 'card' }, h('h2', {}, 'Active rules'), table([{ label: 'Kind', render: (r) => r.kind }, { label: 'v', num: true, render: (r) => r.version }, { label: 'Checksum', render: (r) => h('code', { class: 'xs' }, r.checksum) }], status.rules))),
    h('section', { class: 'card', style: 'margin-top:16px' }, h('h2', {}, 'Job history'), table([{ label: 'Started', render: (j) => fmtDateTime(j.startedAt) }, { label: 'Kind', render: (j) => j.kind }, { label: 'Actor', render: (j) => j.actor }, { label: 'Status', render: (j) => statusBadge(j.status === 'succeeded' ? 'done' : j.status) }, { label: 'Result', render: (j) => h('code', { class: 'xs' }, JSON.stringify(j.result || j.error || '').slice(0, 160)) }], jobs)));
  },
};
