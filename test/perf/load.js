'use strict';

/**
 * Dependency-free HTTP load generator (NFT smoke). Starts an in-process server
 * (or targets BASE_URL), signs in, then drives a weighted mix of the hottest
 * read and write paths with fixed concurrency and reports RPS and latency
 * percentiles. Exit code 1 if p95 exceeds P95_BUDGET_MS or errors exceed 1%.
 *
 *   node test/perf/load.js            # in-process, memory store
 *   BASE_URL=https://uat... USERNAME=supervisor PASSWORD=... node test/perf/load.js
 */
const { makeContainer, startServer } = require('../helpers');

const DURATION_MS = Number(process.env.DURATION_MS || 15000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 25);
const P95_BUDGET_MS = Number(process.env.P95_BUDGET_MS || 300);

function pct(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;
}

(async () => {
  let base = process.env.BASE_URL;
  let srv;
  let c;
  if (!base) {
    c = await makeContainer({ env: { SEED_RECORDS: process.env.SEED_RECORDS || '3000' } });
    srv = await startServer(c);
    base = srv.base;
  }
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: process.env.USERNAME || 'supervisor', password: process.env.PASSWORD || 'Tasco@Demo2026!' }) });
  const token = (await login.json()).accessToken;
  const auth = { Authorization: `Bearer ${token}` };
  const leads = await (await fetch(`${base}/api/leads?limit=200`, { headers: auth })).json();
  const ids = leads.items.map((l) => l.id);
  const pick = () => ids[Math.floor(Math.random() * ids.length)];

  const mix = [
    { w: 35, name: 'GET /api/leads', run: () => fetch(`${base}/api/leads?tier=hot&limit=25`, { headers: auth }) },
    { w: 30, name: 'GET /api/customers/:id', run: () => fetch(`${base}/api/customers/${pick()}`, { headers: auth }) },
    { w: 15, name: 'POST /api/quotes', run: () => fetch(`${base}/api/quotes`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: pick(), products: [{ code: 'TNDS_CAR' }], channel: 'telesales' }) }) },
    { w: 10, name: 'GET /api/public/certificates/:no', run: () => fetch(`${base}/api/public/certificates/TAS-NOPE`) },
    { w: 5, name: 'GET /api/dashboard/overview', run: () => fetch(`${base}/api/dashboard/overview`, { headers: auth }) },
    { w: 5, name: 'GET /health/ready', run: () => fetch(`${base}/health/ready`) },
  ];
  const total = mix.reduce((s, m) => s + m.w, 0);
  const choose = () => { let r = Math.random() * total; for (const m of mix) { r -= m.w; if (r <= 0) return m; } return mix[0]; };

  const stats = new Map(mix.map((m) => [m.name, { lat: [], errors: 0 }]));
  const end = Date.now() + DURATION_MS;
  async function worker() {
    while (Date.now() < end) {
      const m = choose();
      const t0 = performance.now();
      try {
        const res = await m.run();
        await res.arrayBuffer();
        if (res.status >= 500 || (res.status >= 400 && res.status !== 404)) stats.get(m.name).errors++;
      } catch { stats.get(m.name).errors++; }
      stats.get(m.name).lat.push(performance.now() - t0);
    }
  }
  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const secs = (Date.now() - started) / 1000;

  const rows = [];
  let all = [];
  let errs = 0;
  for (const [name, s] of stats) {
    const sorted = s.lat.sort((a, b) => a - b);
    all = all.concat(sorted);
    errs += s.errors;
    rows.push({ endpoint: name, requests: sorted.length, rps: +(sorted.length / secs).toFixed(1), p50: +pct(sorted, 50).toFixed(1), p95: +pct(sorted, 95).toFixed(1), p99: +pct(sorted, 99).toFixed(1), errors: s.errors });
  }
  all.sort((a, b) => a - b);
  const summary = { durationS: +secs.toFixed(1), concurrency: CONCURRENCY, requests: all.length, rps: +(all.length / secs).toFixed(1), p50: +pct(all, 50).toFixed(1), p95: +pct(all, 95).toFixed(1), p99: +pct(all, 99).toFixed(1), errorRate: +(errs / Math.max(1, all.length)).toFixed(4) };
  console.table(rows); // eslint-disable-line no-console
  console.log(JSON.stringify({ summary, budgetP95Ms: P95_BUDGET_MS })); // eslint-disable-line no-console
  if (srv) await srv.close();
  process.exit(summary.p95 > P95_BUDGET_MS || summary.errorRate > 0.01 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }); // eslint-disable-line no-console
