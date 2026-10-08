import { h, mount, fmtVnd, fmtDate, fmtDateTime, fmtPeriod } from '../shared/dom.js';
import { labelIn } from '../shared/i18n.js';
import { createApi, idempotencyKey } from '../shared/api.js';
import { qrSvg } from '../shared/qr.js';
import { icon } from '../shared/icons.js';
import { wordmark } from '../shared/brand.js';

/**
 * Customer app — TASCO Insurance × VETC. Opens inside the VETC super-app (or Zalo mini app) WebView
 * from a signed renewal link. Vietnamese only, mobile-first (360–430px).
 *
 * Routes (hash): home · policies · claims · claims/new · account · buy[?quote=ID] · confirm
 * Tab pages share the bottom tab bar; task flows (buy, claim, confirm) take the full screen with a
 * back button and a sticky action bar. All DOM is built with h()/mount() (no innerHTML, CSP-safe).
 */

/** Support hotline and e-mail from server configuration (SUPPORT_HOTLINE / SUPPORT_EMAIL); null hides the actions. */
let HOTLINE = null;
let SUPPORT_EMAIL = null;
/** Support web links (https only); null hides the row. */
const SUPPORT_LINKS = { website: null, zalo: null, messenger: null };
const safeUrl = (u) => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
function setHotline(meta) {
  SUPPORT_LINKS.website = safeUrl(meta?.supportWebsite);
  SUPPORT_LINKS.zalo = safeUrl(meta?.supportZaloUrl);
  SUPPORT_LINKS.messenger = safeUrl(meta?.supportMessengerUrl);
  const raw = String(meta?.supportHotline || '').trim();
  HOTLINE = raw ? { display: raw, tel: raw.replace(/[^0-9+]/g, '') } : null;
  const mail = String(meta?.supportEmail || '').trim();
  SUPPORT_EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(mail) ? mail : null;
}

/**
 * Host channel: the same app runs inside the VETC app, the Zalo mini app, the TASCO app and the TASCO website.
 * Read from ?channel= (allowlist only), kept in sessionStorage, sent with the session request. Wording follows it.
 */
const CHANNELS = ['vetc_app', 'zalo_mini_app', 'tasco_app', 'tasco_web'];
const HOSTS = {
  vetc_app: { open: 'ứng dụng VETC', via: 'ứng dụng VETC', partner: 'VETC', tascoPay: false },
  zalo_mini_app: { open: 'Zalo Mini App VETC', via: 'Zalo Mini App VETC', partner: 'VETC', tascoPay: false },
  tasco_app: { open: 'ứng dụng Bảo hiểm TASCO', via: 'ứng dụng Bảo hiểm TASCO', partner: null, tascoPay: true },
  tasco_web: { open: 'website Bảo hiểm TASCO', via: 'website Bảo hiểm TASCO', partner: null, tascoPay: true },
};
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const state = { token: null, meta: null, home: null, entryError: null, channel: 'vetc_app' };
state.token = store.get('ctoken');
{
  const q = new URLSearchParams(location.search).get('channel');
  const stored = store.get('cchannel');
  state.channel = CHANNELS.includes(q) ? q : CHANNELS.includes(stored) ? stored : 'vetc_app';
  store.set('cchannel', state.channel);
}
const host = () => HOSTS[state.channel] || HOSTS.vetc_app;
/** Payment method wording for the current host. */
const payMethod = () => (host().tascoPay ? 'Thanh toán qua cổng TASCO' : 'Ví VETC');
const api = createApi({ getToken: () => state.token });

// ---------------------------------------------------------------- helpers
const ic = (name, size = 20, extra) => icon(name, { size, ...(extra || {}) });
const vi = (group, code) => labelIn('vi', group, code);
const today = () => state.meta?.today || new Date().toISOString().slice(0, 10);
const dayMs = 86400000;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);

const PRODUCT = {
  TNDS_CAR: { short: 'Bảo hiểm TNDS bắt buộc', icon: 'shield-check', tone: '' },
  TNDS_MOTORBIKE: { short: 'Bảo hiểm TNDS bắt buộc', icon: 'shield-check', tone: '' },
  PA_SEAT: { short: 'Tai nạn người ngồi trên xe', icon: 'users', tone: 'teal' },
  MOTOR_PD: { short: 'Vật chất xe', icon: 'car', tone: 'amber' },
};
const productName = (x) => x.productNameVi || vi('product', x.product);
const productIcon = (code, size = 20) => h('span', { class: `c-ichip ${PRODUCT[code]?.tone || ''}` }, ic(PRODUCT[code]?.icon || 'shield', size));
const isTnds = (code) => String(code || '').startsWith('TNDS');

const BENEFIT_ICON = { roadside_24_7: ['truck', ''], e_certificate: ['qr-code', 'teal'], auto_renew: ['refresh', 'green'], inspection_assist: ['wrench', 'amber'], claims_fast_lane: ['zap', 'amber'], loyalty_points: ['star', 'amber'], multi_year: ['calendar', 'teal'], upsell_pa_seat: ['users', 'teal'], upsell_motor_pd: ['car', ''], fleet_dashboard: ['layout-dashboard', ''] };

const CLAIM_STEPS = ['Đã gửi', 'Tiếp nhận', 'Giám định', 'Duyệt', 'Chi trả'];
const CLAIM_INDEX = { submitted: 0, acknowledged: 1, assessor_assigned: 2, under_assessment: 2, approved: 3, rejected: 3, paid: 4 };
const CLAIM_CHIP = { submitted: ['info', 'Đã gửi'], acknowledged: ['info', 'Đã tiếp nhận'], assessor_assigned: ['info', 'Đã phân công giám định'], under_assessment: ['warn', 'Đang giám định'], approved: ['ok', 'Đã duyệt'], paid: ['ok', 'Đã chi trả'], rejected: ['danger', 'Từ chối'] };
const CLAIM_NEXT = {
  submitted: 'TASCO đang xem xét yêu cầu và sẽ liên hệ với bạn.',
  acknowledged: 'Yêu cầu đã được tiếp nhận. TASCO đang phân công giám định viên.',
  assessor_assigned: 'Giám định viên sẽ liên hệ để hẹn lịch xem xe.',
  under_assessment: 'Giám định viên đang đánh giá thiệt hại.',
  approved: 'Yêu cầu đã được duyệt. TASCO đang chuyển tiền bồi thường.',
  paid: 'Tiền bồi thường đã được chi trả.',
  rejected: 'Yêu cầu không thuộc phạm vi bảo hiểm. Gọi tổng đài để được giải thích chi tiết.',
};
const DEMO_JOURNEY = { renewal: 'Sắp đến hạn tái tục', lapsed_uninsured: 'Xe đang không có bảo hiểm', new_vehicle: 'Xe mới, chưa có bảo hiểm', conquest: 'Đang bảo hiểm ở công ty khác', cross_sell: 'Đã mua, gợi ý thêm quyền lợi' };

const chip = (tone, text) => h('span', { class: `c-chip ${tone || ''}` }, text);
const plateTag = (plate, size = '') => h('span', { class: `c-plate ${size}`, 'aria-label': `Biển số ${plate}` }, plate);
const insurerName = (x) => (!x ? null : x === 'TASCO' ? 'Bảo hiểm TASCO' : x === 'OTHER' ? 'Công ty bảo hiểm khác' : x);
const categoryText = (v) => {
  const cat = v.category ? vi('category', v.category).replace(/\s*\(không kinh doanh\)/, '') : 'Ô tô';
  return [cat, v.firstRegisteredYear ? `Đăng ký ${v.firstRegisteredYear}` : null, v.province].filter(Boolean).join(' · ');
};

/** Vietnamese, customer-friendly message for any API error. Never shows English or codes. */
function viError(ex) {
  const m = String(ex?.message || '');
  if (ex?.status === 401) return `Phiên làm việc đã hết hạn. Vui lòng mở lại từ ${host().open}.`;
  if (ex?.status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
  if (ex?.status === 503 || ex?.status === 502 || ex?.status === 504) return 'Hệ thống TASCO đang bận. Vui lòng thử lại sau ít phút.';
  if (/indicative/i.test(m)) return 'Giá tạm tính cần được xác nhận trước khi thanh toán.';
  if (/inspection/i.test(m)) return 'Bảo hiểm vật chất xe cần giám định xe trước khi thanh toán.';
  if (/expired/i.test(m)) return 'Báo giá đã hết hạn. Vui lòng xem lại phí để nhận báo giá mới.';
  if (/outside the policy period/i.test(m)) return 'Ngày xảy ra nằm ngoài thời hạn bảo hiểm của hợp đồng đã chọn.';
  if (/already being paid|converted|paying/i.test(m)) return 'Báo giá này đã được thanh toán hoặc đang xử lý.';
  if (/not found/i.test(m)) return 'Không tìm thấy thông tin. Vui lòng tải lại trang.';
  if (ex instanceof TypeError) return 'Không có kết nối mạng. Vui lòng kiểm tra và thử lại.';
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

function toast(msg, kind = 'info') {
  const name = kind === 'ok' ? 'check-circle' : kind === 'danger' ? 'alert-circle' : 'info';
  const el = h('div', { class: `toast ${kind}`, role: kind === 'danger' ? 'alert' : 'status' }, h('span', { class: 'toast-icon' }, ic(name, 20)), h('div', { class: 'toast-body' }, msg));
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 5000);
}

function busy(btn, on) {
  if (!btn) return;
  if (on) { btn.setAttribute('aria-busy', 'true'); btn.disabled = true; } else { btn.removeAttribute('aria-busy'); btn.disabled = false; }
}

const notice = (tone, iconName, title, text, actions) => h('div', { class: `c-notice ${tone}`, role: tone === 'danger' ? 'alert' : null },
  ic(iconName, 20), h('div', { class: 'c-notice-body' }, title ? h('p', { class: 'c-notice-title' }, title) : null, text ? h('p', { class: 'c-notice-text' }, text) : null,
    actions ? h('div', { class: 'c-notice-actions' }, actions) : null));

const emptyState = (iconName, title, text, action) => h('div', { class: 'c-empty' }, h('span', { class: 'c-ichip' }, ic(iconName, 26)), h('h3', {}, title), text ? h('p', {}, text) : null, action);

function successMark() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 56 56'); svg.setAttribute('aria-hidden', 'true');
  const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', '28'); c.setAttribute('cy', '28'); c.setAttribute('r', '24');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M17 29l7.5 7.5L40 21');
  svg.append(c, p);
  return h('div', { class: 'c-success-mark' }, svg);
}

/** Countdown ring: fraction of the year of cover left. */
function ring(tone, fraction, center, unit, label) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 80 80'); svg.setAttribute('aria-hidden', 'true');
  const r = 34; const len = 2 * Math.PI * r;
  const mk = (cls) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', '40'); c.setAttribute('cy', '40'); c.setAttribute('r', String(r)); c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '7'); c.setAttribute('class', cls); return c; };
  const track = mk('c-ring-track');
  const val = mk('c-ring-val');
  val.setAttribute('stroke-linecap', 'round');
  val.setAttribute('stroke-dasharray', String(len));
  val.setAttribute('stroke-dashoffset', String(len * (1 - Math.max(0, Math.min(1, fraction)))));
  svg.append(track, val);
  return h('div', { class: `c-ring ${tone}`, role: 'img', 'aria-label': label },
    svg, h('div', { class: 'c-ring-center', 'aria-hidden': 'true' }, typeof center === 'string' || typeof center === 'number' ? h('span', { class: 'c-ring-num' }, String(center)) : center, unit ? h('span', { class: 'c-ring-unit' }, unit) : null));
}

// ---------------------------------------------------------------- overlays (sheet, QR)
let overlayReturn = null;
function trapFocus(container, onClose) {
  const focusables = () => [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0]; const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/** Bottom sheet dialog. Returns { close }. */
function openSheet({ title, sub, body, actions, dismissible = true, onClose }) {
  overlayReturn = document.activeElement;
  const titleId = `sheet-${Math.random().toString(36).slice(2, 8)}`;
  const close = () => { scrim.remove(); document.body.classList.remove('c-locked'); overlayReturn?.focus?.(); onClose?.(); };
  const sheet = h('div', { class: 'c-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('div', { class: 'c-sheet-grab', 'aria-hidden': 'true' }),
    h('div', { class: 'c-sheet-head' }, h('h2', { id: titleId, tabindex: '-1' }, title),
      dismissible ? h('button', { class: 'c-iconbtn', type: 'button', 'aria-label': 'Đóng', onclick: close }, ic('x', 22)) : null),
    sub ? h('p', { class: 'c-sheet-sub' }, sub) : null,
    body,
    actions ? h('div', { class: 'c-sheet-actions' }, actions) : null);
  const scrim = h('div', { class: 'c-scrim', onclick: (e) => { if (e.target === scrim && dismissible) close(); } }, sheet);
  trapFocus(sheet, () => { if (dismissible) close(); });
  document.body.append(scrim);
  document.body.classList.add('c-locked');
  (sheet.querySelector('.c-sheet-actions .c-btn') || sheet.querySelector('h2')).focus();
  return { close };
}

/** Full-screen certificate QR (for police / inspectors). */
function openQr(p, plate) {
  overlayReturn = document.activeElement;
  const close = () => { el.remove(); document.body.classList.remove('c-locked'); overlayReturn?.focus?.(); };
  const el = h('div', { class: 'c-qrfull', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'qr-title' },
    h('div', { class: 'c-qrfull-bar' }, wordmark({ size: 'sm', variant: 'navy' }),
      h('button', { class: 'c-iconbtn', type: 'button', 'aria-label': 'Đóng mã QR', onclick: close }, ic('x', 24))),
    h('h2', { class: 'c-qrfull-title', id: 'qr-title', tabindex: '-1' }, 'Giấy chứng nhận điện tử'),
    h('p', { class: 'c-qrfull-sub' }, productName(p)),
    h('div', { class: 'c-qrfull-code' }, qrSvg(p.certificateUrl, { size: 320, label: `Mã QR tra cứu giấy chứng nhận ${p.certNo}` })),
    h('dl', { class: 'c-kv' },
      h('dt', {}, 'Số giấy chứng nhận'), h('dd', {}, p.certNo),
      plate ? [h('dt', {}, 'Biển số'), h('dd', {}, plate)] : null,
      h('dt', {}, 'Hiệu lực'), h('dd', {}, fmtPeriod(p.startDate, p.endDate))),
    h('p', { class: 'c-qrfull-hint' }, ic('info', 16), 'Xuất trình mã này khi được cơ quan chức năng kiểm tra.'));
  trapFocus(el, close);
  document.body.append(el);
  document.body.classList.add('c-locked');
  el.querySelector('h2').focus();
}

/** Save an e-certificate as a PNG image (canvas; QR drawn from an SVG data URL — CSP: img-src 'self' data:). */
async function saveCertificate(p, plate) {
  try {
    await document.fonts?.ready;
    const W = 1080; const H = 1520;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const font = (w, s) => `${w} ${s}px Inter, "Segoe UI", Roboto, Arial, sans-serif`;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, W, 300); grad.addColorStop(0, '#16224a'); grad.addColorStop(1, '#2c4386');
    g.fillStyle = grad; g.fillRect(0, 0, W, 300);
    const logo = await loadImage('/assets/tasco-logo-tight.png');
    g.fillStyle = '#ffffff'; roundRect(g, 64, 64, 260, 92, 18); g.fill();
    if (logo) { const lh = 60; const lw = (logo.width / logo.height) * lh; g.drawImage(logo, 64 + (260 - lw) / 2, 64 + 16, lw, lh); }
    g.fillStyle = '#ffffff'; g.font = font(700, 46); g.fillText('Giấy chứng nhận bảo hiểm', 64, 236);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = font(500, 30); g.fillText('Bản điện tử · TASCO Insurance × VETC', 64, 280);
    g.fillStyle = '#101828'; g.font = font(700, 40);
    let y = 380;
    for (const line of wrapText(g, productName(p), W - 128)) { g.fillText(line, 64, y); y += 52; }
    y += 16;
    const rows = [['Số giấy chứng nhận', p.certNo], ['Số hợp đồng', p.policyNo], ['Biển số xe', plate], ['Thời hạn bảo hiểm', fmtPeriod(p.startDate, p.endDate).replace(' ', ' ')], ['Doanh nghiệp bảo hiểm', 'Bảo hiểm TASCO']].filter((r) => r[1]);
    for (const [k, v] of rows) {
      g.fillStyle = '#475467'; g.font = font(500, 28); g.fillText(k, 64, y);
      g.fillStyle = '#101828'; g.font = font(600, 34); g.fillText(String(v), 64, y + 46); y += 104;
    }
    const svg = qrSvg(p.certificateUrl, { size: 520, label: 'QR' });
    const qrImg = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`);
    const qs = 420; const qx = (W - qs) / 2; const qy = Math.max(y + 20, 1000) - 40;
    if (qrImg) g.drawImage(qrImg, qx, qy, qs, qs);
    g.fillStyle = '#475467'; g.font = font(500, 26); g.textAlign = 'center';
    g.fillText('Quét mã để tra cứu hiệu lực giấy chứng nhận', W / 2, qy + qs + 44);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const a = h('a', { href: URL.createObjectURL(blob), download: `giay-chung-nhan-${p.certNo}.png` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Đã lưu giấy chứng nhận vào máy', 'ok');
  } catch { toast('Không lưu được ảnh. Bạn có thể chụp màn hình mã QR.', 'danger'); }
}
const loadImage = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
function roundRect(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrapText(g, text, max) {
  const out = []; let line = '';
  for (const w of String(text).split(' ')) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out;
}

// ---------------------------------------------------------------- frame
const route = () => {
  const raw = location.hash.replace(/^#\/?/, '') || 'home';
  const [path, q] = raw.split('?');
  return { path: path || 'home', query: Object.fromEntries(new URLSearchParams(q || '')) };
};

const TABS = [['home', 'home', 'Trang chủ'], ['policies', 'shield-check', 'Bảo hiểm của tôi'], ['claims', 'clipboard-check', 'Bồi thường'], ['account', 'user', 'Tài khoản']];
function tabbar(current) {
  return h('nav', { class: 'c-tabbar', 'aria-label': 'Điều hướng chính' },
    TABS.map(([r, ico, text]) => h('a', { class: 'c-tab', href: `#/${r}`, 'aria-current': current === r ? 'page' : null },
      h('span', { class: 'c-tab-icon' }, ic(ico, 22, { strokeWidth: current === r ? 2.1 : 1.75 })), h('span', { class: 'c-tab-label' }, text))));
}
/** Wordmark (stand-in TASCO logo, see shared/brand.js) and, inside VETC hosts, the "× VETC" co-brand. */
const brandMark = (variant = 'color') => h('span', { class: 'c-brand' },
  wordmark({ size: 'sm', variant }),
  host().partner ? [h('span', { class: 'c-brand-x', 'aria-hidden': 'true' }, '×'), h('span', { class: 'c-vetc', 'aria-label': host().partner }, host().partner)] : null);

/** Support options for the floating button sheet and the Account tab (only what is configured). */
function supportLinks() {
  return [
    HOTLINE ? { href: `tel:${HOTLINE.tel}`, icon: 'phone-call', tone: '', title: `Gọi ${HOTLINE.display}`, sub: 'Tổng đài hỗ trợ 24/7' } : null,
    SUPPORT_LINKS.zalo ? { href: SUPPORT_LINKS.zalo, icon: 'message-square', tone: 'teal', title: 'Nhắn tin qua Zalo', sub: 'Zalo Official Account TASCO', ext: true } : null,
    SUPPORT_LINKS.messenger ? { href: SUPPORT_LINKS.messenger, icon: 'message-square', tone: 'teal', title: 'Nhắn tin qua Messenger', sub: 'Fanpage Bảo hiểm TASCO', ext: true } : null,
    SUPPORT_EMAIL ? { href: `mailto:${SUPPORT_EMAIL}`, icon: 'mail', tone: '', title: 'Gửi email', sub: SUPPORT_EMAIL } : null,
    SUPPORT_LINKS.website ? { href: SUPPORT_LINKS.website, icon: 'globe', tone: '', title: 'Trang web Bảo hiểm TASCO', sub: new URL(SUPPORT_LINKS.website).host.replace(/^www\./, ''), ext: true } : null,
  ].filter(Boolean);
}
function supportSheet() {
  openSheet({
    title: 'Hỗ trợ khách hàng',
    sub: 'TASCO luôn sẵn sàng hỗ trợ bạn.',
    body: h('ul', { class: 'c-list c-support-list' }, supportLinks().map((l) => h('li', {}, h('a', { class: 'c-item', href: l.href, target: l.ext ? '_blank' : null, rel: l.ext ? 'noopener noreferrer' : null },
      h('span', { class: `c-ichip sm ${l.tone}` }, ic(l.icon, 18)),
      h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, l.title), h('span', { class: 'c-item-sub' }, l.sub)),
      h('span', { class: 'c-item-end' }, ic(l.ext ? 'external-link' : 'chevron-right', 18), l.ext ? h('span', { class: 'sr-only' }, ' (mở trong thẻ mới)') : null))))),
  });
}
/** Floating support button (round, navy, bottom-right above the tab or action bar). Never shown in checkout/payment. */
const supportFab = () => (supportLinks().length
  ? h('button', { class: 'c-fab', type: 'button', 'aria-label': 'Hỗ trợ khách hàng', 'aria-haspopup': 'dialog', onclick: supportSheet }, ic('headset', 24))
  : null);

/** Tab page: white branded app bar, optional hero, content, floating support button and tab bar. */
function tabPage(current, content, { hero } = {}) {
  return h('div', { class: 'c-app c-has-fab' },
    h('header', { class: 'c-appbar' }, brandMark()),
    hero || null,
    h('main', { class: 'c-main', id: 'app-main', tabindex: '-1' }, content),
    supportFab(),
    tabbar(current));
}

/** Full-screen task flow: back button + title, optional stepper, main, optional sticky action bar. */
function flowPage({ title, onBack, top, support = false }) {
  const main = h('main', { class: 'c-main', id: 'app-main', tabindex: '-1' });
  const bar = h('div', { class: 'c-actionbar' });
  const app = h('div', { class: `c-app c-app--flow${support ? ' c-has-fab' : ''}` },
    h('header', { class: 'c-appbar c-appbar--flow' },
      h('button', { class: 'c-iconbtn', type: 'button', 'aria-label': 'Quay lại', onclick: onBack }, ic('arrow-left', 24)),
      h('h1', { class: 'c-appbar-title', tabindex: '-1' }, title), h('span', { class: 'c-appbar-spacer' })),
    top || null, main, bar, support ? supportFab() : null);
  const setBar = (...children) => {
    const empty = !children.flat().some(Boolean);
    app.classList.toggle('c-no-actionbar', empty);
    bar.hidden = empty;
    mount(bar, ...children);
  };
  const show = (...children) => { mount(main, ...children); window.scrollTo(0, 0); };
  return { app, main, setBar, show };
}

// ---------------------------------------------------------------- cover status
function coverInfo(home) {
  const t = today();
  const tasco = home.policies.filter((p) => p.status === 'active' && isTnds(p.product) && p.endDate >= t).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const current = tasco.find((p) => p.startDate <= t);
  const next = tasco.find((p) => p.startDate > t);
  const expiry = current?.endDate || home.cover.expiryDate || null;
  const days = expiry ? daysBetween(t, expiry) : (home.cover.daysToExpiry ?? null);
  if (next && (!current || current.endDate <= next.startDate)) {
    return { key: 'renewed', tone: 'ok', chip: 'Đã gia hạn', line: `Hợp đồng mới hiệu lực từ ${fmtDate(next.startDate)}`, sub: `Bảo hiểm đến ${fmtDate(next.endDate)}`, days: daysBetween(t, next.endDate), frac: 1 };
  }
  if (days === null) return { key: 'unknown', tone: 'neutral', chip: 'Chưa rõ hạn bảo hiểm', line: 'Chưa có ngày hết hạn bảo hiểm', sub: 'Cập nhật để được nhắc gia hạn đúng hạn', days: null, frac: 0 };
  if (days < 0) return { key: 'lapsed', tone: 'danger', chip: 'Đã hết hạn', line: `Hết hạn từ ${fmtDate(expiry)}`, sub: 'Xe đang không có bảo hiểm TNDS bắt buộc', days, frac: 0 };
  if (days <= 45) return { key: 'due', tone: 'warn', chip: 'Sắp hết hạn', line: `Hết hạn ngày ${fmtDate(expiry)}`, sub: 'Gia hạn sớm để không bị gián đoạn bảo hiểm', days, frac: Math.max(0.04, days / 45) };
  return { key: 'active', tone: 'ok', chip: 'Đang hiệu lực', line: `Hiệu lực đến ${fmtDate(expiry)}`, sub: null, days, frac: Math.min(1, days / 365) };
}

function vehicleCard(home, cover, hasQuote) {
  let center; let unit; let label;
  if (cover.key === 'unknown') { center = ic('calendar', 24); unit = null; label = 'Chưa rõ ngày hết hạn'; }
  else if (cover.key === 'lapsed') { center = ic('alert-triangle', 24); unit = null; label = `Đã hết hạn ${-cover.days} ngày`; }
  else { center = String(cover.days); unit = 'ngày'; label = `Còn ${cover.days} ngày bảo hiểm`; }
  const tone = cover.tone === 'ok' ? '' : cover.tone;
  const actions = [];
  if (hasQuote) { /* the pending quote card below is the call to action */ } else if (cover.key === 'lapsed') actions.push(h('a', { class: 'c-btn primary block', href: '#/buy' }, ic('shield-check', 20), 'Mua bảo hiểm ngay'));
  else if (cover.key === 'due') actions.push(h('a', { class: 'c-btn primary block', href: '#/buy' }, ic('refresh', 20), 'Gia hạn ngay'));
  else if (cover.key === 'unknown') {
    actions.push(h('a', { class: 'c-btn primary block', href: '#/confirm' }, ic('calendar', 20), 'Cập nhật ngày hết hạn'));
    actions.push(h('a', { class: 'c-btn ghost block', href: '#/buy' }, 'Mua bảo hiểm mới'));
  } else if (home.policies.some((p) => p.status === 'active')) actions.push(h('a', { class: 'c-btn soft block', href: '#/policies' }, ic('qr-code', 20), 'Xem giấy chứng nhận'));
  return h('section', { class: 'c-vehicle', 'aria-labelledby': 'veh-title' },
    h('h2', { class: 'sr-only', id: 'veh-title' }, 'Xe của bạn'),
    h('div', { class: 'c-vehicle-top' },
      h('div', { class: 'c-vehicle-id' }, plateTag(home.vehicle.plate, 'lg'), h('span', { class: 'c-vehicle-meta' }, categoryText(home.vehicle))),
      ring(tone || '', cover.frac, center, unit, label)),
    h('div', { class: 'c-vehicle-status' },
      h('div', { class: 'c-row' }, chip(cover.tone, cover.chip), home.cover.insurer && cover.key !== 'unknown' ? h('span', { class: 'c-xs c-muted' }, insurerName(cover.key === 'renewed' ? 'TASCO' : home.cover.insurer)) : null),
      h('p', { class: 'c-status-line' }, cover.line),
      cover.sub ? h('p', { class: 'c-status-sub' }, cover.sub) : null),
    actions.length ? h('div', { class: 'c-vehicle-actions' }, actions) : null);
}

function pendingQuoteCard(q, plate) {
  const periods = new Set(q.lines.map((l) => `${l.startDate}|${l.endDate}`));
  return h('section', { class: 'c-quote', 'aria-labelledby': `pq-${q.id}` },
    h('div', { class: 'c-quote-head' }, ic('bell-ring', 18), h('span', {}, 'Báo giá mới'), h('span', { class: 'c-grow c-xs' }, `Hết hạn ${fmtDateTime(q.expiresAt)}`)),
    h('div', { class: 'c-quote-body' },
      h('h2', { id: `pq-${q.id}` }, 'Báo giá đang chờ bạn xác nhận'),
      h('p', { class: 'c-quote-sub' }, q.channel === 'vetc_app' ? 'Báo giá cho xe ' : 'Tư vấn viên TASCO đã gửi cho xe ', h('span', { class: 'c-nowrap c-strong' }, plate)),
      h('ul', { class: 'c-lines' }, q.lines.map((l) => h('li', { class: 'c-line' }, productIcon(l.product),
        h('div', { class: 'c-line-text' }, h('div', { class: 'c-line-name' }, PRODUCT[l.product]?.short || productName(l)),
          periods.size > 1 ? h('div', { class: 'c-line-sub' }, fmtPeriod(l.startDate, l.endDate)) : null),
        h('span', { class: 'c-line-amt' }, fmtVnd(l.total))))),
      periods.size === 1 ? h('div', { class: 'c-meta-row' }, ic('calendar', 16), 'Thời hạn: ', h('span', { class: 'c-strong c-num' }, fmtPeriod(q.lines[0].startDate, q.lines[0].endDate))) : null,
      h('div', { class: 'c-total' }, h('span', { class: 'c-total-label' }, 'Tổng thanh toán'), h('span', { class: 'c-total-amt' }, fmtVnd(q.total))),
      h('a', { class: 'c-btn primary block', href: `#/buy?quote=${encodeURIComponent(q.id)}` }, 'Xem và thanh toán', ic('chevron-right', 20))));
}

function benefitsCarousel(benefits) {
  if (!benefits?.length) return null;
  const dots = h('div', { class: 'c-dots', 'aria-hidden': 'true' }, benefits.map((_, i) => h('span', { class: i === 0 ? 'on' : '' })));
  const list = h('ul', { class: 'c-carousel', tabindex: '0', 'aria-label': 'Quyền lợi đi kèm, vuốt ngang để xem thêm' },
    benefits.map((b) => {
      const [name, tone] = BENEFIT_ICON[b.id] || ['gift', 'teal'];
      return h('li', { class: 'c-benefit' }, h('span', { class: `c-ichip ${tone}` }, ic(name, 20)), h('p', { class: 'c-benefit-title' }, b.titleVi), h('p', { class: 'c-benefit-text' }, b.descVi));
    }));
  list.addEventListener('scroll', () => {
    const w = list.firstElementChild?.getBoundingClientRect().width || 1;
    const i = Math.round(list.scrollLeft / (w + 12));
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === Math.min(i, benefits.length - 1)));
  }, { passive: true });
  return h('section', { class: 'c-section', 'aria-labelledby': 'ben-title' },
    h('div', { class: 'c-section-head' }, h('h2', { id: 'ben-title' }, 'Quyền lợi đi kèm')), list, benefits.length > 1 ? dots : null);
}

function quickActions(home) {
  const hasActive = home.policies.some((p) => p.status === 'active');
  const qa = (href, name, tone, text, attrs = {}) => h('a', { href, ...attrs }, h('span', { class: `c-ichip ${tone}` }, ic(name, 22)), h('span', {}, text));
  return h('nav', { class: 'c-quick', 'aria-label': 'Tiện ích nhanh' },
    HOTLINE ? qa(`tel:${HOTLINE.tel}`, 'truck', 'rose', 'Cứu hộ 24/7', { 'aria-label': `Cứu hộ 24/7, gọi ${HOTLINE.display}` }) : qa('#/home', 'truck', 'rose', 'Cứu hộ 24/7'),
    qa(hasActive ? '#/claims/new' : '#/claims', 'siren', 'amber', 'Báo tai nạn'),
    qa('#/policies', 'qr-code', 'teal', 'Giấy chứng nhận'),
    qa('#/buy', 'shield-check', '', 'Mua bảo hiểm'));
}

const footnote = () => h('footer', { class: 'c-footnote' },
  h('span', {}, ic('scale', 14), 'Phí bảo hiểm TNDS bắt buộc theo quy định của Bộ Tài chính.'),
  h('span', {}, ic('lock', 14), 'VETC và TASCO không bao giờ yêu cầu mã OTP qua điện thoại.'));

// ---------------------------------------------------------------- views: home
async function viewHome() {
  const [home, quotes] = await Promise.all([api.get('/api/customer/home'), api.get('/api/customer/quotes')]);
  state.home = home;
  const pending = quotes.filter((q) => q.sentToCustomerAt || q.channel !== 'vetc_app');
  const cover = coverInfo(home);
  const name = home.customer?.firstName;
  // Slim teal band with the diagonal parallelogram motif of the TASCO website (navy text on light teal: 6.1:1).
  const hero = h('section', { class: 'c-hero', 'aria-labelledby': 'greet-h' },
    h('span', { class: 'c-hero-band c-hero-band-a', 'aria-hidden': 'true' }), h('span', { class: 'c-hero-band c-hero-band-b', 'aria-hidden': 'true' }),
    h('div', { class: 'c-greet' }, h('p', { class: 'c-greet-hi' }, greetingWord()), h('h1', { tabindex: '-1', id: 'greet-h' }, name ? `Xin chào, ${name}` : 'Xin chào quý khách')));
  const content = [
    vehicleCard(home, cover, !!pending[0]),
    pending[0] ? pendingQuoteCard(pending[0], home.vehicle.plate) : null,
    home.cover.needsConfirmation && cover.key !== 'unknown' && cover.key !== 'renewed'
      ? notice('info', 'calendar', 'Ngày hết hạn đã chính xác chưa?', 'Xác nhận để được nhắc gia hạn đúng hạn.', h('a', { class: 'c-btn sm soft', href: '#/confirm' }, 'Xác nhận ngay')) : null,
    quickActions(home),
    benefitsCarousel(home.benefits),
    footnote(),
  ];
  return tabPage('home', content, { hero });
}
function greetingWord() {
  const hr = new Date(Date.now() + 7 * 3600000).getUTCHours();
  return hr < 11 ? 'Chào buổi sáng' : hr < 14 ? 'Chào buổi trưa' : hr < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

// ---------------------------------------------------------------- views: confirm expiry
function dateInput(id) {
  const input = h('input', { id, class: 'c-input', type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'dd/mm/yyyy', maxlength: '10', 'aria-describedby': `${id}-hint ${id}-err` });
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
    input.removeAttribute('aria-invalid');
  });
  input.isoValue = () => {
    const m = input.value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return '';
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  input.setIso = (iso) => { input.value = fmtDate(iso); setErr(input, ''); };
  return input;
}
function field(input, labelText, { help, optional, err } = {}) {
  return h('div', { class: 'c-field' },
    h('label', { for: input.id }, labelText, optional ? h('span', { class: 'c-opt' }, ' (không bắt buộc)') : null),
    input, help ? h('span', { class: 'c-help', id: `${input.id}-hint` }, help) : null,
    err || h('span', { class: 'c-err', id: `${input.id}-err`, 'aria-live': 'polite' }));
}
function setErr(input, msg) {
  const e = document.getElementById(`${input.id}-err`);
  if (e) mount(e, msg ? [ic('alert-circle', 16), msg] : []);
  if (msg) { input.setAttribute('aria-invalid', 'true'); input.focus(); } else input.removeAttribute('aria-invalid');
  return !msg;
}

function viewConfirm() {
  const f = flowPage({ title: 'Ngày hết hạn bảo hiểm', onBack: () => { location.hash = '#/home'; } });
  const date = dateInput('exp');
  const insurers = ['TASCO', 'PVI', 'PTI', 'Bảo Việt', 'PJICO', 'BIC', 'MIC', 'Khác'];
  const ins = h('fieldset', { class: 'c-fieldset' }, h('legend', {}, 'Công ty bảo hiểm hiện tại'), h('div', { class: 'c-choices' },
    insurers.map((x, i) => h('label', { class: 'c-choice' }, h('input', { type: 'radio', name: 'ins', value: x, checked: i === 0 }), x))));
  const save = h('button', { class: 'c-btn primary block', type: 'button' }, 'Lưu thông tin');
  f.show(
    h('div', {}, h('h2', { class: 'c-page-title' }, 'Xác nhận ngày hết hạn'), h('p', { class: 'c-page-sub' }, 'Xem trên giấy chứng nhận TNDS hiện tại của bạn.')),
    h('div', { class: 'c-card', style: 'display:flex;flex-direction:column;gap:20px' }, field(date, 'Ngày hết hạn', { help: 'Ngày/tháng/năm, ví dụ 07/10/2026' }), ins),
    notice('info', 'bell', null, 'Chúng tôi chỉ dùng thông tin này để nhắc bạn gia hạn đúng hạn.'));
  f.setBar(save);
  save.addEventListener('click', async () => {
    if (!date.isoValue()) { setErr(date, 'Ngày không hợp lệ. Nhập theo dạng ngày/tháng/năm.'); return; }
    setErr(date, '');
    const v = ins.querySelector('input:checked').value;
    busy(save, true);
    try {
      await api.post('/api/customer/expiry', { expiryDate: date.isoValue(), insurer: v === 'Khác' ? 'OTHER' : v });
      toast('Cảm ơn bạn! Chúng tôi sẽ nhắc gia hạn đúng hạn.', 'ok');
      location.hash = '#/home';
    } catch (ex) { busy(save, false); toast(viError(ex), 'danger'); }
  });
  return f.app;
}

// ---------------------------------------------------------------- views: purchase flow
const STEPS = ['Chọn gói', 'Xác nhận', 'Thanh toán'];
function stepper() {
  const el = h('ol', { class: 'c-stepper', 'aria-label': 'Các bước mua bảo hiểm' });
  const set = (n) => mount(el, STEPS.map((s, i) => {
    const k = i + 1; const cls = k < n ? 'done' : k === n ? 'current' : '';
    return h('li', { class: `c-step ${cls}`, 'aria-current': k === n ? 'step' : null },
      h('span', { class: 'c-step-dot', 'aria-hidden': 'true' }, k < n ? ic('check', 16, { strokeWidth: 3 }) : String(k)),
      h('span', {}, s), k < n ? h('span', { class: 'sr-only' }, ' (đã xong)') : null);
  }));
  return { el, set };
}

const USAGE_TEXT = { personal: 'Không kinh doanh vận tải', commercial: 'Có kinh doanh vận tải' };

/**
 * "Thông tin xe": the customer confirms use and seats before pricing (the compulsory TNDS tariff depends on them).
 * Changes are saved with POST /api/customer/vehicle; `home` is refreshed in place and onChanged() re-prices.
 * Returns { el, confirm } — confirm() resolves true when the details are confirmed (saving them if they changed).
 */
function vehicleConfirmCard(home, s, { onChanged }) {
  const v = home.vehicle;
  const curUsage = v.usage === 'commercial' ? 'commercial' : 'personal';
  const curSeats = Number(v.seats) > 0 ? Number(v.seats) : null;
  const draft = { usage: s.vUsage || curUsage, seats: s.vSeats ?? curSeats };
  const note = h('p', { class: 'c-xs c-muted c-veh-note' }, ic('scale', 14), 'Phí bảo hiểm bắt buộc phụ thuộc loại xe, số chỗ và mục đích sử dụng theo quy định.');
  const head = h('div', { class: 'c-row' }, plateTag(v.plate), h('span', { class: 'c-small c-muted c-grow' }, categoryText(v)));
  const el = h('section', { class: 'c-card c-veh', 'aria-labelledby': 'veh-h' });

  async function confirm(btn) {
    const seats = Number(draft.seats);
    if (!(Number.isInteger(seats) && seats >= 1 && seats <= 60)) { const inp = el.querySelector('#vseats'); if (inp) setErr(inp, 'Nhập số chỗ ngồi từ 1 đến 60'); return false; }
    const changed = draft.usage !== curUsage || seats !== curSeats;
    if (changed) {
      if (btn) busy(btn, true);
      try {
        await api.post('/api/customer/vehicle', { usage: draft.usage, seats });
        Object.assign(home, await api.get('/api/customer/home'));
        state.home = home;
      } catch (ex) { if (btn) busy(btn, false); toast(viError(ex), 'danger'); return false; }
    }
    s.vehicleConfirmed = true; s.vUsage = null; s.vSeats = null;
    if (changed) toast('Đã cập nhật thông tin xe và tính lại phí.', 'ok');
    await onChanged(changed);
    return true;
  }

  if (s.vehicleConfirmed) {
    const edit = h('button', { class: 'c-btn sm soft', type: 'button' }, ic('edit', 16), 'Sửa');
    edit.addEventListener('click', () => { s.vehicleConfirmed = false; onChanged(false); });
    mount(el,
      h('div', { class: 'c-row spread' }, h('h2', { id: 'veh-h', class: 'c-card-title' }, 'Thông tin xe'), edit),
      head,
      h('p', { class: 'c-small c-veh-sum' }, `${USAGE_TEXT[curUsage]}${curSeats ? ` · ${curSeats} chỗ ngồi` : ''}`),
      note);
    return { el, confirm: async () => true };
  }

  const usageSeg = h('fieldset', { class: 'c-seg two' }, h('legend', { class: 'sr-only' }, 'Mục đích sử dụng'),
    ['personal', 'commercial'].map((u) => h('label', {}, h('input', { type: 'radio', name: 'vusage', value: u, checked: draft.usage === u, onchange: () => { draft.usage = u; s.vUsage = u; } }), USAGE_TEXT[u])));
  const seatsIn = h('input', { id: 'vseats', class: 'c-input', type: 'number', inputmode: 'numeric', min: '1', max: '60', step: '1', value: draft.seats ? String(draft.seats) : '', 'aria-describedby': 'vseats-err' });
  seatsIn.addEventListener('input', () => { draft.seats = seatsIn.value === '' ? null : Number(seatsIn.value); s.vSeats = draft.seats; seatsIn.removeAttribute('aria-invalid'); mount(document.getElementById('vseats-err')); });
  const ok = h('button', { class: 'c-btn sm primary', type: 'button' }, ic('check', 16), 'Xác nhận');
  ok.addEventListener('click', () => confirm(ok));
  mount(el,
    h('h2', { id: 'veh-h', class: 'c-card-title' }, 'Thông tin xe'),
    head,
    h('div', { class: 'c-seg-wrap' }, h('span', { class: 'c-seg-label', 'aria-hidden': 'true' }, 'Mục đích sử dụng'), usageSeg),
    h('div', { class: 'c-veh-row' },
      h('div', { class: 'c-field c-grow' }, h('label', { for: 'vseats' }, 'Số chỗ ngồi'), seatsIn, h('span', { class: 'c-err', id: 'vseats-err', 'aria-live': 'polite' })),
      ok),
    note);
  return { el, confirm: () => confirm(null) };
}

async function viewBuy(query) {
  const home = await api.get('/api/customer/home');
  state.home = home;
  const s = { step: 1, term: 1, pa: false, pd: false, pdValue: 500000000, quote: null, fromQuote: false, agree: false };
  const st = stepper();
  const f = flowPage({ title: 'Mua bảo hiểm', top: st.el, onBack: () => back() });
  const back = () => {
    if (s.step > 3) { location.hash = '#/home'; return undefined; }
    if (s.step === 2 && !s.fromQuote) return go(1);
    if (s.step === 3) return go(2);
    location.hash = '#/home';
    return undefined;
  };
  const go = (n) => { s.step = n; st.set(n); (n === 1 ? step1 : n === 2 ? step2 : step3)(); f.app.querySelector('.c-appbar-title').focus(); };

  if (query.quote) {
    const open = await api.get('/api/customer/quotes');
    const q = open.find((x) => x.id === query.quote);
    if (q) { s.quote = q; s.fromQuote = true; }
  }

  function quoteRequest() {
    const products = [{ code: 'TNDS_CAR', options: { termYears: s.term } }];
    if (s.pa) products.push({ code: 'PA_SEAT', options: { sumInsuredPerSeat: 20000000 } });
    if (s.pd) products.push({ code: 'MOTOR_PD', options: { sumInsured: s.pdValue } });
    return { products };
  }

  // Step 1 — choose cover
  function step1() {
    const termSeg = h('fieldset', { class: 'c-seg', 'aria-describedby': 'term-help' }, h('legend', { class: 'sr-only' }, 'Thời hạn bảo hiểm'),
      [1, 2, 3].map((y) => h('label', {}, h('input', { type: 'radio', name: 'term', value: String(y), checked: s.term === y, onchange: () => { s.term = y; } }), `${y} năm`)));
    const sw = (key, label) => {
      const input = h('input', { type: 'checkbox', role: 'switch', checked: s[key], 'aria-label': label });
      return [h('span', { class: 'c-switch' }, input, h('span', { class: 'c-switch-track', 'aria-hidden': 'true' })), input];
    };
    const [paSw, paIn] = sw('pa', 'Thêm bảo hiểm tai nạn người ngồi trên xe');
    const [pdSw, pdIn] = sw('pd', 'Thêm bảo hiểm vật chất xe');
    const pdValue = h('input', { id: 'pdv', class: 'c-input has-suffix', inputmode: 'numeric', autocomplete: 'off', value: s.pdValue.toLocaleString('vi-VN'), 'aria-describedby': 'pdv-hint pdv-err' });
    pdValue.addEventListener('input', () => { const n = Number(pdValue.value.replace(/\D/g, '').slice(0, 12)); s.pdValue = n; pdValue.value = n ? n.toLocaleString('vi-VN') : ''; pdValue.removeAttribute('aria-invalid'); });
    const pdBody = h('div', { class: 'c-product-body', hidden: !s.pd },
      h('div', { class: 'c-field' }, h('label', { for: 'pdv' }, 'Giá trị xe hiện tại'), h('div', { class: 'c-input-wrap' }, pdValue, h('span', { class: 'c-suffix', 'aria-hidden': 'true' }, '₫')),
        h('span', { class: 'c-help', id: 'pdv-hint' }, 'Theo giá thị trường, tối thiểu 100.000.000 ₫'), h('span', { class: 'c-err', id: 'pdv-err', 'aria-live': 'polite' })),
      notice('warn', 'wrench', 'Cần giám định xe', 'Giám định viên TASCO sẽ liên hệ hẹn lịch xem xe trước khi cấp bảo hiểm vật chất.'));
    const paCard = h('div', { class: `c-product ${s.pa ? 'on' : ''}` }, h('label', { class: 'c-product-head' }, productIcon('PA_SEAT'),
      h('div', { class: 'c-product-text' }, h('p', { class: 'c-product-name' }, 'Tai nạn người ngồi trên xe'), h('p', { class: 'c-product-desc' }, 'Bảo vệ bạn và người ngồi trên xe, 20 triệu đồng mỗi người.')), paSw));
    const pdCard = h('div', { class: `c-product ${s.pd ? 'on' : ''}` }, h('label', { class: 'c-product-head' }, productIcon('MOTOR_PD'),
      h('div', { class: 'c-product-text' }, h('p', { class: 'c-product-name' }, 'Vật chất xe'), h('p', { class: 'c-product-desc' }, 'Chi trả sửa chữa, thay thế khi xe của bạn bị hư hỏng.')), pdSw), pdBody);
    paIn.addEventListener('change', () => { s.pa = paIn.checked; paCard.classList.toggle('on', s.pa); });
    pdIn.addEventListener('change', () => { s.pd = pdIn.checked; pdCard.classList.toggle('on', s.pd); pdBody.hidden = !s.pd; });

    const veh = vehicleConfirmCard(home, s, { onChanged: () => step1() });
    f.show(
      veh.el,
      h('section', { class: 'c-section', 'aria-labelledby': 'req-h' },
        h('div', { class: 'c-section-head' }, h('h2', { id: 'req-h' }, 'Bảo hiểm bắt buộc')),
        h('div', { class: 'c-product on' },
          h('div', { class: 'c-product-head' }, productIcon('TNDS_CAR'),
            h('div', { class: 'c-product-text' }, h('p', { class: 'c-product-name' }, 'Bảo hiểm TNDS bắt buộc', h('span', { class: 'c-tag' }, 'Bắt buộc')),
              h('p', { class: 'c-product-desc' }, 'Bồi thường thiệt hại về người và tài sản cho bên thứ ba.')),
            h('span', { class: 'c-ichip sm green', 'aria-hidden': 'true' }, ic('check', 18, { strokeWidth: 2.5 }))),
          h('div', { class: 'c-product-body' },
            h('div', { class: 'c-seg-wrap' }, h('span', { class: 'c-seg-label', 'aria-hidden': 'true' }, 'Thời hạn bảo hiểm'), termSeg),
            h('div', { class: 'c-row spread', id: 'term-help' },
              h('span', { class: 'c-reg' }, ic('scale', 16), 'Giá theo quy định của Bộ Tài chính'),
              home.premium ? h('span', { class: 'c-small c-muted c-nowrap' }, h('strong', { class: 'c-num' }, fmtVnd(home.premium)), '/năm') : null)))),
      h('section', { class: 'c-section', 'aria-labelledby': 'opt-h' },
        h('div', { class: 'c-section-head' }, h('h2', { id: 'opt-h' }, 'Bảo vệ thêm'), h('span', { class: 'c-xs c-muted' }, 'Tùy chọn')),
        paCard, pdCard));
    const next = h('button', { class: 'c-btn primary block', type: 'button' }, 'Xem phí bảo hiểm', ic('chevron-right', 20));
    next.addEventListener('click', async () => {
      if (s.pd && !(s.pdValue >= 100000000)) { setErr(pdValue, 'Giá trị xe tối thiểu 100.000.000 ₫'); return; }
      if (!s.vehicleConfirmed && !(await veh.confirm())) return;
      busy(next, true);
      try { s.quote = await api.post('/api/customer/quotes', quoteRequest()); go(2); } catch (ex) { busy(next, false); toast(viError(ex), 'danger'); }
    });
    f.setBar(next);
  }

  /** Re-price the current selection after the vehicle details changed (same products and term). */
  async function requote(changed) {
    if (!changed) { step2(); return; }
    const q = s.quote;
    const tnds = q.lines.find((l) => isTnds(l.product));
    if (tnds) s.term = Math.max(1, Math.round(daysBetween(tnds.startDate, tnds.endDate) / 365));
    s.pa = q.lines.some((l) => l.product === 'PA_SEAT');
    const pdLine = q.lines.find((l) => l.product === 'MOTOR_PD');
    s.pd = !!pdLine;
    if (pdLine?.sumInsured) s.pdValue = pdLine.sumInsured;
    try { s.quote = await api.post('/api/customer/quotes', quoteRequest()); s.fromQuote = false; } catch (ex) { toast(viError(ex), 'danger'); }
    step2();
  }

  // Step 2 — review price
  function step2() {
    const q = s.quote;
    const needsInspection = q.lines.some((l) => l.product === 'MOTOR_PD') && !q.inspection?.passed;
    const net = q.lines.reduce((a, l) => a + (l.premiumNet || 0), 0);
    const vat = q.lines.reduce((a, l) => a + (l.vat || 0), 0);
    const blocks = [];
    if (q.indicative) {
      const confirmBtn = h('button', { class: 'c-btn sm primary', type: 'button' }, ic('refresh', 18), 'Xác nhận giá chính thức');
      confirmBtn.addEventListener('click', async () => {
        busy(confirmBtn, true);
        try {
          const prev = q.total;
          s.quote = await api.post(`/api/customer/quotes/${encodeURIComponent(q.id)}/rerate`);
          toast(s.quote.total === prev ? 'Đã xác nhận giá chính thức.' : `Giá chính thức: ${fmtVnd(s.quote.total)} (giá tạm tính ${fmtVnd(prev)}).`, 'ok');
          step2();
        } catch (ex) { busy(confirmBtn, false); toast(ex.status === 503 ? 'Hệ thống TASCO vẫn đang bận. Vui lòng thử lại sau ít phút.' : viError(ex), 'danger'); }
      });
      blocks.push(notice('warn', 'alert-triangle', 'Đây là giá tạm tính', 'Hệ thống định phí TASCO đang bận. Vui lòng xác nhận giá chính thức trước khi thanh toán.', confirmBtn));
    } else if (q.previousTotal !== undefined && q.previousTotal !== q.total) {
      blocks.push(notice('ok', 'check-circle', 'Đã cập nhật giá chính thức', `Giá tạm tính trước đó: ${fmtVnd(q.previousTotal)}.`));
    }
    if (needsInspection) {
      const drop = h('button', { class: 'c-btn sm soft', type: 'button' }, 'Bỏ vật chất xe, mua phần còn lại');
      drop.addEventListener('click', async () => {
        busy(drop, true);
        s.pd = false;
        const tnds = q.lines.find((l) => isTnds(l.product));
        if (tnds) s.term = Math.max(1, Math.round(daysBetween(tnds.startDate, tnds.endDate) / 365));
        s.pa = q.lines.some((l) => l.product === 'PA_SEAT');
        try { s.quote = await api.post('/api/customer/quotes', quoteRequest()); s.fromQuote = false; step2(); } catch (ex) { busy(drop, false); toast(viError(ex), 'danger'); }
      });
      blocks.push(notice('info', 'wrench', 'Vật chất xe cần giám định', 'Giám định viên TASCO sẽ liên hệ hẹn lịch. Sau khi giám định, báo giá sẽ hiện ở Trang chủ để bạn thanh toán.', drop));
    }
    f.show(
      blocks,
      vehicleConfirmCard(home, s, { onChanged: requote }).el,
      h('section', { class: 'c-card', 'aria-labelledby': 'fee-h' },
        h('h2', { id: 'fee-h', class: 'c-card-title' }, 'Chi tiết phí'),
        q.lines.map((l) => h('div', { class: 'c-price-line' },
          h('div', { class: 'c-line-text' },
            h('div', { class: 'c-row spread', style: 'align-items:flex-start' }, h('div', { class: 'c-line-name c-grow' }, productName(l)), h('span', { class: 'c-line-amt' }, fmtVnd(l.total))),
            h('div', { class: 'c-line-sub c-num' }, fmtPeriod(l.startDate, l.endDate)),
            h('div', { class: 'c-price-split' }, `Phí ${fmtVnd(l.premiumNet)} · VAT ${l.vat ? fmtVnd(l.vat) : 'không áp dụng'}`),
            l.priceRegulated || isTnds(l.product) ? h('div', { class: 'c-reg', style: 'margin-top:6px' }, ic('scale', 14), 'Giá theo quy định của Bộ Tài chính') : null))),
        h('dl', { class: 'c-kv c-sum' },
          h('dt', {}, 'Phí bảo hiểm (chưa VAT)'), h('dd', {}, fmtVnd(net)),
          h('dt', {}, 'Thuế VAT'), h('dd', {}, fmtVnd(vat)),
          h('dt', { class: 'c-kv-total' }, 'Tổng thanh toán'), h('dd', { class: 'c-kv-total' }, fmtVnd(q.total))),
        q.lines.some((l) => l.product === 'PA_SEAT') ? h('p', { class: 'c-xs c-muted', style: 'margin:12px 0 0' }, 'Bảo hiểm tai nạn con người không chịu thuế VAT.') : null),
      q.benefits?.length ? h('section', { class: 'c-card', 'aria-labelledby': 'inc-h' },
        h('h2', { id: 'inc-h', class: 'c-card-title' }, 'Quyền lợi đi kèm'),
        h('ul', { class: 'c-tips' }, q.benefits.map((b) => h('li', {}, h('span', { class: 'c-ichip sm green' }, ic('check', 16, { strokeWidth: 2.5 })), b.titleVi)))) : null,
      h('div', { class: 'c-meta-row' }, ic('clock', 16), `Báo giá có hiệu lực đến ${fmtDateTime(q.expiresAt)}`));
    const blocked = q.indicative || needsInspection;
    const next = h('button', { class: 'c-btn primary', type: 'button', 'aria-disabled': blocked ? 'true' : null, 'aria-describedby': blocked ? 'bar-hint' : null }, 'Tiếp tục');
    next.addEventListener('click', () => {
      if (blocked) return;
      if (!s.vehicleConfirmed) { const b = f.app.querySelector('.c-veh .c-btn.primary'); toast('Vui lòng xác nhận thông tin xe trước khi tiếp tục.', 'info'); b?.focus(); return; }
      go(3);
    });
    f.setBar(
      blocked ? h('div', { class: 'c-actionbar-hint', id: 'bar-hint' }, ic('lock', 16), q.indicative ? 'Cần xác nhận giá chính thức trước khi thanh toán' : 'Cần giám định xe trước khi thanh toán') : null,
      h('div', { class: 'c-actionbar-sum' }, h('span', { class: 'c-xs' }, 'Tổng thanh toán'), h('strong', {}, fmtVnd(q.total))), next);
  }

  // Step 3 — pay with the VETC wallet
  function step3() {
    const q = s.quote;
    const tascoPay = host().tascoPay;
    const bal = tascoPay ? null : home.wallet?.balance;
    const short = typeof bal === 'number' && bal < q.total;
    const agree = h('input', { type: 'checkbox', id: 'agree', checked: s.agree });
    const agreeErr = h('span', { class: 'c-err', id: 'agree-err', 'aria-live': 'polite' });
    agree.addEventListener('change', () => { s.agree = agree.checked; mount(agreeErr); });
    f.show(
      h('section', { class: 'c-section', 'aria-labelledby': 'pm-h' },
        h('div', { class: 'c-section-head' }, h('h2', { id: 'pm-h' }, 'Phương thức thanh toán')),
        h('div', { class: 'c-pay' },
          h('span', { class: 'c-ichip' }, ic(tascoPay ? 'credit-card' : 'wallet', 22)),
          h('div', { class: 'c-item-text' }, h('span', { class: 'c-item-title c-strong' }, payMethod()),
            h('span', { class: 'c-item-sub' }, tascoPay ? 'Thẻ ATM nội địa, thẻ quốc tế, QR ngân hàng' : typeof bal === 'number' ? ['Số dư: ', h('strong', { class: 'c-num' }, fmtVnd(bal))] : 'Số dư hiển thị trong ví VETC')),
          h('span', { class: 'c-pay-check' }, ic('check', 16, { strokeWidth: 3, label: 'Đã chọn' }))),
        short ? notice('warn', 'wallet', 'Số dư ví chưa đủ', `${host().open[0].toUpperCase()}${host().open.slice(1)} sẽ hướng dẫn bạn nạp thêm khi xác nhận thanh toán.`) : null),
      h('section', { class: 'c-card', 'aria-labelledby': 'ord-h' },
        h('h2', { id: 'ord-h', class: 'c-card-title' }, 'Thông tin thanh toán'),
        h('dl', { class: 'c-kv' },
          h('dt', {}, 'Đơn vị nhận'), h('dd', {}, 'Bảo hiểm TASCO'),
          h('dt', {}, 'Nội dung'), h('dd', {}, `Bảo hiểm xe ${home.vehicle.plate}`),
          h('dt', {}, 'Số sản phẩm'), h('dd', {}, String(q.lines.length)),
          h('dt', {}, 'Phí giao dịch'), h('dd', {}, 'Miễn phí'),
          h('dt', { class: 'c-kv-total' }, 'Tổng thanh toán'), h('dd', { class: 'c-kv-total' }, fmtVnd(q.total)))),
      h('div', {}, h('label', { class: 'c-check', for: 'agree' }, agree, h('span', {}, 'Tôi xác nhận thông tin xe chính xác và đồng ý với quy tắc bảo hiểm của TASCO.')), agreeErr),
      h('p', { class: 'c-meta-row' }, ic('lock', 16), tascoPay ? 'Thanh toán được bảo mật bởi cổng thanh toán TASCO.' : 'Thanh toán được bảo mật bởi VETC.'));
    const pay = h('button', { class: 'c-btn primary block', type: 'button' }, `Thanh toán ${fmtVnd(q.total)}`);
    pay.addEventListener('click', () => {
      if (!s.agree) { mount(agreeErr, ic('alert-circle', 16), 'Vui lòng xác nhận trước khi thanh toán.'); agree.focus(); return; }
      confirmSheet();
    });
    f.setBar(pay);
  }

  function confirmSheet() {
    const q = s.quote;
    const ok = h('button', { class: 'c-btn primary block', type: 'button' }, 'Xác nhận thanh toán');
    const sheet = openSheet({
      title: 'Xác nhận thanh toán',
      body: [
        h('div', { class: 'c-amount-hero' }, h('span', { class: 'c-xs' }, 'Số tiền'), h('strong', {}, fmtVnd(q.total))),
        h('dl', { class: 'c-kv' },
          h('dt', {}, 'Phương thức'), h('dd', {}, payMethod()),
          h('dt', {}, 'Đến'), h('dd', {}, 'Bảo hiểm TASCO'),
          h('dt', {}, 'Nội dung'), h('dd', {}, `Bảo hiểm xe ${home.vehicle.plate}`)),
      ],
      actions: [ok, h('button', { class: 'c-btn ghost block', type: 'button', onclick: () => sheet.close() }, 'Để sau')],
    });
    ok.addEventListener('click', () => { sheet.close(); pay(); });
  }

  async function pay() {
    f.setBar();
    f.show(h('div', { class: 'c-processing', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'c-spinner', 'aria-hidden': 'true' }), h('h2', {}, 'Đang xử lý thanh toán'), h('p', {}, 'Vui lòng không đóng ứng dụng.')));
    try {
      const r = await api.post('/api/customer/orders', { quoteId: s.quote.id }, { 'Idempotency-Key': idempotencyKey() });
      state.home = null;
      success(r);
    } catch (ex) {
      f.show(h('div', { class: 'c-result', role: 'alert' },
        h('span', { class: 'c-ichip rose', style: 'width:72px;height:72px;border-radius:50%' }, ic('x-circle', 36)),
        h('h2', {}, 'Thanh toán chưa thành công'), h('p', {}, `${viError(ex)} Bạn chưa bị trừ tiền.`)));
      const retry = h('button', { class: 'c-btn primary block', type: 'button', onclick: () => go(3) }, 'Thử lại');
      f.setBar(h('a', { class: 'c-btn ghost', href: '#/home' }, 'Về trang chủ'), retry);
    }
  }

  function success(r) {
    s.step = 4;
    st.set(4);
    const pols = r.policies || [];
    f.show(
      h('div', { class: 'c-result', role: 'status' }, successMark(),
        h('h2', { tabindex: '-1' }, 'Thanh toán thành công'),
        h('p', {}, 'Giấy chứng nhận điện tử đã được cấp cho xe ', h('strong', { class: 'c-nowrap' }, home.vehicle.plate), '.'),
        h('div', { class: 'c-amount' }, fmtVnd(r.order?.amount ?? s.quote.total))),
      h('section', { class: 'c-card' }, h('dl', { class: 'c-kv' },
        r.order?.paymentRef ? [h('dt', {}, 'Mã giao dịch'), h('dd', {}, String(r.order.paymentRef).toUpperCase())] : null,
        h('dt', {}, 'Thời gian'), h('dd', {}, fmtDateTime(r.order?.completedAt || new Date().toISOString())),
        pols.length ? [h('dt', {}, 'Số hợp đồng'), h('dd', {}, pols.map((p) => h('div', {}, p.policyNo || p.certNo)))] : null)),
      pols.map((p) => certCard(p, home.vehicle.plate)));
    const saveBtn = h('button', { class: 'c-btn soft', type: 'button' }, ic('download', 20), 'Lưu chứng nhận');
    saveBtn.addEventListener('click', async () => { busy(saveBtn, true); for (const p of pols) await saveCertificate(p, home.vehicle.plate); busy(saveBtn, false); });
    f.setBar(saveBtn, h('a', { class: 'c-btn primary', href: '#/home' }, 'Về trang chủ'));
    f.app.querySelector('.c-result h2')?.focus();
  }

  if (s.fromQuote) { st.set(2); step2(); } else if (query.quote) {
    st.set(1); step1();
    toast('Báo giá đã hết hạn hoặc đã được thanh toán. Vui lòng chọn lại gói bảo hiểm.', 'info');
  } else { st.set(1); step1(); }
  return f.app;
}

/** E-certificate card (success screen and policies). */
function certCard(p, plate) {
  return h('article', { class: 'c-cert', 'aria-label': `Giấy chứng nhận ${p.certNo}` },
    h('div', { class: 'c-cert-head' }, wordmark({ size: 'sm', variant: 'white', label: null }),
      h('div', { class: 'c-cert-head-text' }, h('strong', {}, 'Giấy chứng nhận điện tử'), host().partner ? `TASCO Insurance × ${host().partner}` : 'TASCO Insurance')),
    h('div', { class: 'c-cert-body' },
      h('p', { class: 'c-cert-name' }, productName(p)),
      h('dl', { class: 'c-cert-fields' },
        h('div', {}, h('dt', {}, 'Số giấy chứng nhận'), h('dd', {}, p.certNo)),
        h('div', {}, h('dt', {}, 'Biển số'), h('dd', {}, plate)),
        h('div', {}, h('dt', {}, 'Hiệu lực'), h('dd', {}, fmtPeriod(p.startDate, p.endDate)))),
      qrButton(p, plate)));
}
const qrButton = (p, plate) => h('button', { class: 'c-qrbtn', type: 'button', 'aria-label': `Phóng to mã QR giấy chứng nhận ${p.certNo}`, onclick: () => openQr(p, plate) },
  qrSvg(p.certificateUrl, { size: 104, label: `Mã QR giấy chứng nhận ${p.certNo}` }), h('span', { class: 'c-row', 'aria-hidden': 'true' }, ic('maximize', 12), 'Phóng to'));

// ---------------------------------------------------------------- views: my policies
function policyState(p) {
  const t = today();
  if (p.status === 'cancelled') return ['neutral', 'Đã hủy'];
  if (p.status !== 'active') return ['neutral', vi('status', p.status)];
  if (p.endDate < t) return ['danger', 'Hết hạn'];
  if (p.startDate > t) return ['info', 'Chưa đến ngày hiệu lực'];
  if (daysBetween(t, p.endDate) <= 45) return ['warn', 'Sắp hết hạn'];
  return ['ok', 'Đang hiệu lực'];
}

function policyCard(p, plate) {
  const [tone, label] = policyState(p);
  const t = today();
  const total = Math.max(1, daysBetween(p.startDate, p.endDate));
  const used = Math.max(0, Math.min(total, daysBetween(p.startDate, t)));
  const left = daysBetween(t, p.endDate);
  const leftText = p.startDate > t ? `Bắt đầu sau ${daysBetween(t, p.startDate)} ngày` : left >= 0 ? `Còn ${left} ngày` : `Đã hết hạn ${-left} ngày`;
  return h('article', { class: 'c-policy', 'aria-labelledby': `pol-${p.certNo}` },
    h('div', { class: 'c-policy-top' }, productIcon(p.product),
      h('div', { class: 'c-grow' }, h('h3', { class: 'c-policy-name', id: `pol-${p.certNo}` }, productName(p)),
        h('div', { class: 'c-policy-ref' }, `Số GCN ${p.certNo}`),
        h('div', { class: 'c-policy-chip' }, chip(tone, label)))),
    h('div', { class: 'c-policy-mid' },
      h('div', { class: 'c-validity' },
        h('div', { class: 'c-validity-dates' }, h('div', {}, 'Từ ngày', h('strong', {}, fmtDate(p.startDate))), h('div', {}, 'Đến ngày', h('strong', {}, fmtDate(p.endDate)))),
        h('div', { class: `c-bar ${tone === 'ok' ? 'ok' : tone === 'warn' ? 'warn' : tone === 'danger' ? 'danger' : ''}`, role: 'progressbar', 'aria-label': 'Thời gian hiệu lực đã qua', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round((used / total) * 100)) },
          h('span', { style: `width:${Math.round((used / total) * 100)}%` })),
        h('span', { class: 'c-validity-left' }, leftText),
        p.total ? h('span', { class: 'c-xs c-muted' }, `Phí đã thanh toán ${fmtVnd(p.total)}`) : null),
      p.certificateUrl ? qrButton(p, plate) : null),
    h('ul', { class: 'c-list c-docs', style: 'border-radius:0;box-shadow:none' },
      h('li', {}, h('a', { class: 'c-item', href: p.certificateUrl, target: '_blank', rel: 'noopener' }, h('span', { class: 'c-ichip sm teal' }, ic('file-check', 18)),
        h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, 'Giấy chứng nhận điện tử'), h('span', { class: 'c-item-sub' }, 'Tra cứu hiệu lực trực tuyến')), h('span', { class: 'c-item-end' }, ic('external-link', 18)))),
      h('li', {}, h('button', { class: 'c-item', type: 'button', onclick: () => saveCertificate(p, plate) }, h('span', { class: 'c-ichip sm' }, ic('download', 18)),
        h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, 'Lưu giấy chứng nhận'), h('span', { class: 'c-item-sub' }, 'Ảnh PNG kèm mã QR')), h('span', { class: 'c-item-end' }, ic('chevron-right', 18))))));
}

async function viewPolicies() {
  const home = await api.get('/api/customer/home');
  state.home = home;
  const t = today();
  const current = home.policies.filter((p) => p.status === 'active' && p.endDate >= t);
  const past = home.policies.filter((p) => !current.includes(p));
  const content = [
    h('div', {}, h('h1', { class: 'c-page-title', tabindex: '-1' }, 'Bảo hiểm của tôi'),
      h('p', { class: 'c-page-sub' }, 'Xe ', h('span', { class: 'c-strong' }, home.vehicle.plate), current.length ? ` · ${current.length} hợp đồng đang hiệu lực` : '')),
  ];
  if (!home.policies.length) {
    content.push(emptyState('shield', 'Chưa có hợp đồng với TASCO', 'Mua bảo hiểm trên ứng dụng để nhận giấy chứng nhận điện tử ngay.', h('a', { class: 'c-btn primary', href: '#/buy' }, 'Mua bảo hiểm')));
    if (home.cover.insurer && home.cover.insurer !== 'TASCO' && home.cover.expiryDate) {
      content.push(notice('info', 'info', 'Bảo hiểm hiện tại', `${insurerName(home.cover.insurer)}, ${home.cover.expiryDate < t ? 'đã hết hạn' : 'hết hạn'} ngày ${fmtDate(home.cover.expiryDate)}.`));
    }
  } else {
    content.push(current.map((p) => policyCard(p, home.vehicle.plate)));
    if (past.length) content.push(h('h2', { class: 'c-group-label' }, 'Đã hết hạn hoặc đã hủy'), past.map((p) => policyCard(p, home.vehicle.plate)));
  }
  content.push(footnote());
  return tabPage('policies', content);
}

// ---------------------------------------------------------------- views: claims
function claimTrack(c) {
  const idx = CLAIM_INDEX[c.status] ?? 0;
  const rejected = c.status === 'rejected';
  return h('ol', { class: 'c-track', 'aria-label': 'Tiến độ xử lý' }, CLAIM_STEPS.map((label, i) => {
    let cls = i < idx ? 'done' : i === idx ? 'current' : '';
    if (c.status === 'paid' && i === idx) cls = 'done';
    if (rejected && i === idx) cls = 'failed';
    const text = rejected && i === idx ? 'Từ chối' : label;
    return h('li', { class: cls, 'aria-current': i === idx ? 'step' : null },
      h('span', { class: 'c-track-dot', 'aria-hidden': 'true' }, cls === 'done' ? ic('check', 12, { strokeWidth: 3.5 }) : cls === 'failed' ? ic('x', 12, { strokeWidth: 3.5 }) : null),
      h('span', {}, text), cls === 'done' ? h('span', { class: 'sr-only' }, ' (đã xong)') : null);
  }));
}

function claimCard(c) {
  const [tone, text] = CLAIM_CHIP[c.status] || ['info', vi('status', c.status)];
  return h('article', { class: 'c-claim', 'aria-labelledby': `cl-${c.id}` },
    h('div', { class: 'c-row spread' }, h('span', { class: 'c-claim-ref', id: `cl-${c.id}` }, c.id), chip(tone, text)),
    h('div', { class: 'c-claim-meta' },
      h('span', {}, ic('shield-check', 16), productName(c)),
      h('span', {}, ic('calendar', 16), `Ngày xảy ra ${fmtDate(c.incidentDate)}`),
      c.location ? h('span', {}, ic('map-pin', 16), c.location) : null),
    claimTrack(c),
    h('div', { class: 'c-claim-next' }, ic('info', 16), h('span', {}, CLAIM_NEXT[c.status] || '')),
    h('details', {}, h('summary', {}, 'Chi tiết yêu cầu', ic('chevron-down', 18)),
      c.description ? h('p', { class: 'c-claim-desc' }, c.description) : null,
      c.photos ? h('p', { class: 'c-xs c-muted', style: 'margin:0 0 12px' }, `${c.photos} ảnh hiện trường`) : null,
      h('ol', { class: 'c-timeline', 'aria-label': 'Lịch sử xử lý' }, [...(c.history || [])].reverse().map((x) => h('li', {}, h('div', {}, CLAIM_CHIP[x.status]?.[1] || vi('status', x.status), h('time', { datetime: x.at }, fmtDateTime(x.at))))))));
}

async function viewClaims() {
  const [list, home] = await Promise.all([api.get('/api/customer/claims'), api.get('/api/customer/home')]);
  state.home = home;
  const active = home.policies.filter((p) => p.status === 'active' && p.startDate <= today() && p.endDate >= today());
  const content = [
    h('div', {}, h('h1', { class: 'c-page-title', tabindex: '-1' }, 'Bồi thường'), h('p', { class: 'c-page-sub' }, 'Báo tai nạn và theo dõi yêu cầu bồi thường.')),
    active.length
      ? h('a', { class: 'c-cta-card', href: '#/claims/new' }, h('span', { class: 'c-ichip' }, ic('siren', 24)),
        h('span', {}, h('strong', {}, 'Báo tai nạn'), h('span', { class: 'c-xs' }, 'Vài bước đơn giản, theo dõi ngay trên ứng dụng')), ic('chevron-right', 22))
      : notice('info', 'shield', 'Chưa có hợp đồng đang hiệu lực', 'Cần có hợp đồng TASCO còn hiệu lực để báo tai nạn trên ứng dụng.', h('a', { class: 'c-btn sm soft', href: '#/buy' }, 'Mua bảo hiểm')),
    h('div', { class: 'c-emergency' },
      h('a', { href: 'tel:115' }, h('span', { class: 'c-ichip sm rose' }, ic('phone-call', 18)), h('span', {}, h('strong', {}, 'Cấp cứu 115'), 'Người bị thương')),
      HOTLINE ? h('a', { href: `tel:${HOTLINE.tel}` }, h('span', { class: 'c-ichip sm' }, ic('headset', 18)), h('span', {}, h('strong', {}, HOTLINE.display), 'Tổng đài 24/7')) : null),
    SUPPORT_EMAIL ? h('p', { class: 'c-xs c-muted c-help-mail' }, 'Cần hỗ trợ về hồ sơ bồi thường? Email ', h('a', { href: `mailto:${SUPPORT_EMAIL}` }, SUPPORT_EMAIL)) : null,
    h('section', { class: 'c-section', 'aria-labelledby': 'my-claims' },
      h('div', { class: 'c-section-head' }, h('h2', { id: 'my-claims' }, 'Yêu cầu của tôi'), list.length ? h('span', { class: 'c-xs c-muted' }, `${list.length} yêu cầu`) : null),
      list.length ? list.map(claimCard) : emptyState('clipboard-check', 'Chưa có yêu cầu bồi thường', 'Yêu cầu bạn gửi sẽ hiển thị tại đây cùng tiến độ xử lý.')),
  ];
  return tabPage('claims', content);
}

const INCIDENT_TYPES = ['Va chạm với xe khác', 'Va chạm với vật cản', 'Trầy xước, móp méo', 'Ngập nước, thiên tai', 'Mất cắp bộ phận', 'Khác'];
async function viewClaimNew() {
  const home = await api.get('/api/customer/home');
  state.home = home;
  const t = today();
  const active = home.policies.filter((p) => p.status === 'active' && p.startDate <= t && p.endDate >= t);
  const s = { step: 1, policy: active.find((p) => isTnds(p.product))?.certNo || active[0]?.certNo, date: t, time: '', location: '', type: '', injured: 'no', desc: '', photos: [], agree: false };
  const TOTAL = 5;
  const TITLES = ['Chọn hợp đồng', 'Thời gian và địa điểm', 'Sự việc', 'Hình ảnh', 'Xem lại và gửi'];
  const prog = h('div', { class: 'c-progress' });
  const f = flowPage({ title: 'Báo tai nạn', top: prog, onBack: () => { if (s.step > 1 && s.step <= TOTAL) go(s.step - 1); else location.hash = '#/claims'; } });
  const setProg = () => mount(prog,
    h('div', { class: 'c-progress-meta' }, h('strong', {}, TITLES[s.step - 1]), h('span', {}, `Bước ${s.step}/${TOTAL}`)),
    h('div', { class: 'c-bar', role: 'progressbar', 'aria-label': 'Tiến độ báo tai nạn', 'aria-valuemin': '1', 'aria-valuemax': String(TOTAL), 'aria-valuenow': String(s.step), 'aria-valuetext': `Bước ${s.step} trên ${TOTAL}: ${TITLES[s.step - 1]}` },
      h('span', { style: `width:${(s.step / TOTAL) * 100}%` })));
  const go = (n) => { s.step = n; setProg(); [null, st1, st2, st3, st4, st5][n](); f.app.querySelector('.c-appbar-title').focus(); };
  const nextBtn = (label, onNext) => { const b = h('button', { class: 'c-btn primary block', type: 'button' }, label); b.addEventListener('click', onNext); return b; };
  const pol = () => active.find((p) => p.certNo === s.policy);

  if (!active.length) {
    f.show(emptyState('shield', 'Chưa có hợp đồng đang hiệu lực', 'Cần có hợp đồng TASCO còn hiệu lực để báo tai nạn.', h('a', { class: 'c-btn primary', href: '#/buy' }, 'Mua bảo hiểm')));
    f.setBar();
    prog.hidden = true;
    return f.app;
  }

  function st1() {
    f.show(h('fieldset', { class: 'c-section', style: 'border:0;padding:0;margin:0' },
      h('legend', { class: 'c-label', style: 'margin-bottom:12px' }, 'Hợp đồng bảo hiểm liên quan'),
      active.map((p) => h('label', { class: 'c-radio-card' },
        h('input', { type: 'radio', name: 'pol', value: p.certNo, checked: s.policy === p.certNo, onchange: () => { s.policy = p.certNo; } }),
        productIcon(p.product), h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title c-strong' }, productName(p)),
          h('span', { class: 'c-item-sub' }, `${p.certNo} · đến ${fmtDate(p.endDate)}`)), h('span', { class: 'c-radio-dot', 'aria-hidden': 'true' })))));
    f.setBar(nextBtn('Tiếp tục', () => go(2)));
  }

  function st2() {
    const date = dateInput('cdate');
    date.setIso(s.date);
    const time = h('input', { id: 'ctime', class: 'c-input', inputmode: 'numeric', placeholder: 'hh:mm', maxlength: '5', value: s.time, autocomplete: 'off', 'aria-describedby': 'ctime-err' });
    time.addEventListener('input', () => { const d = time.value.replace(/\D/g, '').slice(0, 4); time.value = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d; time.removeAttribute('aria-invalid'); });
    const loc = h('input', { id: 'cloc', class: 'c-input', maxlength: '200', value: s.location, placeholder: 'VD: Cao tốc Hà Nội – Hải Phòng, km 35', 'aria-describedby': 'cloc-err' });
    const quick = h('div', { class: 'c-choices', role: 'group', 'aria-label': 'Chọn nhanh ngày' },
      [['Hôm nay', t], ['Hôm qua', addDays(t, -1)]].map(([l, iso]) => h('button', { class: 'c-choice', type: 'button', onclick: () => date.setIso(iso) }, l)));
    f.show(h('div', { class: 'c-card', style: 'display:flex;flex-direction:column;gap:20px' },
      h('div', { class: 'c-field' }, field(date, 'Ngày xảy ra', { help: 'Ngày/tháng/năm' }), quick),
      field(time, 'Giờ xảy ra', { optional: true }),
      h('div', { class: 'c-field' }, h('label', { for: 'cloc' }, 'Địa điểm'), h('div', { class: 'c-input-wrap' }, ic('map-pin', 20), loc), h('span', { class: 'c-err', id: 'cloc-err', 'aria-live': 'polite' }))));
    f.setBar(nextBtn('Tiếp tục', () => {
      const iso = date.isoValue();
      const p = pol();
      if (!iso) return setErr(date, 'Ngày không hợp lệ. Nhập theo dạng ngày/tháng/năm.');
      if (iso > t) return setErr(date, 'Ngày xảy ra không thể sau hôm nay.');
      if (p && (iso < p.startDate || iso > p.endDate)) return setErr(date, `Ngày xảy ra phải trong thời hạn bảo hiểm (${fmtPeriod(p.startDate, p.endDate)}).`);
      setErr(date, '');
      if (time.value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.value)) return setErr(time, 'Giờ không hợp lệ, ví dụ 14:30.');
      setErr(time, '');
      if (loc.value.trim().length < 3) return setErr(loc, 'Vui lòng nhập địa điểm xảy ra.');
      setErr(loc, '');
      Object.assign(s, { date: iso, time: time.value, location: loc.value.trim() });
      go(3);
      return undefined;
    }));
  }

  function st3() {
    const desc = h('textarea', { id: 'cdesc', class: 'c-input', maxlength: '1500', placeholder: 'Mô tả ngắn gọn diễn biến và thiệt hại', 'aria-describedby': 'cdesc-err cdesc-count' }, s.desc);
    const count = h('span', { class: 'c-counter', id: 'cdesc-count' }, `${s.desc.length}/1500`);
    desc.addEventListener('input', () => { count.textContent = `${desc.value.length}/1500`; desc.removeAttribute('aria-invalid'); });
    const types = h('fieldset', { class: 'c-fieldset' }, h('legend', {}, 'Loại sự việc'), h('div', { class: 'c-choices grid2' },
      INCIDENT_TYPES.map((x) => h('label', { class: 'c-choice' }, h('input', { type: 'radio', name: 'ctype', value: x, checked: s.type === x, onchange: () => { s.type = x; mount(typeErr); } }), x))));
    const typeErr = h('span', { class: 'c-err', 'aria-live': 'polite' });
    const injured = h('fieldset', { class: 'c-seg', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' }, h('legend', { class: 'sr-only' }, 'Có người bị thương không?'),
      [['no', 'Không'], ['yes', 'Có']].map(([v, l]) => h('label', {}, h('input', { type: 'radio', name: 'inj', value: v, checked: s.injured === v, onchange: () => { s.injured = v; } }), l)));
    f.show(h('div', { class: 'c-card', style: 'display:flex;flex-direction:column;gap:20px' },
      h('div', {}, types, typeErr),
      h('div', { class: 'c-seg-wrap' }, h('span', { class: 'c-seg-label', 'aria-hidden': 'true' }, 'Có người bị thương không?'), injured),
      h('div', { class: 'c-field' }, h('label', { for: 'cdesc' }, 'Diễn biến sự việc'), desc, h('div', { class: 'c-row spread' }, h('span', { class: 'c-err', id: 'cdesc-err', 'aria-live': 'polite' }), count))),
      notice('danger', 'phone-call', 'Có người bị thương?', 'Gọi cấp cứu 115 trước, sau đó hoàn tất báo tai nạn.', h('a', { class: 'c-btn sm danger', href: 'tel:115' }, 'Gọi 115')));
    f.setBar(nextBtn('Tiếp tục', () => {
      if (!s.type) { mount(typeErr, ic('alert-circle', 16), 'Vui lòng chọn loại sự việc.'); types.querySelector('input').focus(); return; }
      if (desc.value.trim().length < 10) { setErr(desc, 'Vui lòng mô tả ít nhất 10 ký tự.'); return; }
      setErr(desc, '');
      s.desc = desc.value.trim();
      go(4);
    }));
  }

  function st4() {
    const grid = h('div', { class: 'c-photos' });
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true, 'aria-label': 'Chụp hoặc chọn ảnh' });
    const redraw = () => mount(grid,
      s.photos.map((src, i) => h('div', { class: 'c-photo' }, h('img', { src, alt: `Ảnh ${i + 1}` }),
        h('button', { type: 'button', 'aria-label': `Xóa ảnh ${i + 1}`, onclick: () => { s.photos.splice(i, 1); redraw(); } }, ic('x', 16)))),
      s.photos.length < 9 ? h('label', { class: 'c-photo-add' }, input, ic('camera', 26), 'Chụp hoặc chọn ảnh') : null);
    input.addEventListener('change', async () => {
      for (const file of [...input.files].slice(0, 9 - s.photos.length)) {
        // Preview only (data: URL — CSP img-src allows data:); the assessor collects originals when they call.
        s.photos.push(await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); }));
      }
      redraw();
    });
    redraw();
    f.show(
      h('div', { class: 'c-card', style: 'display:flex;flex-direction:column;gap:16px' },
        h('h2', { class: 'c-card-title', style: 'margin:0' }, 'Ảnh hiện trường'),
        h('ul', { class: 'c-tips' },
          h('li', {}, h('span', { class: 'c-ichip sm' }, ic('image', 16)), 'Toàn cảnh hiện trường'),
          h('li', {}, h('span', { class: 'c-ichip sm' }, ic('car', 16)), 'Biển số các xe liên quan'),
          h('li', {}, h('span', { class: 'c-ichip sm' }, ic('search', 16)), 'Cận cảnh vết hư hỏng')),
        grid),
      h('p', { class: 'c-meta-row' }, ic('info', 16), 'Không bắt buộc. Giám định viên sẽ nhận ảnh gốc khi liên hệ với bạn.'));
    f.setBar(nextBtn(s.photos.length ? 'Tiếp tục' : 'Bỏ qua và tiếp tục', () => go(5)));
  }

  function st5() {
    const p = pol();
    const edit = (n, label) => h('button', { class: 'c-link', type: 'button', onclick: () => go(n), 'aria-label': `Sửa ${label}` }, ic('edit', 16), 'Sửa');
    const block = (title, n, rows) => h('section', { class: 'c-review', 'aria-label': title }, h('div', { class: 'c-review-head' }, h('h3', {}, title), edit(n, title.toLowerCase())), h('dl', { class: 'c-kv stack' }, rows));
    const agree = h('input', { type: 'checkbox', id: 'cagree', checked: s.agree, onchange: (e) => { s.agree = e.target.checked; mount(agreeErr); } });
    const agreeErr = h('span', { class: 'c-err', 'aria-live': 'polite' });
    f.show(
      block('Hợp đồng', 1, [h('dt', {}, productName(p)), h('dd', {}, `${p.certNo} · ${home.vehicle.plate}`)]),
      block('Thời gian và địa điểm', 2, [h('dt', {}, 'Thời gian'), h('dd', {}, `${fmtDate(s.date)}${s.time ? ` lúc ${s.time}` : ''}`), h('dt', {}, 'Địa điểm'), h('dd', {}, s.location)]),
      block('Sự việc', 3, [h('dt', {}, 'Loại sự việc'), h('dd', {}, s.type), h('dt', {}, 'Người bị thương'), h('dd', {}, s.injured === 'yes' ? 'Có' : 'Không'), h('dt', {}, 'Diễn biến'), h('dd', { class: 'c-claim-desc', style: 'margin:0' }, s.desc)]),
      block('Hình ảnh', 4, [h('dt', {}, 'Số ảnh'), h('dd', {}, s.photos.length ? `${s.photos.length} ảnh` : 'Chưa có ảnh')]),
      h('div', {}, h('label', { class: 'c-check', for: 'cagree' }, agree, h('span', {}, 'Tôi cam đoan thông tin trên là đúng sự thật.')), agreeErr));
    const submit = nextBtn('Gửi yêu cầu bồi thường', async () => {
      if (!s.agree) { mount(agreeErr, ic('alert-circle', 16), 'Vui lòng xác nhận trước khi gửi.'); agree.focus(); return; }
      busy(submit, true);
      const description = [`Loại sự việc: ${s.type}.`, s.time ? `Thời gian: ${s.time}.` : null, `Có người bị thương: ${s.injured === 'yes' ? 'Có' : 'Không'}.`, s.desc].filter(Boolean).join('\n');
      try {
        const c = await api.post('/api/customer/claims', { policyId: s.policy, incidentDate: s.date, description, location: s.location, photos: s.photos.length });
        done(c);
      } catch (ex) { busy(submit, false); toast(viError(ex), 'danger'); }
    });
    f.setBar(submit);
  }

  function done(c) {
    s.step = TOTAL + 1;
    prog.hidden = true;
    f.show(
      h('div', { class: 'c-result', role: 'status' }, successMark(), h('h2', { tabindex: '-1' }, 'Đã gửi yêu cầu bồi thường'),
        h('p', {}, 'Mã yêu cầu ', h('strong', {}, c.id), '.')),
      h('section', { class: 'c-card' }, h('dl', { class: 'c-kv' },
        h('dt', {}, 'Ngày xảy ra'), h('dd', {}, fmtDate(c.incidentDate)),
        h('dt', {}, 'Trạng thái'), h('dd', {}, 'Đã gửi'),
        c.slaDueAt ? [h('dt', {}, 'TASCO liên hệ trước'), h('dd', {}, fmtDateTime(c.slaDueAt))] : null)),
      notice('info', 'phone-call', 'Giữ máy điện thoại', 'Giám định viên TASCO sẽ gọi cho bạn để hướng dẫn các bước tiếp theo.'));
    f.setBar(h('a', { class: 'c-btn ghost', href: '#/home' }, 'Về trang chủ'), h('a', { class: 'c-btn primary', href: '#/claims' }, 'Theo dõi yêu cầu'));
    f.app.querySelector('.c-result h2')?.focus();
  }

  go(1);
  return f.app;
}

// ---------------------------------------------------------------- views: account
async function viewAccount() {
  const d = await api.get('/api/customer/home');
  state.home = d;
  const name = d.customer?.firstName;
  const consentRow = (id, title, sub, checked, disabled) => {
    const input = h('input', { type: 'checkbox', role: 'switch', id, checked, disabled, 'aria-describedby': `${id}-d` });
    return [h('li', {}, h('label', { class: 'c-item', for: id },
      h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, title), h('span', { class: 'c-item-sub', id: `${id}-d` }, sub)),
      h('span', { class: 'c-switch' }, input, h('span', { class: 'c-switch-track', 'aria-hidden': 'true' })))), input];
  };
  const [mkRow, mk] = consentRow('mk', 'Ưu đãi và thông tin sản phẩm', 'Qua thông báo ứng dụng, Zalo và SMS', !!d.consent.marketing);
  const [callRow, call] = consentRow('call', 'Cuộc gọi tư vấn', 'Tư vấn viên TASCO có thể gọi cho bạn', !!d.consent.call);
  const [svcRow] = consentRow('svc', 'Thông báo hiệu lực bảo hiểm', 'Luôn bật để bảo vệ quyền lợi của bạn', true, true);
  const save = async (input) => {
    try {
      const r = await api.put('/api/customer/consent', { marketing: mk.checked, call: call.checked });
      d.consent = r.consent;
      toast('Đã lưu lựa chọn của bạn', 'ok');
    } catch (ex) { input.checked = !input.checked; toast(viError(ex), 'danger'); }
  };
  mk.addEventListener('change', () => save(mk));
  call.addEventListener('change', () => save(call));
  const exportBtn = h('button', { class: 'c-item', type: 'button' }, h('span', { class: 'c-ichip sm teal' }, ic('download', 18)),
    h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, 'Tải dữ liệu của tôi'), h('span', { class: 'c-item-sub' }, 'Bản sao dữ liệu TASCO đang lưu về bạn')), h('span', { class: 'c-item-end' }, ic('chevron-right', 18)));
  exportBtn.addEventListener('click', async () => {
    try {
      const data = await api.get('/api/customer/data-export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `du-lieu-cua-toi-${d.vehicle.plate.replace(/[^\w]/g, '')}.json` });
      document.body.append(a); a.click(); a.remove();
      toast('Đã tải dữ liệu của bạn', 'ok');
    } catch (ex) { toast(viError(ex), 'danger'); }
  });
  const content = [
    h('h1', { class: 'c-page-title', tabindex: '-1' }, 'Tài khoản'),
    h('section', { class: 'c-card c-profile', 'aria-label': 'Thông tin của bạn' },
      h('span', { class: 'c-avatar', 'aria-hidden': 'true' }, name ? name[0].toUpperCase() : ic('user', 26)),
      h('div', { class: 'c-grow' }, h('div', { class: 'c-strong', style: 'font-size:17px' }, name ? `Khách hàng ${name}` : 'Khách hàng VETC'),
        h('div', { class: 'c-row', style: 'gap:8px;margin-top:6px' }, plateTag(d.vehicle.plate, 'sm'), h('span', { class: 'c-xs c-muted' }, d.vehicle.province || '')))),
    h('h2', { class: 'c-group-label' }, 'Quyền riêng tư và liên lạc'),
    h('ul', { class: 'c-list' }, mkRow, callRow, svcRow),
    h('h2', { class: 'c-group-label' }, 'Dữ liệu cá nhân'),
    h('ul', { class: 'c-list' }, h('li', {}, exportBtn)),
    h('h2', { class: 'c-group-label' }, 'Hỗ trợ'),
    h('ul', { class: 'c-list' },
      HOTLINE ? h('li', {}, h('a', { class: 'c-item', href: `tel:${HOTLINE.tel}` }, h('span', { class: 'c-ichip sm' }, ic('headset', 18)),
        h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, 'Tổng đài hỗ trợ 24/7'), h('span', { class: 'c-item-sub' }, HOTLINE.display)), h('span', { class: 'c-item-end' }, ic('phone', 18)))) : null,
      SUPPORT_EMAIL ? h('li', {}, h('a', { class: 'c-item', href: `mailto:${SUPPORT_EMAIL}` }, h('span', { class: 'c-ichip sm' }, ic('mail', 18)),
        h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, 'Email hỗ trợ'), h('span', { class: 'c-item-sub' }, SUPPORT_EMAIL)), h('span', { class: 'c-item-end' }, ic('chevron-right', 18)))) : null,
      ...[
        ['website', 'globe', 'Trang web Bảo hiểm TASCO', (u) => new URL(u).host.replace(/^www\./, '')],
        ['zalo', 'message-square', 'Nhắn tin qua Zalo', () => 'Zalo Official Account TASCO'],
        ['messenger', 'message-square', 'Nhắn tin qua Messenger', () => 'Fanpage Bảo hiểm TASCO'],
      ].filter(([k]) => SUPPORT_LINKS[k]).map(([k, icn, title, sub]) => h('li', {}, h('a', { class: 'c-item', href: SUPPORT_LINKS[k], target: '_blank', rel: 'noopener noreferrer' },
        h('span', { class: 'c-ichip sm' }, ic(icn, 18)),
        h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, title), h('span', { class: 'c-item-sub' }, sub(SUPPORT_LINKS[k]))),
        h('span', { class: 'c-item-end' }, ic('external-link', 18), h('span', { class: 'sr-only' }, ' (mở trong thẻ mới)'))))),
      h('li', {}, h('div', { class: 'c-item' }, h('span', { class: 'c-ichip sm' }, ic('languages', 18)),
        h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, 'Ngôn ngữ'), h('span', { class: 'c-item-sub' }, `Theo ngôn ngữ của ${host().open}`)), h('span', { class: 'c-item-end' }, 'Tiếng Việt')))),
    state.meta?.demoMode ? h('ul', { class: 'c-list' }, h('li', {}, h('button', { class: 'c-item', type: 'button', onclick: () => demoSheet() },
      h('span', { class: 'c-ichip sm amber' }, ic('users', 18)), h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, 'Đổi khách hàng demo'), h('span', { class: 'c-item-sub' }, 'Chỉ có trong môi trường demo')), h('span', { class: 'c-item-end' }, ic('chevron-right', 18))))) : null,
    h('ul', { class: 'c-list' }, h('li', {}, h('button', { class: 'c-item', type: 'button', onclick: signOut }, h('span', { class: 'c-ichip sm rose' }, ic('log-out', 18)),
      h('span', { class: 'c-item-text' }, h('span', { class: 'c-item-title' }, 'Thoát')))),
    ),
    h('footer', { class: 'c-footnote', style: 'align-items:center;text-align:center' }, h('span', {}, 'Bảo hiểm TASCO · Phân phối qua ứng dụng VETC')),
  ];
  return tabPage('account', content);
}

function signOut() {
  try { sessionStorage.removeItem('ctoken'); } catch { /* ignore */ }
  state.token = null; state.home = null;
  history.replaceState(null, '', '/app/');
  render();
}

// ---------------------------------------------------------------- entry + demo picker
function demoSheet() {
  const list = state.meta?.demoCustomers || [];
  const sheet = openSheet({
    title: 'Chế độ demo: chọn khách hàng',
    sub: 'Trong thực tế, khách hàng mở ứng dụng từ liên kết của VETC.',
    body: h('div', { role: 'list' }, list.map((c) => h('button', { class: 'c-demo-row', type: 'button', role: 'listitem', onclick: async (e) => { busy(e.currentTarget, true); sheet.close(); await startSession({ demoProfileId: c.id }); } },
      h('span', { class: 'c-avatar sm', 'aria-hidden': 'true' }, c.name ? c.name.trim().split(/\s+/).pop()[0].toUpperCase() : ic('car', 18)),
      h('span', { class: 'c-item-text' },
        h('span', { class: 'c-item-title c-strong' }, c.name || 'Khách hàng chưa có tên'),
        h('span', { class: 'c-item-sub' }, c.status === 'insured' ? 'Đã mua bảo hiểm trên ứng dụng' : DEMO_JOURNEY[c.journey] || 'Khách hàng VETC')),
      plateTag(c.plate, 'sm')))),
  });
}

async function viewEntry() {
  state.meta = state.meta || await api.get('/api/meta');
  const demo = state.meta.demoMode && state.meta.demoCustomers?.length;
  const H = host();
  return h('div', { class: 'c-app' }, h('main', { class: 'c-splash', id: 'app-main' },
    h('span', { class: 'c-splash-band', 'aria-hidden': 'true' }),
    h('div', { class: 'c-hero-brand' }, wordmark({ size: 'lg', variant: 'white' }),
      H.partner ? [h('span', { class: 'c-brand-x', 'aria-hidden': 'true' }, '×'), h('span', { class: 'c-vetc' }, H.partner)] : null),
    h('div', { class: 'c-splash-mid' },
      h('h1', { tabindex: '-1' }, H.partner ? `Bảo hiểm xe ngay trong ${H.open}` : 'Bảo hiểm xe trực tuyến cùng TASCO'),
      h('p', {}, state.entryError || `Mở từ ${H.open} hoặc liên kết gia hạn được gửi cho bạn để tiếp tục.`),
      h('ul', { class: 'c-splash-points' },
        h('li', {}, ic('check-circle', 20), 'Gia hạn bảo hiểm TNDS trong một chạm'),
        h('li', {}, ic('check-circle', 20), 'Giấy chứng nhận điện tử có mã QR'),
        h('li', {}, ic('check-circle', 20), 'Cứu hộ 24/7 và báo tai nạn nhanh'))),
    h('div', { class: 'c-splash-foot' },
      demo ? h('button', { class: 'c-btn light block', type: 'button', onclick: demoSheet }, ic('users', 20), 'Chọn khách hàng demo') : null,
      h('p', { class: 'c-splash-note' }, demo ? 'Chế độ demo · dữ liệu mô phỏng' : `Bảo hiểm TASCO · Phân phối qua ${H.via}`))));
}

async function startSession(body) {
  try {
    const r = await api.post('/api/customer/session', { ...body, channel: state.channel });
    state.token = r.token; state.home = null; state.entryError = null;
    if (CHANNELS.includes(r.channel)) { state.channel = r.channel; store.set('cchannel', r.channel); }
    store.set('ctoken', r.token);
    history.replaceState(null, '', '/app/#/home');
  } catch (ex) {
    state.entryError = ex.status === 401 ? `Liên kết đã hết hạn hoặc không hợp lệ. Vui lòng mở lại từ ${host().open}.` : viError(ex);
    history.replaceState(null, '', '/app/');
  }
  await render();
}

// ---------------------------------------------------------------- render
const TITLES = { home: 'Trang chủ', policies: 'Bảo hiểm của tôi', claims: 'Bồi thường', 'claims/new': 'Báo tai nạn', account: 'Tài khoản', buy: 'Mua bảo hiểm', confirm: 'Ngày hết hạn' };
let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const root = document.getElementById('root');
  const link = new URLSearchParams(location.search).get('r');
  if (link && !state.token) { await startSession({ link }); return; }
  const { path, query } = route();
  let node;
  try {
    state.meta = state.meta || await api.get('/api/meta');
    setHotline(state.meta);
    if (!state.token) node = await viewEntry();
    else if (path === 'confirm') node = viewConfirm();
    else if (path === 'buy') node = await viewBuy(query);
    else if (path === 'policies') node = await viewPolicies();
    else if (path === 'claims/new') node = await viewClaimNew();
    else if (path === 'claims') node = await viewClaims();
    else if (path === 'account') node = await viewAccount();
    else node = await viewHome();
  } catch (ex) {
    if (ex.status === 401 && state.token) {
      state.token = null; state.entryError = `Phiên làm việc đã hết hạn. Vui lòng mở lại từ ${host().open}.`;
      try { sessionStorage.removeItem('ctoken'); } catch { /* ignore */ }
      return render();
    }
    node = tabPage(path.split('/')[0], [emptyState('alert-triangle', 'Không tải được dữ liệu', viError(ex), h('button', { class: 'c-btn primary', type: 'button', onclick: () => render() }, 'Thử lại'))]);
  }
  if (seq !== renderSeq) return undefined;
  document.title = `${state.token ? TITLES[path] || 'Trang chủ' : 'Bảo hiểm xe'} · ${host().partner ? `TASCO × ${host().partner}` : 'Bảo hiểm TASCO'}`;
  mount(root, node);
  window.scrollTo(0, 0);
  if (rendered) (root.querySelector('h1[tabindex="-1"]') || root.querySelector('main'))?.focus({ preventScroll: true });
  rendered = true;
  if (!state.token && state.meta?.demoMode && state.meta.demoCustomers?.length && !state.entryError && !demoShownOnce) { demoShownOnce = true; demoSheet(); }
  return undefined;
}
let rendered = false;
let demoShownOnce = false;

window.addEventListener('hashchange', render);
render();
