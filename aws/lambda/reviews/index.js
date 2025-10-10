// AWS Lambda: Google Reviews proxy
// Runtime: Node.js 20.x (global fetch available)
// Env vars: GOOGLE_API_KEY (required), PLACE_ID (optional default)

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// simple in-memory cache across warm invocations
// { [placeId]: { ts:number, body:string } }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = globalThis.__GM_REVIEWS_CACHE__ || (globalThis.__GM_REVIEWS_CACHE__ = {});

export const handler = async (event) => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Missing GOOGLE_API_KEY');

    const qs = event.queryStringParameters || {};
    const placeId = qs.place_id || process.env.PLACE_ID;
    if (!placeId) throw new Error('Missing place_id');

    // serve from cache if fresh
    const now = Date.now();
    const cached = cache[placeId];
    if (cached && (now - cached.ts) < CACHE_TTL_MS) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
        },
        body: cached.body,
      };
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'url,reviews,rating,user_ratings_total');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`Upstream status ${res.status}`);
    const payload = await res.json();

    if (payload.status !== 'OK') {
      throw new Error(`Google API error: ${payload.status}`);
    }

    const reviews = Array.isArray(payload.result?.reviews)
      ? payload.result.reviews
      : [];

    // Prefer recent positive reviews for banner
    const curated = reviews
      .filter(r => (r.rating || 5) >= 4)
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
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
      body,
    };
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: err.message || 'Bad Request' }),
    };
  }
};
