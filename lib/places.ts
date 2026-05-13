import type { GbpData } from "./gbp-types";

// Google Places API (New) fallback. Covers basics; the rest is undefined and
// the audits will mark those checks as "skipped: data source limited".

const PLACES_URL = "https://places.googleapis.com/v1/places";

// Field mask: only request what we'll actually use.
const FIELD_MASK = [
  "id",
  "displayName",
  "businessStatus",
  "formattedAddress",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "websiteUri",
  "primaryTypeDisplayName",
  "types",
  "regularOpeningHours",
  "currentOpeningHours.specialDays",
  "editorialSummary",
  "photos",
].join(",");

export async function fetchGbp(
  placeId: string,
  opts?: { apiKey?: string },
): Promise<GbpData> {
  const apiKey = opts?.apiKey ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not set.");

  const resp = await fetch(`${PLACES_URL}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
  });

  if (!resp.ok) {
    throw new Error(`Places API ${resp.status}: ${await resp.text().catch(() => "")}`);
  }
  const p: any = await resp.json();

  const unsupported = [
    "secondaryCategories",
    "attributes",
    "products",
    "services",
    "posts",
    "questions",
    "reviewsOwnerResponses",
    "logoCoverPhotoTypes",
    "videos",
    "photoUploaderOwnerFlag",
  ];

  return {
    source: "places",
    placeId,
    name: p.displayName?.text,
    businessStatus: typeof p.businessStatus === "string" ? p.businessStatus : undefined,
    address: typeof p.formattedAddress === "string" ? p.formattedAddress : undefined,
    isPoBox: looksLikePoBox(p.formattedAddress),
    isVirtualOffice: false,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
    website: typeof p.websiteUri === "string" ? p.websiteUri : undefined,
    primaryCategory: p.primaryTypeDisplayName?.text,
    secondaryCategories: undefined,
    description: p.editorialSummary?.text,
    hoursSet: Boolean(p.regularOpeningHours),
    holidayHoursSet: Array.isArray(p.currentOpeningHours?.specialDays) && p.currentOpeningHours.specialDays.length > 0,
    hasProducts: undefined,
    hasServices: undefined,
    attributes: undefined,
    photos: undefined, // Places returns refs without owner/type info we need.
    logoPresent: undefined,
    coverPresent: undefined,
    videoCount: undefined,
    posts: undefined,
    questions: undefined,
    reviews: undefined,
    unsupported,
  };
}

function looksLikePoBox(address: any): boolean {
  if (typeof address !== "string") return false;
  return /\b(p\.?\s*o\.?\s*box|post office box)\b/i.test(address);
}
