# GBPEval

Google Business Profile audit tool. Sibling to WebSEO_eval — same product
surface, different data source.

## Quick start

```bash
cp .env.example .env.local
# fill in SHARED_API_TOKEN, KV_REST_API_*, ANTHROPIC_API_KEY, OUTSCRAPER_API_KEY
npm install
npm run dev
```

Open <http://localhost:3000>, paste your `SHARED_API_TOKEN`, add a business in
**Settings**, paste a Google Place ID, and click **Run all audits** on the
Overview page.

## Audits

Five audits bundle 14 GBP best-practice items:

1. **Core Listing** — address, phone, website, status, duplicates
2. **Categories** — primary match, 3–9 secondaries, no vague terms
3. **Profile Sections** — description, hours, holiday hours, products, services, attributes
4. **Media** — logo, cover, photo count, video, owner-uploaded freshness
5. **Engagement** — recent posts, Q&A owner responses, review-response rate

## Data sources

Outscraper is primary (covers ~12/14 checks). Google Places API (New) is
fallback — when only `GOOGLE_PLACES_API_KEY` is set, the audits run but mark
unsupported checks as *"skipped: data source limited"*.

## Architecture

See `docs/GUIDELINES.md` for the cross-repo conventions shared with
WebSEO_eval.
