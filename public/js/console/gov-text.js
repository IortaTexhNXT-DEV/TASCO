/**
 * Governance screens (Rules studio, Approvals, Audit): bilingual business vocabulary.
 *
 * Kept next to the governance pages (instead of the shared i18n catalogue) so these screens can evolve
 * without touching the global dictionary. Every visible string goes through tl(en, vi).
 */
import { getLang, label } from '../shared/i18n.js';

/** Pick the UI-language variant: tl('Draft', 'Bản nháp'). Accepts a pair [en, vi] too. */
export const tl = (en, vi) => {
  if (Array.isArray(en)) [en, vi] = en;
  return getLang() === 'vi' ? (vi ?? en) : en;
};

/** Rule areas (list grouping) in display order. */
export const AREAS = [
  { id: 'selling', icon: 'trending-up', name: ['Selling', 'Bán hàng'] },
  { id: 'contact', icon: 'message-square', name: ['Contact & messaging', 'Liên hệ & nội dung'] },
  { id: 'products', icon: 'file-text', name: ['Products & pricing', 'Sản phẩm & biểu phí'] },
  { id: 'partners', icon: 'handshake', name: ['Partners', 'Đối tác'] },
  { id: 'data', icon: 'database', name: ['Data', 'Dữ liệu'] },
  { id: 'compliance', icon: 'shield', name: ['Access & compliance', 'Truy cập & tuân thủ'] },
];

/** Business name, one-line purpose and area for every rule kind. */
export const KINDS = {
  scoring: { area: 'selling', name: ['Lead scoring', 'Chấm điểm khách hàng tiềm năng'], desc: ['How promising each vehicle is, from 0 to 100', 'Mức độ tiềm năng của từng xe, thang 0–100'] },
  nba: { area: 'selling', name: ['Next best action', 'Hành động đề xuất'], desc: ['What staff and automation do next for each customer', 'Bước tiếp theo cho từng khách hàng'] },
  benefits: { area: 'selling', name: ['Customer benefits', 'Quyền lợi khách hàng'], desc: ['Services offered alongside the regulated premium', 'Dịch vụ đi kèm phí bảo hiểm theo quy định'] },
  referral: { area: 'selling', name: ['Referral programme', 'Chương trình giới thiệu'], desc: ['Non-cash VETC rewards for referrals', 'Thưởng điểm VETC khi giới thiệu khách hàng'] },
  costs: { area: 'selling', name: ['Channel costs', 'Chi phí kênh'], desc: ['Unit costs used in the business case', 'Đơn giá dùng cho phân tích hiệu quả'] },
  journeys: { area: 'contact', name: ['Customer journeys', 'Hành trình khách hàng'], desc: ['When and how each customer is contacted', 'Thời điểm và kênh liên hệ từng khách hàng'] },
  contact_policy: { area: 'contact', name: ['Contact policy', 'Chính sách liên hệ'], desc: ['Contact hours, frequency caps and consent', 'Khung giờ, tần suất và sự đồng ý liên hệ'] },
  'content.messages': { area: 'contact', name: ['Customer messages', 'Nội dung tin nhắn'], desc: ['App, Zalo and SMS message wording', 'Nội dung tin nhắn app, Zalo và SMS'] },
  'content.voicebot': { area: 'contact', name: ['Voice assistant script', 'Kịch bản trợ lý giọng nói'], desc: ['What the AI voice assistant says and understands', 'Lời thoại và từ khóa của trợ lý gọi tự động'] },
  triggers: { area: 'contact', name: ['Ecosystem triggers', 'Sự kiện kích hoạt'], desc: ['Messages sent when something happens in VETC', 'Tin nhắn gửi ngay khi có sự kiện VETC'] },
  products: { area: 'products', name: ['Product catalogue', 'Danh mục sản phẩm'], desc: ['Products and bundles sold on the platform', 'Sản phẩm và gói bán trên nền tảng'] },
  'tariff.tnds_car': { area: 'products', name: ['Car TNDS tariff', 'Biểu phí TNDS ô tô'], desc: ['Regulated annual premiums for cars', 'Phí năm theo quy định cho ô tô'] },
  'tariff.tnds_motorbike': { area: 'products', name: ['Motorbike TNDS tariff', 'Biểu phí TNDS xe máy'], desc: ['Regulated annual premiums for motorbikes', 'Phí năm theo quy định cho xe máy'] },
  'rating.motor_pd': { area: 'products', name: ['Physical damage rates', 'Biểu phí vật chất xe'], desc: ['Rates for own-damage cover', 'Tỷ lệ phí bảo hiểm vật chất xe'] },
  'rating.pa_seat': { area: 'products', name: ['Seat accident rates', 'Biểu phí tai nạn người ngồi trên xe'], desc: ['Per-seat personal accident pricing', 'Phí tai nạn theo chỗ ngồi'] },
  commission: { area: 'partners', name: ['Partner commission', 'Hoa hồng đối tác'], desc: ['Commission rates within statutory caps', 'Tỷ lệ hoa hồng trong giới hạn luật định'] },
  enrichment: { area: 'data', name: ['Data trust & enrichment', 'Độ tin cậy & làm giàu dữ liệu'], desc: ['How sources are trusted and merged', 'Mức tin cậy và hợp nhất nguồn dữ liệu'] },
  service_levels: { area: 'data', name: ['Service levels', 'Mức dịch vụ'], desc: ['Validity periods, SLAs and evidence weights', 'Thời hạn hiệu lực, SLA và trọng số bằng chứng'] },
  abac: { area: 'compliance', name: ['Access policies', 'Chính sách truy cập'], desc: ['Who may see which records', 'Ai được xem dữ liệu nào'] },
  copy_guard: { area: 'compliance', name: ['Copy guard', 'Kiểm soát nội dung'], desc: ['Wording never allowed in customer copy', 'Từ ngữ cấm trong nội dung gửi khách hàng'] },
  retention: { area: 'compliance', name: ['Data retention', 'Lưu trữ dữ liệu'], desc: ['How long each kind of record is kept', 'Thời gian lưu trữ từng loại dữ liệu'] },
};

/** Business name of a rule kind (falls back to the shared dictionary). */
export const kindName = (kind) => (KINDS[kind] ? tl(KINDS[kind].name) : label('ruleKind', kind));
export const kindDesc = (kind) => (KINDS[kind] ? tl(KINDS[kind].desc) : '');
export const kindArea = (kind) => KINDS[kind]?.area || (String(kind).startsWith('tariff.') || String(kind).startsWith('rating.') ? 'products' : 'data');

/** "scoring@3" → { kind: 'scoring', version: 3 }. */
export function parseRuleId(id) {
  const m = /^(.+)@(\d+)$/.exec(String(id || ''));
  return m ? { kind: m[1], version: Number(m[2]) } : { kind: String(id || ''), version: null };
}
/** "Lead scoring v3". */
export const ruleTitle = (id) => { const { kind, version } = parseRuleId(id); return version ? `${kindName(kind)} v${version}` : kindName(kind); };

/** Workflow status of a rule version in business words. */
export const RULE_STATUS = {
  draft: ['Draft', 'Bản nháp'],
  pending_approval: ['Awaiting approval', 'Chờ phê duyệt'],
  active: ['Active', 'Đang áp dụng'],
  retired: ['Replaced', 'Đã thay thế'],
  rejected: ['Rejected', 'Bị từ chối'],
};
export const ruleStatus = (s) => tl(RULE_STATUS[s] || [label('status', s), label('status', s)]);

/** Display name for an actor id that is not a staff user. */
export function systemActorName(id) {
  if (!id || id === 'system') return tl('TASCO platform', 'Hệ thống TASCO');
  if (id === 'system:catalogue-sync') return tl('TASCO core catalogue sync', 'Đồng bộ danh mục TASCO core');
  if (id === 'anonymous') return tl('Unknown user', 'Người dùng không xác định');
  if (String(id).startsWith('system')) return tl('TASCO platform', 'Hệ thống TASCO');
  if (String(id).startsWith('partner') || String(id).startsWith('P-')) return tl('Partner system', 'Hệ thống đối tác');
  if (String(id).startsWith('customer') || String(id).startsWith('C-')) return tl('Customer (VETC app)', 'Khách hàng (ứng dụng VETC)');
  if (String(id).startsWith('U-')) return tl('Staff member', 'Cán bộ');
  return tl('Customer (VETC app)', 'Khách hàng (ứng dụng VETC)');
}

/** "Rule Author (Product) (author)" → "Rule Author (Product)" when only the legacy combined name exists. */
export function plainName(displayName, legacyName, id) {
  if (displayName) return displayName;
  if (legacyName && legacyName !== id) return String(legacyName).replace(/\s*\([a-z0-9._-]+\)$/, '');
  return systemActorName(id);
}

/** Business wording for rule version descriptions written by the system ("Rollback to scoring@1"). */
export function describeVersionNote(text) {
  if (!text) return '';
  const rb = /^Rollback to (\S+@\d+)$/.exec(text);
  if (rb) return tl(`Rolled back to version ${parseRuleId(rb[1]).version}`, `Khôi phục về phiên bản ${parseRuleId(rb[1]).version}`);
  const ed = /^Edited from (\S+@\d+)$/.exec(text);
  if (ed) return tl(`Based on version ${parseRuleId(ed[1]).version}`, `Dựa trên phiên bản ${parseRuleId(ed[1]).version}`);
  return text;
}

/** Technical roles may see technical details (hashes, raw payloads). */
export const isTechnical = (user) => (user?.roles || []).some((r) => ['admin', 'support_engineer', 'auditor'].includes(r));
/** Roles allowed to see the raw rule JSON editor. */
export const isRulesTechnical = (user) => (user?.roles || []).some((r) => ['admin', 'support_engineer'].includes(r));
