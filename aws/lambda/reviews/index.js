// AWS Lambda: Google Reviews proxy
// Runtime: Node.js 20.x (global fetch available)
// Env vars: GOOGLE_API_KEY (required), PLACE_ID (optional default)

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '*')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const allowAll = ALLOWED_ORIGINS.includes('*');
const allowedOriginSet = allowAll
  ? new Set(['*'])
  : new Set(
      [
        'https://freegolffitting.pages.dev',
        'https://www.freegolffitting.pages.dev',
        'https://freegolffitting.com',
        'https://www.freegolffitting.com',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        ...ALLOWED_ORIGINS,
      ]
        .map(origin => origin.toLowerCase())
    );

// simple in-memory cache across warm invocations
// { [placeId]: { ts:number, body:string } }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = globalThis.__GM_REVIEWS_CACHE__ || (globalThis.__GM_REVIEWS_CACHE__ = {});

function getRequestOrigin(event) {
  const headers = event?.headers || {};
  return headers.origin || headers.Origin || '';
}

function resolveOrigin(requestOrigin) {
  if (allowAll) return '*';
  if (!requestOrigin) return '';
  const normalized = requestOrigin.toLowerCase();
  return allowedOriginSet.has(normalized) ? requestOrigin : '';
}

function baseHeaders(origin, cacheControl = 'no-store') {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': cacheControl,
    'Vary': 'Origin',
  };
  if (origin || allowAll) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  }
  return headers;
}

function errorResponse(statusCode, error, extra = {}, origin) {
  return {
    statusCode,
    headers: baseHeaders(origin),
    body: JSON.stringify({ error, ...extra }),
  };
}

const handler = async (event) => {
  const requestOrigin = getRequestOrigin(event);
  const allowOrigin = resolveOrigin(requestOrigin);

  if (event?.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...baseHeaders(allowOrigin), 'Content-Length': '0' },
      body: '',
    };
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return errorResponse(500, 'missing_config', {}, allowOrigin);
    }

    const qs = event.queryStringParameters || {};
    const placeId = qs.place_id || process.env.PLACE_ID;
    if (!placeId) {
      return errorResponse(400, 'missing_place_id', {}, allowOrigin);
    }

    // serve from cache if fresh
    const now = Date.now();
    const cached = cache[placeId];
    if (cached && (now - cached.ts) < CACHE_TTL_MS) {
      return {
        statusCode: 200,
        headers: baseHeaders(allowOrigin, 'public, max-age=300'),
        body: cached.body,
      };
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'url,reviews,rating,user_ratings_total');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      return errorResponse(502, `google_status_${res.status}`, {}, allowOrigin);
    }
    const payload = await res.json();

    if (payload.status !== 'OK') {
      return errorResponse(502, 'google_status', {
        status: payload.status,
        message: payload.error_message,
      }, allowOrigin);
    }

    const reviews = Array.isArray(payload.result?.reviews)
      ? payload.result.reviews
      : [];

    // Prefer recent positive reviews for banner
    const curated = reviews
      .filter(r => (r.rating || 0) >= 4)
      .sort((a,b) => (b.time || 0) - (a.time || 0))
      .slice(0, 12) // enough for grid + ticker
      .map(r => ({
        author_name: r.author_name,
        profile_photo_url: r.profile_photo_url,
        rating: r.rating,
        text: r.text,
        relative_time_description: r.relative_time_description,
      }));

    const body = JSON.stringify({
      url: payload.result?.url,
      rating: payload.result?.rating,
      user_ratings_total: payload.result?.user_ratings_total,
      reviews: curated,
    });

    // store in cache
    cache[placeId] = { ts: now, body };

    return {
      statusCode: 200,
      headers: baseHeaders(allowOrigin, 'public, max-age=300'),
      body,
    };
  } catch (err) {
    return errorResponse(500, err?.message || 'server_error', {}, allowOrigin);
  }
};

exports.handler = handler;
