'use strict';

const { loadConfig } = require('./shared/config');
const { createContainer } = require('./bootstrap/container');
const { createHttpApp } = require('./adapters/http/app');
const { seedDemo, seedRules } = require('./bootstrap/seed');

/**
 * Process entry point: config → container → (migrate) → seed → HTTP server,
 * background outbox relay, graceful shutdown on SIGTERM (Kubernetes / Railway).
 */
async function main() {
  const config = loadConfig();
  const c = await createContainer(config);
  const { logger } = c;

  if (c.store.migrate && process.env.MIGRATE_ON_START !== 'false') {
    const applied = await c.store.migrate();
    if (applied.length) logger.info('migrations applied', { applied });
  }
  if (config.demoMode) await seedDemo(c);
  else await seedRules(c);

  const app = createHttpApp(c);
  app.server.listen(config.port, () => {
    app.setReady(true);
    logger.info('server listening', { port: config.port, store: c.store.kind, demoMode: config.demoMode, today: c.clock.today() });
  });

  const relay = setInterval(() => {
    c.events.relay(200).catch((err) => logger.error('outbox relay failed', { err }));
  }, 1000);
  relay.unref();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });
    app.setReady(false); // fail readiness first so the load balancer drains us
    clearInterval(relay);
    setTimeout(() => process.exit(1), 25000).unref();
    app.server.close(async () => {
      await c.store.close().catch(() => {});
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error('unhandledRejection', { err }));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: 'error', msg: 'fatal startup error', err: err.message }));
  process.exit(1);
});
