export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(url) });
    }
    if (url.pathname !== '/' && !url.pathname.endsWith('/api/reviews') && url.pathname !== '/api/reviews') {
      return new Response('Not found', { status: 404, headers: corsHeaders(url) });
    }

    const placeId = url.searchParams.get('place_id') || env.PLACE_ID;
    const apiKey = env.GOOGLE_API_KEY;
    if (!apiKey || !placeId) {
      return json({ error: 'Missing GOOGLE_API_KEY or PLACE_ID' }, 500, url);
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
      return mirrorWithCors(cached, url);
    }

    const resp = await fetch(google.toString());
    const data = await resp.json();

    const all = (data?.result?.reviews || []);
    const reviews = all
      .filter(r => (r.rating || 0) >= 4)
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .slice(0, 12);
    const body = JSON.stringify({ reviews, url: data?.result?.url });
    const out = new Response(body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=43200',
        ...corsHeaders(url),
      }
    });
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  }
}

function json(obj, status, url) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(url) },
  });
}

function corsHeaders(url) {
  const origin = url?.origin || '*';
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function mirrorWithCors(response, url) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(url);
  headers.set('access-control-allow-origin', cors['access-control-allow-origin']);
  headers.set('access-control-allow-methods', cors['access-control-allow-methods']);
  headers.set('access-control-allow-headers', cors['access-control-allow-headers']);
  return new Response(response.body, { status: response.status, headers });
}

