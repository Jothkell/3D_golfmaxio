export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // CORS
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = cors(url, origin, env, request.method === 'OPTIONS');
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const apiKey = env.GOOGLE_API_KEY;
  const PLACE_ID = url.searchParams.get('place_id') || (env.PLACE_ID || 'ChIJO8L3QtwU6YARnGKftpsMyfo');
  if (!apiKey || !PLACE_ID) {
    return json({ error: 'missing_config' }, 500, corsHeaders);
  }
  try{
    const g = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    g.searchParams.set('place_id', PLACE_ID);
    g.searchParams.set('fields', 'url,rating,user_ratings_total,reviews');
    g.searchParams.set('key', apiKey);
    const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
    const cacheKey = cache ? new Request(g.toString(), { method: 'GET' }) : null;
    if (cache && cacheKey) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return withCors(cached, corsHeaders);
      }
    }
    const resp = await fetch(g.toString());
    if (!resp.ok) return json({ error: 'google_status_' + resp.status }, 502, corsHeaders);
    const payload = await resp.json();
    if (payload.status !== 'OK') return json({ error: payload.status, message: payload?.error_message }, 502, corsHeaders);
    const r = payload.result || {};
    const items = (r.reviews || [])
      .filter(x => (x.rating || 0) >= 4)
      .sort((a,b) => (b.time||0) - (a.time||0))
      .slice(0, 12);
    const body = JSON.stringify({
      reviews: items,
      url: r.url,
      rating: r.rating,
      user_ratings_total: r.user_ratings_total,
    });
    const baseHeaders = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=43200',
    };
    const response = new Response(body, { headers: { ...baseHeaders, ...corsHeaders } });
    if (cache && cacheKey) {
      const cacheResponse = new Response(body, { headers: baseHeaders });
      try {
        context?.waitUntil?.(cache.put(cacheKey, cacheResponse));
      } catch {}
    }
    return response;
  } catch (e) {
    return json({ error: 'exception', message: String(e) }, 500, corsHeaders);
  }
}

function json(obj, status, corsHeaders){
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders } });
}

function cors(url, requestOrigin, env, preflight = false){
  const origin = (requestOrigin || '').trim();
  const headers = {
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin'
  };
  if (preflight) headers['access-control-max-age'] = '86400';
  const allowed = parseAllowedOrigins(env);
  if (allowed.includes('*')) {
    headers['access-control-allow-origin'] = '*';
    return headers;
  }
  const normalized = origin.toLowerCase();
  if (origin && allowed.includes(normalized)) {
    headers['access-control-allow-origin'] = origin;
  }
  return headers;
}

function parseAllowedOrigins(env) {
  const defaults = [
    'https://freegolffitting.pages.dev',
    'https://www.freegolffitting.pages.dev',
    'https://freegolffitting.com',
    'https://www.freegolffitting.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];
  const extraRaw = (env && env.ALLOWED_ORIGINS) ? String(env.ALLOWED_ORIGINS) : '';
  const extras = extraRaw.split(',').map(s => s.trim()).filter(Boolean);
  const combined = new Set(defaults.map(s => s.toLowerCase()));
  extras.forEach((value) => {
    if (value === '*') {
      combined.clear();
      combined.add('*');
    } else {
      combined.add(value.toLowerCase());
    }
  });
  return Array.from(combined);
}

function withCors(response, corsHeaders) {
  const res = response.clone();
  const headers = new Headers(res.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value !== undefined) headers.set(key, value);
  });
  return new Response(res.body, { status: res.status, headers });
}
