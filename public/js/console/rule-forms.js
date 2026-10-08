/**
 * Rules studio — schema-driven business forms for rule sets.
 *
 * Each rule kind has a declarative DESCRIPTOR (sections → fields) mapping payload paths to labelled
 * business fields: numbers with units and limits, percentages, money, day offsets, hours, toggles,
 * enums with business labels, chips, tag lists, editable tables (decision tables, schedules, tariffs),
 * item lists, bilingual message templates with live preview + copy-guard feedback, and conditions
 * rendered as sentences (numbers inside them stay editable). Kinds without a descriptor use a
 * generic, readable key–value form.
 *
 * The same descriptors drive:
 *   ruleForm()        the editor / read-only view
 *   describeChanges() the "What changes" list in business language (never JSON paths)
 *   explainErrors()   validator messages translated to plain language and attached to fields
 *
 * XSS-safe: all DOM is built with h(); no innerHTML.
 */
import { h, mount } from '../shared/dom.js';
import { label, getLang } from '../shared/i18n.js';
import { icon } from '../shared/icons.js';
import { formField, selectInput, switchControl, badge, banner, button, iconButton, infoTip, formatMoney, formatNumber, tooltip } from './ui.js';
import { tl } from './gov-text.js';

/* =========================================================================
 * Utilities
 * ========================================================================= */

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
export const getIn = (obj, path) => path.reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
export function setIn(obj, path, v) {
  let o = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (o[path[i]] === null || o[path[i]] === undefined) o[path[i]] = typeof path[i + 1] === 'number' ? [] : {};
    o = o[path[i]];
  }
  if (v === undefined) delete o[path[path.length - 1]]; else o[path[path.length - 1]] = v;
}
const pkey = (path) => path.join('.');
const L = (x) => (typeof x === 'function' ? x() : Array.isArray(x) ? tl(x[0], x[1]) : x);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const LOGIC_KEYS = new Set(['when', 'value', 'reason', 'relevance', 'eligible', 'why', 'audience', 'allow', 'zeroWhen']);
const CONDITION_KEYS = new Set(['when', 'eligible', 'audience', 'allow', 'zeroWhen']);
const humanise = (k) => {
  const s = String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const pct = (v, decimals = 0) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : `${formatNumber(Number(v) * 100, { decimals })}%`);
const capFirst = (x) => String(x).charAt(0).toUpperCase() + String(x).slice(1);
const yesNo = (v) => (v ? tl('Yes', 'Có') : tl('No', 'Không'));
const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Same normalisation as the server copy guard: case, diacritics, spacing and separators. */
export function copyGuardHits(text, banned = []) {
  const raw = String(text || '').toLowerCase().replace(/\s+/g, ' ');
  const plain = strip(text).replace(/\s+/g, ' ');
  const squashed = plain.replace(/[\s.\-_]/g, '');
  return banned.filter((p) => raw.includes(String(p).toLowerCase()) || plain.includes(strip(p)) || squashed.includes(strip(p).replace(/[\s.\-_]/g, '')));
}

/* =========================================================================
 * Business vocabularies
 * ========================================================================= */

const V = {
  factor: {
    urgency: ['Renewal urgency', 'Mức độ cấp bách gia hạn'], expiryConfidence: ['Data confidence', 'Độ tin cậy dữ liệu'], engagement: ['Engagement', 'Mức độ tương tác'],
    reachability: ['Reachability', 'Khả năng liên lạc'], affinity: ['Relationship', 'Mức độ gắn bó'],
  },
  template: {
    verify_expiry: ['Confirm expiry date', 'Xác nhận ngày hết hạn'], first_reminder: ['First renewal reminder', 'Nhắc gia hạn lần đầu'], conquest_reminder: ['Switch-to-TASCO reminder', 'Nhắc chuyển sang TASCO'],
    value_reminder: ['Value reminder', 'Nhắc quyền lợi'], urgent_reminder: ['Urgent reminder', 'Nhắc khẩn'], expiry_day: ['Expiry-day notice', 'Thông báo ngày hết hạn'],
    lapsed_notice: ['Lapsed cover notice', 'Thông báo hết hiệu lực'], new_vehicle_welcome: ['New vehicle welcome', 'Chào mừng xe mới'], inspection_tnds_check: ['Inspection: check TNDS', 'Đăng kiểm: kiểm tra TNDS'],
    cross_sell: ['Cover upgrade offer', 'Gợi ý nâng cấp bảo hiểm'], purchase_confirmation: ['Purchase confirmation', 'Xác nhận mua bảo hiểm'], quote_ready: ['Quote ready', 'Báo giá đã sẵn sàng'],
    claim_received: ['Claim received', 'Đã nhận yêu cầu bồi thường'],
  },
  line: {
    intro: ['Opening & disclosure', 'Lời chào & thông báo cuộc gọi tự động'], plateRetry: ['Ask for the plate again', 'Hỏi lại biển số'], plateMismatch: ['Plate does not match', 'Biển số không khớp'],
    expiryKnown: ['Expiry date known', 'Đã biết ngày hết hạn'], expiryLapsed: ['Cover has lapsed', 'Bảo hiểm đã hết hạn'], expiryUnknown: ['Expiry date unknown', 'Chưa rõ ngày hết hạn'],
    pitch: ['Renewal offer', 'Lời mời gia hạn'], price: ['Price question', 'Trả lời về giá'], benefits: ['Benefits', 'Quyền lợi'], trust: ['Is this call genuine?', 'Xác nhận cuộc gọi chính thống'],
    handoff: ['Transfer to an advisor', 'Chuyển tư vấn viên'], link: ['Send renewal link', 'Gửi đường dẫn gia hạn'], callback: ['Arrange a call-back', 'Hẹn gọi lại'],
    alreadyRenewed: ['Already renewed', 'Khách đã gia hạn'], alreadyRenewedThanks: ['Thanks after renewal confirmed', 'Cảm ơn khi đã gia hạn'], optOut: ['Stop calling', 'Ngừng gọi'],
    wrongPerson: ['Wrong person', 'Nhầm người'], clarify: ['Ask to repeat', 'Đề nghị nhắc lại'], goodbye: ['Goodbye', 'Chào kết thúc'],
  },
  intent: {
    opt_out: ['Wants no more calls', 'Không muốn nhận cuộc gọi'], scam_concern: ['Worried it is a scam', 'Lo ngại lừa đảo'], human: ['Wants to speak to a person', 'Muốn gặp nhân viên'],
    already_renewed: ['Already renewed', 'Đã gia hạn'], price: ['Asks about price', 'Hỏi về giá'], callback_later: ['Call back later', 'Gọi lại sau'], send_link: ['Send me a link', 'Gửi đường dẫn'],
    buy_now: ['Wants to buy now', 'Muốn mua ngay'], wrong_person: ['Wrong person / sold the car', 'Nhầm người / đã bán xe'], benefits: ['Asks about benefits', 'Hỏi về quyền lợi'], yes: ['Yes', 'Đồng ý'], no: ['No', 'Không'],
  },
  anchor: { expiry: ['policy expiry date', 'ngày hết hạn bảo hiểm'], today: ['the day the vehicle enters the journey', 'ngày xe vào hành trình'], tagActivatedAt: ['ETC tag activation', 'ngày kích hoạt thẻ ETC'] },
  retentionEntity: {
    source_records: ['Raw source records', 'Bản ghi nguồn'], profiles: ['Customer profiles', 'Hồ sơ khách hàng'], voice_sessions: ['Call recordings & transcripts', 'Ghi âm & nội dung cuộc gọi'],
    messages: ['Messages sent', 'Tin nhắn đã gửi'], orders: ['Orders & payments', 'Đơn hàng & thanh toán'], certificates: ['Insurance certificates', 'Giấy chứng nhận bảo hiểm'], audit_log: ['Audit trail', 'Nhật ký kiểm toán'],
  },
  retentionAction: { delete: ['Delete', 'Xóa'], anonymise: ['Anonymise', 'Ẩn danh hóa'], archive: ['Archive', 'Lưu trữ'] },
  benefitType: { service: ['Service', 'Dịch vụ'], loyalty: ['Loyalty', 'Khách hàng thân thiết'], convenience: ['Convenience', 'Tiện ích'], cover_upgrade: ['Cover upgrade', 'Nâng cấp bảo hiểm'] },
  legal: { approved: ['Approved by legal', 'Pháp chế đã duyệt'], pending_legal_review: ['Pending legal review', 'Chờ pháp chế duyệt'], rejected: ['Not approved', 'Không được duyệt'] },
  productLine: { motor: ['Motor', 'Xe cơ giới'], personal_accident: ['Personal accident', 'Tai nạn con người'] },
  ratingMethod: { tariff_table: ['Regulated tariff table', 'Biểu phí theo quy định'], rate_on_sum_insured: ['Rate on sum insured', 'Tỷ lệ trên số tiền bảo hiểm'], per_seat: ['Per seat', 'Theo chỗ ngồi'], core: ['Priced by TASCO core', 'Định phí bởi TASCO core'] },
  productStatus: { active: ['On sale', 'Đang bán'], withdrawn: ['Withdrawn', 'Ngừng bán'], not_distributed: ['Not distributed', 'Chưa phân phối'], draft: ['Draft', 'Nháp'] },
  consent: { marketing: ['Marketing consent', 'Đồng ý nhận tiếp thị'], call: ['Call consent', 'Đồng ý nhận cuộc gọi'] },
  purpose: { marketing: ['Marketing messages', 'Tin nhắn tiếp thị'], voice_bot: ['Voice assistant calls', 'Cuộc gọi trợ lý tự động'], telesales: ['Telesales calls', 'Cuộc gọi telesales'] },
  abacPolicy: {
    agent_own_handoffs: ['Agents see their own and unassigned handoffs in their region', 'Nhân viên chỉ xem việc của mình hoặc chưa giao trong khu vực'],
    regional_data: ['Regional staff see customers in their region only', 'Cán bộ khu vực chỉ xem khách hàng trong khu vực'],
    customer_self: ['Customers see only their own records', 'Khách hàng chỉ xem dữ liệu của chính mình'],
  },
  resource: { handoff: ['Telesales handoffs', 'Yêu cầu telesales'], profile: ['Customer profiles', 'Hồ sơ khách hàng'], customer_self: ['Own customer record', 'Hồ sơ của chính khách hàng'] },
  accessAction: { read: ['View', 'Xem'], update: ['Change', 'Sửa'], purchase: ['Buy', 'Mua'] },
  permission: { 'handoff:read': ['View telesales handoffs', 'Xem yêu cầu telesales'], 'profile:read': ['View customers', 'Xem khách hàng'], 'customer:self': ['Customer self-service', 'Khách hàng tự phục vụ'] },
  proRata: { days_over_365: ['By day (days ÷ 365)', 'Theo ngày (số ngày ÷ 365)'] },
  disclosure: { automated_assistant: ['Announce “automated assistant” at the start of every call', 'Thông báo “trợ lý tự động” ở đầu mỗi cuộc gọi'] },
  appliesTo: { priceRegulated: ['Price-regulated products (e.g. TNDS)', 'Sản phẩm có phí theo quy định (vd. TNDS)'], all: ['All products', 'Tất cả sản phẩm'] },
  source: {
    tasco_core: ['TASCO core — verified certificate', 'TASCO core — giấy chứng nhận đã xác minh'], vetc_app_purchase: ['VETC app purchase', 'Mua trên ứng dụng VETC'], vetc_account: ['VETC account', 'Tài khoản VETC'],
    customer_declared: ['Customer declaration', 'Khách hàng tự khai'], partner_inspection_center: ['Partner: inspection centre', 'Đối tác: trung tâm đăng kiểm'], partner_bank: ['Partner: bank', 'Đối tác: ngân hàng'],
    partner_showroom: ['Partner: car showroom', 'Đối tác: đại lý ô tô'], partner_fleet: ['Partner: fleet file', 'Đối tác: tệp đội xe'], partner_agent: ['Partner: agent', 'Đối tác: đại lý bảo hiểm'],
    telesales_csv: ['Telesales list', 'Danh sách telesales'], default: ['Any other source', 'Nguồn khác'],
  },
  rewardType: { vetc_points: ['VETC points', 'Điểm VETC'] },
  legalStatus: { pending_legal_review: ['Pending legal review', 'Chờ pháp chế duyệt'], approved: ['Approved by legal', 'Pháp chế đã duyệt'] },
};
const vocab = (group, code) => (V[group]?.[code] ? tl(V[group][code]) : humanise(code));
const opts = (group, codes) => (codes || Object.keys(V[group])).map((c) => [c, () => vocab(group, c)]);
const labelOpts = (group, codes) => codes.map((c) => [c, () => label(group, c)]);
const CHANNELS = ['app_push', 'zalo_zns', 'sms', 'voice_bot', 'telesales'];
const SALES_CHANNELS = ['vetc_app', 'zalo', 'telesales', 'voice_bot', 'partner_api'];
const CATEGORIES = ['car_under6', 'car_6_11', 'car_12_24', 'car_over24', 'pickup_van', 'commercial_under6', 'commercial_6_8', 'truck_under3t', 'truck_3_8t', 'truck_8_15t', 'truck_over15t'];
const NBA_ACTIONS = ['suppress', 'route_b2b', 'verify_expiry', 'welcome_new_vehicle', 'nurture', 'urgent_recovery', 'voice_bot', 'digital_reminder', 'sms_reminder', 'enrich'];
const STEPS = ['first_reminder', 'value_reminder', 'urgent_reminder', 'expiry_day', 'lapsed_notice', 'telesales', 'verify_expiry', 'voice_bot', 'welcome', 'cross_sell'];
const ROLES = ['telesales_agent', 'telesales_supervisor', 'campaign_manager', 'data_steward', 'claims_handler', 'partner_manager', 'compliance_officer', 'rule_author', 'rule_approver', 'auditor', 'executive', 'support_engineer', 'admin', 'customer'];

/* =========================================================================
 * Conditions (JSON Logic) as business sentences
 * ========================================================================= */

const FACT = {
  days: ['days to expiry', 'số ngày đến hạn'], expiryConfidence: ['expiry date confidence', 'độ tin cậy ngày hết hạn'], ownerType: ['owner type', 'loại chủ xe'],
  journey: ['journey', 'hành trình'], tier: ['lead tier', 'nhóm khách hàng'], score: ['lead score', 'điểm khách hàng'], tagAgeDays: ['days since ETC tag activation', 'số ngày từ khi kích hoạt thẻ ETC'],
  insurer: ['current insurer', 'công ty bảo hiểm hiện tại'], product: ['product', 'sản phẩm'], partnerType: ['partner type', 'loại đối tác'], usage: ['vehicle use', 'mục đích sử dụng xe'],
  vehicleAge: ['vehicle age (years)', 'tuổi xe (năm)'], seats: ['seats', 'số chỗ ngồi'], tollClass: ['toll class', 'nhóm phí đường bộ'], longTripsKm90d: ['highway km in 90 days', 'số km cao tốc trong 90 ngày'],
  tollTrips30d: ['toll trips in 30 days', 'số lượt qua trạm trong 30 ngày'], appSessions30d: ['app sessions in 30 days', 'số lần mở ứng dụng trong 30 ngày'], walletBalance: ['wallet balance', 'số dư ví'],
  premium: ['premium', 'phí bảo hiểm'], complaints12m: ['complaints in 12 months', 'số khiếu nại trong 12 tháng'], expiryMethod: ['expiry evidence', 'nguồn ngày hết hạn'], lapsedDays: ['days since lapse', 'số ngày đã hết hạn'],
  'resource.assignedTo': ['the handoff assignee', 'người được giao việc'], 'user.id': ['the signed-in user', 'người dùng hiện tại'], 'user.region': ['the user’s region', 'khu vực của người dùng'],
  'resource.region': ['the record’s region', 'khu vực của hồ sơ'], 'resource.ownerId': ['the record owner', 'chủ hồ sơ'], 'user.customerId': ['the signed-in customer', 'khách hàng đang đăng nhập'],
};
const FLAG = {
  'consent.dnc': ['the customer opted out of all contact', 'khách hàng từ chối mọi liên hệ'], 'consent.call': ['the customer agreed to calls', 'khách hàng đồng ý nhận cuộc gọi'],
  'consent.marketing': ['the customer agreed to marketing', 'khách hàng đồng ý nhận tiếp thị'], hasPhone: ['a phone number is on file', 'có số điện thoại'],
  'channels.app_push': ['reachable by app notification', 'nhận được thông báo ứng dụng'], 'channels.zalo_zns': ['reachable on Zalo', 'nhận được tin Zalo'], 'channels.sms': ['reachable by SMS', 'nhận được SMS'],
  'channels.voice_bot': ['reachable by phone', 'liên lạc được qua điện thoại'], commercial: ['the vehicle is used commercially', 'xe kinh doanh vận tải'], autoTopUp: ['wallet auto top-up is on', 'đã bật tự động nạp ví'],
  priorVetcInsurancePurchase: ['bought insurance in the VETC app before', 'đã từng mua bảo hiểm trên VETC'], crossSellEligible: ['eligible for a cover upgrade', 'đủ điều kiện nâng cấp bảo hiểm'],
};
const OP = { '<': ['is below', 'nhỏ hơn'], '<=': ['is at most', 'không quá'], '>': ['is above', 'lớn hơn'], '>=': ['is at least', 'từ'], '==': ['is', 'là'], '===': ['is', 'là'], '!=': ['is not', 'không phải'], '!==': ['is not', 'không phải'] };
const PERCENT_FACTS = new Set(['expiryConfidence']);
const factName = (v) => (FACT[v] ? tl(FACT[v]) : (FLAG[v] ? tl(FLAG[v]) : humanise(v)));
function factValue(fact, v) {
  if (v === null) return tl('unknown', 'chưa có');
  if (PERCENT_FACTS.has(fact) && typeof v === 'number') return pct(v);
  if (typeof v === 'boolean') return yesNo(v);
  if (fact === 'journey') return label('journey', v);
  if (fact === 'tier') return label('tier', v);
  if (fact === 'ownerType') return label('ownerType', v);
  if (fact === 'product') return label('product', v);
  if (fact === 'partnerType') return label('partnerType', v);
  if (fact === 'expiryMethod') return label('method', v);
  if (v === 'ALL') return tl('all regions', 'tất cả khu vực');
  if (fact === 'usage') return v === 'commercial' ? tl('commercial', 'kinh doanh') : v === 'personal' ? tl('personal', 'cá nhân') : String(v);
  if (typeof v === 'number') return formatNumber(v, { decimals: Number.isInteger(v) ? 0 : 2 });
  return String(v);
}
const varOf = (x) => (isObj(x) && 'var' in x ? (Array.isArray(x.var) ? x.var[0] : x.var) : undefined);

/**
 * Render a JSON Logic condition as a sentence. With `edit` ({ path, onEdit }) numeric constants become
 * small inputs bound to their position in the payload (thresholds stay editable without code).
 */
export function conditionView(node, edit = null, path = [], depth = 0) {
  const out = [];
  const num = (fact, val, p) => {
    if (!edit || typeof val !== 'number') return h('strong', {}, factValue(fact, val));
    const scale = PERCENT_FACTS.has(fact) ? 100 : 1;
    const inp = h('input', { type: 'number', class: 'rf-inline-num', value: String(+(val * scale).toFixed(4)), step: 'any', 'aria-label': `${factName(fact)} — ${tl('value', 'giá trị')}` });
    inp.addEventListener('input', () => { if (inp.value !== '' && !Number.isNaN(Number(inp.value))) edit.onEdit([...edit.path, ...p], Number(inp.value) / scale); });
    return h('span', { class: 'rf-inline' }, inp, scale === 100 ? '%' : null);
  };
  if (!isObj(node)) {
    if (typeof node === 'boolean') return [node ? tl('always', 'luôn đúng') : tl('never', 'không bao giờ')];
    return [String(node)];
  }
  const [op] = Object.keys(node);
  const args = node[op];
  const v = varOf(node);
  if (v !== undefined && op === 'var') return [FLAG[v] ? tl(FLAG[v]) : `${factName(v)} ${tl('is set', 'có giá trị')}`];
  if (op === '!' || op === '!!') {
    const inner = Array.isArray(args) ? args[0] : args;
    const iv = varOf(inner);
    if (iv !== undefined && FLAG[iv]) return [op === '!' ? `${tl('not', 'không phải')}: ${tl(FLAG[iv])}` : tl(FLAG[iv])];
    return [op === '!' ? `${tl('not', 'không phải')} (` : '(', ...conditionView(inner, edit, [...path, op, ...(Array.isArray(args) ? [0] : [])], depth + 1), ')'];
  }
  if (op === 'and' || op === 'or') {
    const joiner = op === 'and' ? tl(' and ', ' và ') : tl(' or ', ' hoặc ');
    const parts = args.map((a, i) => conditionView(a, edit, [...path, op, i], depth + 1));
    if (depth > 0) out.push('(');
    parts.forEach((p, i) => { if (i) out.push(h('span', { class: 'rf-join' }, joiner)); out.push(...p); });
    if (depth > 0) out.push(')');
    return out;
  }
  if (OP[op] && Array.isArray(args) && args.length === 2) {
    const [a, b] = args;
    const fa = varOf(a);
    const fb = varOf(b);
    if (fa !== undefined && fb === undefined) {
      if (b === null) return [`${factName(fa)} ${op.startsWith('!') ? tl('is known', 'đã có') : tl('is unknown', 'chưa có')}`];
      if (typeof b === 'boolean' && FLAG[fa]) return [b === (op === '==' || op === '===') ? tl(FLAG[fa]) : `${tl('not', 'không phải')}: ${tl(FLAG[fa])}`];
      return [`${factName(fa)} ${tl(OP[op])} `, num(fa, b, [op, 1])];
    }
    if (fa !== undefined && fb !== undefined) return [`${factName(fa)} ${tl(OP[op])} ${factName(fb)}`];
  }
  if (op === 'in' && Array.isArray(args) && Array.isArray(args[1])) {
    const fa = varOf(args[0]);
    return [`${factName(fa)} ${tl('is one of', 'thuộc')} `, h('strong', {}, args[1].map((x) => factValue(fa, x)).join(', '))];
  }
  return [tl('a custom formula', 'một công thức tùy chỉnh')];
}
export const conditionText = (node) => h('span', {}, conditionView(node)).textContent;

/** Short description of a non-condition logic value (scores, relevance, reasons). */
function formulaText(node) {
  if (typeof node === 'number') return pct(node);
  if (typeof node === 'string') return node;
  if (node === null || node === undefined) return '—';
  return tl('Calculated by a formula', 'Tính theo công thức');
}

/* =========================================================================
 * Field constructors (descriptor DSL)
 * ========================================================================= */

const F = {
  number: (path, lab, o = {}) => ({ kind: 'number', path, label: lab, ...o }),
  int: (path, lab, o = {}) => ({ kind: 'number', path, label: lab, step: 1, integer: true, ...o }),
  percent: (path, lab, o = {}) => ({ kind: 'number', path, label: lab, scale: 100, unit: '%', min: 0, max: 100, step: 'any', ...o }),
  money: (path, lab, o = {}) => ({ kind: 'number', path, label: lab, money: true, unit: '₫', min: 0, step: 1000, integer: true, ...o }),
  hours: (path, lab, o = {}) => ({ kind: 'number', path, label: lab, unit: ['hours', 'giờ'], min: 0, step: 1, integer: true, ...o }),
  days: (path, lab, o = {}) => ({ kind: 'number', path, label: lab, unit: ['days', 'ngày'], min: 0, step: 1, integer: true, ...o }),
  offset: (path, lab, o = {}) => ({ kind: 'offset', path, label: lab, ...o }),
  hour: (path, lab, o = {}) => ({ kind: 'hour', path, label: lab, ...o }),
  toggle: (path, lab, o = {}) => ({ kind: 'toggle', path, label: lab, ...o }),
  select: (path, lab, options, o = {}) => ({ kind: 'select', path, label: lab, options, ...o }),
  chips: (path, lab, options, o = {}) => ({ kind: 'chips', path, label: lab, options, ...o }),
  text: (path, lab, o = {}) => ({ kind: 'text', path, label: lab, ...o }),
  textarea: (path, lab, o = {}) => ({ kind: 'textarea', path, label: lab, ...o }),
  tags: (path, lab, o = {}) => ({ kind: 'tags', path, label: lab, ...o }),
  message: (path, lab, o = {}) => ({ kind: 'message', path, label: lab, ...o }),
  condition: (path, lab, o = {}) => ({ kind: 'condition', path, label: lab, ...o }),
  formula: (path, lab, o = {}) => ({ kind: 'formula', path, label: lab, ...o }),
  bands: (path, lab, o = {}) => ({ kind: 'bands', path, label: lab, ...o }),
  view: (path, lab, o = {}) => ({ kind: 'view', path, label: lab, ...o }),
  table: (path, lab, o = {}) => ({ kind: 'table', path, label: lab, ...o }),
  mapTable: (path, lab, o = {}) => ({ kind: 'mapTable', path, label: lab, ...o }),
  items: (path, lab, o = {}) => ({ kind: 'items', path, label: lab, ...o }),
  custom: (path, lab, o = {}) => ({ kind: 'custom', path, label: lab, ...o }),
};

/* =========================================================================
 * Descriptors
 * ========================================================================= */

const factorName = (row) => (V.factor[row?.key] ? tl(V.factor[row.key]) : row?.label || humanise(row?.key || ''));
const templateName = (k) => vocab('template', k);
const nbaRuleName = (row) => humanise(row?.id || '');
const firstHitHelp = ['Rules are checked from the top; the first one that matches decides.', 'Quy tắc được xét từ trên xuống; quy tắc đầu tiên khớp sẽ được áp dụng.'];

function capFor(payload, row) {
  const caps = payload?.statutoryCaps || {};
  const when = JSON.stringify(row?.when || {});
  const hits = Object.entries(caps).filter(([p]) => when.includes(`"${p}"`));
  return hits.length ? Math.min(...hits.map(([, c]) => c)) : null;
}

const MESSAGE_SAMPLE = {
  plate: '30E-949.35', expiry: '28/10/2026', days: '21', premium: '480.700 ₫', premiumVi: '480.700 đồng', link: 'vetc.vn/r/8KQ2', benefit: () => tl('24/7 roadside assistance', 'cứu hộ giao thông 24/7'),
  name: 'Anh Phong', certNo: 'TAS-26-118204', claimId: 'CL-A63D17AA', amount: '831.600 ₫', product: () => tl('Compulsory TNDS (car)', 'Bảo hiểm TNDS bắt buộc ô tô'), date: '28/10/2026',
};

const DESCRIPTORS = {
  scoring: {
    sections: [
      { title: ['Lead tiers', 'Phân nhóm khách hàng'], fields: [
        F.int(['tiers', 'hot'], ['Hot lead threshold', 'Ngưỡng khách hàng nóng'], { unit: ['points', 'điểm'], min: 0, max: 100, help: ['Leads scoring at or above this are Hot', 'Từ mức điểm này trở lên là khách hàng Nóng'] }),
        F.int(['tiers', 'warm'], ['Warm lead threshold', 'Ngưỡng khách hàng ấm'], { unit: ['points', 'điểm'], min: 0, max: 100, help: ['Below the hot threshold and at or above this are Warm', 'Dưới ngưỡng Nóng và từ mức này là Ấm'] }),
      ] },
      { title: ['Factor weights', 'Trọng số các yếu tố'], info: ['Each factor scores 0–100% and is multiplied by its weight. Weights must total 100.', 'Mỗi yếu tố cho 0–100% và nhân với trọng số. Tổng trọng số phải bằng 100.'], fields: [
        F.custom(['factors'], ['Factors', 'Các yếu tố'], { render: weightsEditor, labels: (rows) => rows.flatMap((r, i) => [
          [[i, 'weight'], `${factorName(r)} · ${tl('weight', 'trọng số')}`, (v) => formatNumber(v)],
          [[i, 'label'], `${factorName(r)} · ${tl('name', 'tên')}`],
          [[i, 'value'], `${factorName(r)} · ${tl('scoring bands', 'thang điểm')}`, (v) => bandsText(v)],
          [[i, 'reason'], `${factorName(r)} · ${tl('explanation shown to staff', 'giải thích cho cán bộ')}`, formulaText],
          [[i, 'emptyReason'], `${factorName(r)} · ${tl('explanation when no data', 'giải thích khi thiếu dữ liệu')}`],
        ]) }),
      ] },
      { title: ['Data confidence damping', 'Giảm điểm khi dữ liệu chưa chắc chắn'], info: ['Scores are reduced when the expiry date is uncertain, so staff do not call on wrong dates.', 'Điểm bị giảm khi ngày hết hạn chưa chắc chắn để tránh gọi sai ngày.'], fields: [
        F.percent(['damping', 'base'], ['Share of score always kept', 'Phần điểm luôn được giữ'], { help: ['Applied even when the expiry date is a guess', 'Áp dụng cả khi ngày hết hạn chỉ là ước tính'] }),
        F.percent(['damping', 'byExpiryConfidence'], ['Extra share earned with full confidence', 'Phần điểm thêm khi dữ liệu chắc chắn'], { help: ['Scaled by how sure we are of the expiry date', 'Tỷ lệ theo độ chắc chắn của ngày hết hạn'] }),
        F.condition(['zeroWhen'], ['Score is set to 0 when', 'Điểm bằng 0 khi'], { readOnly: true }),
      ] },
    ],
  },

  nba: {
    sections: [
      { title: ['Decision table', 'Bảng quyết định'], info: firstHitHelp, fields: [
        F.table(['rules'], ['Rules', 'Quy tắc'], {
          reorder: true, numbered: true, rowLabel: (r) => nbaRuleName(r),
          columns: [
            F.condition(['when'], ['When', 'Khi'], { editNumbers: true, width: '34%', title: (r) => nbaRuleName(r) }),
            F.select(['then', 'action'], ['Next best action', 'Hành động đề xuất'], labelOpts('nba', NBA_ACTIONS), { width: '20%' }),
            F.text(['then', 'label'], ['Instruction for staff', 'Hướng dẫn cho cán bộ'], { maxlength: 160 }),
            F.text(['then', 'reason'], ['Reason shown', 'Lý do hiển thị'], { maxlength: 200 }),
          ],
        }),
      ] },
      { title: ['When no rule matches', 'Khi không quy tắc nào khớp'], fields: [
        F.select(['default', 'action'], ['Next best action', 'Hành động đề xuất'], labelOpts('nba', NBA_ACTIONS)),
        F.text(['default', 'label'], ['Instruction for staff', 'Hướng dẫn cho cán bộ'], { maxlength: 160 }),
        F.text(['default', 'reason'], ['Reason shown', 'Lý do hiển thị'], { maxlength: 200 }),
      ] },
    ],
  },

  journeys: {
    sections: [
      { title: ['General', 'Thiết lập chung'], fields: [
        F.days(['catchUpDays'], ['Catch-up window', 'Thời gian gửi bù'], { max: 30, help: ['Steps missed in the last N days are still sent', 'Các bước bị lỡ trong N ngày gần nhất vẫn được gửi'] }),
      ] },
      { title: ['Journeys', 'Các hành trình'], info: ['A vehicle enters the first journey (by priority) whose audience it matches.', 'Xe được đưa vào hành trình đầu tiên (theo thứ tự ưu tiên) phù hợp.'], fields: [
        F.items(['journeys'], ['Journeys', 'Hành trình'], {
          title: (r) => (getLang() === 'vi' && label('journey', r.id) !== humanise(r.id) ? label('journey', r.id) : r.name || humanise(r.id)),
          meta: (r) => [badge(label('objective', r.objective), 'neutral'), badge(tl(`Priority ${r.priority}`, `Ưu tiên ${r.priority}`), 'info'), badge(tl(`${(r.steps || []).length} steps`, `${(r.steps || []).length} bước`), 'neutral')],
          summary: (r) => cadenceStrip(r),
          fields: [
            F.text(['name'], ['Journey name', 'Tên hành trình'], { maxlength: 120 }),
            F.select(['objective'], ['Objective', 'Mục tiêu'], labelOpts('objective', ['new_business', 'retention', 'cross_sell'])),
            F.int(['priority'], ['Priority', 'Thứ tự ưu tiên'], { min: 1, max: 20, help: ['1 is checked first', 'Số 1 được xét trước'] }),
            F.select(['anchor'], ['Steps are timed from', 'Mốc tính thời gian'], Object.keys(V.anchor).map((c) => [c, () => capFirst(vocab('anchor', c))])),
            F.condition(['audience'], ['Who enters this journey', 'Đối tượng của hành trình'], { editNumbers: true, wide: true }),
            journeyStepsTable(),
          ],
        }),
      ] },
      { title: ['After purchase', 'Sau khi mua'], fields: [
        F.text(['crossSell', 'name'], ['Journey name', 'Tên hành trình'], { maxlength: 120 }),
        { ...journeyStepsTable(() => 'purchase'), path: ['crossSell', 'steps'] },
      ] },
    ],
  },

  contact_policy: {
    sections: [
      { title: ['Contact hours', 'Khung giờ liên hệ'], info: ['Applies to every channel. Vietnam time (UTC+7).', 'Áp dụng cho mọi kênh. Giờ Việt Nam (UTC+7).'], fields: [
        F.hour(['contactWindow', 'startHour'], ['Earliest contact', 'Bắt đầu liên hệ từ']),
        F.hour(['contactWindow', 'endHour'], ['Latest contact', 'Kết thúc liên hệ lúc']),
        F.view(['timezoneOffsetHours'], ['Time zone', 'Múi giờ'], { format: (v) => `UTC${v >= 0 ? '+' : ''}${v}` }),
      ] },
      { title: ['Frequency caps', 'Giới hạn tần suất'], fields: [
        F.int(['maxMarketingContactsPerDay'], ['Marketing messages per customer', 'Tin tiếp thị mỗi khách hàng'], { unit: ['per day', 'mỗi ngày'], min: 0, max: 10 }),
        F.int(['maxMarketingContactsPerWeek'], ['Marketing messages per customer', 'Tin tiếp thị mỗi khách hàng'], { unit: ['per week', 'mỗi tuần'], min: 0, max: 30 }),
        F.int(['maxCallAttemptsPerWeek'], ['Call attempts per customer', 'Số lần gọi mỗi khách hàng'], { unit: ['per week', 'mỗi tuần'], min: 0, max: 14 }),
        F.toggle(['serviceMessagesBypassCaps'], ['Service messages do not count towards caps', 'Tin dịch vụ không tính vào giới hạn'], { help: ['E.g. expiry-day and lapsed-cover notices', 'Ví dụ: thông báo ngày hết hạn, hết hiệu lực'] }),
      ] },
      { title: ['Consent required', 'Sự đồng ý bắt buộc'], fields: [
        F.mapTable(['consentRequired'], ['Consent required per purpose', 'Sự đồng ý theo mục đích'], {
          keyHeader: ['Contact purpose', 'Mục đích liên hệ'], keyLabel: (k) => vocab('purpose', k),
          columns: [F.chips([], ['Consent needed', 'Cần sự đồng ý'], opts('consent'))],
        }),
      ] },
    ],
  },

  benefits: {
    sections: [
      { title: ['Display', 'Hiển thị'], fields: [F.int(['maxShown'], ['Benefits shown per customer', 'Số quyền lợi hiển thị mỗi khách hàng'], { min: 1, max: 10 })] },
      { title: ['Benefits catalogue', 'Danh mục quyền lợi'], info: ['Only items approved by legal reach customers.', 'Chỉ quyền lợi đã được pháp chế duyệt mới hiển thị cho khách hàng.'], fields: [
        F.items(['items'], ['Benefits', 'Quyền lợi'], {
          title: (r) => (getLang() === 'vi' ? r.titleVi || r.title : r.title),
          meta: (r) => [badge(vocab('legal', r.legalStatus), r.legalStatus === 'approved' ? 'ok' : 'warn', { dot: true }), r.available === false ? badge(tl('Roadmap', 'Sắp ra mắt'), 'neutral') : null, badge(vocab('benefitType', r.type), 'neutral')],
          fields: [
            F.text(['title'], ['Title (English)', 'Tiêu đề (tiếng Anh)'], { maxlength: 120 }),
            F.text(['titleVi'], ['Title (Vietnamese)', 'Tiêu đề (tiếng Việt)'], { maxlength: 120 }),
            F.select(['type'], ['Type', 'Loại'], opts('benefitType')),
            F.text(['provider'], ['Provided by', 'Đơn vị cung cấp'], { maxlength: 80 }),
            F.select(['legalStatus'], ['Legal status', 'Tình trạng pháp lý'], opts('legal')),
            F.toggle(['available'], ['Available now', 'Đang cung cấp'], { defaultValue: true }),
            F.message([], ['Description', 'Mô tả'], { pair: { vi: 'descVi', en: 'desc' }, wide: true }),
            F.formula(['relevance'], ['Relevance', 'Mức độ phù hợp']),
            F.formula(['why'], ['Why it is offered', 'Lý do đề xuất']),
            F.condition(['eligible'], ['Offered only when', 'Chỉ đề xuất khi'], { editNumbers: true, optional: true, wide: true }),
          ],
        }),
      ] },
    ],
  },

  commission: {
    sections: [
      { title: ['Statutory caps', 'Mức trần theo luật định'], info: ['Maximum commission allowed by regulation, as a share of net premium.', 'Hoa hồng tối đa theo quy định, tính trên phí thuần.'], fields: [
        F.mapTable(['statutoryCaps'], ['Caps', 'Mức trần'], { keyHeader: ['Product', 'Sản phẩm'], keyLabel: (k) => label('product', k), columns: [F.percent([], ['Maximum commission', 'Hoa hồng tối đa'], { decimals: 1 })] }),
      ] },
      { title: ['Commission rates', 'Tỷ lệ hoa hồng'], info: firstHitHelp, fields: [
        F.table(['table', 'rules'], ['Rates', 'Tỷ lệ'], {
          reorder: true, numbered: true, rowLabel: (r) => conditionText(r.when),
          columns: [
            F.condition(['when'], ['When', 'Khi'], { width: '46%' }),
            F.percent(['then', 'rate'], ['Commission', 'Hoa hồng'], { decimals: 1, width: '20%' }),
            F.custom([], ['Statutory check', 'Kiểm tra mức trần'], { cell: (ctx, abs, row) => {
              const cap = capFor(ctx.value, row);
              if (cap === null) return badge(tl('No cap', 'Không có trần'), 'neutral');
              return row.then?.rate > cap ? badge(tl(`Above cap ${pct(cap, 1)}`, `Vượt trần ${pct(cap, 1)}`), 'danger', { dot: true }) : badge(tl(`Within cap ${pct(cap, 1)}`, `Trong mức trần ${pct(cap, 1)}`), 'ok', { dot: true });
            }, live: true }),
          ],
        }),
        F.percent(['table', 'default', 'rate'], ['Commission when no rate matches', 'Hoa hồng khi không có tỷ lệ phù hợp'], { decimals: 1 }),
      ] },
    ],
  },

  service_levels: {
    sections: [
      { title: ['Customer-facing service levels', 'Cam kết dịch vụ với khách hàng'], fields: [
        F.hours(['quoteTtlHours'], ['Quote valid for', 'Báo giá có hiệu lực'], { max: 720 }),
        F.hours(['paymentLinkTtlHours'], ['Payment link valid for', 'Đường dẫn thanh toán có hiệu lực'], { max: 720 }),
        F.hours(['claimAckSlaHours'], ['Acknowledge a new claim within', 'Tiếp nhận yêu cầu bồi thường trong'], { max: 72 }),
        F.hours(['dsarResponseHours'], ['Answer a personal-data request within', 'Phản hồi yêu cầu dữ liệu cá nhân trong'], { min: 1, max: 2160,
          help: ['To be confirmed by TASCO legal (Decree 13/2023, PDP Law 91/2025)', 'Chờ pháp chế TASCO xác nhận (Nghị định 13/2023, Luật BVDLCN 91/2025)'] }),
      ] },
      { title: ['Quick renewal', 'Gia hạn nhanh'], info: ['Offers a 3-step renewal (open, tick the declaration, confirm) when the case allows it; otherwise the full renewal is shown.', 'Cho phép gia hạn 3 bước (mở, tích xác nhận, thanh toán) khi đủ điều kiện; nếu không, khách dùng luồng gia hạn đầy đủ.'], fields: [
        F.toggle(['quickRenewal', 'enabled'], ['Offer quick renewal', 'Áp dụng gia hạn nhanh'], { defaultValue: false }),
        F.chips(['quickRenewal', 'journeys'], ['For these journeys', 'Cho các hành trình'], labelOpts('journey', ['renewal', 'conquest', 'lapsed_uninsured', 'new_vehicle']), { wide: true,
          help: ['Customers renewing a TASCO policy always qualify', 'Khách đang tái tục hợp đồng TASCO luôn đủ điều kiện'] }),
        F.toggle(['quickRenewal', 'requireConfirmedVehicle'], ['Vehicle use and seats must be confirmed', 'Yêu cầu xác nhận mục đích sử dụng và số chỗ'], { defaultValue: true,
          help: ['By TASCO core or by the customer in the app', 'Từ hệ thống lõi TASCO hoặc khách hàng xác nhận trên ứng dụng'] }),
        F.days(['quickRenewal', 'vehicleConfirmationMaxAgeDays'], ['Customer confirmation valid for', 'Xác nhận của khách có giá trị trong'], { min: 1, max: 1825 }),
        F.toggle(['quickRenewal', 'allowAddOns'], ['Renew personal accident cover too', 'Gia hạn kèm bảo hiểm tai nạn'], { defaultValue: false,
          help: ['Only when the customer had it; physical damage always needs the full flow', 'Chỉ khi khách đã có; bảo hiểm vật chất luôn dùng luồng đầy đủ'] }),
        F.toggle(['quickRenewal', 'requireWalletBalance'], ['VETC wallet balance must cover the premium', 'Số dư ví VETC phải đủ thanh toán'], { defaultValue: true }),
      ] },
      { title: ['Evidence confidence', 'Độ tin cậy của bằng chứng'], info: ['How much we trust an expiry date from each kind of evidence.', 'Mức tin cậy ngày hết hạn theo từng loại bằng chứng.'], fields: [
        F.percent(['customerDeclaredConfidence'], ['Customer confirmed in the app', 'Khách hàng xác nhận trên ứng dụng']),
        F.percent(['stewardCorrectionConfidence'], ['Corrected by a data steward', 'Cán bộ dữ liệu điều chỉnh']),
        F.percent(['botRenewedElsewhereConfidence'], ['Customer told the voice assistant they renewed', 'Khách báo trợ lý đã gia hạn nơi khác']),
      ] },
    ],
  },

  'content.messages': {
    sections: [
      { title: ['Message templates', 'Mẫu tin nhắn'], info: ['Vietnamese is sent to customers; English is for staff review. Every text is checked by the copy guard.', 'Tiếng Việt gửi khách hàng; tiếng Anh để cán bộ tham khảo. Mọi nội dung đều qua kiểm soát nội dung.'], fields: [
        F.items(['templates'], ['Templates', 'Mẫu'], {
          map: true, title: (r, k) => templateName(k), meta: (r) => [badge(tl(`${String(r.vi || '').length} characters`, `${String(r.vi || '').length} ký tự`), 'neutral')],
          fields: [F.message([], ['Message', 'Nội dung'], { sms: true, wide: true })],
        }),
      ] },
    ],
  },

  'content.voicebot': {
    sections: [
      { title: ['Call settings', 'Thiết lập cuộc gọi'], fields: [
        F.view(['disclosure'], ['Disclosure', 'Thông báo'], { format: (v) => vocab('disclosure', v) }),
        F.int(['maxPlateAttempts'], ['Plate attempts before ending the call', 'Số lần hỏi biển số tối đa'], { min: 1, max: 5 }),
        F.int(['maxClarifications'], ['Times the assistant asks to repeat', 'Số lần đề nghị nhắc lại'], { min: 0, max: 5 }),
      ] },
      { title: ['Script', 'Lời thoại'], info: ['Placeholders such as {{premium}} are filled in during the call.', 'Các trường như {{premium}} được điền khi gọi.'], fields: [
        F.items(['lines'], ['Script lines', 'Lời thoại'], { map: true, title: (r, k) => vocab('line', k), fields: [F.message([], ['Line', 'Lời thoại'], { wide: true })] }),
      ] },
      { title: ['What customers say', 'Câu khách hàng thường nói'], info: ['Words and phrases (without accents) that tell the assistant what the customer wants.', 'Từ khóa (không dấu) giúp trợ lý hiểu ý khách hàng.'], fields: [
        F.table(['intents'], ['Intents', 'Ý định'], {
          rowLabel: (r) => vocab('intent', r[0]),
          columns: [
            F.view([0], ['Customer intent', 'Ý định của khách'], { format: (v) => vocab('intent', v), width: '24%' }),
            F.tags([1], ['Recognised phrases', 'Cụm từ nhận diện']),
          ],
        }),
      ] },
    ],
  },

  products: {
    sections: [
      { title: ['Products', 'Sản phẩm'], info: ['Names, line and on-sale status come from the TASCO core catalogue; channels are managed here.', 'Tên, nghiệp vụ và trạng thái lấy từ danh mục TASCO core; kênh bán được quản lý tại đây.'], fields: [
        F.items(['products'], ['Products', 'Sản phẩm'], {
          title: (r) => (getLang() === 'vi' ? r.nameVi || r.name : r.name),
          meta: (r) => [badge(vocab('productStatus', r.status || 'active'), r.status === 'withdrawn' ? 'neutral' : 'ok', { dot: true }), r.compulsory ? badge(tl('Compulsory', 'Bắt buộc'), 'info') : null, r.coreVersion ? badge(tl('Synced from TASCO core', 'Đồng bộ từ TASCO core'), 'brand', { icon: 'refresh' }) : null],
          fields: [
            F.text(['name'], ['Name (English)', 'Tên (tiếng Anh)'], { coreOwned: true }),
            F.text(['nameVi'], ['Name (Vietnamese)', 'Tên (tiếng Việt)'], { coreOwned: true }),
            F.select(['line'], ['Line of business', 'Nghiệp vụ'], opts('productLine'), { coreOwned: true }),
            F.select(['status'], ['Status', 'Trạng thái'], opts('productStatus'), { coreOwned: true }),
            F.toggle(['compulsory'], ['Compulsory insurance', 'Bảo hiểm bắt buộc'], { coreOwned: true }),
            F.toggle(['priceRegulated'], ['Price set by regulation', 'Phí theo quy định Nhà nước'], { coreOwned: true }),
            F.view(['rating', 'method'], ['Pricing method', 'Phương pháp định phí'], { format: (v) => vocab('ratingMethod', v) }),
            F.chips(['channels'], ['Sold through', 'Kênh bán'], labelOpts('channel', SALES_CHANNELS), { wide: true }),
          ],
        }),
      ] },
      { title: ['Bundles', 'Gói sản phẩm'], fields: [
        F.table(['bundles'], ['Bundles', 'Gói'], {
          rowLabel: (r) => (getLang() === 'vi' ? r.nameVi || r.name : r.name),
          columns: [
            F.text(['name'], ['Name (English)', 'Tên (tiếng Anh)'], { maxlength: 160 }),
            F.text(['nameVi'], ['Name (Vietnamese)', 'Tên (tiếng Việt)'], { maxlength: 160 }),
            F.view(['products'], ['Includes', 'Bao gồm'], { format: (v) => (v || []).map((c) => label('product', c)).join(' + ') }),
            F.select(['status'], ['Status', 'Trạng thái'], opts('productStatus', ['active', 'withdrawn'])),
          ],
        }),
      ] },
    ],
  },

  'tariff.tnds_car': tariffDescriptor(),
  'tariff.tnds_motorbike': tariffDescriptor(),

  'rating.motor_pd': {
    pricing: true,
    sections: [
      { title: ['Limits', 'Giới hạn'], fields: [
        F.money(['minPremium'], ['Minimum premium', 'Phí tối thiểu']),
        F.money(['maxSumInsured'], ['Maximum sum insured', 'Số tiền bảo hiểm tối đa'], { step: 1000000 }),
        F.percent(['vatRate'], ['VAT', 'Thuế GTGT'], { max: 20 }),
        F.tags(['deductibleOptions'], ['Deductible options', 'Mức khấu trừ'], { numeric: true, money: true }),
      ] },
      { title: ['Rates', 'Tỷ lệ phí'], info: firstHitHelp, fields: [
        F.table(['rateTable', 'rules'], ['Rates', 'Tỷ lệ'], { reorder: true, numbered: true, rowLabel: (r) => conditionText(r.when),
          columns: [F.condition(['when'], ['When', 'Khi'], { editNumbers: true, width: '55%' }), F.percent(['then', 'rate'], ['Rate of sum insured', 'Tỷ lệ trên số tiền bảo hiểm'], { decimals: 2 })] }),
        F.percent(['rateTable', 'default', 'rate'], ['Rate when no rule matches', 'Tỷ lệ khi không quy tắc nào khớp'], { decimals: 2 }),
      ] },
      { title: ['Deductible relief', 'Giảm phí theo mức khấu trừ'], fields: [
        F.mapTable(['deductibleRelief'], ['Relief', 'Giảm phí'], { keyHeader: ['Deductible', 'Mức khấu trừ'], keyLabel: (k) => formatMoney(Number(k)), columns: [F.percent([], ['Premium relief', 'Mức giảm phí'], { decimals: 1 })] }),
      ] },
    ],
  },

  'rating.pa_seat': {
    pricing: true,
    sections: [
      { title: ['Pricing', 'Định phí'], fields: [
        F.percent(['ratePerSeat'], ['Rate per seat (of sum insured)', 'Tỷ lệ phí mỗi chỗ (trên số tiền bảo hiểm)'], { decimals: 2, step: 'any' }),
        F.toggle(['vatExempt'], ['Exempt from VAT', 'Không chịu thuế GTGT']),
        F.tags(['sumInsuredOptions'], ['Sum insured options per seat', 'Các mức số tiền bảo hiểm mỗi chỗ'], { numeric: true, money: true }),
      ] },
    ],
  },

  copy_guard: {
    sections: [
      { title: ['Restricted wording', 'Từ ngữ bị cấm'], info: ['Customer messages, benefits and the voice script can never contain these phrases (with or without accents).', 'Tin nhắn, quyền lợi và lời thoại không được chứa các cụm từ này (có dấu hoặc không dấu).'], fields: [
        F.select(['appliesTo'], ['Applies to', 'Áp dụng cho'], opts('appliesTo')),
        F.tags(['bannedPhrases'], ['Restricted phrases', 'Cụm từ bị cấm'], { wide: true }),
        F.custom([], ['Try a sentence', 'Thử một câu'], { render: copyGuardTester, noDiff: true }),
      ] },
    ],
  },

  retention: {
    sections: [
      { title: ['Retention periods', 'Thời hạn lưu trữ'], info: ['A legal hold always overrides deletion.', 'Lệnh lưu giữ theo pháp luật luôn được ưu tiên hơn việc xóa.'], fields: [
        F.table(['policies'], ['Policies', 'Chính sách'], {
          rowLabel: (r) => vocab('retentionEntity', r.entity),
          columns: [
            F.view(['entity'], ['Data', 'Dữ liệu'], { format: (v) => vocab('retentionEntity', v), width: '24%' }),
            F.days(['retainDays'], ['Keep for', 'Lưu trong'], { min: 1, max: 36500, after: (v) => (v >= 365 ? tl(`≈ ${formatNumber(v / 365, { decimals: 1 })} years`, `≈ ${formatNumber(v / 365, { decimals: 1 })} năm`) : '') }),
            F.select(['action'], ['Then', 'Sau đó'], opts('retentionAction')),
            F.text(['note'], ['Note', 'Ghi chú'], { maxlength: 160 }),
          ],
        }),
      ] },
    ],
  },

  abac: {
    sections: [
      { title: ['Access policies', 'Chính sách truy cập'], info: ['Applied after role permissions; narrows what each person can see.', 'Áp dụng sau phân quyền theo vai trò; giới hạn phạm vi dữ liệu được xem.'], fields: [
        F.items(['policies'], ['Policies', 'Chính sách'], {
          title: (r) => vocab('abacPolicy', r.id),
          meta: (r) => [badge(vocab('resource', r.resource), 'neutral'), badge(tl(`${(r.appliesToRoles || []).length} roles`, `${(r.appliesToRoles || []).length} vai trò`), 'info')],
          fields: [
            F.view(['resource'], ['Records', 'Dữ liệu'], { format: (v) => vocab('resource', v) }),
            F.chips(['actions'], ['Applies to', 'Áp dụng khi'], opts('accessAction')),
            F.chips(['appliesToRoles'], ['For these roles', 'Cho các vai trò'], labelOpts('role', ROLES), { wide: true }),
            F.view(['permission'], ['Permission', 'Quyền'], { format: (v) => vocab('permission', v) }),
            F.condition(['allow'], ['Allowed when', 'Được phép khi'], { wide: true }),
          ],
        }),
      ] },
    ],
  },

  enrichment: {
    sections: [
      { title: ['Source trust', 'Độ tin cậy nguồn'], info: ['When sources disagree, the more trusted source wins.', 'Khi các nguồn mâu thuẫn, nguồn tin cậy hơn được ưu tiên.'], fields: [
        F.mapTable(['sourceTrust'], ['Sources', 'Nguồn'], { keyHeader: ['Source', 'Nguồn dữ liệu'], keyLabel: (k) => vocab('source', k), columns: [F.percent([], ['Trust', 'Độ tin cậy'])] }),
      ] },
      { title: ['Expiry date evidence', 'Bằng chứng ngày hết hạn'], fields: [
        F.mapTable(['expiryEvidence'], ['Evidence', 'Bằng chứng'], { keyHeader: ['Evidence', 'Loại bằng chứng'], keyLabel: (k) => label('method', k), columns: [F.percent(['confidence'], ['Confidence', 'Độ tin cậy'])] }),
        F.percent(['usableExpiryConfidence'], ['Minimum confidence to use a date', 'Độ tin cậy tối thiểu để sử dụng'], { help: ['Below this, staff confirm the date before selling', 'Dưới mức này cần xác nhận lại ngày trước khi bán'] }),
        F.days(['rollForwardFloorDays'], ['Roll an old date forward after', 'Tự động cộng năm cho ngày cũ quá'], { max: 365 }),
        F.days(['corroboration', 'windowDays'], ['Sources agree if within', 'Các nguồn khớp nếu lệch không quá'], { max: 90 }),
        F.percent(['corroboration', 'boostPerAgreement'], ['Confidence added per agreeing source', 'Độ tin cậy cộng thêm mỗi nguồn khớp']),
        F.percent(['corroboration', 'maxConfidence'], ['Highest confidence from agreement', 'Độ tin cậy tối đa khi các nguồn khớp']),
      ] },
      { title: ['Vehicle category', 'Loại xe'], info: firstHitHelp, fields: [
        F.table(['categoryTable', 'rules'], ['Category rules', 'Quy tắc xác định loại xe'], { reorder: true, numbered: true, rowLabel: (r) => label('category', r.then?.category),
          columns: [
            F.condition(['when'], ['When', 'Khi'], { editNumbers: true, width: '42%' }),
            F.select(['then', 'category'], ['Vehicle category', 'Loại xe'], labelOpts('category', CATEGORIES)),
            F.percent(['then', 'confidence'], ['Confidence', 'Độ tin cậy'], { width: '16%' }),
          ] }),
      ] },
      { title: ['Data quality score', 'Điểm chất lượng dữ liệu'], fields: [
        F.percent(['dataQuality', 'completenessWeight'], ['Weight: completeness', 'Trọng số: độ đầy đủ']),
        F.percent(['dataQuality', 'expiryWeight'], ['Weight: expiry date', 'Trọng số: ngày hết hạn']),
        F.percent(['dataQuality', 'categoryWeight'], ['Weight: vehicle category', 'Trọng số: loại xe']),
        F.percent(['dataQuality', 'categoryMinConfidence'], ['Minimum category confidence', 'Độ tin cậy loại xe tối thiểu']),
      ] },
    ],
  },

  costs: {
    sections: [
      { title: ['Calls', 'Cuộc gọi'], fields: [
        F.money(['voiceBotPerMinute'], ['Voice assistant per minute', 'Trợ lý giọng nói mỗi phút'], { step: 100 }),
        F.number(['avgBotCallMinutes'], ['Average AI call length', 'Thời lượng TB cuộc gọi tự động'], { unit: ['minutes', 'phút'], min: 0, step: 0.1 }),
        F.money(['telesalesPerMinute'], ['Telesales per minute', 'Telesales mỗi phút'], { step: 100 }),
        F.number(['avgTelesalesCallMinutes'], ['Average telesales call length', 'Thời lượng TB cuộc gọi telesales'], { unit: ['minutes', 'phút'], min: 0, step: 0.1 }),
      ] },
      { title: ['Messages', 'Tin nhắn'], fields: [
        F.money(['zalo_zns'], ['Zalo message', 'Tin Zalo'], { step: 10 }), F.money(['sms'], ['SMS', 'SMS'], { step: 10 }), F.money(['app_push'], ['App notification', 'Thông báo ứng dụng'], { step: 10 }),
      ] },
    ],
  },

  referral: {
    sections: [
      { title: ['Programme', 'Chương trình'], fields: [
        F.toggle(['enabled'], ['Programme is live', 'Chương trình đang chạy']),
        F.select(['legalStatus'], ['Legal status', 'Tình trạng pháp lý'], opts('legalStatus')),
        F.select(['rewardType'], ['Reward', 'Phần thưởng'], opts('rewardType')),
        F.int(['pointsPerReferral'], ['Points per referral', 'Điểm mỗi lượt giới thiệu'], { unit: ['points', 'điểm'], min: 0, max: 10000 }),
        F.int(['maxReferralsPerMonth'], ['Referrals rewarded per month', 'Số lượt được thưởng mỗi tháng'], { min: 0, max: 100 }),
      ] },
    ],
  },
};

function tariffDescriptor() {
  return {
    pricing: true,
    sections: [
      { title: ['Terms', 'Điều kiện'], fields: [
        F.percent(['vatRate'], ['VAT', 'Thuế GTGT'], { max: 20 }),
        F.select(['proRata'], ['Short-period premium', 'Phí ngắn hạn'], opts('proRata')),
        F.int(['minTermYears'], ['Shortest term', 'Thời hạn ngắn nhất'], { unit: ['years', 'năm'], min: 1, max: 3 }),
        F.int(['maxTermYears'], ['Longest term', 'Thời hạn dài nhất'], { unit: ['years', 'năm'], min: 1, max: 3 }),
      ] },
      { title: ['Annual premiums (excl. VAT)', 'Phí năm (chưa gồm VAT)'], fields: [
        F.mapTable(['categories'], ['Categories', 'Loại xe'], {
          keyHeader: ['Vehicle category', 'Loại xe'], keyLabel: (k, row) => (getLang() === 'vi' ? row?.labelVi || row?.label : row?.label) || label('category', k),
          columns: [F.money(['annual'], ['Annual premium', 'Phí năm'])],
        }),
      ] },
    ],
  };
}

function journeyStepsTable(anchorFrom) {
  return F.table(['steps'], ['Steps', 'Các bước'], {
    rowLabel: (r) => label('step', r.step),
    addLabel: ['Add step', 'Thêm bước'],
    newRow: () => ({ offset: 0, step: 'first_reminder', channels: ['app_push'], marketing: true, template: 'first_reminder' }),
    removable: true, layout: 'cards',
    columns: [
      F.offset(['offset'], ['When', 'Thời điểm'], { anchorFrom }),
      F.select(['step'], ['Step', 'Bước'], labelOpts('step', STEPS)),
      F.select(['template'], ['Message', 'Tin nhắn'], () => [['', tl('— none (call) —', '— không (cuộc gọi) —')], ...Object.keys(V.template).map((k) => [k, templateName(k)])]),
      F.toggle(['marketing'], ['Counts as marketing', 'Tính là tiếp thị'], { compact: true, cellHelp: ['Needs marketing consent; frequency caps apply', 'Cần đồng ý tiếp thị; áp dụng giới hạn tần suất'] }),
      F.chips(['channels'], ['Channels', 'Kênh'], labelOpts('channel', CHANNELS), { compact: true, span: 3 }),
      F.chips(['onlyTiers'], ['Only for', 'Chỉ cho'], labelOpts('tier', ['hot', 'warm', 'nurture']), { compact: true, emptyText: ['All tiers', 'Mọi nhóm'] }),
    ],
  });
}

/** Compact visual cadence: "−45d Verify expiry → −30d First reminder → …". */
function cadenceStrip(journey) {
  const steps = [...(journey.steps || [])].sort((a, b) => a.offset - b.offset);
  return h('ol', { class: 'rf-cadence', 'aria-label': tl('Cadence', 'Lịch liên hệ') }, steps.map((s) => h('li', {},
    h('span', { class: 'rf-cad-day' }, s.offset === 0 ? tl('Day 0', 'Ngày 0') : `${s.offset > 0 ? '+' : '−'}${Math.abs(s.offset)}${tl('d', 'n')}`),
    h('span', { class: 'rf-cad-step' }, label('step', s.step)))));
}

export const hasDescriptor = (kind) => !!DESCRIPTORS[kind];
export const isPricingKind = (kind) => !!DESCRIPTORS[kind]?.pricing || String(kind).startsWith('tariff.') || String(kind).startsWith('rating.');

/* =========================================================================
 * Generic descriptor (kinds without a declared form)
 * ========================================================================= */

function genericFields(value) {
  const fields = [];
  for (const [k, v] of Object.entries(value || {})) {
    const lab = [humanise(k), humanise(k)];
    if (LOGIC_KEYS.has(k) && (isObj(v) || CONDITION_KEYS.has(k))) fields.push(CONDITION_KEYS.has(k) ? F.condition([k], lab, { editNumbers: true, wide: true }) : F.formula([k], lab));
    else if (typeof v === 'boolean') fields.push(F.toggle([k], lab));
    else if (typeof v === 'number') fields.push(F.number([k], lab, { step: 'any' }));
    else if (typeof v === 'string') fields.push(v.length > 80 ? F.textarea([k], lab, { wide: true }) : F.text([k], lab));
    else if (Array.isArray(v) && v.every((x) => typeof x !== 'object' || x === null)) fields.push(F.tags([k], lab, { numeric: v.every((x) => typeof x === 'number'), wide: true }));
    else if (Array.isArray(v) && v.every(isObj)) {
      const keys = [...new Set(v.flatMap((x) => Object.keys(x)))];
      const flat = keys.every((kk) => v.every((x) => x[kk] === undefined || typeof x[kk] !== 'object' || LOGIC_KEYS.has(kk) || (Array.isArray(x[kk]) && x[kk].every((y) => typeof y !== 'object'))));
      if (flat && keys.length <= 7) {
        fields.push(F.table([k], lab, { heading: true, rowLabel: (r) => rowTitle(r), columns: keys.map((kk) => {
          const sample = v.find((x) => x[kk] !== undefined)?.[kk];
          const cl = [humanise(kk), humanise(kk)];
          if (LOGIC_KEYS.has(kk)) return CONDITION_KEYS.has(kk) ? F.condition([kk], cl, { editNumbers: true }) : F.formula([kk], cl);
          if (typeof sample === 'boolean') return F.toggle([kk], cl, { compact: true });
          if (typeof sample === 'number') return F.number([kk], cl, { step: 'any' });
          if (Array.isArray(sample)) return F.tags([kk], cl);
          return F.text([kk], cl);
        }) }));
      } else {
        fields.push(F.items([k], lab, { heading: true, title: (r) => rowTitle(r), fields: (row) => genericFields(row) }));
      }
    } else if (isObj(v)) {
      if (Array.isArray(v.rules) && (v.hitPolicy || v.default !== undefined)) {
        const thenKeys = [...new Set(v.rules.flatMap((r) => Object.keys(r.then || {})))];
        fields.push(F.table([k, 'rules'], lab, { heading: true, reorder: true, numbered: true, rowLabel: (r) => humanise(r.id || ''), columns: [
          F.condition(['when'], [tl('When', 'Khi'), tl('When', 'Khi')], { editNumbers: true, width: '45%' }),
          ...thenKeys.map((tk) => {
            const sample = v.rules.find((r) => r.then?.[tk] !== undefined)?.then[tk];
            const cl = [humanise(tk), humanise(tk)];
            return typeof sample === 'number' ? F.number(['then', tk], cl, { step: 'any' }) : F.text(['then', tk], cl);
          }),
        ] }));
      } else if (Object.values(v).every((x) => typeof x === 'number')) {
        fields.push(F.mapTable([k], lab, { heading: true, keyHeader: [tl('Item', 'Mục'), tl('Item', 'Mục')], keyLabel: (kk) => humanise(kk), columns: [F.number([], [tl('Value', 'Giá trị'), tl('Value', 'Giá trị')], { step: 'any' })] }));
      } else {
        fields.push({ kind: 'group', path: [k], label: lab, fields: genericFields(v) });
      }
    }
  }
  return fields;
}
function rowTitle(r) {
  if (Array.isArray(r)) return humanise(r[0]);
  if (!isObj(r)) return String(r);
  const vi = getLang() === 'vi';
  return (vi && (r.nameVi || r.titleVi || r.labelVi)) || r.label || r.name || r.title || r.desc || humanise(r.id || r.key || r.code || r.entity || r.event || r.step || '');
}
function descriptorFor(kind, value) {
  if (DESCRIPTORS[kind]) return DESCRIPTORS[kind];
  return { generic: true, sections: [{ title: ['Settings', 'Thiết lập'], fields: genericFields(value) }] };
}

/* =========================================================================
 * Form renderer
 * ========================================================================= */

const unitText = (u) => (u ? L(u) : '');
const optList = (o) => (typeof o === 'function' ? o() : o).map(([v, lab]) => [v, L(lab)]);

function numberDisplay(f, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (f.money) return formatMoney(v);
  if (f.scale === 100) return pct(v, f.decimals ?? (Math.abs(v * 100 - Math.round(v * 100)) > 0.001 ? 2 : 0));
  return `${formatNumber(v, { decimals: f.integer || Number.isInteger(v) ? 0 : 2 })}${f.unit ? ` ${unitText(f.unit)}` : ''}`;
}
function offsetText(v, anchor) {
  const a = anchor === 'purchase' ? tl('purchase', 'ngày mua') : vocab('anchor', anchor || 'expiry');
  if (v === 0) return tl(`On the ${a}`, `Đúng ${a}`);
  const n = Math.abs(v);
  return v < 0 ? tl(`${n} days before ${a}`, `${n} ngày trước ${a}`) : tl(`${n} days after ${a}`, `${n} ngày sau ${a}`);
}
const hourText = (v) => (v === null || v === undefined ? '—' : `${String(v).padStart(2, '0')}:00`);

/** Human display of a field value (used by read-only views and the change list). */
function displayValue(f, v, row, ctxValue) {
  switch (f.kind) {
    case 'number': return numberDisplay(f, v);
    case 'offset': return v === undefined ? '—' : offsetText(v, f.anchorFrom ? f.anchorFrom(row, ctxValue) : row?.__anchor);
    case 'hour': return hourText(v);
    case 'toggle': return yesNo(v === undefined ? f.defaultValue : v);
    case 'select': { if (v === '' || v === undefined || v === null) return '—'; const o = optList(f.options).find(([x]) => String(x) === String(v)); return o ? o[1] : humanise(v); }
    case 'chips': { const arr = Array.isArray(v) ? v : []; if (!arr.length) return f.emptyText ? L(f.emptyText) : '—'; const ol = optList(f.options); return arr.map((x) => ol.find(([c]) => c === x)?.[1] || humanise(x)).join(', '); }
    case 'tags': return Array.isArray(v) ? (v.length ? v.map((x) => (f.money ? formatMoney(x) : String(x))).join(', ') : '—') : '—';
    case 'condition': return v === undefined ? tl('Always', 'Luôn áp dụng') : conditionText(v);
    case 'formula': return formulaText(v);
    case 'bands': return bandsText(v);
    case 'view': return f.format ? f.format(v, row) : (v === undefined || v === null ? '—' : String(v));
    case 'message': return typeof v === 'string' ? readablePlaceholders(v) : '—';
    default: return v === undefined || v === null || v === '' ? '—' : readablePlaceholders(String(v));
  }
}
/** "opens in {{days}} days" → "opens in ‹Days left› days" for read-only display. */
const readablePlaceholders = (t) => t.replace(/\{\{\s*(\w+)\s*\}\}/g, (m) => `‹${phLabel(m)}›`);

/**
 * Build the editable (or read-only) form for a rule payload.
 * @param {{kind: string, value: object, readOnly?: boolean, onChange?: Function, bannedPhrases?: string[], coreOwned?: boolean}} o
 * @returns {{el: HTMLElement, getValue: () => object, setValue: Function, setErrors: Function, validate: () => Array<{path: string, message: string}>}}
 */
export function ruleForm({ kind, value, readOnly = false, onChange, bannedPhrases = [], coreOwned = false }) {
  const state = { value: clone(value), errors: new Map() };
  const registry = new Map(); // pathKey → setError(msg)
  const live = new Set(); // functions re-run after each change (live badges, totals)
  const root = h('div', { class: 'rf' });
  let timer = null;
  const ctx = {
    get value() { return state.value; }, kind, readOnly, bannedPhrases, coreOwned,
    reg(key, fn) { registry.set(key, fn); },
    live(fn) { live.add(fn); fn(); },
    changed() {
      for (const fn of live) { try { fn(); } catch { /* element gone */ } }
      runClientChecks();
      clearTimeout(timer);
      timer = setTimeout(() => onChange?.(clone(state.value)), 120);
    },
    set(abs, v) { setIn(state.value, abs, v); ctx.changed(); },
  };

  function render() {
    registry.clear();
    live.clear();
    const desc = descriptorFor(kind, state.value);
    mount(root, desc.sections.map((s) => h('section', { class: 'rf-section' },
      h('div', { class: 'rf-section-head' }, h('h3', {}, L(s.title)), s.info ? infoTip(L(s.info)) : null),
      h('div', { class: 'rf-grid' }, s.fields.map((f) => renderField(f, ctx, f.path))))));
    runClientChecks();
  }

  function runClientChecks() {
    const errs = clientValidate(kind, state.value, bannedPhrases);
    for (const fn of registry.values()) fn('');
    for (const e of errs) registry.get(e.path)?.(e.message);
    state.clientErrors = errs;
  }

  render();
  return {
    el: root,
    getValue: () => clone(state.value),
    setValue(v) { state.value = clone(v); render(); },
    /** Attach plain-language errors [{path, message}] to fields; returns the ones that matched no field. */
    setErrors(list) {
      for (const fn of registry.values()) fn('');
      const orphans = [];
      for (const e of list) {
        const fn = registry.get(e.path) || [...registry.entries()].find(([k]) => e.path && (k.startsWith(`${e.path}.`) || e.path.startsWith(`${k}.`)))?.[1];
        if (fn) fn(e.message); else orphans.push(e);
      }
      const first = root.querySelector('[aria-invalid="true"], .rf-invalid');
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return orphans;
    },
    validate: () => clientValidate(kind, state.value, bannedPhrases),
  };
}

/** Render one field (form mode) at absolute path `abs`. */
function renderField(f, ctx, abs, row) {
  const wide = f.wide || ['table', 'mapTable', 'items', 'group', 'message', 'custom', 'bands'].includes(f.kind);
  const ro = ctx.readOnly || f.readOnly || (f.coreOwned && ctx.coreOwned);
  if (f.kind === 'group') {
    return h('div', { class: 'rf-group rf-wide' }, h('h4', {}, L(f.label)), h('div', { class: 'rf-grid' }, f.fields.map((x) => renderField(x, ctx, [...abs, ...x.path]))));
  }
  if (f.kind === 'custom' && f.render) return h('div', { class: 'rf-wide' }, f.render(ctx, abs, f));
  const sub = f.heading ? h('h4', { class: 'rf-sub' }, L(f.label)) : null;
  if (f.kind === 'table') return h('div', { class: 'rf-wide' }, sub, tableEditor(f, ctx, abs, ro));
  if (f.kind === 'mapTable') return h('div', { class: 'rf-wide' }, sub, mapTableEditor(f, ctx, abs, ro));
  if (f.kind === 'items') return h('div', { class: 'rf-wide' }, sub, itemsEditor(f, ctx, abs));
  if (f.kind === 'message') return h('div', { class: 'rf-wide' }, messageEditor(f, ctx, abs, ro));
  const v = getIn(ctx.value, abs);
  if (f.optional && v === undefined && ro) return null;
  const control = controlFor(f, ctx, abs, ro, row);
  const fieldEl = formField({ label: L(f.label), control, help: f.help ? L(f.help) : undefined, info: f.info ? L(f.info) : undefined });
  if (f.coreOwned && ctx.coreOwned) fieldEl.classList.add('rf-core');
  fieldEl.classList.toggle('rf-wide', !!wide);
  ctx.reg(pkey(abs), (msg) => fieldEl.setError(msg));
  return fieldEl;
}

/** Input control for scalar fields; in read-only mode a formatted value. */
function controlFor(f, ctx, abs, ro, row, mode = 'form') {
  const v = getIn(ctx.value, abs);
  if (ro && !['condition', 'chips'].includes(f.kind)) {
    const text = f.kind === 'offset' ? offsetText(v ?? 0, anchorOf(f, ctx.value, abs)) : displayValue(f, v, row || rowFor(ctx, abs), ctx.value);
    return h('div', { class: `rf-value${f.kind === 'number' ? ' num' : ''}`, tabindex: mode === 'form' ? '0' : null }, text);
  }
  switch (f.kind) {
    case 'number': {
      const scale = f.scale || 1;
      const inp = h('input', { type: 'number', inputmode: 'decimal', step: f.step === 'any' ? 'any' : String((f.step || 1)), min: f.min !== undefined ? String(f.min) : null, max: f.max !== undefined ? String(f.max) : null, value: v === undefined || v === null ? '' : String(+(v * scale).toFixed(6)), class: mode === 'cell' ? 'sm' : null });
      const hint = f.money ? h('span', { class: 'rf-hint' }, v ? formatMoney(v) : '') : f.after ? h('span', { class: 'rf-hint' }, f.after(v)) : null;
      inp.addEventListener('input', () => {
        if (inp.value === '') return;
        const n = Number(inp.value) / scale;
        if (Number.isNaN(n)) return;
        const val = f.integer ? Math.round(n) : +n.toFixed(6);
        if (hint) hint.textContent = f.money ? formatMoney(val) : f.after(val);
        ctx.set(abs, val);
      });
      const unit = f.unit ? h('span', { class: 'ig-suffix' }, unitText(f.unit)) : null;
      const wrap = h('div', { class: `input-group rf-num${unit ? ' has-suffix' : ''}` }, inp, unit);
      if (!hint) return unit ? labelled(wrap, inp) : inp;
      return labelled(h('div', { class: 'rf-num-wrap' }, wrap, hint), inp);
    }
    case 'offset': {
      const inp = h('input', { type: 'number', step: '1', value: String(Math.abs(v ?? 0)), min: '0', max: '365', class: 'sm', 'aria-label': tl('Days', 'Số ngày') });
      const dir = selectInput([['-1', tl('before', 'trước')], ['0', tl('on', 'đúng')], ['1', tl('after', 'sau')]], String(Math.sign(v ?? 0)), { class: 'sm', 'aria-label': tl('Before or after', 'Trước hoặc sau') });
      const anchor = anchorOf(f, ctx.value, abs);
      const sync = () => { const s = Number(dir.value); inp.disabled = s === 0; ctx.set(abs, s === 0 ? 0 : s * Math.abs(Math.round(Number(inp.value) || 0))); };
      inp.addEventListener('input', sync); dir.addEventListener('change', sync);
      inp.disabled = (v ?? 0) === 0;
      return labelled(h('div', { class: 'rf-offset', title: offsetText(v ?? 0, anchor) }, inp, h('span', { class: 'rf-offset-unit' }, tl('days', 'ngày')), dir), inp);
    }
    case 'hour': {
      const s = selectInput(Array.from({ length: 25 }, (_, i) => [String(i), hourText(i)]), String(v ?? ''), {});
      s.addEventListener('change', () => ctx.set(abs, Number(s.value)));
      return s;
    }
    case 'toggle': {
      const on = v === undefined ? !!f.defaultValue : !!v;
      const sw = switchControl({ checked: on, onChange: (c) => ctx.set(abs, c), label: mode === 'cell' ? null : (on ? tl('On', 'Bật') : tl('Off', 'Tắt')) });
      if (mode === 'form') sw.input.addEventListener('change', () => { const t = sw.querySelector('span:last-child'); if (t && !t.classList.contains('switch-track')) t.textContent = sw.input.checked ? tl('On', 'Bật') : tl('Off', 'Tắt'); });
      if (mode === 'cell') sw.input.setAttribute('aria-label', L(f.label));
      if (f.cellHelp && mode === 'cell') tooltip(sw, L(f.cellHelp));
      return labelled(sw, sw.input);
    }
    case 'select': {
      const ol = optList(f.options);
      const s = selectInput(ol, v ?? '', { class: mode === 'cell' ? 'sm' : null });
      if (v !== undefined && v !== null && v !== '' && !ol.some(([x]) => String(x) === String(v))) s.append(h('option', { value: v, selected: true }, humanise(v)));
      s.addEventListener('change', () => ctx.set(abs, s.value === '' ? undefined : s.value));
      return s;
    }
    case 'chips': return chipsControl(f, ctx, abs, ro, mode);
    case 'tags': return tagsControl(f, ctx, abs, mode);
    case 'text': {
      const inp = h('input', { type: 'text', value: v ?? '', maxlength: String(f.maxlength || 200), class: mode === 'cell' ? 'sm' : null });
      inp.addEventListener('input', () => ctx.set(abs, inp.value));
      return inp;
    }
    case 'textarea': {
      const ta = h('textarea', { rows: '3', maxlength: String(f.maxlength || 2000) });
      ta.value = v ?? '';
      ta.addEventListener('input', () => ctx.set(abs, ta.value));
      return ta;
    }
    case 'condition': {
      if (v === undefined) return h('div', { class: 'rf-value muted' }, tl('Always', 'Luôn áp dụng'));
      const edit = !ro && f.editNumbers ? { path: abs, onEdit: (p, n) => ctx.set(p, n) } : null;
      const titleText = f.title ? f.title(rowFor(ctx, abs)) : null;
      return h('div', { class: 'rf-cond', tabindex: edit ? null : '0' }, titleText && mode === 'cell' ? h('span', { class: 'rf-cond-title' }, titleText) : null, h('span', { class: 'rf-cond-text' }, conditionView(v, edit)));
    }
    case 'formula': return h('div', { class: 'rf-value' }, formulaText(v));
    case 'view': return h('div', { class: 'rf-value' }, displayValue(f, v, rowFor(ctx, abs), ctx.value));
    default: return h('div', { class: 'rf-value' }, displayValue(f, v));
  }
}
/** Anchor of a journey step offset: the enclosing journey's anchor (or the column's fixed anchor). */
function anchorOf(f, root, abs) {
  if (f.anchorFrom) return f.anchorFrom();
  return getIn(root, abs.slice(0, abs.length - 3))?.anchor;
}

/** Give a composite control the id/aria wiring formField expects, pointing the label at the real input. */
function labelled(wrap, inputEl) {
  wrap.isLabelled = true;
  Object.defineProperty(wrap, 'id', { configurable: true, get: () => inputEl.id, set: (x) => { if (x) inputEl.id = x; } });
  const sa = wrap.setAttribute.bind(wrap);
  wrap.setAttribute = (k, val) => (k.startsWith('aria-') ? inputEl.setAttribute(k, val) : sa(k, val));
  const ra = wrap.removeAttribute.bind(wrap);
  wrap.removeAttribute = (k) => (k.startsWith('aria-') ? inputEl.removeAttribute(k) : ra(k));
  return wrap;
}
function rowFor(ctx, abs) {
  // nearest enclosing array element (for row-aware formatting)
  for (let i = abs.length - 1; i > 0; i--) if (typeof abs[i] === 'number') return getIn(ctx.value, abs.slice(0, i + 1));
  return undefined;
}

function chipsControl(f, ctx, abs, ro, mode) {
  const ol = optList(f.options);
  const group = h('div', { class: `rf-chips${mode === 'cell' ? ' compact' : ''}`, role: 'group', 'aria-label': L(f.label) });
  const draw = () => {
    const cur = Array.isArray(getIn(ctx.value, abs)) ? getIn(ctx.value, abs) : [];
    if (ro) {
      mount(group, cur.length ? cur.map((c) => badge(ol.find(([x]) => x === c)?.[1] || humanise(c), 'neutral')) : h('span', { class: 'muted' }, f.emptyText ? L(f.emptyText) : '—'));
      return;
    }
    mount(group, ol.map(([code, lab]) => {
      const on = cur.includes(code);
      return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick: () => {
        const now = Array.isArray(getIn(ctx.value, abs)) ? [...getIn(ctx.value, abs)] : [];
        const next = now.includes(code) ? now.filter((x) => x !== code) : [...now, code];
        ctx.set(abs, next.length || !f.emptyText ? next : undefined);
        draw();
      } }, on ? icon('check', { size: 12 }) : null, lab);
    }));
  };
  draw();
  return group;
}

function tagsControl(f, ctx, abs, mode) {
  const wrap = h('div', { class: `rf-tags${mode === 'cell' ? ' compact' : ''}` });
  const list = h('div', { class: 'rf-tag-list' });
  const inp = h('input', { type: f.numeric ? 'number' : 'text', class: 'sm', placeholder: f.numeric ? tl('Add amount', 'Thêm giá trị') : tl('Add phrase…', 'Thêm cụm từ…'), 'aria-label': `${L(f.label)} — ${tl('add', 'thêm')}` });
  const draw = () => {
    const cur = Array.isArray(getIn(ctx.value, abs)) ? getIn(ctx.value, abs) : [];
    mount(list, cur.map((x, i) => h('span', { class: 'rf-tag' }, f.money ? formatMoney(x) : String(x),
      h('button', { type: 'button', class: 'rf-tag-x', 'aria-label': `${tl('Remove', 'Xóa')} ${x}`, onclick: () => { const next = [...cur]; next.splice(i, 1); ctx.set(abs, next); draw(); } }, icon('x', { size: 12 })))));
  };
  const add = () => {
    const raw = inp.value.trim();
    if (!raw) return;
    const val = f.numeric ? Number(raw) : raw;
    if (f.numeric && Number.isNaN(val)) return;
    const cur = Array.isArray(getIn(ctx.value, abs)) ? getIn(ctx.value, abs) : [];
    if (!cur.includes(val)) ctx.set(abs, [...cur, val]);
    inp.value = '';
    draw();
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } });
  draw();
  mount(wrap, list, h('div', { class: 'rf-tag-add' }, inp, iconButton({ icon: 'plus', label: tl('Add', 'Thêm'), size: 'sm', variant: 'secondary', onClick: add })));
  return labelled(wrap, inp);
}

/** Editable table (decision tables, schedules, lists). Rows can be re-ordered / added / removed when allowed. */
/** Rows as compact cards with labelled cells (dense schedules such as journey steps). */
function cardsEditor(f, ctx, abs, ro) {
  const holder = h('div', { class: 'rf-table-wrap' });
  const draw = () => {
    const rows = getIn(ctx.value, abs) || [];
    const list = h('ol', { class: 'rf-cards', 'aria-label': L(f.label) }, rows.map((row, i) => {
      const rowAbs = [...abs, i];
      const cells = f.columns.map((c) => {
        const cellAbs = [...rowAbs, ...c.path];
        const control = controlFor(c, ctx, cellAbs, ro || c.readOnly, row, 'cell');
        if (control.isLabelled || /^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName)) control.setAttribute('aria-label', `${L(c.label)} — ${f.rowLabel ? f.rowLabel(row) : i + 1}`);
        const cell = h('div', { class: `rf-card-cell${c.span ? ` span-${c.span}` : ''}` }, h('span', { class: 'rf-card-label', 'aria-hidden': 'true' }, L(c.label)), control);
        ctx.reg(pkey(cellAbs), (msg) => { cell.classList.toggle('rf-invalid', !!msg); if (msg) cell.setAttribute('data-tooltip', msg); else cell.removeAttribute('data-tooltip'); });
        return cell;
      });
      return h('li', { class: 'rf-card' },
        h('div', { class: 'rf-card-head' }, h('span', { class: 'rf-card-n' }, String(i + 1)), h('span', { class: 'rf-card-title' }, f.rowLabel ? f.rowLabel(row) : ''),
          !ro && f.removable ? iconButton({ icon: 'trash', label: `${tl('Remove', 'Xóa')} ${f.rowLabel ? f.rowLabel(row) : i + 1}`, size: 'sm', onClick: () => { const next = [...rows]; next.splice(i, 1); ctx.set(abs, next); draw(); } }) : null),
        h('div', { class: 'rf-card-grid' }, cells));
    }));
    mount(holder, list, !ro && f.newRow ? h('div', { class: 'rf-table-foot' }, button({ label: L(f.addLabel || ['Add row', 'Thêm dòng']), icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => { ctx.set(abs, [...rows, f.newRow()]); draw(); } })) : null);
  };
  draw();
  return holder;
}

function tableEditor(f, ctx, abs, ro) {
  if (f.layout === 'cards') return cardsEditor(f, ctx, abs, ro);
  const holder = h('div', { class: 'rf-table-wrap' });
  const draw = () => {
    const rows = getIn(ctx.value, abs) || [];
    const cols = f.columns;
    const actions = !ro && (f.reorder || f.removable);
    const head = h('tr', {}, f.numbered ? h('th', { class: 'rf-n', scope: 'col' }, '#') : null,
      cols.map((c) => h('th', { scope: 'col', style: c.width ? `width:${c.width}` : null }, L(c.label))),
      actions ? h('th', { class: 'rf-act', scope: 'col' }, h('span', { class: 'sr-only' }, tl('Row actions', 'Thao tác'))) : null);
    const body = rows.map((row, i) => {
      const rowAbs = [...abs, i];
      return h('tr', {}, f.numbered ? h('td', { class: 'rf-n' }, String(i + 1)) : null,
        cols.map((c) => {
          const cellAbs = [...rowAbs, ...c.path];
          const td = h('td', { class: c.kind === 'number' ? 'num' : null });
          if (c.kind === 'custom' && c.cell) {
            const paint = () => mount(td, c.cell(ctx, cellAbs, getIn(ctx.value, rowAbs)));
            if (c.live) ctx.live(paint); else paint();
            return td;
          }
          const cro = ro || c.readOnly;
          const control = controlFor(c, ctx, cellAbs, cro, row, 'cell');
          if (control.isLabelled || /^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName)) control.setAttribute('aria-label', `${L(c.label)} — ${f.rowLabel ? f.rowLabel(row) : i + 1}`);
          td.append(control);
          ctx.reg(pkey(cellAbs), (msg) => { td.classList.toggle('rf-invalid', !!msg); if (msg) { td.setAttribute('data-tooltip', msg); control.setAttribute?.('aria-invalid', 'true'); } else { td.removeAttribute('data-tooltip'); control.removeAttribute?.('aria-invalid'); } });
          return td;
        }),
        actions ? h('td', { class: 'rf-act' }, h('div', { class: 'rf-row-actions' },
          f.reorder ? iconButton({ icon: 'arrow-up', label: tl('Move up', 'Lên trên'), size: 'sm', attrs: { disabled: i === 0 }, onClick: () => move(i, -1) }) : null,
          f.reorder ? iconButton({ icon: 'arrow-down', label: tl('Move down', 'Xuống dưới'), size: 'sm', attrs: { disabled: i === rows.length - 1 }, onClick: () => move(i, 1) }) : null,
          f.removable ? iconButton({ icon: 'trash', label: tl('Remove row', 'Xóa dòng'), size: 'sm', onClick: () => { const next = [...rows]; next.splice(i, 1); ctx.set(abs, next); draw(); } }) : null)) : null);
    });
    const tableEl = h('div', { class: 'table-wrap rf-table' }, h('table', {}, h('caption', { class: 'sr-only' }, L(f.label)), h('thead', {}, head), h('tbody', {}, body)));
    const regErr = h('div', { class: 'error rf-table-error', role: 'alert' });
    ctx.reg(pkey(abs), (msg) => mount(regErr, msg ? [icon('alert-circle', { size: 14 }), msg] : null));
    mount(holder, tableEl, regErr, !ro && f.newRow ? h('div', { class: 'rf-table-foot' }, button({ label: L(f.addLabel || ['Add row', 'Thêm dòng']), icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => { ctx.set(abs, [...rows, f.newRow()]); draw(); } })) : null);
  };
  function move(i, d) {
    const rows = [...(getIn(ctx.value, abs) || [])];
    const [r] = rows.splice(i, 1);
    rows.splice(i + d, 0, r);
    ctx.set(abs, rows);
    draw();
  }
  draw();
  return holder;
}

/** Table over an object map (key → value or key → object). */
function mapTableEditor(f, ctx, abs, ro) {
  const obj = getIn(ctx.value, abs) || {};
  const keys = Object.keys(obj);
  return h('div', { class: 'table-wrap rf-table' }, h('table', {},
    h('caption', { class: 'sr-only' }, L(f.label)),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, L(f.keyHeader)), f.columns.map((c) => h('th', { scope: 'col', class: c.kind === 'number' ? 'num' : null }, L(c.label))))),
    h('tbody', {}, keys.map((k) => h('tr', {}, h('th', { scope: 'row', class: 'rf-key' }, f.keyLabel(k, obj[k])),
      f.columns.map((c) => {
        const cellAbs = [...abs, k, ...c.path];
        const control = controlFor(c, ctx, cellAbs, ro || c.readOnly, obj[k], 'cell');
        if (control.isLabelled || /^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName)) control.setAttribute('aria-label', `${L(c.label)} — ${f.keyLabel(k, obj[k])}`);
        const td = h('td', { class: c.kind === 'number' ? 'num' : null }, control);
        ctx.reg(pkey(cellAbs), (msg) => { td.classList.toggle('rf-invalid', !!msg); if (msg) td.setAttribute('data-tooltip', msg); else td.removeAttribute('data-tooltip'); });
        return td;
      }))))));
}

/** List of complex items as disclosure panels (journeys, products, benefits, templates…). */
function itemsEditor(f, ctx, abs) {
  const coll = getIn(ctx.value, abs) || (f.map ? {} : []);
  const entries = f.map ? Object.keys(coll).map((k) => [k, coll[k]]) : coll.map((r, i) => [i, r]);
  return h('div', { class: 'rf-items' }, entries.map(([k, row], idx) => {
    const itemAbs = [...abs, k];
    const fields = typeof f.fields === 'function' ? f.fields(row) : f.fields;
    const meta = f.meta ? f.meta(row, k).filter(Boolean) : [];
    const det = h('details', { class: 'rf-item', open: idx === 0 ? true : null },
      h('summary', {}, icon('chevron-right', { size: 16, class: 'rf-item-chev' }), h('span', { class: 'rf-item-title' }, f.title(row, k)), h('span', { class: 'rf-item-meta' }, meta)),
      h('div', { class: 'rf-item-body' },
        f.summary ? f.summary(row) : null,
        h('div', { class: 'rf-grid' }, fields.map((x) => renderField(x, ctx, [...itemAbs, ...x.path], row)))));
    return det;
  }));
}

/** Bilingual message editor: Vietnamese + English, live preview with sample values and copy-guard status. */
function messageEditor(f, ctx, abs, ro) {
  const paths = f.pair ? { vi: [...abs, f.pair.vi], en: [...abs, f.pair.en] } : { vi: [...abs, 'vi'], en: [...abs, 'en'] };
  let lastFocused = null;
  const col = (lang) => {
    const p = paths[lang];
    const v = getIn(ctx.value, p) ?? '';
    const title = lang === 'vi' ? tl('Vietnamese · sent to customers', 'Tiếng Việt · gửi khách hàng') : tl('English · for staff review', 'Tiếng Anh · để cán bộ tham khảo');
    const preview = h('div', { class: 'rf-bubble', 'aria-label': tl('Preview', 'Xem trước') });
    const status = h('div', { class: 'rf-msg-meta' });
    const paint = (text) => {
      mount(preview, renderPreview(text));
      const hits = copyGuardHits(text, ctx.bannedPhrases);
      const len = String(text).length;
      mount(status,
        h('span', {}, tl(`${formatNumber(len)} characters`, `${formatNumber(len)} ký tự`), f.sms && lang === 'vi' ? ` · ${tl(`${smsSegments(text)} SMS`, `${smsSegments(text)} tin SMS`)}` : null),
        hits.length ? badge(tl(`Restricted wording: “${hits.join('”, “')}”`, `Từ ngữ bị cấm: “${hits.join('”, “')}”`), 'danger', { icon: 'alert-triangle' }) : badge(tl('Passes copy guard', 'Đạt kiểm soát nội dung'), 'ok', { icon: 'check' }));
    };
    let control;
    if (ro) control = null;
    else {
      control = h('textarea', { rows: '3', maxlength: '1000', 'aria-label': `${L(f.label)} — ${title}` });
      control.value = v;
      control.addEventListener('focus', () => { lastFocused = control; });
      control.addEventListener('input', () => { ctx.set(p, control.value); paint(control.value); });
    }
    paint(v);
    const err = h('div', { class: 'error', role: 'alert' });
    ctx.reg(pkey(p), (msg) => { mount(err, msg ? [icon('alert-circle', { size: 14 }), msg] : null); if (control) { if (msg) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid'); } });
    return h('div', { class: 'rf-msg-col' }, h('div', { class: 'rf-msg-lang' }, title), control, err, status, preview);
  };
  const phs = [...new Set([getIn(ctx.value, paths.vi), getIn(ctx.value, paths.en)].join(' ').match(/\{\{\s*\w+\s*\}\}/g) || [])];
  const allPh = [...new Set([...phs, '{{plate}}', '{{expiry}}', '{{days}}', '{{link}}', '{{benefit}}'])];
  const chipsRow = ro ? null : h('div', { class: 'rf-ph-row' }, h('span', { class: 'xs muted' }, tl('Insert:', 'Chèn:')),
    allPh.map((ph) => h('button', { type: 'button', class: 'chip rf-ph-chip', onmousedown: (e) => e.preventDefault(), onclick: () => {
      const ta = lastFocused;
      if (!ta) return;
      const s = ta.selectionStart ?? ta.value.length;
      ta.value = ta.value.slice(0, s) + ph + ta.value.slice(ta.selectionEnd ?? s);
      ta.dispatchEvent(new Event('input'));
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + ph.length;
    } }, phLabel(ph))));
  return h('div', { class: 'rf-msg' }, chipsRow, h('div', { class: 'rf-msg-cols' }, col('vi'), col('en')));
}
function phLabel(ph) {
  const k = ph.replace(/[{}\s]/g, '');
  const names = { tagAgeDays: ['days since tag', 'số ngày từ khi gắn thẻ'], lapsedDays: ['days lapsed', 'số ngày hết hạn'], plate: ['Plate', 'Biển số'], expiry: ['Expiry date', 'Ngày hết hạn'], days: ['Days left', 'Số ngày còn lại'], premium: ['Premium', 'Phí'], premiumVi: ['Premium (spoken)', 'Phí (đọc)'], link: ['Link', 'Đường dẫn'], benefit: ['Benefit', 'Quyền lợi'] };
  return names[k] ? tl(names[k]) : humanise(k);
}
function renderPreview(text) {
  const parts = String(text || '').split(/(\{\{\s*\w+\s*\}\})/g);
  return parts.filter((p) => p !== '').map((p) => {
    const m = /^\{\{\s*(\w+)\s*\}\}$/.exec(p);
    if (!m) return p;
    const s = MESSAGE_SAMPLE[m[1]];
    return h('mark', { class: 'rf-ph' }, s === undefined ? phLabel(p) : typeof s === 'function' ? s() : s);
  });
}
const smsSegments = (text) => { const n = String(text || '').length; return n <= 70 ? 1 : Math.ceil(n / 67); };

/* ---------- Scoring: factor weights with total indicator and urgency bands ---------- */

function parseBands(node) {
  if (!isObj(node) || !Array.isArray(node.if)) return null;
  const a = node.if;
  if (a.length < 3 || a.length % 2 === 0) return null;
  const rows = [];
  let fact = null;
  for (let i = 0; i < a.length - 1; i += 2) {
    const c = a[i];
    const [op] = isObj(c) ? Object.keys(c) : [];
    if (!OP[op] || !Array.isArray(c[op])) return null;
    const f = varOf(c[op][0]);
    if (!f || (fact && f !== fact) || !(typeof c[op][1] === 'number' || c[op][1] === null) || typeof a[i + 1] !== 'number') return null;
    fact = f;
    rows.push({ op, threshold: c[op][1], value: a[i + 1], i });
  }
  if (typeof a[a.length - 1] !== 'number') return null;
  return { fact, rows, otherwise: a[a.length - 1] };
}
function bandsText(node) {
  const b = parseBands(node);
  if (!b) return formulaText(node);
  return [...b.rows.map((r) => `${r.threshold === null ? `${factName(b.fact)} ${tl('unknown', 'chưa có')}` : `${OP[r.op] ? `${factName(b.fact)} ${tl(OP[r.op])} ${formatNumber(r.threshold)}` : ''}`}: ${pct(r.value)}`), `${tl('otherwise', 'còn lại')}: ${pct(b.otherwise)}`].join('; ');
}
function bandsEditor(ctx, abs, ro) {
  const node = getIn(ctx.value, abs);
  const b = parseBands(node);
  if (!b) return h('p', { class: 'rf-value muted' }, formulaText(node));
  const pctInput = (p, val, aria) => {
    if (ro) return h('span', { class: 'num' }, pct(val));
    const inp = h('input', { type: 'number', class: 'sm rf-band-num', min: '0', max: '100', step: '1', value: String(Math.round(val * 100)), 'aria-label': aria });
    inp.addEventListener('input', () => { if (inp.value !== '') ctx.set(p, Math.max(0, Math.min(100, Number(inp.value))) / 100); });
    return h('span', { class: 'rf-inline' }, inp, '%');
  };
  const thrInput = (p, val) => {
    if (ro || val === null) return h('strong', {}, val === null ? '' : formatNumber(val));
    const inp = h('input', { type: 'number', class: 'rf-inline-num', step: '1', value: String(val), 'aria-label': tl('Threshold (days)', 'Ngưỡng (ngày)') });
    inp.addEventListener('input', () => { if (inp.value !== '') ctx.set(p, Number(inp.value)); });
    return inp;
  };
  return h('div', { class: 'table-wrap rf-table rf-bands' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, tl('When', 'Khi')), h('th', { scope: 'col', class: 'num' }, tl('Factor score', 'Điểm yếu tố')))),
    h('tbody', {},
      b.rows.map((r) => h('tr', {},
        h('td', {}, r.threshold === null ? `${factName(b.fact)} ${tl('is unknown', 'chưa có')}` : [`${factName(b.fact)} ${tl(OP[r.op])} `, thrInput([...abs, 'if', r.i, r.op, 1], r.threshold)]),
        h('td', { class: 'num' }, pctInput([...abs, 'if', r.i + 1], r.value, `${tl('Score', 'Điểm')} — ${factName(b.fact)} ${tl(OP[r.op])} ${r.threshold ?? ''}`)))),
      h('tr', {}, h('td', { class: 'muted' }, tl('Otherwise', 'Các trường hợp còn lại')), h('td', { class: 'num' }, pctInput([...abs, 'if', node.if.length - 1], b.otherwise, tl('Score otherwise', 'Điểm còn lại')))))));
}

function weightsEditor(ctx, abs) {
  const ro = ctx.readOnly;
  const total = h('div', { class: 'rf-total' });
  const bars = [];
  const paintTotal = () => {
    const rows = getIn(ctx.value, abs) || [];
    const sum = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
    const ok = Math.abs(sum - 100) < 0.001;
    mount(total, h('span', { class: 'rf-total-label' }, tl('Total weight', 'Tổng trọng số')),
      h('span', { class: `rf-total-value ${ok ? 'ok' : 'danger'}` }, `${formatNumber(sum, { decimals: Number.isInteger(+sum.toFixed(1)) ? 0 : 1 })} / 100`),
      ok ? badge(tl('Weights total 100', 'Tổng trọng số bằng 100'), 'ok', { icon: 'check' }) : badge(tl(`Must total 100 (${sum > 100 ? '+' : ''}${formatNumber(sum - 100, { decimals: 1 })})`, `Tổng phải bằng 100 (${sum > 100 ? '+' : ''}${formatNumber(sum - 100, { decimals: 1 })})`), 'danger', { icon: 'alert-triangle' }));
    rows.forEach((r, i) => { if (bars[i]) bars[i].style.width = `${Math.max(0, Math.min(100, Number(r.weight) || 0))}%`; });
  };
  const rows = getIn(ctx.value, abs) || [];
  const list = h('div', { class: 'rf-weights' }, rows.map((r, i) => {
    const wAbs = [...abs, i, 'weight'];
    const bar = h('span', { class: 'rf-wbar-fill' });
    bars[i] = bar;
    let control;
    if (ro) control = h('span', { class: 'rf-wval num' }, formatNumber(r.weight));
    else {
      const range = h('input', { type: 'range', min: '0', max: '60', step: '1', value: String(r.weight), 'aria-label': `${factorName(r)} — ${tl('weight', 'trọng số')}` });
      const num = h('input', { type: 'number', class: 'sm rf-wnum', min: '0', max: '100', step: '1', value: String(r.weight), 'aria-label': `${factorName(r)} — ${tl('weight', 'trọng số')}` });
      range.addEventListener('input', () => { num.value = range.value; ctx.set(wAbs, Number(range.value)); });
      num.addEventListener('input', () => { if (num.value === '') return; range.value = num.value; ctx.set(wAbs, Number(num.value)); });
      control = h('div', { class: 'rf-wctl' }, range, num);
    }
    const err = h('div', { class: 'error', role: 'alert' });
    ctx.reg(pkey(wAbs), (msg) => mount(err, msg ? [icon('alert-circle', { size: 14 }), msg] : null));
    const how = h('details', { class: 'rf-how' }, h('summary', {}, icon('chevron-right', { size: 14 }), tl('How it is measured', 'Cách tính')),
      h('div', { class: 'rf-how-body' }, parseBands(r.value) ? bandsEditor(ctx, [...abs, i, 'value'], ro) : h('p', { class: 'muted small' }, factorExplain(r.key))));
    return h('div', { class: 'rf-wrow' },
      h('div', { class: 'rf-wname' }, h('span', { class: 'strong' }, factorName(r)), h('span', { class: 'rf-wbar', 'aria-hidden': 'true' }, bar)),
      control, err, how);
  }));
  const totalErr = h('div', { class: 'error', role: 'alert' });
  ctx.reg(pkey(abs), (msg) => { mount(totalErr, msg ? [icon('alert-circle', { size: 14 }), msg] : null); total.classList.toggle('rf-invalid', !!msg); });
  ctx.live(paintTotal);
  return h('div', { class: 'rf-weights-wrap' }, list, total, totalErr);
}
function factorExplain(key) {
  const x = {
    expiryConfidence: ['How sure we are of the expiry date (verified certificate = 100%).', 'Mức chắc chắn của ngày hết hạn (giấy chứng nhận đã xác minh = 100%).'],
    engagement: ['VETC app sessions and toll trips in the last 30 days.', 'Số lần mở ứng dụng VETC và lượt qua trạm trong 30 ngày.'],
    reachability: ['App notifications, Zalo and phone with call consent.', 'Thông báo ứng dụng, Zalo và điện thoại có đồng ý nhận cuộc gọi.'],
    affinity: ['Prior VETC purchases, TASCO customer, wallet balance; complaints reduce it.', 'Đã mua trên VETC, là khách TASCO, số dư ví; khiếu nại làm giảm điểm.'],
  }[key];
  return x ? tl(x) : tl('Calculated by a formula maintained by the analytics team.', 'Tính theo công thức do nhóm phân tích quản lý.');
}

function copyGuardTester(ctx) {
  const inp = h('input', { type: 'text', placeholder: tl('e.g. Gia hạn ngay, giảm giá 10%', 'vd. Gia hạn ngay, giảm giá 10%'), maxlength: '300' });
  const out = h('div', { class: 'rf-guard-out', 'aria-live': 'polite' });
  const paint = () => {
    if (!inp.value.trim()) { mount(out); return; }
    const hits = copyGuardHits(inp.value, getIn(ctx.value, ['bannedPhrases']) || []);
    mount(out, hits.length ? badge(tl(`Blocked: “${hits.join('”, “')}”`, `Bị chặn: “${hits.join('”, “')}”`), 'danger', { icon: 'x-circle' }) : badge(tl('Allowed', 'Được phép'), 'ok', { icon: 'check' }));
  };
  inp.addEventListener('input', paint);
  ctx.live(paint);
  return formField({ label: tl('Try a sentence', 'Thử một câu'), control: inp, help: tl('Checks the phrases above as you type', 'Kiểm tra theo danh sách bên trên khi bạn nhập') });
}

/* =========================================================================
 * Client-side validation (instant feedback, plain language)
 * ========================================================================= */

function clientValidate(kind, v, banned) {
  const errs = [];
  const desc = descriptorFor(kind, v);
  const walkFields = (fields, base) => {
    for (const f of fields || []) {
      const abs = [...base, ...f.path];
      if (f.kind === 'group') { walkFields(f.fields, abs); continue; }
      if (f.kind === 'table') { (getIn(v, abs) || []).forEach((_r, i) => walkFields(f.columns, [...abs, i])); continue; }
      if (f.kind === 'mapTable') { Object.keys(getIn(v, abs) || {}).forEach((k) => walkFields(f.columns, [...abs, k])); continue; }
      if (f.kind === 'items') {
        const coll = getIn(v, abs) || {};
        const keys = f.map ? Object.keys(coll) : coll.map((_, i) => i);
        keys.forEach((k) => walkFields(typeof f.fields === 'function' ? f.fields(coll[k]) : f.fields, [...abs, k]));
        continue;
      }
      if (f.kind === 'message') {
        const paths = f.pair ? [[...abs, f.pair.vi], [...abs, f.pair.en]] : [[...abs, 'vi'], [...abs, 'en']];
        for (const p of paths) {
          const text = getIn(v, p);
          if (typeof text !== 'string') continue;
          if (!text.trim()) errs.push({ path: pkey(p), message: tl('Enter the message text', 'Nhập nội dung tin nhắn') });
          const hits = copyGuardHits(text, banned);
          if (hits.length) errs.push({ path: pkey(p), message: tl(`Not allowed in customer messages: “${hits.join('”, “')}”`, `Không được dùng trong nội dung gửi khách hàng: “${hits.join('”, “')}”`) });
        }
        continue;
      }
      if (f.kind === 'number') {
        const x = getIn(v, abs);
        if (x === undefined || x === null) continue;
        const shown = x * (f.scale || 1);
        if (f.min !== undefined && shown < f.min) errs.push({ path: pkey(abs), message: tl(`Must be at least ${formatNumber(f.min)}`, `Tối thiểu ${formatNumber(f.min)}`) });
        if (f.max !== undefined && shown > f.max) errs.push({ path: pkey(abs), message: tl(`Must be at most ${formatNumber(f.max)}`, `Tối đa ${formatNumber(f.max)}`) });
      }
      if (f.kind === 'chips' && !f.emptyText && Array.isArray(getIn(v, abs)) && !getIn(v, abs).length) errs.push({ path: pkey(abs), message: tl('Choose at least one', 'Chọn ít nhất một mục') });
    }
  };
  for (const s of desc.sections) walkFields(s.fields, []);
  if (kind === 'scoring') {
    if (!(v.tiers?.hot > v.tiers?.warm)) errs.push({ path: 'tiers.hot', message: tl('Must be higher than the warm lead threshold', 'Phải cao hơn ngưỡng khách hàng ấm') });
    const sum = (v.factors || []).reduce((s, f) => s + (Number(f.weight) || 0), 0);
    if (Math.abs(sum - 100) > 0.001) errs.push({ path: 'factors', message: tl(`Weights add up to ${formatNumber(sum, { decimals: 1 })}; they must total 100`, `Tổng trọng số là ${formatNumber(sum, { decimals: 1 })}; phải bằng 100`) });
    if ((v.damping?.base || 0) + (v.damping?.byExpiryConfidence || 0) > 1.0001) errs.push({ path: 'damping.byExpiryConfidence', message: tl('Together with the share always kept this cannot exceed 100%', 'Cộng với phần luôn giữ không được vượt 100%') });
  }
  if (kind === 'contact_policy') {
    const w = v.contactWindow || {};
    if (!(w.startHour < w.endHour)) errs.push({ path: 'contactWindow.endHour', message: tl('Must be later than the earliest contact time', 'Phải muộn hơn giờ bắt đầu liên hệ') });
  }
  if (kind === 'commission') {
    (v.table?.rules || []).forEach((r, i) => {
      const cap = capFor(v, r);
      if (cap !== null && r.then?.rate > cap) errs.push({ path: `table.rules.${i}.then.rate`, message: tl(`Above the statutory cap of ${pct(cap, 1)}`, `Vượt mức trần luật định ${pct(cap, 1)}`) });
    });
  }
  return errs;
}

/* =========================================================================
 * Server validation messages → plain language attached to fields
 * ========================================================================= */

/** "$.journeys[2].steps[0].when" → "journeys.2.steps.0.when". */
const dollarPath = (p) => String(p).replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');

export function explainErrors(kind, errors, payload) {
  return (errors || []).map((e) => {
    let m;
    if ((m = /^tiers\.hot must be greater than tiers\.warm/.exec(e))) return { path: 'tiers.hot', message: tl('Must be higher than the warm lead threshold', 'Phải cao hơn ngưỡng khách hàng ấm') };
    if ((m = /factor weights must sum to 100 \(got ([\d.-]+)\)/.exec(e))) return { path: 'factors', message: tl(`Weights add up to ${m[1]}; they must total 100`, `Tổng trọng số là ${m[1]}; phải bằng 100`) };
    if ((m = /^copy guard: "(.+)" in "(.+)…"$/.exec(e))) {
      const where = findString(payload, m[2]);
      return { path: where || '', message: tl(`Not allowed in customer messages: “${m[1]}”`, `Không được dùng trong nội dung gửi khách hàng: “${m[1]}”`) };
    }
    if (/contactWindow invalid/.test(e)) return { path: 'contactWindow.endHour', message: tl('Contact hours must start before they end (00:00–24:00)', 'Giờ bắt đầu phải trước giờ kết thúc (00:00–24:00)') };
    if ((m = /^rule (\S+): rate ([\d.]+) exceeds statutory cap ([\d.]+) for (\S+)/.exec(e))) {
      const i = (payload?.table?.rules || []).findIndex((r) => r.id === m[1]);
      return { path: i >= 0 ? `table.rules.${i}.then.rate` : 'table.rules', message: tl(`Above the statutory cap of ${pct(Number(m[3]), 1)} for ${label('product', m[4])}`, `Vượt mức trần ${pct(Number(m[3]), 1)} cho ${label('product', m[4])}`) };
    }
    if ((m = /^journey (\S+) step (\S+): channels required/.exec(e))) {
      const j = (payload?.journeys || []).findIndex((x) => x.id === m[1]);
      const s = j >= 0 ? payload.journeys[j].steps.findIndex((x) => String(x.step) === m[2]) : -1;
      return { path: j >= 0 && s >= 0 ? `journeys.${j}.steps.${s}.channels` : 'journeys', message: tl('Choose at least one channel', 'Chọn ít nhất một kênh') };
    }
    if ((m = /^journey (\S+): bad anchor/.exec(e))) { const j = (payload?.journeys || []).findIndex((x) => x.id === m[1]); return { path: `journeys.${j}.anchor`, message: tl('Choose when the steps are timed from', 'Chọn mốc tính thời gian') }; }
    if ((m = /^duplicate journey (\S+)/.exec(e))) return { path: 'journeys', message: tl('Two journeys have the same identifier', 'Hai hành trình trùng mã') };
    if (/vatRate must be/.test(e)) return { path: 'vatRate', message: tl('VAT must be between 0% and 20%', 'Thuế GTGT phải từ 0% đến 20%') };
    if ((m = /^category (\S+): annual must be a positive integer/.exec(e))) return { path: `categories.${m[1]}.annual`, message: tl('Enter a whole amount above 0', 'Nhập số tiền nguyên lớn hơn 0') };
    if ((m = /^(\S+): channels\[\] required/.exec(e))) { const i = (payload?.products || []).findIndex((p) => p.code === m[1]); return { path: `products.${i}.channels`, message: tl('Choose at least one sales channel', 'Chọn ít nhất một kênh bán') }; }
    if ((m = /^bundle (\S+) references unknown product (\S+)/.exec(e))) return { path: 'bundles', message: tl(`A bundle includes a product that is not in the catalogue`, `Gói có sản phẩm không có trong danh mục`) };
    if ((m = /^(\$[^:\s]*)(?::|\s)/.exec(e))) return { path: dollarPath(m[1]), message: tl('This condition or formula is not valid — ask a technical colleague to review it', 'Điều kiện hoặc công thức không hợp lệ — đề nghị cán bộ kỹ thuật kiểm tra') };
    return { path: '', message: tl('The rule set could not be validated. Please review the highlighted settings.', 'Không thể kiểm tra bộ quy tắc. Vui lòng xem lại các thiết lập.') };
  });
}
function findString(node, snippet, path = []) {
  if (typeof node === 'string') return node.slice(0, 60) === snippet || node.startsWith(snippet) ? pkey(path) : null;
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const r = findString(node[i], snippet, [...path, i]); if (r) return r; } return null; }
  if (isObj(node)) { for (const [k, v] of Object.entries(node)) { const r = findString(v, snippet, [...path, k]); if (r) return r; } }
  return null;
}

/* =========================================================================
 * "What changes" — business-language diff driven by the descriptors
 * ========================================================================= */

/** Build pathKey → {label, fmt} for every field the descriptor knows, for a given payload. */
function labelIndex(kind, v) {
  const idx = new Map();
  const desc = descriptorFor(kind, v);
  const put = (abs, lab, fmt, f, row) => idx.set(pkey(abs), { label: lab, fmt: fmt || ((x) => displayValue(f, x, row, v)) });
  const walk = (fields, base, prefix, row) => {
    for (const f of fields || []) {
      if (f.noDiff) continue;
      const abs = [...base, ...f.path];
      const lab = [prefix, L(f.label)].filter(Boolean).join(' · ');
      if (f.kind === 'group') { walk(f.fields, abs, lab); continue; }
      if (f.kind === 'custom') {
        if (f.labels) for (const [rel, l2, fmt] of f.labels(getIn(v, abs) || [])) put([...abs, ...rel], [prefix, l2].filter(Boolean).join(' · '), fmt || ((x) => (typeof x === 'object' ? formulaText(x) : String(x ?? '—'))));
        continue;
      }
      if (f.kind === 'table') {
        (getIn(v, abs) || []).forEach((r, i) => {
          const rl = [prefix, f.rowLabel ? f.rowLabel(r) : `${L(f.label)} ${i + 1}`].filter(Boolean).join(' · ');
          idx.set(`${pkey([...abs, i])}#row`, { label: rl });
          walk(f.columns.filter((c) => c.kind !== 'custom'), [...abs, i], rl, r);
        });
        continue;
      }
      if (f.kind === 'mapTable') { const obj = getIn(v, abs) || {}; for (const k of Object.keys(obj)) walk(f.columns, [...abs, k], [prefix, f.keyLabel(k, obj[k])].filter(Boolean).join(' · '), obj[k]); continue; }
      if (f.kind === 'items') {
        const coll = getIn(v, abs) || {};
        const keys = f.map ? Object.keys(coll) : coll.map((_, i) => i);
        for (const k of keys) {
          const il = [prefix, f.title(coll[k], k)].filter(Boolean).join(' · ');
          idx.set(`${pkey([...abs, k])}#row`, { label: il });
          walk(typeof f.fields === 'function' ? f.fields(coll[k]) : f.fields, [...abs, k], il, coll[k]);
        }
        continue;
      }
      if (f.kind === 'message') {
        const pair = f.pair || { vi: 'vi', en: 'en' };
        put([...abs, pair.vi], `${prefix ? `${prefix} · ` : ''}${tl('Vietnamese text', 'Nội dung tiếng Việt')}`, (x) => String(x ?? '—'));
        put([...abs, pair.en], `${prefix ? `${prefix} · ` : ''}${tl('English text', 'Nội dung tiếng Anh')}`, (x) => String(x ?? '—'));
        continue;
      }
      if (f.kind === 'offset') { put(abs, lab, (x) => (x === undefined ? '—' : offsetText(x, f.anchorFrom ? f.anchorFrom() : getIn(v, base.slice(0, base.length - 2))?.anchor))); continue; }
      put(abs, lab, null, f, row);
    }
  };
  for (const s of desc.sections) walk(s.fields, [], '');
  return idx;
}

const identityOf = (item) => {
  if (Array.isArray(item) && typeof item[0] === 'string') return item[0];
  if (!isObj(item)) return null;
  return item.id ?? item.key ?? item.code ?? item.entity ?? item.event ?? (item.step !== undefined ? `${item.step}` : null);
};

/** Flatten a payload to leaves keyed by identity paths (array rows matched by id/key/code, not position). */
function flatten(v) {
  const leaves = new Map(); // idKey → { ipath, value }
  const rows = new Map(); // idKey of row → { ipath }
  const orders = new Map(); // idKey of ordered array → [ids]
  const walk = (node, ipath, idpath, parentKey) => {
    if (LOGIC_KEYS.has(parentKey) && (isObj(node) || Array.isArray(node))) { leaves.set(idpath.join('/'), { ipath, value: node }); return; }
    if (Array.isArray(node)) {
      if (node.every((x) => x === null || typeof x !== 'object')) { leaves.set(idpath.join('/'), { ipath, value: node }); return; }
      const ids = node.map(identityOf);
      const unique = ids.every((x) => x !== null && x !== undefined) && new Set(ids).size === ids.length;
      if (unique && parentKey === 'rules') orders.set(idpath.join('/'), ids.map(String));
      node.forEach((x, i) => {
        const seg = unique ? `#${ids[i]}` : `[${i}]`;
        rows.set([...idpath, seg].join('/'), { ipath: [...ipath, i] });
        walk(x, [...ipath, i], [...idpath, seg], null);
      });
      return;
    }
    if (isObj(node)) { for (const [k, x] of Object.entries(node)) walk(x, [...ipath, k], [...idpath, k], k); return; }
    leaves.set(idpath.join('/'), { ipath, value: node });
  };
  walk(v, [], [], null);
  return { leaves, rows, orders };
}

function genericLabel(v, ipath) {
  const parts = [];
  let node = v;
  for (const seg of ipath) {
    const next = node?.[seg];
    if (typeof seg === 'number') parts.push(rowTitle(next) || String(seg + 1));
    else if (!(Array.isArray(next) && Array.isArray(node))) parts.push(humanise(seg));
    node = next;
  }
  return parts.filter(Boolean).join(' · ');
}
function genericFmt(key, x) {
  if (x === undefined) return '—';
  if (LOGIC_KEYS.has(key) && x !== null && typeof x === 'object') return CONDITION_KEYS.has(key) ? conditionText(x) : formulaText(x);
  if (typeof x === 'boolean') return yesNo(x);
  if (typeof x === 'number') return formatNumber(x, { decimals: 4 });
  if (Array.isArray(x)) return x.map((y) => (typeof y === 'object' ? '…' : String(y))).join(', ') || '—';
  return String(x);
}

/**
 * Business-language change list between two payloads of the same kind.
 * @returns {Array<{label: string, from: string, to: string, type: 'changed'|'added'|'removed'|'moved'}>}
 */
export function describeChanges(kind, before, after) {
  if (!before || !after) return [];
  const A = flatten(before);
  const B = flatten(after);
  const ia = labelIndex(kind, before);
  const ib = labelIndex(kind, after);
  const out = [];
  const rowLabel = (idx, v, ipath) => idx.get(`${pkey(ipath)}#row`)?.label || genericLabel(v, ipath);
  const addedRows = [...B.rows.keys()].filter((k) => !A.rows.has(k) && k.split('/').pop().startsWith('#'));
  const removedRows = [...A.rows.keys()].filter((k) => !B.rows.has(k) && k.split('/').pop().startsWith('#'));
  const under = (k, list) => list.some((r) => k === r || k.startsWith(`${r}/`));
  for (const r of addedRows) if (!under(r.split('/').slice(0, -1).join('/'), addedRows)) out.push({ type: 'added', label: rowLabel(ib, after, B.rows.get(r).ipath), from: '', to: tl('Added', 'Thêm mới') });
  for (const r of removedRows) if (!under(r.split('/').slice(0, -1).join('/'), removedRows)) out.push({ type: 'removed', label: rowLabel(ia, before, A.rows.get(r).ipath), from: tl('Present', 'Có'), to: tl('Removed', 'Đã xóa') });
  const keys = new Set([...A.leaves.keys(), ...B.leaves.keys()]);
  for (const k of keys) {
    if (under(k, addedRows) || under(k, removedRows)) continue;
    const a = A.leaves.get(k);
    const b = B.leaves.get(k);
    if (JSON.stringify(a?.value) === JSON.stringify(b?.value)) continue;
    const ipath = (b || a).ipath;
    const meta = (b ? ib : ia).get(pkey(ipath)) || (a ? ia.get(pkey(a.ipath)) : null);
    const lastKey = String(ipath[ipath.length - 1]);
    const labelText = meta?.label || genericLabel(b ? after : before, ipath);
    const fmtA = a ? ((ia.get(pkey(a.ipath)) || meta)?.fmt || ((x) => genericFmt(lastKey, x))) : null;
    const fmtB = b ? (meta?.fmt || ((x) => genericFmt(lastKey, x))) : null;
    out.push({ type: 'changed', label: labelText, from: a ? safe(fmtA, a.value) : '—', to: b ? safe(fmtB, b.value) : '—' });
  }
  for (const [k, ids] of B.orders) {
    const prev = A.orders.get(k);
    if (!prev) continue;
    ids.forEach((id, i) => {
      const j = prev.indexOf(id);
      if (j >= 0 && j !== i) {
        const ipath = B.rows.get(`${k}/#${id}`)?.ipath;
        out.push({ type: 'moved', label: `${ipath ? rowLabel(ib, after, ipath) : humanise(id)} · ${tl('position', 'thứ tự')}`, from: String(j + 1), to: String(i + 1) });
      }
    });
  }
  return out;
}
function safe(fmt, x) { try { const r = fmt(x); return r === undefined || r === null || r === '' ? '—' : String(r); } catch { return '—'; } }

/**
 * True when the kind's form can show every part of the payload. A payload carrying top-level settings the
 * descriptor does not know (added through the advanced editor) cannot be represented by the form.
 */
export function canRepresent(kind, payload) {
  const desc = DESCRIPTORS[kind];
  if (!desc || !isObj(payload)) return true;
  const known = new Set(['hitPolicy', 'currency']);
  const collect = (fields) => { for (const f of fields || []) { if (f.path?.length) known.add(String(f.path[0])); if (f.kind === 'group') collect(f.fields); } };
  for (const sct of desc.sections) collect(sct.fields);
  return Object.keys(payload).every((k) => known.has(k));
}

/** Banner shown above pricing forms when rates are owned by TASCO core. */
export function coreOwnedBanner() {
  return banner({ tone: 'info', icon: 'lock', title: tl('Owned by TASCO core', 'Do TASCO core quản lý'), text: tl('Live prices come from TASCO core. Rates here are shown for reference and cannot be edited.', 'Giá bán thực tế lấy từ TASCO core. Biểu phí tại đây chỉ để tham khảo, không chỉnh sửa được.') });
}
