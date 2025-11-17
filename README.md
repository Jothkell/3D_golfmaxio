# FreeGolfFitting by GolfMax

Production marketing site and remote fitting intake for GolfMax. The new homepage at `/` sells the FreeGolfFitting offer while the `/start/` route hosts the full remote fitting workflow with live reviews, uploads, and fitter bio.

## Key Features

- **Launch-ready marketing page (`index.html`)**: clear value prop, pricing, testimonials, and CTA routing golfers to the intake flow.
- **Remote fitting intake (`/start/`)**: detailed process narrative, bio, and fully wired upload form powered by Cloudflare R2.
- **Real Google social proof**: `/api/reviews` proxy (Cloudflare Worker / AWS Lambda) hydrates both hero metrics and reviews grid with ratings ≥4.
- **Reusable upload pipeline**: shared handler streams swing videos into durable storage, emits signed links, and supports optional webhooks/email alerts.

## File Map

- `index.html` — FreeGolfFitting marketing page (production entry point).
- `launch.css` — design system for the marketing page.
- `start/index.html` — remote fitting experience (formerly `remote-preview.html`).
- `styles.css` — shared styles for the remote fitting experience and legacy variants.
- `assets/` — marketing imagery (hero, SVG logo).
- `reviews.js` — front-end hydration for Google reviews grid and ticker.
- `form.js` — handles form validation, upload progress, and UI feedback.
- `config.js` — runtime configuration (endpoints, place ID, upload URL).
- `analytics.js` — lazy GA4 loader and conversion tracking for CTAs + form success.
- `functions/api/reviews.js` — Cloudflare Pages Function proxying Google Places.
- `functions/api/upload.js` — Cloudflare Pages Function for swing uploads.
- `cloudflare/worker.js` — shared Worker for production reviews + uploads.
- `shared/upload-handler.js` — common upload handler (Cloudflare Worker & Pages).
- `aws/lambda/reviews/index.js` — AWS Lambda variant of the reviews proxy.
- `aws/config.json` — runtime config example consumed at `/aws/config.json`.

## Local Development

1. **Static preview**
   ```bash
   python3 -m http.server 8080
   ```
   Opens http://localhost:8080 — homepage lives at `/`, remote fitting flow at `/start/`.

2. **Mock reviews API**
   ```bash
   python3 dev_reviews_server.py
   ```
   Serves `http://127.0.0.1:8787/api/reviews` with `mock-reviews.json`. Frontend auto-targets it when running from localhost.

3. **Cloudflare Pages Function**
   ```bash
   npx wrangler dev functions/api/reviews.js --vars GOOGLE_API_KEY=xxx PLACE_ID=ChIJO8L3QtwU6YARnGKftpsMyfo
   ```

4. **Upload endpoint (Cloudflare)**
   ```bash
   npx wrangler dev
   ```
   Ensure you bind an R2 bucket:
   ```bash
   wrangler r2 bucket create golfmax-uploads
   wrangler dev --persist-to=./wrangler-state \
     --r2-bucket VIDEO_UPLOADS=golfmax-uploads \
     --var UPLOAD_MAX_MB=300
   ```

## Deployment Notes

- **Google reviews**: set `GOOGLE_API_KEY` and `PLACE_ID` in your Worker/Pages Function or AWS Lambda environment. Restrict keys to Places API only.
- **Upload storage**: bind an R2 bucket (Cloudflare) or replace with S3 integration. Required env vars:
  - `VIDEO_UPLOADS` — R2 bucket binding (Workers) or stub providing `.put`.
  - `UPLOAD_MAX_MB` — optional, default 300.
  - `UPLOAD_WEBHOOK_URL` — optional webhook for back-office notifications.
- **Email notifications** (optional): supply SendGrid credentials to email the fitting desk on each submission:
  - `SENDGRID_API_KEY`
  - `UPLOAD_NOTIFY_TO` (comma-separated list supported)
  - `UPLOAD_NOTIFY_FROM` (defaults to first `UPLOAD_NOTIFY_TO` address if omitted)
  - `UPLOAD_NOTIFY_FROM_NAME`
  - `UPLOAD_NOTIFY_SUBJECT`
  - `UPLOAD_NOTIFY_LINK_TTL` (optional, seconds until signed download links expire; default 86400)
- **Analytics**: set `GA_MEASUREMENT_ID` in `aws/config.json` (or environment-specific override) so `analytics.js` can load GA4 and attach event tracking.
- **Runtime config**: `aws/config.json` (or generated equivalent) ships with the site and sets `REVIEWS_ENDPOINT`, `PLACE_ID`, `GOOGLE_URL`, and `UPLOAD_ENDPOINT`. Update during deployment and run `bash scripts/build_public.sh`.
- **CORS**: Cloudflare worker accepts origins defined via `ALLOWED_ORIGINS`. In production set to your canonical domain(s).
- **Sitemaps/robots**: currently point at `https://freegolffitting.com/`; update both files if the production hostname changes.

## QA Checklist

- Reviews grid and ticker populate with live Google data (or mock server).
- Form rejects files >300 MB and unsupported MIME types, shows progress for valid uploads.
- Upload handler stores the video object plus metadata JSON in R2 and returns `{ ok: true }`.
- Responsive layout holds on tablet and mobile (homepage hero/CTA plus `/start/` sticky video + form inputs).
- GA4 events fire for homepage CTAs and successful form submissions (check in DebugView when possible).

## Future Enhancements

- Add CRM integration (e.g., HubSpot or Airtable) once webhook destination is finalized.
- Surface upload status to operators via Slack/Email webhook or dashboard.
- Expand review curation with additional filters or manual testimonials.
- Wire analytics (GA4, Segment) once privacy notice is finalized.

# 3D_golfmaxio
