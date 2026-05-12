// Free-text business search via Google Places API (New). Used by Settings to
// populate project fields without users having to dig up a Place ID by hand.

export type BusinessCandidate = {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  primaryCategory?: string;
};

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.primaryTypeDisplayName",
].join(",");

export async function searchBusinesses(
  query: string,
  opts?: { apiKey?: string; pageSize?: number },
): Promise<BusinessCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const apiKey = opts?.apiKey ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is not set. Required for business search.",
    );
  }

  const resp = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ textQuery: trimmed, pageSize: opts?.pageSize ?? 8 }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Places search ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = (await resp.json()) as { places?: PlacesSearchResult[] };
  return (data.places ?? [])
    .map(
      (p): BusinessCandidate => ({
        placeId: p.id ?? "",
        name: p.displayName?.text ?? "",
        address: p.formattedAddress ?? "",
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber,
        website: p.websiteUri,
        primaryCategory: p.primaryTypeDisplayName?.text,
      }),
    )
    .filter((c) => c.placeId && c.name);
}

type PlacesSearchResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
};
