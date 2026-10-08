import { h, append, mount } from '../shared/dom.js';
import { createApi } from '../shared/api.js';
import { t, getLang, setLang, label } from '../shared/i18n.js';
import { icon } from '../shared/icons.js';
import { HELP } from './help.js';
import {
  toast, errorToast, loading, iconButton, avatar, dropdownMenu, popover, drawer, modal, button, formField,
  emptyState, formatPlate, formatRelative, formatNumber, formatDate, tooltip, closePopovers,
} from './ui.js';
import { PAGES } from './pages/index.js';
import { qrSvg } from '../shared/qr.js';

/**
 * Staff console: authentication (password + TOTP), the application shell (grouped, permission-filtered sidebar
 * with badges; top bar with breadcrumb, global customer search, notifications, help and user menu), hash routing,
 * contextual help, theme and language preferences.
 *
 * Pages are modules { perm, render(main, ctx) } registered in ./pages/index.js. ctx = { api, route, can, navigate,
 * user, meta, rerender, refreshSignals }. Optional routes listed in NAV (approvals, campaigns) appear automatically
 * once a page module with that name is registered.
 */

document.documentElement.lang = getLang();

const state = { token: null, user: null, meta: null };
try { state.token = sessionStorage.getItem('token'); } catch { /* storage unavailable */ }

const api = createApi({
  getToken: () => state.token,
  onUnauthenticated: () => { if (state.user) { signOutLocal(); toast(t('sessionExpired'), 'danger'); } },
});

/**
 * Navigation model. badge: key in the signals object (counts derived from existing APIs, role-aware).
 * `optional` items are shown only when a page module with that route exists.
 */
const NAV = [
  { group: null, items: [
    { route: 'home', icon: 'layout-dashboard', perm: 'dashboard:read', altPerm: 'handoff:work' }, // agents: "My work today"
  ] },
  { group: 'groupSell', items: [
    { route: 'leads', icon: 'users', perm: 'leads:read' },
    { route: 'handoffs', icon: 'inbox', perm: 'handoff:read', badge: 'handoffs' },
    { route: 'voice', icon: 'mic', perm: 'voice:operate' },
  ] },
  { group: 'groupEngage', items: [
    { route: 'journeys', icon: 'route', perm: 'journeys:run' },
    { route: 'campaigns', icon: 'megaphone', perm: 'journeys:run', optional: true },
  ] },
  { group: 'groupServe', items: [
    { route: 'claims', icon: 'shield-check', perm: 'claims:read', badge: 'claims' },
  ] },
  { group: 'groupPartners', items: [
    { route: 'partners', icon: 'handshake', perm: 'partners:manage' },
  ] },
  { group: 'groupData', items: [
    { route: 'dq', icon: 'database', perm: 'dq:read', badge: 'dq' },
  ] },
  { group: 'groupGov', items: [
    { route: 'rules', icon: 'scale', perm: 'rules:read', badge: 'approvalsOnRules' },
    { route: 'approvals', icon: 'clipboard-check', perm: 'rules:approve', optional: true, badge: 'approvals' },
    { route: 'audit', icon: 'history', perm: 'audit:read' },
  ] },
  { group: 'groupAdmin', items: [
    { route: 'users', icon: 'user-cog', perm: 'users:manage' },
    { route: 'ops', icon: 'activity', perm: 'ops:read' },
  ] },
];
/** Child routes → the nav item they belong to (for the active state and breadcrumb). */
const PARENT = { customer: 'leads' };

const can = (perm) => !!state.user?.permissions?.includes(perm);
const visibleItems = (g) => g.items.filter((i) => (can(i.perm) || (i.altPerm && can(i.altPerm))) && (!i.optional || PAGES[i.route]));

/* ---------- Preferences ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } },
};
function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
applyTheme(store.get('theme'));
const currentTheme = () => store.get('theme') || 'system';
function setTheme(theme) {
  store.set('theme', theme === 'system' ? null : theme);
  applyTheme(theme);
}
function switchLang(l) {
  if (l === getLang()) return;
  setLang(l);
  shell = null;
  render();
}

function signOutLocal() {
  state.token = null;
  state.user = null;
  shell = null;
  signals.cache = null;
  try { sessionStorage.removeItem('token'); } catch { /* ignore */ }
  history.replaceState(null, '', '/');
  render();
}

async function signOut() {
  try { await api.post('/api/auth/logout'); } catch { /* token may already be invalid */ }
  signOutLocal();
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || '';
  const [pathPart, queryPart] = raw.split('?');
  const [name, ...rest] = pathPart.split('/');
  return { name: name || null, params: rest.map(decodeURIComponent), query: Object.fromEntries(new URLSearchParams(queryPart || '')) };
}

export function navigate(path) {
  location.hash = `#/${path}`;
}

function firstAllowedRoute() {
  for (const g of NAV) for (const i of visibleItems(g)) return i.route;
  return 'home';
}

// ---------- Login ----------
/** Pending second step (kept across a language switch so the MFA step is not lost). */
let loginPending = null;

function loginView() {
  const L = (en, vi) => (getLang() === 'vi' ? vi : en);
  const card = h('div', { class: 'login-card' });
  const alertBox = h('div', { class: 'login-alert', role: 'alert', hidden: true });
  const showAlert = (msg) => {
    if (!msg) { alertBox.hidden = true; mount(alertBox); return; }
    mount(alertBox, icon('alert-circle', { size: 18 }), h('span', {}, msg));
    alertBox.hidden = false;
  };
  const authError = (ex) => {
    const m = String(ex?.message || '');
    if (ex?.status === 423) return L('Your account is temporarily locked after several failed attempts. Try again later or contact your administrator.', 'Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau hoặc liên hệ quản trị viên.');
    if (ex?.status === 429) return L('Too many attempts. Please wait a moment and try again.', 'Bạn thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.');
    if (/already been used/i.test(m)) return L('This code has already been used. Wait for the next code in your authenticator app.', 'Mã này đã được sử dụng. Vui lòng đợi mã tiếp theo trong ứng dụng xác thực.');
    if (/MFA session expired/i.test(m)) return L('Your sign-in session expired. Please sign in again.', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    if (/Invalid code/i.test(m)) return L('Incorrect code. Check the 6 digits and that your phone’s clock is correct.', 'Mã không đúng. Kiểm tra 6 chữ số và giờ trên điện thoại của bạn.');
    if (ex?.status === 401) return L('Incorrect username or password.', 'Tên đăng nhập hoặc mật khẩu không đúng.');
    if (ex instanceof TypeError) return L('Cannot reach the server. Check your connection and try again.', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
    return L('Sign-in failed. Please try again.', 'Đăng nhập không thành công. Vui lòng thử lại.');
  };
  const setBusy = (btn, on) => { if (on) { btn.setAttribute('aria-busy', 'true'); btn.disabled = true; } else { btn.removeAttribute('aria-busy'); btn.disabled = false; } };
  const fieldError = (input, msg) => {
    const el = document.getElementById(`${input.id}-err`);
    if (el) mount(el, msg ? [icon('alert-circle', { size: 14 }), msg] : []);
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  };

  // Step 2: six-box TOTP code (typing, paste, backspace and arrow keys), auto-submits when complete.
  function mfaStep({ mfaToken, username, otpauthUri }) {
    loginPending = { mfaToken, username, otpauthUri };
    const boxes = Array.from({ length: 6 }, (_, i) => h('input', {
      class: 'otp-box', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '1', autocomplete: i === 0 ? 'one-time-code' : 'off',
      'aria-label': L(`Digit ${i + 1} of 6`, `Chữ số ${i + 1} trên 6`), id: i === 0 ? 'mfa' : null,
    }));
    const code = () => boxes.map((b) => b.value).join('');
    const fill = (digits, from = 0) => {
      const d = String(digits).replace(/\D/g, '').slice(0, 6 - from).split('');
      d.forEach((x, k) => { boxes[from + k].value = x; });
      boxes.forEach((b) => b.classList.toggle('filled', !!b.value));
      const next = boxes.find((b) => !b.value);
      (next || boxes[5]).focus();
      return d.length;
    };
    const clearInvalid = () => { boxes.forEach((b) => b.removeAttribute('aria-invalid')); showAlert(''); };
    const submitBtn = h('button', { class: 'btn primary block lg', type: 'submit' }, h('span', {}, t('verify')));
    const mfaForm = h('form', { class: 'login-form', novalidate: true });
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        clearInvalid();
        const v = b.value.replace(/\D/g, '');
        if (v.length > 1) { fill(v, i); } else { b.value = v; b.classList.toggle('filled', !!v); if (v && i < 5) boxes[i + 1].focus(); }
        if (code().length === 6) mfaForm.requestSubmit();
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !b.value && i > 0) { e.preventDefault(); boxes[i - 1].value = ''; boxes[i - 1].classList.remove('filled'); boxes[i - 1].focus(); }
        else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); boxes[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && i < 5) { e.preventDefault(); boxes[i + 1].focus(); }
      });
      b.addEventListener('focus', () => b.select());
      b.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
        if (!/\d/.test(text)) return;
        e.preventDefault();
        clearInvalid();
        fill(text, text.replace(/\D/g, '').length >= 6 ? 0 : i);
        if (code().length === 6) mfaForm.requestSubmit();
      });
    });
    const back = h('button', { class: 'login-back', type: 'button', onclick: () => { loginPending = null; render(); } }, icon('arrow-left', { size: 16 }), L('Use a different account', 'Đăng nhập bằng tài khoản khác'));
    append(mfaForm,
      back,
      h('span', { class: 'login-badge', 'aria-hidden': 'true' }, icon('shield-check', { size: 24 })),
      h('h1', { class: 'login-title' }, t('mfaTitle')),
      h('p', { class: 'login-sub' }, t('mfaHelp'), ' ', h('span', { class: 'login-user' }, icon('user', { size: 14 }), username)),
      otpauthUri ? h('div', { class: 'login-enrol' },
        h('p', {}, L('First sign-in: scan this code with Microsoft or Google Authenticator, then enter the 6-digit code.', 'Lần đăng nhập đầu: quét mã bằng Microsoft hoặc Google Authenticator, sau đó nhập mã 6 số.')),
        h('div', { class: 'qr' }, qrSvg(otpauthUri, { label: L('Authenticator set-up QR code', 'Mã QR cài đặt ứng dụng xác thực') })),
        h('details', {}, h('summary', {}, L('Can’t scan? Enter the key manually', 'Không quét được? Nhập khóa thủ công')), h('code', {}, new URL(otpauthUri).searchParams.get('secret')))) : null,
      h('fieldset', { class: 'otp-field' },
        h('legend', { class: 'login-label' }, t('mfaCode')),
        h('div', { class: 'otp', role: 'group' }, boxes.slice(0, 3), h('span', { class: 'otp-sep', 'aria-hidden': 'true' }), boxes.slice(3))),
      alertBox,
      submitBtn);
    if (state.meta?.demoMode) {
      const demoBtn = h('button', { class: 'btn secondary block', type: 'button' }, icon('key', { size: 16 }), h('span', {}, t('demoFillCode')));
      demoBtn.addEventListener('click', async () => {
        setBusy(demoBtn, true);
        try {
          const r = await api.get(`/api/demo/totp/${encodeURIComponent(username)}`);
          if (!r.code) { showAlert(`${t('waitForCode')} ${r.waitSeconds}s`); return; }
          clearInvalid();
          fill(r.code, 0);
          mfaForm.requestSubmit();
        } catch (ex) { showAlert(authError(ex)); } finally { setBusy(demoBtn, false); }
      });
      append(mfaForm, h('div', { class: 'demo-mfa' }, h('p', { class: 'login-hint' }, icon('info', { size: 14 }), h('span', {}, t('demoMfaHint'))), demoBtn));
    }
    mfaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (code().length !== 6) {
        boxes.forEach((b) => { if (!b.value) b.setAttribute('aria-invalid', 'true'); });
        showAlert(L('Enter all 6 digits of the code.', 'Vui lòng nhập đủ 6 chữ số.'));
        (boxes.find((b) => !b.value) || boxes[0]).focus();
        return;
      }
      if (submitBtn.getAttribute('aria-busy')) return;
      setBusy(submitBtn, true);
      try {
        const r = await api.post('/api/auth/mfa', { mfaToken, code: code() });
        loginPending = null;
        onSignedIn(r);
      } catch (ex) {
        setBusy(submitBtn, false);
        if (/MFA session expired/i.test(String(ex?.message))) loginPending = null;
        showAlert(authError(ex));
        boxes.forEach((b) => { b.value = ''; b.classList.remove('filled'); b.setAttribute('aria-invalid', 'true'); });
        boxes[0].focus();
      }
    });
    mount(card, mfaForm);
    setTimeout(() => boxes[0].focus(), 0);
  }

  // Step 1: username + password.
  const user = h('input', { id: 'u', autocomplete: 'username', required: true, name: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-describedby': 'u-err' });
  const pass = h('input', { id: 'p', type: 'password', autocomplete: 'current-password', required: true, name: 'password', 'aria-describedby': 'p-err p-caps' });
  const toggle = h('button', { class: 'login-pw-toggle', type: 'button', 'aria-controls': 'p', 'aria-pressed': 'false', 'aria-label': L('Show password', 'Hiện mật khẩu') }, icon('eye', { size: 18 }));
  toggle.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? L('Hide password', 'Ẩn mật khẩu') : L('Show password', 'Hiện mật khẩu'));
    mount(toggle, icon(show ? 'eye-off' : 'eye', { size: 18 }));
    pass.focus();
  });
  const caps = h('p', { class: 'login-caps', id: 'p-caps', hidden: true }, icon('arrow-big-up', { size: 14 }), L('Caps Lock is on', 'Caps Lock đang bật'));
  const capsCheck = (e) => { if (e.getModifierState) caps.hidden = !e.getModifierState('CapsLock'); };
  pass.addEventListener('keydown', capsCheck);
  pass.addEventListener('keyup', capsCheck);
  pass.addEventListener('blur', () => { caps.hidden = true; });
  user.addEventListener('input', () => { fieldError(user, ''); showAlert(''); });
  pass.addEventListener('input', () => { fieldError(pass, ''); showAlert(''); });
  const submitBtn = h('button', { class: 'btn primary block lg', type: 'submit' }, h('span', {}, t('signIn')));
  const form = h('form', { class: 'login-form', novalidate: true },
    h('h1', { class: 'login-title' }, t('welcome')),
    h('p', { class: 'login-sub' }, t('signInHelp')),
    alertBox,
    h('div', { class: 'field' }, h('label', { for: 'u' }, t('username')), user, h('span', { class: 'login-field-error', id: 'u-err' })),
    h('div', { class: 'field' }, h('label', { for: 'p' }, t('password')),
      h('div', { class: 'login-pw' }, pass, toggle), caps, h('span', { class: 'login-field-error', id: 'p-err' })),
    submitBtn,
    h('p', { class: 'login-hint' }, icon('lock', { size: 14 }), h('span', {}, t('securityNote'))));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert('');
    const u = user.value.trim();
    fieldError(user, u ? '' : L('Enter your username.', 'Vui lòng nhập tên đăng nhập.'));
    fieldError(pass, pass.value ? '' : L('Enter your password.', 'Vui lòng nhập mật khẩu.'));
    if (!u) { user.focus(); return; }
    if (!pass.value) { pass.focus(); return; }
    setBusy(submitBtn, true);
    try {
      const r = await api.post('/api/auth/login', { username: u, password: pass.value });
      if (r.mfaRequired) { mfaStep({ mfaToken: r.mfaToken, username: u, otpauthUri: r.otpauthUri }); return; }
      onSignedIn(r);
    } catch (ex) {
      setBusy(submitBtn, false);
      showAlert(authError(ex));
      if (ex?.status === 401) { pass.value = ''; pass.setAttribute('aria-invalid', 'true'); }
      pass.focus();
    }
  });
  card.append(form);
  if (loginPending) mfaStep(loginPending);

  const langSwitch = h('div', { class: 'login-lang', role: 'group', 'aria-label': L('Language', 'Ngôn ngữ') },
    icon('globe', { size: 16 }),
    [['en', 'EN', 'English'], ['vi', 'VI', 'Tiếng Việt']].map(([code, short, full]) => h('button', {
      type: 'button', lang: code, 'aria-pressed': String(getLang() === code), 'aria-label': full, title: full,
      onclick: () => { if (getLang() !== code) { setLang(code); render(); } },
    }, short)));
  return h('div', { class: 'login' },
    h('section', { class: 'login-hero', 'aria-label': t('heroLabel') },
      h('div', { class: 'login-hero-inner' },
        h('img', { class: 'login-hero-logo', src: '/assets/tasco-logo-tight.png', alt: 'TASCO Insurance' }),
        h('p', { class: 'login-kicker' }, 'TASCO Insurance × VETC'),
        h('h2', { class: 'login-headline' }, t('heroHeadline')),
        h('ul', { class: 'login-points' }, ['heroPoint1', 'heroPoint2', 'heroPoint3'].map((k) => h('li', {}, h('span', { class: 'login-point-icon' }, icon('check', { size: 14, strokeWidth: 3 })), h('span', {}, t(k)))))),
      h('img', { class: 'login-hero-art', src: '/assets/login-hero.svg', alt: '' })),
    h('main', { id: 'main', class: 'login-panel' },
      h('div', { class: 'login-top' }, h('img', { class: 'login-mobile-logo', src: '/assets/tasco-logo-tight.png', alt: 'TASCO Insurance' }), h('span', { class: 'spacer' }), langSwitch),
      card,
      h('footer', { class: 'login-credit' }, h('span', {}, t('poweredBy')), h('img', { src: '/assets/iorta-technxt-logo-tight.png', alt: 'iorta TechNXT' }))));
}


function onSignedIn(r) {
  state.token = r.accessToken;
  state.user = r.user;
  try { sessionStorage.setItem('token', r.accessToken); } catch { /* ignore */ }
  toast(`${t('hello')}, ${r.user.displayName || r.user.username}`, 'ok', { timeout: 3500 });
  if (r.mustChangePassword) setTimeout(() => changePasswordDialog(true), 50);
  const current = parseRoute().name;
  const page = current && PAGES[current];
  if (!page || (page.perm && !can(page.perm))) {
    history.replaceState(null, '', `/#/${firstAllowedRoute()}`);
  }
  render();
}

// ---------- Signals: badge counts + notifications (derived from existing APIs, role-aware, fail silently) ----------
const signals = {
  cache: null,
  at: 0,
  async load(force = false) {
    if (!force && this.cache && Date.now() - this.at < 30000) return this.cache;
    const out = { handoffs: 0, approvals: 0, approvalsOnRules: 0, dq: 0, claims: 0, items: [] };
    const jobs = [];
    if (can('handoff:work')) {
      jobs.push(api.get('/api/handoffs?status=open&limit=10').then((r) => {
        out.handoffs = r.total || 0;
        for (const ho of r.items || []) {
          out.items.push({ kind: 'handoff', icon: 'phone-call', tone: 'danger', title: t('notifHandoffItem'), text: formatPlate(ho.plate), at: ho.createdAt || ho.created_at, href: '#/handoffs' });
        }
      }));
    }
    if (can('rules:approve')) {
      jobs.push(Promise.all([api.get('/api/rules?status=pending_approval'), api.get('/api/rules/context').catch(() => ({}))]).then(([r, context]) => {
        // Count only the changes this user can decide (not their own, and restricted kinds only for the named roles),
        // so the badge matches "Waiting for you" on the Approvals page.
        const restricted = context?.restrictedKinds || {};
        const list = (Array.isArray(r) ? r : r.items || []).filter((x) => x.createdBy !== state.user.id && (!restricted[x.kind] || restricted[x.kind].some((role) => state.user.roles.includes(role))));
        out.approvals = list.length;
        if (!PAGES.approvals) out.approvalsOnRules = list.length;
        for (const rs of list.slice(0, 10)) {
          out.items.push({ kind: 'approval', icon: 'clipboard-check', tone: 'warn', title: t('notifApprovalItem'), text: `${label('ruleKind', rs.kind)} · v${rs.version_no}${rs.createdByName ? ` · ${rs.createdByName}` : ''}`, at: rs.submittedAt || rs.createdAt, href: PAGES.approvals ? '#/approvals' : '#/rules' });
        }
      }));
    }
    if (can('claims:update')) {
      jobs.push(api.get('/api/claims?status=submitted&limit=100').then((r) => {
        const list = Array.isArray(r) ? r : r.items || [];
        const soon = Date.now() + 2 * 3600000;
        const due = list.filter((c) => c.slaDueAt && new Date(c.slaDueAt).getTime() <= soon);
        out.claims = due.length;
        for (const c of due.slice(0, 10)) {
          const overdue = new Date(c.slaDueAt).getTime() < Date.now();
          out.items.push({ kind: 'claim', icon: overdue ? 'alert-triangle' : 'clock', tone: overdue ? 'danger' : 'warn', title: t(overdue ? 'notifClaimOverdue' : 'notifClaimItem'), text: c.plate ? formatPlate(c.plate) : '', at: c.slaDueAt, href: '#/claims' });
        }
      }));
    }
    if (can('dq:resolve')) {
      jobs.push(api.get('/api/dq/issues?status=open&limit=1').then((r) => { out.dq = r.total || 0; }));
    }
    await Promise.allSettled(jobs);
    out.items.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    this.cache = out;
    this.at = Date.now();
    return out;
  },
};

// ---------- Shell ----------
let shell = null;

const fmtBadge = (n) => (n > 999 ? '999+' : formatNumber(n));

function buildShell() {
  const user = state.user;
  const collapsedPref = store.get('navCollapsed') === '1';
  const navLinks = new Map();
  const badges = new Map();

  // Sidebar
  const nav = h('nav', { class: 'sidebar-nav', 'aria-label': t('mainNav') },
    NAV.map((g) => {
      const items = visibleItems(g);
      if (!items.length) return null;
      const gid = g.group ? `nav-${g.group}` : null;
      return h('div', { class: 'nav-group' },
        gid ? h('div', { class: 'nav-group-label', id: gid }, t(g.group)) : null,
        h('ul', { 'aria-labelledby': gid }, items.map((i) => {
          const b = i.badge ? h('span', { class: 'nav-badge', hidden: true }) : null;
          if (b) badges.set(i.badge, [...(badges.get(i.badge) || []), b]);
          const a = h('a', { href: `#/${i.route}`, class: 'nav-link', onclick: () => closeMobileNav() },
            icon(i.icon, { size: 18 }), h('span', { class: 'nav-label' }, t(i.route)), b);
          a.dataset.label = t(i.route);
          a.setAttribute('aria-label', t(i.route));
          tooltip(a, t(i.route), { pos: 'right' });
          navLinks.set(i.route, a);
          return h('li', {}, a);
        })));
    }));
  const collapseBtn = h('button', { type: 'button', class: 'nav-collapse', 'aria-pressed': String(collapsedPref) });
  const syncCollapse = (on) => {
    el.dataset.collapsed = String(on);
    collapseBtn.setAttribute('aria-pressed', String(on));
    collapseBtn.setAttribute('aria-label', on ? t('expandSidebar') : t('collapseSidebar'));
    mount(collapseBtn, icon(on ? 'panel-left-open' : 'panel-left-close', { size: 18 }), h('span', { class: 'nav-label' }, t('collapseSidebar')));
  };
  collapseBtn.addEventListener('click', () => {
    const on = el.dataset.collapsed !== 'true';
    store.set('navCollapsed', on ? '1' : '0');
    syncCollapse(on);
  });
  const sidebar = h('aside', { class: 'sidebar', id: 'sidebar' },
    h('a', { class: 'sidebar-brand', href: '#/', 'aria-label': 'TASCO Insurance — Growth Platform' },
      h('span', { class: 'brand-logo' }, h('img', { src: '/assets/tasco-logo-tight.png', alt: '' })),
      h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'T'),
      h('span', { class: 'brand-product' }, 'Growth Platform')),
    nav,
    h('div', { class: 'sidebar-foot' }, collapseBtn));

  // Top bar: mobile menu, breadcrumb, search, notifications, help, user menu
  const menuBtn = iconButton({ icon: 'menu', label: t('menu'), attrs: { class: 'btn icon-btn ghost menu-btn', 'aria-controls': 'sidebar', 'aria-expanded': 'false' }, noTooltip: true });
  menuBtn.addEventListener('click', () => {
    const open = el.dataset.navOpen === 'true';
    el.dataset.navOpen = String(!open);
    menuBtn.setAttribute('aria-expanded', String(!open));
  });
  function closeMobileNav() { el.dataset.navOpen = 'false'; menuBtn.setAttribute('aria-expanded', 'false'); }
  const crumbs = h('nav', { class: 'breadcrumb', 'aria-label': t('breadcrumb') });

  const bell = can('handoff:work') || can('rules:approve') || can('claims:update') || can('dq:resolve')
    ? iconButton({ icon: 'bell', label: t('notifications') }) : null;
  if (bell) {
    popover(bell, () => notificationsPanel(), { label: t('notifications'), class: 'notif-pop', width: 380 });
  }
  const helpBtn = iconButton({ icon: 'help-circle', label: t('help'), attrs: { 'aria-haspopup': 'dialog' }, onClick: () => openHelp(shell?.helpKey || 'home') });

  const roleText = user.roles.map((r) => label('role', r)).join(', ');
  const regionText = user.region && user.region !== 'ALL' ? user.region : t('allRegions');
  const userBtn = h('button', { type: 'button', class: 'user-btn', 'aria-label': `${t('userMenu')}: ${user.displayName || user.username}` },
    avatar(user.displayName || user.username),
    h('span', { class: 'user-text' }, h('span', { class: 'user-name' }, user.displayName || user.username), h('span', { class: 'user-role' }, roleText)),
    icon('chevron-down', { size: 16, class: 'user-chev' }));
  dropdownMenu(userBtn, () => [
    { node: h('div', { class: 'menu-profile', role: 'presentation' }, avatar(user.displayName || user.username, { size: 'lg' }),
      h('div', { class: 'grow' }, h('div', { class: 'strong' }, user.displayName || user.username), h('div', { class: 'small muted' }, roleText),
        h('div', { class: 'xs subtle' }, `${t('profileRegion')}: ${regionText}`))) },
    { separator: true },
    { heading: t('languageLabel') },
    { label: 'English', icon: 'globe', checked: getLang() === 'en', onClick: () => switchLang('en') },
    { label: 'Tiếng Việt', icon: 'globe', checked: getLang() === 'vi', onClick: () => switchLang('vi') },
    { heading: t('theme') },
    { label: t('themeLight'), icon: 'sun', checked: currentTheme() === 'light', onClick: () => setTheme('light') },
    { label: t('themeDark'), icon: 'moon', checked: currentTheme() === 'dark', onClick: () => setTheme('dark') },
    { label: t('themeSystem'), icon: 'monitor', checked: currentTheme() === 'system', onClick: () => setTheme('system') },
    { separator: true },
    { label: t('changePassword'), icon: 'key', onClick: () => changePasswordDialog(false) },
    { label: t('signOut'), icon: 'log-out', onClick: signOut },
  ], { label: t('userMenu'), width: 280 });

  const search = can('profile:read') ? globalSearch() : null;
  const topbar = h('header', { class: 'topbar' },
    menuBtn, crumbs, h('span', { class: 'spacer' }),
    search,
    h('div', { class: 'topbar-actions' }, bell, helpBtn),
    h('span', { class: 'topbar-divider', 'aria-hidden': 'true' }),
    userBtn);

  const main = h('main', { id: 'main', tabindex: '-1' });
  const footer = h('footer', { class: 'app-footer' }, t('footerCredit'));
  const scrim = h('div', { class: 'nav-scrim', onclick: () => closeMobileNav() });
  const el = h('div', { class: 'app-shell' }, sidebar, scrim, h('div', { class: 'app-main' }, topbar, h('div', { class: 'app-content' }, main), footer));
  syncCollapse(collapsedPref);

  function setCrumbs(items) {
    mount(crumbs, h('ol', {}, items.map((c, i) => h('li', {},
      i ? icon('chevron-right', { size: 14, class: 'crumb-sep' }) : null,
      c.href && i < items.length - 1 ? h('a', { href: c.href }, c.label) : h('span', { 'aria-current': i === items.length - 1 ? 'page' : null }, c.label)))));
  }

  async function refreshSignals(force = false) {
    const sg = await signals.load(force).catch(() => null);
    if (!sg || shell?.el !== el) return;
    for (const [key, els] of badges) {
      for (const b of els) {
        const n = sg[key] || 0;
        b.hidden = !n;
        b.textContent = n ? fmtBadge(n) : '';
        b.closest('a')?.setAttribute('aria-label', n ? `${b.closest('a').dataset.label} (${formatNumber(n)})` : b.closest('a').dataset.label);
      }
    }
    if (bell) bell.setBadge(sg.handoffs + sg.approvals + sg.claims);
  }

  function notificationsPanel() {
    const body = h('div', { class: 'notif-body' }, h('div', { class: 'notif-loading' }, h('div', { class: 'skeleton', style: 'height:44px' }), h('div', { class: 'skeleton', style: 'height:44px;margin-top:8px' })));
    const panel = h('div', { class: 'notif' }, h('div', { class: 'notif-head' }, h('h2', {}, t('notifications'))), body);
    signals.load(true).then((sg) => {
      refreshSignals();
      const items = [...sg.items];
      if (sg.dq) items.push({ kind: 'dq', icon: 'database', tone: 'info', title: t('dq'), text: t('notifDq', formatNumber(sg.dq)), href: '#/dq' });
      if (!items.length) { mount(body, emptyState({ icon: 'bell', title: t('allCaughtUp'), text: t('allCaughtUpHint'), compact: true })); return; }
      const summary = [sg.handoffs ? t('notifHandoffs', sg.handoffs) : null, sg.approvals ? t('notifApprovals', sg.approvals) : null, sg.claims ? t('notifClaims', sg.claims) : null].filter(Boolean);
      mount(body,
        summary.length ? h('p', { class: 'notif-summary' }, summary.join(' · ')) : null,
        h('ul', { class: 'notif-list' }, items.slice(0, 12).map((n) => h('li', {}, h('a', { href: n.href, class: 'notif-item', onclick: () => closePopovers() },
          h('span', { class: `notif-icon ${n.tone}` }, icon(n.icon, { size: 16 })),
          h('span', { class: 'notif-text' }, h('span', { class: 'notif-title' }, n.title), h('span', { class: 'notif-sub' }, n.text)),
          n.at ? h('time', { class: 'notif-time', datetime: n.at }, formatRelative(n.at)) : null)))));
    }).catch(() => mount(body, emptyState({ icon: 'bell', title: t('allCaughtUp'), compact: true })));
    return panel;
  }

  return {
    el, main, helpKey: 'home', key: `${getLang()}|${user.id}`,
    update(route) {
      const active = PARENT[route.name] || route.name;
      for (const [r, a] of navLinks) {
        if (r === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      }
      this.helpKey = route.name || 'home';
      const group = NAV.find((g) => g.items.some((i) => i.route === active));
      const items = [];
      if (group?.group) items.push({ label: t(group.group) });
      if (PARENT[route.name]) items.push({ label: t(active), href: `#/${active}` }, { label: t(route.name) });
      else items.push({ label: t(route.name) });
      setCrumbs(items);
      closeMobileNav();
      refreshSignals();
    },
    setCrumbs,
    refreshSignals,
  };
}

/** Top-bar customer search (combobox): plate prefix or full phone → Customer 360. */
function globalSearch() {
  const listId = 'gs-list';
  const inp = h('input', {
    type: 'search', class: 'gs-input', placeholder: t('searchPlaceholder'), 'aria-label': t('searchLabel'), role: 'combobox',
    'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId, autocomplete: 'off', spellcheck: 'false',
  });
  const list = h('ul', { class: 'gs-list', id: listId, role: 'listbox', 'aria-label': t('searchLabel'), hidden: true });
  const wrap = h('div', { class: 'gs', role: 'search' }, icon('search', { size: 16, class: 'gs-icon' }), inp, h('kbd', { class: 'gs-kbd', 'aria-hidden': 'true' }, '/'), list);
  let results = [];
  let active = -1;
  let timer = null;
  let seq = 0;
  const close = () => { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); active = -1; };
  const open = () => { list.hidden = false; inp.setAttribute('aria-expanded', 'true'); };
  const go = (r) => { close(); inp.value = ''; inp.blur(); navigate(`customer/${encodeURIComponent(r.id)}`); };
  const setActive = (i) => {
    active = i;
    [...list.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    if (i >= 0 && list.children[i]) { inp.setAttribute('aria-activedescendant', list.children[i].id); list.children[i].scrollIntoView({ block: 'nearest' }); }
  };
  const message = (text, ic = 'search') => { mount(list, h('li', { class: 'gs-msg', role: 'presentation' }, icon(ic, { size: 16 }), text)); open(); };
  async function run(q) {
    const my = ++seq;
    const compact = q.replace(/[^0-9A-Za-z]/g, '');
    if (compact.length < 3) { if (q) message(t('searchHint'), 'info'); else close(); return; }
    message(t('searching'));
    try {
      const r = await api.get(`/api/search/customers?q=${encodeURIComponent(q)}&limit=8`);
      if (my !== seq) return;
      results = r.items || [];
      if (!results.length) { message(t('searchNoResults')); return; }
      mount(list, results.map((x, i) => {
        const li = h('li', { id: `gs-opt-${i}`, role: 'option', class: 'gs-opt', 'aria-selected': 'false' },
          h('span', { class: 'gs-opt-icon' }, icon('car', { size: 16 })),
          h('span', { class: 'gs-opt-main' }, h('span', { class: 'gs-plate' }, formatPlate(x.plate || x.id)), h('span', { class: 'gs-sub' }, [x.name, x.region].filter(Boolean).join(' · '))),
          x.expiryDate ? h('span', { class: 'gs-meta' }, `${t('expiry')} ${formatDate(x.expiryDate)}`) : null);
        li.addEventListener('mousedown', (e) => { e.preventDefault(); go(x); });
        return li;
      }));
      open();
      setActive(0);
    } catch { if (my === seq) message(t('searchNoResults')); }
  }
  inp.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(inp.value.trim()), 250); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.length && !list.hidden) { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp' && results.length && !list.hidden) { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && results[active] && !list.hidden) go(results[active]); else run(inp.value.trim()); }
    else if (e.key === 'Escape') { if (!list.hidden) { e.stopPropagation(); close(); } else { inp.value = ''; inp.blur(); } }
  });
  inp.addEventListener('blur', () => setTimeout(close, 120));
  inp.addEventListener('focus', () => { if (inp.value.trim()) run(inp.value.trim()); });
  return wrap;
}

// "/" focuses the global search (unless typing in a field).
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  const inp = document.querySelector('.gs-input');
  if (inp) { e.preventDefault(); inp.focus(); }
});
// Pages update the top-bar breadcrumb through ui.setBreadcrumb() / pageHeader({ breadcrumb }).
document.addEventListener('tasco:breadcrumb', (e) => { if (shell && Array.isArray(e.detail)) shell.setCrumbs(e.detail); });

function changePasswordDialog(forced = false) {
  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const nw = h('input', { type: 'password', autocomplete: 'new-password', minlength: '12' });
  const err = h('div', { class: 'error', role: 'alert' });
  const form = h('form', { class: 'stack', id: 'cp-form' },
    formField({ label: t('currentPassword'), control: cur, required: true }),
    formField({ label: t('newPassword'), control: nw, required: true, help: t('newPasswordHelp') }),
    err);
  const save = button({ label: t('save'), variant: 'primary', type: 'submit', attrs: { form: 'cp-form' } });
  const m = modal({
    title: forced ? t('setOwnPassword') : t('changePassword'), body: form, dismissible: !forced, size: 'sm',
    actions: [forced ? null : button({ label: t('cancel'), onClick: () => m.close() }), save].filter(Boolean),
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    save.setLoading(true);
    try {
      await api.post('/api/auth/password', { currentPassword: cur.value, newPassword: nw.value });
      m.close();
      toast(t('passwordChanged'), 'ok');
      signOutLocal();
    } catch (ex) { err.textContent = `${ex.message}${Array.isArray(ex.details) ? `: ${ex.details.join('; ')}` : ''}`; } finally { save.setLoading(false); }
  });
  cur.focus();
}

function openHelp(key) {
  const help = HELP[key] || HELP.home;
  drawer({
    title: help.title, subtitle: t('help'), size: 'sm',
    body: h('div', { class: 'help-body' },
      h('ul', { class: 'help-list' }, help.body.map((b) => h('li', {}, icon('check-circle', { size: 16 }), h('span', {}, b)))),
      h('p', { class: 'muted small' }, t('helpManuals'))),
  });
}

async function render() {
  const root = document.getElementById('root');
  if (!state.meta) {
    try { state.meta = await api.get('/api/meta'); } catch { state.meta = {}; }
  }
  if (state.token && !state.user) {
    try {
      const me = await api.get('/api/auth/me');
      state.user = { ...me, displayName: me.displayName || me.username };
    } catch { state.token = null; }
  }
  if (!state.user) { shell = null; mount(root, loginView()); root.querySelector('input')?.focus(); return; }

  const route = parseRoute();
  if (!route.name) { navigate(firstAllowedRoute()); return; }
  if (!shell || shell.key !== `${getLang()}|${state.user.id}` || !document.contains(shell.el)) {
    shell = buildShell();
    mount(root, shell.el);
  }
  closePopovers();
  shell.update(route);
  const { main } = shell;
  const page = PAGES[route.name];
  if (!page) { mount(main, emptyState({ icon: 'alert-circle', title: t('pageNotFound') })); return; }
  if (page.perm && !can(page.perm)) { mount(main, emptyState({ icon: 'lock', title: t('noAccess') })); return; }
  loading(main);
  window.scrollTo(0, 0);
  try {
    await page.render(main, { api, route, can, navigate, user: state.user, meta: state.meta, rerender: render, refreshSignals: () => shell?.refreshSignals(true) });
  } catch (e) {
    errorToast(e);
    mount(main, emptyState({ icon: 'alert-triangle', title: e.message }));
  }
  main.querySelector('#page-title')?.focus({ preventScroll: true });
}

window.addEventListener('hashchange', render);
render();
