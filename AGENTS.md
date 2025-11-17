# Repository Guidelines

## Project Structure & Module Organization
Static assets live at the repository root: the marketing homepage is `index.html` (styled by `launch.css` and assets under `/assets`), while the remote fitting experience lives in `start/index.html` and still pulls shared resources like `styles.css`, `sphere.js`, `reviews.js`, and `analytics.js` (GA4 loader). Alternate experiences sit in `landingpage_2.html`, `globe.html`, and the `3d/` folder, which contains an isolated demo and README. Backend glue resides under `functions/api/reviews.js`, a Cloudflare Worker that proxies Google Places reviews using `GOOGLE_API_KEY` and `PLACE_ID`. Reusable automation sits in `scripts/`, while `public/` is a generated output directory and should stay untracked. Keep mock data in `mock-reviews.json`; the lightweight dev API server reads directly from it.

## Build, Test, and Development Commands
Run `python3 dev_reviews_server.py` to serve `/api/reviews` locally with the mock payload (default port `8787`). Execute `bash scripts/build_public.sh` to stage production-ready assets into `public/`. For deployments to S3, call `bash scripts/aws_sync_s3.sh s3://YOUR_BUCKET` after configuring the AWS CLI; this script rebuilds `public/` before syncing. When testing the worker in Cloudflare Pages, set `wrangler dev functions/api/reviews.js` and pass the required environment variables.

## Coding Style & Naming Conventions
Match the existing HTML and CSS style: four-space indentation, lowercase element classes with hyphen separators, and semantic sectioning (`<section id="...">`). JavaScript favors `const`/`let`, early returns, and explicit helper functions (see `cors()` in the worker). Keep filenames lowercase with hyphens (`landingpage_2.html` is the lone legacy exception). Before committing, run Prettier or your editor’s HTML/CSS formatter in “four spaces” mode; no automated lint step is wired in, so manual consistency matters.

## Testing Guidelines
There is no formal test suite; rely on manual verification. Open `index.html` via a static file server (`python3 -m http.server 8080`) to validate the marketing page, then hit `/start/` to confirm the 3D background, review ticker population, and responsive form behavior. When analytics is configured (`GA_MEASUREMENT_ID`), use GA DebugView to spot homepage CTA + lead submission events. When touching the worker, mock `fetch` responses or hit the service with `curl -H "Origin: http://localhost:8080" http://localhost:8787/api/reviews` to verify CORS behavior. Document any manual scenarios you executed in the pull request description.

## Commit & Pull Request Guidelines
Git history uses short, imperative subjects (`initial upload`); follow that format and add scoped prefixes only when helpful (`fix:`, `feat:`). Each pull request should summarize user-facing changes, link the related issue (if any), and include desktop/mobile screenshots or GIFs when UI shifts. Call out configuration changes (e.g., new environment variables) and describe any manual QA steps so reviewers can reproduce them quickly.
