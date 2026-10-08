/**
 * Partners — banks, showrooms, agents, fleets and inspection centres selling TASCO through VETC data.
 * Table with month-to-date sales, one primary verb per row (View statement / Reactivate) + kebab
 * (Issue API key, API keys, Suspend); onboarding drawer; statement drawer; developer access card.
 */
import { h, mount } from '../../shared/dom.js';
import { label } from '../../shared/i18n.js';
import {
  pageHeader, kpiStrip, kpiTile, card, dataTable, statusChip, badge, rowActions, drawer, keyValueList, button, decisionDialog, selectInput, input,
  formField, checkbox, segmented, toast, errorToast, confirmDialog, modal, banner, copyField, emptyState, barChart, icon, downloadCsv,
  formatDate, formatMoney, formatNumber, formatPercent, formatPlate, plateTag, technicalDetails,
} from '../ui.js';
import { productShort, pageStrings } from './workflowLabels.js';

const t = pageStrings('partners', {
  vi: {
    ptSubtitle: 'Ngân hàng, đại lý ô tô, đại lý bảo hiểm, đội xe và trung tâm đăng kiểm', ptNew: 'Thêm đối tác', ptActive: 'Đối tác đang hoạt động', ptPolicies: 'Hợp đồng trong tháng',
    ptCommission: 'Hoa hồng trong tháng', ptKeys: 'Khóa API đang dùng', ptList: 'Danh sách đối tác', ptPartner: 'Đối tác', ptStatus: 'Trạng thái', ptPolMonth: 'Hợp đồng', ptComMonth: 'Hoa hồng', ptMtd: 'Số liệu từ đầu tháng',
    ptKeyCol: 'Khóa API', ptNext: 'Thao tác', ptOfTotal: (n) => `trên ${n} đối tác`, ptOrders: (n) => `${n} đơn hàng`,
    aStatement: 'Xem bảng kê', aIssueKey: 'Cấp khóa API', aKeys: 'Quản lý khóa API', aSuspend: 'Tạm ngưng', aReactivate: 'Kích hoạt lại', aDetails: 'Xem chi tiết',
    suspendTitle: 'Tạm ngưng đối tác?', suspendMsg: (n) => `${n} sẽ không thể báo giá hay tạo đơn qua API cho đến khi được kích hoạt lại.`, reactivateTitle: 'Kích hoạt lại đối tác?', reactivateMsg: (n) => `${n} có thể báo giá và tạo đơn qua API trở lại.`,
    suspended: 'Đã tạm ngưng đối tác', reactivated: 'Đã kích hoạt lại đối tác', created: 'Đã thêm đối tác',
    newTitle: 'Thêm đối tác mới', fName: 'Tên đối tác', fNameHelp: 'Tên pháp lý hoặc tên thương mại', fType: 'Loại đối tác', fRegion: 'Khu vực hoạt động', fIssueNow: 'Cấp khóa API ngay sau khi tạo', create: 'Tạo đối tác', vName: 'Tên cần ít nhất 3 ký tự',
    keyTitle: 'Cấp khóa API', fScopes: 'Quyền truy cập', fExpiry: 'Thời hạn khóa', d90: '90 ngày', d180: '180 ngày', d365: '1 năm', d730: '2 năm', vScopes: 'Chọn ít nhất một quyền', issue: 'Cấp khóa',
    keyOnceTitle: 'Khóa API mới', keyOnce: 'Sao chép khóa ngay — khóa chỉ hiển thị một lần', keyOnceText: 'Gửi khóa cho đối tác qua kênh bảo mật. TASCO chỉ lưu mã băm của khóa.', keyDone: 'Tôi đã sao chép khóa',
    kScopes: 'Quyền', kExpires: 'Hết hạn', kPrefix: 'Nhận diện', kCreated: 'Ngày cấp', kStatus: 'Trạng thái', noExpiry: 'Không thời hạn', revoke: 'Thu hồi', revokeTitle: 'Thu hồi khóa API?', revokeMsg: 'Các hệ thống của đối tác dùng khóa này sẽ bị từ chối ngay lập tức.', revoked: 'Đã thu hồi khóa', noKeys: 'Chưa có khóa API', noKeysHint: 'Cấp khóa để đối tác kết nối hệ thống bán hàng.',
    stTitle: (n) => `Bảng kê hoa hồng · ${n}`, pThis: 'Tháng này', pLast: 'Tháng trước', pQuarter: 'Quý này', pYear: 'Năm nay', stOrder: 'Đơn hàng', stDate: 'Ngày', stProduct: 'Sản phẩm', stRate: 'Tỷ lệ', stCommission: 'Hoa hồng',
    stSubtotal: (n) => `Cộng đơn (${n} sản phẩm)`, stTotal: (n) => `Tổng hoa hồng · ${n} đơn`, stEmpty: 'Không có hoa hồng trong kỳ', stEmptyHint: 'Chọn kỳ khác hoặc kiểm tra trạng thái đối tác.', stOrders: 'Đơn hàng', stPolicies: 'Hợp đồng', stPremium: 'Phí thu hộ', stPeriod: 'Kỳ',
    devTitle: 'Kết nối dành cho nhà phát triển', devText: 'Đối tác tích hợp qua API REST bảo mật bằng khóa riêng.', devQuote: 'Báo giá theo biển số', devOrder: 'Tạo đơn chống trùng lặp', devPolicies: 'Tra cứu hợp đồng đã bán', devStatement: 'Bảng kê hoa hồng tự phục vụ', devDocs: 'Tài liệu API',
    chartTitle: 'Hoa hồng tháng này theo đối tác', chartEmpty: 'Chưa có hoa hồng trong tháng', detailsTitle: 'Thông tin đối tác', kType: 'Loại', kRegion: 'Khu vực', kSince: 'Hợp tác từ', allRegions: 'Toàn quốc', policiesN: (n) => `${n} hợp đồng`,
  },
  en: {
    ptSubtitle: 'Banks, showrooms, agents, fleets and inspection centres selling TASCO', ptNew: 'New partner', ptActive: 'Active partners', ptPolicies: 'Policies this month',
    ptCommission: 'Commission this month', ptKeys: 'Active API keys', ptList: 'Partners', ptPartner: 'Partner', ptStatus: 'Status', ptPolMonth: 'Policies', ptComMonth: 'Commission', ptMtd: 'Month to date',
    ptKeyCol: 'API keys', ptNext: 'Next step', ptOfTotal: (n) => `of ${n} partners`, ptOrders: (n) => `${n} order${n === 1 ? '' : 's'}`,
    aStatement: 'View statement', aIssueKey: 'Issue API key', aKeys: 'Manage API keys', aSuspend: 'Suspend', aReactivate: 'Reactivate', aDetails: 'View details',
    suspendTitle: 'Suspend partner?', suspendMsg: (n) => `${n} will not be able to quote or create orders through the API until reactivated.`, reactivateTitle: 'Reactivate partner?', reactivateMsg: (n) => `${n} will be able to quote and create orders through the API again.`,
    suspended: 'Partner suspended', reactivated: 'Partner reactivated', created: 'Partner created',
    newTitle: 'New partner', fName: 'Partner name', fNameHelp: 'Legal or trading name', fType: 'Partner type', fRegion: 'Operating region', fIssueNow: 'Issue an API key after creating', create: 'Create partner', vName: 'Use at least 3 characters',
    keyTitle: 'Issue API key', fScopes: 'Access', fExpiry: 'Key lifetime', d90: '90 days', d180: '180 days', d365: '1 year', d730: '2 years', vScopes: 'Choose at least one permission', issue: 'Issue key',
    keyOnceTitle: 'New API key', keyOnce: 'Copy the key now — it is shown only once', keyOnceText: 'Send it to the partner over a secure channel. TASCO stores only a hash of the key.', keyDone: 'I have copied the key',
    kScopes: 'Access', kExpires: 'Expires', kPrefix: 'Identifier', kCreated: 'Issued', kStatus: 'Status', noExpiry: 'No expiry', revoke: 'Revoke', revokeTitle: 'Revoke API key?', revokeMsg: 'Partner systems using this key are refused immediately.', revoked: 'API key revoked', noKeys: 'No API keys yet', noKeysHint: 'Issue a key so the partner can connect their sales system.',
    stTitle: (n) => `Commission statement · ${n}`, pThis: 'This month', pLast: 'Last month', pQuarter: 'This quarter', pYear: 'Year to date', stOrder: 'Order', stDate: 'Date', stProduct: 'Product', stRate: 'Rate', stCommission: 'Commission',
    stSubtotal: (n) => `Order subtotal (${n} product${n === 1 ? '' : 's'})`, stTotal: (n) => `Total commission · ${n} order${n === 1 ? '' : 's'}`, stEmpty: 'No commission in this period', stEmptyHint: 'Choose another period or check the partner status.', stOrders: 'Orders', stPolicies: 'Policies', stPremium: 'Premium collected', stPeriod: 'Period',
    devTitle: 'Developer access', devText: 'Partners integrate through a REST API secured with their own key.', devQuote: 'Quote by licence plate', devOrder: 'Create orders safely (no duplicates)', devPolicies: 'Look up policies sold', devStatement: 'Self-service commission statement', devDocs: 'API documentation',
    chartTitle: 'Commission this month by partner', chartEmpty: 'No commission this month yet', detailsTitle: 'Partner details', kType: 'Type', kRegion: 'Region', kSince: 'Partner since', allRegions: 'All regions', policiesN: (n) => `${n} polic${n === 1 ? 'y' : 'ies'}`,
  },
});

const TYPE_ICON = { bank: 'building', showroom: 'car', agent: 'briefcase', fleet: 'truck', inspection_center: 'clipboard-check' };
const TYPES = ['bank', 'showroom', 'agent', 'fleet', 'inspection_center'];
const SCOPES = ['quote', 'purchase', 'policies:read'];
const REGIONS = ['ALL', 'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'];
const regionLabel = (r) => (!r || r === 'ALL' ? t('allRegions') : r);
const typeIcon = (type, size = 18) => h('span', { class: 'wf-tile-icon', title: label('partnerType', type) }, icon(TYPE_ICON[type] || 'handshake', { size }));

function period(kind) {
  const now = new Date(Date.now() + 7 * 3600000); // Vietnam calendar
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = iso(now);
  if (kind === 'last') return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
  if (kind === 'quarter') return { from: iso(new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1))), to: today };
  if (kind === 'year') return { from: `${y}-01-01`, to: today };
  return { from: iso(new Date(Date.UTC(y, m, 1))), to: today };
}

function statementTable(s) {
  const groups = s.byOrder || [];
  if (!groups.length) return emptyState({ icon: 'file-spreadsheet', title: t('stEmpty'), text: t('stEmptyHint'), compact: true });
  const rows = [];
  for (const g of groups) {
    g.lines.forEach((l, i) => rows.push(h('tr', {},
      i === 0 ? h('td', { rowspan: String(g.lines.length), class: 'wf-group-ref' },
        h('div', { class: 'vehicle-cell' }, g.vehicle ? plateTag(g.vehicle) : null, h('span', { class: 'cell-sub' }, (g.certificates || [])[0] || ''))) : null,
      i === 0 ? h('td', { rowspan: String(g.lines.length), class: 'nowrap' }, formatDate(g.date)) : null,
      h('td', { title: label('product', l.product) }, productShort(l.product)),
      h('td', { class: 'num' }, formatPercent(l.rate, { decimals: 1 })),
      h('td', { class: 'num' }, formatMoney(l.amount)))));
    rows.push(h('tr', { class: 'wf-subtotal' }, h('td', { colspan: '4' }, t('stSubtotal', g.lines.length)), h('td', { class: 'num' }, formatMoney(g.subtotal))));
  }
  rows.push(h('tr', { class: 'wf-total' }, h('td', { colspan: '4' }, t('stTotal', groups.length)), h('td', { class: 'num' }, formatMoney(s.totalCommission))));
  return h('div', { class: 'table-wrap wf-statement' }, h('table', {},
    h('caption', { class: 'sr-only' }, t('stCommission')),
    h('thead', {}, h('tr', {}, [t('stOrder'), t('stDate'), t('stProduct'), t('stRate'), t('stCommission')].map((x, i) => h('th', { scope: 'col', class: i >= 3 ? 'num' : null }, x)))),
    h('tbody', {}, rows)));
}

export default {
  perm: 'partners:manage',
  async render(main, ctx) {
    const { api, user } = ctx;
    const technical = (user?.roles || []).some((r) => ['admin', 'support_engineer', 'auditor'].includes(r));
    let list = await api.get('/api/partners');
    const reload = async () => { list = await api.get('/api/partners'); paint(); };

    function showKeyOnce(partner, k) {
      const m = modal({
        title: t('keyOnceTitle'), size: 'md', dismissible: false,
        body: h('div', { class: 'stack' },
          banner({ tone: 'warn', title: t('keyOnce'), text: t('keyOnceText') }),
          copyField(k.apiKey, { label: t('keyOnceTitle') }),
          keyValueList([
            [t('ptPartner'), partner.name],
            [t('kScopes'), h('div', { class: 'chip-row' }, (k.scopes || []).map((s) => badge(label('scope', s), 'info')))],
            [t('kExpires'), k.expiresAt ? formatDate(k.expiresAt) : t('noExpiry')],
            [t('kPrefix'), `${k.prefix}…`],
          ], { columns: 2 })),
        actions: [button({ label: t('keyDone'), variant: 'primary', icon: 'check', onClick: () => m.close() })],
        onClose: () => reload(),
      });
    }

    const issueKey = (p) => {
      const boxes = SCOPES.map((s) => checkbox({ label: label('scope', s), checked: true, value: s }));
      const scopeCtl = h('div', { class: 'wf-scope-list', role: 'group' }, boxes);
      const expiry = selectInput([['90', t('d90')], ['180', t('d180')], ['365', t('d365')], ['730', t('d730')]], '365');
      return decisionDialog({
        title: t('keyTitle'), intro: `${p.name} · ${label('partnerType', p.type)}`, confirmLabel: t('issue'),
        fields: [
          { name: 'scopes', label: t('fScopes'), required: true, control: scopeCtl, read: () => boxes.filter((b) => b.input.checked).map((b) => b.input.value),
            validate: (v) => (!v.length ? t('vScopes') : null), summary: (v) => v.map((s) => label('scope', s)).join(', ') },
          { name: 'days', label: t('fExpiry'), required: true, control: expiry, summary: (v) => t(`d${v}`) },
        ],
        onSubmit: async (v) => {
          const k = await api.post(`/api/partners/${encodeURIComponent(p.id)}/keys`, { scopes: v.scopes.length ? v.scopes : SCOPES, expiresInDays: Number(v.days) });
          showKeyOnce(p, k);
          return k;
        },
      });
    };

    const setStatus = async (p, status) => {
      const ok = await confirmDialog(t(status === 'suspended' ? 'suspendTitle' : 'reactivateTitle'), t(status === 'suspended' ? 'suspendMsg' : 'reactivateMsg', p.name), t(status === 'suspended' ? 'aSuspend' : 'aReactivate'), { danger: status === 'suspended' });
      if (!ok) return;
      try {
        await api.patch(`/api/partners/${encodeURIComponent(p.id)}`, { status });
        toast(t(status === 'suspended' ? 'suspended' : 'reactivated'), 'ok', { title: p.name });
        await reload();
      } catch (e) { errorToast(e); }
    };

    async function openStatement(p) {
      let kind = 'this';
      const bodyBox = h('div', { class: 'stack' });
      let current = null;
      const exportCsv = () => {
        if (!current) return;
        const rows = [];
        for (const g of current.byOrder || []) for (const l of g.lines) rows.push([formatPlate(g.vehicle), (g.certificates || []).join(' '), formatDate(g.date), label('product', l.product), formatPercent(l.rate, { decimals: 1 }), Math.round(l.amount)]);
        downloadCsv(`commission-${p.name.replace(/[^\w]+/g, '-').toLowerCase()}-${current.from}.csv`, [t('stOrder'), 'Certificate', t('stDate'), t('stProduct'), t('stRate'), t('stCommission')], rows);
      };
      const load = async () => {
        const per = period(kind);
        mount(bodyBox, h('div', { class: 'muted' }, t('loading')));
        try {
          current = await api.get(`/api/partners/${encodeURIComponent(p.id)}/statement?from=${per.from}&to=${per.to}`);
        } catch (e) { errorToast(e); return; }
        const policies = (current.byOrder || []).reduce((s, g) => s + (g.certificates || []).length, 0);
        const premium = (current.byOrder || []).reduce((s, g) => s + (g.premium || 0), 0);
        mount(bodyBox,
          keyValueList([[t('stPeriod'), `${formatDate(per.from)} – ${formatDate(per.to)}`], [t('stOrders'), formatNumber(current.orders)], [t('stPolicies'), formatNumber(policies)],
            [t('stPremium'), formatMoney(premium)], [t('stCommission'), h('strong', {}, formatMoney(current.totalCommission))]], { columns: 3 }),
          statementTable(current));
      };
      const seg = segmented({ label: t('stPeriod'), value: kind, options: [['this', t('pThis')], ['last', t('pLast')], ['quarter', t('pQuarter')], ['year', t('pYear')]], onChange: (v) => { kind = v; load(); } });
      drawer({ title: t('stTitle', p.name), subtitle: label('partnerType', p.type), size: 'lg', body: [h('div', { class: 'stack' }, seg, bodyBox)],
        footer: [h('span', { class: 'grow' }), button({ label: t('exportCsv'), icon: 'download', onClick: exportCsv })] });
      await load();
    }

    async function openDetails(p) {
      const keysBox = h('div', {});
      const dr = drawer({ title: p.name, subtitle: label('partnerType', p.type), size: 'md', headerExtra: statusChip(p.status),
        body: [
          h('section', { class: 'wf-section' }, h('h3', {}, t('detailsTitle')), keyValueList([
            [t('kType'), h('span', { class: 'row tight' }, icon(TYPE_ICON[p.type] || 'handshake', { size: 16 }), label('partnerType', p.type))], [t('kRegion'), regionLabel(p.region)],
            [t('kSince'), formatDate(p.createdAt)], [t('ptStatus'), statusChip(p.status)],
            [t('ptPolMonth'), formatNumber(p.stats?.policies)], [t('ptComMonth'), formatMoney(p.stats?.commission)],
          ], { columns: 2 })),
          h('section', { class: 'wf-section' }, h('h3', {}, t('ptKeyCol')), keysBox),
          technical ? h('section', { class: 'wf-section' }, technicalDetails(keyValueList([['Partner id', p.id]], { columns: 1, inline: true }))) : null,
        ],
        footer: [
          p.status === 'active' ? button({ label: t('aIssueKey'), icon: 'key', onClick: () => { dr.close(); issueKey(p); } }) : null,
          h('span', { class: 'grow' }),
          button({ label: t('aStatement'), icon: 'file-spreadsheet', variant: 'primary', onClick: () => { dr.close(); openStatement(p); } }),
        ] });
      const paintKeys = async () => {
        let keys = [];
        try { keys = await api.get(`/api/partners/${encodeURIComponent(p.id)}/keys`); } catch (e) { errorToast(e); }
        if (!keys.length) { mount(keysBox, emptyState({ icon: 'key', title: t('noKeys'), text: t('noKeysHint'), compact: true })); return; }
        mount(keysBox, h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, [t('kPrefix'), t('kScopes'), t('kExpires'), t('kStatus'), ''].map((x) => h('th', { scope: 'col' }, x)))),
          h('tbody', {}, keys.map((k) => h('tr', {},
            h('td', { class: 'nowrap' }, h('div', {}, `${k.prefix}…`), h('span', { class: 'cell-sub' }, formatDate(k.createdAt))),
            h('td', {}, h('div', { class: 'wf-roles' }, (k.scopes || []).map((s) => badge(label('scope', s), 'neutral')))),
            h('td', { class: 'nowrap' }, k.expiresAt ? formatDate(k.expiresAt) : t('noExpiry')),
            h('td', {}, statusChip(k.status)),
            h('td', { class: 'num' }, k.status === 'active' ? button({ label: t('revoke'), size: 'sm', variant: 'danger', onClick: async () => {
              if (!(await confirmDialog(t('revokeTitle'), t('revokeMsg'), t('revoke'), { danger: true }))) return;
              try { await api.del(`/api/partners/keys/${encodeURIComponent(k.id)}`); toast(t('revoked'), 'ok'); await paintKeys(); reload(); } catch (e) { errorToast(e); }
            } }) : null)))))));
      };
      paintKeys();
    }

    function newPartner() {
      const name = input({ maxlength: '120', autocomplete: 'organization' });
      const type = selectInput(TYPES.map((k) => [k, label('partnerType', k)]), 'showroom');
      const region = selectInput(REGIONS.map((r) => [r, regionLabel(r)]), 'ALL');
      const issueNow = checkbox({ label: t('fIssueNow'), checked: true });
      const fName = formField({ label: t('fName'), control: name, required: true, help: t('fNameHelp') });
      const dr = drawer({ title: t('newTitle'), size: 'sm',
        body: h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); submit(); } }, fName, formField({ label: t('fType'), control: type, required: true }), formField({ label: t('fRegion'), control: region }), issueNow),
        footer: [h('span', { class: 'grow' }), button({ label: t('cancel'), onClick: () => dr.close() }), button({ label: t('create'), variant: 'primary', icon: 'plus', onClick: () => submit() })] });
      async function submit() {
        const n = name.value.trim();
        if (n.length < 3) { fName.setError(t('vName')); name.focus(); return; }
        fName.setError(null);
        try {
          const p = await api.post('/api/partners', { name: n, type: type.value, region: region.value });
          toast(t('created'), 'ok', { title: p.name });
          dr.close();
          await reload();
          if (issueNow.input.checked) issueKey(p);
        } catch (e) { errorToast(e); }
      }
    }

    const columns = [
      { key: 'name', label: t('ptPartner'), sortable: true, render: (p) => h('div', { class: 'wf-user' }, typeIcon(p.type), h('div', { class: 'wf-user-text' }, h('span', { class: 'wf-user-name' }, p.name), h('span', { class: 'cell-sub' }, `${label('partnerType', p.type)} · ${regionLabel(p.region)}`))) },
      { key: 'status', label: t('ptStatus'), sortable: true, render: (p) => statusChip(p.status), exportValue: (p) => label('status', p.status) },
      { key: 'policies', label: t('ptPolMonth'), align: 'right', sortable: true, value: (p) => p.stats?.policies || 0, render: (p) => formatNumber(p.stats?.policies || 0) },
      { key: 'commission', label: t('ptComMonth'), align: 'right', sortable: true, value: (p) => p.stats?.commission || 0, render: (p) => formatMoney(p.stats?.commission || 0) },
      { key: 'keys', label: t('ptKeyCol'), align: 'right', value: (p) => p.stats?.activeKeys || 0, render: (p) => formatNumber(p.stats?.activeKeys || 0) },
      { key: '_actions', label: t('ptNext'), align: 'right', render: (p) => rowActions({
        primary: p.status === 'active' ? { label: t('aStatement'), onClick: () => openStatement(p) } : { label: t('aReactivate'), onClick: () => { setStatus(p, 'active'); } },
        menu: [
          { label: t('aDetails'), icon: 'eye', onClick: () => openDetails(p) },
          p.status === 'active' ? { label: t('aIssueKey'), icon: 'key', onClick: () => issueKey(p) } : null,
          { label: t('aKeys'), icon: 'lock', onClick: () => openDetails(p) },
          p.status !== 'active' ? { label: t('aStatement'), icon: 'file-spreadsheet', onClick: () => openStatement(p) } : null,
          p.status === 'active' ? { separator: true } : null,
          p.status === 'active' ? { label: t('aSuspend'), icon: 'pause', danger: true, onClick: () => setStatus(p, 'suspended') } : null,
        ].filter(Boolean),
      }) },
    ];

    function devCard() {
      return card({ title: t('devTitle'), body: h('div', { class: 'wf-dev' },
        h('p', { class: 'muted' }, t('devText')),
        h('ul', {}, [['devQuote', 'search'], ['devOrder', 'check-circle'], ['devPolicies', 'file-text'], ['devStatement', 'file-spreadsheet']].map(([k, ic]) => h('li', {}, icon(ic, { size: 16 }), t(k)))),
        h('div', {}, h('a', { class: 'btn secondary sm', href: '/api/openapi.json', target: '_blank', rel: 'noopener' }, icon('external-link', { size: 15 }), h('span', {}, t('devDocs'))))) });
    }

    function paint() {
      const active = list.filter((p) => p.status === 'active');
      const sum = (k) => list.reduce((s, p) => s + (p.stats?.[k] || 0), 0);
      const chartData = list.filter((p) => p.stats?.commission > 0).sort((a, b) => b.stats.commission - a.stats.commission).slice(0, 6).map((p) => ({ label: p.name, value: p.stats.commission }));
      mount(main,
        pageHeader({ breadcrumb: [{ label: t('partners') }], title: t('partners'), subtitle: t('ptSubtitle'), actions: [button({ label: t('ptNew'), icon: 'plus', variant: 'primary', onClick: newPartner })] }),
        kpiStrip([
          kpiTile({ label: t('ptActive'), value: formatNumber(active.length), icon: 'handshake', hint: t('ptOfTotal', formatNumber(list.length)) }),
          kpiTile({ label: t('ptPolicies'), value: formatNumber(sum('policies')), icon: 'file-check', hint: t('ptOrders', formatNumber(sum('orders'))) }),
          kpiTile({ label: t('ptCommission'), value: formatMoney(sum('commission')), icon: 'wallet' }),
          kpiTile({ label: t('ptKeys'), value: formatNumber(sum('activeKeys')), icon: 'key' }),
        ]),
        h('div', { class: 'grid-12' },
          h('div', { class: 'span-12' }, card({ title: t('ptList'), subtitle: t('ptMtd'), flush: true, class: 'wf-dense', body: dataTable({
            caption: t('ptList'), columns, rows: list, onRowClick: (p) => openDetails(p), rowKey: (p) => p.id,
            toolbar: { search: true, export: { filename: 'partners.csv' } }, pagination: { pageSize: 25 },
            empty: { icon: 'handshake', title: t('empty'), action: button({ label: t('ptNew'), icon: 'plus', onClick: newPartner }) },
          }) })),
          h('div', { class: 'span-7' }, card({ title: t('chartTitle'), body: chartData.length ? barChart({ title: t('chartTitle'), data: chartData, format: (v) => formatMoney(v, { compact: true }) }) : emptyState({ icon: 'wallet', title: t('chartEmpty'), compact: true }) })),
          h('div', { class: 'span-5' }, devCard())));
    }
    paint();
  },
};
