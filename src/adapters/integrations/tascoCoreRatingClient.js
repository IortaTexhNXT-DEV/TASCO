'use strict';

const crypto = require('crypto');
const { AppError, errors } = require('../../shared/errors');
const { createCircuitBreaker, tagged } = require('../../shared/resilience');
const { validate } = require('../../shared/validation');

/**
 * Real adapter for the TASCO core (policy administration) REST API, implementing
 * two ports:
 *
 *   CoreRating.quote(request)        POST {base}/rating/v1/quotes
 *   ProductCatalogue.fetchCatalogue() GET {base}/products/v1/catalogue
 *
 * TASCO core is the system of record for products and premiums; the platform
 * never prices a bindable quote itself when RATING_SOURCE=core*.
 *
 * Security / transport
 *  - OAuth2 client-credentials (RFC 6749 §4.4, client_secret_basic). The bearer
 *    token is cached until shortly before `expires_in` and shared by concurrent
 *    callers; a 401 drops the cached token so the retry fetches a fresh one.
 *  - mTLS-ready: pass `dispatcher` (an undici `Agent` built with
 *    `connect: { cert, key, ca }`) and it is handed to `fetch` on every call.
 *    In Kubernetes the usual alternative is mTLS origination at the egress proxy
 *    / service mesh (deploy/k8s/50-networkpolicy.yaml routes core traffic via
 *    the egress proxy), in which case no dispatcher is needed.
 *  - Every rating call carries `Idempotency-Key` (so a retried request cannot
 *    create two core quotes) and `X-Request-Id` for cross-system tracing.
 *  - Rating requests carry risk attributes only (vehicle category, usage, seats,
 *    age; holder type) — no plate, name or phone. Identity is sent to core only at
 *    binding (issuePolicy), with the coreQuoteRef. Nothing customer-identifying is
 *    logged; core error messages are never echoed (they may contain input data).
 *
 * Resilience: per-attempt timeout (AbortController), retry with backoff and a
 * circuit breaker per capability (src/shared/resilience.js). Business errors from
 * core (4xx) are mapped to platform errors and are neither retried nor counted
 * towards opening the circuit.
 *
 * Responses are schema-validated (tolerant reader: unknown fields are ignored,
 * missing/ill-typed required fields are a contract violation → 503).
 */

const KNOWN_RATING_METHODS = ['tariff_table', 'rate_on_sum_insured', 'per_seat'];

const TOKEN_RESPONSE = {
  access_token: { type: 'string', required: true, max: 8192 },
  token_type: { type: 'string', max: 40 },
  expires_in: { type: 'integer', required: true, min: 1, max: 86400 * 7 },
  scope: { type: 'string', max: 1000 },
};

const REF = { type: 'string', max: 100, pattern: /^[A-Za-z0-9_\-:./@]+$/ };
const MONEY = { type: 'integer', min: 0, max: 1e13, required: true };

const QUOTE_RESPONSE = {
  quoteRef: { ...REF, required: true },
  ratingVersion: { type: 'string', max: 100, required: true },
  validUntil: { type: 'string', max: 40, required: true },
  currency: { type: 'string', enum: ['VND'] },
  lines: {
    type: 'array', required: true, max: 20,
    items: {
      type: 'object',
      schema: {
        productCode: { type: 'string', max: 40, required: true, pattern: /^[A-Z][A-Z0-9_]+$/ },
        premiumNet: MONEY,
        vat: MONEY,
        total: MONEY,
        startDate: { type: 'date', required: true },
        endDate: { type: 'date', required: true },
        termDays: { type: 'integer', min: 1, max: 3700 },
        lineRef: REF,
        breakdown: { type: 'array', max: 50, items: { type: 'object' } },
      },
    },
  },
};

const CATALOGUE_RESPONSE = {
  catalogueVersion: { type: 'string', max: 100, required: true },
  publishedAt: { type: 'string', max: 40 },
  products: {
    type: 'array', required: true, max: 500,
    items: {
      type: 'object',
      schema: {
        code: { type: 'string', max: 40, required: true, pattern: /^[A-Z][A-Z0-9_]{1,40}$/ },
        version: { type: 'string', max: 60, required: true },
        name: { type: 'string', max: 200, required: true },
        nameVi: { type: 'string', max: 200 },
        line: { type: 'string', max: 40 },
        compulsory: { type: 'boolean' },
        priceRegulated: { type: 'boolean' },
        requiresInspection: { type: 'boolean' },
        status: { type: 'string', enum: ['active', 'inactive', 'withdrawn'], required: true },
        ratingMethod: { type: 'string', max: 60 },
        effectiveFrom: { type: 'date' },
      },
    },
  },
};

/** Core error code → platform error. Unknown codes fall back to the HTTP status. */
const CORE_ERRORS = {
  VALIDATION_ERROR: () => errors.validation('TASCO core rejected the rating request as invalid'),
  INVALID_REQUEST: () => errors.validation('TASCO core rejected the rating request as invalid'),
  UNKNOWN_VEHICLE_CATEGORY: () => errors.validation('Vehicle category is not recognised by TASCO core'),
  UNDERWRITING_DECLINED: () => errors.rule('TASCO core declined to quote this risk online'),
  OUTSIDE_APPETITE: () => errors.rule('TASCO core declined to quote this risk online'),
  REFER_TO_UNDERWRITER: () => errors.rule('This risk must be referred to a TASCO underwriter'),
  SUM_INSURED_LIMIT: () => errors.rule('Sum insured exceeds the online limit — refer to underwriter'),
  PRODUCT_NOT_FOUND: () => errors.rule('Product is not available in TASCO core'),
  PRODUCT_NOT_AVAILABLE: () => errors.rule('Product is not available in TASCO core'),
  PRODUCT_INACTIVE: () => errors.rule('Product is not on sale in TASCO core'),
  QUOTE_EXPIRED: () => errors.rule('TASCO core quote expired — please re-quote'),
  DUPLICATE_REQUEST: () => errors.conflict('TASCO core is already processing this request'),
  IDEMPOTENCY_CONFLICT: () => errors.conflict('TASCO core is already processing this request'),
};

function mapCoreError(status, body) {
  const raw = body && typeof body === 'object' ? (body.error?.code ?? body.code ?? '') : '';
  const coreCode = String(raw).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 64) || null;
  const details = { coreStatus: status, coreCode };
  let err;
  if (coreCode && CORE_ERRORS[coreCode]) err = CORE_ERRORS[coreCode]();
  else if (status === 400) err = errors.validation('TASCO core rejected the rating request as invalid');
  else if (status === 404 || status === 422) err = errors.rule('TASCO core could not quote this request');
  else if (status === 409) err = errors.conflict('TASCO core is already processing this request');
  else if (status === 401 || status === 403) err = tagged(errors.upstream('TASCO core authentication failed'), 'auth');
  else if (status === 429) err = tagged(errors.upstream('TASCO core is throttling requests'), 'throttled');
  else err = tagged(errors.upstream(`TASCO core error (HTTP ${status})`), 'unavailable');
  err.details = { ...(err.details || {}), ...details };
  return err;
}

function badResponse(what, problems) {
  const e = new AppError('UPSTREAM_UNAVAILABLE', `TASCO core returned an invalid ${what}`, 503, { problems: (problems || []).slice(0, 10) });
  return tagged(e, 'bad_response');
}

function createTascoCoreRatingClient({
  baseUrl, tokenUrl, clientId, clientSecret, scope, timeoutMs = 5000,
  fetchImpl = globalThis.fetch, dispatcher, logger, metrics,
  retries = 2, baseDelayMs = 200, failureThreshold = 5, resetMs = 30000, now = Date.now,
} = {}) {
  if (!baseUrl) throw new Error('TASCO core baseUrl is required');
  const base = baseUrl.replace(/\/+$/, '');
  const tokenEndpoint = tokenUrl || `${base}/oauth2/token`;
  // One attempt = (maybe) token fetch + API call, each bounded by timeoutMs.
  const attemptBudget = timeoutMs * 2 + 250;
  const breakers = {
    rating: createCircuitBreaker({ name: 'tasco-core-rating', timeoutMs: attemptBudget, retries, baseDelayMs, failureThreshold, resetMs, metrics, logger }),
    catalogue: createCircuitBreaker({ name: 'tasco-core-catalogue', timeoutMs: attemptBudget, retries, baseDelayMs, failureThreshold, resetMs, metrics, logger }),
  };

  let token = null; // { value, expiresAt }
  let tokenInflight = null;

  /** fetch with a hard per-call timeout; network failures become tagged upstream errors. */
  async function httpCall(url, init, op) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = now();
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal, ...(dispatcher ? { dispatcher } : {}) });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      metrics?.observe?.('integration_latency_seconds', { integration: 'tasco-core', op }, (now() - started) / 1000);
      return { status: res.status, ok: res.ok, json };
    } catch (e) {
      if (e?.name === 'AbortError' || controller.signal.aborted) throw tagged(errors.upstream(`TASCO core ${op} timed out after ${timeoutMs}ms`), 'timeout');
      if (e instanceof AppError) throw e;
      // Network-level failure (DNS, refused, TLS). Only the error class is logged.
      logger?.warn('tasco core unreachable', { op, error: e?.cause?.code || e?.name || 'error' });
      throw tagged(errors.upstream('TASCO core unreachable'), 'unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchToken() {
    const form = new URLSearchParams({ grant_type: 'client_credentials' });
    if (scope) form.set('scope', scope);
    const basic = Buffer.from(`${encodeURIComponent(clientId || '')}:${encodeURIComponent(clientSecret || '')}`).toString('base64');
    const res = await httpCall(tokenEndpoint, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form.toString(),
    }, 'token');
    if (!res.ok) {
      logger?.error('tasco core token request failed', { status: res.status });
      throw tagged(new AppError('UPSTREAM_UNAVAILABLE', 'TASCO core authentication failed', 503, { coreStatus: res.status }), 'auth');
    }
    let t;
    try { t = validate(res.json, TOKEN_RESPONSE, { allowUnknown: true }); } catch (e) { throw badResponse('token response', e.details); }
    if (t.token_type && t.token_type.toLowerCase() !== 'bearer') throw badResponse('token response', ['token_type must be Bearer']);
    // Refresh a minute early (or halfway through very short-lived tokens).
    const skewMs = Math.min(60000, (t.expires_in * 1000) / 2);
    token = { value: t.access_token, expiresAt: now() + t.expires_in * 1000 - skewMs };
    metrics?.inc('tasco_core_token_fetch_total');
    return token.value;
  }

  async function accessToken() {
    if (token && token.expiresAt > now()) return token.value;
    if (!tokenInflight) tokenInflight = fetchToken().finally(() => { tokenInflight = null; });
    return tokenInflight;
  }

  async function call(breaker, op, method, path, { body, idempotencyKey, requestId } = {}) {
    return breaker.exec(async () => {
      const bearer = await accessToken();
      const headers = { Authorization: `Bearer ${bearer}`, Accept: 'application/json', 'X-Request-Id': requestId || crypto.randomUUID() };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      const res = await httpCall(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, op);
      if (res.status === 401) token = null; // force a fresh token on the retry
      if (!res.ok) {
        const err = mapCoreError(res.status, res.json);
        logger?.warn('tasco core call failed', { op, status: res.status, coreCode: err.details.coreCode, requestId: headers['X-Request-Id'] });
        throw err;
      }
      return res.json;
    });
  }

  const client = {
    name: 'tasco-core-http',
    mode: 'http',
    endpoint: (() => { try { return new URL(base).host; } catch { return null; } })(),

    /**
     * Port CoreRating.quote
     * @param req { idempotencyKey, requestId, channel, partnerId, quoteDate, startDate, termYears,
     *              holder: { type }, vehicle: { category, usage, seats, firstRegisteredYear },
     *              lines: [{ product, options }] }
     * @returns { coreQuoteRef, ratingVersion, validUntil, lines: [{ product, premiumNet, vat, total,
     *            startDate, endDate, termDays, ratingRef, breakdown }] }
     */
    async quote(req) {
      const body = {
        channel: req.channel,
        partnerRef: req.partnerId || undefined,
        quoteDate: req.quoteDate,
        startDate: req.startDate,
        termYears: req.termYears || 1,
        holder: { type: req.holder?.type || 'individual' },
        vehicle: {
          category: req.vehicle?.category,
          usage: req.vehicle?.usage,
          seats: req.vehicle?.seats,
          firstRegisteredYear: req.vehicle?.firstRegisteredYear,
        },
        lines: req.lines.map((l) => ({ productCode: l.product, ...(l.options || {}) })),
      };
      const raw = await call(breakers.rating, 'quote', 'POST', '/rating/v1/quotes', { body, idempotencyKey: req.idempotencyKey, requestId: req.requestId });
      let r;
      try { r = validate(raw, QUOTE_RESPONSE, { allowUnknown: true }); } catch (e) { throw badResponse('rating response', e.details); }
      const problems = [];
      if (Number.isNaN(Date.parse(r.validUntil))) problems.push('validUntil must be an ISO timestamp');
      const wanted = req.lines.map((l) => l.product).sort();
      const got = r.lines.map((l) => l.productCode).sort();
      if (JSON.stringify(wanted) !== JSON.stringify(got)) problems.push('lines do not match the requested products');
      for (const l of r.lines) if (l.total !== l.premiumNet + l.vat) problems.push(`${l.productCode}: total ≠ premiumNet + vat`);
      if (problems.length) throw badResponse('rating response', problems);
      metrics?.inc('tasco_core_quotes_total');
      return {
        coreQuoteRef: r.quoteRef,
        ratingVersion: r.ratingVersion,
        validUntil: new Date(r.validUntil).toISOString(),
        lines: req.lines.map((want) => {
          const l = r.lines.find((x) => x.productCode === want.product);
          return { product: l.productCode, premiumNet: l.premiumNet, vat: l.vat, total: l.total, startDate: l.startDate, endDate: l.endDate, termDays: l.termDays, ratingRef: l.lineRef || null, breakdown: l.breakdown || [] };
        }),
      };
    },

    /**
     * Port ProductCatalogue.fetchCatalogue
     * @returns { catalogueVersion, publishedAt, products: [{ code, version, name, nameVi, line, compulsory,
     *            priceRegulated, requiresInspection, status, ratingMethod, effectiveFrom }] }
     */
    async fetchCatalogue() {
      const raw = await call(breakers.catalogue, 'catalogue', 'GET', '/products/v1/catalogue');
      let r;
      try { r = validate(raw, CATALOGUE_RESPONSE, { allowUnknown: true }); } catch (e) { throw badResponse('product catalogue', e.details); }
      const codes = new Set();
      for (const p of r.products) {
        if (codes.has(p.code)) throw badResponse('product catalogue', [`duplicate product ${p.code}`]);
        codes.add(p.code);
      }
      return r;
    },

    circuit: { rating: () => breakers.rating.state(), catalogue: () => breakers.catalogue.state() },
    /** Test / ops hook: forget the cached bearer token. */
    resetToken() { token = null; },
  };
  return client;
}

module.exports = { createTascoCoreRatingClient, mapCoreError, KNOWN_RATING_METHODS };
