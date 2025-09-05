Cloudflare Worker: Google Reviews Proxy

What this does
- Proxies the Google Places Details API to return a small JSON payload: { reviews:[…], url }
- Filters to highly-rated recent reviews; caches at the edge for 12 hours
- Adds CORS so your static site can fetch from the worker

Quick start
1) Install Wrangler (CLI):
   npm install -g wrangler

2) Authenticate:
   wrangler login

3) Create a new Worker project directory (or use this one) and publish:
   wrangler init --yes   # if you don’t already have a CF project

4) Set secrets and vars:
   wrangler secret put GOOGLE_API_KEY
   wrangler kv:namespace create REVIEWS_CACHE   # optional, not required for built-in caches.default

5) Set your place ID (plain env var is fine):
   wrangler vars set PLACE_ID="YOUR_GOOGLE_PLACE_ID"

6) Publish from this folder:
   wrangler deploy cloudflare/worker.js --name golfmax-reviews

7) Note the Worker URL (e.g., https://golfmax-reviews.your-subdomain.workers.dev/api/reviews)

8) Update config.js in the web root:
   window.GM_PLACE_ID = "YOUR_GOOGLE_PLACE_ID";
   window.GM_REVIEWS_ENDPOINT = "https://golfmax-reviews.your-subdomain.workers.dev/api/reviews";

9) Test locally:
   Open your site and check that the “WHAT CLIENTS SAY” section loads cards.
   Network tab should show a successful call to your Worker endpoint.

Finding your Place ID
- Use the Place ID Finder in Google Maps Platform docs, or call Find Place:
  https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Your%20Business%20Name&inputtype=textquery&fields=place_id&key=YOUR_KEY

Notes
- Do not embed your API key in the frontend. Keep it as a Worker secret.
- The Worker caches for 12 hours; you can purge by changing the URL (e.g., add ?t=timestamp) or by publishing a new version.
