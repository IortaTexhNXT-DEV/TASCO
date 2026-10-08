import { h, mount } from '../../shared/dom.js';
import { label } from '../../shared/i18n.js';
import {
  pageHeader, card, kpiStrip, kpiTile, dataTable, badge, button, avatar, stepper, timeline, keyValueList, banner, emptyState,
  toast, errorToast, modal, formField, textarea, infoTip, iconButton, chip, skeleton, formatRelative, formatDateTime,
  formatNumber, formatPlate, icon,
} from '../ui.js';
import { tl, AREAS, kindName, kindDesc, kindArea, ruleStatus, plainName, describeVersionNote, isRulesTechnical } from '../gov-text.js';
import { ruleForm, describeChanges, explainErrors, canRepresent, isPricingKind, coreOwnedBanner } from '../rule-forms.js';

/**
 * Rules studio: business rule sets grouped by area, a schema-driven form editor per rule kind, a live
 * "What changes" list in business language, customer simulation, and the maker-checker workflow
 * (Draft → Awaiting approval → Approved → Active) with verb actions.
 */

const SIMULATABLE = ['scoring', 'nba', 'journeys', 'benefits'];
const STATUS_TONE = { draft: 'neutral', pending_approval: 'warn', active: 'ok', retired: 'neutral', rejected: 'danger' };
export const ruleStatusChip = (s, version) => badge(version ? `${ruleStatus(s)} v${version}` : ruleStatus(s), STATUS_TONE[s] || 'neutral', { dot: true });
export const restrictedChip = () => badge(tl('Restricted: compliance approval', 'Hạn chế: Tuân thủ phê duyệt'), 'warn', { icon: 'lock' });

/** Most recent event on a version: { at, by, byName }. */
export function lastEvent(r) {
  const ev = [
    [r.createdAt, r.createdBy, plainName(r.createdByDisplayName, r.createdByName, r.createdBy)],
    [r.updatedAt, r.createdBy, plainName(r.createdByDisplayName, r.createdByName, r.createdBy)],
    [r.submittedAt, r.createdBy, plainName(r.createdByDisplayName, r.createdByName, r.createdBy)],
    [r.withdrawnAt, r.createdBy, plainName(r.createdByDisplayName, r.createdByName, r.createdBy)],
    [r.activatedAt, r.approvedBy, plainName(r.approvedByDisplayName, r.approvedByName, r.approvedBy)],
    [r.rejectedAt, r.rejectedBy, plainName(r.rejectedByDisplayName, r.rejectedByName, r.rejectedBy)],
  ].filter(([at]) => at).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  const [at, by, byName] = ev[0] || [r.createdAt, r.createdBy, plainName(r.createdByDisplayName, r.createdByName, r.createdBy)];
  return { at, by, byName };
}

/** Change note for a version; seeded (system) versions carry configuration descriptions, shown as "Initial configuration". */
export const versionNote = (v) => (v.createdBy === 'system' ? tl('Initial configuration', 'Cấu hình ban đầu') : describeVersionNote(v.description));
const who = (name) => h('span', { class: 'who' }, avatar(name, { size: 'sm' }), h('span', { class: 'who-name' }, name));

export default {
  perm: 'rules:read',
  async render(main, ctx) {
    const id = ctx.route.params[0];
    if (!id) return renderList(main, ctx);
    return renderDetail(main, ctx, id);
  },
};

/* =========================================================================
 * List
 * ========================================================================= */

async function renderList(main, { api, can, navigate, route }) {
  const [all, context] = await Promise.all([api.get('/api/rules'), api.get('/api/rules/context').catch(() => ({ restrictedKinds: {} }))]);
  const byKind = new Map();
  for (const r of all) byKind.set(r.kind, [...(byKind.get(r.kind) || []), r]);
  const sets = [...byKind.entries()].map(([kind, versions]) => {
    versions.sort((a, b) => b.version_no - a.version_no);
    const last = versions.map((v) => ({ v, e: lastEvent(v) })).sort((a, b) => String(b.e.at).localeCompare(String(a.e.at)))[0];
    return {
      id: kind, kind, name: kindName(kind), desc: kindDesc(kind), area: kindArea(kind), versions,
      active: versions.find((v) => v.status === 'active'), pending: versions.filter((v) => v.status === 'pending_approval'), drafts: versions.filter((v) => v.status === 'draft'),
      restricted: !!context.restrictedKinds?.[kind], lastAt: last?.e.at, lastBy: last?.e.byName,
    };
  });
  const filter = route.query.show || 'all';
  const q = (route.query.q || '').toLowerCase();
  const pendingN = sets.reduce((s, x) => s + x.pending.length, 0);
  const draftsN = sets.reduce((s, x) => s + x.drafts.length, 0);
  const restrictedN = sets.filter((x) => x.restricted).length;

  const visible = (x) => (filter === 'all' || (filter === 'drafts' && x.drafts.length) || (filter === 'pending' && x.pending.length) || (filter === 'restricted' && x.restricted))
    && (!q || `${x.name} ${x.desc}`.toLowerCase().includes(q));
  const go = (patch) => {
    const p = new URLSearchParams({ ...(filter !== 'all' ? { show: filter } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v || v === 'all') p.delete(k);
    navigate(`rules${p.toString() ? `?${p}` : ''}`);
  };
  const search = h('input', { type: 'search', placeholder: tl('Search rule sets', 'Tìm bộ quy tắc'), 'aria-label': tl('Search rule sets', 'Tìm bộ quy tắc'), value: route.query.q || '' });
  let t = null;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => go({ q: search.value.trim() }), 350); });

  const columns = [
    { key: 'name', label: tl('Rule set', 'Bộ quy tắc'), primary: true, sortable: true, value: (x) => x.name,
      render: (x) => h('div', { class: 'rs-name' }, h('a', { href: `#/rules/${encodeURIComponent(bestVersion(x).id)}`, class: 'strong', onclick: (e) => e.stopPropagation() }, x.name), h('span', { class: 'cell-sub' }, x.desc)) },
    { key: 'status', label: tl('Versions', 'Phiên bản'), render: (x) => h('div', { class: 'rs-status' },
      x.active ? ruleStatusChip('active', x.active.version_no) : null,
      x.pending.map((p) => ruleStatusChip('pending_approval', p.version_no)),
      x.drafts.slice(0, 2).map((d) => ruleStatusChip('draft', d.version_no)),
      x.drafts.length > 2 ? badge(`+${x.drafts.length - 2}`, 'neutral') : null),
    value: (x) => (x.pending.length ? 0 : x.drafts.length ? 1 : 2), exportValue: (x) => [x.active ? `${ruleStatus('active')} v${x.active.version_no}` : null, ...x.pending.map((p) => `${ruleStatus('pending_approval')} v${p.version_no}`), ...x.drafts.map((d) => `${ruleStatus('draft')} v${d.version_no}`)].filter(Boolean).join(' · ') },
    { key: 'lastBy', label: tl('Last changed by', 'Thay đổi gần nhất bởi'), sortable: true, render: (x) => (x.lastBy ? who(x.lastBy) : '—'), exportValue: (x) => x.lastBy || '' },
    { key: 'lastAt', label: tl('When', 'Thời điểm'), sortable: true, nowrap: true, value: (x) => x.lastAt || '',
      render: (x) => (x.lastAt ? h('time', { datetime: x.lastAt, title: formatDateTime(x.lastAt) }, formatRelative(x.lastAt)) : '—'), exportValue: (x) => formatDateTime(x.lastAt) },
    { key: 'restricted', label: tl('Approval', 'Phê duyệt'), render: (x) => (x.restricted ? badge(tl('Compliance', 'Tuân thủ'), 'warn', { icon: 'lock', title: tl('Restricted: compliance approval', 'Hạn chế: Tuân thủ phê duyệt') }) : h('span', { class: 'muted small' }, tl('Rule approver', 'Người phê duyệt'))), exportValue: (x) => (x.restricted ? tl('Compliance officer', 'Cán bộ tuân thủ') : tl('Rule approver', 'Người phê duyệt')) },
  ];

  const areaCards = AREAS.map((a) => {
    const rows = sets.filter((x) => x.area === a.id && visible(x)).sort((x, y) => x.name.localeCompare(y.name));
    if (!rows.length) return null;
    return card({
      title: h('span', { class: 'area-title' }, h('span', { class: 'area-icon' }, icon(a.icon, { size: 16 })), tl(a.name)),
      actions: [badge(tl(`${rows.length} rule sets`, `${rows.length} bộ quy tắc`), 'neutral')],
      flush: true, class: 'rs-area',
      body: dataTable({ columns, rows, rowKey: (x) => x.kind, onRowClick: (x) => navigate(`rules/${encodeURIComponent(bestVersion(x).id)}`), pagination: false, caption: tl(a.name) }),
    });
  }).filter(Boolean);

  mount(main,
    pageHeader({
      title: tl('Business rules', 'Quy tắc nghiệp vụ'),
      subtitle: tl('Versioned business settings — every change is approved by a second person', 'Thiết lập nghiệp vụ có phiên bản — mọi thay đổi đều do người thứ hai phê duyệt'),
      actions: [can('rules:approve') ? button({ label: pendingN ? tl(`Approvals (${pendingN})`, `Phê duyệt (${pendingN})`) : tl('Approvals', 'Phê duyệt'), icon: 'clipboard-check', variant: pendingN ? 'primary' : 'secondary', onClick: () => navigate('approvals') }) : null],
    }),
    kpiStrip([
      kpiTile({ label: tl('Rule sets', 'Bộ quy tắc'), value: formatNumber(sets.length), icon: 'scale', hint: tl(`${sets.filter((x) => x.active).length} active`, `${sets.filter((x) => x.active).length} đang áp dụng`) }),
      kpiTile({ label: tl('Awaiting approval', 'Chờ phê duyệt'), value: formatNumber(pendingN), icon: 'clipboard-check', onClick: () => go({ show: 'pending' }) }),
      kpiTile({ label: tl('Drafts in progress', 'Bản nháp đang soạn'), value: formatNumber(draftsN), icon: 'edit', onClick: () => go({ show: 'drafts' }) }),
      kpiTile({ label: tl('Restricted rule sets', 'Bộ quy tắc hạn chế'), value: formatNumber(restrictedN), icon: 'lock', hint: tl('Need compliance approval', 'Cần Tuân thủ phê duyệt'), onClick: () => go({ show: 'restricted' }) }),
    ]),
    h('div', { class: 'rs-toolbar' },
      h('div', { class: 'dt-search input-group' }, icon('search', { size: 16 }), search),
      h('div', { class: 'chip-row' },
        [['all', tl('All', 'Tất cả'), sets.length], ['pending', tl('Awaiting approval', 'Chờ phê duyệt'), pendingN], ['drafts', tl('Drafts', 'Bản nháp'), draftsN], ['restricted', tl('Restricted', 'Hạn chế'), restrictedN]]
          .map(([k, l, n]) => chip({ label: l, count: n, selected: filter === k, onClick: () => go({ show: k }) })))),
    areaCards.length ? h('div', { class: 'stack-lg' }, areaCards) : card({ body: emptyState({ icon: 'search', title: tl('No rule sets match', 'Không có bộ quy tắc phù hợp'), action: button({ label: tl('Clear filters', 'Xóa bộ lọc'), onClick: () => navigate('rules') }) }) }));
}

/** Version to open from the list: pending > newest draft > active. */
function bestVersion(x) {
  return x.pending[0] || x.drafts[0] || x.active || x.versions[0];
}

/* =========================================================================
 * Detail / editor
 * ========================================================================= */

async function renderDetail(main, ctx, rawId) {
  const { api, can, navigate, user } = ctx;
  let id = rawId;
  if (!id.includes('@')) {
    const vs = await api.get(`/api/rules?kind=${encodeURIComponent(id)}`);
    const pick = vs.find((v) => v.status === 'pending_approval') || vs.filter((v) => v.status === 'draft').sort((a, b) => b.version_no - a.version_no)[0] || vs.find((v) => v.status === 'active') || vs[0];
    if (!pick) { mount(main, emptyState({ icon: 'alert-circle', title: tl('Rule set not found', 'Không tìm thấy bộ quy tắc') })); return; }
    id = pick.id;
  }
  const [r, context] = await Promise.all([api.get(`/api/rules/${encodeURIComponent(id)}`), api.get('/api/rules/context').catch(() => ({ restrictedKinds: {}, ratingSource: 'rules' }))]);
  const versions = (await api.get(`/api/rules?kind=${encodeURIComponent(r.kind)}`)).sort((a, b) => b.version_no - a.version_no);
  const active = versions.find((v) => v.status === 'active');
  // Compare drafts / pending / rejected with the active version; the active one with the version it replaced.
  const baseMeta = r.status === 'active' || (r.status === 'retired' && active?.id === r.id)
    ? versions.find((v) => v.version_no < r.version_no && v.status === 'retired')
    : active && active.id !== r.id ? active : null;
  const needsGuard = r.kind.startsWith('content.') || r.kind === 'benefits';
  const [base, guard] = await Promise.all([
    baseMeta ? api.get(`/api/rules/${encodeURIComponent(baseMeta.id)}`) : null,
    needsGuard ? api.get('/api/rules?kind=copy_guard&status=active').then((l) => (l[0] ? api.get(`/api/rules/${encodeURIComponent(l[0].id)}`) : null)).catch(() => null) : null,
  ]);
  const bannedPhrases = guard?.payload?.bannedPhrases || [];
  const mine = r.createdBy === user.id;
  const coreOwnedPricing = isPricingKind(r.kind) && context.ratingSource && context.ratingSource !== 'rules';
  const editable = can('rules:author') && r.status === 'draft' && mine && !coreOwnedPricing;
  const restricted = context.restrictedKinds?.[r.kind];
  const myDraft = versions.find((v) => v.status === 'draft' && v.createdBy === user.id && v.id !== r.id);
  const otherDraft = versions.find((v) => v.status === 'draft' && v.id !== r.id);
  const pendingOther = versions.find((v) => v.status === 'pending_approval' && v.id !== r.id);
  const technical = isRulesTechnical(user);
  const productCoreOwned = r.kind === 'products' && (context.ratingSource !== 'rules' || (r.payload?.products || []).some((p) => p.coreVersion));

  let saved = JSON.stringify(r.payload);
  let current = r.payload;
  const changesBody = h('div', {});
  const changesCount = h('span', {});
  const summary = h('div', { class: 'rf-summary', 'aria-live': 'polite' });
  const form = ruleForm({
    kind: r.kind, value: r.payload, readOnly: !editable, bannedPhrases, coreOwned: productCoreOwned,
    onChange: (v) => { current = v; paintChanges(); syncDirty(); },
  });

  // ---- What changes ----
  function paintChanges() {
    if (!base) {
      mount(changesBody, emptyState({ icon: 'layers', title: tl('First version', 'Phiên bản đầu tiên'), text: tl('There is no earlier version to compare with.', 'Chưa có phiên bản trước để so sánh.'), compact: true }));
      mount(changesCount);
      return;
    }
    const list = describeChanges(r.kind, base.payload, current);
    mount(changesCount, list.length ? badge(formatNumber(list.length), 'info') : null);
    if (!list.length) { mount(changesBody, emptyState({ icon: 'check-circle', title: tl('No changes', 'Không có thay đổi'), text: tl(`Same as version ${base.version_no}`, `Giống phiên bản ${base.version_no}`), compact: true })); return; }
    mount(changesBody, changeList(list));
  }

  // ---- Dirty state & actions ----
  const dirtyBadge = h('span', { class: 'rf-dirty', hidden: true }, badge(tl('Unsaved changes', 'Chưa lưu'), 'warn', { dot: true }));
  const syncDirty = () => { dirtyBadge.hidden = JSON.stringify(current) === saved; };
  window.onbeforeunload = null;

  async function validate({ quiet = false } = {}) {
    const payload = form.getValue();
    const client = form.validate();
    let server = [];
    try { server = (await api.post('/api/rules/validate', { kind: r.kind, payload })).errors || []; } catch (e) { errorToast(e); return false; }
    const explained = [...client, ...explainErrors(r.kind, server, payload)];
    const uniq = explained.filter((e, i) => explained.findIndex((x) => x.path === e.path && x.message === e.message) === i);
    const orphans = form.setErrors(uniq);
    if (uniq.length) {
      mount(summary, banner({ tone: 'danger', title: tl(`${uniq.length} ${uniq.length === 1 ? 'setting needs' : 'settings need'} attention`, `${uniq.length} thiết lập cần xem lại`),
        text: orphans.length ? h('ul', { class: 'rf-err-list' }, orphans.map((o) => h('li', {}, o.message))) : tl('See the highlighted fields.', 'Xem các trường được đánh dấu.') }));
      return false;
    }
    mount(summary, quiet ? null : banner({ tone: 'ok', title: tl('All checks passed', 'Đã qua mọi kiểm tra'), text: tl('The settings are valid and the customer wording passes the copy guard.', 'Thiết lập hợp lệ và nội dung gửi khách hàng đạt kiểm soát.'), dismissible: true }));
    return true;
  }
  async function save({ quiet = false } = {}) {
    if (!(await validate({ quiet: true }))) return false;
    try {
      const upd = await api.patch(`/api/rules/${encodeURIComponent(r.id)}`, { payload: form.getValue() });
      saved = JSON.stringify(upd.payload);
      current = upd.payload;
      syncDirty();
      if (!quiet) toast(tl('Draft saved', 'Đã lưu bản nháp'), 'ok');
      return true;
    } catch (e) {
      if (Array.isArray(e.details)) form.setErrors(explainErrors(r.kind, e.details, form.getValue()));
      errorToast(e);
      return false;
    }
  }
  function submitDialog() {
    const ta = textarea({ rows: '4', maxlength: '500', placeholder: tl('What changes and why, e.g. results of the simulation', 'Thay đổi gì và vì sao, vd. kết quả mô phỏng') });
    const f = formField({ label: tl('Note for the approver', 'Ghi chú cho người phê duyệt'), control: ta, required: true, help: tl('The approver sees this next to the list of changes', 'Người phê duyệt sẽ thấy ghi chú này cùng danh sách thay đổi') });
    const go = button({ label: tl('Submit for approval', 'Gửi phê duyệt'), variant: 'primary', icon: 'send', onClick: async () => {
      if (ta.value.trim().length < 5) { f.setError(tl('Please explain the change in a few words', 'Vui lòng mô tả ngắn gọn thay đổi')); ta.focus(); return; }
      if (JSON.stringify(current) !== saved && !(await save({ quiet: true }))) { m.close(); return; }
      try {
        await api.post(`/api/rules/${encodeURIComponent(r.id)}/submit`, { comment: ta.value.trim() });
        m.close();
        toast(tl('Submitted for approval', 'Đã gửi phê duyệt'), 'ok', { title: `${kindName(r.kind)} v${r.version_no}` });
        ctx.refreshSignals?.();
        navigate(`rules/${encodeURIComponent(r.id)}?t=${Date.now()}`);
      } catch (e) { errorToast(e); }
    } });
    const m = modal({ title: tl('Submit for approval', 'Gửi phê duyệt'), size: 'sm', body: h('div', { class: 'stack' },
      restricted ? banner({ tone: 'warn', icon: 'lock', text: tl('This rule set is restricted: a compliance officer must approve it.', 'Bộ quy tắc hạn chế: cán bộ tuân thủ phải phê duyệt.') }) : null, f),
    actions: [button({ label: tl('Cancel', 'Hủy'), onClick: () => m.close() }), go] });
  }
  async function createDraftFrom(viaRollback) {
    try {
      const d = viaRollback
        ? await api.post(`/api/rules/${encodeURIComponent(r.id)}/rollback`, {})
        : await api.post('/api/rules', { kind: r.kind, payload: r.payload, description: tl(`Based on version ${r.version_no}`, `Dựa trên phiên bản ${r.version_no}`) });
      toast(viaRollback ? tl(`Draft v${d.version_no} restores version ${r.version_no}`, `Bản nháp v${d.version_no} khôi phục phiên bản ${r.version_no}`) : tl(`Draft v${d.version_no} created`, `Đã tạo bản nháp v${d.version_no}`), 'ok');
      navigate(`rules/${encodeURIComponent(d.id)}`);
    } catch (e) { errorToast(e); }
  }

  const actions = [];
  if (editable) {
    actions.push(dirtyBadge,
      button({ label: tl('Validate', 'Kiểm tra'), icon: 'list-checks', onClick: () => validate() }),
      button({ label: tl('Save draft', 'Lưu nháp'), icon: 'check', onClick: () => save() }),
      button({ label: tl('Submit for approval', 'Gửi phê duyệt'), icon: 'send', variant: 'primary', onClick: async () => { if (await validate({ quiet: true })) submitDialog(); } }));
  } else if (r.status === 'pending_approval' && mine && can('rules:author')) {
    actions.push(button({ label: tl('Withdraw', 'Rút lại'), icon: 'arrow-left', onClick: async () => {
      try { await api.post(`/api/rules/${encodeURIComponent(r.id)}/withdraw`, {}); toast(tl('Withdrawn — back to draft', 'Đã rút lại — trở về bản nháp'), 'ok'); ctx.refreshSignals?.(); navigate(`rules/${encodeURIComponent(r.id)}?t=${Date.now()}`); } catch (e) { errorToast(e); }
    } }));
  } else if (r.status === 'pending_approval' && can('rules:approve') && !mine) {
    actions.push(button({ label: tl('Review change', 'Xem xét thay đổi'), icon: 'clipboard-check', variant: 'primary', onClick: () => navigate(`approvals?id=${encodeURIComponent(r.id)}`) }));
  } else if (can('rules:author') && !coreOwnedPricing) {
    if (r.status === 'active') {
      if (myDraft) actions.push(button({ label: tl(`Open my draft (v${myDraft.version_no})`, `Mở bản nháp của tôi (v${myDraft.version_no})`), icon: 'edit', onClick: () => navigate(`rules/${encodeURIComponent(myDraft.id)}`) }));
      actions.push(button({ label: tl('Create draft from this version', 'Tạo bản nháp từ phiên bản này'), icon: 'plus', variant: myDraft ? 'secondary' : 'primary', onClick: () => createDraftFrom(false) }));
    } else if (r.status === 'retired') {
      actions.push(button({ label: tl('Roll back to this version', 'Khôi phục phiên bản này'), icon: 'history', variant: 'primary', onClick: () => createDraftFrom(true) }));
    } else if (r.status === 'rejected' || (r.status === 'draft' && !mine)) {
      actions.push(button({ label: tl('Create draft from this version', 'Tạo bản nháp từ phiên bản này'), icon: 'plus', variant: 'primary', onClick: () => createDraftFrom(true) }));
    }
  }

  // ---- Banners ----
  const banners = [];
  if (coreOwnedPricing) banners.push(coreOwnedBanner());
  if (r.status === 'pending_approval' && mine) banners.push(banner({ tone: 'info', icon: 'clock', title: tl('Awaiting approval', 'Đang chờ phê duyệt'), text: tl('A second person reviews this change. You cannot approve your own change — withdraw it to make edits.', 'Người thứ hai sẽ xem xét thay đổi. Bạn không thể tự phê duyệt — hãy rút lại nếu cần chỉnh sửa.') }));
  if (r.status === 'rejected') banners.push(banner({ tone: 'danger', icon: 'x-circle', title: tl(`Rejected by ${plainName(r.rejectedByDisplayName, r.rejectedByName, r.rejectedBy)}`, `Bị từ chối bởi ${plainName(r.rejectedByDisplayName, r.rejectedByName, r.rejectedBy)}`), text: r.rejectionComment || tl('No comment given.', 'Không có nhận xét.') }));
  if (r.status === 'draft' && !mine) banners.push(banner({ tone: 'info', icon: 'user', text: tl(`Draft by ${plainName(r.createdByDisplayName, r.createdByName, r.createdBy)} — only the author can edit it.`, `Bản nháp của ${plainName(r.createdByDisplayName, r.createdByName, r.createdBy)} — chỉ tác giả được chỉnh sửa.`) }));
  if (r.status === 'active' && (pendingOther || otherDraft)) {
    const o = pendingOther || otherDraft;
    banners.push(banner({ tone: 'info', icon: 'git-pull-request', text: pendingOther ? tl(`Version ${o.version_no} is awaiting approval.`, `Phiên bản ${o.version_no} đang chờ phê duyệt.`) : tl(`Version ${o.version_no} is being drafted.`, `Phiên bản ${o.version_no} đang được soạn.`), actions: [button({ label: tl('Open', 'Mở'), size: 'sm', variant: 'link', onClick: () => navigate(`rules/${encodeURIComponent(o.id)}`) })] }));
  }

  // ---- Advanced (JSON) ----
  let advanced = null;
  if (technical || !canRepresent(r.kind, r.payload)) {
    const ta = h('textarea', { class: 'code', spellcheck: 'false', rows: '14', readonly: editable ? null : true, 'aria-label': tl('Rule settings in technical format', 'Thiết lập ở định dạng kỹ thuật') });
    ta.value = JSON.stringify(r.payload, null, 2);
    const err = h('div', { class: 'error', role: 'alert' });
    advanced = h('details', { class: 'disclosure rf-advanced' }, h('summary', {}, icon('chevron-right', { size: 14 }), tl('Advanced (JSON)', 'Nâng cao (JSON)')),
      h('div', { class: 'disclosure-body stack-sm' },
        h('p', { class: 'xs muted' }, editable ? tl('For technical users. Applying replaces the form values.', 'Dành cho cán bộ kỹ thuật. Áp dụng sẽ thay thế giá trị trên biểu mẫu.') : tl('Read-only technical view.', 'Chế độ xem kỹ thuật, chỉ đọc.')),
        ta, err,
        h('div', { class: 'row' },
          editable ? button({ label: tl('Apply to form', 'Áp dụng vào biểu mẫu'), size: 'sm', onClick: () => {
            try { const v = JSON.parse(ta.value); form.setValue(v); current = v; paintChanges(); syncDirty(); err.textContent = ''; toast(tl('Applied to the form', 'Đã áp dụng vào biểu mẫu'), 'ok'); } catch (e) { err.textContent = tl(`Not valid JSON: ${e.message}`, `JSON không hợp lệ: ${e.message}`); }
          } }) : null,
          button({ label: tl('Copy', 'Sao chép'), icon: 'copy', size: 'sm', variant: 'ghost', onClick: () => navigator.clipboard?.writeText(ta.value).then(() => toast(tl('Copied', 'Đã sao chép'), 'ok')) }))));
  }

  // ---- Simulation ----
  const simCard = SIMULATABLE.includes(r.kind) ? simulationCard({ api, can, kind: r.kind, getPayload: () => form.getValue() }) : null;

  // ---- Workflow & history ----
  const wf = workflowCard(r, versions);
  const versionsCard = card({
    title: tl('Version history', 'Lịch sử phiên bản'), flush: true, class: 'rs-versions',
    body: dataTable({
      rows: versions, rowKey: (v) => v.id, pagination: versions.length > 10 ? { pageSize: 10 } : false, caption: tl('Version history', 'Lịch sử phiên bản'),
      onRowClick: (v) => navigate(`rules/${encodeURIComponent(v.id)}`),
      columns: [
        { key: 'version_no', label: tl('Version', 'Phiên bản'), align: 'right', render: (v) => h('span', { class: v.id === r.id ? 'strong' : null }, `v${v.version_no}`) },
        { key: 'status', label: tl('Status', 'Trạng thái'), render: (v) => ruleStatusChip(v.status) },
        { key: 'description', label: tl('Change note', 'Ghi chú thay đổi'), render: (v) => h('span', { class: 'rs-note', title: versionNote(v) }, versionNote(v) || '—') },
        { key: 'by', label: tl('Author', 'Tác giả'), render: (v) => plainName(v.createdByDisplayName, v.createdByName, v.createdBy) },
        { key: 'at', label: tl('Last activity', 'Hoạt động gần nhất'), nowrap: true, render: (v) => { const e = lastEvent(v); return h('time', { datetime: e.at, title: formatDateTime(e.at) }, formatRelative(e.at)); } },
      ],
    }),
  });

  const settingsTitle = h('span', { class: 'row tight' }, tl('Settings', 'Thiết lập'), infoTip(tl('Changes take effect only after a second person approves them.', 'Thay đổi chỉ có hiệu lực sau khi người thứ hai phê duyệt.')));
  mount(main,
    pageHeader({
      breadcrumb: [{ label: tl('Governance', 'Quản trị') }, { label: tl('Business rules', 'Quy tắc nghiệp vụ'), href: '#/rules' }, { label: kindName(r.kind) }],
      back: { href: '#/rules', label: tl('All rule sets', 'Tất cả bộ quy tắc') },
      title: kindName(r.kind), subtitle: kindDesc(r.kind),
      meta: [ruleStatusChip(r.status, r.version_no), restricted ? restrictedChip() : null, r.status === 'active' ? badge(tl(`In force since ${formatDateTime(r.activatedAt)}`, `Áp dụng từ ${formatDateTime(r.activatedAt)}`), 'neutral', { icon: 'calendar' }) : null].filter(Boolean),
      actions,
    }),
    banners.length ? h('div', { class: 'stack-sm rs-banners' }, banners) : null,
    h('div', { class: 'grid-12' },
      h('div', { class: 'span-8 stack-lg' },
        card({ title: settingsTitle, subtitle: editable ? tl(`Editing draft v${r.version_no}`, `Đang sửa bản nháp v${r.version_no}`) : tl(`Version ${r.version_no} · read only`, `Phiên bản ${r.version_no} · chỉ xem`), body: h('div', { class: 'stack' }, summary, form.el, advanced) }),
        versionsCard),
      h('div', { class: 'span-4 stack-lg rs-side' },
        wf,
        card({ title: tl('What changes', 'Thay đổi'), subtitle: base ? tl(`Compared with version ${base.version_no}${baseMeta?.status === 'active' ? ' (active)' : ''}`, `So với phiên bản ${base.version_no}${baseMeta?.status === 'active' ? ' (đang áp dụng)' : ''}`) : null, actions: [changesCount], body: changesBody }),
        simCard)));
  paintChanges();
  return undefined;
}

/** Change list in business language. */
export function changeList(list, { limit = 12 } = {}) {
  const ul = h('ul', { class: 'chg-list' });
  const item = (c) => h('li', { class: `chg ${c.type}` },
    h('span', { class: 'chg-label' }, c.label),
    c.type === 'added' || c.type === 'removed'
      ? h('span', { class: 'chg-values' }, badge(c.to, c.type === 'added' ? 'ok' : 'danger'))
      : h('span', { class: 'chg-values' }, h('span', { class: 'chg-from' }, clip(c.from)), icon('chevron-right', { size: 14, class: 'chg-arrow' }), h('span', { class: 'chg-to' }, clip(c.to))));
  const paint = (all) => mount(ul, (all ? list : list.slice(0, limit)).map(item),
    !all && list.length > limit ? h('li', { class: 'chg-more' }, button({ label: tl(`Show all ${list.length} changes`, `Xem tất cả ${list.length} thay đổi`), variant: 'link', size: 'sm', onClick: () => paint(true) })) : null);
  paint(false);
  return ul;
}
const clip = (s) => { const t = String(s ?? '—'); return t.length > 140 ? h('span', { title: t }, `${t.slice(0, 139)}…`) : t; };

/** Workflow stepper + facts + history for one version. */
export function workflowCard(r, versions = []) {
  const steps = [tl('Draft', 'Bản nháp'), tl('Awaiting approval', 'Chờ phê duyệt'), r.status === 'rejected' ? tl('Rejected', 'Bị từ chối') : tl('Approved', 'Đã duyệt'), tl('Active', 'Đang áp dụng')];
  const current = { draft: 0, pending_approval: 1, rejected: 2, active: 3, retired: 4 }[r.status] ?? 0;
  const name = (dn, n, id) => plainName(dn, n, id);
  const author = name(r.createdByDisplayName, r.createdByName, r.createdBy);
  const events = [];
  if (r.createdAt) events.push({ time: r.createdAt, icon: 'edit', title: r.createdBy === 'system' ? tl('Loaded as initial configuration', 'Nạp làm cấu hình ban đầu') : tl(`Draft created by ${author}`, `${author} tạo bản nháp`), body: r.createdBy === 'system' ? null : describeVersionNote(r.description) || null });
  if (r.updatedAt) events.push({ time: r.updatedAt, icon: 'edit', title: tl(`Last edited by ${author}`, `${author} chỉnh sửa lần cuối`) });
  if (r.withdrawnAt) events.push({ time: r.withdrawnAt, icon: 'arrow-left', title: tl(`Withdrawn by ${author}`, `${author} đã rút lại`) });
  if (r.submittedAt) events.push({ time: r.submittedAt, icon: 'send', tone: 'info', title: tl(`Submitted for approval by ${author}`, `${author} gửi phê duyệt`), body: r.submitComment ? h('q', {}, r.submitComment) : null });
  if (r.activatedAt && r.approvedBy && r.approvedBy !== 'system') events.push({ time: r.activatedAt, icon: 'check-circle', tone: 'ok', title: tl(`Approved and activated by ${name(r.approvedByDisplayName, r.approvedByName, r.approvedBy)}`, `${name(r.approvedByDisplayName, r.approvedByName, r.approvedBy)} phê duyệt và áp dụng`), body: r.approvalComment ? h('q', {}, r.approvalComment) : null });
  if (r.rejectedBy) events.push({ time: r.rejectedAt || r.submittedAt, icon: 'x-circle', tone: 'danger', title: tl(`Rejected by ${name(r.rejectedByDisplayName, r.rejectedByName, r.rejectedBy)}`, `${name(r.rejectedByDisplayName, r.rejectedByName, r.rejectedBy)} từ chối`), body: r.rejectionComment ? h('q', {}, r.rejectionComment) : null });
  if (r.retiredAt) {
    const by = versions.find((v) => v.id === r.supersededBy);
    events.push({ time: r.retiredAt, icon: 'history', title: by ? tl(`Replaced by version ${by.version_no}`, `Được thay bằng phiên bản ${by.version_no}`) : tl('Replaced by a newer version', 'Được thay bằng phiên bản mới') });
  }
  events.sort((a, b) => String(b.time).localeCompare(String(a.time)));
  return card({
    title: tl('Workflow', 'Quy trình'),
    body: h('div', { class: 'stack' },
      stepper(steps, { current, error: r.status === 'rejected' ? 2 : null, label: tl('Approval workflow', 'Quy trình phê duyệt') }),
      keyValueList([
        [tl('Version', 'Phiên bản'), `v${r.version_no} · ${ruleStatus(r.status)}`],
        [tl('Author', 'Tác giả'), r.createdBy === 'system' ? tl('Initial configuration', 'Cấu hình ban đầu') : author],
      ], { columns: 1, inline: true }),
      h('div', { class: 'wf-history' }, h('h3', { class: 'wf-h' }, tl('History', 'Lịch sử')), timeline(events, { empty: tl('No activity yet', 'Chưa có hoạt động') }))),
  });
}

/* =========================================================================
 * Simulation
 * ========================================================================= */

/** Customer picker + before/after comparison card. Also used by approvals (single customer). */
export function simulationCard({ api, can, kind, getPayload }) {
  const out = h('div', { class: 'sim-out', 'aria-live': 'polite' });
  const picked = { id: null, plate: null };
  const pickedEl = h('div', { class: 'sim-picked' });
  const list = h('ul', { class: 'sim-results', role: 'listbox', hidden: true, 'aria-label': tl('Matching customers', 'Khách hàng phù hợp') });
  const inp = h('input', { type: 'search', placeholder: tl('Plate number, e.g. 30E949', 'Biển số, vd. 30E949'), 'aria-label': tl('Find a customer', 'Tìm khách hàng'), autocomplete: 'off' });
  const runBtn = button({ label: tl('Run simulation', 'Chạy mô phỏng'), icon: 'play', variant: 'primary', block: true, onClick: () => run() });
  runBtn.disabled = true;
  const sampleBtn = button({ label: tl('Test on 60 customers', 'Thử trên 60 khách hàng'), icon: 'users', variant: 'ghost', size: 'sm', onClick: () => runSample() });
  const suggestions = h('div', { class: 'chip-row sim-suggest' }, skeleton({ width: 220, height: 28 }));
  const choose = (c) => {
    picked.id = c.id; picked.plate = c.plate;
    list.hidden = true; inp.value = '';
    mount(pickedEl, h('span', { class: 'plate-tag' }, formatPlate(c.plate || c.id)), c.tier ? badge(label('tier', c.tier), c.tier) : null, c.region ? h('span', { class: 'small muted' }, c.region) : null,
      iconButton({ icon: 'x', label: tl('Clear', 'Bỏ chọn'), size: 'sm', onClick: () => { picked.id = null; mount(pickedEl); runBtn.disabled = true; mount(out); } }));
    runBtn.disabled = false;
  };
  let timer = null;
  inp.addEventListener('input', () => {
    clearTimeout(timer);
    const q = inp.value.trim();
    if (q.replace(/[^0-9A-Za-z]/g, '').length < 3) { list.hidden = true; return; }
    timer = setTimeout(async () => {
      try {
        const r = can('profile:read') ? await api.get(`/api/search/customers?q=${encodeURIComponent(q)}&limit=6`) : await api.get(`/api/rules/sample-customers?q=${encodeURIComponent(q)}&limit=6`);
        const items = r.items || [];
        mount(list, items.length ? items.map((c) => h('li', { role: 'option', tabindex: '0', class: 'sim-opt', onclick: () => choose(c), onkeydown: (e) => { if (e.key === 'Enter') choose(c); } },
          icon('car', { size: 14 }), h('span', { class: 'strong' }, formatPlate(c.plate || c.id)), h('span', { class: 'small muted' }, [c.region, c.tier ? label('tier', c.tier) : null].filter(Boolean).join(' · ')))) : h('li', { class: 'sim-none' }, tl('No customer found', 'Không tìm thấy khách hàng')));
        list.hidden = false;
      } catch (e) { errorToast(e); }
    }, 250);
  });
  api.get('/api/rules/sample-customers?limit=3').then((r) => mount(suggestions, h('span', { class: 'xs muted' }, tl('Try:', 'Thử:')), (r.items || []).map((c) => chip({ label: `${formatPlate(c.plate)} · ${label('tier', c.tier)}`, onClick: () => choose(c) })))).catch(() => mount(suggestions));

  async function run() {
    if (!picked.id) return;
    mount(out, skeleton({ lines: 4, height: 14 }));
    try {
      const s = await api.post('/api/rules/simulate', { profileId: picked.id, kind, payload: getPayload() });
      mount(out, comparison(s.current, s.candidate, picked.plate));
    } catch (e) {
      mount(out, banner({ tone: 'danger', text: Array.isArray(e.details) ? tl('Fix the highlighted settings before simulating.', 'Hãy sửa các thiết lập được đánh dấu trước khi mô phỏng.') : e.message }));
    }
  }
  async function runSample() {
    mount(out, skeleton({ lines: 5, height: 14 }));
    try {
      const s = await api.post('/api/rules/simulate-sample', { kind, payload: getPayload(), size: 60 });
      mount(out, sampleSummary(s));
    } catch (e) {
      mount(out, banner({ tone: 'danger', text: Array.isArray(e.details) ? tl('Fix the highlighted settings before simulating.', 'Hãy sửa các thiết lập được đánh dấu trước khi mô phỏng.') : e.message }));
    }
  }
  return card({
    title: tl('Simulation', 'Mô phỏng'), subtitle: tl('See the effect before you submit', 'Xem tác động trước khi gửi'),
    actions: [sampleBtn],
    body: h('div', { class: 'stack sim' },
      h('div', { class: 'sim-search' }, h('div', { class: 'input-group' }, icon('search', { size: 16 }), inp), list),
      suggestions, pickedEl, runBtn, out),
  });
}

const nbaText = (n) => (n ? label('nba', n.action || n) : '—');
/** Before/after comparison with a verdict. */
export function comparison(cur, cand, plate) {
  const rows = [
    [tl('Score', 'Điểm'), formatNumber(cur.score), formatNumber(cand.score), cur.score !== cand.score, cand.score - cur.score],
    [tl('Tier', 'Nhóm'), badge(label('tier', cur.tier), cur.tier), badge(label('tier', cand.tier), cand.tier), cur.tier !== cand.tier],
    [tl('Next best action', 'Hành động đề xuất'), nbaText(cur.nextBestAction), nbaText(cand.nextBestAction), cur.nextBestAction?.action !== cand.nextBestAction?.action],
    [tl('Journey', 'Hành trình'), label('journey', cur.journey), label('journey', cand.journey), cur.journey !== cand.journey],
  ];
  const changed = rows.filter((x) => x[3]);
  const p = formatPlate(plate);
  let verdict;
  if (!changed.length) verdict = banner({ tone: 'info', icon: 'check-circle', text: tl(`No effect on ${p}.`, `Không ảnh hưởng đến ${p}.`) });
  else {
    const bits = [];
    if (cur.tier !== cand.tier) bits.push(tl(`moves from ${label('tier', cur.tier)} to ${label('tier', cand.tier)}`, `chuyển từ ${label('tier', cur.tier)} sang ${label('tier', cand.tier)}`));
    else if (cur.score !== cand.score) bits.push(tl(`score ${cand.score > cur.score ? 'rises' : 'falls'} by ${Math.abs(cand.score - cur.score)}`, `điểm ${cand.score > cur.score ? 'tăng' : 'giảm'} ${Math.abs(cand.score - cur.score)}`));
    if (cur.nextBestAction?.action !== cand.nextBestAction?.action) bits.push(tl(`next action becomes “${nbaText(cand.nextBestAction)}”`, `hành động mới: “${nbaText(cand.nextBestAction)}”`));
    if (cur.journey !== cand.journey) bits.push(tl(`journey becomes ${label('journey', cand.journey)}`, `hành trình mới: ${label('journey', cand.journey)}`));
    verdict = banner({ tone: 'warn', icon: 'sparkles', title: tl(`This change affects ${p}`, `Thay đổi ảnh hưởng đến ${p}`), text: `${bits.join(tl('; ', '; '))}.` });
  }
  return h('div', { class: 'stack-sm' }, verdict,
    h('div', { class: 'table-wrap sim-table' }, h('table', {},
      h('caption', { class: 'sr-only' }, tl('Before and after', 'Trước và sau')),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, ''), h('th', { scope: 'col' }, tl('Today', 'Hiện tại')), h('th', { scope: 'col' }, tl('With change', 'Sau thay đổi')))),
      h('tbody', {}, rows.map(([l, a, b, diff, delta]) => h('tr', { class: diff ? 'sim-diff' : null }, h('th', { scope: 'row' }, l), h('td', {}, a),
        h('td', {}, b, delta ? h('span', { class: `sim-delta ${delta > 0 ? 'up' : 'down'}` }, `${delta > 0 ? '+' : ''}${delta}`) : null)))))));
}

/** Aggregate effect over a sample of customers. */
export function sampleSummary(s) {
  const tiers = ['hot', 'warm', 'nurture'];
  const moves = (arr, fmt) => (arr.length ? h('ul', { class: 'sim-moves' }, arr.slice(0, 6).map((m) => h('li', {}, h('span', {}, fmt(m.from)), icon('chevron-right', { size: 12 }), h('span', {}, fmt(m.to)), h('span', { class: 'sim-count' }, formatNumber(m.count))))) : h('p', { class: 'small muted' }, tl('No change', 'Không thay đổi')));
  return h('div', { class: 'stack-sm sim-sample' },
    s.changedCustomers && !s.tierMoves.length && !s.actionChanges.length && !s.journeyChanges?.length
      ? banner({ tone: 'info', icon: 'users', title: tl(`Scores change for ${s.changedCustomers} of ${s.sampleSize} customers`, `Điểm thay đổi với ${s.changedCustomers}/${s.sampleSize} khách hàng`), text: tl(`No tier, action or journey changes. Average score ${formatNumber(s.averageScore.before, { decimals: 1 })} → ${formatNumber(s.averageScore.after, { decimals: 1 })}`, `Không đổi nhóm, hành động hay hành trình. Điểm trung bình ${formatNumber(s.averageScore.before, { decimals: 1 })} → ${formatNumber(s.averageScore.after, { decimals: 1 })}`) })
      : s.changedCustomers
      ? banner({ tone: 'warn', icon: 'users', title: tl(`${s.changedCustomers} of ${s.sampleSize} customers affected`, `${s.changedCustomers}/${s.sampleSize} khách hàng bị ảnh hưởng`), text: tl(`Average score ${formatNumber(s.averageScore.before, { decimals: 1 })} → ${formatNumber(s.averageScore.after, { decimals: 1 })}`, `Điểm trung bình ${formatNumber(s.averageScore.before, { decimals: 1 })} → ${formatNumber(s.averageScore.after, { decimals: 1 })}`) })
      : banner({ tone: 'info', icon: 'check-circle', text: tl(`No effect on the ${s.sampleSize} sample customers.`, `Không ảnh hưởng đến ${s.sampleSize} khách hàng mẫu.`) }),
    h('div', { class: 'table-wrap sim-table' }, h('table', {},
      h('caption', { class: 'sr-only' }, tl('Customers per tier', 'Khách hàng theo nhóm')),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, tl('Tier', 'Nhóm')), h('th', { scope: 'col', class: 'num' }, tl('Today', 'Hiện tại')), h('th', { scope: 'col', class: 'num' }, tl('With change', 'Sau thay đổi')))),
      h('tbody', {}, tiers.map((tr) => h('tr', { class: s.tiers.before[tr] !== s.tiers.after[tr] ? 'sim-diff' : null }, h('th', { scope: 'row' }, badge(label('tier', tr), tr)), h('td', { class: 'num' }, formatNumber(s.tiers.before[tr] || 0)), h('td', { class: 'num' }, formatNumber(s.tiers.after[tr] || 0))))))),
    h('div', { class: 'sim-moves-wrap' },
      h('h4', {}, tl('Tier movements', 'Chuyển nhóm')), moves(s.tierMoves, (x) => label('tier', x)),
      h('h4', {}, tl('Next best action changes', 'Thay đổi hành động đề xuất')), moves(s.actionChanges, (x) => label('nba', x))),
    s.journeyChanges?.length ? h('div', { class: 'sim-moves-wrap' }, h('h4', {}, tl('Journey changes', 'Thay đổi hành trình')), moves(s.journeyChanges, (x) => label('journey', x))) : null);
}
