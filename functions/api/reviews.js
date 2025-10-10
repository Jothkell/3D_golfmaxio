export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors(url, request.headers.get('Origin') || '', env) });
  }
  const origin = request.headers.get('Origin') || '';
  const apiKey = env.GOOGLE_API_KEY;
  const PLACE_ID = url.searchParams.get('place_id') || (env.PLACE_ID || 'ChIJO8L3QtwU6YARnGKftpsMyfo');
  if (!apiKey || !PLACE_ID) {
    return json({ error: 'missing_config' }, 500, url, origin, env);
  }
  try{
    const g = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    g.searchParams.set('place_id', PLACE_ID);
    g.searchParams.set('fields', 'url,rating,user_ratings_total,reviews');
    g.searchParams.set('key', apiKey);
    const resp = await fetch(g.toString());
    if (!resp.ok) return json({ error: 'google_status_' + resp.status }, 502, url, origin, env);
    const payload = await resp.json();
    if (payload.status !== 'OK') return json({ error: payload.status }, 502, url, origin, env);
    const r = payload.result || {};
    const items = (r.reviews || [])
      .filter(x => (x.rating || 0) >= 4)
      .sort((a,b) => (b.time||0) - (a.time||0))
      .slice(0, 12);
    return new Response(JSON.stringify({
      reviews: items,
      url: r.url,
      rating: r.rating,
      user_ratings_total: r.user_ratings_total,
    }), { headers: { 'content-type': 'application/json; charset=utf-8', ...cors(url, origin, env) } });
  } catch (e) {
    return json({ error: 'exception', message: String(e) }, 500, url, origin, env);
  }
}

function json(obj, status, url, origin, env){
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', ...cors(url, origin, env) } });
}

function cors(url, requestOrigin, env){
  const o = (requestOrigin || '').toLowerCase();
  const headers = {
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin'
  };
  // Allow any preview subdomain under freegolffitting.pages.dev and localhost dev
  const allow = (
    o === 'https://freegolffitting.pages.dev' ||
    o.endsWith('.freegolffitting.pages.dev') ||
    o === 'http://localhost:8080' ||
    o === 'http://127.0.0.1:8080'
  );
  if (allow) headers['access-control-allow-origin'] = o;
  return headers;
}
