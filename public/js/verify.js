import { h, mount, fmtPeriod } from './shared/dom.js';
import { labelIn } from './shared/i18n.js';

/** Public e-certificate verification (QR target). Shows validity only — no personal data. */
const certNo = decodeURIComponent(location.pathname.split('/verify/')[1] || '');
const box = document.getElementById('result');
const STATES = {
  in_force: '✓ ĐANG CÓ HIỆU LỰC / IN FORCE',
  not_yet_in_force: 'ⓘ ĐÃ CẤP — HIỆU LỰC TỪ NGÀY BẮT ĐẦU / ISSUED, STARTS LATER',
  expired: '✗ ĐÃ HẾT HẠN / EXPIRED',
  invalid: '✗ KHÔNG CÒN HIỆU LỰC / NOT VALID',
};

async function run() {
  if (!certNo) { mount(box, h('div', { class: 'alert warn' }, 'Thiếu số giấy chứng nhận.')); return; }
  const res = await fetch(`/api/public/certificates/${encodeURIComponent(certNo)}`, { headers: { Accept: 'application/json' } });
  const r = await res.json();
  if (!res.ok || r.reason === 'not_found') { mount(box, h('div', { class: 'alert danger', role: 'alert' }, h('strong', {}, 'Không tìm thấy giấy chứng nhận'), h('p', {}, certNo))); return; }
  mount(box, h('section', { class: `card stack` },
    h('div', { class: `alert ${r.valid ? 'ok' : r.state === 'not_yet_in_force' ? 'info' : 'danger'}` }, h('strong', {}, STATES[r.state] || STATES.invalid)),
    h('dl', { class: 'kv' },
      h('dt', {}, 'Số GCN'), h('dd', {}, r.certNo),
      h('dt', {}, 'Sản phẩm'), h('dd', { title: r.product }, r.productNameVi || labelIn('vi', 'product', r.product)),
      h('dt', {}, 'Biển số'), h('dd', {}, r.plate),
      h('dt', {}, 'Hiệu lực'), h('dd', {}, fmtPeriod(r.startDate, r.endDate)),
      h('dt', {}, 'Doanh nghiệp bảo hiểm'), h('dd', {}, r.insurer)),
    h('p', { class: 'xs muted' }, 'Thông tin cá nhân không được hiển thị để bảo vệ quyền riêng tư.')));
}
run().catch(() => mount(box, h('div', { class: 'alert danger' }, 'Lỗi kết nối. Vui lòng thử lại.')));
