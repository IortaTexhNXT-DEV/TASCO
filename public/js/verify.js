import { h, mount, fmtDate, fmtDateTime } from './shared/dom.js';
import { labelIn } from './shared/i18n.js';
import { icon } from './shared/icons.js';

/**
 * Public e-certificate verification (QR target). Shows validity only — the plate is masked and no
 * personal data is returned by the API. Vietnamese first, English second (police, inspectors, partners).
 */
const certNo = decodeURIComponent(location.pathname.split('/verify/')[1] || '').trim();
const box = document.getElementById('result');
const foot = document.getElementById('foot');

const STATES = {
  in_force: { tone: 'ok', icon: 'check', vi: 'Giấy chứng nhận hợp lệ', en: 'Valid certificate · in force' },
  not_yet_in_force: { tone: 'info', icon: 'clock', vi: 'Đã cấp, chưa đến ngày hiệu lực', en: 'Issued · cover starts later' },
  expired: { tone: 'danger', icon: 'x', vi: 'Giấy chứng nhận đã hết hạn', en: 'Expired certificate' },
  cancelled: { tone: 'danger', icon: 'x', vi: 'Giấy chứng nhận đã bị hủy', en: 'Cancelled certificate' },
  invalid: { tone: 'danger', icon: 'x', vi: 'Giấy chứng nhận không còn hiệu lực', en: 'Certificate not valid' },
  not_found: { tone: 'danger', icon: 'x', vi: 'Không tìm thấy giấy chứng nhận', en: 'Certificate not found' },
};

const row = (vi, en, value) => h('div', {}, h('dt', {}, vi, h('span', { lang: 'en' }, en)), h('dd', {}, value));

function status(key, sub) {
  const s = STATES[key] || STATES.invalid;
  return h('div', { class: `v-status ${s.tone}` },
    h('span', { class: 'v-status-icon' }, icon(s.icon, { size: 28, strokeWidth: 3 })),
    h('div', {}, h('h1', {}, s.vi), h('p', { lang: 'en' }, s.en), sub ? h('p', {}, sub) : null));
}

function checkedAt() {
  return h('div', { class: 'v-checked' }, icon('shield-check', { size: 16 }), `Tra cứu lúc ${fmtDateTime(new Date().toISOString())} · Checked at the time shown`);
}

function anotherForm() {
  const input = h('input', { id: 'cert', class: 'c-input', name: 'cert', autocomplete: 'off', spellcheck: 'false', placeholder: 'Số giấy chứng nhận', maxlength: '60', required: true, 'aria-describedby': 'cert-err' });
  const err = h('span', { class: 'c-err', id: 'cert-err', 'aria-live': 'polite' });
  const form = h('form', { class: 'v-form', novalidate: true, 'aria-labelledby': 'another-h' },
    h('h2', { id: 'another-h' }, certNo ? 'Kiểm tra chứng nhận khác' : 'Nhập số giấy chứng nhận', h('span', { lang: 'en' }, certNo ? 'Verify another certificate' : 'Enter the certificate number')),
    h('label', { class: 'sr-only', for: 'cert' }, 'Số giấy chứng nhận'),
    h('div', { class: 'v-form-row' }, input, h('button', { class: 'c-btn primary', type: 'submit' }, icon('search', { size: 18 }), 'Kiểm tra')),
    err);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim().toUpperCase();
    if (!v) { mount(err, icon('alert-circle', { size: 16 }), 'Vui lòng nhập số giấy chứng nhận.'); input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    location.href = `/verify/${encodeURIComponent(v)}`;
  });
  return form;
}

function footer() {
  mount(foot,
    h('span', {}, icon('lock', { size: 14 }), 'Không hiển thị thông tin cá nhân · No personal data is shown'),
    h('span', {}, `© ${new Date().getFullYear()} TASCO Insurance`));
}

async function run() {
  footer();
  if (!certNo) { mount(box, anotherForm()); box.removeAttribute('aria-busy'); return; }
  document.title = `${certNo} · Tra cứu giấy chứng nhận · TASCO Insurance`;
  const res = await fetch(`/api/public/certificates/${encodeURIComponent(certNo)}`, { headers: { Accept: 'application/json' } });
  const r = await res.json().catch(() => ({}));
  box.removeAttribute('aria-busy');
  if (res.status === 429) {
    mount(box, h('section', { class: 'v-card' }, h('div', { class: 'v-status info' }, h('span', { class: 'v-status-icon' }, icon('clock', { size: 28 })),
      h('div', {}, h('h1', {}, 'Vui lòng thử lại sau ít phút'), h('p', { lang: 'en' }, 'Too many checks — please try again shortly')))), anotherForm());
    return;
  }
  if (!res.ok || r.reason === 'not_found' || !r.certNo) {
    mount(box, h('section', { class: 'v-card', 'aria-label': 'Kết quả tra cứu' }, status('not_found'),
      h('dl', { class: 'v-fields' }, row('Số đã tra cứu', 'Number checked', certNo)),
      checkedAt()), anotherForm());
    return;
  }
  const key = r.valid ? 'in_force' : (STATES[r.state] ? r.state : 'invalid');
  mount(box,
    h('section', { class: 'v-card', 'aria-label': 'Kết quả tra cứu' },
      status(key),
      h('dl', { class: 'v-fields' },
        row('Số giấy chứng nhận', 'Certificate no.', r.certNo),
        row('Sản phẩm', 'Product', r.productNameVi || labelIn('vi', 'product', r.product)),
        row('Biển số xe', 'Vehicle plate', r.plate || '—'),
        row('Hiệu lực từ', 'Valid from', fmtDate(r.startDate)),
        row('Hiệu lực đến', 'Valid until', fmtDate(r.endDate)),
        row('Doanh nghiệp bảo hiểm', 'Insurer', r.insurer || 'TASCO Insurance')),
      checkedAt()),
    anotherForm());
}

run().catch(() => {
  box.removeAttribute('aria-busy');
  mount(box, h('section', { class: 'v-card' }, h('div', { class: 'v-status danger', role: 'alert' }, h('span', { class: 'v-status-icon' }, icon('alert-triangle', { size: 26 })),
    h('div', {}, h('h1', {}, 'Lỗi kết nối'), h('p', { lang: 'en' }, 'Connection error — please try again')))), anotherForm());
});
