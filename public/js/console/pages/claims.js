/**
 * Claims (first notice of loss) — work queue with one primary verb per row, decision dialogs and a detail drawer.
 * Workflow (src/application/claimsService.js TRANSITIONS):
 *   submitted → acknowledged | rejected · acknowledged → assessor_assigned | rejected · assessor_assigned → under_assessment
 *   under_assessment → approved | rejected · approved → paid
 */
import { h, mount } from '../../shared/dom.js';
import { label } from '../../shared/i18n.js';
import {
  pageHeader, kpiStrip, kpiTile, card, dataTable, chip, statusChip, slaChip, rowActions, vehicleCell, drawer, tabs, workflowSteps,
  keyValueList, timeline, emptyState, button, decisionDialog, textarea, input, selectInput, toast, errorToast,
  formatDate, formatMoney, formatNumber, formatRelative, formatPlate, icon, technicalDetails, badge,
} from '../ui.js';
import { productShort, pageStrings } from './workflowLabels.js';

const t = pageStrings('claims', {
  vi: {
    clSubtitle: 'Hồ sơ báo tai nạn từ ứng dụng VETC', clOpen: 'Đang xử lý', clDueSoon: 'Sắp đến hạn SLA', clBreached: 'Quá hạn SLA', clPaidMonth: 'Đã chi trả trong tháng',
    clPaidHint: (a) => `Tổng ${a}`, clOpenHint: (n) => `${n} chờ tiếp nhận`, clQueue: 'Danh sách hồ sơ', clRef: 'Hồ sơ', clVehicle: 'Xe', clPolicy: 'Hợp đồng', clIncident: 'Ngày xảy ra',
    clSummary: 'Tóm tắt', clStatus: 'Trạng thái', clNext: 'Bước tiếp theo', clReported: (r) => `Báo ${r}`, clSearch: 'Tìm hồ sơ, biển số, diễn biến…',
    fAll: 'Tất cả', fNeedsAction: 'Cần tiếp nhận', fAssessment: 'Đang giám định', fPayment: 'Chờ chi trả', fClosed: 'Đã đóng', fDueSoon: 'Sắp đến hạn', fBreached: 'Quá hạn',
    aAcknowledge: 'Tiếp nhận', aAssign: 'Giao giám định', aStart: 'Bắt đầu giám định', aApprove: 'Duyệt bồi thường', aReject: 'Từ chối hồ sơ', aPay: 'Ghi nhận chi trả',
    aNote: 'Thêm ghi chú', aDetails: 'Xem chi tiết', aHistory: 'Xem lịch sử',
    dAckTitle: 'Tiếp nhận hồ sơ', dAckIntro: 'Khách hàng sẽ nhận thông báo hồ sơ đã được tiếp nhận.', dAssignTitle: 'Giao giám định viên', dStartTitle: 'Bắt đầu giám định',
    dApproveTitle: 'Duyệt bồi thường', dRejectTitle: 'Từ chối hồ sơ', dPayTitle: 'Ghi nhận đã chi trả', dNoteTitle: 'Thêm ghi chú nội bộ',
    fAssessor: 'Giám định viên', fAssessorHelp: 'Họ tên giám định viên phụ trách hiện trường', fAmount: 'Số tiền duyệt (₫)', fAmountHelp: 'Số nguyên, không gồm khấu trừ',
    fReason: 'Lý do từ chối', fDetails: 'Giải thích cho khách hàng', fPayRef: 'Mã giao dịch chi trả', fPayRefHelp: 'Mã chuyển khoản hoặc mã giao dịch ví VETC', fNote: 'Ghi chú', fNoteHelp: 'Chỉ nhân viên nhìn thấy',
    vAmount: 'Nhập số tiền lớn hơn 0', vAmountMax: (m) => `Không vượt quá ${m}`, vShort: 'Vui lòng ghi rõ hơn (ít nhất 10 ký tự)', vRef: 'Chỉ dùng chữ, số và dấu gạch (4–40 ký tự)',
    rCover: 'Ngoài phạm vi bảo hiểm', rPeriod: 'Ngoài thời hạn hợp đồng', rDocs: 'Thiếu hồ sơ, chứng từ', rFraud: 'Nghi ngờ gian lận', rDup: 'Trùng hồ sơ đã có', rOther: 'Lý do khác',
    tAck: 'Đã tiếp nhận hồ sơ', tAssigned: 'Đã giao giám định viên', tStarted: 'Đã bắt đầu giám định', tApproved: 'Đã duyệt bồi thường', tRejected: 'Đã từ chối hồ sơ', tPaid: 'Đã ghi nhận chi trả', tNote: 'Đã thêm ghi chú',
    sSubmitted: 'Khách báo tai nạn', sAck: 'Tiếp nhận', sAssigned: 'Giao giám định', sAssess: 'Giám định', sDecision: 'Quyết định', sApproved: 'Duyệt bồi thường', sRejected: 'Từ chối', sPaid: 'Chi trả', sClosed: 'Đóng hồ sơ',
    byCustomer: 'Khách hàng · ứng dụng VETC', tabOverview: 'Tổng quan', tabPolicy: 'Hợp đồng & khách hàng', tabNotes: 'Ghi chú', tabHistory: 'Lịch sử',
    secProgress: 'Tiến trình', secWhat: 'Diễn biến sự việc', secPhotos: 'Hình ảnh', secPolicy: 'Hợp đồng', secCustomer: 'Khách hàng & xe', photosCount: (n) => `${n} ảnh khách gửi từ ứng dụng`, noPhotos: 'Khách chưa gửi ảnh',
    kIncident: 'Ngày xảy ra', kLocation: 'Địa điểm', kReported: 'Thời điểm báo', kSla: 'SLA hiện tại', kProduct: 'Sản phẩm', kCert: 'Số giấy chứng nhận', kPolicyNo: 'Số hợp đồng', kPeriod: 'Thời hạn', kPremium: 'Phí bảo hiểm',
    kChannel: 'Kênh bán', kPlate: 'Biển số', kOwner: 'Chủ xe', kRegion: 'Tỉnh/thành', kVehicle: 'Loại xe', kOwnerType: 'Loại chủ xe', kAssessor: 'Giám định viên', kApproved: 'Số tiền duyệt', kReason: 'Lý do từ chối', kPayRef: 'Mã chi trả',
    noNotes: 'Chưa có ghi chú', noNotesHint: 'Ghi chú nội bộ giúp đồng nghiệp nắm tình hình hồ sơ.', addNote: 'Thêm ghi chú', notePlaceholder: 'Ví dụ: đã gọi khách, hẹn giám định 9h sáng mai',
    slaStage: { acknowledgement: 'Tiếp nhận', decision: 'Ra quyết định', payment: 'Chi trả' }, emptyQueue: 'Không có hồ sơ', emptyQueueHint: 'Hồ sơ mới từ ứng dụng VETC sẽ hiển thị tại đây.',
    claimTitle: (r) => `Hồ sơ ${r}`, confirmAck: 'Tiếp nhận hồ sơ', confirmAssign: 'Giao giám định', confirmStart: 'Bắt đầu giám định', confirmApprove: 'Xác nhận duyệt', confirmReject: 'Xác nhận từ chối', confirmPay: 'Xác nhận đã chi trả', saveNote: 'Lưu ghi chú',
    sumApprove: 'Kiểm tra số tiền trước khi duyệt', sumReject: 'Khách hàng sẽ nhận thông báo từ chối', sumPay: 'Hồ sơ sẽ được đóng sau khi ghi nhận chi trả', sumAssign: 'Kiểm tra thông tin giám định viên',
  },
  en: {
    clSubtitle: 'Accident reports from the VETC app', clOpen: 'Open claims', clDueSoon: 'Due soon', clBreached: 'SLA breached', clPaidMonth: 'Paid this month',
    clPaidHint: (a) => `${a} paid out`, clOpenHint: (n) => `${n} awaiting acknowledgement`, clQueue: 'Claims queue', clRef: 'Claim', clVehicle: 'Vehicle', clPolicy: 'Policy', clIncident: 'Incident',
    clSummary: 'Summary', clStatus: 'Status', clNext: 'Next step', clReported: (r) => `Reported ${r}`, clSearch: 'Search claim, plate or description…',
    fAll: 'All', fNeedsAction: 'To acknowledge', fAssessment: 'In assessment', fPayment: 'Awaiting payment', fClosed: 'Closed', fDueSoon: 'Due soon', fBreached: 'Breached',
    aAcknowledge: 'Acknowledge', aAssign: 'Assign assessor', aStart: 'Start assessment', aApprove: 'Approve claim', aReject: 'Reject claim', aPay: 'Mark as paid',
    aNote: 'Add note', aDetails: 'View details', aHistory: 'View history',
    dAckTitle: 'Acknowledge claim', dAckIntro: 'The customer is notified that the claim has been received.', dAssignTitle: 'Assign assessor', dStartTitle: 'Start assessment',
    dApproveTitle: 'Approve claim', dRejectTitle: 'Reject claim', dPayTitle: 'Mark claim as paid', dNoteTitle: 'Add internal note',
    fAssessor: 'Assessor', fAssessorHelp: 'Full name of the field assessor', fAmount: 'Approved amount (₫)', fAmountHelp: 'Whole đồng, after deductible',
    fReason: 'Rejection reason', fDetails: 'Explanation for the customer', fPayRef: 'Payment reference', fPayRefHelp: 'Bank transfer or VETC wallet transaction reference', fNote: 'Note', fNoteHelp: 'Visible to staff only',
    vAmount: 'Enter an amount greater than 0', vAmountMax: (m) => `Must not exceed ${m}`, vShort: 'Please be more specific (at least 10 characters)', vRef: 'Letters, digits and dashes only (4–40 characters)',
    rCover: 'Not covered by the policy', rPeriod: 'Outside the policy period', rDocs: 'Missing documents', rFraud: 'Suspected fraud', rDup: 'Duplicate of an existing claim', rOther: 'Other reason',
    tAck: 'Claim acknowledged', tAssigned: 'Assessor assigned', tStarted: 'Assessment started', tApproved: 'Claim approved', tRejected: 'Claim rejected', tPaid: 'Claim marked as paid', tNote: 'Note added',
    sSubmitted: 'Reported by customer', sAck: 'Acknowledged', sAssigned: 'Assessor assigned', sAssess: 'Under assessment', sDecision: 'Decision', sApproved: 'Approved', sRejected: 'Rejected', sPaid: 'Paid', sClosed: 'Closed',
    byCustomer: 'Customer · VETC app', tabOverview: 'Overview', tabPolicy: 'Policy & customer', tabNotes: 'Notes', tabHistory: 'History',
    secProgress: 'Progress', secWhat: 'What happened', secPhotos: 'Photos', secPolicy: 'Policy', secCustomer: 'Customer & vehicle', photosCount: (n) => `${n} photo${n === 1 ? '' : 's'} sent from the app`, noPhotos: 'No photos sent yet',
    kIncident: 'Incident date', kLocation: 'Location', kReported: 'Reported', kSla: 'Current SLA', kProduct: 'Product', kCert: 'Certificate no.', kPolicyNo: 'Policy no.', kPeriod: 'Policy period', kPremium: 'Premium',
    kChannel: 'Sales channel', kPlate: 'Plate', kOwner: 'Owner', kRegion: 'Province', kVehicle: 'Vehicle type', kOwnerType: 'Owner type', kAssessor: 'Assessor', kApproved: 'Approved amount', kReason: 'Rejection reason', kPayRef: 'Payment reference',
    noNotes: 'No notes yet', noNotesHint: 'Internal notes keep colleagues up to date on this claim.', addNote: 'Add note', notePlaceholder: 'e.g. Called the customer, assessment booked for 9:00 tomorrow',
    slaStage: { acknowledgement: 'Acknowledgement', decision: 'Decision', payment: 'Payment' }, emptyQueue: 'No claims here', emptyQueueHint: 'New accident reports from the VETC app appear here.',
    claimTitle: (r) => `Claim ${r}`, confirmAck: 'Acknowledge', confirmAssign: 'Assign assessor', confirmStart: 'Start assessment', confirmApprove: 'Confirm approval', confirmReject: 'Confirm rejection', confirmPay: 'Confirm payment', saveNote: 'Save note',
    sumApprove: 'Check the amount before approving', sumReject: 'The customer will be notified of the rejection', sumPay: 'The claim is closed once payment is recorded', sumAssign: 'Check the assessor details',
  },
});

const CLOSED = ['paid', 'rejected', 'closed'];
const FILTERS = {
  all: () => true,
  needs: (c) => c.status === 'submitted',
  assessment: (c) => ['acknowledged', 'assessor_assigned', 'under_assessment'].includes(c.status),
  payment: (c) => c.status === 'approved',
  closed: (c) => CLOSED.includes(c.status),
  dueSoon: (c) => slaState(c) === 'soon',
  breached: (c) => slaState(c) === 'breached',
};
/** "Due soon" window per SLA stage. */
const SOON_MS = { acknowledgement: 3600000, decision: 24 * 3600000, payment: 24 * 3600000 };
const REJECT_REASONS = ['rCover', 'rPeriod', 'rDocs', 'rFraud', 'rDup', 'rOther'];

function slaState(c) {
  if (!c.sla?.dueAt) return null;
  const left = new Date(c.sla.dueAt).getTime() - Date.now();
  return left < 0 ? 'breached' : left < (SOON_MS[c.sla.stage] || 3600000) ? 'soon' : 'ok';
}
const slaFor = (c) => slaChip(c.sla?.dueAt, { soonMs: SOON_MS[c.sla?.stage] || 3600000 });
const stageLabel = (s) => (t('slaStage') || {})[s] || s;
const firstLine = (s) => String(s || '').split(/\r?\n/)[0];
const paidAt = (c) => (c.history || []).find((x) => x.status === 'paid')?.at || null;

/** Decision dialogs: each asks for the data the step needs, then confirms. Returns the updated claim or null. */
function actionsFor(c, { api, can, onDone, openDetail }) {
  const write = can('claims:update');
  const patch = (status, extra, toastKey) => async (values) => {
    const saved = await api.patch(`/api/claims/${encodeURIComponent(c.id)}`, { status, ...extra(values) });
    toast(t(toastKey), 'ok', { title: c.id });
    onDone(saved);
    return saved;
  };
  const noteField = () => ({ name: 'note', label: t('fNote'), control: textarea({ rows: 3, maxlength: '1000' }), optional: true, help: t('fNoteHelp') });
  const intro = `${c.id} · ${formatPlate(c.plate)} · ${productShort(c.product)}`;

  const acknowledge = () => decisionDialog({ title: t('dAckTitle'), intro: t('dAckIntro'), confirmLabel: t('confirmAck'), size: 'sm',
    onSubmit: patch('acknowledged', () => ({}), 'tAck') });
  const assign = () => decisionDialog({ title: t('dAssignTitle'), intro, confirmLabel: t('confirmAssign'), summaryTitle: t('sumAssign'),
    fields: [{ name: 'assessor', label: t('fAssessor'), required: true, help: t('fAssessorHelp'), control: input({ maxlength: '120', autocomplete: 'off' }), validate: (v) => (v.length < 3 ? t('vShort') : null) }, noteField()],
    onSubmit: patch('assessor_assigned', (v) => ({ assessor: v.assessor, note: v.note || undefined }), 'tAssigned') });
  const start = () => decisionDialog({ title: t('dStartTitle'), intro, confirmLabel: t('confirmStart'), size: 'sm',
    onSubmit: patch('under_assessment', () => ({}), 'tStarted') });
  const approve = () => {
    const amount = input({ inputmode: 'numeric', autocomplete: 'off', placeholder: '0' });
    amount.addEventListener('input', () => { const d = amount.value.replace(/\D/g, '').slice(0, 11); amount.value = d ? formatNumber(Number(d)) : ''; });
    return decisionDialog({ title: t('dApproveTitle'), intro, confirmLabel: t('confirmApprove'), summaryTitle: t('sumApprove'),
      fields: [
        { name: 'amount', label: t('fAmount'), required: true, help: t('fAmountHelp'), control: amount, read: (el) => (el.value ? Number(el.value.replace(/\D/g, '')) : ''),
          validate: (v) => (!(v > 0) ? t('vAmount') : v > 100000000000 ? t('vAmountMax', formatMoney(100000000000)) : null), summary: (v) => formatMoney(v) },
        noteField(),
      ],
      onSubmit: patch('approved', (v) => ({ approvedAmount: v.amount, note: v.note || undefined }), 'tApproved') });
  };
  const reject = () => decisionDialog({ title: t('dRejectTitle'), intro, confirmLabel: t('confirmReject'), danger: true, summaryTitle: t('sumReject'),
    fields: [
      { name: 'reason', label: t('fReason'), required: true, control: selectInput([['', '—'], ...REJECT_REASONS.map((k) => [k, t(k)])], ''), summary: (v) => t(v) },
      { name: 'details', label: t('fDetails'), required: true, control: textarea({ rows: 3, maxlength: '480' }), validate: (v) => (v.length < 10 ? t('vShort') : null) },
    ],
    onSubmit: patch('rejected', (v) => ({ reason: `${t(v.reason)} — ${v.details}`, note: v.details }), 'tRejected') });
  const pay = () => decisionDialog({ title: t('dPayTitle'), intro: c.approvedAmount ? `${intro} · ${formatMoney(c.approvedAmount)}` : intro, confirmLabel: t('confirmPay'), summaryTitle: t('sumPay'),
    fields: [{ name: 'paymentRef', label: t('fPayRef'), required: true, help: t('fPayRefHelp'), control: input({ maxlength: '40', autocomplete: 'off' }), validate: (v) => (/^[A-Za-z0-9-]{4,40}$/.test(v) ? null : t('vRef')) }, noteField()],
    onSubmit: patch('paid', (v) => ({ paymentRef: v.paymentRef, note: v.note || undefined }), 'tPaid') });
  const note = () => decisionDialog({ title: t('dNoteTitle'), intro, confirmLabel: t('saveNote'),
    fields: [{ name: 'text', label: t('fNote'), required: true, help: t('fNoteHelp'), control: textarea({ rows: 4, maxlength: '1000', placeholder: t('notePlaceholder') }) }],
    onSubmit: async (v) => { await api.post(`/api/claims/${encodeURIComponent(c.id)}/notes`, { text: v.text }); toast(t('tNote'), 'ok', { title: c.id }); onDone(null); return true; } });

  const PRIMARY = {
    submitted: { label: t('aAcknowledge'), icon: 'check', run: acknowledge },
    acknowledged: { label: t('aAssign'), icon: 'user-check', run: assign },
    assessor_assigned: { label: t('aStart'), icon: 'play', run: start },
    under_assessment: { label: t('aApprove'), icon: 'check-circle', run: approve },
    approved: { label: t('aPay'), icon: 'wallet', run: pay },
  };
  const canReject = ['submitted', 'acknowledged', 'under_assessment'].includes(c.status);
  const primary = write && PRIMARY[c.status] ? PRIMARY[c.status] : null;
  const menu = [
    { label: t('aDetails'), icon: 'eye', onClick: () => openDetail(c, 'overview') },
    { label: t('aHistory'), icon: 'history', onClick: () => openDetail(c, 'history') },
    write ? { label: t('aNote'), icon: 'message-square', onClick: note } : null,
    write && canReject ? { separator: true } : null,
    write && canReject ? { label: t('aReject'), icon: 'x-circle', danger: true, onClick: reject } : null,
  ].filter(Boolean);
  return { primary, menu, reject: write && canReject ? reject : null, note: write ? note : null };
}

/** One labelled fact under a workflow step ("Assessor: Le Quang Vinh"). */
const factLine = (k, v) => h('div', { class: 'ws-fact' }, h('span', { class: 'muted' }, `${k}: `), h('strong', {}, v));

function progressSteps(c) {
  const hist = c.history || [];
  const at = (s) => hist.find((x) => x.status === s);
  const who = (x) => (x ? (x.byName || (String(x.by || '').startsWith('customer:') ? t('byCustomer') : null)) : null);
  const order = [
    ['submitted', 'sSubmitted'], ['acknowledged', 'sAck'], ['assessor_assigned', 'sAssigned'], ['under_assessment', 'sAssess'],
  ];
  const rejected = at('rejected');
  const steps = [];
  let currentSet = false;
  for (const [st, key] of order) {
    const x = at(st);
    if (!x && rejected) continue; // steps skipped by an early rejection are not shown
    const extra = st === 'assessor_assigned' && c.assessor ? factLine(t('kAssessor'), c.assessor) : null;
    if (x) steps.push({ label: t(key), state: 'complete', who: who(x), at: x.at, note: x.note, extra });
    else { steps.push({ label: t(key), state: currentSet ? 'upcoming' : 'current' }); currentSet = true; }
  }
  const approved = at('approved');
  if (rejected) {
    steps.push({ label: t('sRejected'), state: 'error', who: who(rejected), at: rejected.at, note: c.rejectionReason || rejected.note });
    steps.push({ label: t('sClosed'), state: 'complete', at: rejected.at });
  } else {
    steps.push(approved
      ? { label: t('sApproved'), state: 'complete', who: who(approved), at: approved.at, note: approved.note, extra: c.approvedAmount ? factLine(t('kApproved'), formatMoney(c.approvedAmount)) : null }
      : { label: t('sDecision'), state: currentSet ? 'upcoming' : 'current' });
    if (!approved) currentSet = true;
    const paid = at('paid');
    steps.push(paid
      ? { label: t('sPaid'), state: 'complete', who: who(paid), at: paid.at, note: paid.note, extra: c.paymentRef ? factLine(t('kPayRef'), c.paymentRef) : null }
      : { label: t('sPaid'), state: currentSet ? 'upcoming' : 'current' });
  }
  return workflowSteps(steps, { label: t('secProgress') });
}

const HIST_TITLE = { submitted: 'sSubmitted', acknowledged: 'tAck', assessor_assigned: 'tAssigned', under_assessment: 'tStarted', approved: 'tApproved', rejected: 'tRejected', paid: 'tPaid' };
const HIST_TONE = { approved: 'ok', paid: 'ok', rejected: 'danger', submitted: 'info' };

function historyTimeline(c) {
  const items = [
    ...(c.history || []).map((x) => ({ title: t(HIST_TITLE[x.status] || 'tAck'), meta: x.byName || (String(x.by || '').startsWith('customer:') ? t('byCustomer') : null), time: x.at, tone: HIST_TONE[x.status], icon: x.status === 'rejected' ? 'x-circle' : x.status === 'paid' ? 'wallet' : 'circle-dot', body: x.note || null })),
    ...(c.notes || []).map((n) => ({ title: t('tNote'), meta: n.byName, time: n.at, icon: 'message-square', body: n.text })),
  ].sort((a, b) => String(b.time).localeCompare(String(a.time)));
  return timeline(items);
}

function notesPanel(c, actions) {
  const list = (c.notes || []).slice().reverse();
  return h('div', { class: 'stack' },
    actions.note ? h('div', { class: 'row end' }, button({ label: t('addNote'), icon: 'plus', size: 'sm', onClick: () => { actions.note(); } })) : null,
    list.length ? h('div', {}, list.map((n) => h('div', { class: 'wf-note' }, h('p', {}, n.text), h('div', { class: 'wf-note-meta' }, [n.byName, formatRelative(n.at)].filter(Boolean).join(' · ')))))
      : emptyState({ icon: 'message-square', title: t('noNotes'), text: t('noNotesHint'), compact: true }));
}

function overviewPanel(c) {
  const photos = Number(c.photos) || 0;
  return h('div', {},
    h('section', { class: 'wf-section' }, h('h3', {}, t('secProgress')), progressSteps(c)),
    h('section', { class: 'wf-section' }, h('h3', {}, t('secWhat')),
      h('div', { class: 'stack' },
        h('p', { class: 'wf-prose' }, c.description || '—'),
        keyValueList([
          [t('kIncident'), formatDate(c.incidentDate)],
          [t('kLocation'), c.location ? h('span', { class: 'wf-inline-icon' }, icon('map-pin', { size: 15 }), h('span', {}, c.location)) : null],
          [t('kReported'), formatRelative(c.history?.[0]?.at)],
          c.sla ? [t('kSla'), h('div', { class: 'wf-status-cell' }, slaFor(c), h('span', { class: 'cell-sub' }, stageLabel(c.sla.stage)))] : null,
        ], { columns: 2 }))),
    h('section', { class: 'wf-section' }, h('h3', {}, t('secPhotos')),
      photos ? h('div', { class: 'stack-sm' }, h('div', { class: 'wf-photos' }, Array.from({ length: Math.min(photos, 4) }, (_, i) => h('div', { class: 'wf-photo' },
        i === 3 && photos > 4 ? h('span', { class: 'wf-photo-more' }, `+${photos - 3}`) : icon('image', { size: 22 })))), h('span', { class: 'muted small' }, t('photosCount', photos)))
        : emptyState({ icon: 'camera', title: t('noPhotos'), compact: true })));
}

function policyPanel(c, technical) {
  const p = c.policy;
  const cu = c.customer;
  return h('div', {},
    h('section', { class: 'wf-section' }, h('h3', {}, t('secPolicy')), p ? keyValueList([
      [t('kProduct'), label('product', p.product)],
      [t('kCert'), p.certNo],
      [t('kPolicyNo'), p.policyNo],
      [t('kPeriod'), `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`],
      [t('kPremium'), p.total ? formatMoney(p.total) : null],
      [t('kChannel'), p.channel ? label('channel', p.channel) : null],
    ], { columns: 2 }) : emptyState({ icon: 'file-text', title: t('empty'), compact: true })),
    h('section', { class: 'wf-section' }, h('h3', {}, t('secCustomer')), cu ? keyValueList([
      [t('kPlate'), h('span', { class: 'plate-tag' }, formatPlate(cu.plate))],
      [t('kOwner'), cu.name],
      [t('kRegion'), cu.province],
      [t('kVehicle'), cu.category ? label('category', cu.category) : null],
      [t('kOwnerType'), cu.ownerType ? label('ownerType', cu.ownerType) : null],
    ], { columns: 2 }) : emptyState({ icon: 'user', title: t('empty'), compact: true })),
    technical ? h('section', { class: 'wf-section' }, technicalDetails(keyValueList([['Claim id', c.id], ['Policy id', c.policyId], ['Profile id', c.profileId]], { columns: 1, inline: true }))) : null);
}

export default {
  perm: 'claims:read',
  async render(main, ctx) {
    const { api, route, can, refreshSignals, user } = ctx;
    const technical = (user?.roles || []).some((r) => ['admin', 'support_engineer', 'auditor'].includes(r));
    let rows = await api.get('/api/claims?limit=500');
    let filter = FILTERS[route.query.view] ? route.query.view : 'all';
    let table;
    let detail = null;

    const reload = async (updated) => {
      rows = await api.get('/api/claims?limit=500');
      renderAll();
      refreshSignals?.();
      if (detail && updated !== undefined) detail.refresh();
    };
    const openDetail = async (c, tab = 'overview') => {
      let full;
      try { full = await api.get(`/api/claims/${encodeURIComponent(c.id)}`); } catch (e) { errorToast(e); return; }
      const d = drawer({ title: t('claimTitle', full.id), subtitle: `${formatPlate(full.plate)} · ${productShort(full.product)}`, size: 'lg', headerExtra: statusChip(full.status), onClose: () => { detail = null; } });
      detail = { refresh: async () => { full = await api.get(`/api/claims/${encodeURIComponent(c.id)}`); paint(); } };
      let active = tab;
      function paint() {
        const acts = actionsFor(full, { api, can, onDone: (saved) => reload(saved), openDetail: () => {} });
        d.el.querySelector('.drawer-header .badge')?.replaceWith(statusChip(full.status));
        d.setBody(tabs({
          label: t('claimTitle', full.id), active, onChange: (id) => { active = id; },
          items: [
            { id: 'overview', label: t('tabOverview'), render: (p) => { mount(p, overviewPanel(full)); } },
            { id: 'policy', label: t('tabPolicy'), render: (p) => { mount(p, policyPanel(full, technical)); } },
            { id: 'notes', label: t('tabNotes'), count: (full.notes || []).length || undefined, render: (p) => { mount(p, notesPanel(full, acts)); } },
            { id: 'history', label: t('tabHistory'), render: (p) => { mount(p, historyTimeline(full)); } },
          ],
        }));
        d.setFooter(
          acts.reject ? button({ label: t('aReject'), icon: 'x-circle', variant: 'danger', onClick: () => { acts.reject(); } }) : null,
          h('span', { class: 'grow' }),
          acts.primary ? button({ label: acts.primary.label, icon: acts.primary.icon, variant: 'primary', onClick: () => { acts.primary.run(); } }) : button({ label: t('close'), onClick: () => d.close() }));
      }
      paint();
    };

    const counts = () => Object.fromEntries(Object.keys(FILTERS).map((k) => [k, rows.filter(FILTERS[k]).length]));
    const setFilter = (k) => { filter = k; history.replaceState(null, '', k === 'all' ? '#/claims' : `#/claims?view=${k}`); renderAll(); };

    const columns = [
      { key: 'id', label: t('clRef'), sortable: true, render: (c) => h('span', { class: 'wf-ref', title: t('clReported', formatRelative(c.history?.[0]?.at)) }, c.id), value: (c) => c.history?.[0]?.at || c.id, exportValue: (c) => c.id },
      { key: 'plate', label: t('clVehicle'), sortable: true, render: (c) => vehicleCell(c.plate, c.customerName), value: (c) => c.plate || '', exportValue: (c) => formatPlate(c.plate) },
      { key: 'product', label: t('clPolicy'), sortable: true, render: (c) => h('span', { class: 'nowrap', title: label('product', c.product) }, productShort(c.product)), value: (c) => productShort(c.product) },
      { key: 'incidentDate', label: t('clIncident'), sortable: true, nowrap: true, render: (c) => formatDate(c.incidentDate) },
      { key: 'description', label: t('clSummary'), render: (c) => h('span', { class: 'wf-summary', title: c.description || '' }, firstLine(c.description) || '—'), exportValue: (c) => c.description || '' },
      { key: 'status', label: t('clStatus'), sortable: true, render: (c) => h('div', { class: 'wf-status-cell' }, statusChip(c.status), c.sla ? slaFor(c) : null),
        value: (c) => (c.sla?.dueAt ? `0${c.sla.dueAt}` : `1${c.status}`), exportValue: (c) => label('status', c.status) },
      { key: '_actions', label: t('clNext'), align: 'right', render: (c) => {
        const a = actionsFor(c, { api, can, onDone: reload, openDetail });
        return rowActions({ primary: a.primary ? { label: a.primary.label, onClick: () => { a.primary.run(); } } : { label: t('view'), muted: true, onClick: () => openDetail(c) }, menu: a.menu });
      } },
    ];

    function renderAll() {
      const n = counts();
      const open = rows.filter((c) => !CLOSED.includes(c.status));
      const month = new Date().toISOString().slice(0, 7);
      const paidMonth = rows.filter((c) => c.status === 'paid' && String(paidAt(c)).slice(0, 7) === month);
      const paidSum = paidMonth.reduce((s, c) => s + (c.approvedAmount || 0), 0);
      const visible = rows.filter(FILTERS[filter]);
      const chips = [
        ['all', 'fAll'], ['needs', 'fNeedsAction'], ['assessment', 'fAssessment'], ['payment', 'fPayment'], ['closed', 'fClosed'],
      ].map(([k, key]) => chip({ label: t(key), count: n[k], selected: filter === k, onClick: () => setFilter(k) }));
      if (filter === 'dueSoon' || filter === 'breached') chips.push(chip({ label: t(filter === 'dueSoon' ? 'fDueSoon' : 'fBreached'), count: n[filter], selected: true, icon: 'clock', onClick: () => setFilter('all') }));
      table = dataTable({
        caption: t('clQueue'), columns, rows: visible, onRowClick: (c) => openDetail(c),
        toolbar: { search: { placeholder: t('clSearch') }, filters: [h('div', { class: 'chip-row' }, chips)], export: { filename: 'claims.csv' } },
        pagination: { pageSize: 25 },
        empty: { icon: 'shield-check', title: t('emptyQueue'), text: t('emptyQueueHint') },
      });
      mount(main,
        pageHeader({ title: t('claims'), subtitle: t('clSubtitle') }),
        kpiStrip([
          kpiTile({ label: t('clOpen'), value: formatNumber(open.length), icon: 'shield-check', hint: t('clOpenHint', formatNumber(n.needs)), onClick: () => setFilter('all') }),
          kpiTile({ label: t('clDueSoon'), value: formatNumber(n.dueSoon), icon: 'clock', onClick: () => setFilter('dueSoon') }),
          kpiTile({ label: t('clBreached'), value: formatNumber(n.breached), icon: 'alert-triangle', onClick: () => setFilter('breached') }),
          kpiTile({ label: t('clPaidMonth'), value: formatNumber(paidMonth.length), icon: 'wallet', hint: t('clPaidHint', formatMoney(paidSum)), onClick: () => setFilter('closed') }),
        ]),
        card({ title: t('clQueue'), flush: true, class: 'wf-dense', actions: [badge(formatNumber(visible.length), 'neutral')], body: table }));
    }
    renderAll();
    if (route.query.id) {
      const c = rows.find((x) => x.id === route.query.id);
      if (c) openDetail(c);
    }
  },
};
