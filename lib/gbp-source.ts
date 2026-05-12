import type { GbpData } from "./gbp-types";
import { fetchGbp as fetchFromOutscraper, OutscraperNoProfileError } from "./outscraper";
import { fetchGbp as fetchFromPlaces } from "./places";

// Single entry point used by audits. Routes to Outscraper if its key is set
// (per-project override wins over env), Places otherwise. When Outscraper
// has no record for the Place ID (their cache miss), automatically falls
// back to Places so the audit still completes with the basic fields.
export async function loadGbp(args: {
  placeId: string;
  outscraperApiKey?: string;
}): Promise<GbpData> {
  const outscraperKey = args.outscraperApiKey || process.env.OUTSCRAPER_API_KEY;
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;

  if (outscraperKey) {
    try {
      return await fetchFromOutscraper(args.placeId, { apiKey: outscraperKey });
    } catch (e) {
      if (e instanceof OutscraperNoProfileError && placesKey) {
        console.warn(
          `[gbp-source] Outscraper had no data for ${args.placeId}; falling back to Google Places.`,
        );
        return fetchFromPlaces(args.placeId);
      }
      throw e;
    }
  }
  if (placesKey) {
    return fetchFromPlaces(args.placeId);
  }
  throw new Error(
    "No GBP data source configured. Set OUTSCRAPER_API_KEY or GOOGLE_PLACES_API_KEY.",
  );
}
