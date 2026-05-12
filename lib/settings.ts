export type Settings = {
  businessName: string;
  domain: string;
  phone: string;
  address: string;
  gbpName: string;
  cities: string;
  services: string;
  googlePlaceId: string;
  localAreaCode: string;
  outscraperApiKey: string;
};

export const SETTING_LABELS: Record<keyof Settings, string> = {
  businessName: "Business name",
  domain: "Website domain",
  phone: "Phone number",
  address: "Street address",
  gbpName: "Google Business Profile name",
  cities: "Service cities (comma-separated)",
  services: "Services (comma-separated)",
  googlePlaceId: "Google Place ID (ChIJ…)",
  localAreaCode: "Local area code (override)",
  outscraperApiKey: "Outscraper API key (per-project override)",
};

export const SETTING_HELP: Partial<Record<keyof Settings, string>> = {
  googlePlaceId:
    "The ChIJ… ID from Google's Place ID Finder. Required for every audit.",
  localAreaCode:
    "Optional. Overrides our heuristic if it picks the wrong local area code.",
  outscraperApiKey:
    "Optional. Overrides OUTSCRAPER_API_KEY for this project only.",
};

export const SETTING_ORDER: (keyof Settings)[] = [
  "businessName",
  "googlePlaceId",
  "domain",
  "phone",
  "address",
  "gbpName",
  "cities",
  "services",
  "localAreaCode",
  "outscraperApiKey",
];

export const REQUIRED_SETTINGS: (keyof Settings)[] = [
  "businessName",
  "googlePlaceId",
];

export function emptySettings(): Settings {
  return {
    businessName: "",
    domain: "",
    phone: "",
    address: "",
    gbpName: "",
    cities: "",
    services: "",
    googlePlaceId: "",
    localAreaCode: "",
    outscraperApiKey: "",
  };
}

// Map a feature-input name to its default value from settings.
// Audit forms read this to prefill fields with a "from settings" pill.
export function defaultValueForInput(
  name: string,
  settings: Settings,
): string {
  switch (name) {
    case "placeId":
    case "googlePlaceId":
      return settings.googlePlaceId;
    case "domain":
    case "website":
      return settings.domain;
    case "phone":
      return settings.phone;
    case "address":
      return settings.address;
    case "businessName":
    case "gbpName":
      return settings.gbpName || settings.businessName;
    case "localAreaCode":
      return settings.localAreaCode || deriveAreaCode(settings.phone);
    case "cities":
      return settings.cities;
    case "services":
      return settings.services;
    default:
      return "";
  }
}

// Best-effort: pull a 3-digit area code out of a US-style phone.
// Returns "" if we can't be confident. Users can override via settings.localAreaCode.
export function deriveAreaCode(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length === 10) return digits.slice(0, 3);
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1, 4);
  return "";
}
