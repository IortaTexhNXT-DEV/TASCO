import { h, mount } from '../../shared/dom.js';
import {
  pageHeader, card, kpiStrip, kpiTile, dataTable, badge, button, avatar, banner, drawer, keyValueList, selectInput, dateInput,
  technicalDetails, downloadCsv, formatDateTime, formatRelative, formatNumber, formatPercent, icon, errorToast,
} from '../ui.js';
import { tl, isTechnical } from '../gov-text.js';
import { CATEGORIES, categoryOf, categoryName, categoryIcon, sentence, actorDisplay, actorRoleText, objectOf, toneOf, iconOf, changeRows, detailRows } from '../audit-text.js';

/**
 * Audit trail: human sentences built from action codes, person + role, business object links,
 * filters (person, activity type, dates, object type), CSV export, chain-integrity status banner,
 * voice-compliance KPIs and a detail drawer (before/after; technical details for technical roles).
 */

const OBJECT_TYPES = [
  ['profile', ['Customer', 'Khách hàng']], ['ruleset', ['Rule set', 'Bộ quy tắc']], ['user', ['Staff user', 'Người dùng']], ['claim', ['Claim', 'Hồ sơ bồi thường']],
  ['partner', ['Partner', 'Đối tác']], ['quote', ['Quote', 'Báo giá']], ['order', ['Order', 'Đơn hàng']], ['handoff', ['Telesales handoff', 'Yêu cầu telesales']],
  ['dq_issue', ['Data-quality issue', 'Vấn đề dữ liệu']], ['job', ['Scheduled job', 'Tác vụ định kỳ']],
];
const timeOnly = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

export default {
  perm: 'audit:read',
  async render(main, ctx) {
    const { api, route, navigate, can, user } = ctx;
    const q = { actor: route.query.actor || '', category: route.query.category || '', from: route.query.from || '', to: route.query.to || '', type: route.query.type || '' };
    const params = new URLSearchParams({ limit: '500' });
    for (const k of ['actor', 'category', 'from', 'to']) if (q[k]) params.set(k, q[k]);
    const [entries, gov, actors] = await Promise.all([
      api.get(`/api/audit?${params}`),
      api.get('/api/dashboard/governance').catch(() => null),
      api.get('/api/audit/actors').catch(() => []),
    ]);
    const rows = (q.type ? entries.filter((e) => e.entityType === q.type) : entries).map((e) => ({ ...e, category: e.category || categoryOf(e.action) }));
    const go = (patch) => {
      const p = new URLSearchParams(Object.entries({ ...q, ...patch }).filter(([, v]) => v));
      navigate(`audit${p.toString() ? `?${p}` : ''}`);
    };

    // ---- Integrity banner ----
    const integrity = h('div', {});
    const paintIntegrity = (chain, at = new Date()) => {
      if (!chain) { mount(integrity); return; }
      mount(integrity, chain.ok
        ? banner({ tone: 'ok', icon: 'shield-check', title: tl(`Integrity verified · ${formatNumber(chain.entries)} records · last checked ${timeOnly(at)}`, `Toàn vẹn đã xác minh · ${formatNumber(chain.entries)} bản ghi · kiểm tra lúc ${timeOnly(at)}`), text: tl('No record has been changed or removed since it was written.', 'Không bản ghi nào bị sửa hoặc xóa kể từ khi ghi nhận.'), actions: [checkBtn] })
        : banner({ tone: 'danger', icon: 'alert-triangle', title: tl('Integrity check failed', 'Kiểm tra toàn vẹn không đạt'), text: tl(`The trail is broken at record ${formatNumber(chain.brokenAt)}. Escalate to Security and Internal Audit.`, `Chuỗi nhật ký bị gián đoạn tại bản ghi ${formatNumber(chain.brokenAt)}. Báo ngay cho bộ phận An ninh và Kiểm toán nội bộ.`), actions: [checkBtn] }));
    };
    const checkBtn = button({ label: tl('Check again', 'Kiểm tra lại'), icon: 'refresh', size: 'sm', variant: 'ghost', onClick: async () => {
      try { paintIntegrity(await api.get('/api/audit/verify')); } catch (e) { errorToast(e); }
    } });
    paintIntegrity(gov?.auditChain || null);

    // ---- Voice compliance KPIs ----
    const vb = gov?.voiceBot;
    const kpis = vb ? kpiStrip([
      kpiTile({ label: tl('Voice assistant calls', 'Cuộc gọi trợ lý giọng nói'), value: formatNumber(vb.calls), icon: 'mic' }),
      kpiTile({ label: tl('Disclosed as automated', 'Thông báo là cuộc gọi tự động'), value: vb.calls ? '100%' : '—', icon: 'badge-check', hint: tl('Announced at the start of every call', 'Thông báo ở đầu mọi cuộc gọi') }),
      kpiTile({ label: tl('Opt-out rate', 'Tỷ lệ từ chối nhận cuộc gọi'), value: formatPercent(vb.optOutRate, { decimals: 1 }), icon: 'phone', hint: tl('Customers asking not to be called', 'Khách hàng yêu cầu không gọi') }),
      kpiTile({ label: tl('Plate verification failures', 'Xác minh biển số không đạt'), value: formatPercent(vb.plateVerificationFailureRate, { decimals: 1 }), icon: 'car', hint: tl('Call ended before any offer', 'Kết thúc trước khi chào bán') }),
      kpiTile({ label: tl('Scam concerns raised', 'Khách lo ngại lừa đảo'), value: formatNumber(vb.outcomes?.scam_concern || 0), icon: 'alert-triangle', hint: tl('Handled with the trust script', 'Xử lý theo kịch bản xác minh') }),
    ], { label: tl('Voice compliance', 'Tuân thủ cuộc gọi tự động') }) : null;

    // ---- Filters ----
    const people = selectInput([['', tl('Everyone', 'Tất cả mọi người')], ['system', tl('TASCO platform (automated)', 'Hệ thống TASCO (tự động)')], ...actors.map((a) => [a.id, a.displayName])], q.actor, { 'aria-label': tl('Person', 'Người thực hiện'), class: 'sm' });
    people.addEventListener('change', () => go({ actor: people.value }));
    const cats = selectInput([['', tl('All activity', 'Mọi hoạt động')], ...CATEGORIES.map((c) => [c.id, tl(c.name)])], q.category, { 'aria-label': tl('Activity type', 'Loại hoạt động'), class: 'sm' });
    cats.addEventListener('change', () => go({ category: cats.value }));
    const types = selectInput([['', tl('Any object', 'Mọi đối tượng')], ...OBJECT_TYPES.map(([v, l]) => [v, tl(l)])], q.type, { 'aria-label': tl('Object', 'Đối tượng'), class: 'sm' });
    types.addEventListener('change', () => go({ type: types.value }));
    const from = dateInput({ value: q.from, onChange: (iso) => go({ from: iso || '' }) });
    const to = dateInput({ value: q.to, onChange: (iso) => go({ to: iso || '' }) });
    from.classList.add('sm'); to.classList.add('sm');
    from.setAttribute('aria-label', tl('From date', 'Từ ngày')); to.setAttribute('aria-label', tl('To date', 'Đến ngày'));
    const activeFilters = ['actor', 'category', 'from', 'to', 'type'].filter((k) => q[k]).length;
    const filters = [
      people, cats, types,
      h('div', { class: 'au-dates' }, from, h('span', { class: 'muted', 'aria-hidden': 'true' }, '–'), to),
      activeFilters ? button({ label: tl('Clear filters', 'Xóa bộ lọc'), size: 'sm', variant: 'ghost', icon: 'x', onClick: () => navigate('audit') }) : null,
    ].filter(Boolean);

    const exportCsv = () => downloadCsv(`audit-trail-${new Date().toISOString().slice(0, 10)}.csv`,
      [tl('Date and time', 'Thời gian'), tl('Activity', 'Hoạt động'), tl('Person', 'Người thực hiện'), tl('Role', 'Vai trò'), tl('Object', 'Đối tượng'), tl('Activity type', 'Loại hoạt động')],
      table.getVisible().map((e) => [formatDateTime(e.at), sentence(e, { can, mode: 'text' }), actorDisplay(e), actorRoleText(e), objectOf(e, { can }).text, categoryName(e.category)]));

    const table = dataTable({
      rows, rowKey: (e) => e.id, onRowClick: (e) => openDetail(e), pagination: { pageSize: 25 }, caption: tl('Audit trail', 'Nhật ký kiểm toán'),
      toolbar: { search: { placeholder: tl('Search activity, person or object', 'Tìm hoạt động, người hoặc đối tượng') }, filters, export: { onExport: exportCsv } },
      empty: { icon: 'history', title: tl('No activity for these filters', 'Không có hoạt động phù hợp'), text: tl('Try a wider date range or another person.', 'Thử khoảng thời gian rộng hơn hoặc người khác.') },
      columns: [
        { key: 'at', label: tl('Date and time', 'Thời gian'), sortable: true, nowrap: true, value: (e) => e.at,
          render: (e) => h('div', { class: 'au-when' }, h('span', {}, formatDateTime(e.at)), h('span', { class: 'cell-sub' }, formatRelative(e.at))) },
        { key: 'activity', label: tl('Activity', 'Hoạt động'), primary: true, value: (e) => sentence(e, { can, mode: 'text' }),
          render: (e) => h('div', { class: 'au-act' }, h('span', { class: `au-icon ${toneOf(e)}` }, icon(iconOf(e), { size: 16 })), sentence(e, { can })) },
        { key: 'actor', label: tl('Person', 'Người thực hiện'), sortable: true, value: (e) => actorDisplay(e),
          render: (e) => h('div', { class: 'who' }, avatar(actorDisplay(e), { size: 'sm' }), h('div', { class: 'who-text' }, h('span', { class: 'who-name' }, actorDisplay(e)), actorRoleText(e) ? h('span', { class: 'cell-sub' }, actorRoleText(e)) : null)) },
        { key: 'category', label: tl('Type', 'Loại'), sortable: true, value: (e) => categoryName(e.category), render: (e) => badge(categoryName(e.category), 'neutral', { icon: categoryIcon(e.category) }) },
      ],
    });
    // Rows after search/sort for export: re-run the table's own filtering through its search box value.
    table.getVisible = () => {
      const qv = table.querySelector('.dt-search input')?.value?.trim().toLowerCase();
      if (!qv) return rows;
      return rows.filter((e) => `${sentence(e, { can, mode: 'text' })} ${actorDisplay(e)} ${actorRoleText(e)} ${categoryName(e.category)}`.toLowerCase().includes(qv));
    };

    const limited = entries.length >= 500;
    mount(main,
      pageHeader({
        title: tl('Audit trail', 'Nhật ký kiểm toán'),
        subtitle: tl('Who did what, and when — every record is tamper-evident', 'Ai đã làm gì, khi nào — mọi bản ghi đều chống chỉnh sửa'),
      }),
      h('div', { class: 'au-integrity' }, integrity),
      kpis ? h('div', { class: 'au-kpis' }, kpis) : null,
      card({
        title: tl('Activity', 'Hoạt động'),
        subtitle: limited ? tl('Showing the latest 500 matching records — narrow the dates to see older activity', 'Hiển thị 500 bản ghi mới nhất — thu hẹp thời gian để xem cũ hơn') : tl(`${formatNumber(rows.length)} records`, `${formatNumber(rows.length)} bản ghi`),
        flush: true, body: table, class: 'au-card',
      }));

    function openDetail(e) {
      const obj = objectOf(e, { can });
      const before = changeRows(e);
      const details = detailRows(e);
      const ip = e.details?.ip;
      const technical = isTechnical(user);
      drawer({
        title: sentence(e, { can, mode: 'text' }), subtitle: formatDateTime(e.at), size: 'md',
        body: h('div', { class: 'stack-lg' },
          keyValueList([
            [tl('When', 'Thời gian'), `${formatDateTime(e.at)} (${formatRelative(e.at)})`],
            [tl('Activity type', 'Loại hoạt động'), badge(categoryName(e.category), 'neutral', { icon: categoryIcon(e.category) })],
            [tl('Person', 'Người thực hiện'), h('span', { class: 'who' }, avatar(actorDisplay(e), { size: 'sm' }), actorDisplay(e))],
            [tl('Role', 'Vai trò'), actorRoleText(e) || '—'],
            [tl('Object', 'Đối tượng'), obj.href ? h('a', { href: obj.href }, obj.text) : obj.text || '—'],
            ip ? [tl('IP address', 'Địa chỉ IP'), ip] : null,
          ].filter(Boolean), { columns: 2 }),
          before.length ? h('section', {}, h('h3', { class: 'ap-h' }, tl('Before and after', 'Trước và sau')),
            h('div', { class: 'table-wrap' }, h('table', {},
              h('caption', { class: 'sr-only' }, tl('Before and after', 'Trước và sau')),
              h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, tl('Field', 'Thông tin')), h('th', { scope: 'col' }, tl('Before', 'Trước')), h('th', { scope: 'col' }, tl('After', 'Sau')))),
              h('tbody', {}, before.map(([l, a, b]) => h('tr', {}, h('th', { scope: 'row' }, l), h('td', { class: 'muted' }, a ?? '—'), h('td', { class: 'strong' }, b ?? '—'))))))) : null,
          details.length ? h('section', {}, h('h3', { class: 'ap-h' }, tl('Details', 'Chi tiết')), keyValueList(details, { columns: 1, inline: true })) : null,
          technical ? technicalDetails(h('div', { class: 'stack-sm' },
            keyValueList([
              [tl('Record ID', 'Mã bản ghi'), h('code', {}, e.id)],
              [tl('Action code', 'Mã thao tác'), h('code', {}, e.action)],
              [tl('Object reference', 'Mã đối tượng'), e.entityId ? h('code', {}, `${e.entityType}:${e.entityId}`) : '—'],
              [tl('Actor reference', 'Mã người thực hiện'), h('code', {}, e.actor)],
              [tl('Record hash', 'Mã băm bản ghi'), h('code', { class: 'au-hash' }, e.hash)],
              [tl('Previous hash', 'Mã băm trước'), h('code', { class: 'au-hash' }, e.prevHash)],
            ], { columns: 1 }),
            h('pre', { class: 'au-raw' }, JSON.stringify(e.details ?? null, null, 2)))) : null),
      });
    }
  },
};
