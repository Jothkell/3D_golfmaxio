# Project Handoff — GolfMax Remote Fitting

This document captures the current state, live links, and the exact next actions so a new engineer (or future Codex run) can continue seamlessly.

## TL;DR — What’s Working Now
- Marketing homepage lives at `index.html`; remote fitting intake flow is routed through `/start/`.
- Reviews integration pulls fresh Google Places data (rating ≥4) via Worker/Pages Function/Lambda.
- Swing video uploads post to `/api/upload`, stream into R2, and write metadata JSON.
- Cloudflare Worker (`golfmax-reviews`) serves both `/api/reviews` and `/api/upload`; Pages Function equivalents live in `functions/api/`.
- Frontend consumes runtime config from `/aws/config.json` (REVIEWS_ENDPOINT, PLACE_ID, GOOGLE_URL, UPLOAD_ENDPOINT).
- Static assets staged to `s3://freegolffitting-site` (`us-west-2`) and fronted by CloudFront distribution `d268b7nk0cktd7.cloudfront.net`.
- AWS SAM stack `golfmax-reviews` deployed in `us-west-2`; API Gateway endpoint `https://6bqg4174x8.execute-api.us-west-2.amazonaws.com/api/reviews` currently used by `/aws/config.json`.

## Key Paths
- Marketing homepage: `index.html` (see `launch.css` + assets under `/assets`).
- Remote fitting flow: `start/index.html` (redirect available via `remote-preview.html`).
- Legacy alt experiences remain under `landingpage_2.html`, `globe.html`, etc.
- Reviews hydration: `reviews.js` (awaits `GM_CONFIG_READY` for runtime overrides).
- Intake UX: `form.js` (progress + validation) with supporting styles in `styles.css`.
- Runtime config loader: `config.js`.
- Shared upload implementation: `shared/upload-handler.js`.
- Cloudflare Worker: `cloudflare/worker.js` (routes, CORS, caching).
- Cloudflare Pages Functions: `functions/api/reviews.js`, `functions/api/upload.js`.
- AWS assets: `aws/lambda/reviews/index.js`, `aws/sam/template.yaml`, `aws/cloudfront-site.yaml`.
- Build/deploy scripts:
  - `scripts/build_public.sh` — builds `public/` (consumes `aws/config.json`).
  - `scripts/aws_sync_s3.sh s3://YOUR_BUCKET --region us-west-2` — rebuild + sync bundle.
- Runtime config examples: `aws/config.json`, `aws/config.sample.json` (now includes `UPLOAD_ENDPOINT`).

## Secrets & Config (where they live)
- **Google Places API key**:
  - Cloudflare Worker secret `GOOGLE_API_KEY`.
  - Cloudflare Pages Function secret `GOOGLE_API_KEY`.
  - AWS SAM parameter `GoogleApiKey`.
- **Place ID**: `ChIJO8L3QtwU6YARnGKftpsMyfo` (Worker/Pages/Lambda env `PLACE_ID`).
- **Upload storage**:
  - Cloudflare R2 binding `VIDEO_UPLOADS` required for Worker + Pages upload endpoint.
  - Optional `UPLOAD_MAX_MB` (default 300) and `UPLOAD_WEBHOOK_URL` for notifications.
- **Email alerts (optional)**:
  - Configure SendGrid (or compatible API) via `SENDGRID_API_KEY`.
  - Set `UPLOAD_NOTIFY_TO` (comma-separated list supported) and optionally `UPLOAD_NOTIFY_FROM`, `UPLOAD_NOTIFY_FROM_NAME`, `UPLOAD_NOTIFY_SUBJECT`, `UPLOAD_NOTIFY_LINK_TTL` so each intake generates an email with signed download links.
- **Allowed origins**: Worker env `ALLOWED_ORIGINS` for CORS (comma-separated).
- `/aws/config.json`: defines `REVIEWS_ENDPOINT`, `PLACE_ID`, `GOOGLE_URL`, `UPLOAD_ENDPOINT`, `GA_MEASUREMENT_ID`.

## What’s Pending (needs account access)
1. **Cloudflare**
   - Bind R2 bucket for swing uploads (`VIDEO_UPLOADS`). Suggested name: `golfmax-remote-fittings`.
   - Add secrets/vars: `GOOGLE_API_KEY`, `PLACE_ID`, `ALLOWED_ORIGINS`, optional `UPLOAD_MAX_MB`, `UPLOAD_WEBHOOK_URL`.
   - Ensure `/api/upload` and `/api/reviews` routes point to `golfmax-reviews` Worker (or migrate to Pages Functions per environment).
   - Onboard `freegolffitting.com` and `www.freegolffitting.com`; set DNS to CloudFront (gray-cloud) or reroute through Cloudflare Pages.
2. **AWS**
   - (Done) Reviews SAM stack deployed — update key restrictions so Google Places returns `OK`.
   - (Optional) Stand up an S3/S3+Lambda equivalent for uploads if Cloudflare R2 is not desired.
   - Create dedicated S3 buckets for future 3D workflow (`video-input`, `model-output`, `artifacts`).

## Exact Next Actions

### A) Deploy Reviews API on AWS (SAM)
From repo root or `aws/sam/`:
```
cd aws/sam
sam build -t template.yaml
sam deploy --guided --stack-name golfmax-reviews --capabilities CAPABILITY_IAM
```
Prompts:
- GoogleApiKey: <paste Google Places API key>
- PlaceId: `ChIJO8L3QtwU6YARnGKftpsMyfo`
- AllowedOrigin: `http://localhost:8080` (add prod domain later)
- Save arguments: `Y`
Outputs:
- Copy `ReviewsEndpoint` (final URL is `https://<api-id>.execute-api.<region>.amazonaws.com/api/reviews`).

### B) Point the site to the AWS API (no rebuild required)
`aws/config.json` currently holds:
```
{
  "REVIEWS_ENDPOINT": "https://6bqg4174x8.execute-api.us-west-2.amazonaws.com/api/reviews",
  "PLACE_ID": "ChIJO8L3QtwU6YARnGKftpsMyfo",
  "GOOGLE_URL": "https://www.google.com/maps/search/?api=1&query_place_id=ChIJO8L3QtwU6YARnGKftpsMyfo",
  "UPLOAD_ENDPOINT": "/api/upload"
}
```
Update `REVIEWS_ENDPOINT` (and `UPLOAD_ENDPOINT` if the upload handler lives elsewhere) as environments change, then rebuild with `scripts/build_public.sh`.

### C) Finish CloudFront + custom domain
- CloudFront distribution `d268b7nk0cktd7.cloudfront.net` is provisioning — wait for status `Deployed`.
- In Cloudflare DNS, set `freegolffitting.com` and `www.freegolffitting.com` CNAME records to `d268b7nk0cktd7.cloudfront.net` (DNS only, gray cloud).
- Once DNS propagates, hit `https://freegolffitting.com` and confirm the site serves over HTTPS through CloudFront.
- Optional: lock S3 bucket to CloudFront-only access later (convert to Origin Access Control + tighten bucket policy).

## Behavior Notes
- Frontend awaits `window.GM_CONFIG_READY` before hitting endpoints, allowing `/aws/config.json` overrides.
- Reviews are filtered server + client side for rating ≥4 and capped at 12; ticker duplicates the set for seamless scroll.
- Upload handler enforces required `name`, `email`, and `video` fields; rejects files > `UPLOAD_MAX_MB`.
- Landing Page 2 still disables mock fallback and remains a lightweight preview variant (update copy later if needed).
- Marketing homepage pulls imagery from `/assets` and styles from `launch.css`.
- `/remote-preview.html` now redirects to `/start/`; update the intake flow directly in `start/index.html`.
- `analytics.js` lazily loads GA4 when `GA_MEASUREMENT_ID` is present and logs CTA clicks plus successful intake submissions.

## Verification Checklist
- `python3 -m http.server 8080` → confirm homepage renders correctly and `/start/` loads hero copy, process steps, bio, and form.
- Reviews: ensure `/api/reviews` returns 200 and populates both ticker (`#reviews-ticker`) and cards (`#reviews-grid`).
- Upload: submit a <100 MB test video; expect `{ ok: true, objectKey: ... }` and new objects in R2 (`videos/<timestamp>_<slug>.ext` plus JSON metadata).
- `/aws/config.json` served with correct cache headers and values (no browser caching issues due to `no-store` fetch).
- Mobile: verify hero CTA stack, sticky video behavior, and form spacing ≤768px.
- SEO: confirm `robots.txt` and `sitemap.xml` serve the correct origin; update if domains change.
- Analytics: with GA DebugView, confirm homepage CTA clicks and `/start/` submission fire `select_content` and `generate_lead` events once GA4 is configured.

## Contact Points for the Next Engineer
- If Cloudflare Worker returns errors, run `npx wrangler tail golfmax-reviews` in `cloudflare/`.
- If Pages Function fails, redeploy with `npx wrangler pages deploy public --project-name freegolffitting`.
- If AWS API fails, check CloudWatch Logs for the `golfmax-reviews` Lambda.

---
This handoff was written to be the single source of truth for next steps. Prefer updating this file if deployment choices change (Cloudflare-only vs AWS).

## Session Notes — 2025-11-04
- Swapped the coming-soon shell for the launch marketing page (`index.html` + `launch.css`), wiring CTA traffic to `/start/`.
- Moved the full remote fitting experience to `start/index.html` and added a redirect at `/remote-preview.html`.
- Opened `robots.txt`, refreshed `sitemap.xml`, and taught `build_public.sh` to ship `/assets`, `launch.css`, and the `/start/` directory.

## Session Notes — 2025-10-28
- Restored public landing to the coming-soon shell (`index.html`), keeping the full remote-fitting experience at `remote-preview.html` for future iterations.
- Deployed today's review pipeline changes: Cloudflare Worker, Pages Function, and AWS Lambda now return 4+ star Google Places reviews; frontend ticker shows first-name/initial plus clipped quote.
- Nav "Explore" dropdown stacking fixed (z-index adjustments) so it sits over the reviews ticker.
- Alex Bollag copy + imagery now live after S3 sync and CloudFront invalidations (`E3O6C05H4ST9HA`). Current invalidation IDs: `I40MTXRAS3NAKTUC3BOC6P1DIU` and `I3F9J03QKDEBKHXFNQCYRHXYKY` (both kicked today).
- Production bundle built via `scripts/build_public.sh` and synced to `s3://freegolffitting-site`; ensure to rerun this before edits go live.
- Google Places API key stored in Cloudflare secret `GOOGLE_API_KEY`; DNS proxied through Cloudflare (both apex & www) so `/api/reviews` Worker is active.
- Historical note: `/remote-preview.html` previously hosted the full layout before today's `/start/` move.
