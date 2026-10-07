/** Thin fetch wrapper: JSON in/out, bearer token, request ids, typed errors. */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `HTTP ${status}`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
    this.requestId = body?.error?.requestId;
  }
}

export function createApi({ getToken, onUnauthenticated }) {
  async function request(method, path, body, headers = {}) {
    const h = { Accept: 'application/json', ...headers };
    const token = getToken?.();
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      if (res.status === 401 && onUnauthenticated) onUnauthenticated();
      throw new ApiError(res.status, data);
    }
    return data;
  }
  return {
    get: (p) => request('GET', p),
    post: (p, b, hdr) => request('POST', p, b ?? {}, hdr),
    put: (p, b) => request('PUT', p, b ?? {}),
    patch: (p, b) => request('PATCH', p, b ?? {}),
    del: (p) => request('DELETE', p),
  };
}

export const idempotencyKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
