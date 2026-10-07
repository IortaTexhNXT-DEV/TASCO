'use strict';

/**
 * Tiny, dependency-free router. Routes are data (method, path, auth, permission,
 * schemas, handler), so the same table drives request handling, authorisation
 * and the generated OpenAPI document — the contract can never drift from code.
 */

function compile(path) {
  const keys = [];
  const re = new RegExp(`^${path.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  return { re, keys };
}

function createRouter(routes) {
  const compiled = routes.map((r) => ({ ...r, ...compile(r.path) }));
  return {
    routes: compiled,
    match(method, pathname) {
      let pathMatched = false;
      for (const r of compiled) {
        const m = r.re.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== method) continue;
        const params = {};
        try {
          r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        } catch {
          return { badRequest: true };
        }
        return { route: r, params };
      }
      return pathMatched ? { methodNotAllowed: true } : null;
    },
  };
}

module.exports = { createRouter };
