/**
 * Operations (technical, still clean): integration health as status cards, background jobs with last/next run
 * and "Run now", event backlog, active rule versions (checksums only behind Technical details).
 */
import { h, mount } from '../../shared/dom.js';
import { label } from '../../shared/i18n.js';
import {
  pageHeader, kpiStrip, kpiTile, card, dataTable, statusChip, badge, rowActions, drawer, keyValueList, button, toast, errorToast, confirmDialog,
  icon, formatNumber, formatRelative, formatDateTime, technicalDetails, emptyState,
} from '../ui.js';
import { pageStrings } from './workflowLabels.js';

const t = pageStrings('ops', {
  vi: {
    opSubtitle: 'Tình trạng tích hợp, tác vụ nền và xử lý sự kiện', opRefresh: 'Làm mới', opIntegrations: 'Tình trạng tích hợp', opHealthy: 'Tích hợp hoạt động', opJobsFailed: 'Tác vụ lỗi (24 giờ)',
    opEvents: 'Sự kiện chờ xử lý', opAudit: 'Bản ghi kiểm toán', opOfTotal: (a, b) => `${a}/${b}`, opLatency: 'Độ trễ', opLastCall: 'Lần gọi gần nhất', opChecked: 'Kiểm tra lúc', opNoCalls: 'Chưa có lượt gọi', opCalls: (n) => `${n} lượt gọi, không lỗi`,
    opRating: 'Nguồn định phí', opLastSync: 'Đồng bộ gần nhất', opMode: 'Chế độ', modeSim: 'Môi trường giả lập', modeLive: 'Kết nối thật', opNeverSynced: 'Chưa đồng bộ', opErrors: (n) => `${n} lỗi`,
    opJobs: 'Tác vụ nền', opJob: 'Tác vụ', opSchedule: 'Lịch chạy', opLastRun: 'Lần chạy gần nhất', opNextRun: 'Lần chạy tiếp theo', opRunNow: 'Chạy ngay', opHistory: 'Lịch sử chạy', opViewHistory: 'Xem lịch sử',
    everyN: (n) => `${n} phút một lần`, dailyAt: (t2) => `Hằng ngày lúc ${t2}`, neverRun: 'Chưa chạy', runConfirm: (n) => `Chạy “${n}” ngay?`, runMsg: 'Tác vụ chạy trên dữ liệu thật và được ghi vào nhật ký kiểm toán.',
    runDone: 'Tác vụ đã chạy xong', opStarted: 'Bắt đầu', opBy: 'Người chạy', opStatus: 'Kết quả', opDuration: 'Thời lượng', opSummary: 'Tóm tắt', scheduler: 'Lịch tự động', staff: 'Nhân viên',
    sumRecon: (a, b) => `${a} đơn đã kiểm tra · ${b} chênh lệch`, sumRelay: (n) => `${n} sự kiện đã chuyển tiếp`, sumRetention: 'Đã áp dụng chính sách lưu trữ', sumCatalogue: { no_change: 'Không có thay đổi', proposed: 'Đã đề xuất cập nhật danh mục', already_proposed: 'Đã có đề xuất chờ duyệt' },
    opBacklog: 'Hàng đợi sự kiện', evPending: 'Chờ xử lý', evDone: 'Đã xử lý', evDead: 'Lỗi không gửi được', opRules: 'Phiên bản quy tắc đang áp dụng', opRuleSet: 'Bộ quy tắc', opVersion: 'Phiên bản', opActivated: 'Áp dụng từ',
    runDetail: 'Chi tiết lần chạy', noRuns: 'Chưa có lần chạy', checksums: 'Mã kiểm tra (checksum)', secs: (n) => `${n} giây`, lessSec: '< 1 giây',
  },
  en: {
    opSubtitle: 'Integration health, background jobs and event processing', opRefresh: 'Refresh', opIntegrations: 'Integration health', opHealthy: 'Integrations operational', opJobsFailed: 'Failed jobs (24 h)',
    opEvents: 'Events waiting', opAudit: 'Audit records', opOfTotal: (a, b) => `${a} of ${b}`, opLatency: 'Latency', opLastCall: 'Last call', opChecked: 'Checked', opNoCalls: 'No calls yet', opCalls: (n) => `${n} call${n === '1' ? '' : 's'}, no errors`,
    opRating: 'Rating source', opLastSync: 'Last sync', opMode: 'Mode', modeSim: 'Simulated', modeLive: 'Live', opNeverSynced: 'Never synced', opErrors: (n) => `${n} error${n === 1 ? '' : 's'}`,
    opJobs: 'Background jobs', opJob: 'Job', opSchedule: 'Schedule', opLastRun: 'Last run', opNextRun: 'Next run', opRunNow: 'Run now', opHistory: 'Run history', opViewHistory: 'View history',
    everyN: (n) => `Every ${n} minutes`, dailyAt: (t2) => `Daily at ${t2}`, neverRun: 'Not run yet', runConfirm: (n) => `Run “${n}” now?`, runMsg: 'The job runs against live data and is recorded in the audit trail.',
    runDone: 'Job finished', opStarted: 'Started', opBy: 'Run by', opStatus: 'Result', opDuration: 'Duration', opSummary: 'Summary', scheduler: 'Scheduler', staff: 'Staff member',
    sumRecon: (a, b) => `${a} orders checked · ${b} mismatch${b === '1' ? '' : 'es'}`, sumRelay: (n) => `${n} events relayed`, sumRetention: 'Retention policy applied', sumCatalogue: { no_change: 'No changes', proposed: 'Catalogue update proposed', already_proposed: 'Update already awaiting approval' },
    opBacklog: 'Event backlog', evPending: 'Waiting', evDone: 'Processed', evDead: 'Dead letter', opRules: 'Active rule versions', opRuleSet: 'Rule set', opVersion: 'Version', opActivated: 'Active since',
    runDetail: 'Job run', noRuns: 'No runs yet', checksums: 'Checksums', secs: (n) => `${n} s`, lessSec: '< 1 s',
  },
});

/** Display order and icon of integrations (names from the gateway registry). */
const INTEGRATIONS = [
  ['tasco-core-rating', 'gauge'], ['tasco-core-catalogue', 'layers'], ['tasco-core', 'file-check'], ['vetc-wallet', 'wallet'],
  ['voice-ai', 'bot'], ['app-push', 'smartphone'], ['zalo-zns', 'message-square'], ['sms', 'send'],
];
const CIRCUIT_TONE = { closed: 'ok', half_open: 'warn', open: 'danger' };
const RUN_KIND = { 'catalogue-sync': 'catalogue_sync' };
const ictTime = (h1, m1) => `${String((h1 + 7) % 24).padStart(2, '0')}:${String(m1).padStart(2, '0')}`;

function scheduleText(j) {
  if (j.everyMinutes) return t('everyN', j.everyMinutes);
  const [m1, h1] = String(j.cron).split(' ').map(Number);
  return t('dailyAt', ictTime(h1, m1));
}
function duration(r) {
  if (!r.finishedAt || !r.startedAt) return '—';
  const s = Math.round((new Date(r.finishedAt) - new Date(r.startedAt)) / 1000);
  return s < 1 ? t('lessSec') : t('secs', formatNumber(s));
}
function runSummary(r) {
  const x = r.result || {};
  if (r.status === 'failed') return r.error ? String(r.error).split('\n')[0].slice(0, 120) : label('status', 'failed');
  if (r.kind === 'reconciliation') return t('sumRecon', formatNumber(x.checked || 0), formatNumber(x.mismatches || 0));
  if (r.kind === 'relay') return t('sumRelay', formatNumber(x.processed || 0));
  if (r.kind === 'retention') return t('sumRetention');
  if (r.kind === 'catalogue_sync') return (t('sumCatalogue') || {})[x.status] || label('status', r.status);
  return label('status', r.status);
}
const actorText = (r) => r.actorName || (/^U-/.test(String(r.actor)) ? t('staff') : t('scheduler'));

export default {
  perm: 'ops:read',
  async render(main, ctx) {
    const { api, can } = ctx;
    const canRun = can('ops:run_jobs');
    let status;
    let runs;
    let core;
    const load = async () => { [status, runs, core] = await Promise.all([api.get('/api/ops/status'), api.get('/api/ops/jobs'), api.get('/api/integrations/status').catch(() => null)]); };
    await load();

    const runJob = async (j) => {
      if (!(await confirmDialog(t('runConfirm', label('job', j.kind)), t('runMsg'), t('opRunNow')))) return;
      try {
        await api.post(`/api/ops/jobs/${encodeURIComponent(j.kind)}`);
        toast(t('runDone'), 'ok', { title: label('job', j.kind) });
        await load(); paint();
      } catch (e) { errorToast(e); }
    };

    function runDrawer(r) {
      drawer({ title: label('job', r.kind), subtitle: formatDateTime(r.startedAt), size: 'md', headerExtra: statusChip(r.status),
        body: [
          keyValueList([[t('opStarted'), formatDateTime(r.startedAt)], [t('opDuration'), duration(r)], [t('opBy'), actorText(r)], [t('opStatus'), statusChip(r.status)], [t('opSummary'), runSummary(r)]], { columns: 2 }),
          h('div', { class: 'wf-section' }, technicalDetails(h('pre', { class: 'wf-pre' }, JSON.stringify({ runId: r.id, actor: r.actor, result: r.result ?? null, error: r.error ?? null }, null, 2)))),
        ] });
    }
    function historyDrawer(kind) {
      const rk = RUN_KIND[kind] || kind;
      const rows = runs.filter((r) => r.kind === rk);
      drawer({ title: t('opHistory'), subtitle: label('job', kind), size: 'lg', body: rows.length ? historyTable(rows, false) : emptyState({ icon: 'history', title: t('noRuns'), compact: true }) });
    }

    function healthCard(name, ic) {
      const g = status.integrations.find((x) => x.name === name);
      if (!g) return null;
      const tone = CIRCUIT_TONE[g.circuit] || 'neutral';
      const extra = [];
      if (name === 'tasco-core-rating' && core?.rating) {
        extra.push([t('opRating'), label('rateSource', core.rating.source)], [t('opMode'), core.rating.core?.mode === 'live' || core.rating.core?.endpoint ? t('modeLive') : t('modeSim')]);
      }
      if (name === 'tasco-core-catalogue' && core?.catalogue) {
        const ls = core.catalogue.lastSync;
        extra.push([t('opLastSync'), ls ? h('span', { title: formatDateTime(ls.finishedAt || ls.startedAt) }, formatRelative(ls.finishedAt || ls.startedAt)) : t('opNeverSynced')]);
        if (ls?.outcome) extra.push([t('opStatus'), (t('sumCatalogue') || {})[ls.outcome] || label('status', ls.status)]);
      }
      return h('article', { class: 'wf-tile', 'aria-label': label('integration', name) },
        h('div', { class: 'wf-tile-head' },
          h('span', { class: `wf-tile-icon ${tone}` }, icon(ic, { size: 18 })),
          h('div', { class: 'grow' }, h('h3', { class: 'wf-tile-title' }, label('integration', name)), h('div', { class: 'wf-tile-sub' }, g.failures ? t('opErrors', formatNumber(g.failures)) : g.calls ? t('opCalls', formatNumber(g.calls)) : t('opNoCalls'))),
          badge(label('circuit', g.circuit), tone, { dot: true })),
        extra.length ? keyValueList(extra, { columns: 2 }) : null,
        h('div', { class: 'wf-health-meta' },
          h('div', {}, h('span', { class: 'wf-stat-label' }, t('opLatency')), h('span', { class: 'wf-stat-value' }, g.latencyMs === null || g.latencyMs === undefined ? '—' : g.latencyMs < 1 ? '< 1 ms' : `${formatNumber(g.latencyMs)} ms`)),
          h('div', {}, h('span', { class: 'wf-stat-label' }, t('opLastCall')), h('span', { class: 'wf-stat-value', title: g.lastCallAt ? formatDateTime(g.lastCallAt) : '' }, g.lastCallAt ? formatRelative(g.lastCallAt) : '—')),
          h('div', {}, h('span', { class: 'wf-stat-label' }, t('opChecked')), h('span', { class: 'wf-stat-value', title: formatDateTime(status.checkedAt) }, formatRelative(status.checkedAt)))));
    }

    function historyTable(rows, withKind = true) {
      return dataTable({
        caption: t('opHistory'), rows, onRowClick: runDrawer, pagination: { pageSize: 10 },
        columns: [
          { key: 'startedAt', label: t('opStarted'), sortable: true, nowrap: true, render: (r) => h('span', { title: formatDateTime(r.startedAt) }, formatRelative(r.startedAt)) },
          withKind ? { key: 'kind', label: t('opJob'), render: (r) => label('job', r.kind) } : null,
          { key: 'actor', label: t('opBy'), render: actorText },
          { key: 'status', label: t('opStatus'), render: (r) => statusChip(r.status) },
          { key: 'duration', label: t('opDuration'), align: 'right', render: duration },
          { key: 'summary', label: t('opSummary'), render: (r) => h('span', { class: 'wf-summary', title: runSummary(r) }, runSummary(r)) },
        ].filter(Boolean),
        empty: { icon: 'history', title: t('noRuns') },
      });
    }

    function paint() {
      const cards = INTEGRATIONS.map(([n, ic]) => healthCard(n, ic)).filter(Boolean);
      const healthy = status.integrations.filter((g) => g.circuit === 'closed').length;
      const dayAgo = Date.now() - 86400000;
      const failed = runs.filter((r) => r.status === 'failed' && new Date(r.startedAt).getTime() > dayAgo).length;
      const backlog = status.eventBacklog || {};
      const waiting = (backlog.pending || 0);
      const jobsTable = dataTable({
        caption: t('opJobs'), rows: status.jobs || [], rowKey: (j) => j.kind, pagination: false,
        columns: [
          { key: 'kind', label: t('opJob'), render: (j) => h('span', { class: 'cell-primary' }, label('job', j.kind)) },
          { key: 'cron', label: t('opSchedule'), render: (j) => h('span', { class: 'nowrap' }, scheduleText(j)) },
          { key: 'last', label: t('opLastRun'), render: (j) => (j.lastRun ? h('div', { class: 'row tight nowrap' }, statusChip(j.lastRun.status), h('span', { class: 'muted', title: formatDateTime(j.lastRun.startedAt) }, formatRelative(j.lastRun.startedAt))) : h('span', { class: 'muted' }, t('neverRun'))) },
          { key: 'next', label: t('opNextRun'), nowrap: true, render: (j) => h('span', { title: formatDateTime(j.nextRunAt) }, formatRelative(j.nextRunAt)) },
          { key: '_actions', label: '', align: 'right', render: (j) => rowActions({
            primary: canRun ? { label: t('opRunNow'), icon: 'play', onClick: () => { runJob(j); } } : { label: t('opViewHistory'), muted: true, onClick: () => historyDrawer(j.kind) },
            menu: canRun ? [{ label: t('opViewHistory'), icon: 'history', onClick: () => historyDrawer(j.kind) }] : [],
          }) },
        ],
      });
      const rulesRows = (status.rules || []).slice().sort((a, b) => label('ruleKind', a.kind).localeCompare(label('ruleKind', b.kind)));
      mount(main,
        pageHeader({ title: t('ops'), subtitle: t('opSubtitle'), actions: [button({ label: t('opRefresh'), icon: 'refresh', onClick: async () => { try { await load(); paint(); } catch (e) { errorToast(e); } } })] }),
        kpiStrip([
          kpiTile({ label: t('opHealthy'), value: t('opOfTotal', formatNumber(healthy), formatNumber(status.integrations.length)), icon: 'activity' }),
          kpiTile({ label: t('opJobsFailed'), value: formatNumber(failed), icon: 'alert-triangle' }),
          kpiTile({ label: t('opEvents'), value: formatNumber(waiting), icon: 'layers', hint: backlog.dead_letter ? `${label('status', 'dead_letter')}: ${formatNumber(backlog.dead_letter)}` : null }),
          kpiTile({ label: t('opAudit'), value: formatNumber(status.auditEntries), icon: 'history' }),
        ]),
        card({ title: t('opIntegrations'), class: 'section', body: h('div', { class: 'wf-card-grid' }, cards) }),
        card({ title: t('opJobs'), flush: true, class: 'wf-dense section', body: jobsTable }),
        card({ title: t('opHistory'), flush: true, class: 'wf-dense section', body: historyTable(runs) }),
        h('div', { class: 'grid-12 section' },
          h('div', { class: 'span-5' }, card({ title: t('opBacklog'), body: h('div', { class: 'wf-tile-stats' },
            [['pending', 'evPending', backlog.pending], ['done', 'evDone', backlog.done], ['dead_letter', 'evDead', backlog.dead_letter]].map(([st, key, n]) => h('div', {},
              h('span', { class: 'wf-stat-label' }, t(key)), h('span', { class: 'wf-stat-value wf-big' }, formatNumber(n || 0)), h('span', { class: `wf-dot-line ${st}` }, statusChip(st))))) })),
          h('div', { class: 'span-7' }, card({ title: t('opRules'), flush: true, class: 'wf-dense', body: h('div', {},
            dataTable({ caption: t('opRules'), rows: rulesRows, rowKey: (r) => r.kind, pagination: { pageSize: 10 }, columns: [
              { key: 'kind', label: t('opRuleSet'), render: (r) => label('ruleKind', r.kind) },
              { key: 'version', label: t('opVersion'), align: 'right', render: (r) => `v${r.version}` },
              { key: 'activatedAt', label: t('opActivated'), nowrap: true, render: (r) => (r.activatedAt ? h('span', { title: formatDateTime(r.activatedAt) }, formatRelative(r.activatedAt)) : '—') },
            ] }),
            h('div', { class: 'card-body' }, technicalDetails(keyValueList(rulesRows.map((r) => [`${label('ruleKind', r.kind)} v${r.version}`, h('code', { class: 'xs' }, String(r.checksum).slice(0, 16))]), { columns: 1, inline: true }), { summary: t('checksums') }))) }))));
    }
    paint();
  },
};
