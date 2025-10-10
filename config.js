// Frontend configuration for Google Reviews integration
// Edit the placeholders below and keep this file out of version control if it will contain secrets
// (Note: API keys must NOT be embedded here; use the backend/worker for secrets.)

// Leave null by default and set PLACE_ID in the Worker (or override here)
window.GM_PLACE_ID = (typeof window.GM_PLACE_ID !== 'undefined') ? window.GM_PLACE_ID : null;
// In production, prefer same-origin routing to a bound Worker (e.g., /api/reviews)
window.GM_REVIEWS_ENDPOINT = window.GM_REVIEWS_ENDPOINT || "/api/reviews";
// Optional direct link to your listing
window.GM_GOOGLE_URL = window.GM_GOOGLE_URL || "https://maps.google.com/?cid=YOUR_CID";

// Speed up local file previews: when opened via file://, avoid network
// Allow dynamic overrides from an optional JSON file served at /aws/config.json
// Example payload: { "REVIEWS_ENDPOINT": "https://.../api/reviews", "PLACE_ID": "...", "GOOGLE_URL": "..." }
window.GM_CONFIG_READY = (async () => {
  try {
    const res = await fetch('/aws/config.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.REVIEWS_ENDPOINT) window.GM_REVIEWS_ENDPOINT = data.REVIEWS_ENDPOINT;
      if (data.PLACE_ID) window.GM_PLACE_ID = data.PLACE_ID;
      if (data.GOOGLE_URL) window.GM_GOOGLE_URL = data.GOOGLE_URL;
    }
  } catch {}
})();

try {
  if (location && location.protocol === 'file:') {
    // Use local mock data and disable remote lookups
    window.GM_REVIEWS_ENDPOINT = 'mock-reviews.json';
    window.GM_PLACE_ID = null; // prevents direct Google fetch
    window.GM_GOOGLE_URL = '#';
  }
  // Local dev server override: if served from localhost/127.* use local Worker
  if (location && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    // Wrangler dev default port is 8787
    window.GM_REVIEWS_ENDPOINT = window.GM_REVIEWS_ENDPOINT || 'http://127.0.0.1:8787/api/reviews';
  }
  // Cloudflare Pages preview: allow calling the production Worker via CORS
  if (location && location.hostname.endsWith('.pages.dev')) {
    // Use same-origin Pages Function on previews
    window.GM_REVIEWS_ENDPOINT = '/api/reviews';
  }
  // If we have a Place ID, set a reliable Google listing URL via query_place_id
  if (window.GM_PLACE_ID) {
    window.GM_GOOGLE_URL = 'https://www.google.com/maps/search/?api=1&query_place_id=' + encodeURIComponent(window.GM_PLACE_ID);
  }
} catch {}
