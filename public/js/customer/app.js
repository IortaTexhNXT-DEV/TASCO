import { h, mount, fmtVnd, fmtDate, fmtPeriod } from '../shared/dom.js';
import { labelIn } from '../shared/i18n.js';
import { createApi, idempotencyKey } from '../shared/api.js';
import { qrSvg } from '../shared/qr.js';

/**
 * Customer app (embeddable in the VETC super-app or a Zalo mini app WebView).
 * Designed for ≤ 3 taps to renew: Renew → Review → Pay.
 */

const state = { token: null, home: null, meta: null };
try { state.token = sessionStorage.getItem('ctoken'); } catch { /* ignore */ }
const api = createApi({ getToken: () => state.token });

function toast(msg, kind = 'info') {
  const el = h('div', { class: `toast ${kind}`, role: kind === 'danger' ? 'alert' : 'status' }, msg);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 5000);
}

// The customer app is Vietnamese-only by design: every code is shown with its Vietnamese label.
const vi = (group, code) => labelIn('vi', group, code);
const productVi = (x) => x.productNameVi || vi('product', x.product);
const TONE = { active: 'ok', paid: 'ok', approved: 'ok', completed: 'ok', insured: 'ok', submitted: 'info', acknowledged: 'info', assessor_assigned: 'info', under_assessment: 'info', rejected: 'danger', cancelled: 'warn', expired: 'warn' };
const statusBadgeVi = (status) => h('span', { class: `badge ${TONE[status] || 'info'}` }, vi('status', status));

/**
 * Date entry in Vietnamese order (dd/mm/yyyy) whatever the browser locale — a native
 * <input type=date> renders mm/dd/yyyy on en-US devices. `.isoValue()` returns yyyy-mm-dd or ''.
 */
function dateInput(id) {
  const input = h('input', { id, type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'dd/mm/yyyy', maxlength: '10', required: true, pattern: '\\d{1,2}/\\d{1,2}/\\d{4}', 'aria-describedby': `${id}-hint` });
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
    input.setCustomValidity('');
  });
  input.isoValue = () => {
    const m = input.value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return '';
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  input.check = () => {
    const ok = !!input.isoValue();
    input.setCustomValidity(ok ? '' : 'Ngày không hợp lệ — nhập theo dạng ngày/tháng/năm, ví dụ 07/10/2026');
    input.setAttribute('aria-invalid', String(!ok));
    if (!ok) input.reportValidity();
    return ok;
  };
  return input;
}
const dateField = (input, labelText) => h('div', { class: 'field' }, h('label', { for: input.id }, labelText), input, h('span', { class: 'help', id: `${input.id}-hint` }, 'Ngày/tháng/năm, ví dụ 07/10/2026'));

const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];

function layout(content, current) {
  const tab = (r, icon, label) => h('a', { href: `#/${r}`, 'aria-current': current === r ? 'page' : null }, h('span', { 'aria-hidden': 'true' }, icon), label);
  return h('div', { class: 'app' },
    h('header', { class: 'app-head' }, h('img', { src: '/assets/tasco-logo-tight.png', alt: 'TASCO Insurance' }), h('h1', {}, 'Bảo hiểm xe · VETC')),
    h('main', { class: 'app-main stack', id: 'app-main', tabindex: '-1' }, content),
    h('nav', { class: 'tabbar', 'aria-label': 'Điều hướng' },
      tab('home', '🏠', 'Trang chủ'), tab('renew', '🛡', 'Mua / Gia hạn'), tab('claims', '🚑', 'Bồi thường'), tab('account', '👤', 'Tài khoản')));
}

function coverStatus(c) {
  if (c.daysToExpiry === null || c.daysToExpiry === undefined) return { text: 'Chưa rõ ngày hết hạn bảo hiểm', cta: 'Cập nhật ngày hết hạn', to: 'confirm' };
  if (c.daysToExpiry < 0) return { text: `Đã hết hạn ${-c.daysToExpiry} ngày — xe đang không có bảo hiểm bắt buộc`, cta: 'Mua bảo hiểm ngay', to: 'renew' };
  if (c.daysToExpiry <= 45) return { text: `Còn ${c.daysToExpiry} ngày (hết hạn ${fmtDate(c.expiryDate)})`, cta: 'Gia hạn ngay', to: 'renew' };
  return { text: `Còn hiệu lực đến ${fmtDate(c.expiryDate)}`, cta: 'Xem quyền lợi', to: 'home' };
}

async function viewHome() {
  const [d, pending] = await Promise.all([api.get('/api/customer/home'), api.get('/api/customer/quotes')]);
  state.home = d;
  const st = coverStatus(d.cover);
  return [
    pending.map((q) => h('section', { class: 'card stack', 'aria-label': 'Báo giá chờ xác nhận' },
      h('h2', {}, 'Báo giá chờ bạn xác nhận'),
      q.lines[0] ? h('p', { class: 'small' }, 'Thời hạn bảo hiểm: ', h('strong', {}, fmtPeriod(q.lines[0].startDate, q.lines[0].endDate))) : null,
      h('dl', { class: 'kv' }, q.lines.flatMap((l) => [h('dt', {}, productVi(l)), h('dd', {}, fmtVnd(l.total),
        q.lines.some((x) => x.startDate !== l.startDate || x.endDate !== l.endDate) ? h('div', { class: 'xs muted' }, fmtPeriod(l.startDate, l.endDate)) : null)])),
      h('p', {}, h('strong', {}, `Tổng: ${fmtVnd(q.total)}`)),
      h('button', { class: 'btn primary block', onclick: (ev) => payQuote(q, ev.target) }, 'Xác nhận & thanh toán bằng ví VETC'))),
    h('section', { class: 'hero', 'aria-labelledby': 'veh' },
      h('div', { class: 'small', id: 'veh' }, 'Xe của bạn'),
      h('div', { class: 'plate' }, d.vehicle.plate),
      h('div', { class: 'status' }, st.text),
      d.cover.insurer ? h('div', { class: 'small' }, `Đơn vị bảo hiểm hiện tại: ${d.cover.insurer === 'OTHER' ? 'khác' : d.cover.insurer}`) : null,
      h('a', { class: 'btn block', href: `#/${st.to}` }, st.cta)),
    d.cover.needsConfirmation ? h('div', { class: 'alert info' }, 'Giúp chúng tôi nhắc đúng hạn: ', h('a', { href: '#/confirm' }, 'xác nhận ngày hết hạn'), ' (chỉ 10 giây).') : null,
    h('section', { class: 'card stack' }, h('h2', {}, 'Quyền lợi khi mua qua VETC'),
      d.benefits.map((b) => h('div', { class: 'benefit' }, h('span', { class: 'icon', 'aria-hidden': 'true' }, '✓'), h('div', {}, h('strong', {}, b.titleVi), h('div', { class: 'small muted' }, b.descVi))))),
    d.policies.length ? h('section', { class: 'card stack' }, h('h2', {}, 'Giấy chứng nhận của tôi'),
      d.policies.map((p) => h('div', { class: 'stack' }, h('div', { class: 'row spread' }, h('strong', {}, productVi(p)), statusBadgeVi(p.status)),
        h('div', { class: 'small' }, `${p.certNo} · ${fmtPeriod(p.startDate, p.endDate)}`),
        h('div', { class: 'qr' }, qrSvg(p.certificateUrl, { label: `Mã QR tra cứu giấy chứng nhận ${p.certNo}` })),
        h('a', { href: p.certificateUrl, target: '_blank', rel: 'noopener' }, 'Tra cứu giấy chứng nhận')))) : null,
    h('p', { class: 'xs muted' }, 'Phí bảo hiểm TNDS bắt buộc theo biểu phí của Nhà nước, giống nhau ở mọi công ty bảo hiểm. VETC không bao giờ yêu cầu mã OTP hay thanh toán qua điện thoại.'),
  ];
}

function viewConfirm() {
  const date = dateInput('exp');
  const insurer = h('select', { id: 'ins' }, ['TASCO', 'PVI', 'PTI', 'Bảo Việt', 'PJICO', 'BIC', 'MIC', 'Khác'].map((x) => h('option', { value: x }, x)));
  const form = h('form', { class: 'card stack' },
    h('h2', {}, 'Xác nhận ngày hết hạn'),
    h('p', { class: 'small muted' }, 'Xem trên giấy chứng nhận bảo hiểm TNDS hiện tại của bạn.'),
    dateField(date, 'Ngày hết hạn'),
    h('div', { class: 'field' }, h('label', { for: 'ins' }, 'Công ty bảo hiểm'), insurer),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Lưu'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!date.check()) return;
    try { await api.post('/api/customer/expiry', { expiryDate: date.isoValue(), insurer: insurer.value === 'Khác' ? 'OTHER' : insurer.value }); toast('Cảm ơn bạn! Chúng tôi sẽ nhắc đúng hạn.', 'ok'); location.hash = '#/home'; } catch (ex) { toast(ex.message, 'danger'); }
  });
  return [form];
}

function viewRenew() {
  const steps = h('ol', { class: 'steps', 'aria-label': 'Tiến trình' }, h('li', { class: 'done' }), h('li', {}), h('li', {}));
  const body = h('div', { class: 'stack' });
  const term = h('select', { id: 'term' }, [1, 2, 3].map((y) => h('option', { value: y }, `${y} năm`)));
  const pa = h('input', { type: 'checkbox', id: 'pa' });
  const pdBox = h('input', { type: 'checkbox', id: 'pd' });
  const value = h('input', { type: 'number', id: 'val', min: '100000000', step: '10000000', value: '500000000' });
  const opt = (input, title, desc) => h('label', { class: 'option', for: input.id }, input, h('div', {}, h('strong', {}, title), h('div', { class: 'small muted' }, desc)));
  const form = h('form', { class: 'stack' },
    h('h2', {}, 'Chọn bảo hiểm'),
    h('div', { class: 'option selected' }, h('span', { 'aria-hidden': 'true' }, '✓'), h('div', {}, h('strong', {}, 'Bảo hiểm TNDS bắt buộc'), h('div', { class: 'small muted' }, 'Bắt buộc theo luật. Phí theo quy định Nhà nước.'), h('div', { class: 'field', style: 'margin-top:8px' }, h('label', { for: 'term' }, 'Thời hạn'), term))),
    opt(pa, 'Thêm: Tai nạn người ngồi trên xe', 'TNDS chỉ bảo vệ bên thứ ba — bảo vệ thêm bạn và người thân (20 triệu/người).'),
    opt(pdBox, 'Thêm: Vật chất xe', 'Chi trả thiệt hại cho chính xe của bạn. Cần giám định xe trước khi thanh toán — tư vấn viên TASCO sẽ liên hệ.'),
    h('div', { class: 'field' }, h('label', { for: 'val' }, 'Giá trị xe (nếu chọn vật chất xe)'), value),
    h('button', { class: 'btn primary block', type: 'submit' }, 'Xem phí'));
  body.append(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const products = [{ code: 'TNDS_CAR', options: { termYears: Number(term.value) } }];
    if (pa.checked) products.push({ code: 'PA_SEAT', options: { sumInsuredPerSeat: 20000000 } });
    if (pdBox.checked) products.push({ code: 'MOTOR_PD', options: { sumInsured: Number(value.value) } });
    try {
      const q = await api.post('/api/customer/quotes', { products });
      steps.children[1].classList.add('done');
      mount(body, h('section', { class: 'card stack' }, h('h2', {}, 'Kiểm tra thông tin'),
        h('dl', { class: 'kv' }, q.lines.flatMap((l) => [h('dt', {}, productVi(l)), h('dd', {}, fmtVnd(l.total), h('div', { class: 'xs muted' }, fmtPeriod(l.startDate, l.endDate)))])),
        h('p', {}, h('strong', {}, `Tổng thanh toán: ${fmtVnd(q.total)}`)),
        h('p', { class: 'xs muted' }, 'Đã gồm VAT (nếu có). Bảo hiểm tai nạn con người không chịu VAT.'),
        h('div', { class: 'small' }, 'Kèm theo: ', q.benefits.map((b) => b.titleVi).join(' · ')),
        h('button', { class: 'btn primary block', onclick: async (ev) => {
          ev.target.disabled = true;
          try {
            const r = await api.post('/api/customer/orders', { quoteId: q.id }, { 'Idempotency-Key': idempotencyKey() });
            steps.children[2].classList.add('done');
            mount(body, h('section', { class: 'card stack', role: 'status' }, h('h2', {}, '🎉 Thành công!'), h('p', {}, 'Giấy chứng nhận điện tử đã được cấp. Bạn có thể xuất trình mã QR khi được kiểm tra.'),
              r.policies.map((p) => h('div', { class: 'stack' }, h('strong', {}, `${productVi(p)} · ${p.certNo}`), h('div', { class: 'qr' }, qrSvg(p.certificateUrl, { label: `QR ${p.certNo}` })))),
              h('a', { class: 'btn block', href: '#/home' }, 'Về trang chủ')));
          } catch (ex) { toast(ex.status === 422 && pdBox.checked ? 'Vật chất xe cần giám định trước. Bạn có thể bỏ chọn để mua TNDS ngay, tư vấn viên sẽ liên hệ về vật chất xe.' : ex.message, 'danger'); ev.target.disabled = false; }
        } }, 'Thanh toán bằng ví VETC')));
    } catch (ex) { toast(ex.message, 'danger'); }
  });
  return [steps, body];
}

async function payQuote(q, btn) {
  btn.disabled = true;
  try {
    const r = await api.post('/api/customer/orders', { quoteId: q.id }, { 'Idempotency-Key': idempotencyKey() });
    toast(`Đã cấp ${r.policies.map((p) => p.certNo).join(', ')}`, 'ok');
    render();
  } catch (ex) { toast(ex.message, 'danger'); btn.disabled = false; }
}

async function viewClaims() {
  const list = await api.get('/api/customer/claims');
  const home = state.home || await api.get('/api/customer/home');
  const active = home.policies.filter((p) => p.status === 'active');
  const items = [h('h2', {}, 'Bồi thường')];
  if (active.length) {
    const pol = h('select', { id: 'pol' }, active.map((p) => h('option', { value: p.certNo }, `${productVi(p)} · ${p.certNo}`)));
    const date = dateInput('idate');
    const desc = h('textarea', { id: 'desc', required: true, maxlength: '2000' });
    const loc = h('input', { id: 'loc', maxlength: '200', placeholder: 'VD: Cao tốc Hà Nội – Hải Phòng, km 35' });
    const form = h('form', { class: 'card stack' }, h('h3', {}, 'Báo tai nạn'),
      h('div', { class: 'field' }, h('label', { for: 'pol' }, 'Hợp đồng'), pol), dateField(date, 'Ngày xảy ra'),
      h('div', { class: 'field' }, h('label', { for: 'loc' }, 'Địa điểm'), loc), h('div', { class: 'field' }, h('label', { for: 'desc' }, 'Mô tả'), desc),
      h('button', { class: 'btn primary block', type: 'submit' }, 'Gửi'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!date.check()) return;
      try { const c = await api.post('/api/customer/claims', { policyId: pol.value, incidentDate: date.isoValue(), description: desc.value, location: loc.value || undefined }); toast(`Đã tiếp nhận ${c.id}. Giám định viên sẽ liên hệ trong 4 giờ.`, 'ok'); render(); } catch (ex) { toast(ex.message, 'danger'); }
    });
    items.push(form);
  } else items.push(h('p', { class: 'muted' }, 'Bạn chưa có hợp đồng còn hiệu lực với TASCO.'));
  items.push(h('section', { class: 'card stack' }, h('h3', {}, 'Yêu cầu của tôi'), list.length ? list.map((c) => h('div', { class: 'claim-item' },
    h('strong', {}, c.id), statusBadgeVi(c.status),
    h('span', { class: 'small' }, `Ngày xảy ra: ${fmtDate(c.incidentDate)}`), h('span', { class: 'small muted' }, productVi(c)),
    c.description ? h('span', { class: 'small muted', style: 'grid-column:1/-1' }, c.description) : null)) : h('p', { class: 'muted' }, 'Chưa có yêu cầu.')));
  return items;
}

async function viewAccount() {
  const d = state.home || await api.get('/api/customer/home');
  const mk = h('input', { type: 'checkbox', checked: d.consent.marketing, id: 'mk' });
  const call = h('input', { type: 'checkbox', checked: d.consent.call, id: 'call' });
  const save = async () => { try { await api.put('/api/customer/consent', { marketing: mk.checked, call: call.checked }); toast('Đã lưu lựa chọn', 'ok'); } catch (ex) { toast(ex.message, 'danger'); } };
  mk.addEventListener('change', save);
  call.addEventListener('change', save);
  return [
    h('section', { class: 'card stack' }, h('h2', {}, 'Quyền riêng tư & liên lạc'),
      h('label', { class: 'check', for: 'mk' }, mk, 'Nhận thông tin ưu đãi dịch vụ qua ứng dụng/Zalo/SMS'),
      h('label', { class: 'check', for: 'call' }, call, 'Đồng ý nhận cuộc gọi tư vấn'),
      h('p', { class: 'xs muted' }, 'Thông báo về hiệu lực bảo hiểm vẫn được gửi để bảo vệ quyền lợi của bạn.')),
    h('section', { class: 'card stack' }, h('h2', {}, 'Dữ liệu của tôi'),
      h('button', { class: 'btn', onclick: async () => {
        const data = await api.get('/api/customer/data-export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: 'du-lieu-cua-toi.json' });
        document.body.append(a); a.click(); a.remove();
      } }, 'Tải dữ liệu của tôi (JSON)')),
    h('button', { class: 'btn block', onclick: () => { try { sessionStorage.removeItem('ctoken'); } catch { /* ignore */ } state.token = null; render(); } }, 'Đăng xuất'),
  ];
}

async function viewEntry() {
  state.meta = state.meta || await api.get('/api/meta');
  const items = [h('div', { class: 'card stack' }, h('h2', {}, 'Mở từ liên kết gia hạn'), h('p', { class: 'small muted' }, 'Trong thực tế, bạn mở trang này từ ứng dụng VETC hoặc tin nhắn Zalo OA chính thức của VETC.'))];
  if (state.meta.demoMode && state.meta.demoCustomers) {
    items.push(h('section', { class: 'card stack' }, h('h3', {}, 'Demo: chọn một khách hàng'),
      state.meta.demoCustomers.map((c) => h('button', { class: 'btn block demo-pick', onclick: async () => { await startSession({ demoProfileId: c.id }); } },
        h('span', { class: 'nowrap' }, c.plate), h('span', { class: 'small muted' }, vi('journey', c.journey)),
        c.status === 'insured' ? h('span', { class: 'badge ok' }, 'Đã mua bảo hiểm') : null))));
  }
  return items;
}

async function startSession(body) {
  try {
    const r = await api.post('/api/customer/session', body);
    state.token = r.token;
    try { sessionStorage.setItem('ctoken', r.token); } catch { /* ignore */ }
    history.replaceState(null, '', '/app/#/home');
    render();
  } catch (ex) { toast(ex.message, 'danger'); }
}

async function render() {
  const root = document.getElementById('root');
  const link = new URLSearchParams(location.search).get('r');
  if (link && !state.token) { await startSession({ link }); return; }
  const r = route();
  let content;
  try {
    if (!state.token) content = await viewEntry();
    else if (r === 'confirm') content = viewConfirm();
    else if (r === 'renew') content = viewRenew();
    else if (r === 'claims') content = await viewClaims();
    else if (r === 'account') content = await viewAccount();
    else content = await viewHome();
  } catch (ex) {
    if (ex.status === 401) { state.token = null; return render(); }
    content = [h('div', { class: 'alert danger' }, ex.message)];
  }
  mount(root, layout(content, r));
  return undefined;
}

window.addEventListener('hashchange', render);
render();
