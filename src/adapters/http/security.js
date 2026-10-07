'use strict';

/**
 * HTTP security controls (OWASP ASVS V14 / Top 10 A05): strict headers and
 * CSP, CORS allow-list, token-bucket rate limiting.
 */

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

function securityHeaders(res, { production }) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (production) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.removeHeader('X-Powered-By');
}

function cors(req, res, allowed) {
  const origin = req.headers.origin;
  if (!origin) return true;
  // Same-origin requests (module scripts, fetch) also carry Origin — always allowed.
  let sameOrigin = false;
  try { sameOrigin = new URL(origin).host === req.headers.host; } catch { sameOrigin = false; }
  if (sameOrigin) return true;
  if (!allowed.includes(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Api-Key, X-Request-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

/** In-process token bucket. Behind several replicas, enforce at the gateway/WAF too (see deployment docs). */
function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  return {
    take(key, cost = 1, limit = max) {
      const now = Date.now();
      let b = buckets.get(key);
      if (!b || now - b.start > windowMs) { b = { start: now, used: 0 }; buckets.set(key, b); }
      b.used += cost;
      if (buckets.size > 50000) for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k);
      return { ok: b.used <= limit, remaining: Math.max(0, limit - b.used), resetMs: windowMs - (now - b.start) };
    },
  };
}

module.exports = { securityHeaders, cors, createRateLimiter, CSP };
