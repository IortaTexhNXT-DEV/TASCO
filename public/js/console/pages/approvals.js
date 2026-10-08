import { h, mount } from '../../shared/dom.js';
import {
  pageHeader, card, kpiStrip, kpiTile, dataTable, badge, button, avatar, banner, emptyState, drawer, modal, formField, textarea,
  keyValueList, tabs, skeleton, toast, errorToast, formatRelative, formatDateTime, formatNumber, icon,
} from '../ui.js';
import { tl, kindName, kindArea, AREAS, plainName, describeVersionNote } from '../gov-text.js';
import { describeChanges } from '../rule-forms.js';
import { changeList, sampleSummary, simulationCard, restrictedChip, ruleStatusChip } from './rules.js';

/**
 * Approvals inbox (maker-checker): pending rule changes with business-language "What changes",
 * evidence from a simulation over sample customers, separation-of-duties guidance and
 * Approve / Reject (reason required) decisions. History lists past decisions.
 */

const SIMULATABLE = ['scoring', 'nba', 'journeys', 'benefits'];
const areaName = (kind) => tl(AREAS.find((a) => a.id === kindArea(kind))?.name || ['', '']);
const who = (name) => h('span', { class: 'who' }, avatar(name, { size: 'sm' }), h('span', { class: 'who-name' }, name));

export default {
  perm: 'rules:approve',
  async render(main, ctx) {
    const { api, user, route, navigate } = ctx;
    const [all, context] = await Promise.all([api.get('/api/rules'), api.get('/api/rules/context').catch(() => ({ restrictedKinds: {} }))]);
    const pending = all.filter((r) => r.status === 'pending_approval').sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
    const decided = all.filter((r) => (r.approvedBy && r.approvedBy !== 'system') || r.rejectedBy)
      .map((r) => ({ ...r, decision: r.rejectedBy ? 'rejected' : 'approved', decidedAt: r.rejectedBy ? r.rejectedAt || r.submittedAt : r.activatedAt }))
      .sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)));
    const restrictedFor = (kind) => context.restrictedKinds?.[kind] || null;
    const canDecide = (r) => r.createdBy !== user.id && (!restrictedFor(r.kind) || restrictedFor(r.kind).some((role) => user.roles.includes(role)));
    const forMe = pending.filter(canDecide);
    const since = Date.now() - 30 * 86400000;
    const recent = decided.filter((d) => d.decidedAt && new Date(d.decidedAt).getTime() >= since);
    const oldest = pending[0];

    const inbox = () => dataTable({
      rows: pending, rowKey: (r) => r.id, onRowClick: (r) => openReview(r), pagination: { pageSize: 10 }, caption: tl('Changes awaiting approval', 'Thay đổi chờ phê duyệt'),
      toolbar: { search: { placeholder: tl('Search changes', 'Tìm thay đổi') } },
      empty: { icon: 'check-circle', title: tl('Nothing waiting for approval', 'Không có thay đổi chờ phê duyệt'), text: tl('New submissions appear here.', 'Các đề xuất mới sẽ hiển thị tại đây.') },
      columns: [
        { key: 'kind', label: tl('Change', 'Thay đổi'), primary: true, sortable: true, value: (r) => kindName(r.kind),
          render: (r) => h('div', {}, h('span', { class: 'strong' }, `${kindName(r.kind)} v${r.version_no}`), h('span', { class: 'cell-sub' }, areaName(r.kind))) },
        { key: 'by', label: tl('Requested by', 'Người đề xuất'), sortable: true, value: (r) => plainName(r.createdByDisplayName, r.createdByName, r.createdBy), render: (r) => who(plainName(r.createdByDisplayName, r.createdByName, r.createdBy)) },
        { key: 'submittedAt', label: tl('Submitted', 'Ngày gửi'), sortable: true, nowrap: true, render: (r) => h('time', { datetime: r.submittedAt, title: formatDateTime(r.submittedAt) }, formatRelative(r.submittedAt)), exportValue: (r) => formatDateTime(r.submittedAt) },
        { key: 'comment', label: tl('Author’s note', 'Ghi chú của tác giả'), render: (r) => h('span', { class: 'ap-comment', title: r.submitComment || describeVersionNote(r.description) || '' }, r.submitComment || describeVersionNote(r.description) || '—') },
        { key: 'approver', label: tl('Approver', 'Người duyệt'), render: (r) => (restrictedFor(r.kind) ? badge(tl('Compliance', 'Tuân thủ'), 'warn', { icon: 'lock', title: tl('Restricted: compliance approval', 'Hạn chế: Tuân thủ phê duyệt') }) : badge(tl('Rule approver', 'Người phê duyệt'), 'neutral')) },
        { key: '_go', label: '', align: 'right', render: (r) => (r.createdBy === user.id
          ? button({ label: tl('View', 'Xem'), size: 'sm', variant: 'ghost', onClick: () => openReview(r) })
          : button({ label: tl('Review', 'Xem xét'), size: 'sm', variant: canDecide(r) ? 'primary' : 'secondary', icon: 'clipboard-check', onClick: () => openReview(r) })) },
      ],
    });
    const history = () => dataTable({
      rows: decided, rowKey: (r) => r.id, onRowClick: (r) => navigate(`rules/${encodeURIComponent(r.id)}`), pagination: { pageSize: 10 }, caption: tl('Decisions', 'Quyết định'),
      toolbar: { search: { placeholder: tl('Search decisions', 'Tìm quyết định') }, export: { filename: 'approval-decisions.csv' } },
      empty: { icon: 'history', title: tl('No decisions yet', 'Chưa có quyết định') },
      columns: [
        { key: 'kind', label: tl('Change', 'Thay đổi'), primary: true, sortable: true, value: (r) => kindName(r.kind), render: (r) => h('span', { class: 'strong' }, `${kindName(r.kind)} v${r.version_no}`), exportValue: (r) => `${kindName(r.kind)} v${r.version_no}` },
        { key: 'decision', label: tl('Decision', 'Quyết định'), render: (r) => (r.decision === 'approved' ? badge(tl('Approved', 'Đã duyệt'), 'ok', { dot: true }) : badge(tl('Rejected', 'Từ chối'), 'danger', { dot: true })), exportValue: (r) => (r.decision === 'approved' ? tl('Approved', 'Đã duyệt') : tl('Rejected', 'Từ chối')) },
        { key: 'by', label: tl('Decided by', 'Người quyết định'), render: (r) => who(r.decision === 'approved' ? plainName(r.approvedByDisplayName, r.approvedByName, r.approvedBy) : plainName(r.rejectedByDisplayName, r.rejectedByName, r.rejectedBy)), exportValue: (r) => (r.decision === 'approved' ? plainName(r.approvedByDisplayName, r.approvedByName, r.approvedBy) : plainName(r.rejectedByDisplayName, r.rejectedByName, r.rejectedBy)) },
        { key: 'author', label: tl('Requested by', 'Người đề xuất'), render: (r) => plainName(r.createdByDisplayName, r.createdByName, r.createdBy) },
        { key: 'decidedAt', label: tl('When', 'Thời điểm'), sortable: true, nowrap: true, render: (r) => h('time', { datetime: r.decidedAt, title: formatDateTime(r.decidedAt) }, formatDateTime(r.decidedAt)), exportValue: (r) => formatDateTime(r.decidedAt) },
        { key: 'comment', label: tl('Comment', 'Nhận xét'), render: (r) => h('span', { class: 'ap-comment', title: (r.decision === 'approved' ? r.approvalComment : r.rejectionComment) || '' }, (r.decision === 'approved' ? r.approvalComment : r.rejectionComment) || '—') },
        { key: 'now', label: tl('Now', 'Hiện tại'), render: (r) => ruleStatusChip(r.status) },
      ],
    });

    const tabsEl = tabs({
      label: tl('Approvals', 'Phê duyệt'), active: route.query.tab === 'history' ? 'history' : 'inbox',
      items: [
        { id: 'inbox', label: tl('Inbox', 'Hộp chờ duyệt'), count: pending.length, icon: 'inbox', render: (p) => p.append(h('div', { class: 'ap-inbox' }, inbox())) },
        { id: 'history', label: tl('Decisions', 'Lịch sử quyết định'), count: decided.length, icon: 'history', render: (p) => p.append(h('div', { class: 'ap-history' }, history())) },
      ],
    });

    mount(main,
      pageHeader({
        title: tl('Approvals', 'Phê duyệt'),
        subtitle: tl('Rule changes waiting for a second pair of eyes', 'Thay đổi quy tắc chờ người thứ hai phê duyệt'),
        actions: [button({ label: tl('Business rules', 'Quy tắc nghiệp vụ'), icon: 'scale', onClick: () => navigate('rules') })],
      }),
      kpiStrip([
        kpiTile({ label: tl('Waiting for you', 'Chờ bạn duyệt'), value: formatNumber(forMe.length), icon: 'clipboard-check', hint: tl(`${pending.length} in the queue`, `${pending.length} trong hàng chờ`) }),
        kpiTile({ label: tl('Oldest request', 'Đề xuất lâu nhất'), value: oldest ? formatRelative(oldest.submittedAt) : '—', icon: 'clock', hint: oldest ? `${kindName(oldest.kind)} v${oldest.version_no}` : tl('Queue is empty', 'Hàng chờ trống') }),
        kpiTile({ label: tl('Need compliance approval', 'Cần Tuân thủ phê duyệt'), value: formatNumber(pending.filter((r) => restrictedFor(r.kind)).length), icon: 'lock' }),
        kpiTile({ label: tl('Decided in 30 days', 'Đã quyết định trong 30 ngày'), value: formatNumber(recent.length), icon: 'history', hint: tl(`${recent.filter((d) => d.decision === 'rejected').length} rejected`, `${recent.filter((d) => d.decision === 'rejected').length} bị từ chối`) }),
      ]),
      card({ flush: true, body: tabsEl, class: 'ap-card' }));

    async function openReview(r) {
      const author = plainName(r.createdByDisplayName, r.createdByName, r.createdBy);
      const own = r.createdBy === user.id;
      const restricted = restrictedFor(r.kind);
      const allowed = canDecide(r);
      const body = h('div', { class: 'stack-lg ap-review' }, skeleton({ lines: 6, height: 14 }));
      const approveBtn = button({ label: tl('Approve', 'Phê duyệt'), icon: 'check', variant: 'primary', disabled: !allowed, onClick: () => decide('approve') });
      const rejectBtn = button({ label: tl('Reject…', 'Từ chối…'), icon: 'x', variant: 'danger', disabled: !allowed, onClick: () => decide('reject') });
      const d = drawer({
        title: `${kindName(r.kind)} v${r.version_no}`, subtitle: tl(`Requested by ${author} · ${formatRelative(r.submittedAt)}`, `${author} đề xuất · ${formatRelative(r.submittedAt)}`), size: 'lg', body,
        footer: [button({ label: tl('Open in rules studio', 'Mở trong quy tắc nghiệp vụ'), icon: 'external-link', variant: 'ghost', onClick: () => { d.close(); navigate(`rules/${encodeURIComponent(r.id)}`); } }), h('span', { class: 'grow' }), rejectBtn, approveBtn],
      });
      try {
        const [full, activeMeta] = await Promise.all([api.get(`/api/rules/${encodeURIComponent(r.id)}`), api.get(`/api/rules?kind=${encodeURIComponent(r.kind)}&status=active`).then((l) => l[0] || null)]);
        const active = activeMeta ? await api.get(`/api/rules/${encodeURIComponent(activeMeta.id)}`) : null;
        const changes = active ? describeChanges(r.kind, active.payload, full.payload) : [];
        const guard = [];
        if (own) guard.push(banner({ tone: 'warn', icon: 'user-check', title: tl('You cannot approve your own change', 'Bạn không thể tự phê duyệt thay đổi của mình'), text: tl('Another approver must review it (separation of duties).', 'Cần một người phê duyệt khác xem xét (phân tách nhiệm vụ).') }));
        else if (restricted && !allowed) guard.push(banner({ tone: 'warn', icon: 'lock', title: tl('Compliance approval required', 'Cần Tuân thủ phê duyệt'), text: tl('Only a compliance officer can approve changes to this rule set.', 'Chỉ cán bộ tuân thủ được phê duyệt bộ quy tắc này.') }));
        else guard.push(banner({ tone: 'info', icon: 'shield-check', text: tl('Approving activates this version immediately and replaces the active one.', 'Phê duyệt sẽ áp dụng ngay phiên bản này thay cho phiên bản hiện hành.') }));
        const evidence = h('div', {});
        mount(body,
          h('div', { class: 'stack-sm' }, guard),
          keyValueList([
            [tl('Requested by', 'Người đề xuất'), who(author)],
            [tl('Submitted', 'Ngày gửi'), formatDateTime(r.submittedAt)],
            [tl('Replaces', 'Thay thế'), active ? tl(`Version ${active.version_no} (active)`, `Phiên bản ${active.version_no} (đang áp dụng)`) : tl('Nothing — first version', 'Chưa có — phiên bản đầu')],
            [tl('Approver', 'Người duyệt'), restricted ? restrictedChip() : tl('Any rule approver', 'Bất kỳ người phê duyệt')],
          ], { columns: 2 }),
          full.submitComment || full.description ? h('div', { class: 'ap-note' }, icon('message-square', { size: 16 }), h('div', {},
            h('div', { class: 'ap-note-head' }, tl('Author’s note', 'Ghi chú của tác giả')),
            full.submitComment ? h('p', {}, full.submitComment) : null,
            full.description && full.description !== full.submitComment ? h('p', { class: 'muted small' }, describeVersionNote(full.description)) : null)) : null,
          h('section', {}, h('h3', { class: 'ap-h' }, tl('What changes', 'Thay đổi'), changes.length ? badge(formatNumber(changes.length), 'info') : null),
            changes.length ? changeList(changes, { limit: 20 }) : emptyState({ icon: 'check-circle', title: tl('No differences from the active version', 'Không khác phiên bản đang áp dụng'), compact: true })),
          SIMULATABLE.includes(r.kind) ? h('section', {}, h('h3', { class: 'ap-h' }, tl('Effect on customers', 'Tác động đến khách hàng')), evidence) : null,
          SIMULATABLE.includes(r.kind) ? h('details', { class: 'disclosure' }, h('summary', {}, icon('chevron-right', { size: 14 }), tl('Check a specific customer', 'Kiểm tra một khách hàng cụ thể')),
            h('div', { class: 'disclosure-body' }, simulationCard({ api, can: ctx.can, kind: r.kind, getPayload: () => full.payload }))) : null);
        if (SIMULATABLE.includes(r.kind)) {
          mount(evidence, skeleton({ lines: 5, height: 14 }));
          api.post('/api/rules/simulate-sample', { kind: r.kind, payload: full.payload, size: 60 })
            .then((s) => mount(evidence, h('p', { class: 'xs muted' }, tl(`Simulated on ${s.sampleSize} customers across all tiers.`, `Mô phỏng trên ${s.sampleSize} khách hàng thuộc mọi nhóm.`)), sampleSummary(s)))
            .catch(() => mount(evidence, banner({ tone: 'warn', text: tl('Simulation is not available right now.', 'Hiện chưa thể mô phỏng.') })));
        }
      } catch (e) { errorToast(e); mount(body, emptyState({ icon: 'alert-triangle', title: e.message })); }

      function decide(action) {
        const ta = textarea({ rows: '4', maxlength: '500', placeholder: action === 'reject' ? tl('What needs to change before this can be approved?', 'Cần điều chỉnh gì để được phê duyệt?') : tl('Optional note for the audit trail', 'Ghi chú (không bắt buộc) cho nhật ký') });
        const field = formField({ label: action === 'reject' ? tl('Reason for rejection', 'Lý do từ chối') : tl('Approval note', 'Ghi chú phê duyệt'), control: ta, required: action === 'reject', optional: action !== 'reject' });
        const confirmBtn = button({ label: action === 'reject' ? tl('Reject change', 'Từ chối thay đổi') : tl('Approve and activate', 'Phê duyệt và áp dụng'), variant: action === 'reject' ? 'danger solid' : 'primary', icon: action === 'reject' ? 'x' : 'check', onClick: async () => {
          const comment = ta.value.trim();
          if (action === 'reject' && comment.length < 5) { field.setError(tl('Please give the author a reason', 'Vui lòng nêu lý do cho tác giả')); ta.focus(); return; }
          try {
            await api.post(`/api/rules/${encodeURIComponent(r.id)}/${action}`, { comment: comment || undefined });
            m.close();
            d.close();
            toast(action === 'reject' ? tl('Change rejected — the author has been informed', 'Đã từ chối — tác giả sẽ nhận được phản hồi') : tl('Approved — the new version is now active', 'Đã phê duyệt — phiên bản mới đã được áp dụng'), 'ok', { title: `${kindName(r.kind)} v${r.version_no}` });
            ctx.refreshSignals?.();
            navigate(`approvals?t=${Date.now()}`);
          } catch (e) { errorToast(e); }
        } });
        const m = modal({
          title: action === 'reject' ? tl('Reject this change?', 'Từ chối thay đổi này?') : tl('Approve this change?', 'Phê duyệt thay đổi này?'), size: 'sm',
          body: h('div', { class: 'stack' }, h('p', {}, action === 'reject'
            ? tl(`${kindName(r.kind)} v${r.version_no} goes back to ${author} with your reason.`, `${kindName(r.kind)} v${r.version_no} sẽ được trả lại cho ${author} kèm lý do.`)
            : tl(`${kindName(r.kind)} v${r.version_no} becomes active immediately for all customers.`, `${kindName(r.kind)} v${r.version_no} sẽ được áp dụng ngay cho mọi khách hàng.`)), field),
          actions: [button({ label: tl('Cancel', 'Hủy'), onClick: () => m.close() }), confirmBtn],
        });
        ta.focus();
      }
    }

    if (route.query.id) {
      const target = pending.find((r) => r.id === route.query.id);
      if (target) setTimeout(() => openReview(target), 50);
    }
  },
};
