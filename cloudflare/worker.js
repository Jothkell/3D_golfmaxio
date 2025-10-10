export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(url, origin, env) });
    }
    if (url.pathname !== '/' && !url.pathname.endsWith('/api/reviews') && url.pathname !== '/api/reviews') {
      return new Response('Not found', { status: 404, headers: corsHeaders(url, origin, env) });
    }

    // Lightweight mock mode for local dev: proxies local mock JSON
    if (env && String(env.USE_MOCK) === '1') {
      try {
        const mockUrl = new URL('http://127.0.0.1:8080/mock-reviews.json');
        const r = await fetch(mockUrl.toString());
        const data = await r.json();
        const body = JSON.stringify({
          reviews: Array.isArray(data.reviews) ? data.reviews : [],
          url: data.url || '#',
          rating: data.rating,
          user_ratings_total: data.user_ratings_total
        });
        return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(url, origin, env) } });
      } catch (e) {
        return json({ error: 'mock_fail', message: String(e) }, 500, url, origin, env);
      }
    }

    const placeId = url.searchParams.get('place_id') || env.PLACE_ID;
    const apiKey = env.GOOGLE_API_KEY;
    if (!apiKey || !placeId) {
      return json({ error: 'Missing GOOGLE_API_KEY or PLACE_ID' }, 500, url, origin, env);
    }

    const google = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    google.searchParams.set('place_id', placeId);
    google.searchParams.set('fields', 'name,url,rating,user_ratings_total,reviews');
    google.searchParams.set('key', apiKey);

    // Edge caching: 12 hours
    const cacheKey = new Request(google.toString(), { method: 'GET' });
    const cache = caches.default;
    let cached = await cache.match(cacheKey);
    if (cached) {
      return mirrorWithCors(cached, url, origin, env);
    }

    const resp = await fetch(google.toString());
    const data = await resp.json();

    const result = data?.result || {};
    const all = (result?.reviews || []);
    const reviews = all
      .filter(r => (r.rating || 0) >= 4)
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .slice(0, 12);
    const body = JSON.stringify({
      reviews,
      url: result?.url,
      rating: result?.rating,
      user_ratings_total: result?.user_ratings_total
    });
    const out = new Response(body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=43200',
        ...corsHeaders(url, origin, env),
      }
    });
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  }
}

function json(obj, status, url, origin, env) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(url, origin, env) },
  });
}

function parseAllowedOrigins(env) {
  const fromEnv = (env && env.ALLOWED_ORIGINS) ? String(env.ALLOWED_ORIGINS) : '';
  const list = fromEnv.split(',').map(s => s.trim()).filter(Boolean);
  // Always allow common local dev origins
  const dev = ['http://localhost:8000', 'http://127.0.0.1:8000'];
  for (const d of dev) if (!list.includes(d)) list.push(d);
  return list;
}

function corsHeaders(url, requestOrigin, env) {
  const allowed = parseAllowedOrigins(env);
  const origin = (requestOrigin || '').toLowerCase();
  const allowOrigin = allowed.includes(origin) ? origin : '';
  const base = {
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin',
  };
  if (allowOrigin) {
    return { ...base, 'access-control-allow-origin': allowOrigin };
  }
  // If no match, do not reflect unknown origins; omit A-C-A-O header
  return base;
}

function mirrorWithCors(response, url, origin, env) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(url, origin, env);
  for (const [k, v] of Object.entries(cors)) {
    headers.set(k, v);
  }
  return new Response(response.body, { status: response.status, headers });
}
