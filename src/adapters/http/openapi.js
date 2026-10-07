'use strict';

/**
 * OpenAPI 3.1 document generated from the route table (single source of truth).
 * `npm run job -- openapi` writes docs/api/openapi.json for API consumers.
 */

function schemaFor(rule) {
  if (!rule) return {};
  const base = {};
  switch (rule.type) {
    case 'string': Object.assign(base, { type: 'string', maxLength: rule.max ?? 1000 }); if (rule.enum) base.enum = rule.enum; if (rule.pattern) base.pattern = rule.pattern.source; break;
    case 'integer': case 'number': Object.assign(base, { type: rule.type }); if (rule.min !== undefined) base.minimum = rule.min; if (rule.max !== undefined) base.maximum = rule.max; break;
    case 'boolean': base.type = 'boolean'; break;
    case 'date': Object.assign(base, { type: 'string', format: 'date' }); break;
    case 'array': Object.assign(base, { type: 'array', items: schemaFor(rule.items) }); if (rule.max) base.maxItems = rule.max; break;
    case 'object': Object.assign(base, rule.schema ? objectSchema(rule.schema) : { type: 'object' }); break;
    default: break;
  }
  return base;
}

function objectSchema(schema) {
  const properties = {};
  const required = [];
  for (const [k, r] of Object.entries(schema)) {
    properties[k] = schemaFor(r);
    if (r.required) required.push(k);
  }
  return { type: 'object', additionalProperties: false, properties, ...(required.length ? { required } : {}) };
}

function buildOpenApi(routes, { version, serverUrl }) {
  const paths = {};
  for (const r of routes) {
    const p = r.path.replace(/:(\w+)/g, '{$1}');
    paths[p] = paths[p] || {};
    const params = (r.keys || []).map((k) => ({ name: k, in: 'path', required: true, schema: { type: 'string' } }));
    for (const [k, q] of Object.entries(r.query || {})) params.push({ name: k, in: 'query', required: false, schema: schemaFor(q) });
    if (r.idempotent) params.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', maxLength: 100 } });
    const security = r.auth === 'public' ? [] : r.auth === 'partner' ? [{ partnerApiKey: [] }] : [{ bearerAuth: [] }];
    paths[p][r.method.toLowerCase()] = {
      tags: [r.tag || 'Other'],
      summary: r.summary,
      operationId: `${r.method.toLowerCase()}${p.replace(/[{}]/g, '').split('/').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('').replace(/[^A-Za-z0-9]/g, '')}`,
      ...(r.perm ? { 'x-permission': r.perm } : {}),
      'x-audience': r.auth,
      security,
      parameters: params,
      ...(r.body ? { requestBody: { required: true, content: { 'application/json': { schema: objectSchema(r.body) } } } } : {}),
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } },
        400: { $ref: '#/components/responses/Error' },
        401: { $ref: '#/components/responses/Error' },
        403: { $ref: '#/components/responses/Error' },
        404: { $ref: '#/components/responses/Error' },
        409: { $ref: '#/components/responses/Error' },
        422: { $ref: '#/components/responses/Error' },
        429: { $ref: '#/components/responses/Error' },
        503: { $ref: '#/components/responses/Error' },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'TASCO Growth Platform API',
      version,
      description: 'Motor insurance growth platform for TASCO Insurance × VETC: data enrichment, lead scoring, journeys, voice bot, sales, partners, claims FNOL, rules governance. Built by iorta TechNXT.',
      contact: { name: 'iorta TechNXT', url: 'https://www.iortatechnxt.com' },
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        partnerApiKey: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
      },
      responses: {
        Error: {
          description: 'Error',
          content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {}, requestId: { type: 'string' } } } } } } },
        },
      },
    },
    paths,
  };
}

module.exports = { buildOpenApi };
