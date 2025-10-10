# Project Handoff — GolfMax Remote Fitting

This document captures the current state, live links, and the exact next actions so a new engineer (or future Codex run) can continue seamlessly.

## TL;DR — What’s Working Now
- Static site runs locally: `python3 -m http.server 8080` → http://localhost:8080
- Cloudflare Pages preview (latest): shown in deploy output URLs (`*.freegolffitting.pages.dev`).
- Reviews integration is implemented and filtered to rating >= 4 stars.
- Cloudflare Worker deployed (script name `golfmax-reviews`) and bound to routes:
  - `https://freegolffitting.com/api/reviews*`
  - `https://www.freegolffitting.com/api/reviews*`
  - Note: DNS for the domain is not live yet, so those URLs won’t resolve.
- Cloudflare Pages Function added for previews: `functions/api/reviews.js`.
- Frontend can read runtime config from `/aws/config.json` if present.

## Key Paths
- Frontend entry: `index.html`, alternate LP: `landingpage_2.html`.
- Reviews fetcher: `reviews.js` (waits for optional `/aws/config.json` overrides).
- Client config: `config.js`.
- Cloudflare Worker: `cloudflare/worker.js` + `cloudflare/wrangler.toml` (routes, vars).
- Cloudflare Pages Function: `functions/api/reviews.js` (same-origin API for previews).
- AWS Lambda (Reviews proxy) source: `aws/lambda/reviews/index.js`.
- AWS SAM template (Reviews API): `aws/sam/template.yaml`.
- S3/CloudFront stack (optional): `aws/cloudfront-site.yaml`.
- Build/deploy helpers:
  - `scripts/build_public.sh` → assembles `public/` with optional `/aws/config.json`.
  - `scripts/aws_sync_s3.sh s3://YOUR_BUCKET --region us-east-1` → syncs `public/` to S3.
- Optional runtime config example: `aws/config.sample.json` (copy to `aws/config.json`).

## Secrets & Config (where they live)
- Google Places API key:
  - Stored as a Cloudflare Worker secret (`GOOGLE_API_KEY`) — not in repo.
  - Stored as a Cloudflare Pages secret for preview Function — not in repo.
  - For AWS, SAM deploy expects `GoogleApiKey` parameter.
- Place ID in use: `ChIJO8L3QtwU6YARnGKftpsMyfo` (also set as Worker var and used by LP2).

## What’s Pending (needs account access)
1) Cloudflare:
   - Domain `freegolffitting.com` must be onboarded and proxied (orange cloud) so the Worker routes activate.
2) AWS (recommended hosting target + API):
   - Configure AWS CLI credentials on the machine.
   - Deploy the SAM Reviews API and capture the output URL.
   - Create an S3 bucket and (optionally) a CloudFront distribution for the site.

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
Create `aws/config.json` (copy from `aws/config.sample.json`) and set:
```
{
  "REVIEWS_ENDPOINT": "<ReviewsEndpoint>",
  "PLACE_ID": "ChIJO8L3QtwU6YARnGKftpsMyfo"
}
```
Then deploy static files to S3:
```
scripts/aws_sync_s3.sh s3://YOUR-SITE-BUCKET --region us-east-1 --profile default
```
Open the S3 website endpoint (or CloudFront if configured) and verify reviews render.

### C) (Optional) Add CloudFront + HTTPS + custom domain
- Request ACM cert in `us-east-1` for `freegolffitting.com` and `www.freegolffitting.com`.
- Deploy: see `aws/cloudfront-site.yaml` and instructions in `aws/README.md`.
- Point Route 53 alias records to the distribution domain.

## Behavior Notes
- Reviews filter: both backend (Worker/Function/Lambda) and frontend show only rating >= 4.
- Landing Page 2 (`landingpage_2.html`) disables mock fallback; if API fails, it shows no placeholders.
- The badge in LP2 links to the Google listing URL (from API when available, otherwise built from Place ID).

## Verification Checklist
- Local dev: `python3 -m http.server 8080` → http://localhost:8080 → `WHAT CLIENTS SAY` shows cards once API is reachable.
- Pages preview: `*.freegolffitting.pages.dev/landingpage_2.html` uses the Pages Function `/api/reviews`.
- Production (Cloudflare): Once DNS is live, `/api/reviews` is served by the Worker.
- Production (AWS): If hosting on S3/CloudFront, the site will read `REVIEWS_ENDPOINT` from `/aws/config.json` and call API Gateway.

## Contact Points for the Next Engineer
- If Cloudflare Worker returns errors, run `npx wrangler tail golfmax-reviews` in `cloudflare/`.
- If Pages Function fails, redeploy with `npx wrangler pages deploy public --project-name freegolffitting`.
- If AWS API fails, check CloudWatch Logs for the `golfmax-reviews` Lambda.

---
This handoff was written to be the single source of truth for next steps. Prefer updating this file if deployment choices change (Cloudflare-only vs AWS).
