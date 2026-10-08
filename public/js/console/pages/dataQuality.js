/**
 * Data quality — steward work queue: issues by type (clickable chips with severity), source shown as a business
 * name with its date (resolved from the ingestion batch record, never the batch id), guided resolve drawer,
 * bulk assign / dismiss.
 */
import { h, mount } from '../../shared/dom.js';
import { label, hasLabel } from '../../shared/i18n.js';
import {
  pageHeader, card, dataTable, chip, badge, rowActions, vehicleCell, drawer, keyValueList, button, decisionDialog, selectInput, textarea, input,
  dateInput, formField, confidenceMeter, toast, errorToast, formatDate, formatNumber, formatRelative, formatPlate, avatar, icon, emptyState,
  confirmDialog, technicalDetails, kpiStrip, kpiTile, downloadCsv, formatDuration, formatDateTime,
} from '../ui.js';
import { sourceName, pageStrings } from './workflowLabels.js';

const t = pageStrings('dq', {
  vi: {
    dqSubtitle: 'Thiếu sót phát hiện khi hợp nhất hồ sơ xe', dqQueue: 'Hàng đợi xử lý', dqAllTypes: 'Tất cả', dqIssue: 'Vấn đề', dqVehicle: 'Xe', dqSource: 'Nguồn', dqAge: 'Tồn tại',
    dqAssignee: 'Người xử lý', dqUnassigned: 'Chưa giao', dqResolveBtn: 'Xử lý…', dqAssignMe: 'Giao cho tôi', dqAssign: 'Giao cho…', dqUnassign: 'Bỏ giao việc', dqDismiss: 'Bỏ qua…', dqOpen360: 'Mở hồ sơ khách hàng',
    dqOpenIssues: 'Vấn đề đang mở', dqHigh: 'Mức độ cao', dqVehicles: 'Loại vấn đề', dqTypesHint: (n) => `${n} loại vấn đề`,
    sevHigh: 'Cao', sevMedium: 'Trung bình', sevLow: 'Thấp', severity: 'Mức độ',
    bulkAssign: 'Giao việc', bulkDismiss: 'Bỏ qua', assignTitle: (n) => `Giao ${n} vấn đề`, dismissTitle: (n) => `Bỏ qua ${n} vấn đề`, fAssignee: 'Giao cho', fReason: 'Lý do', fNote: 'Ghi chú', fNoteHelp: 'Lưu cùng quyết định trong nhật ký',
    assigned: (n) => `Đã giao ${n} vấn đề`, dismissed: (n) => `Đã bỏ qua ${n} vấn đề`, resolved: 'Đã xử lý vấn đề', confirmAssign: 'Giao việc', confirmDismiss: 'Bỏ qua vấn đề',
    dReasonFalse: 'Cảnh báo sai', dReasonDup: 'Trùng với vấn đề khác', dReasonSold: 'Xe đã bán / ngừng lưu hành', dReasonFleet: 'Xe doanh nghiệp, xử lý qua kênh đội xe', dReasonOther: 'Lý do khác',
    secIssue: 'Vấn đề', secCompare: 'Đối chiếu hai nguồn', secCurrent: 'Giá trị hiện tại', secLineage: 'Nguồn gốc dữ liệu', secResolve: 'Cách xử lý',
    kType: 'Loại vấn đề', kDetected: 'Phát hiện', kSource: 'Nguồn', kRecords: 'Số bản ghi nguồn', kExpiry: 'Ngày hết hạn', kMethod: 'Căn cứ', kConfidence: 'Độ tin cậy', kInsurer: 'Doanh nghiệp bảo hiểm',
    kCategory: 'Loại xe', kPhones: 'Số điện thoại', kOwner: 'Chủ xe', kRegion: 'Tỉnh/thành', kCandidates: 'Các ngày hết hạn ghi nhận', kSources: 'Nguồn đóng góp',
    verifiedRecord: 'Hồ sơ đã xác minh', customerSays: 'Khách hàng nói', saysRenewed: 'Đã gia hạn với doanh nghiệp khác', otherInsurer: 'Doanh nghiệp khác', reportedOn: 'Thời điểm', statement: 'Lời khách',
    oConfirm: 'Xác nhận giá trị hiện tại', oConfirmD: 'Giá trị trong hồ sơ là đúng, không cần thay đổi', oCorrect: 'Sửa có bằng chứng', oCorrectD: 'Cập nhật giá trị và lưu bằng chứng',
    oMerge: 'Hợp nhất trùng lặp', oMergeD: 'Giữ một giá trị đúng, các giá trị còn lại bị loại', oDismiss: 'Bỏ qua có lý do', oDismissD: 'Không xử lý vấn đề này, ghi rõ lý do',
    oKeepVerified: 'Giữ hồ sơ đã xác minh', oKeepVerifiedD: 'Giấy chứng nhận vẫn có hiệu lực, lời khách chưa có bằng chứng', oAcceptClaim: 'Chấp nhận thông tin khách báo', oAcceptClaimD: 'Có bằng chứng khách đã gia hạn nơi khác',
    fEvidence: 'Loại bằng chứng', fEvidenceRef: 'Tham chiếu bằng chứng', fEvidenceRefHelp: 'Số giấy chứng nhận, mã cuộc gọi hoặc tên tệp', fNewExpiry: 'Ngày hết hạn đúng', fNewInsurer: 'Doanh nghiệp bảo hiểm',
    fNewCategory: 'Loại xe đúng', fNewPhone: 'Số điện thoại đúng', fNewName: 'Họ tên đúng', fKeepPhone: 'Số điện thoại giữ lại', fNewPlate: 'Biển số đúng',
    evCert: 'Ảnh giấy chứng nhận bảo hiểm', evInsurer: 'Xác nhận từ doanh nghiệp bảo hiểm', evCall: 'Cuộc gọi xác minh với chủ xe', evInspection: 'Hồ sơ đăng kiểm', evRegistration: 'Giấy đăng ký xe', evCore: 'Tra cứu hệ thống lõi TASCO',
    resolveIssue: 'Xử lý vấn đề', resolveConfirm: 'Xác nhận xử lý', resolveSum: 'Kiểm tra trước khi lưu', pickOption: 'Chọn một cách xử lý', vPhone: 'Số điện thoại không hợp lệ', vRequired: 'Vui lòng nhập thông tin này',
    vDate: 'Ngày không hợp lệ (dd/mm/yyyy)', noLineage: 'Chưa có thông tin nguồn gốc', inferred: 'Suy luận từ dữ liệu xe', fieldPhone: 'Số điện thoại', fieldName: 'Họ tên', fieldCategory: 'Loại xe', fieldExpiry: 'Ngày hết hạn',
    emptyDq: 'Không còn vấn đề nào', emptyDqHint: 'Dữ liệu đã sạch cho bộ lọc này.', issueOf: (p) => `Biển số ${p}`, outcome: 'Kết quả', notOnFile: 'Chưa có trong hồ sơ',
    rConfirmed: 'Đã xác nhận giá trị hiện tại', rCorrected: 'Đã sửa', rMerged: 'Đã hợp nhất, giữ', rDismissed: 'Bỏ qua', unknownRecord: 'Bản ghi nguồn bị từ chối', superseded: 'Đã bị thay thế bởi nguồn tin cậy hơn', plateFilter: (p) => `Biển số ${p}`,
  },
  en: {
    dqSubtitle: 'Gaps found while building golden vehicle records', dqQueue: 'Work queue', dqAllTypes: 'All issues', dqIssue: 'Issue', dqVehicle: 'Vehicle', dqSource: 'Source', dqAge: 'Age',
    dqAssignee: 'Assignee', dqUnassigned: 'Unassigned', dqResolveBtn: 'Resolve…', dqAssignMe: 'Assign to me', dqAssign: 'Assign to…', dqUnassign: 'Unassign', dqDismiss: 'Dismiss…', dqOpen360: 'Open Customer 360',
    dqOpenIssues: 'Open issues', dqHigh: 'High severity', dqVehicles: 'Issue types', dqTypesHint: (n) => `${n} issue types`,
    sevHigh: 'High', sevMedium: 'Medium', sevLow: 'Low', severity: 'Severity',
    bulkAssign: 'Assign', bulkDismiss: 'Dismiss', assignTitle: (n) => `Assign ${n} issue${n === 1 ? '' : 's'}`, dismissTitle: (n) => `Dismiss ${n} issue${n === 1 ? '' : 's'}`, fAssignee: 'Assign to', fReason: 'Reason', fNote: 'Note', fNoteHelp: 'Saved with the decision in the audit trail',
    assigned: (n) => `${n} issue${n === 1 ? '' : 's'} assigned`, dismissed: (n) => `${n} issue${n === 1 ? '' : 's'} dismissed`, resolved: 'Issue resolved', confirmAssign: 'Assign', confirmDismiss: 'Dismiss issues',
    dReasonFalse: 'False positive', dReasonDup: 'Duplicate of another issue', dReasonSold: 'Vehicle sold or deregistered', dReasonFleet: 'Company vehicle, handled by the fleet team', dReasonOther: 'Other reason',
    secIssue: 'Issue', secCompare: 'Two sources disagree', secCurrent: 'Current values', secLineage: 'Data lineage', secResolve: 'Resolution',
    kType: 'Issue type', kDetected: 'Detected', kSource: 'Source', kRecords: 'Source records', kExpiry: 'Expiry date', kMethod: 'Evidence', kConfidence: 'Confidence', kInsurer: 'Insurer',
    kCategory: 'Vehicle type', kPhones: 'Phone numbers', kOwner: 'Owner', kRegion: 'Province', kCandidates: 'Expiry dates on file', kSources: 'Contributing sources',
    verifiedRecord: 'Verified record', customerSays: 'Customer says', saysRenewed: 'Renewed with another insurer', otherInsurer: 'Another insurer', reportedOn: 'Reported', statement: 'Customer statement',
    oConfirm: 'Confirm current value', oConfirmD: 'The value on record is correct; nothing changes', oCorrect: 'Correct with evidence', oCorrectD: 'Update the value and keep the evidence',
    oMerge: 'Merge duplicates', oMergeD: 'Keep one correct value; the others are retired', oDismiss: 'Dismiss with a reason', oDismissD: 'No action needed; record why',
    oKeepVerified: 'Keep the verified record', oKeepVerifiedD: 'The certificate stands; the statement is unproven', oAcceptClaim: 'Accept the customer’s statement', oAcceptClaimD: 'There is evidence of a renewal elsewhere',
    fEvidence: 'Evidence type', fEvidenceRef: 'Evidence reference', fEvidenceRefHelp: 'Certificate number, call reference or file name', fNewExpiry: 'Correct expiry date', fNewInsurer: 'Insurer',
    fNewCategory: 'Correct vehicle type', fNewPhone: 'Correct phone number', fNewName: 'Correct full name', fKeepPhone: 'Phone number to keep', fNewPlate: 'Correct plate',
    evCert: 'Photo of the insurance certificate', evInsurer: 'Confirmation from the insurer', evCall: 'Verification call with the owner', evInspection: 'Inspection record', evRegistration: 'Vehicle registration', evCore: 'TASCO core lookup',
    resolveIssue: 'Resolve issue', resolveConfirm: 'Confirm resolution', resolveSum: 'Check before saving', pickOption: 'Choose how to resolve this issue', vPhone: 'Enter a valid Vietnamese phone number', vRequired: 'This field is required',
    vDate: 'Invalid date (dd/mm/yyyy)', noLineage: 'No lineage recorded', inferred: 'Inferred from vehicle data', fieldPhone: 'Phone', fieldName: 'Name', fieldCategory: 'Vehicle type', fieldExpiry: 'Expiry date',
    emptyDq: 'No open issues', emptyDqHint: 'Data is clean for this filter.', issueOf: (p) => `Plate ${p}`, outcome: 'Outcome', notOnFile: 'Not on file',
    rConfirmed: 'Confirmed current value', rCorrected: 'Corrected', rMerged: 'Merged duplicates, kept', rDismissed: 'Dismissed', unknownRecord: 'Rejected source record', superseded: 'Superseded by a more trusted source', plateFilter: (p) => `Plate ${p}`,
  },
});

const SEVERITY = {
  reliable_expiry: 'high', unverified_renewal_claim: 'high', conflicting_phone: 'high', wrong_person: 'high', plate_mismatch: 'high',
  phone: 'medium', current_insurer: 'medium', invalid_plate: 'medium', name: 'low', vehicle_category: 'low',
};
const SEV_RANK = { high: 0, medium: 1, low: 2 };
const SEV_TONE = { high: 'danger', medium: 'warn', low: 'info' };
const sevOf = (type) => SEVERITY[type] || 'medium';
const sevLabel = (s) => t(s === 'high' ? 'sevHigh' : s === 'low' ? 'sevLow' : 'sevMedium');
const sevBadge = (type) => badge(sevLabel(sevOf(type)), SEV_TONE[sevOf(type)], { dot: true });
const INSURERS = ['TASCO', 'Bảo Việt', 'PVI', 'PTI', 'PJICO', 'BIC', 'MIC', 'OTHER'];
const insurerLabel = (v) => (v === 'OTHER' ? t('otherInsurer') : v || '—');
const EVIDENCE = ['evCert', 'evInsurer', 'evCall', 'evInspection', 'evRegistration', 'evCore'];
const DISMISS = ['dReasonFalse', 'dReasonDup', 'dReasonSold', 'dReasonFleet', 'dReasonOther'];
const CATEGORIES = ['car_under6', 'car_6_11', 'car_12_24', 'car_over24', 'pickup_van', 'commercial_under6', 'commercial_6_8', 'truck_under3t', 'truck_3_8t', 'truck_8_15t', 'truck_over15t'];
const FIELD_LABEL = { phone: 'fieldPhone', name: 'fieldName', 'vehicle.category': 'fieldCategory', 'policy.expiryDate': 'fieldExpiry' };

/** "VETC account import · 07/10/2026" — business source name and date (partner name for partner API batches). */
function originText(o) {
  if (!o) return t('unknownRecord');
  const name = o.source === 'partner_api' && o.partnerName ? `${o.partnerName} · ${sourceName('partner_api')}` : sourceName(o.source);
  return o.at ? `${name} · ${formatDate(o.at)}` : name;
}
/** Lineage source like "inspection_cycle (vetc_account)" → "Inspection cycle · VETC account import". */
function lineageSource(l) {
  if (l.field === 'vehicle.category') return h('span', { title: l.source }, t('inferred'));
  const m = /^([a-z_]+)(?: \((.+)\))?$/.exec(String(l.source || ''));
  if (!m) return sourceName(l.source);
  if (m[2]) return `${label('method', m[1])} · ${sourceName(m[2])}`;
  return hasLabel('method', m[1]) ? label('method', m[1]) : sourceName(m[1]);
}

/** Source as two lines: business name, then the date. */
function originCell(o) {
  if (!o) return h('span', { class: 'muted' }, t('unknownRecord'));
  const name = o.source === 'partner_api' && o.partnerName ? o.partnerName : sourceName(o.source);
  const sub = [o.source === 'partner_api' && o.partnerName ? sourceName('partner_api') : null, o.at ? formatDate(o.at) : null].filter(Boolean).join(' · ');
  return h('div', { class: 'wf-origin' }, h('span', {}, name), sub ? h('span', { class: 'cell-sub' }, sub) : null);
}

function optionCard(name, value, title, desc, fields) {
  const inp = h('input', { type: 'radio', name, value });
  const fieldsBox = h('div', { class: 'wf-option-fields', hidden: true }, fields || null);
  const el = h('label', { class: 'wf-option' }, inp, h('span', {}, h('span', { class: 'wf-option-title' }, title), h('span', { class: 'wf-option-desc' }, desc), fields ? fieldsBox : null));
  el.input = inp;
  el.fieldsBox = fieldsBox;
  return el;
}

/** Resolve options per issue type: field-aware correction inputs + evidence. */
function resolutionForm(issue, profile) {
  const type = issue.type;
  const group = `res-${Math.random().toString(36).slice(2, 8)}`;
  const evidence = () => selectInput([['', '—'], ...EVIDENCE.map((k) => [k, t(k)])], '');
  const f = {};
  const opts = [];
  const add = (value, title, desc, fields) => { const o = optionCard(group, value, title, desc, fields); opts.push(o); return o; };
  const reasonSel = selectInput([['', '—'], ...DISMISS.map((k) => [k, t(k)])], '');
  const dismissNote = textarea({ rows: 2, maxlength: '300' });
  f.dismiss = { reason: formField({ label: t('fReason'), control: reasonSel, required: true }), note: formField({ label: t('fNote'), control: dismissNote, optional: true, help: t('fNoteHelp') }) };

  if (type === 'unverified_renewal_claim') {
    const ev = evidence();
    f.confirm = { evidence: formField({ label: t('fEvidence'), control: ev, required: true }) };
    add('confirmed', t('oKeepVerified'), t('oKeepVerifiedD'), [f.confirm.evidence]);
  } else if (!['phone', 'name', 'invalid_plate'].includes(type)) {
    const ev = evidence();
    f.confirm = { evidence: formField({ label: t('fEvidence'), control: ev, required: true }) };
    add('confirmed', t('oConfirm'), t('oConfirmD'), [f.confirm.evidence]);
  }

  // Correction inputs depend on the field the issue is about.
  const ev2 = evidence();
  const ref = input({ maxlength: '120', autocomplete: 'off' });
  const evFields = [formField({ label: t('fEvidence'), control: ev2, required: true }), formField({ label: t('fEvidenceRef'), control: ref, optional: true, help: t('fEvidenceRefHelp') })];
  let correct = null;
  if (['reliable_expiry', 'current_insurer', 'unverified_renewal_claim'].includes(type)) {
    const date = dateInput({ value: type === 'unverified_renewal_claim' ? '' : (profile?.expiryDate || '') });
    const ins = selectInput([['', '—'], ...INSURERS.map((v) => [v, insurerLabel(v)])], type === 'unverified_renewal_claim' ? 'OTHER' : (profile?.insurer || ''));
    correct = { kind: 'expiry', date, ins, fields: [h('div', { class: 'form-grid' }, formField({ label: t('fNewExpiry'), control: date, required: true }), formField({ label: t('fNewInsurer'), control: ins, required: type !== 'reliable_expiry' }))] };
  } else if (type === 'vehicle_category') {
    const cat = selectInput([['', '—'], ...CATEGORIES.map((c) => [c, label('category', c)])], profile?.category || '');
    correct = { kind: 'category', cat, fields: [formField({ label: t('fNewCategory'), control: cat, required: true })] };
  } else if (type === 'phone' || type === 'wrong_person') {
    const ph = input({ type: 'tel', inputmode: 'tel', maxlength: '15', autocomplete: 'off', placeholder: '09xx xxx xxx' });
    correct = { kind: 'phone', ph, fields: [formField({ label: t('fNewPhone'), control: ph, required: true })] };
  } else if (type === 'name') {
    const nm = input({ maxlength: '120', autocomplete: 'off' });
    correct = { kind: 'name', nm, fields: [formField({ label: t('fNewName'), control: nm, required: true })] };
  } else if (type === 'invalid_plate' || type === 'plate_mismatch') {
    const pl = input({ maxlength: '15', autocomplete: 'off', placeholder: '30E-949.35' });
    correct = { kind: 'plate', pl, fields: [formField({ label: t('fNewPlate'), control: pl, required: true })] };
  }
  if (correct) {
    f.correct = { ...correct, ev: ev2, ref, evField: evFields[0] };
    add('corrected', type === 'unverified_renewal_claim' ? t('oAcceptClaim') : t('oCorrect'), type === 'unverified_renewal_claim' ? t('oAcceptClaimD') : t('oCorrectD'), [...correct.fields, h('div', { class: 'form-grid' }, evFields)]);
  }
  if (type === 'conflicting_phone' && (profile?.phones || []).length > 1) {
    const keep = selectInput(profile.phones.map((p) => [p, p]), profile.phones[0]);
    f.merge = { keep };
    add('merged', t('oMerge'), t('oMergeD'), [formField({ label: t('fKeepPhone'), control: keep, required: true })]);
  }
  add('dismissed', t('oDismiss'), t('oDismissD'), [f.dismiss.reason, f.dismiss.note]);

  const syncOpen = () => opts.forEach((o) => { o.fieldsBox.hidden = !o.input.checked; });
  opts.forEach((o) => o.input.addEventListener('change', syncOpen));
  const error = h('div', { class: 'error', role: 'alert' });
  const el = h('div', { class: 'stack-sm' }, h('div', { class: 'wf-options', role: 'radiogroup', 'aria-label': t('secResolve') }, opts), error);

  /** Validate and describe the chosen resolution → {outcome, resolution, evidence, correction?, summary[]}, or null. */
  el.collect = () => {
    const chosen = opts.find((o) => o.input.checked)?.input.value;
    mount(error, null);
    el.querySelectorAll('.field').forEach((x) => x.setError?.(null));
    if (!chosen) { mount(error, icon('alert-circle', { size: 14 }), t('pickOption')); return null; }
    const req = (fieldEl, ok) => { if (!ok) fieldEl.setError(t('vRequired')); return ok; };
    if (chosen === 'confirmed') {
      const ev = f.confirm.evidence.querySelector('select').value;
      if (!req(f.confirm.evidence, ev)) return null;
      return { outcome: 'confirmed', resolution: `${t('rConfirmed')} — ${t(ev)}`, evidence: t(ev), summary: [[t('outcome'), t('oConfirm')], [t('fEvidence'), t(ev)]] };
    }
    if (chosen === 'dismissed') {
      const r = f.dismiss.reason.querySelector('select').value;
      if (!req(f.dismiss.reason, r)) return null;
      const note = dismissNote.value.trim();
      return { outcome: 'dismissed', resolution: `${t('rDismissed')}: ${t(r)}${note ? ` — ${note}` : ''}`, summary: [[t('outcome'), t('oDismiss')], [t('fReason'), t(r)], note ? [t('fNote'), note] : null].filter(Boolean) };
    }
    if (chosen === 'merged') {
      return { outcome: 'merged', resolution: `${t('rMerged')} ${f.merge.keep.value}`, summary: [[t('outcome'), t('oMerge')], [t('fKeepPhone'), f.merge.keep.value]] };
    }
    const c = f.correct;
    const ev = c.ev.value;
    const refv = c.ref.value.trim();
    let ok = req(c.evField, ev);
    const summary = [[t('outcome'), type === 'unverified_renewal_claim' ? t('oAcceptClaim') : t('oCorrect')]];
    let value = '';
    let correction = null;
    const fieldEl = (ctl) => ctl.closest('.field');
    if (c.kind === 'expiry') {
      const iso = c.date.isoValue;
      if (!iso) { fieldEl(c.date).setError(c.date.value ? t('vDate') : t('vRequired')); ok = false; }
      if (type !== 'reliable_expiry' && !c.ins.value) { fieldEl(c.ins).setError(t('vRequired')); ok = false; }
      value = `${formatDate(iso)}${c.ins.value ? ` · ${insurerLabel(c.ins.value)}` : ''}`;
      correction = { expiryDate: iso, insurer: c.ins.value || undefined };
      summary.push([t('fNewExpiry'), formatDate(iso)]);
      if (c.ins.value) summary.push([t('fNewInsurer'), insurerLabel(c.ins.value)]);
    } else if (c.kind === 'category') {
      if (!c.cat.value) { fieldEl(c.cat).setError(t('vRequired')); ok = false; }
      value = label('category', c.cat.value);
      summary.push([t('fNewCategory'), value]);
    } else if (c.kind === 'phone') {
      const digits = c.ph.value.replace(/\D/g, '');
      if (!/^(0|84)(3|5|7|8|9)\d{8}$/.test(digits)) { fieldEl(c.ph).setError(t('vPhone')); ok = false; }
      value = c.ph.value.trim();
      summary.push([t('fNewPhone'), value]);
    } else if (c.kind === 'name') {
      if (c.nm.value.trim().length < 2) { fieldEl(c.nm).setError(t('vRequired')); ok = false; }
      value = c.nm.value.trim();
      summary.push([t('fNewName'), value]);
    } else if (c.kind === 'plate') {
      if (c.pl.value.trim().length < 6) { fieldEl(c.pl).setError(t('vRequired')); ok = false; }
      value = c.pl.value.trim().toUpperCase();
      summary.push([t('fNewPlate'), value]);
    }
    if (!ok) return null;
    summary.push([t('fEvidence'), t(ev)]);
    if (refv) summary.push([t('fEvidenceRef'), refv]);
    const evidenceText = `${t(ev)}${refv ? ` (${refv})` : ''}`;
    return { outcome: 'corrected', resolution: `${t('rCorrected')}: ${value} — ${evidenceText}`, evidence: evidenceText, correction, summary };
  };
  return el;
}

function compareBlock(ctx) {
  const v = ctx.verified;
  const c = ctx.claimed;
  return h('div', { class: 'wf-compare' },
    h('div', { class: 'wf-compare-col ok' },
      h('h4', {}, icon('badge-check', { size: 16 }), t('verifiedRecord')),
      keyValueList([[t('kInsurer'), insurerLabel(v.insurer)], [t('kExpiry'), formatDate(v.expiryDate)], [t('kMethod'), label('method', v.method)], [t('kConfidence'), confidenceMeter(v.confidence)]], { columns: 1 })),
    h('div', { class: 'wf-compare-col warn' },
      h('h4', {}, icon('phone-call', { size: 16 }), t('customerSays')),
      keyValueList([[t('kInsurer'), t('saysRenewed')], [t('statement'), c.note ? `“${c.note}”` : null], [t('kSource'), `${sourceName('voice_bot')} · ${formatDate(c.at)}`], [t('kConfidence'), confidenceMeter(c.confidence)]], { columns: 1 })));
}

function currentValues(issue, p) {
  if (!p) return emptyState({ icon: 'database', title: t('unknownRecord'), compact: true });
  const rows = [[t('kOwner'), p.owner], [t('kRegion'), p.province]];
  if (['reliable_expiry', 'current_insurer', 'unverified_renewal_claim'].includes(issue.type)) {
    rows.push([t('kExpiry'), p.expiryDate ? formatDate(p.expiryDate) : t('notOnFile')], [t('kMethod'), p.expiryMethod ? label('method', p.expiryMethod) : null],
      [t('kConfidence'), confidenceMeter(p.expiryConfidence)], [t('kInsurer'), p.insurer ? insurerLabel(p.insurer) : t('notOnFile')]);
  }
  if (issue.type === 'vehicle_category') rows.push([t('kCategory'), p.category ? label('category', p.category) : null], [t('kConfidence'), confidenceMeter(p.categoryConfidence)]);
  if (['phone', 'conflicting_phone', 'wrong_person'].includes(issue.type)) rows.push([t('kPhones'), p.phones.length ? h('div', {}, p.phones.map((x) => h('div', { class: 'nowrap' }, x))) : t('notOnFile')]);
  rows.push([t('kSources'), (p.sources || []).map(sourceName).join(', ')], [t('kRecords'), formatNumber(p.records)]);
  const cands = (p.expiryCandidates || []).filter((x) => x.date);
  return h('div', { class: 'stack' }, keyValueList(rows, { columns: 2 }),
    issue.type === 'reliable_expiry' && cands.length ? h('div', { class: 'stack-sm' }, h('span', { class: 'muted small' }, t('kCandidates')),
      h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, cands.map((x) => h('tr', {}, h('td', { class: 'nowrap' }, formatDate(x.date)), h('td', {}, label('method', x.method)), h('td', {}, confidenceMeter(x.confidence)))))))) : null);
}

function lineageList(lineage) {
  const rows = lineage.filter((l) => FIELD_LABEL[l.field]);
  if (!rows.length) return emptyState({ icon: 'layers', title: t('noLineage'), compact: true });
  return h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, rows.map((l) => h('tr', {},
    h('td', { class: 'nowrap' }, t(FIELD_LABEL[l.field])), h('td', {}, lineageSource(l), l.superseded ? h('span', { class: 'cell-sub' }, t('superseded')) : null), h('td', { class: 'nowrap' }, confidenceMeter(l.confidence)))))));
}

export default {
  perm: 'dq:read',
  async render(main, ctx) {
    const { api, route, can, user, refreshSignals, navigate } = ctx;
    const canResolve = can('dq:resolve');
    const technical = (user?.roles || []).some((r) => ['admin', 'support_engineer', 'auditor'].includes(r));
    // ?q=<plate> (from Customer 360) pre-filters the queue to one vehicle; the profile id is the compact plate.
    const plateKey = String(route.query.q || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    const state = { type: route.query.type || '', offset: 0, limit: 25, plate: plateKey };
    const scope = () => (state.plate ? `&profileId=${encodeURIComponent(state.plate)}` : '');
    const hashFor = () => {
      const q = new URLSearchParams();
      if (state.type) q.set('type', state.type);
      if (state.plate) q.set('q', state.plate);
      return `#/dq${q.toString() ? `?${q}` : ''}`;
    };
    let assignees = [];
    if (canResolve) { try { assignees = await api.get('/api/dq/assignees'); } catch { assignees = []; } }
    let data = await api.get(`/api/dq/issues?status=open&limit=${state.limit}${state.type ? `&type=${encodeURIComponent(state.type)}` : ''}${scope()}`);
    let totals = state.type ? (await api.get(`/api/dq/issues?status=open&limit=1${scope()}`)).byType : data.byType;

    const load = async () => {
      const q = new URLSearchParams({ status: 'open', limit: String(state.limit), offset: String(state.offset) });
      if (state.type) q.set('type', state.type);
      if (state.plate) q.set('profileId', state.plate);
      data = await api.get(`/api/dq/issues?${q}`);
      if (!state.type) totals = data.byType;
    };
    const refreshAll = async () => {
      const all = await api.get(`/api/dq/issues?status=open&limit=1${scope()}`);
      totals = all.byType;
      await load();
      paint();
      refreshSignals?.();
    };

    const bulk = async (ids, body, msgKey) => {
      const r = await api.post('/api/dq/issues/bulk', { ids, ...body });
      toast(t(msgKey, formatNumber(r.updated)), 'ok');
      await refreshAll();
      return r;
    };
    const assignDialog = (rows) => decisionDialog({
      title: t('assignTitle', rows.length), confirmLabel: t('confirmAssign'), size: 'sm',
      fields: [{ name: 'assignee', label: t('fAssignee'), required: true, control: selectInput([['', '—'], ...assignees.map((u) => [u.id, u.roles?.length ? `${u.displayName} · ${u.roles.map((r) => label('role', r)).join(', ')}` : u.displayName])], ''), summary: (v) => assignees.find((u) => u.id === v)?.displayName || v }],
      onSubmit: (v) => bulk(rows.map((r) => r.id), { action: 'assign', assignee: v.assignee }, 'assigned'),
    });
    const dismissDialog = (rows) => decisionDialog({
      title: t('dismissTitle', rows.length), confirmLabel: t('confirmDismiss'), danger: true,
      fields: [
        { name: 'reason', label: t('fReason'), required: true, control: selectInput([['', '—'], ...DISMISS.map((k) => [k, t(k)])], ''), summary: (v) => t(v) },
        { name: 'note', label: t('fNote'), optional: true, help: t('fNoteHelp'), control: textarea({ rows: 2, maxlength: '300' }) },
      ],
      onSubmit: (v) => bulk(rows.map((r) => r.id), { action: 'dismiss', reason: `${t(v.reason)}${v.note ? ` — ${v.note}` : ''}` }, 'dismissed'),
    });
    const me = assignees.find((u) => u.id === user?.id);

    async function openResolve(row) {
      let d;
      try { d = await api.get(`/api/dq/issues/${encodeURIComponent(row.id)}`); } catch (e) { errorToast(e); return; }
      const form = canResolve ? resolutionForm(d, d.profile) : null;
      const plate = d.vehicle?.plate || d.profile?.plate;
      const dr = drawer({
        title: label('dq', d.type), subtitle: plate ? `${formatPlate(plate)}${d.vehicle?.owner ? ` · ${d.vehicle.owner}` : ''}` : t('unknownRecord'), size: 'lg', headerExtra: sevBadge(d.type),
        body: [
          h('section', { class: 'wf-section' }, h('h3', {}, t('secIssue')), keyValueList([
            [t('kType'), label('dq', d.type)], [t('severity'), sevBadge(d.type)], [t('kSource'), originText(d.origin)], [t('kDetected'), formatRelative(d.detectedAt)],
            [t('dqAssignee'), d.assigneeName || h('span', { class: 'muted' }, t('dqUnassigned'))],
          ], { columns: 2 })),
          d.context ? h('section', { class: 'wf-section' }, h('h3', {}, t('secCompare')), compareBlock(d.context)) : null,
          h('section', { class: 'wf-section' }, h('h3', {}, t('secCurrent')), currentValues(d, d.profile)),
          h('section', { class: 'wf-section' }, h('h3', {}, t('secLineage')), lineageList(d.lineage || [])),
          form ? h('section', { class: 'wf-section' }, h('h3', {}, t('secResolve')), form) : null,
          technical ? h('section', { class: 'wf-section' }, technicalDetails(keyValueList([['Issue id', d.id], ['Batch', d.batchId || '—'], ['Record', d.recordId || '—']], { columns: 1, inline: true }))) : null,
        ],
        footer: [
          can('profile:read') && d.profileId ? button({ label: t('dqOpen360'), icon: 'external-link', variant: 'ghost', onClick: () => { dr.close(); navigate(`customer/${encodeURIComponent(d.profileId)}`); } }) : null,
          h('span', { class: 'grow' }),
          button({ label: t('cancel'), onClick: () => dr.close() }),
          form ? button({ label: t('resolveIssue'), variant: 'primary', icon: 'check', onClick: async () => {
            const r = form.collect();
            if (!r) return;
            const ok = await confirmDialog(t('resolveSum'), h('div', {}, keyValueList(r.summary, { columns: 1, inline: true })), t('resolveConfirm'), { danger: r.outcome === 'dismissed' });
            if (!ok) return;
            try {
              if (r.correction && can('profile:update') && d.profileId) {
                await api.patch(`/api/customers/${encodeURIComponent(d.profileId)}/expiry`, { expiryDate: r.correction.expiryDate, ...(r.correction.insurer ? { insurer: r.correction.insurer } : {}), evidence: r.evidence.slice(0, 300) });
              }
              await api.post(`/api/dq/issues/${encodeURIComponent(d.id)}/resolve`, { resolution: r.resolution.slice(0, 500), outcome: r.outcome, ...(r.evidence ? { evidence: r.evidence.slice(0, 300) } : {}) });
              toast(t('resolved'), 'ok', { title: label('dq', d.type) });
              dr.close();
              await refreshAll();
            } catch (e) { errorToast(e); }
          } }) : null,
        ],
      });
      focusTop(dr);
    }

    const columns = [
      { key: 'type', label: t('dqIssue'), render: (i) => h('div', { class: 'wf-issue' }, h('span', { class: 'wf-issue-name' }, label('dq', i.type)), sevBadge(i.type)), exportValue: (i) => label('dq', i.type) },
      { key: 'vehicle', label: t('dqVehicle'), render: (i) => (i.vehicle ? vehicleCell(i.vehicle.plate, i.vehicle.owner) : h('span', { class: 'muted' }, t('unknownRecord'))), exportValue: (i) => (i.vehicle ? formatPlate(i.vehicle.plate) : '') },
      { key: 'origin', label: t('dqSource'), render: (i) => originCell(i.origin), exportValue: (i) => originText(i.origin) },
      { key: 'detectedAt', label: t('dqAge'), nowrap: true, render: (i) => h('span', { class: 'nowrap', title: formatDateTime(i.detectedAt) }, formatDuration(Date.now() - new Date(i.detectedAt).getTime())), value: (i) => i.detectedAt },
      { key: 'assignee', label: t('dqAssignee'), render: (i) => (i.assigneeName ? h('span', { class: 'wf-assignee' }, avatar(i.assigneeName, { size: 'sm' }), i.assigneeName) : h('span', { class: 'muted nowrap' }, t('dqUnassigned'))), exportValue: (i) => i.assigneeName || '' },
      { key: '_actions', label: '', align: 'right', render: (i) => rowActions({
        primary: canResolve ? { label: t('dqResolveBtn'), onClick: () => openResolve(i) } : { label: t('view'), muted: true, onClick: () => openResolve(i) },
        menu: [
          canResolve && me && i.assignee !== me.id ? { label: t('dqAssignMe'), icon: 'user-check', onClick: () => bulk([i.id], { action: 'assign', assignee: me.id }, 'assigned') } : null,
          canResolve ? { label: t('dqAssign'), icon: 'users', onClick: () => assignDialog([i]) } : null,
          canResolve && i.assignee ? { label: t('dqUnassign'), icon: 'x', onClick: () => bulk([i.id], { action: 'assign', assignee: '' }, 'assigned') } : null,
          can('profile:read') && i.profileId ? { label: t('dqOpen360'), icon: 'external-link', onClick: () => navigate(`customer/${encodeURIComponent(i.profileId)}`) } : null,
          canResolve ? { separator: true } : null,
          canResolve ? { label: t('dqDismiss'), icon: 'x-circle', danger: true, onClick: () => dismissDialog([i]) } : null,
        ].filter(Boolean),
      }) },
    ];

    /** Long drawers open at the top: focus the title instead of the first radio far below. */
    function focusTop(dr) {
      setTimeout(() => {
        const t2 = dr.el.querySelector('.drawer-header h2');
        if (t2) { t2.tabIndex = -1; t2.focus({ preventScroll: true }); }
        dr.body.scrollTop = 0;
      }, 60);
    }

    function clearPlate() {
      state.plate = ''; state.offset = 0;
      history.replaceState(null, '', hashFor());
      refreshAll().catch(errorToast);
    }

    function setType(type) {
      state.type = type; state.offset = 0;
      history.replaceState(null, '', hashFor());
      load().then(paint).catch(errorToast);
    }

    function paint() {
      const types = Object.entries(totals || {}).sort((a, b) => (SEV_RANK[sevOf(a[0])] - SEV_RANK[sevOf(b[0])]) || b[1] - a[1]);
      const total = types.reduce((s, [, n]) => s + n, 0);
      const high = types.filter(([k]) => sevOf(k) === 'high').reduce((s, [, n]) => s + n, 0);
      const chips = h('div', { class: 'wf-chip-row', role: 'group', 'aria-label': t('dqVehicles') },
        state.plate ? chip({ label: t('plateFilter', formatPlate(state.plate)), icon: 'x', selected: true, onClick: () => clearPlate() }) : null,
        chip({ label: t('dqAllTypes'), count: total, selected: !state.type, onClick: () => setType('') }),
        types.map(([k, n]) => {
          const c = chip({ label: label('dq', k), count: n, selected: state.type === k, onClick: () => setType(k) });
          c.prepend(h('span', { class: `sev ${sevOf(k)}`, title: `${t('severity')}: ${sevLabel(sevOf(k))}`, 'aria-hidden': 'true' }));
          c.setAttribute('aria-label', `${label('dq', k)}, ${formatNumber(n)}, ${t('severity')} ${sevLabel(sevOf(k))}`);
          return c;
        }));
      const table = dataTable({
        caption: t('dqQueue'), columns, rows: data.items, onRowClick: (i) => openResolve(i),
        selection: canResolve ? { selectable: true, bulkActions: [{ label: t('bulkAssign'), icon: 'user-check', onClick: (rows) => { assignDialog(rows); } }, { label: t('bulkDismiss'), icon: 'x-circle', onClick: (rows) => { dismissDialog(rows); } }] } : undefined,
        pagination: { total: data.total, limit: state.limit, offset: state.offset, onPage: (o) => { state.offset = o; load().then(paint).catch(errorToast); }, onLimit: (n) => { state.limit = n; state.offset = 0; load().then(paint).catch(errorToast); } },
        empty: { icon: 'check-circle', title: t('emptyDq'), text: t('emptyDqHint') },
      });
      mount(main,
        pageHeader({ title: t('dq'), subtitle: t('dqSubtitle') }),
        kpiStrip([
          kpiTile({ label: t('dqOpenIssues'), value: formatNumber(total), icon: 'database', hint: t('dqTypesHint', formatNumber(types.length)), onClick: () => setType('') }),
          kpiTile({ label: t('dqHigh'), value: formatNumber(high), icon: 'alert-triangle', hint: types.filter(([k]) => sevOf(k) === 'high').slice(0, 2).map(([k]) => label('dq', k)).join(' · ') }),
        ]),
        chips,
        card({ title: state.type ? label('dq', state.type) : t('dqQueue'), flush: true, class: 'wf-dense', actions: [badge(formatNumber(data.total), 'neutral'), button({ label: t('exportCsv'), icon: 'download', size: 'sm', onClick: () => downloadCsv('data-quality.csv',
          [t('dqIssue'), t('severity'), t('dqVehicle'), t('dqSource'), t('kDetected'), t('dqAssignee')],
          data.items.map((i) => [label('dq', i.type), sevLabel(sevOf(i.type)), i.vehicle ? formatPlate(i.vehicle.plate) : '', originText(i.origin), formatDate(i.detectedAt), i.assigneeName || ''])) })], body: table }));
    }
    paint();
  },
};
