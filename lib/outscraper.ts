import type { GbpData, GbpPhoto, GbpPost, GbpQuestion, GbpReview } from "./gbp-types";

const SEARCH_URL = "https://api.outscraper.com/maps/search-v3";
const REVIEWS_URL = "https://api.outscraper.com/maps/reviews-v3";
const QA_URL = "https://api.outscraper.com/maps/questions-and-answers";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const OUTSCRAPER_TIMEOUT_MS = 12_000;

export class OutscraperNoProfileError extends Error {
  readonly placeId: string;
  constructor(placeId: string) {
    super("Outscraper returned no profile for the given Place ID.");
    this.name = "OutscraperNoProfileError";
    this.placeId = placeId;
  }
}

export async function fetchGbp(
  placeId: string,
  opts?: { apiKey?: string },
): Promise<GbpData> {
  const apiKey = opts?.apiKey ?? process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) throw new Error("OUTSCRAPER_API_KEY is not set.");

  const headers = { "X-API-KEY": apiKey };

  let profileRaw: unknown;
  try {
    profileRaw = await fetchJSON(
      `${SEARCH_URL}?query=${encodeURIComponent(placeId)}&limit=1&async=false&language=en`,
      headers,
    );
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      // Distinguish timeouts from "not indexed" — the previous behavior
      // conflated the two and routed timeouts to the Places fallback.
      throw new Error(`Outscraper timed out fetching ${placeId} after ${OUTSCRAPER_TIMEOUT_MS}ms.`);
    }
    throw e;
  }

  const profile = pickFirst(profileRaw);
  if (!profile) {
    throw new OutscraperNoProfileError(placeId);
  }

  const [reviewsRaw, qaRaw] = await Promise.all([
    fetchJSON(
      `${REVIEWS_URL}?query=${encodeURIComponent(placeId)}&reviewsLimit=50&async=false&cutoff=${Math.floor((Date.now() - ONE_YEAR_MS) / 1000)}`,
      headers,
    ).catch(() => null),
    fetchJSON(
      `${QA_URL}?query=${encodeURIComponent(placeId)}&async=false&limit=20`,
      headers,
    ).catch(() => null),
  ]);
  const reviewsArr = pickList(reviewsRaw);
  const qaArr = pickList(qaRaw);

  const data: GbpData = {
    source: "outscraper",
    placeId,
    name: str(profile.name),
    businessStatus: str(profile.business_status),
    address: str(profile.full_address ?? profile.address),
    phone: str(profile.phone),
    website: str(profile.site ?? profile.website),
    primaryCategory: str(profile.category ?? profile.type ?? firstCategory(profile.subtypes)),
    secondaryCategories: dedupeKeepingNonPrimary(
      flattenCategories(profile.categories ?? profile.subtypes),
      profile.category ?? profile.type,
    ),
    // Always a string (empty when missing) so the audit reports "0 chars"
    // rather than skipping the check — Outscraper exposes description when
    // the business has set one.
    description: pickDescription(profile),
    hoursSet:
      isPlainObject(profile.working_hours) &&
      Object.keys(profile.working_hours).length > 0,
    holidayHoursSet: hasUpcomingHolidayHours(profile),
    hasProducts: Boolean(profile.products?.length),
    hasServices: Boolean(profile.services?.length),
    attributes: flattenAttributes(profile.about ?? profile.attributes),
    photos: parsePhotos(profile.photos ?? profile.photos_data),
    logoPresent: Boolean(profile.logo ?? hasPhotoOfType(profile.photos, "logo")),
    coverPresent: Boolean(profile.cover ?? hasPhotoOfType(profile.photos, "cover")),
    videoCount: countVideos(profile),
    posts: parsePosts(profile.posts),
    questions: parseQuestions(qaArr),
    reviews: parseReviews(reviewsArr),
    isPoBox: looksLikePoBox(profile.full_address ?? profile.address),
    isVirtualOffice: false,
  };

  return data;
}

async function fetchJSON(url: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), OUTSCRAPER_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    if (!resp.ok) {
      throw new Error(
        `Outscraper ${resp.status}: ${await resp.text().catch(() => "")}`,
      );
    }
    return await resp.json();
  } finally {
    clearTimeout(handle);
  }
}

function pickFirst(raw: any): any {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (Array.isArray(raw[0])) return raw[0][0] ?? null;
    return raw[0] ?? null;
  }
  if (Array.isArray(raw.data)) {
    if (Array.isArray(raw.data[0])) return raw.data[0][0] ?? null;
    return raw.data[0] ?? null;
  }
  return null;
}

function pickList(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return Array.isArray(raw[0]) ? raw[0] : raw;
  if (Array.isArray(raw.data)) return Array.isArray(raw.data[0]) ? raw.data[0] : raw.data;
  return [];
}

function str(v: any): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// Outscraper's `subtypes` is usually a comma-separated string. `categories`
// is occasionally an array. Normalize to a deduped string list.
function flattenCategories(v: any): string[] {
  let parts: string[] = [];
  if (Array.isArray(v)) parts = v.filter((x): x is string => typeof x === "string");
  else if (typeof v === "string") parts = v.split(",");
  return parts.map((s) => s.trim()).filter(Boolean);
}

function pickDescription(profile: any): string {
  const candidates = [
    profile.description,
    profile.about?.description,
    profile.editorial_summary,
    profile.summary,
  ];
  for (const c of candidates) {
    if (typeof c === "string") return c;
  }
  return "";
}

function firstCategory(v: any): string | undefined {
  const list = flattenCategories(v);
  return list[0];
}

function dedupeKeepingNonPrimary(list: string[], primary: any): string[] {
  const primaryNorm = typeof primary === "string" ? primary.trim().toLowerCase() : "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of list) {
    const norm = c.toLowerCase();
    if (norm === primaryNorm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(c);
  }
  return out;
}

// Outscraper's `about` is a nested object like
//   { "Accessibility": { "Wheelchair-accessible entrance": true, ... },
//     "Service options": { "Online appointments": true, ... } }
// Flatten to a flat list of human-readable attribute names that are enabled.
function flattenAttributes(v: any): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (!v || typeof v !== "object") return [];
  const out: string[] = [];
  for (const section of Object.values(v as Record<string, unknown>)) {
    if (!section || typeof section !== "object") continue;
    for (const [name, enabled] of Object.entries(section as Record<string, unknown>)) {
      if (enabled === true) out.push(name);
    }
  }
  return out;
}
function isPlainObject(v: any): v is Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v);
}

function looksLikePoBox(address: any): boolean {
  if (typeof address !== "string") return false;
  return /\b(p\.?\s*o\.?\s*box|post office box)\b/i.test(address);
}

function hasUpcomingHolidayHours(profile: any): boolean {
  const list = profile.special_hours ?? profile.holiday_hours ?? profile.specialOpeningHours;
  if (!Array.isArray(list) || list.length === 0) return false;
  const now = Date.now();
  const horizon = now + 90 * 24 * 60 * 60 * 1000;
  for (const entry of list) {
    const ts = parseDateMs(entry.date ?? entry.day);
    if (ts && ts >= now && ts <= horizon) return true;
  }
  return false;
}

function parseDateMs(v: any): number | null {
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function hasPhotoOfType(photos: any, type: string): boolean {
  if (!Array.isArray(photos)) return false;
  return photos.some((p) => typeof p?.type === "string" && p.type.toLowerCase() === type);
}

function parsePhotos(raw: any): GbpPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any): GbpPhoto => ({
    type: normalizePhotoType(p?.type ?? p?.category),
    uploadedByOwner: p?.uploaded_by_owner === true || p?.owner === true || p?.tags?.includes?.("owner"),
    uploadedAt: parseDateMs(p?.date ?? p?.uploaded_at) ?? undefined,
  }));
}

function normalizePhotoType(t: any): GbpPhoto["type"] {
  if (typeof t !== "string") return "other";
  const low = t.toLowerCase();
  if (low.includes("logo")) return "logo";
  if (low.includes("cover")) return "cover";
  if (low.includes("interior")) return "interior";
  if (low.includes("exterior")) return "exterior";
  if (low.includes("team")) return "team";
  if (low.includes("menu") || low.includes("product")) return "menu";
  return "other";
}

function countVideos(profile: any): number {
  if (Array.isArray(profile.videos)) return profile.videos.length;
  if (typeof profile.video_count === "number") return profile.video_count;
  return 0;
}

function parsePosts(raw: any): GbpPost[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: any): GbpPost | null => {
      const publishedAt = parseDateMs(p?.published_at ?? p?.date ?? p?.created_at);
      if (!publishedAt) return null;
      return {
        publishedAt,
        type: str(p?.type ?? p?.topic_type),
        summary: str(p?.summary ?? p?.text),
      };
    })
    .filter((p): p is GbpPost => p !== null);
}

function parseQuestions(raw: any[]): GbpQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q: any): GbpQuestion | null => {
      const publishedAt = parseDateMs(q?.published_at ?? q?.date);
      if (!q?.question || !publishedAt) return null;
      const answers = Array.isArray(q.answers) ? q.answers : [];
      const ownerAnswered = answers.some(
        (a: any) => a?.is_owner === true || a?.from_owner === true || a?.author_type === "owner",
      );
      return { question: String(q.question), publishedAt, ownerAnswered };
    })
    .filter((q): q is GbpQuestion => q !== null);
}

function parseReviews(raw: any[]): GbpReview[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any): GbpReview | null => {
      const publishedAt = parseDateMs(r?.review_datetime_utc ?? r?.published_at_date ?? r?.date);
      if (!publishedAt) return null;
      const ownerText = r?.owner_answer ?? r?.response_from_owner_text;
      const ownerResponse = ownerText
        ? {
            text: String(ownerText),
            respondedAt: parseDateMs(r?.owner_answer_timestamp ?? r?.response_from_owner_date) ?? undefined,
          }
        : null;
      return {
        rating: typeof r?.review_rating === "number" ? r.review_rating : (typeof r?.rating === "number" ? r.rating : undefined),
        publishedAt,
        ownerResponse,
      };
    })
    .filter((r): r is GbpReview => r !== null);
}

export const _internals = { NINETY_DAYS_MS };
