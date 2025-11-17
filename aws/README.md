AWS deployment for MVP

This guide sets up:
- Static site hosting on S3 + optional CloudFront
- A serverless reviews API on AWS Lambda + API Gateway that safely calls Google Places
- (Optional) Backend primitives if you prefer AWS S3 for swing uploads instead of Cloudflare R2

Prereqs
- AWS account with admin permissions for S3, Lambda, API Gateway
- Google Places API key with Places API enabled
- AWS CLI configured (aws configure)

1) Create S3 static site bucket
- Create a bucket (e.g., golfmax-remote-fitting) in your region
- Enable static website hosting (index document: index.html)
- Upload site files from repo root (index.html, styles.css, images, JS)
- Optionally set up CloudFront in front of the bucket for HTTPS and caching

2) Create the Reviews Lambda (Node.js 20)
- Create a new Lambda function (name: golfmax-reviews)
- Runtime: Node.js 20.x
- Handler: index.handler
- Paste code from aws/lambda/reviews/index.js
- Configure Environment variables:
  - GOOGLE_API_KEY: your Google Places key
  - PLACE_ID: default Place ID for GolfMax Santa Barbara (optional; can be passed via querystring)
- Increase timeout to 5 seconds

3) Add API Gateway (HTTP API)
- Create an HTTP API
- Add a route: GET /api/reviews
- Integration: your Lambda (golfmax-reviews)
- Enable CORS: Allow methods GET, headers Content-Type; Allow origin your site URL (or * during testing)
- Deploy the API and note the invoke URL (e.g., https://abc123.execute-api.us-west-2.amazonaws.com)

4) Wire frontend to API
- In config.js, set:
  window.GM_REVIEWS_ENDPOINT = "https://<api-id>.execute-api.<region>.amazonaws.com/api/reviews";
- Optionally set window.GM_PLACE_ID in index.html (or pass ?place_id= via endpoint)

5) Find GolfMax Place ID (if needed)
- Use Google Places API “Find Place” endpoint or Cloud Console to discover the place_id for GolfMax in Santa Barbara

Notes
- Keep the Google API key only in Lambda environment/secrets—not in client JS
- You can enable caching at API Gateway or add a small in-memory cache in Lambda if needed
- Lock down CORS to your production domain when going live

### One-command deploys (scripts)
- Build static site and sync to S3:
  - Copy `aws/config.sample.json` to `aws/config.json` and set `REVIEWS_ENDPOINT` to your API Gateway URL (from SAM Outputs). This lets the frontend pick up the endpoint without modifying code.
  - Run: `scripts/aws_sync_s3.sh s3://YOUR-SITE-BUCKET --region us-east-1 --profile default`

- CloudFront in front of S3 (HTTPS + caching):
  - Request an ACM certificate in us-east-1 for `freegolffitting.com` and `www.freegolffitting.com` (DNS validation).
  - Deploy stack: `aws cloudformation deploy --template-file aws/cloudfront-site.yaml --stack-name site-stack --parameter-overrides DomainName=freegolffitting.com AlternateNames=www.freegolffitting.com CertificateArn=arn:aws:acm:us-east-1:...:certificate/... --capabilities CAPABILITY_NAMED_IAM`
  - Point DNS A/AAAA (alias) to the `DistributionDomain` output (Route 53 hosted zone recommended).

## Fast deploy via AWS SAM (recommended)

This repo includes a ready-to-deploy SAM template at `aws/sam/template.yaml`.

Prereqs:
- Install AWS SAM CLI and AWS CLI, and run `aws configure`.

Build and deploy (guided on first run):

1) From repo root:
   sam build -t aws/sam/template.yaml

2) Deploy (guided):
   sam deploy --guided \
     --stack-name golfmax-reviews \
     --capabilities CAPABILITY_IAM

   During prompts, set:
   - Parameter GoogleApiKey: YOUR_GOOGLE_PLACES_API_KEY
   - Parameter PlaceId: YOUR_PLACE_ID (optional; can be blank)
   - Parameter AllowedOrigin: http://localhost:8000 (dev) or your prod domain when live
   - Save arguments to samconfig.toml: Yes

3) After deploy, note Outputs:
   - ReviewsEndpoint (copy this URL)

4) Frontend config:
   - Edit `config.js` and set:
     window.GM_REVIEWS_ENDPOINT = "<ReviewsEndpoint from Outputs>";
     // Optionally:
     window.GM_PLACE_ID = "<YOUR_PLACE_ID>";
   - Alternatively, create `aws/config.json` with `REVIEWS_ENDPOINT` set and deploy the site; the frontend will auto-detect it.
   - `aws/config.json` already includes `"UPLOAD_ENDPOINT": "/api/upload"` — update this if your uploads live behind API Gateway/Lambda instead of the Cloudflare Worker.

## Optional: AWS-native Uploads

If Cloudflare R2 is not available, replicate the uploader using S3 + Lambda:

1. Create an S3 bucket (e.g., `golfmax-remote-uploads`) with private ACL.
2. Add a Lambda (Node.js 20) that accepts multipart form-data, writes the video + metadata to S3, and returns `{ ok: true }`.
3. Wire the Lambda behind API Gateway `POST /api/upload` with CORS mirroring the reviews endpoint.
4. Update `/aws/config.json`:
   ```json
   {
     "REVIEWS_ENDPOINT": "https://<reviews-api>/api/reviews",
     "PLACE_ID": "ChIJO8L3QtwU6YARnGKftpsMyfo",
     "GOOGLE_URL": "https://www.google.com/maps/search/?api=1&query_place_id=ChIJO8L3QtwU6YARnGKftpsMyfo",
     "UPLOAD_ENDPOINT": "https://<uploads-api>/api/upload"
   }
   ```
5. Set environment variables similar to the Cloudflare handler (`MAX_MB`, optional webhook URL) and ensure multipart parsing keeps memory usage safe (use streaming libraries like `busboy`). For email alerts, invoke your provider (e.g., SendGrid, SES) from the Lambda after the S3 upload succeeds.

Local test tip:
- Serve the site locally: `python3 -m http.server` → http://localhost:8000
- With CORS AllowedOrigin set to http://localhost:8000, reviews should load live.

## Future: 3D GPU Pipeline (sketch)
- Buckets: `video-input`, `model-output`, `artifacts`.
- ECR: `3d-pipeline` image (FFmpeg + COLMAP + OpenMVS + CUDA + Ceres).
- Batch: Managed GPU compute env (g4dn.xlarge), job queue, job def.
- Step Functions: S3 trigger → Submit Batch job → Wait for completion → Publish metrics.
- DynamoDB: `jobs` table (id, status, input S3, output S3, metrics).
- API Gateway + Lambda: mint presigned S3 upload URLs; submit jobs; fetch status for UI.
