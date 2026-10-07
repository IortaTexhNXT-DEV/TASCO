'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRouter } = require('./router');
const { buildRoutes } = require('./routes');
const { buildOpenApi } = require('./openapi');
const { securityHeaders, cors, createRateLimiter } = require('./security');
const { validate } = require('../../shared/validation');
const { AppError, errors } = require('../../shared/errors');

const PUBLIC_DIR = path.join(__dirname, '..', '..', '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};

/**
 * HTTP adapter: request pipeline
 *   request id → security headers → CORS → rate limit → body parse (size-capped JSON)
 *   → route match → authenticate → authorise (RBAC) → validate → handler → JSON
 * plus static assets, health probes and metrics.
 */
function createHttpApp(c) {
  const { config, logger, metrics, services } = c;
  const router = createRouter(buildRoutes());
  const limiter = createRateLimiter(config.rateLimit);
  const openapi = buildOpenApi(router.routes, { version: require('../../../package.json').version, serverUrl: config.publicBaseUrl });
  let ready = false;

  const send = (res, status, body, headers = {}) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(payload);
  };

  const clientIp = (req) => {
    if (config.trustProxy) {
      const xff = req.headers['x-forwarded-for'];
      if (xff) return String(xff).split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return resolve(undefined);
      const ct = String(req.headers['content-type'] || '');
      let size = 0;
      const chunks = [];
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > config.bodyLimitBytes) {
          reject(new AppError('PAYLOAD_TOO_LARGE', 'Request body too large', 413));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (!size) return resolve({});
        if (!ct.startsWith('application/json')) return reject(new AppError('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json', 415));
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
          resolve(parsed);
        } catch {
          reject(errors.validation('Malformed JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  async function authenticate(req, route) {
    if (route.auth === 'public') return null;
    if (route.auth === 'partner') {
      const p = await services.partners.authenticateKey(req.headers['x-api-key']);
      if (!p) throw errors.unauthenticated('Valid X-Api-Key required');
      return p;
    }
    const h = String(req.headers.authorization || '');
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    const principal = token ? await services.identity.authenticate(token) : null;
    if (!principal) throw errors.unauthenticated();
    if (route.auth === 'customer' && !principal.roles.includes('customer')) throw errors.forbidden('Customer token required');
    if (route.auth === 'staff' && principal.roles.includes('customer')) throw errors.forbidden('Staff token required');
    return principal;
  }

  function serveStatic(req, res, pathname) {
    let rel = pathname;
    if (rel === '/' || rel === '') rel = '/index.html';
    if (rel === '/app' || rel === '/app/') rel = '/app/index.html';
    if (rel.startsWith('/verify/')) rel = '/verify.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return false; // path traversal guard
    let stat;
    try { stat = fs.statSync(file); } catch { return false; }
    if (!stat.isFile()) return false;
    const ext = path.extname(file);
    const immutable = rel.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : immutable ? 'public, max-age=86400' : 'public, max-age=300',
    });
    if (req.method === 'HEAD') return res.end() || true;
    fs.createReadStream(file).pipe(res);
    return true;
  }

  async function handle(req, res) {
    const started = process.hrtime.bigint();
    const requestId = /^[\w-]{8,64}$/.test(String(req.headers['x-request-id'] || '')) ? req.headers['x-request-id'] : crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    securityHeaders(res, config);
    const url = new URL(req.url, 'http://local');
    const pathname = url.pathname;
    const ip = clientIp(req);
    let routeLabel = 'static';
    let status = 200;

    try {
      if (!cors(req, res, config.corsOrigins)) throw errors.forbidden('Origin not allowed');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (pathname === '/health/live') { routeLabel = 'health'; send(res, 200, { status: 'ok' }); return; }
      if (pathname === '/health/ready') {
        routeLabel = 'health';
        let dbOk = false;
        try { dbOk = await c.store.ping(); } catch { dbOk = false; }
        status = ready && dbOk ? 200 : 503;
        send(res, status, { status: status === 200 ? 'ready' : 'not_ready', store: c.store.kind, db: dbOk });
        return;
      }
      if (pathname === '/metrics') {
        routeLabel = 'metrics';
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(metrics.render());
        return;
      }
      if (pathname === '/api/openapi.json') { routeLabel = 'openapi'; send(res, 200, openapi); return; }

      if (!pathname.startsWith('/api/')) {
        if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, pathname)) return;
        throw errors.notFound('Page');
      }

      const m = router.match(req.method, pathname);
      if (!m) throw errors.notFound('Endpoint');
      if (m.methodNotAllowed) throw new AppError('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
      const { route, params } = m;
      routeLabel = `${route.method} ${route.path}`;
      if (route.demoOnly && !config.demoMode) throw errors.notFound('Endpoint');

      const rl = limiter.take(`ip:${ip}`, route.rateCost || 1);
      if (!rl.ok) { res.setHeader('Retry-After', Math.ceil(rl.resetMs / 1000)); throw errors.tooMany(); }
      if (route.loginLimited && !limiter.take(`login:${ip}`, 1, config.rateLimit.loginMax).ok) {
        res.setHeader('Retry-After', 60);
        throw errors.tooMany('Too many sign-in attempts — wait a minute');
      }

      const rawBody = await readBody(req);
      const principal = await authenticate(req, route);
      if (route.perm) services.access.require(principal, route.perm);

      const query = route.query ? validate(Object.fromEntries(url.searchParams), route.query) : {};
      const body = route.body ? validate(rawBody || {}, route.body) : undefined;
      let idempotencyKey;
      if (route.idempotent) {
        idempotencyKey = String(req.headers['idempotency-key'] || '');
        if (!/^[\w-]{8,100}$/.test(idempotencyKey)) throw errors.validation('Idempotency-Key header (8–100 chars) is required');
      }

      const result = await route.handler({ c, req, params, query, body, principal, ip, requestId, idempotencyKey });
      send(res, 200, result === undefined ? { ok: true } : result);
    } catch (err) {
      const known = err instanceof AppError;
      status = known ? err.status : 500;
      if (!known) logger.error('unhandled error', { err, requestId, path: pathname });
      send(res, status, { error: { code: known ? err.code : 'INTERNAL_ERROR', message: known ? err.message : 'Unexpected error — quote the request id to support', details: known ? err.details : undefined, requestId } });
    } finally {
      status = res.statusCode || status;
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      metrics.observe('http_request_duration_seconds', { route: routeLabel, method: req.method }, seconds);
      metrics.inc('http_requests_total', { route: routeLabel, method: req.method, status });
      if (routeLabel !== 'health' && routeLabel !== 'metrics' && routeLabel !== 'static') {
        logger.info('request', { requestId, method: req.method, route: routeLabel, status, ms: Math.round(seconds * 1000) });
      }
    }
  }

  const server = http.createServer((req, res) => { handle(req, res); });
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;

  return {
    server,
    openapi,
    router,
    setReady(v) { ready = v; },
  };
}

module.exports = { createHttpApp };
