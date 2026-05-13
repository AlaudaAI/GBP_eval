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

Three audits cover the GBP best-practice items:

1. **Core Listing Health** — address, phone (local area code), website
   (matches configured domain), business status
2. **Profile Completeness** — primary category, no vague top-level categories,
   logo, description, regular hours, holiday hours *(optional)*, services,
   at least one attribute
3. **Media, Q&A & Reviews** — ≥10 photos *(optional)*, ≥1 video *(optional)*,
   every Q&A has an owner response, review-response rate ≥ 50%

### Scoring

Per-check, not per-audit. The overall score is the share of scored checks that
pass, weighted, so audits with more checks contribute proportionally rather
than each audit pulling the same weight.

- **Optional** checks (`weight: 0` semantics) are shown in the report but
  excluded from the numerator and denominator. Today: photo count, video count,
  holiday hours.
- **½-weight** checks count half as much as standard checks. Today: description
  ≥ 200 chars, every Q&A has an owner response, review-response rate ≥ 50%.

Skipped checks ("skipped: data source limited") are excluded from scoring the
same way as optional checks.

## Data source

Outscraper-only when an `OUTSCRAPER_API_KEY` is set. Outscraper errors surface
to the user rather than silently falling back to Google Places, which has far
less coverage. Request timeouts are reported as timeouts (not "no profile").

Google Places (`GOOGLE_PLACES_API_KEY`) is supported only as a dev/no-key
fallback when `OUTSCRAPER_API_KEY` is unset — checks that Places can't answer
are marked *"skipped: data source limited"*.

## Reports

Two PDFs are exported from the scoreboard:

- **Full audit** (`/report`) — every audit with all checks, including optional
  and ½-weight tags, plus recommendations.
- **Client action plan** (`/report/plan`) — five strategic themes written in
  consultant voice (P0 / P1 / P2). Failed checks are clustered into themes;
  remaining rows fill with proactive growth recommendations so the deliverable
  stays at five rows.

Plans are cached per project and regenerate automatically when audits are
re-run. The "Regenerate plan" link forces a fresh generation.

## Architecture

See `docs/GUIDELINES.md` for the cross-repo conventions shared with
WebSEO_eval.
