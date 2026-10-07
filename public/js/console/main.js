import { h, append, mount } from '../shared/dom.js';
import { createApi } from '../shared/api.js';
import { t, getLang, setLang } from '../shared/i18n.js';
import { HELP } from './help.js';
import { toast, errorToast, loading } from './ui.js';
import { PAGES } from './pages/index.js';
import { qrSvg } from '../shared/qr.js';

/**
 * Staff console: authentication (password + TOTP), permission-filtered
 * navigation, hash routing, contextual help, theme and language preferences.
 */

const state = { token: null, user: null, meta: null };
try { state.token = sessionStorage.getItem('token'); } catch { /* storage unavailable */ }

const api = createApi({
  getToken: () => state.token,
  onUnauthenticated: () => { if (state.user) { signOutLocal(); toast('Session expired — please sign in again', 'danger'); } },
});

const NAV = [
  { group: 'groupWork', items: [
    { route: 'home', icon: '◧', perm: 'dashboard:read' },
    { route: 'handoffs', icon: '☎', perm: 'handoff:read' },
    { route: 'leads', icon: '★', perm: 'leads:read' },
    { route: 'voice', icon: '🎙', perm: 'voice:operate' },
    { route: 'claims', icon: '✚', perm: 'claims:read' },
  ] },
  { group: 'groupGrowth', items: [
    { route: 'journeys', icon: '➜', perm: 'journeys:run' },
    { route: 'partners', icon: '⇄', perm: 'partners:manage' },
  ] },
  { group: 'groupGov', items: [
    { route: 'rules', icon: '⚖', perm: 'rules:read' },
    { route: 'dq', icon: '✓', perm: 'dq:read' },
    { route: 'audit', icon: '⛓', perm: 'audit:read' },
  ] },
  { group: 'groupAdmin', items: [
    { route: 'users', icon: '👤', perm: 'users:manage' },
    { route: 'ops', icon: '⚙', perm: 'ops:read' },
  ] },
];

const can = (perm) => !!state.user?.permissions?.includes(perm);

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
try { applyTheme(localStorage.getItem('theme')); } catch { /* ignore */ }

function signOutLocal() {
  state.token = null;
  state.user = null;
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
  for (const g of NAV) for (const i of g.items) if (can(i.perm)) return i.route;
  return 'home';
}

// ---------- Login ----------
function loginView() {
  const err = h('div', { class: 'error', role: 'alert' });
  const user = h('input', { autocomplete: 'username', required: true, name: 'username' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true, name: 'password' });
  const card = h('div', { class: 'login-card stack' });
  async function mfaStep(mfaToken, username, otpauthUri) {
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '\\d{6}', maxlength: '6', required: true });
    const mfaForm = h('form', { class: 'stack', novalidate: true },
      h('h1', { class: 'login-title' }, t('mfaTitle')),
      h('p', { class: 'muted' }, t('mfaHelp')),
      otpauthUri ? h('div', { class: 'stack' },
        h('div', { class: 'alert info' }, 'Set up two-step sign-in: scan this code with Microsoft/Google Authenticator, then enter the 6-digit code. / Quét mã bằng ứng dụng xác thực rồi nhập mã 6 số.'),
        h('div', { class: 'qr' }, qrSvg(otpauthUri, { label: 'Authenticator enrolment QR code' })),
        h('details', {}, h('summary', {}, 'Cannot scan? Enter the key manually'), h('code', {}, new URL(otpauthUri).searchParams.get('secret')))) : null,
      h('div', { class: 'field' }, h('label', { for: 'mfa' }, t('mfaCode')), Object.assign(code, { id: 'mfa' })),
      err,
      h('button', { class: 'btn primary block', type: 'submit' }, t('verify')));
    if (state.meta?.demoMode) {
      append(mfaForm, h('button', { class: 'btn ghost small', type: 'button', onclick: async () => { const r = await api.get(`/api/demo/totp/${encodeURIComponent(username)}`); code.value = r.code; } }, t('demoFillCode')));
    }
    mfaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const r = await api.post('/api/auth/mfa', { mfaToken, code: code.value.trim() });
        onSignedIn(r);
      } catch (ex) { err.textContent = ex.message; code.setAttribute('aria-invalid', 'true'); code.focus(); }
    });
    mount(card, mfaForm);
    code.focus();
  }

  const form = h('form', { class: 'stack', novalidate: true },
    h('h1', { class: 'login-title' }, t('welcome')),
    h('p', { class: 'muted' }, t('signInHelp')),
    h('div', { class: 'field' }, h('label', { for: 'u' }, t('username')), Object.assign(user, { id: 'u' })),
    h('div', { class: 'field' }, h('label', { for: 'p' }, t('password')), Object.assign(pass, { id: 'p' })),
    err,
    h('button', { class: 'btn primary block', type: 'submit' }, t('signIn')),
    h('p', { class: 'xs muted login-note' }, '🔒 ', t('securityNote')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    try {
      const r = await api.post('/api/auth/login', { username: user.value.trim(), password: pass.value });
      if (r.mfaRequired) return mfaStep(r.mfaToken, user.value.trim(), r.otpauthUri);
      onSignedIn(r);
    } catch (ex) { err.textContent = ex.message; pass.value = ''; pass.focus(); }
    return undefined;
  });

  card.append(form);
  const langBtn = h('button', { class: 'btn ghost small', type: 'button', onclick: () => { setLang(getLang() === 'vi' ? 'en' : 'vi'); render(); } }, t('language'));
  return h('div', { class: 'login' },
    h('section', { class: 'login-hero', 'aria-label': t('heroLabel') },
      h('div', { class: 'login-hero-inner' },
        h('img', { class: 'login-hero-logo', src: '/assets/tasco-logo-tight.png', alt: 'TASCO Insurance' }),
        h('p', { class: 'login-kicker' }, 'TASCO Insurance × VETC'),
        h('h2', { class: 'login-headline' }, t('heroHeadline')),
        h('ul', { class: 'login-points' }, ['heroPoint1', 'heroPoint2', 'heroPoint3'].map((k) => h('li', {}, t(k)))))),
    h('main', { id: 'main', class: 'login-panel' },
      h('div', { class: 'login-top' }, h('img', { class: 'login-mobile-logo', src: '/assets/tasco-logo-tight.png', alt: 'TASCO Insurance' }), h('span', { class: 'spacer' }), langBtn),
      card,
      h('footer', { class: 'login-credit' }, h('span', {}, t('poweredBy')), h('img', { src: '/assets/iorta-technxt-logo-tight.png', alt: 'iorta TechNXT' }))));
}

function onSignedIn(r) {
  state.token = r.accessToken;
  state.user = r.user;
  try { sessionStorage.setItem('token', r.accessToken); } catch { /* ignore */ }
  toast(`${r.user.displayName}`, 'ok');
  if (r.mustChangePassword) setTimeout(() => changePasswordDialog(true), 50);
  const current = parseRoute().name;
  const page = current && PAGES[current];
  if (!page || (page.perm && !can(page.perm))) {
    history.replaceState(null, '', `/#/${firstAllowedRoute()}`);
  }
  render();
}

// ---------- Shell ----------
function shell(route) {
  const nav = h('nav', { class: 'sidenav', id: 'sidenav', 'aria-label': 'Main' },
    NAV.map((g) => {
      const items = g.items.filter((i) => can(i.perm));
      if (!items.length) return null;
      return [h('div', { class: 'group' }, t(g.group)), h('ul', {}, items.map((i) => h('li', {},
        h('a', { href: `#/${i.route}`, 'aria-current': route.name === i.route || (route.name === 'customer' && i.route === 'leads') ? 'page' : null, onclick: () => nav.removeAttribute('data-open') },
          h('span', { 'aria-hidden': 'true' }, i.icon), t(i.route)))))];
    }));
  const menuBtn = h('button', { class: 'btn ghost menu-btn', 'aria-controls': 'sidenav', 'aria-expanded': 'false', onclick: () => {
    const open = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', String(!open));
    menuBtn.setAttribute('aria-expanded', String(!open));
  } }, '☰', h('span', { class: 'sr-only' }, t('menu')));
  const main = h('main', { id: 'main', tabindex: '-1' });
  const helpKey = route.name || 'home';
  const top = h('header', { class: 'topbar' },
    menuBtn,
    h('a', { class: 'brand', href: '#/' }, h('img', { src: '/assets/tasco-logo-tight.png', alt: 'TASCO Insurance' }), h('span', { class: 'sr-only' }, 'TASCO Growth Platform')),
    h('span', { class: 'spacer' }),
    h('span', { class: 'who' }, `${state.user.displayName} · ${state.user.roles.join(', ')}${state.user.region && state.user.region !== 'ALL' ? ` · ${state.user.region}` : ''}`),
    h('button', { class: 'btn ghost small', 'aria-haspopup': 'dialog', onclick: () => openHelp(helpKey) }, '?', h('span', { class: 'sr-only' }, t('help'))),
    h('button', { class: 'btn ghost small', onclick: () => { const cur = document.documentElement.dataset.theme; const next = cur === 'dark' ? 'light' : 'dark'; applyTheme(next); try { localStorage.setItem('theme', next); } catch { /* ignore */ } } }, '🌓', h('span', { class: 'sr-only' }, t('theme'))),
    h('button', { class: 'btn ghost small', onclick: () => { setLang(getLang() === 'vi' ? 'en' : 'vi'); render(); } }, t('language')),
    h('button', { class: 'btn ghost small', onclick: () => changePasswordDialog(false) }, '🔑', h('span', { class: 'sr-only' }, 'Change password')),
    h('button', { class: 'btn small', onclick: signOut }, t('signOut')));
  const footer = h('footer', { class: 'footer-credit' }, 'Built by', h('img', { src: '/assets/iorta-technxt-logo-tight.png', alt: 'iorta TechNXT' }), h('span', {}, `· ${state.meta?.today || ''} · ${state.meta?.store || ''}`));
  return { el: h('div', { class: 'shell' }, top, h('div', { class: 'layout' }, nav, h('div', {}, main, footer))), main };
}

function changePasswordDialog(forced = false) {
  const cur = h('input', { type: 'password', autocomplete: 'current-password', id: 'cp-cur' });
  const nw = h('input', { type: 'password', autocomplete: 'new-password', minlength: '12', id: 'cp-new' });
  const err = h('div', { class: 'error', role: 'alert' });
  const dlg = h('dialog', { 'aria-labelledby': 'cp-title' });
  const form = h('form', { class: 'stack' },
    h('h2', { id: 'cp-title' }, forced ? 'Please set your own password' : 'Change password'),
    h('div', { class: 'field' }, h('label', { for: 'cp-cur' }, 'Current password'), cur),
    h('div', { class: 'field' }, h('label', { for: 'cp-new' }, 'New password (≥ 12 characters)'), nw),
    err,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Save'), forced ? null : h('button', { class: 'btn', type: 'button', onclick: () => dlg.close() }, t('cancel'))));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/auth/password', { currentPassword: cur.value, newPassword: nw.value });
      dlg.close();
      toast('Password changed — please sign in again', 'ok');
      signOutLocal();
    } catch (ex) { err.textContent = `${ex.message}${Array.isArray(ex.details) ? `: ${ex.details.join('; ')}` : ''}`; }
  });
  dlg.append(form);
  if (forced) dlg.addEventListener('cancel', (e) => e.preventDefault());
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

function openHelp(key) {
  const help = HELP[key] || HELP.home;
  const backdrop = h('div', { class: 'backdrop', onclick: () => close() });
  const closeBtn = h('button', { class: 'btn small', onclick: () => close() }, t('close'));
  const drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title', 'data-open': 'true' },
    h('div', { class: 'row spread' }, h('h2', { id: 'help-title' }, help.title), closeBtn),
    h('ul', {}, help.body.map((b) => h('li', {}, b))),
    h('p', { class: 'muted small' }, 'Full manuals: docs/manuals in the repository.'));
  function close() { drawer.remove(); backdrop.remove(); }
  drawer.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.body.append(backdrop, drawer);
  closeBtn.focus();
}

async function render() {
  const root = document.getElementById('root');
  if (!state.meta) {
    try { state.meta = await api.get('/api/meta'); } catch { state.meta = {}; }
  }
  if (state.token && !state.user) {
    try {
      const me = await api.get('/api/auth/me');
      state.user = { ...me, displayName: me.username };
    } catch { state.token = null; }
  }
  if (!state.user) { mount(root, loginView()); root.querySelector('input')?.focus(); return; }

  const route = parseRoute();
  if (!route.name) { navigate(firstAllowedRoute()); return; }
  const { el, main } = shell(route);
  mount(root, el);
  const page = PAGES[route.name];
  if (!page) { main.append(h('div', { class: 'empty' }, 'Page not found')); return; }
  if (page.perm && !can(page.perm)) { main.append(h('div', { class: 'alert warn' }, 'You do not have access to this page.')); return; }
  loading(main);
  try {
    await page.render(main, { api, route, can, navigate, user: state.user, meta: state.meta, rerender: render });
  } catch (e) {
    errorToast(e);
    mount(main, h('div', { class: 'alert danger', role: 'alert' }, e.message));
  }
  main.querySelector('#page-title')?.focus({ preventScroll: true });
}

window.addEventListener('hashchange', render);
render();
