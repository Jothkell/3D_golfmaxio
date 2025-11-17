import { handleUploadRequest } from '../../shared/upload-handler.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: cors(url, origin, env, true),
    });
  }

  const headers = cors(url, origin, env);
  return handleUploadRequest(request, env, { corsHeaders: headers });
}

function cors(url, requestOrigin, env, preflight = false) {
  const headers = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin',
  };
  const origin = (requestOrigin || '').toLowerCase();
  const allow = allowOrigin(origin, env);
  if (allow) headers['access-control-allow-origin'] = allow;
  if (preflight) headers['access-control-max-age'] = '86400';
  return headers;
}

function allowOrigin(origin, env) {
  if (!origin) return '';
  const defaults = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'https://freegolffitting.pages.dev',
    'https://www.freegolffitting.pages.dev',
    'https://freegolffitting.com',
    'https://www.freegolffitting.com',
  ];
  const extra = (env && env.ALLOWED_ORIGINS) ? String(env.ALLOWED_ORIGINS).split(',').map(s => s.trim()).filter(Boolean) : [];
  if (extra.includes('*')) return '*';
  const allowSet = new Set(defaults.map(v => v.toLowerCase()));
  for (const value of extra) allowSet.add(value.toLowerCase());
  return allowSet.has(origin.toLowerCase()) ? origin : '';
}
