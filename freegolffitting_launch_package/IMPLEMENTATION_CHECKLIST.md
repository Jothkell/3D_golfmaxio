# IMPLEMENTATION CHECKLIST

## Pre‑launch
- [ ] Replace any placeholder/coming soon page with `index.html`.
- [ ] Ensure `<title>`, meta description, OG/Twitter tags are set.
- [ ] Verify canonical host (www vs. root) with 301 redirects.
- [ ] Add GA4 tag and verify data is flowing.
- [ ] Verify robots.txt allows crawling and references sitemap.
- [ ] Generate & submit `sitemap.xml` in GSC.
- [ ] Create `/start` route for fitting flow and track clicks.
- [ ] Add alt text for all images; ensure one `<h1>` per page.
- [ ] Test keyboard navigation and focus outlines.
- [ ] Lighthouse: LCP < 2.5s, CLS < 0.1, TBT < 200ms on mid‑range mobile.
- [ ] Replace hero and OG images; compress WebP/AVIF < 200KB.
- [ ] Add `Organization`, `Service`, and `FAQPage` JSON‑LD (already included).
- [ ] Confirm HTTPS + HSTS; no mixed content warnings.
- [ ] Add privacy and terms pages; link in footer.

## Cross‑domain authority (GolfMax)
- [ ] Add header/footer **Remote Golf Fitting** link to FreeGolfFitting with UTM.
- [ ] Add contextual links on Appointments and relevant category pages.
- [ ] Publish a short blog/announcement linking to FreeGolfFitting.

## Analytics & Goals
- [ ] Event: nav click `Start Free Fitting`.
- [ ] Event: step completions in questionnaire.
- [ ] Conversion: submit fitting.
- [ ] Add UTM campaign dashboard for referrals from thegolfmax.com.

## Post‑launch QA
- [ ] Mobile Safari layout check (iOS 14+).
- [ ] Android Chrome check (2–3 recent versions).
- [ ] Validate schema with Rich Results Test.
- [ ] Fetch as Google (GSC) and request indexing.
