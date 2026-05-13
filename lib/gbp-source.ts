import { Redis } from "@upstash/redis";
import type { GbpData } from "./gbp-types";
import { fetchGbp as fetchFromOutscraper } from "./outscraper";
import { fetchGbp as fetchFromPlaces } from "./places";

// Cache successful Outscraper fetches for a minute so Run All (which fires
// every audit back-to-back for the same Place ID) doesn't call Outscraper
// repeatedly. Outscraper's own cache is flaky on cold lookups, so sharing
// one fetch per Run All eliminates mixed-source results.
//
// Only successful Outscraper responses are cached.

const CACHE_PREFIX = "gbp:cache:";
const CACHE_TTL_SEC = 60;

let cache: Redis | null = null;
function cacheClient(): Redis | null {
  if (cache) return cache;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  cache = new Redis({ url, token });
  return cache;
}

async function readCache(placeId: string): Promise<GbpData | null> {
  const c = cacheClient();
  if (!c) return null;
  try {
    const raw = await c.get<GbpData | string>(CACHE_PREFIX + placeId);
    if (!raw) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as GbpData) : raw;
  } catch {
    return null;
  }
}

async function writeCache(data: GbpData): Promise<void> {
  const c = cacheClient();
  if (!c) return;
  try {
    await c.set(CACHE_PREFIX + data.placeId, JSON.stringify(data), {
      ex: CACHE_TTL_SEC,
    });
  } catch {
    // Non-fatal.
  }
}

export async function loadGbp(args: {
  placeId: string;
  outscraperApiKey?: string;
}): Promise<GbpData> {
  const cached = await readCache(args.placeId);
  if (cached) return cached;

  const outscraperKey = args.outscraperApiKey || process.env.OUTSCRAPER_API_KEY;
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;

  // Outscraper-only by design: when an Outscraper key is configured we never
  // silently fall back to Google Places, which has far less data. The audit
  // surfaces Outscraper's error instead so we can fix it at the source.
  if (outscraperKey) {
    const data = await fetchFromOutscraper(args.placeId, { apiKey: outscraperKey });
    await writeCache(data);
    return data;
  }
  if (placesKey) {
    return fetchFromPlaces(args.placeId);
  }
  throw new Error(
    "No GBP data source configured. Set OUTSCRAPER_API_KEY or GOOGLE_PLACES_API_KEY.",
  );
}
