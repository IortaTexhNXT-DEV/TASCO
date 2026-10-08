/**
 * Audit trail in business language: every action code recorded by the platform (grep
 * `audit.record({ action:` in src/) has a sentence template in English and Vietnamese, a business
 * category, an icon and a tone. Tokens: {actor} (person), {object} (business object, may be a link)
 * and detail tokens filled by vars(). Unknown codes fall back to a neutral sentence — never the code.
 */
import { h } from '../shared/dom.js';
import { label } from '../shared/i18n.js';
import { formatMoney, formatNumber, formatPlate, formatDate } from './ui.js';
import { tl, ruleTitle, systemActorName } from './gov-text.js';

/** Business activity categories (same keys as the API `category` filter). */
export const CATEGORIES = [
  { id: 'access', name: ['Sign-in & access', 'Đăng nhập & truy cập'], icon: 'key' },
  { id: 'customer', name: ['Customer data', 'Dữ liệu khách hàng'], icon: 'user' },
  { id: 'sales', name: ['Sales', 'Bán hàng'], icon: 'trending-up' },
  { id: 'rules', name: ['Rules', 'Quy tắc nghiệp vụ'], icon: 'scale' },
  { id: 'claims', name: ['Claims', 'Bồi thường'], icon: 'shield-check' },
  { id: 'partners', name: ['Partners', 'Đối tác'], icon: 'handshake' },
  { id: 'admin', name: ['Administration', 'Quản trị hệ thống'], icon: 'settings' },
];
const CAT_PREFIX = {
  access: ['auth.'], customer: ['profile.', 'customer.', 'consent.', 'dsar.', 'dq.', 'data.'], sales: ['quote.', 'order.', 'handoff.', 'voice.', 'journeys.', 'leads.', 'ecosystem.'],
  rules: ['rules.', 'catalogue.'], claims: ['claim.'], partners: ['partner.'], admin: ['user.', 'job.', 'demo.'],
};
export const categoryOf = (action) => Object.keys(CAT_PREFIX).find((c) => CAT_PREFIX[c].some((p) => String(action).startsWith(p))) || 'admin';
export const categoryName = (id) => tl(CATEGORIES.find((c) => c.id === id)?.name || ['Other', 'Khác']);
export const categoryIcon = (id) => CATEGORIES.find((c) => c.id === id)?.icon || 'circle-dot';

const yes = (v) => (v ? tl('yes', 'có') : tl('no', 'không'));
const JOB = {
  reconciliation: ['{actor} ran the daily reconciliation', '{actor} đã chạy đối soát hằng ngày'],
  retention: ['{actor} applied the data retention policy', '{actor} đã áp dụng chính sách lưu trữ dữ liệu'],
  relay: ['{actor} delivered pending platform events', '{actor} đã gửi các sự kiện hệ thống đang chờ'],
  catalogue_sync: ['{actor} synchronised the product catalogue with TASCO core', '{actor} đã đồng bộ danh mục sản phẩm với TASCO core'],
  voice_campaign: ['{actor} ran a voice assistant campaign', '{actor} đã chạy chiến dịch trợ lý giọng nói'],
};

/**
 * Sentence templates. Each: [en, vi] or (entry) => [en, vi]; tone (ok|warn|danger|info) and icon optional.
 */
const T = {
  'auth.login': { s: ['{actor} signed in', '{actor} đã đăng nhập'], icon: 'log-out' },
  'auth.login_failed': { s: (e) => (e.details?.reason === 'unknown_user' ? ['Failed sign-in with an unknown username', 'Đăng nhập thất bại với tên đăng nhập không tồn tại'] : ['Failed sign-in attempt for {object}', 'Đăng nhập không thành công cho {object}']), tone: 'warn', icon: 'alert-triangle' },
  'auth.login_locked': { s: ['{object}’s account was locked after repeated failed sign-ins', 'Tài khoản {object} bị khóa do đăng nhập sai nhiều lần'], tone: 'danger', icon: 'lock' },
  'auth.mfa_failed': { s: ['{actor} entered an incorrect verification code', '{actor} nhập sai mã xác thực'], tone: 'warn', icon: 'alert-triangle' },
  'auth.mfa_enrolled': { s: ['{actor} set up two-step verification', '{actor} đã thiết lập xác thực hai bước'], tone: 'ok', icon: 'shield-check' },
  'auth.password_changed': { s: ['{actor} changed their password', '{actor} đã đổi mật khẩu'], icon: 'key' },
  'user.created': { s: ['{actor} created the user account {object}', '{actor} đã tạo tài khoản {object}'], icon: 'user-cog' },
  'user.updated': { s: ['{actor} updated access for {object}', '{actor} đã cập nhật quyền truy cập của {object}'], icon: 'user-cog' },
  'user.reset': { s: ['{actor} reset sign-in for {object}', '{actor} đã đặt lại đăng nhập cho {object}'], icon: 'key' },
  'rules.seeded': { s: ['{object} loaded as the initial configuration', '{object} được nạp làm cấu hình ban đầu'], icon: 'scale' },
  'rules.draft_created': { s: ['{actor} created a draft of {object}', '{actor} đã tạo bản nháp {object}'], icon: 'edit' },
  'rules.draft_updated': { s: ['{actor} edited the draft {object}', '{actor} đã chỉnh sửa bản nháp {object}'], icon: 'edit' },
  'rules.submitted': { s: ['{actor} submitted {object} for approval', '{actor} đã gửi {object} để phê duyệt'], tone: 'info', icon: 'send' },
  'rules.withdrawn': { s: ['{actor} withdrew {object} from approval', '{actor} đã rút {object} khỏi phê duyệt'], icon: 'arrow-left' },
  'rules.approved': { s: ['{actor} approved {object}, which is now active', '{actor} đã phê duyệt {object} và áp dụng ngay'], tone: 'ok', icon: 'check-circle' },
  'rules.rejected': { s: ['{actor} rejected {object}', '{actor} đã từ chối {object}'], tone: 'danger', icon: 'x-circle' },
  'catalogue.sync_proposed': { s: ['TASCO core catalogue sync proposed {object}', 'Đồng bộ danh mục TASCO core đã đề xuất {object}'], tone: 'info', icon: 'refresh' },
  'profile.viewed': { s: ['{actor} viewed customer {object}', '{actor} đã xem hồ sơ khách hàng {object}'], icon: 'eye' },
  'profile.expiry_corrected': { s: ['{object}’s expiry date corrected by {actor}', 'Ngày hết hạn của {object} được {actor} điều chỉnh'], tone: 'info', icon: 'calendar' },
  'customer.expiry_declared': { s: ['{object} confirmed their expiry date in the VETC app', '{object} đã xác nhận ngày hết hạn trên ứng dụng VETC'], icon: 'calendar' },
  'consent.updated': { s: ['{object}’s contact preferences were updated', 'Tùy chọn liên hệ của {object} đã được cập nhật'], icon: 'bell' },
  'consent.withdrawn': { s: ['{object} asked not to be called again', '{object} yêu cầu không gọi lại'], tone: 'warn', icon: 'phone' },
  'dsar.access_exported': { s: ['{actor} exported the personal data of {object} (access request)', '{actor} đã xuất dữ liệu cá nhân của {object} (yêu cầu truy cập)'], tone: 'info', icon: 'download' },
  'dsar.erased': { s: ['{actor} erased the personal data of {object}', '{actor} đã xóa dữ liệu cá nhân của {object}'], tone: 'warn', icon: 'trash' },
  'dq.assigned': { s: ['{actor} assigned a data-quality issue', '{actor} đã phân công một vấn đề dữ liệu'], icon: 'user-check' },
  'dq.resolved': { s: (e) => (e.details?.outcome === 'dismissed' ? ['{actor} dismissed a data-quality issue', '{actor} đã bỏ qua một vấn đề dữ liệu'] : ['{actor} resolved a data-quality issue', '{actor} đã xử lý một vấn đề dữ liệu']), tone: 'ok', icon: 'database' },
  'data.ingested': { s: ['{actor} imported {records} records from {source}', '{actor} đã nhập {records} bản ghi từ {source}'], icon: 'upload' },
  'ecosystem.event_handled': { s: ['VETC event handled for {object}: {event}', 'Đã xử lý sự kiện VETC cho {object}: {event}'], icon: 'zap' },
  'leads.recomputed': { s: (e) => (e.details?.count === 1 ? ['{actor} recalculated the lead score of one customer', '{actor} đã tính lại điểm cho một khách hàng'] : ['{actor} recalculated lead scores for {count} customers', '{actor} đã tính lại điểm cho {count} khách hàng']), icon: 'refresh' },
  'journeys.run': { s: ['{actor} sent the journey messages due on {date}', '{actor} đã gửi các tin nhắn hành trình đến hạn ngày {date}'], icon: 'route' },
  'voice.call_completed': { s: ['Voice assistant call with {object} ended: {outcome}', 'Cuộc gọi trợ lý giọng nói với {object} kết thúc: {outcome}'], icon: 'bot' },
  'handoff.updated': { s: ['{actor} updated a telesales handoff: {status}', '{actor} đã cập nhật yêu cầu telesales: {status}'], icon: 'inbox' },
  'quote.created': { s: ['{actor} prepared a quote of {total} for {customer}', '{actor} đã lập báo giá {total} cho {customer}'], icon: 'file-text' },
  'quote.rerated': { s: ['Quote re-priced by TASCO core: {previousTotal} → {total}', 'Báo giá được TASCO core tính lại: {previousTotal} → {total}'], icon: 'refresh' },
  'quote.inspection_recorded': { s: ['{actor} recorded a vehicle inspection: {passed}', '{actor} đã ghi nhận kết quả giám định xe: {passed}'], icon: 'clipboard-check' },
  'quote.sent_to_customer': { s: ['{actor} sent a quote to {customer}', '{actor} đã gửi báo giá cho {customer}'], tone: 'info', icon: 'send' },
  'order.completed': { s: ['Order of {amount} paid and policy issued', 'Đơn hàng {amount} đã thanh toán và cấp đơn'], tone: 'ok', icon: 'badge-check' },
  'order.payment_failed': { s: ['Payment failed for an order', 'Thanh toán đơn hàng không thành công'], tone: 'danger', icon: 'credit-card' },
  'order.issuance_failed': { s: ['Policy could not be issued after payment', 'Không cấp được đơn sau khi thanh toán'], tone: 'danger', icon: 'alert-circle' },
  'claim.submitted': { s: ['New claim {object} reported in the VETC app', 'Hồ sơ bồi thường {object} được báo trên ứng dụng VETC'], tone: 'info', icon: 'shield-check' },
  'claim.status_changed': { s: ['{actor} moved claim {object} from {from} to {to}', '{actor} chuyển hồ sơ bồi thường {object} từ {from} sang {to}'], icon: 'shield-check' },
  'claim.note_added': { s: ['{actor} added a note to claim {object}', '{actor} đã thêm ghi chú cho hồ sơ {object}'], icon: 'message-square' },
  'partner.created': { s: ['{actor} onboarded partner {object}', '{actor} đã thêm đối tác {object}'], icon: 'handshake' },
  'partner.status_changed': { s: ['{actor} set partner {object} to {status}', '{actor} chuyển đối tác {object} sang {status}'], icon: 'handshake' },
  'partner.api_key_issued': { s: ['{actor} issued an API key to {object}', '{actor} đã cấp khóa API cho {object}'], icon: 'key' },
  'partner.api_key_revoked': { s: ['{actor} revoked an API key of {object}', '{actor} đã thu hồi khóa API của {object}'], tone: 'warn', icon: 'key' },
  'demo.accounts_synced': { s: ['Demo accounts synchronised', 'Đã đồng bộ tài khoản demo'], icon: 'users' },
};

/** Action codes with a sentence (used by tests / coverage checks). */
export const ACTION_CODES = [...Object.keys(T), ...Object.keys(JOB).map((k) => `job.${k}`)];

const objectNames = {
  claim: ['claim', 'hồ sơ bồi thường'], quote: ['a quote', 'một báo giá'], order: ['an order', 'một đơn hàng'], handoff: ['a telesales handoff', 'một yêu cầu telesales'],
  dq_issue: ['a data-quality issue', 'một vấn đề dữ liệu'], job: ['a scheduled job', 'một tác vụ'], batch: ['a data import', 'một lần nhập dữ liệu'], leads: ['lead scores', 'điểm khách hàng'],
  user: ['a user', 'một người dùng'], partner: ['a partner', 'một đối tác'], profile: ['a customer', 'một khách hàng'], ruleset: ['a rule set', 'một bộ quy tắc'],
};

/** Person who acted, as shown to business users. */
export const actorDisplay = (e) => e.actorDisplayName || (e.actorName && e.actorName !== e.actor ? String(e.actorName).replace(/\s*\([a-z0-9._-]+\)$/, '') : systemActorName(e.actor));
export const actorRoleText = (e) => (e.actorRoles?.length ? e.actorRoles.map((r) => label('role', r)).join(', ') : (String(e.actor || '').startsWith('U-') ? '' : tl('Automated', 'Tự động')));

/** Business object of an entry: { text, href? }. */
export function objectOf(e, { can } = {}) {
  const id = e.entityId;
  switch (e.entityType) {
    case 'ruleset': return id ? { text: ruleTitle(id), href: `#/rules/${encodeURIComponent(id)}` } : { text: tl(objectNames.ruleset) };
    case 'profile': {
      const plate = e.entityPlate ? formatPlate(e.entityPlate) : id ? formatPlate(id) : '';
      const text = e.entityLabel ? `${e.entityLabel} (${plate})` : plate || tl(objectNames.profile);
      return { text, href: id && can?.('profile:read') ? `#/customer/${encodeURIComponent(id)}` : null };
    }
    case 'user': return { text: e.entityLabel || (e.entityId === e.actor ? actorDisplay(e) : tl(objectNames.user)) };
    case 'partner': return { text: e.entityLabel || tl(objectNames.partner) };
    case 'claim': return { text: id || tl(objectNames.claim), href: can?.('claims:read') ? '#/claims' : null };
    default: return { text: objectNames[e.entityType] ? tl(objectNames[e.entityType]) : '' };
  }
}

const ECO = {
  'vetc.tag_activated': ['ETC tag activated', 'kích hoạt thẻ ETC'], 'vetc.inspection_booked': ['inspection booked', 'đặt lịch đăng kiểm'],
  'vetc.wallet_topped_up': ['wallet topped up', 'nạp tiền ví'], 'vetc.long_trip_started': ['long trip started', 'bắt đầu chuyến đi dài'],
};

function vars(e) {
  const d = e.details || {};
  const v = {};
  if (d.records !== undefined) v.records = formatNumber(d.records);
  if (d.source) v.source = String(d.source).replace(/_/g, ' ');
  if (d.count !== undefined) v.count = formatNumber(d.count);
  if (d.date) v.date = formatDate(d.date);
  if (d.outcome !== undefined) v.outcome = label('outcome', d.outcome);
  if (d.status) v.status = label('status', d.status);
  if (d.type) v.event = ECO[d.type] ? tl(ECO[d.type]) : String(d.type).replace(/^vetc\./, '').replace(/_/g, ' ');
  if (d.total !== undefined) v.total = formatMoney(d.total);
  if (d.previousTotal !== undefined) v.previousTotal = formatMoney(d.previousTotal);
  if (d.amount !== undefined) v.amount = formatMoney(d.amount);
  if (d.passed !== undefined) v.passed = d.passed ? tl('passed', 'đạt') : tl('not passed', 'không đạt');
  if (d.from) v.from = label('status', d.from);
  if (d.to) v.to = label('status', d.to);
  v.customer = d.profileId ? formatPlate(d.profileId) : tl('a customer', 'một khách hàng');
  return v;
}

function template(e) {
  const action = String(e.action || '');
  if (action.startsWith('job.')) return { s: JOB[action.slice(4)] || ['{actor} ran a scheduled job', '{actor} đã chạy một tác vụ định kỳ'], icon: 'activity' };
  return T[action] || { s: ['{actor} performed an action on {object}', '{actor} đã thực hiện thao tác trên {object}'], icon: 'circle-dot' };
}

/**
 * Sentence for an entry. mode 'node' returns DOM (object as a link when allowed), 'text' a plain string.
 * @returns {Node|string}
 */
export function sentence(e, { can, mode = 'node' } = {}) {
  const tp = template(e);
  const pair = typeof tp.s === 'function' ? tp.s(e) : tp.s;
  const str = tl(pair[0], pair[1]);
  const v = { actor: actorDisplay(e), ...vars(e) };
  const obj = objectOf(e, { can });
  const parts = str.split(/(\{\w+\})/g).filter((p) => p !== '');
  const out = parts.map((p) => {
    const m = /^\{(\w+)\}$/.exec(p);
    if (!m) return p;
    if (m[1] === 'object') {
      const text = obj.text || tl('an item', 'một mục');
      if (mode === 'text') return text;
      return obj.href ? h('a', { href: obj.href, class: 'audit-obj', onclick: (ev) => ev.stopPropagation() }, text) : h('strong', { class: 'audit-obj' }, text);
    }
    if (m[1] === 'actor') return mode === 'text' ? v.actor : h('strong', {}, v.actor);
    return v[m[1]] ?? '—';
  });
  if (mode === 'text') return out.join('');
  return h('span', { class: 'audit-sentence' }, out);
}
export const toneOf = (e) => template(e).tone || '';
export const iconOf = (e) => template(e).icon || 'circle-dot';

/**
 * Before / after rows for the detail drawer: [[label, before, after]]; and plain detail rows [[label, value]].
 * Technical keys (ids, hashes, ip) are left for the technical section.
 */
export function changeRows(e) {
  const d = e.details || {};
  const rows = [];
  switch (e.action) {
    case 'claim.status_changed': rows.push([tl('Status', 'Trạng thái'), label('status', d.from), label('status', d.to)]); break;
    case 'quote.rerated': rows.push([tl('Total premium', 'Tổng phí'), formatMoney(d.previousTotal), formatMoney(d.total)]); break;
    case 'rules.approved': rows.push([tl('Active version', 'Phiên bản áp dụng'), (d.supersedes || []).map(ruleTitle).join(', ') || '—', ruleTitle(e.entityId)]); break;
    case 'rules.rejected': rows.push([tl('Status', 'Trạng thái'), tl('Awaiting approval', 'Chờ phê duyệt'), tl('Rejected', 'Bị từ chối')]); break;
    case 'rules.submitted': rows.push([tl('Status', 'Trạng thái'), tl('Draft', 'Bản nháp'), tl('Awaiting approval', 'Chờ phê duyệt')]); break;
    case 'rules.withdrawn': rows.push([tl('Status', 'Trạng thái'), tl('Awaiting approval', 'Chờ phê duyệt'), tl('Draft', 'Bản nháp')]); break;
    case 'handoff.updated': rows.push([tl('Status', 'Trạng thái'), '—', label('status', d.status)]); break;
    case 'partner.status_changed': rows.push([tl('Status', 'Trạng thái'), '—', label('status', d.status)]); break;
    case 'user.updated':
      if (d.roles) rows.push([tl('Roles', 'Vai trò'), '—', d.roles.map((r) => label('role', r)).join(', ')]);
      if (d.region) rows.push([tl('Region', 'Khu vực'), '—', d.region === 'ALL' ? tl('All regions', 'Tất cả khu vực') : d.region]);
      if (d.status) rows.push([tl('Account status', 'Trạng thái tài khoản'), '—', label('status', d.status)]);
      break;
    case 'consent.updated':
      for (const [k, val] of Object.entries(d)) if (typeof val === 'boolean') rows.push([consentName(k), '—', yes(val)]);
      break;
    case 'profile.expiry_corrected': rows.push([tl('Expiry evidence', 'Bằng chứng ngày hết hạn'), '—', d.evidence || '—']); break;
    default: break;
  }
  return rows;
}
const consentName = (k) => ({ marketing: tl('Marketing messages', 'Nhận tin tiếp thị'), call: tl('Calls', 'Nhận cuộc gọi'), dnc: tl('Do not contact', 'Không liên hệ'), zalo: 'Zalo', sms: 'SMS', app_push: tl('App notifications', 'Thông báo ứng dụng') }[k] || k);

/** Business details (not before/after) for the drawer. */
export function detailRows(e) {
  const d = e.details || {};
  const rows = [];
  if (d.comment) rows.push([tl('Comment', 'Nhận xét'), d.comment]);
  if (e.action === 'voice.call_completed') {
    rows.push([tl('Outcome', 'Kết quả'), label('outcome', d.outcome)]);
    if (d.verified !== undefined) rows.push([tl('Plate verified', 'Đã xác minh biển số'), yes(d.verified)]);
    if (d.turns !== undefined) rows.push([tl('Conversation turns', 'Số lượt hội thoại'), formatNumber(d.turns)]);
  }
  if (e.action === 'quote.created') {
    if (d.products) rows.push([tl('Products', 'Sản phẩm'), d.products.map((p) => label('product', p)).join(', ')]);
    if (d.total !== undefined) rows.push([tl('Total premium', 'Tổng phí'), formatMoney(d.total)]);
    if (d.channel) rows.push([tl('Channel', 'Kênh'), label('channel', d.channel)]);
    if (d.indicative !== undefined) rows.push([tl('Indicative price', 'Giá tham khảo'), yes(d.indicative)]);
  }
  if (e.action === 'order.completed' && d.channel) rows.push([tl('Channel', 'Kênh'), label('channel', d.channel)]);
  if (e.action === 'user.created') {
    if (d.roles) rows.push([tl('Roles', 'Vai trò'), d.roles.map((r) => label('role', r)).join(', ')]);
    if (d.mfa !== undefined) rows.push([tl('Two-step verification', 'Xác thực hai bước'), yes(d.mfa)]);
  }
  if (e.action === 'user.reset') {
    if (d.unlock !== undefined) rows.push([tl('Account unlocked', 'Mở khóa tài khoản'), yes(d.unlock)]);
    if (d.resetMfa !== undefined) rows.push([tl('Two-step verification reset', 'Đặt lại xác thực hai bước'), yes(d.resetMfa)]);
    if (d.resetPassword !== undefined) rows.push([tl('Password reset', 'Đặt lại mật khẩu'), yes(d.resetPassword)]);
  }
  if (e.action === 'data.ingested') {
    if (d.records !== undefined) rows.push([tl('Records received', 'Bản ghi nhận được'), formatNumber(d.records)]);
    if (d.rejected !== undefined) rows.push([tl('Records rejected', 'Bản ghi bị loại'), formatNumber(Array.isArray(d.rejected) ? d.rejected.length : d.rejected)]);
  }
  if (e.action === 'auth.login_failed' && d.reason) rows.push([tl('Reason', 'Lý do'), { bad_password: tl('Wrong password', 'Sai mật khẩu'), inactive: tl('Account disabled', 'Tài khoản bị vô hiệu hóa'), unknown_user: tl('Unknown username', 'Tên đăng nhập không tồn tại') }[d.reason] || d.reason]);
  if (e.action === 'dq.resolved' && d.outcome) rows.push([tl('Outcome', 'Kết quả'), { dismissed: tl('Dismissed', 'Bỏ qua'), confirmed: tl('Value confirmed', 'Đã xác nhận'), corrected: tl('Corrected with evidence', 'Đã điều chỉnh có bằng chứng') }[d.outcome] || d.outcome]);
  if (e.action === 'leads.recomputed' && d.scope) rows.push([tl('Scope', 'Phạm vi'), d.scope === 'all' ? tl('All customers', 'Toàn bộ khách hàng') : tl('Selected customers', 'Khách hàng được chọn')]);
  return rows;
}
