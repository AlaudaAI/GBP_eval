import type { GbpData } from "./gbp-types";
import { fetchGbp as fetchFromOutscraper } from "./outscraper";
import { fetchGbp as fetchFromPlaces } from "./places";

// Single entry point used by audits. Routes to Outscraper if its key is set
// (per-project override wins over env), Places otherwise.
export async function loadGbp(args: {
  placeId: string;
  outscraperApiKey?: string;
}): Promise<GbpData> {
  const outscraperKey = args.outscraperApiKey || process.env.OUTSCRAPER_API_KEY;
  if (outscraperKey) {
    return fetchFromOutscraper(args.placeId, { apiKey: outscraperKey });
  }
  if (process.env.GOOGLE_PLACES_API_KEY) {
    return fetchFromPlaces(args.placeId);
  }
  throw new Error(
    "No GBP data source configured. Set OUTSCRAPER_API_KEY or GOOGLE_PLACES_API_KEY.",
  );
}
