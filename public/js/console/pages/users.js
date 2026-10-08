/**
 * Users — staff accounts, roles and sign-in security. Edit roles with separation-of-duties checks in plain
 * language; reset MFA, unlock, reset password, disable/enable — each with a confirmation. Admins cannot edit
 * their own roles or status (enforced by the API as well).
 */
import { h, mount } from '../../shared/dom.js';
import { label } from '../../shared/i18n.js';
import {
  pageHeader, kpiStrip, kpiTile, card, dataTable, chip, statusChip, badge, rowActions, drawer, keyValueList, button, selectInput, input,
  formField, checkbox, switchControl, toast, errorToast, confirmDialog, modal, banner, copyField, avatar, icon, formatNumber, formatRelative,
  formatDateTime, technicalDetails,
} from '../ui.js';
import { pageStrings } from './workflowLabels.js';

const t = pageStrings('users', {
  vi: {
    usSubtitle: 'Tài khoản nhân viên, vai trò và bảo mật đăng nhập', usNew: 'Thêm người dùng', usActive: 'Đang hoạt động', usMfa: 'Đã bật xác thực hai bước', usLocked: 'Bị khóa tạm thời', usDisabled: 'Đã vô hiệu hóa',
    usList: 'Danh sách người dùng', usUser: 'Người dùng', usRoles: 'Vai trò', usRegion: 'Khu vực', usMfaCol: 'Xác thực hai bước', usSignIn: 'Đăng nhập', lastSeen: (r) => `Lần cuối ${r}`, neverSigned: 'Chưa đăng nhập lần nào', usLast: 'Đăng nhập gần nhất', usStatus: 'Trạng thái', usNext: 'Thao tác',
    usMfaHint: (a, b) => `${a}/${b} tài khoản`, never: 'Chưa có', you: 'Bạn', mfaOn: 'Đã bật', mfaPending: 'Chờ thiết lập', mfaOff: 'Chưa bật', lockedChip: 'Bị khóa',
    fAll: 'Tất cả', fActive: 'Hoạt động', fLocked: 'Bị khóa', fDisabled: 'Vô hiệu hóa', fMfaPending: 'Chờ thiết lập MFA', search: 'Tìm tên, tên đăng nhập, vai trò…',
    aEditRoles: 'Sửa vai trò', aResetMfa: 'Đặt lại xác thực hai bước', aUnlock: 'Mở khóa', aResetPw: 'Đặt lại mật khẩu', aDisable: 'Vô hiệu hóa', aEnable: 'Kích hoạt', aDetails: 'Xem chi tiết',
    cResetMfa: 'Đặt lại xác thực hai bước?', cResetMfaMsg: (n) => `${n} sẽ phải thiết lập lại ứng dụng xác thực ở lần đăng nhập tới. Các phiên đang mở sẽ bị đăng xuất.`,
    cUnlock: 'Mở khóa tài khoản?', cUnlockMsg: (n) => `${n} có thể đăng nhập lại ngay.`, cResetPw: 'Đặt lại mật khẩu?', cResetPwMsg: (n) => `Một mật khẩu tạm thời sẽ được tạo cho ${n}. Người dùng phải đổi mật khẩu khi đăng nhập.`,
    cDisable: 'Vô hiệu hóa tài khoản?', cDisableMsg: (n) => `${n} sẽ bị đăng xuất và không thể đăng nhập cho đến khi được kích hoạt lại.`, cEnable: 'Kích hoạt tài khoản?', cEnableMsg: (n) => `${n} có thể đăng nhập lại.`,
    tResetMfa: 'Đã đặt lại xác thực hai bước', tUnlock: 'Đã mở khóa tài khoản', tDisable: 'Đã vô hiệu hóa tài khoản', tEnable: 'Đã kích hoạt tài khoản', tRoles: 'Đã cập nhật vai trò — các phiên cũ đã bị đăng xuất', tCreated: 'Đã tạo người dùng',
    pwTitle: 'Mật khẩu tạm thời', pwOnce: 'Sao chép mật khẩu ngay — chỉ hiển thị một lần', pwText: 'Gửi cho người dùng qua kênh riêng. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên.', pwDone: 'Tôi đã sao chép',
    editTitle: (n) => `Vai trò của ${n}`, selfRoles: 'Bạn không thể tự thay đổi vai trò của mình', selfRolesText: 'Hãy nhờ một quản trị viên khác thực hiện.', sodTitle: 'Vi phạm phân tách nhiệm vụ',
    sodPair: (a, b) => `Một người không thể vừa là “${a}” vừa là “${b}”.`, mfaWill: 'Các vai trò này bắt buộc xác thực hai bước ở lần đăng nhập tới.', vRoles: 'Chọn ít nhất một vai trò', saveRoles: 'Lưu vai trò',
    cRoles: 'Lưu thay đổi vai trò?', cRolesMsg: (n) => `${n} sẽ bị đăng xuất khỏi các phiên đang mở để áp dụng quyền mới.`, fRoles: 'Vai trò', fRegion: 'Khu vực dữ liệu', fRegionHelp: 'Giới hạn khách hàng mà người dùng được xem',
    newTitle: 'Thêm người dùng', fName: 'Họ và tên', fUsername: 'Tên đăng nhập', fUsernameHelp: 'Chữ thường, số, dấu chấm hoặc gạch', fMfa: 'Bắt buộc xác thực hai bước', fMfaForced: 'Bắt buộc với vai trò đã chọn',
    vUsername: 'Chỉ dùng chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới (3–60 ký tự)', vName: 'Nhập họ và tên', create: 'Tạo người dùng', pwAfter: 'Mật khẩu tạm thời được tạo tự động và hiển thị một lần sau khi tạo.',
    kUsername: 'Tên đăng nhập', kRoles: 'Vai trò', kRegion: 'Khu vực', kMfa: 'Xác thực hai bước', kLast: 'Đăng nhập gần nhất', kCreated: 'Ngày tạo', kStatus: 'Trạng thái', kPwChange: 'Mật khẩu', pwMustChange: 'Phải đổi ở lần đăng nhập tới', pwOk: 'Đã đặt',
    allRegions: 'Toàn quốc', more: (n) => `+${n}`, lockedUntil: (d) => `Bị khóa đến ${d}`,
  },
  en: {
    usSubtitle: 'Staff accounts, roles and sign-in security', usNew: 'New user', usActive: 'Active users', usMfa: 'Two-step verification on', usLocked: 'Locked out', usDisabled: 'Disabled',
    usList: 'Users', usUser: 'User', usRoles: 'Roles', usRegion: 'Region', usMfaCol: 'Two-step', usSignIn: 'Sign-in', lastSeen: (r) => `Last ${r}`, neverSigned: 'Never signed in', usLast: 'Last sign-in', usStatus: 'Status', usNext: 'Next step',
    usMfaHint: (a, b) => `${a} of ${b} accounts`, never: 'Never', you: 'You', mfaOn: 'On', mfaPending: 'Setup pending', mfaOff: 'Off', lockedChip: 'Locked',
    fAll: 'All', fActive: 'Active', fLocked: 'Locked', fDisabled: 'Disabled', fMfaPending: 'MFA setup pending', search: 'Search name, username or role…',
    aEditRoles: 'Edit roles', aResetMfa: 'Reset two-step verification', aUnlock: 'Unlock', aResetPw: 'Reset password', aDisable: 'Disable', aEnable: 'Enable', aDetails: 'View details',
    cResetMfa: 'Reset two-step verification?', cResetMfaMsg: (n) => `${n} will set up their authenticator app again at next sign-in. Open sessions are signed out.`,
    cUnlock: 'Unlock account?', cUnlockMsg: (n) => `${n} can sign in again straight away.`, cResetPw: 'Reset password?', cResetPwMsg: (n) => `A temporary password will be created for ${n}. They must change it when they sign in.`,
    cDisable: 'Disable account?', cDisableMsg: (n) => `${n} is signed out and cannot sign in until the account is enabled again.`, cEnable: 'Enable account?', cEnableMsg: (n) => `${n} can sign in again.`,
    tResetMfa: 'Two-step verification reset', tUnlock: 'Account unlocked', tDisable: 'Account disabled', tEnable: 'Account enabled', tRoles: 'Roles updated — existing sessions were signed out', tCreated: 'User created',
    pwTitle: 'Temporary password', pwOnce: 'Copy the password now — it is shown only once', pwText: 'Share it with the user over a separate channel. They must change it at first sign-in.', pwDone: 'I have copied it',
    editTitle: (n) => `Roles for ${n}`, selfRoles: 'You cannot change your own roles', selfRolesText: 'Ask another administrator to make this change.', sodTitle: 'Separation of duties',
    sodPair: (a, b) => `One person cannot be both “${a}” and “${b}”.`, mfaWill: 'These roles require two-step verification at next sign-in.', vRoles: 'Choose at least one role', saveRoles: 'Save roles',
    cRoles: 'Save role changes?', cRolesMsg: (n) => `${n} is signed out of open sessions so the new access applies immediately.`, fRoles: 'Roles', fRegion: 'Data region', fRegionHelp: 'Limits which customers the user can see',
    newTitle: 'New user', fName: 'Full name', fUsername: 'Username', fUsernameHelp: 'Lower-case letters, digits, dots or dashes', fMfa: 'Require two-step verification', fMfaForced: 'Required for the selected roles',
    vUsername: 'Use lower-case letters, digits, dots, dashes or underscores (3–60 characters)', vName: 'Enter the full name', create: 'Create user', pwAfter: 'A temporary password is generated and shown once after creating the user.',
    kUsername: 'Username', kRoles: 'Roles', kRegion: 'Region', kMfa: 'Two-step verification', kLast: 'Last sign-in', kCreated: 'Created', kStatus: 'Status', kPwChange: 'Password', pwMustChange: 'Must change at next sign-in', pwOk: 'Set',
    allRegions: 'All regions', more: (n) => `+${n}`, lockedUntil: (d) => `Locked until ${d}`,
  },
});

const REGIONS = ['ALL', 'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'];
const regionLabel = (r) => (!r || r === 'ALL' ? t('allRegions') : r);
const FILTERS = {
  all: () => true, active: (u) => u.status === 'active' && !u.locked, locked: (u) => u.locked, disabled: (u) => u.status === 'disabled', mfa: (u) => u.mfaPending,
};

function tempPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const b = new Uint8Array(14);
  crypto.getRandomValues(b);
  return `Tmp-${Array.from(b, (x) => abc[x % abc.length]).join('')}`;
}

function mfaCell(u) {
  if (u.mfaEnabled) return h('span', { class: 'wf-mfa ok' }, icon('shield-check', { size: 16 }), t('mfaOn'));
  if (u.mfaPending) return h('span', { class: 'wf-mfa warn' }, icon('clock', { size: 16 }), t('mfaPending'));
  return h('span', { class: 'wf-mfa off' }, icon('shield', { size: 16 }), t('mfaOff'));
}
function rolesCell(roles) {
  const shown = roles.slice(0, 2);
  return h('div', { class: 'wf-roles', title: roles.map((r) => label('role', r)).join(', ') }, shown.map((r) => badge(label('role', r), 'brand')), roles.length > 2 ? badge(t('more', roles.length - 2), 'neutral') : null);
}

/** Role checkboxes with live separation-of-duties validation in plain language. */
function rolePicker(policy, selected, { disabled = false } = {}) {
  const boxes = policy.roles.map((r) => checkbox({ label: label('role', r), value: r, checked: selected.includes(r), disabled }));
  const msg = h('div', {});
  const el = h('div', { class: 'stack-sm' }, h('div', { class: 'wf-role-grid', role: 'group', 'aria-label': t('fRoles') }, boxes), msg);
  el.value = () => boxes.filter((b) => b.input.checked).map((b) => b.input.value);
  el.conflicts = () => {
    const v = el.value();
    return (policy.separationOfDuties || []).filter(([a, b]) => v.includes(a) && v.includes(b));
  };
  el.refresh = () => {
    const c = el.conflicts();
    const mfa = el.value().some((r) => (policy.mfaRequiredRoles || []).includes(r));
    mount(msg,
      c.length ? banner({ tone: 'danger', title: t('sodTitle'), text: h('div', {}, c.map(([a, b]) => h('div', {}, t('sodPair', label('role', a), label('role', b))))) }) : null,
      !c.length && mfa ? banner({ tone: 'info', text: t('mfaWill'), icon: 'shield-check' }) : null);
    el.dispatchEvent(new Event('rolechange'));
  };
  boxes.forEach((b) => b.input.addEventListener('change', el.refresh));
  el.refresh();
  return el;
}

export default {
  perm: 'users:manage',
  async render(main, ctx) {
    const { api, user } = ctx;
    const technical = (user?.roles || []).some((r) => ['admin', 'support_engineer', 'auditor'].includes(r));
    const policy = await api.get('/api/users/role-policy');
    let list = await api.get('/api/users');
    let filter = 'all';
    const reload = async () => { list = await api.get('/api/users'); paint(); };
    const isSelf = (u) => u.id === user?.id;

    function showSecretOnce(u, secret) {
      const m = modal({ title: t('pwTitle'), dismissible: false, body: h('div', { class: 'stack' },
        banner({ tone: 'warn', title: t('pwOnce'), text: t('pwText') }), keyValueList([[t('usUser'), u.displayName], [t('kUsername'), u.username]], { columns: 2 }), copyField(secret, { label: t('pwTitle') })),
      actions: [button({ label: t('pwDone'), variant: 'primary', icon: 'check', onClick: () => m.close() })] });
    }

    async function act(u, { title, msg, label: lab, danger, run, done }) {
      if (!(await confirmDialog(title, msg, lab, { danger }))) return;
      try { const r = await run(); toast(t(done), 'ok', { title: u.displayName }); await reload(); return r; } catch (e) { errorToast(e); return null; }
    }
    const resetMfa = (u) => act(u, { title: t('cResetMfa'), msg: t('cResetMfaMsg', u.displayName), label: t('aResetMfa'), danger: true, done: 'tResetMfa', run: () => api.post(`/api/users/${encodeURIComponent(u.id)}/reset`, { resetMfa: true }) });
    const unlock = (u) => act(u, { title: t('cUnlock'), msg: t('cUnlockMsg', u.displayName), label: t('aUnlock'), done: 'tUnlock', run: () => api.post(`/api/users/${encodeURIComponent(u.id)}/reset`, { unlock: true }) });
    const resetPw = async (u) => {
      if (!(await confirmDialog(t('cResetPw'), t('cResetPwMsg', u.displayName), t('aResetPw'), { danger: true }))) return;
      try { const r = await api.post(`/api/users/${encodeURIComponent(u.id)}/reset`, { resetPassword: true }); await reload(); showSecretOnce(u, r.temporaryPassword); } catch (e) { errorToast(e); }
    };
    const setStatus = (u, status) => act(u, status === 'disabled'
      ? { title: t('cDisable'), msg: t('cDisableMsg', u.displayName), label: t('aDisable'), danger: true, done: 'tDisable', run: () => api.patch(`/api/users/${encodeURIComponent(u.id)}`, { status }) }
      : { title: t('cEnable'), msg: t('cEnableMsg', u.displayName), label: t('aEnable'), done: 'tEnable', run: () => api.patch(`/api/users/${encodeURIComponent(u.id)}`, { status }) });

    function editRoles(u) {
      const self = isSelf(u);
      const picker = rolePicker(policy, u.roles, { disabled: self });
      const region = selectInput(REGIONS.map((r) => [r, regionLabel(r)]), REGIONS.includes(u.region) ? u.region : 'ALL', { disabled: self });
      if (!REGIONS.includes(u.region) && u.region) region.append(h('option', { value: u.region, selected: true }, u.region));
      const rolesField = formField({ label: t('fRoles'), control: picker, required: true });
      const save = button({ label: t('saveRoles'), variant: 'primary', icon: 'check', disabled: self, onClick: async () => {
        const roles = picker.value();
        if (!roles.length) { rolesField.setError(t('vRoles')); return; }
        if (picker.conflicts().length) return;
        rolesField.setError(null);
        if (!(await confirmDialog(t('cRoles'), t('cRolesMsg', u.displayName), t('saveRoles')))) return;
        try { await api.patch(`/api/users/${encodeURIComponent(u.id)}`, { roles, region: region.value }); toast(t('tRoles'), 'ok', { title: u.displayName }); dr.close(); await reload(); } catch (e) { errorToast(e); }
      } });
      picker.addEventListener('rolechange', () => { save.disabled = self || !!picker.conflicts().length; });
      save.disabled = self || !!picker.conflicts().length;
      const dr = drawer({ title: t('editTitle', u.displayName), subtitle: u.username, size: 'md',
        body: h('div', { class: 'stack' },
          self ? banner({ tone: 'warn', title: t('selfRoles'), text: t('selfRolesText'), icon: 'lock' }) : null,
          rolesField, formField({ label: t('fRegion'), control: region, help: t('fRegionHelp') })),
        footer: [h('span', { class: 'grow' }), button({ label: t('cancel'), onClick: () => dr.close() }), save] });
    }

    function newUser() {
      const name = input({ maxlength: '120', autocomplete: 'off' });
      const username = input({ maxlength: '60', autocomplete: 'off', spellcheck: 'false' });
      const region = selectInput(REGIONS.map((r) => [r, regionLabel(r)]), 'ALL');
      const picker = rolePicker(policy, []);
      const mfa = switchControl({ label: t('fMfa'), checked: true });
      const fName = formField({ label: t('fName'), control: name, required: true });
      const fUser = formField({ label: t('fUsername'), control: username, required: true, help: t('fUsernameHelp') });
      const fRoles = formField({ label: t('fRoles'), control: picker, required: true });
      name.addEventListener('blur', () => {
        if (username.value) return;
        const base = name.value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim().split(/\s+/);
        if (base.length > 1) username.value = `${base[base.length - 1]}.${base.slice(0, -1).map((w) => w[0]).join('')}`.replace(/[^a-z0-9._-]/g, '');
      });
      const syncMfa = () => {
        const forced = picker.value().some((r) => (policy.mfaRequiredRoles || []).includes(r));
        if (forced) mfa.input.checked = true;
        mfa.input.disabled = forced;
        mfa.title = forced ? t('fMfaForced') : '';
      };
      picker.addEventListener('rolechange', syncMfa);
      const create = button({ label: t('create'), variant: 'primary', icon: 'plus', onClick: async () => {
        let ok = true;
        fName.setError(null); fUser.setError(null); fRoles.setError(null);
        if (name.value.trim().length < 2) { fName.setError(t('vName')); ok = false; }
        if (!/^[a-z0-9._-]{3,60}$/.test(username.value.trim())) { fUser.setError(t('vUsername')); ok = false; }
        if (!picker.value().length) { fRoles.setError(t('vRoles')); ok = false; }
        if (picker.conflicts().length) ok = false;
        if (!ok) return;
        const password = tempPassword();
        try {
          const r = await api.post('/api/users', { username: username.value.trim(), displayName: name.value.trim(), password, region: region.value, roles: picker.value(), enableMfa: mfa.input.checked });
          toast(t('tCreated'), 'ok', { title: r.user?.displayName || name.value.trim() });
          dr.close();
          await reload();
          showSecretOnce(r.user || { displayName: name.value.trim(), username: username.value.trim() }, password);
        } catch (e) { errorToast(e); }
      } });
      const dr = drawer({ title: t('newTitle'), size: 'md',
        body: h('div', { class: 'stack' }, h('div', { class: 'form-grid' }, fName, fUser), formField({ label: t('fRegion'), control: region, help: t('fRegionHelp') }), fRoles, mfa,
          banner({ tone: 'info', text: t('pwAfter'), icon: 'key' })),
        footer: [h('span', { class: 'grow' }), button({ label: t('cancel'), onClick: () => dr.close() }), create] });
      syncMfa();
    }

    function details(u) {
      const self = isSelf(u);
      const dr = drawer({ title: u.displayName, subtitle: u.username, size: 'md', headerExtra: u.locked ? badge(t('lockedChip'), 'danger', { icon: 'lock' }) : statusChip(u.status),
        body: [
          h('div', { class: 'wf-user' }, avatar(u.displayName, { size: 'lg' }), h('div', { class: 'wf-user-text' }, h('span', { class: 'wf-user-name' }, u.displayName), h('span', { class: 'cell-sub' }, self ? `${u.username} · ${t('you')}` : u.username))),
          h('section', { class: 'wf-section' }, keyValueList([
            [t('kRoles'), h('div', { class: 'wf-roles' }, u.roles.map((r) => badge(label('role', r), 'brand')))], [t('kRegion'), regionLabel(u.region)],
            [t('kMfa'), mfaCell(u)], [t('kStatus'), u.locked ? badge(t('lockedUntil', formatDateTime(u.lockedUntil)), 'danger') : statusChip(u.status)],
            [t('kLast'), u.lastLoginAt ? formatRelative(u.lastLoginAt) : t('never')], [t('kCreated'), u.createdAt ? formatDateTime(u.createdAt) : null],
            [t('kPwChange'), u.mustChangePassword ? t('pwMustChange') : t('pwOk')],
          ], { columns: 2 })),
          technical ? h('section', { class: 'wf-section' }, technicalDetails(keyValueList([['User id', u.id]], { columns: 1, inline: true }))) : null,
        ],
        footer: self ? [h('span', { class: 'grow' }), button({ label: t('close'), onClick: () => dr.close() })] : [
          u.status === 'active' ? button({ label: t('aDisable'), variant: 'danger', onClick: () => { dr.close(); setStatus(u, 'disabled'); } }) : button({ label: t('aEnable'), onClick: () => { dr.close(); setStatus(u, 'active'); } }),
          h('span', { class: 'grow' }),
          button({ label: t('aResetPw'), icon: 'key', onClick: () => { dr.close(); resetPw(u); } }),
          button({ label: t('aEditRoles'), icon: 'edit', variant: 'primary', onClick: () => { dr.close(); editRoles(u); } }),
        ] });
    }

    const rowAct = (u) => {
      if (isSelf(u)) return rowActions({ primary: { label: t('view'), muted: true, onClick: () => details(u) }, menu: [{ label: t('aDetails'), icon: 'eye', onClick: () => details(u) }] });
      const primary = u.locked ? { label: t('aUnlock'), onClick: () => { unlock(u); } }
        : u.status === 'disabled' ? { label: t('aEnable'), onClick: () => { setStatus(u, 'active'); } }
          : { label: t('aEditRoles'), onClick: () => editRoles(u) };
      return rowActions({ primary, menu: [
        { label: t('aDetails'), icon: 'eye', onClick: () => details(u) },
        !u.locked && u.status === 'active' ? null : { label: t('aEditRoles'), icon: 'edit', onClick: () => editRoles(u) },
        { label: t('aResetMfa'), icon: 'shield', onClick: () => resetMfa(u) },
        { label: t('aResetPw'), icon: 'key', onClick: () => resetPw(u) },
        { separator: true },
        u.status === 'active' ? { label: t('aDisable'), icon: 'x-circle', danger: true, onClick: () => setStatus(u, 'disabled') } : { label: t('aEnable'), icon: 'check-circle', onClick: () => setStatus(u, 'active') },
      ].filter(Boolean) });
    };

    const columns = [
      { key: 'displayName', label: t('usUser'), sortable: true, render: (u) => h('div', { class: 'wf-user' }, avatar(u.displayName, { size: 'sm' }), h('div', { class: 'wf-user-text' }, h('span', { class: 'wf-user-name' }, u.displayName, isSelf(u) ? h('span', { class: 'muted' }, ` · ${t('you')}`) : null), h('span', { class: 'cell-sub' }, u.username))),
        value: (u) => `${u.displayName} ${u.username}`, exportValue: (u) => u.displayName },
      { key: 'roles', label: t('usRoles'), render: (u) => rolesCell(u.roles), value: (u) => u.roles.map((r) => label('role', r)).join(' '), exportValue: (u) => u.roles.map((r) => label('role', r)).join(', ') },
      { key: 'region', label: t('usRegion'), sortable: true, render: (u) => regionLabel(u.region) },
      { key: 'mfa', label: t('usSignIn'), sortable: true, value: (u) => u.lastLoginAt || '', render: (u) => h('div', { class: 'wf-status-cell' }, mfaCell(u),
        h('span', { class: 'cell-sub nowrap', title: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '' }, u.lastLoginAt ? t('lastSeen', formatRelative(u.lastLoginAt)) : t('neverSigned'))),
        exportValue: (u) => `${u.mfaEnabled ? t('mfaOn') : u.mfaPending ? t('mfaPending') : t('mfaOff')} · ${u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t('never')}` },
      { key: 'status', label: t('usStatus'), sortable: true, render: (u) => (u.locked ? badge(t('lockedChip'), 'danger', { icon: 'lock' }) : statusChip(u.status)), exportValue: (u) => (u.locked ? t('lockedChip') : label('status', u.status)) },
      { key: '_actions', label: t('usNext'), align: 'right', render: rowAct },
    ];

    function paint() {
      const n = Object.fromEntries(Object.keys(FILTERS).map((k) => [k, list.filter(FILTERS[k]).length]));
      const mfaOn = list.filter((u) => u.mfaEnabled).length;
      const chips = h('div', { class: 'chip-row' }, [['all', 'fAll'], ['active', 'fActive'], ['locked', 'fLocked'], ['disabled', 'fDisabled'], ['mfa', 'fMfaPending']]
        .map(([k, key]) => chip({ label: t(key), count: n[k], selected: filter === k, onClick: () => { filter = k; paint(); } })));
      mount(main,
        pageHeader({ title: t('users'), subtitle: t('usSubtitle'), actions: [button({ label: t('usNew'), icon: 'plus', variant: 'primary', onClick: newUser })] }),
        kpiStrip([
          kpiTile({ label: t('usActive'), value: formatNumber(n.active), icon: 'users', onClick: () => { filter = 'active'; paint(); } }),
          kpiTile({ label: t('usMfa'), value: formatNumber(mfaOn), icon: 'shield-check', hint: t('usMfaHint', formatNumber(mfaOn), formatNumber(list.length)) }),
          kpiTile({ label: t('usLocked'), value: formatNumber(n.locked), icon: 'lock', onClick: () => { filter = 'locked'; paint(); } }),
          kpiTile({ label: t('usDisabled'), value: formatNumber(n.disabled), icon: 'x-circle', onClick: () => { filter = 'disabled'; paint(); } }),
        ]),
        card({ title: t('usList'), flush: true, class: 'wf-dense wf-compact-actions', body: dataTable({
          caption: t('usList'), columns, rows: list.filter(FILTERS[filter]), onRowClick: details,
          toolbar: { search: { placeholder: t('search') }, filters: [chips], export: { filename: 'users.csv' } }, pagination: { pageSize: 25 },
        }) }));
    }
    paint();
  },
};
