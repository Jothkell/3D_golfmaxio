# FreeGolfFitting Launch & Handoff

**Date:** 2025-11-04

This package contains a production‑ready landing page, schema, baseline styles, email template, and implementation checklist to launch **https://freegolffitting.com** and connect it with **https://www.thegolfmax.com**.

## Contents
- `index.html` – Landing page (hero, steps, what you get, why trust, pricing, testimonials, FAQ, schema).
- `styles.css` – Minimal, modern design system.
- `robots.txt` – Default allow + sitemap.
- `sitemap.xml` – Minimal sitemap.
- `email/remote-fitting-ready.html` – Transactional email template.
- `brand_style_guide.md` – Minimal brand system (colors, type, spacing, components).
- `golfmax_crosslink_snippets.md` – Copy/paste anchors for cross-domain internal links.
- `IMPLEMENTATION_CHECKLIST.md` – Step-by-step SEO/analytics/accessibility/perf checklist.

## How to deploy
1. Upload files to your host (Netlify/Vercel/Cloudflare Pages or server).
2. Ensure HTTPS and a single canonical hostname (non‑www → www or vice versa) via 301s.
3. Update footer NAP to GolfMax’s exact address/phone.
4. Replace all placeholder images under `/assets` and update `og:image` URL in `<head>`.
5. Remove any “Coming Soon” or `noindex` from previous versions.

## Google Search Console & Analytics
- Verify both domains in GSC and submit each `sitemap.xml`.
- Add GA4 to `index.html` (`<head>`).
- Set conversions for **Start Free Fitting** (`/start`) and **Submit** events in the fitting flow.

## UTM & attribution
Use `?utm_source=thegolfmax&utm_medium=referral&utm_campaign=remote_fitting` for all cross‑links from GolfMax.

---

If Codex needs a task breakdown or tickets, see `IMPLEMENTATION_CHECKLIST.md` for issue‑sized items.
