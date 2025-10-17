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
- Frontend reads runtime config from `/aws/config.json` when present.
- Static assets published to `s3://freegolffitting-site` (`us-west-2`) with website endpoint: `http://freegolffitting-site.s3-website-us-west-2.amazonaws.com/`.
- CloudFront distribution `E3O6C05H4ST9HA` (domain `d268b7nk0cktd7.cloudfront.net`) fronts the bucket; ACM cert `arn:aws:acm:us-east-1:327512371169:certificate/fa78d944-51e7-4b29-a16c-5d3ff0688647` is attached.
- AWS SAM stack `golfmax-reviews` deployed in `us-west-2`; API Gateway endpoint `https://6bqg4174x8.execute-api.us-west-2.amazonaws.com/api/reviews` feeds the site via `/aws/config.json`.

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
- Runtime config shipped at `aws/config.json` (update `REVIEWS_ENDPOINT` once the AWS API is live); example template remains at `aws/config.sample.json`.

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
- Deploy the SAM Reviews API and capture the output URL. ✅ (`https://6bqg4174x8.execute-api.us-west-2.amazonaws.com/api/reviews`)
   - Attach CloudFront + custom domain in front of `s3://freegolffitting-site`.
   - (Future 3D pipeline) Create `video-input`, `model-output`, and `artifacts` buckets in `us-west-2`.

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
`aws/config.json` now points to the deployed endpoint:
```
{
  "REVIEWS_ENDPOINT": "<ReviewsEndpoint>",
  "PLACE_ID": "ChIJO8L3QtwU6YARnGKftpsMyfo"
}
```
Static site is synced to S3/CloudFront. If you change the endpoint or config, rebuild with `scripts/build_public.sh` and `scripts/aws_sync_s3.sh s3://freegolffitting-site --region us-west-2`.

### C) Finish CloudFront + custom domain
- CloudFront distribution `d268b7nk0cktd7.cloudfront.net` is provisioning — wait for status `Deployed`.
- In Cloudflare DNS, set `freegolffitting.com` and `www.freegolffitting.com` CNAME records to `d268b7nk0cktd7.cloudfront.net` (DNS only, gray cloud).
- Once DNS propagates, hit `https://freegolffitting.com` and confirm the site serves over HTTPS through CloudFront.
- Optional: lock S3 bucket to CloudFront-only access later (convert to Origin Access Control + tighten bucket policy).

## Behavior Notes
- Reviews filter: both backend (Worker/Function/Lambda) and frontend show only rating >= 4.
- Landing Page 2 (`landingpage_2.html`) disables mock fallback; if API fails, it shows no placeholders.
- The badge in LP2 links to the Google listing URL (from API when available, otherwise built from Place ID).

## Verification Checklist
- Local dev: `python3 -m http.server 8080` → http://localhost:8080 → `WHAT CLIENTS SAY` shows cards once API is reachable.
- Pages preview: `*.freegolffitting.pages.dev/landingpage_2.html` uses the Pages Function `/api/reviews`.
- Production (Cloudflare): Once DNS is live, `/api/reviews` is served by the Worker.
- Production (AWS): CloudFront domain `https://d268b7nk0cktd7.cloudfront.net` currently serves the site (S3 origin). After DNS cuts over, confirm the site reads `REVIEWS_ENDPOINT` from `/aws/config.json` and calls API Gateway. Current Google key responds with `REQUEST_DENIED`; lift the key restrictions or supply a server-side key so Lambda succeeds.

## Contact Points for the Next Engineer
- If Cloudflare Worker returns errors, run `npx wrangler tail golfmax-reviews` in `cloudflare/`.
- If Pages Function fails, redeploy with `npx wrangler pages deploy public --project-name freegolffitting`.
- If AWS API fails, check CloudWatch Logs for the `golfmax-reviews` Lambda.

---
This handoff was written to be the single source of truth for next steps. Prefer updating this file if deployment choices change (Cloudflare-only vs AWS).
