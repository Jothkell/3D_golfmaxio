// Frontend configuration for Google Reviews integration
// Edit the placeholders below and keep this file out of version control if it will contain secrets
// (Note: API keys must NOT be embedded here; use the backend/worker for secrets.)

window.GM_PLACE_ID = window.GM_PLACE_ID || "YOUR_GOOGLE_PLACE_ID";
// Example: https://your-worker-subdomain.workers.dev/api/reviews
window.GM_REVIEWS_ENDPOINT = window.GM_REVIEWS_ENDPOINT || "https://<your-worker>.workers.dev/api/reviews";
// Optional direct link to your listing
window.GM_GOOGLE_URL = window.GM_GOOGLE_URL || "https://maps.google.com/?cid=YOUR_CID";

