'use strict';

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../shared/config');
const { createContainer, ROOT } = require('../bootstrap/container');
const { seedDemo, seedRules } = require('../bootstrap/seed');
const { buildOpenApi } = require('../adapters/http/openapi');
const { createRouter } = require('../adapters/http/router');
const { buildRoutes } = require('../adapters/http/routes');

/**
 * Batch / scheduled jobs (Kubernetes CronJobs, Railway cron, or manual):
 *   migrate | seed | rules | journeys | recompute | reconcile | retention | relay | sync-catalogue | openapi
 */
const JOBS = {
  async migrate(c) { if (!c.store.migrate) return { skipped: 'in-memory store' }; return { applied: await c.store.migrate() }; },
  async seed(c) {
    if (!c.config.demoMode) throw new Error('seed creates demo users and synthetic data — only allowed with DEMO_MODE=true (never in production)');
    if (c.store.migrate) await c.store.migrate();
    return seedDemo(c);
  },
  async rules(c) { return { loaded: await seedRules(c) }; },
  async journeys(c) { const r = await c.services.journeys.runDue({ actor: 'cron' }); await c.events.drain(); return r; },
  async recompute(c) { const r = await c.services.leads.recompute(null, { actor: 'cron' }); return r; },
  async reconcile(c) { return c.services.ops.reconcile('cron'); },
  async retention(c) { return c.services.ops.applyRetention('cron'); },
  async relay(c) { return { processed: await c.events.drain() }; },
  /** Pull TASCO core's product catalogue → propose a `products` rule-set version (maker-checker; never auto-activated). */
  async 'sync-catalogue'(c) { return c.services.catalogue.sync('cron'); },
  async openapi(c) {
    const spec = buildOpenApi(createRouter(buildRoutes()).routes, { version: require('../../package.json').version, serverUrl: c.config.publicBaseUrl });
    const out = path.join(ROOT, 'docs', 'api', 'openapi.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`);
    return { written: path.relative(ROOT, out), paths: Object.keys(spec.paths).length };
  },
};

async function run(name) {
  const job = JOBS[name];
  if (!job) {
    process.stderr.write(`Unknown job "${name}". Available: ${Object.keys(JOBS).join(', ')}\n`);
    process.exit(2);
  }
  const c = await createContainer(loadConfig());
  try {
    const result = await job(c);
    c.logger.info('job finished', { job: name, result });
  } finally {
    await c.store.close();
  }
}

run(process.argv[2]).catch((err) => {
  process.stderr.write(`${JSON.stringify({ level: 'error', msg: 'job failed', err: err.message })}\n`);
  process.exit(1);
});
