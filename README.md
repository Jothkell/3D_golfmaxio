# GolfMax Remote Fitting

Modernized marketing site and intake flow for GolfMax’s remote fitting program, bringing live Google reviews, detailed process copy, and swing-video uploads into a single experience.

## Key Features

- **Real Google social proof**: `/api/reviews` proxy (Cloudflare Worker / AWS Lambda) hydrates the review banner and grid with ratings ≥4, plus link-through attribution.
- **Conversion-focused hero**: refreshed copy, primary CTA, and stats summarizing turnaround, volume, and golfer satisfaction.
- **Process walkthrough**: embedded remote-fitting explainer video with supporting highlights and four-step guide.
- **Fitter credibility**: updated biography for Alex Bollag with specialties, certifications, and validated experience.
- **Remote fitting intake**: fully wired form that validates swing uploads, tracks progress, and sends submissions to durable storage.

## File Map

- `index.html` — production landing page.
- `styles.css` — global site styles (four-space indentation, no preprocessor).
- `reviews.js` — front-end hydration for Google reviews grid and ticker.
- `form.js` — handles form validation, upload progress, and UI feedback.
- `config.js` — runtime configuration (endpoints, place ID, upload URL).
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
   Opens http://localhost:8080 — background animation, reviews ticker, and form render.

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
  - `UPLOAD_NOTIFY_TO`
  - `UPLOAD_NOTIFY_FROM` (defaults to `UPLOAD_NOTIFY_TO` if omitted)
  - `UPLOAD_NOTIFY_FROM_NAME`
  - `UPLOAD_NOTIFY_SUBJECT`
- **Runtime config**: `aws/config.json` (or generated equivalent) ships with the site and sets `REVIEWS_ENDPOINT`, `PLACE_ID`, `GOOGLE_URL`, and `UPLOAD_ENDPOINT`. Update during deployment and run `bash scripts/build_public.sh`.
- **CORS**: Cloudflare worker accepts origins defined via `ALLOWED_ORIGINS`. In production set to your canonical domain(s).
- **Sitemaps/robots**: update `sitemap.xml` with the final origin; `robots.txt` is ready for launch.

## QA Checklist

- Reviews grid and ticker populate with live Google data (or mock server).
- Form rejects files >300 MB and unsupported MIME types, shows progress for valid uploads.
- Upload handler stores the video object plus metadata JSON in R2 and returns `{ ok: true }`.
- Responsive layout holds on tablet and mobile (focus on hero CTAs, video sticky behavior, and form inputs).

## Future Enhancements

- Add CRM integration (e.g., HubSpot or Airtable) once webhook destination is finalized.
- Surface upload status to operators via Slack/Email webhook or dashboard.
- Expand review curation with additional filters or manual testimonials.
- Wire analytics (GA4, Segment) once privacy notice is finalized.

# 3D_golfmaxio
