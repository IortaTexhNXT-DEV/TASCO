/**
 * Data requests (data-subject requests: access and erasure) — compliance register with one primary verb per row,
 * decision dialogs and a detail drawer. Backend: /api/dsar (permission dsar:manage).
 *   received → in_progress → completed | refused   (response deadline from the service-levels rule set)
 * Business language only: references are readable (DSR-261008-4F2A), customers appear as a masked name and plate.
 */
import { h, mount } from '../../shared/dom.js';
import { addLabels, label } from '../../shared/i18n.js';
import {
  pageHeader, kpiStrip, kpiTile, card, dataTable, chip, statusChip, slaChip, rowActions, vehicleCell, drawer, workflowSteps, keyValueList,
  button, iconButton, decisionDialog, textarea, input, selectInput, checkbox, radioGroup, formField, dateInput, toast, errorToast, banner,
  formatDate, formatDateTime, formatNumber, formatRelative, formatPlate, icon, badge, plateTag,
} from '../ui.js';
import { pageStrings } from './workflowLabels.js';

addLabels({
  vi: {
    dsarType: { access: 'Truy cập dữ liệu', erasure: 'Xóa dữ liệu' },
    dsarChannel: { hotline: 'Tổng đài', email: 'Email', app: 'Ứng dụng', branch: 'Tại chi nhánh', letter: 'Thư / công văn' },
    dsarStatus: { received: 'Đã tiếp nhận', in_progress: 'Đang xử lý', completed: 'Hoàn tất', refused: 'Từ chối' },
  },
  en: {
    dsarType: { access: 'Access', erasure: 'Erasure' },
    dsarChannel: { hotline: 'Hotline', email: 'Email', app: 'App', branch: 'Branch', letter: 'Letter' },
    dsarStatus: { received: 'Received', in_progress: 'In progress', completed: 'Completed', refused: 'Refused' },
  },
});

const t = pageStrings('dsar', {
  vi: {
    subtitle: 'Yêu cầu truy cập và xóa dữ liệu cá nhân theo Nghị định 13/2023', logRequest: 'Ghi nhận yêu cầu', register: 'Danh sách yêu cầu',
    kOpen: 'Đang mở', kDueSoon: 'Đến hạn trong 24 giờ', kOverdue: 'Quá hạn', kCompleted: 'Hoàn tất trong 30 ngày', kOpenHint: (h) => `Hạn phản hồi ${h} giờ`,
    cRef: 'Mã yêu cầu', cCustomer: 'Khách hàng', cType: 'Loại yêu cầu', cTypeChannel: 'Loại · kênh', cChannel: 'Kênh', cReceived: 'Ngày nhận', cSla: 'Hạn phản hồi', cStatus: 'Trạng thái', cNext: 'Bước tiếp theo',
    fAll: 'Tất cả', fOpen: 'Đang mở', fDueSoon: 'Sắp đến hạn', fOverdue: 'Quá hạn', fCompleted: 'Hoàn tất', fRefused: 'Từ chối', fAllTypes: 'Mọi loại yêu cầu', search: 'Tìm mã yêu cầu hoặc biển số…',
    anonymised: 'Đã ẩn danh', forCustomer: (p) => `Khách hàng ${p}`, closedOn: (d) => `Đóng ngày ${d}`,
    aExport: 'Xuất dữ liệu', aErase: 'Xóa dữ liệu cá nhân', aRefuse: 'Từ chối yêu cầu', aView: 'Xem chi tiết', aStart: 'Bắt đầu xử lý', aVerify: 'Xác nhận đã xác minh danh tính', aCustomer: 'Mở hồ sơ khách hàng',
    logTitle: 'Ghi nhận yêu cầu dữ liệu cá nhân', fCustomer: 'Khách hàng', fCustomerHelp: 'Tìm theo biển số hoặc số điện thoại', fCustomerPh: 'Biển số hoặc số điện thoại, vd. 30E949',
    fType: 'Loại yêu cầu', tAccessD: 'Khách muốn nhận bản sao dữ liệu TASCO đang lưu', tErasureD: 'Khách muốn xóa (ẩn danh) dữ liệu cá nhân', fChannel: 'Kênh tiếp nhận', fReceived: 'Ngày nhận',
    fReceivedHelp: 'Hạn phản hồi tính từ ngày nhận', fVerified: 'Đã xác minh danh tính người yêu cầu', fVerifiedD: 'Đối chiếu CCCD, số điện thoại đã đăng ký hoặc giấy tờ xe', fNote: 'Ghi chú', fNoteHelp: 'Chỉ cán bộ tuân thủ nhìn thấy',
    vDate: 'Ngày không hợp lệ (dd/mm/yyyy, không sau hôm nay)', noCustomer: 'Không tìm thấy khách hàng', pickCustomer: 'Vui lòng chọn khách hàng', clear: 'Bỏ chọn', logged: 'Đã ghi nhận yêu cầu', dueBy: (d) => `Hạn phản hồi ${d}`,
    exportTitle: 'Xuất dữ liệu cá nhân', exportIntro: 'Tệp dữ liệu sẽ được tải về máy và yêu cầu được đánh dấu hoàn tất. Chỉ gửi tệp cho đúng người yêu cầu qua kênh an toàn.',
    exportConfirm: 'Xuất và tải về', exportSum: 'Kiểm tra trước khi xuất dữ liệu', exported: 'Đã xuất dữ liệu và hoàn tất yêu cầu', identity: 'Xác minh danh tính', identityHelp: 'Bắt buộc trước khi dữ liệu rời khỏi công ty', vIdentity: 'Vui lòng xác minh danh tính trước',
    yes: 'Có', eraseTitle: 'Xóa dữ liệu cá nhân', eraseWarn: 'Không thể hoàn tác', eraseText: 'Họ tên, số điện thoại, nội dung tin nhắn và cuộc gọi sẽ bị ẩn danh. Hợp đồng và chứng từ tài chính được giữ lại theo luật, không gắn với danh tính. Hệ thống từ chối nếu khách còn hợp đồng đang hiệu lực.',
    fReason: 'Lý do xóa', fReasonHelp: 'Ghi vào nhật ký kiểm toán', fPlate: 'Nhập biển số để xác nhận', fPlateHelp: (p) => `Nhập ${p}`, vPlate: 'Biển số không khớp', vShort: 'Vui lòng ghi rõ hơn (ít nhất 10 ký tự)',
    eraseConfirm: 'Xóa vĩnh viễn', eraseSum: 'Xác nhận lần cuối trước khi xóa', erased: 'Đã xóa (ẩn danh) dữ liệu cá nhân', eraseRefused: 'Không thể xóa: hợp đồng đang hiệu lực. Yêu cầu đã được ghi nhận là từ chối.',
    refuseTitle: 'Từ chối yêu cầu', refuseReason: 'Lý do từ chối', refuseDetails: 'Giải thích cho khách hàng', refuseConfirm: 'Xác nhận từ chối', refuseSum: 'Khách hàng cần được thông báo lý do từ chối', refused: 'Đã từ chối yêu cầu',
    rIdentity: 'Không xác minh được danh tính', rUnfounded: 'Yêu cầu không có căn cứ hoặc lặp lại', rRetention: 'Phải lưu giữ theo quy định pháp luật', rDuplicate: 'Trùng với yêu cầu đang xử lý', rOther: 'Lý do khác',
    started: 'Đã bắt đầu xử lý yêu cầu', verified: 'Đã ghi nhận xác minh danh tính',
    detailTitle: (r) => `Yêu cầu ${r}`, secProgress: 'Tiến trình', secRequest: 'Thông tin yêu cầu', secHeld: 'Dữ liệu TASCO đang lưu', secOutcome: 'Kết quả', heldNote: 'Chỉ hiển thị số lượng, không hiển thị nội dung dữ liệu.',
    sReceived: 'Tiếp nhận', sVerified: 'Xác minh danh tính', sInProgress: 'Đang xử lý', sCompleted: 'Hoàn tất', sRefused: 'Từ chối', viaChannel: (c) => `Qua ${c}`, byCustomerApp: 'Khách hàng · ứng dụng',
    kRef: 'Mã yêu cầu', kCustomer: 'Khách hàng', kType: 'Loại yêu cầu', kChannel: 'Kênh tiếp nhận', kReceived: 'Ngày nhận', kDue: 'Hạn phản hồi', kNote: 'Ghi chú', kLoggedBy: 'Người ghi nhận', kHandler: 'Người xử lý',
    hPolicies: 'Hợp đồng bảo hiểm', hActive: (n) => `${n} đang hiệu lực`, hQuotes: 'Báo giá', hOrders: 'Đơn hàng', hClaims: 'Hồ sơ bồi thường', hMessages: 'Tin nhắn đã gửi', hSources: 'Bản ghi nguồn dữ liệu', hVoice: 'Cuộc gọi trợ lý',
    oExported: 'Đã xuất dữ liệu cho khách hàng', oErased: 'Đã xóa (ẩn danh) dữ liệu cá nhân', oPolicyInForce: 'Từ chối: hợp đồng còn hiệu lực, dữ liệu phải được lưu giữ đến khi hết hạn',
    emptyTitle: 'Chưa có yêu cầu dữ liệu', emptyText: 'Yêu cầu xem hoặc xóa dữ liệu cá nhân của khách hàng sẽ hiển thị tại đây.', emptyFiltered: 'Không có yêu cầu phù hợp bộ lọc',
  },
  en: {
    subtitle: 'Requests to access or erase personal data (Decree 13/2023)', logRequest: 'Log request', register: 'Request register',
    kOpen: 'Open', kDueSoon: 'Due within 24 h', kOverdue: 'Overdue', kCompleted: 'Completed in 30 days', kOpenHint: (h) => `${h}-hour response time`,
    cRef: 'Reference', cCustomer: 'Customer', cType: 'Type', cTypeChannel: 'Type · channel', cChannel: 'Channel', cReceived: 'Received', cSla: 'Response due', cStatus: 'Status', cNext: 'Next step',
    fAll: 'All', fOpen: 'Open', fDueSoon: 'Due soon', fOverdue: 'Overdue', fCompleted: 'Completed', fRefused: 'Refused', fAllTypes: 'All request types', search: 'Search reference or plate…',
    anonymised: 'Anonymised', forCustomer: (p) => `Customer ${p}`, closedOn: (d) => `Closed ${d}`,
    aExport: 'Export data', aErase: 'Erase personal data', aRefuse: 'Refuse', aView: 'View', aStart: 'Start handling', aVerify: 'Record identity verified', aCustomer: 'Open customer',
    logTitle: 'Log a data request', fCustomer: 'Customer', fCustomerHelp: 'Find by licence plate or phone number', fCustomerPh: 'Plate or phone, e.g. 30E949',
    fType: 'Request type', tAccessD: 'A copy of the data TASCO holds about them', tErasureD: 'Erase (anonymise) their personal data', fChannel: 'Received through', fReceived: 'Received on',
    fReceivedHelp: 'The response time runs from this date', fVerified: 'Requester’s identity verified', fVerifiedD: 'Checked against ID card, registered phone or vehicle papers', fNote: 'Note', fNoteHelp: 'Visible to compliance only',
    vDate: 'Enter a valid date (dd/mm/yyyy), not in the future', noCustomer: 'No customer found', pickCustomer: 'Choose the customer', clear: 'Clear', logged: 'Request logged', dueBy: (d) => `Response due ${d}`,
    exportTitle: 'Export personal data', exportIntro: 'The data file is downloaded and the request is marked completed. Send the file only to the requester through a secure channel.',
    exportConfirm: 'Export and download', exportSum: 'Check before exporting the data', exported: 'Data exported and request completed', identity: 'Identity verification', identityHelp: 'Required before any data leaves the company', vIdentity: 'Verify the requester’s identity first',
    yes: 'Yes', eraseTitle: 'Erase personal data', eraseWarn: 'This cannot be undone', eraseText: 'Name, phone number, message and call content are anonymised. Policies and financial records are kept as the law requires, without the identity. Erasure is refused while the customer has a policy in force.',
    fReason: 'Reason for erasure', fReasonHelp: 'Recorded in the audit trail', fPlate: 'Type the plate to confirm', fPlateHelp: (p) => `Type ${p}`, vPlate: 'The plate does not match', vShort: 'Please be more specific (at least 10 characters)',
    eraseConfirm: 'Erase permanently', eraseSum: 'Last check before erasing', erased: 'Personal data erased (anonymised)', eraseRefused: 'Not erased: a policy is in force. The request is recorded as refused.',
    refuseTitle: 'Refuse request', refuseReason: 'Reason', refuseDetails: 'Explanation for the customer', refuseConfirm: 'Confirm refusal', refuseSum: 'The customer must be told why', refused: 'Request refused',
    rIdentity: 'Identity could not be verified', rUnfounded: 'Unfounded or repeated request', rRetention: 'Data must be kept by law', rDuplicate: 'Duplicate of an open request', rOther: 'Other reason',
    started: 'Request in progress', verified: 'Identity verification recorded',
    detailTitle: (r) => `Request ${r}`, secProgress: 'Progress', secRequest: 'Request', secHeld: 'Data TASCO holds', secOutcome: 'Outcome', heldNote: 'Counts only — the data itself is not shown.',
    sReceived: 'Received', sVerified: 'Identity verified', sInProgress: 'In progress', sCompleted: 'Completed', sRefused: 'Refused', viaChannel: (c) => `Via ${c}`, byCustomerApp: 'Customer · app',
    kRef: 'Reference', kCustomer: 'Customer', kType: 'Request type', kChannel: 'Received through', kReceived: 'Received', kDue: 'Response due', kNote: 'Note', kLoggedBy: 'Logged by', kHandler: 'Handled by',
    hPolicies: 'Insurance policies', hActive: (n) => `${n} in force`, hQuotes: 'Quotes', hOrders: 'Orders', hClaims: 'Claims', hMessages: 'Messages sent', hSources: 'Source data records', hVoice: 'Assistant calls',
    oExported: 'Data exported to the customer', oErased: 'Personal data erased (anonymised)', oPolicyInForce: 'Refused: a policy is in force, the data must be kept until it ends',
    emptyTitle: 'No data requests yet', emptyText: 'Requests from customers to see or erase their personal data appear here.', emptyFiltered: 'No requests match these filters',
  },
});

const OPEN = ['received', 'in_progress'];
const DAY_SOON_MS = 24 * 3600000;
const REFUSE_REASONS = ['rIdentity', 'rUnfounded', 'rRetention', 'rDuplicate', 'rOther'];
const CHANNEL_ICON = { hotline: 'phone', email: 'mail', app: 'monitor', branch: 'building', letter: 'file-text' };
const FILTERS = {
  all: () => true,
  open: (r) => OPEN.includes(r.status),
  dueSoon: (r) => r.dueSoon,
  overdue: (r) => r.overdue,
  completed: (r) => r.status === 'completed',
  refused: (r) => r.status === 'refused',
};

const typeBadge = (type) => badge(label('dsarType', type), type === 'erasure' ? 'warn' : 'info', { icon: type === 'erasure' ? 'trash' : 'download' });
const statusOf = (r) => statusChip(r.status, 'dsarStatus', { tone: { received: 'info', in_progress: 'warn', completed: 'ok', refused: 'danger' }[r.status] });
const customerName = (r) => (r.anonymised ? t('anonymised') : r.customerName);
const outcomeText = (r) => (r.outcome === 'exported' ? t('oExported') : r.outcome === 'erased' ? t('oErased') : r.refusalCode === 'policy_in_force' ? t('oPolicyInForce') : r.refusalReason);
const plainPlate = (p) => String(p || '').toUpperCase().replace(/[^0-9A-Z]/g, '');

function slaCell(r) {
  if (OPEN.includes(r.status)) return slaChip(r.dueAt, { soonMs: DAY_SOON_MS });
  return h('span', { class: 'muted small' }, t('closedOn', formatDate(r.completedAt || r.dueAt)));
}

function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Identity checkbox field for decision dialogs (only when the request is not verified yet). */
function identityField(r) {
  if (r.verifiedIdentity) return null;
  const cb = checkbox({ label: t('fVerified'), description: t('fVerifiedD') });
  return { name: 'verifiedIdentity', label: t('identity'), help: t('identityHelp'), control: cb, read: (el) => el.input.checked, validate: (v) => (v ? null : t('vIdentity')), summary: () => t('yes') };
}

/** Actions for one request: primary verb, kebab menu and the decision dialogs. */
function actionsFor(r, { api, onDone, openDetail, navigate }) {
  const intro = `${r.id} · ${formatPlate(r.plate)}${customerName(r) ? ` · ${customerName(r)}` : ''}`;
  const exportData = () => decisionDialog({
    title: t('exportTitle'), intro: `${intro}. ${t('exportIntro')}`, confirmLabel: t('exportConfirm'), summaryTitle: t('exportSum'),
    fields: [identityField(r)].filter(Boolean),
    onSubmit: async (v) => {
      const res = await api.post(`/api/dsar/${encodeURIComponent(r.id)}/complete-export`, v.verifiedIdentity ? { verifiedIdentity: true } : {});
      downloadJson(res.filename, res.data);
      toast(t('exported'), 'ok', { title: r.id });
      onDone();
      return res;
    },
  });
  const erase = () => {
    const plate = formatPlate(r.plate);
    const reason = textarea({ rows: 3, maxlength: '480' });
    return decisionDialog({
      title: t('eraseTitle'), danger: true, confirmLabel: t('eraseConfirm'), summaryTitle: t('eraseSum'), intro,
      notice: () => banner({ tone: 'danger', title: t('eraseWarn'), text: t('eraseText') }),
      fields: [
        { name: 'reason', label: t('fReason'), required: true, help: t('fReasonHelp'), control: reason, validate: (val) => (val.length < 10 ? t('vShort') : null) },
        identityField(r),
        { name: 'confirmPlate', label: t('fPlate'), required: true, help: t('fPlateHelp', plate), control: input({ autocomplete: 'off', spellcheck: 'false', placeholder: plate }),
          validate: (val) => (plainPlate(val) === plainPlate(r.plate) ? null : t('vPlate')), summary: (val) => formatPlate(plainPlate(val)) },
      ].filter(Boolean),
      onSubmit: async (v) => {
        const res = await api.post(`/api/dsar/${encodeURIComponent(r.id)}/erase`, { reason: v.reason, confirmPlate: v.confirmPlate, ...(v.verifiedIdentity ? { verifiedIdentity: true } : {}) });
        if (res.refused) toast(t('eraseRefused'), 'warn', { title: r.id });
        else toast(t('erased'), 'ok', { title: r.id });
        onDone();
        return res;
      },
    });
  };
  const refuse = () => decisionDialog({
    title: t('refuseTitle'), intro, confirmLabel: t('refuseConfirm'), danger: true, summaryTitle: t('refuseSum'),
    fields: [
      { name: 'reason', label: t('refuseReason'), required: true, control: selectInput([['', '—'], ...REFUSE_REASONS.map((k) => [k, t(k)])], ''), summary: (v) => t(v) },
      { name: 'details', label: t('refuseDetails'), required: true, control: textarea({ rows: 3, maxlength: '400' }), validate: (v) => (v.length < 10 ? t('vShort') : null) },
    ],
    onSubmit: async (v) => {
      const res = await api.post(`/api/dsar/${encodeURIComponent(r.id)}/refuse`, { reason: `${t(v.reason)} — ${v.details}` });
      toast(t('refused'), 'ok', { title: r.id });
      onDone();
      return res;
    },
  });
  const start = async () => {
    try { await api.post(`/api/dsar/${encodeURIComponent(r.id)}/start`, {}); toast(t('started'), 'ok', { title: r.id }); onDone(); } catch (e) { errorToast(e); }
  };
  const verify = async () => {
    try { await api.post(`/api/dsar/${encodeURIComponent(r.id)}/start`, { verifiedIdentity: true }); toast(t('verified'), 'ok', { title: r.id }); onDone(); } catch (e) { errorToast(e); }
  };
  const open = OPEN.includes(r.status);
  const primary = !open ? null : r.type === 'access' ? { label: t('aExport'), icon: 'download', run: exportData } : { label: t('aErase'), icon: 'trash', run: erase };
  const menu = [
    { label: t('aView'), icon: 'eye', onClick: () => openDetail(r) },
    !r.anonymised ? { label: t('aCustomer'), icon: 'user', onClick: () => navigate(`customer/${encodeURIComponent(r.profileId)}`) } : null,
    open && r.status === 'received' ? { label: t('aStart'), icon: 'play', onClick: start } : null,
    open && !r.verifiedIdentity ? { label: t('aVerify'), icon: 'user-check', onClick: verify } : null,
    open ? { separator: true } : null,
    open ? { label: t('aRefuse'), icon: 'x-circle', danger: true, onClick: refuse } : null,
  ].filter(Boolean);
  return { primary, menu, refuse: open ? refuse : null };
}

function progressSteps(r) {
  const who = (id, name, byCustomer) => (byCustomer || String(id || '').startsWith('customer:') ? t('byCustomerApp') : name);
  const at = (s) => (r.history || []).find((x) => x.status === s);
  const closed = r.status === 'completed' ? at('completed') : r.status === 'refused' ? at('refused') : null;
  const steps = [];
  const rec = at('received');
  steps.push({ label: t('sReceived'), state: 'complete', who: who(rec?.by, rec?.byName, rec?.byCustomer), at: r.receivedAt, note: t('viaChannel', label('dsarChannel', r.channel)) });
  const ver = at('identity_verified');
  steps.push(r.verifiedIdentity
    ? { label: t('sVerified'), state: 'complete', who: who(ver?.by, r.identityVerifiedByName || ver?.byName, ver?.byCustomer), at: r.identityVerifiedAt }
    : { label: t('sVerified'), state: closed ? 'upcoming' : 'current' });
  const prog = at('in_progress');
  const progressDone = !!prog || r.status === 'completed';
  steps.push(progressDone
    ? { label: t('sInProgress'), state: 'complete', who: prog ? who(prog.by, prog.byName, prog.byCustomer) : who(r.handledBy, r.handledByName), at: r.startedAt || prog?.at || r.completedAt }
    : { label: t('sInProgress'), state: r.verifiedIdentity && !closed ? 'current' : 'upcoming' });
  if (r.status === 'refused') steps.push({ label: t('sRefused'), state: 'error', who: who(closed?.by, closed?.byName, closed?.byCustomer), at: r.completedAt, note: outcomeText(r) });
  else if (r.status === 'completed') steps.push({ label: t('sCompleted'), state: 'complete', who: who(closed?.by, closed?.byName, closed?.byCustomer), at: r.completedAt, note: outcomeText(r) });
  else steps.push({ label: t('sCompleted'), state: 'upcoming' });
  return workflowSteps(steps, { label: t('secProgress') });
}

function heldList(d) {
  const hd = d.held || {};
  const n = (x) => formatNumber(x || 0);
  return h('div', { class: 'stack-sm' },
    keyValueList([
      [t('hPolicies'), hd.activePolicies ? h('span', { class: 'row gap-sm' }, n(hd.policies), badge(t('hActive', n(hd.activePolicies)), 'warn', { dot: true })) : n(hd.policies)],
      [t('hQuotes'), n(hd.quotes)], [t('hOrders'), n(hd.orders)], [t('hClaims'), n(hd.claims)],
      [t('hMessages'), n(hd.messages)], [t('hSources'), n(hd.sourceRecords)], [t('hVoice'), n(hd.voiceSessions)],
    ], { columns: 2 }),
    h('p', { class: 'muted small' }, icon('lock', { size: 14 }), ' ', t('heldNote')));
}

/** "Log request" drawer: customer search (plate or phone), type, channel, received date, identity, note. */
function logDrawer({ api, onDone, preset }) {
  const picked = { id: null };
  const pickedEl = h('div', { class: 'sim-picked dsar-picked' });
  const list = h('ul', { class: 'dsar-results', role: 'listbox', 'aria-label': t('fCustomer'), hidden: true });
  const search = input({ type: 'search', icon: 'search', placeholder: t('fCustomerPh'), autocomplete: 'off', 'aria-label': t('fCustomer') });
  const searchEl = search.input || search;
  const custField = formField({ label: t('fCustomer'), required: true, help: t('fCustomerHelp'), control: h('div', { class: 'dsar-search' }, search, list, pickedEl) });
  const choose = (c) => {
    picked.id = c.id;
    list.hidden = true; searchEl.value = ''; search.hidden = true;
    custField.setError?.(null);
    mount(pickedEl, plateTag(c.plate || c.id), c.name ? h('span', { class: 'small' }, c.name) : null, c.region ? h('span', { class: 'small muted' }, c.region) : null,
      iconButton({ icon: 'x', label: t('clear'), size: 'sm', onClick: () => { picked.id = null; mount(pickedEl); search.hidden = false; searchEl.focus(); } }));
  };
  let timer = null;
  searchEl.addEventListener('input', () => {
    clearTimeout(timer);
    const q = searchEl.value.trim();
    if (q.replace(/[^0-9A-Za-z]/g, '').length < 3) { list.hidden = true; return; }
    timer = setTimeout(async () => {
      try {
        const r = await api.get(`/api/search/customers?q=${encodeURIComponent(q)}&limit=6`);
        const items = r.items || [];
        mount(list, items.length ? items.map((c) => h('li', { role: 'option', tabindex: '0', class: 'sim-opt', onclick: () => choose(c), onkeydown: (e) => { if (e.key === 'Enter') choose(c); } },
          icon('car', { size: 14 }), h('span', { class: 'strong' }, formatPlate(c.plate || c.id)), h('span', { class: 'small muted' }, [c.name, c.region].filter(Boolean).join(' · '))))
          : h('li', { class: 'sim-none' }, t('noCustomer')));
        list.hidden = false;
      } catch (e) { errorToast(e); }
    }, 250);
  });
  const type = radioGroup({ name: 'dsar-type', options: [['access', label('dsarType', 'access'), t('tAccessD')], ['erasure', label('dsarType', 'erasure'), t('tErasureD')]], value: 'access' });
  const channel = selectInput(['hotline', 'email', 'branch', 'letter', 'app'].map((c) => [c, label('dsarChannel', c)]), 'hotline');
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const received = dateInput({ value: today, required: true });
  const receivedField = formField({ label: t('fReceived'), required: true, help: t('fReceivedHelp'), control: received });
  const verified = checkbox({ label: t('fVerified'), description: t('fVerifiedD') });
  const note = textarea({ rows: 3, maxlength: '1000' });
  const body = h('div', { class: 'stack' },
    custField,
    formField({ label: t('fType'), required: true, control: type }),
    h('div', { class: 'form-grid' }, formField({ label: t('fChannel'), required: true, control: channel }), receivedField),
    verified,
    formField({ label: t('fNote'), optional: true, help: t('fNoteHelp'), control: note }));
  const d = drawer({ title: t('logTitle'), size: 'md', body });
  const submit = button({ label: t('logRequest'), icon: 'check', variant: 'primary', onClick: async () => {
    if (!picked.id) { custField.setError?.(t('pickCustomer')); searchEl.focus(); return; }
    const iso = received.isoValue;
    if (!iso || iso > today) { receivedField.setError?.(t('vDate')); received.focus(); return; }
    receivedField.setError?.(null);
    // Today: now; an earlier day: that morning (09:00 Vietnam time).
    const receivedAt = iso === today ? undefined : `${iso}T09:00:00+07:00`;
    try {
      const r = await api.post('/api/dsar', { profileId: picked.id, type: type.value, channel: channel.value, ...(receivedAt ? { receivedAt } : {}), verifiedIdentity: verified.input.checked, note: note.value.trim() || undefined });
      toast(t('dueBy', formatDateTime(r.dueAt)), 'ok', { title: t('logged') });
      d.close();
      onDone(r);
    } catch (e) { errorToast(e); }
  } });
  d.setFooter(button({ label: t('cancel'), onClick: () => d.close() }), h('span', { class: 'grow' }), submit);
  if (preset) choose(preset);
  return d;
}

export default {
  perm: 'dsar:manage',
  async render(main, ctx) {
    const { api, route, navigate, refreshSignals } = ctx;
    const profileFilter = route.query.profile || null;
    const load = () => api.get(`/api/dsar?limit=500${profileFilter ? `&profileId=${encodeURIComponent(profileFilter)}` : ''}`);
    let data = await load();
    let filter = FILTERS[route.query.view] ? route.query.view : 'all';
    let typeFilter = '';
    let detail = null;

    const reload = async () => {
      data = await load();
      renderAll();
      refreshSignals?.();
      if (detail) detail.refresh();
    };

    async function openDetail(r0) {
      let d;
      try { d = await api.get(`/api/dsar/${encodeURIComponent(r0.id)}`); } catch (e) { errorToast(e); return; }
      const dr = drawer({ title: t('detailTitle', d.id), subtitle: `${formatPlate(d.plate)} · ${label('dsarType', d.type)}`, size: 'lg', headerExtra: statusOf(d), onClose: () => { detail = null; } });
      detail = { refresh: async () => { d = await api.get(`/api/dsar/${encodeURIComponent(r0.id)}`); paint(); } };
      function paint() {
        const acts = actionsFor(d, { api, onDone: reload, openDetail: () => {}, navigate });
        dr.el.querySelector('.drawer-header .badge')?.replaceWith(statusOf(d));
        dr.setBody(
          h('section', { class: 'wf-section' }, h('h3', {}, t('secProgress')), progressSteps(d)),
          h('section', { class: 'wf-section' }, h('h3', {}, t('secRequest')), keyValueList([
            [t('kRef'), h('span', { class: 'wf-ref' }, d.id)],
            [t('kCustomer'), vehicleCell(d.plate, customerName(d))],
            [t('kType'), typeBadge(d.type)],
            [t('kChannel'), h('span', { class: 'wf-inline-icon' }, icon(CHANNEL_ICON[d.channel] || 'inbox', { size: 15 }), h('span', {}, label('dsarChannel', d.channel)))],
            [t('kReceived'), formatDateTime(d.receivedAt)],
            [t('kDue'), OPEN.includes(d.status) ? slaChip(d.dueAt, { soonMs: DAY_SOON_MS }) : formatDateTime(d.dueAt)],
            [t('kLoggedBy'), d.byCustomer ? t('byCustomerApp') : d.createdByName],
            d.handledByName ? [t('kHandler'), d.handledByName] : null,
            d.note ? [t('kNote'), h('span', { class: 'wf-prose' }, d.note)] : null,
          ], { columns: 2 })),
          OPEN.includes(d.status) ? null : h('section', { class: 'wf-section' }, h('h3', {}, t('secOutcome')),
            banner({ tone: d.status === 'completed' ? 'ok' : 'warn', title: label('dsarStatus', d.status), text: outcomeText(d) })),
          h('section', { class: 'wf-section' }, h('h3', {}, t('secHeld')), heldList(d)));
        dr.setFooter(
          acts.refuse ? button({ label: t('aRefuse'), icon: 'x-circle', variant: 'danger', onClick: () => { acts.refuse(); } }) : null,
          h('span', { class: 'grow' }),
          acts.primary ? button({ label: acts.primary.label, icon: acts.primary.icon, variant: d.type === 'erasure' ? 'danger solid' : 'primary', onClick: () => { acts.primary.run(); } })
            : button({ label: t('close'), onClick: () => dr.close() }));
      }
      paint();
    }

    const openLog = (preset) => logDrawer({ api, preset, onDone: async () => { await reload(); } });
    const setFilter = (k) => { filter = k; renderAll(); };

    const columns = [
      { key: 'id', label: t('cRef'), sortable: true, render: (r) => h('span', { class: 'wf-ref' }, r.id), value: (r) => r.receivedAt, exportValue: (r) => r.id },
      { key: 'plate', label: t('cCustomer'), sortable: true, render: (r) => vehicleCell(r.plate, customerName(r)), value: (r) => `${r.plate || ''} ${r.customerName || ''}`, exportValue: (r) => formatPlate(r.plate) },
      // Type with the channel underneath (keeps the register within 1280 px without horizontal scrolling).
      { key: 'type', label: t('cTypeChannel'), sortable: true, value: (r) => `${label('dsarType', r.type)} ${label('dsarChannel', r.channel)}`,
        render: (r) => h('span', { class: 'cell-stack' }, typeBadge(r.type), h('span', { class: 'cell-sub wf-inline-icon' }, icon(CHANNEL_ICON[r.channel] || 'inbox', { size: 13 }), h('span', {}, label('dsarChannel', r.channel)))),
        exportValue: (r) => `${label('dsarType', r.type)} · ${label('dsarChannel', r.channel)}` },
      { key: 'receivedAt', label: t('cReceived'), sortable: true, nowrap: true, value: (r) => r.receivedAt,
        render: (r) => h('span', { class: 'cell-stack' }, h('span', {}, formatDate(r.receivedAt)), h('span', { class: 'cell-sub' }, formatRelative(r.receivedAt))), exportValue: (r) => formatDateTime(r.receivedAt) },
      { key: 'dueAt', label: t('cSla'), sortable: true, value: (r) => (OPEN.includes(r.status) ? `0${r.dueAt}` : `1${r.completedAt || ''}`), render: slaCell, exportValue: (r) => formatDateTime(r.dueAt) },
      { key: 'status', label: t('cStatus'), sortable: true, render: statusOf, value: (r) => label('dsarStatus', r.status) },
      { key: '_actions', label: t('cNext'), align: 'right', render: (r) => {
        const a = actionsFor(r, { api, onDone: reload, openDetail, navigate });
        return rowActions({ primary: a.primary ? { label: a.primary.label, onClick: () => { a.primary.run(); } } : { label: t('view'), muted: true, onClick: () => openDetail(r) }, menu: a.menu });
      } },
    ];

    function renderAll() {
      const rows = data.items || [];
      const s = data.summary || {};
      const typed = rows.filter((r) => !typeFilter || r.type === typeFilter);
      const visible = typed.filter(FILTERS[filter]);
      const count = (k) => typed.filter(FILTERS[k]).length;
      const chips = [['all', 'fAll'], ['open', 'fOpen'], ['dueSoon', 'fDueSoon'], ['overdue', 'fOverdue'], ['completed', 'fCompleted'], ['refused', 'fRefused']]
        .map(([k, key]) => chip({ label: t(key), count: count(k), selected: filter === k, onClick: () => setFilter(k) }));
      const typeSel = selectInput([['', t('fAllTypes')], ['access', label('dsarType', 'access')], ['erasure', label('dsarType', 'erasure')]], typeFilter, { 'aria-label': t('cType') });
      typeSel.addEventListener('change', () => { typeFilter = typeSel.value; renderAll(); });
      const profileChip = profileFilter ? chip({ label: t('forCustomer', formatPlate(profileFilter)), selected: true, icon: 'x', onClick: () => navigate('dsar') }) : null;
      const table = dataTable({
        caption: t('register'), columns, rows: visible, onRowClick: (r) => openDetail(r),
        toolbar: { search: { placeholder: t('search') }, filters: [h('div', { class: 'chip-row' }, profileChip, chips), typeSel], export: { filename: 'data-requests.csv' } },
        pagination: { pageSize: 25 },
        empty: rows.length
          ? { icon: 'filter', title: t('emptyFiltered') }
          : { icon: 'file-check', title: t('emptyTitle'), text: t('emptyText'), action: button({ label: t('logRequest'), icon: 'plus', variant: 'primary', onClick: () => openLog() }) },
      });
      mount(main,
        pageHeader({ title: t('dsar'), subtitle: t('subtitle'), actions: [button({ label: t('logRequest'), icon: 'plus', variant: 'primary', onClick: () => openLog() })] }),
        kpiStrip([
          kpiTile({ label: t('kOpen'), value: formatNumber(s.open || 0), icon: 'inbox', hint: t('kOpenHint', formatNumber(data.responseHours || 72)), onClick: () => setFilter('open') }),
          kpiTile({ label: t('kDueSoon'), value: formatNumber(s.dueSoon || 0), icon: 'clock', onClick: () => setFilter('dueSoon') }),
          kpiTile({ label: t('kOverdue'), value: formatNumber(s.overdue || 0), icon: 'alert-triangle', onClick: () => setFilter('overdue') }),
          kpiTile({ label: t('kCompleted'), value: formatNumber(s.completed30d || 0), icon: 'check-circle', onClick: () => setFilter('completed') }),
        ]),
        card({ title: t('register'), flush: true, class: 'wf-dense', actions: [badge(formatNumber(visible.length), 'neutral')], body: table }));
    }
    renderAll();
    if (route.query.id) {
      const r = (data.items || []).find((x) => x.id === route.query.id);
      if (r) openDetail(r);
    }
    if (route.query.log) {
      try {
        const c = await api.get(`/api/customers/${encodeURIComponent(route.query.log)}`);
        openLog({ id: c.profile.id, plate: c.profile.plate, name: c.profile.name, region: c.profile.province });
      } catch (e) { errorToast(e); }
    }
  },
};
