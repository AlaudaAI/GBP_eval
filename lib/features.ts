export type FeatureInputField = {
  name: string;
  label: string;
  placeholder?: string;
  help?: string;
  // If true, this field is always sourced from settings (read-only badge in UI).
  fromSettings?: boolean;
};

export type Feature = {
  slug: string;
  shortLabel: string;
  title: string;
  summary: string;
  whyItMatters: string;
  howToImplement: string[];
  inputs: FeatureInputField[];
  // When true, this audit's score is not counted toward the overall project score.
  optional?: boolean;
};

const PLACE_ID_INPUT: FeatureInputField = {
  name: "placeId",
  label: "Google Place ID",
  placeholder: "ChIJ…",
  help: "Pulled from project settings.",
  fromSettings: true,
};

export const FEATURES: Feature[] = [
  {
    slug: "core-listing",
    shortLabel: "Core Listing Health",
    title: "Core Listing Health",
    summary:
      "Address, phone, website, business status, and duplicate listings.",
    whyItMatters:
      "If the basics on your profile are wrong, customers reach the wrong place or call the wrong number. Google also demotes listings with conflicting information.",
    howToImplement: [
      "Verify the street address shown on your profile is a real, staffed location.",
      "Use a local phone number whose area code matches your service area.",
      "Point the website field at the same domain you give customers.",
      "Make sure business status is set to OPERATIONAL — not closed or relocated.",
      "Search Google Maps for your name and city; close or merge any duplicate listings.",
    ],
    inputs: [PLACE_ID_INPUT],
  },
  {
    slug: "profile-completeness",
    shortLabel: "Profile Completeness",
    title: "Profile Completeness",
    summary:
      "Primary category, logo, description, hours, services, attributes, and no vague categories.",
    whyItMatters:
      "A complete profile gives Google more signals to rank you, and gives customers fewer reasons to bounce. Empty sections show up as blank rows on your listing.",
    howToImplement: [
      "Set a primary category that matches your main service — and avoid vague top-level terms like \"Service\" or \"Establishment\".",
      "Upload a clean square logo at 720×720 minimum.",
      "Write a 200+ character description focused on what you do and who you serve.",
      "Set regular hours for every day you operate, plus holiday hours for the next 3 months.",
      "List every service you offer, and fill at least one attribute (wheelchair accessible, free Wi-Fi, by appointment).",
    ],
    inputs: [PLACE_ID_INPUT],
  },
  {
    slug: "media",
    shortLabel: "Media, Q&A & Reviews",
    title: "Media, Q&A & Reviews",
    summary:
      "Owner answers on Q&A and a review-response rate ≥50%. Photo and video counts shown for context only.",
    whyItMatters:
      "Q&A and review replies are direct customer-facing signals that earn trust and feed Google's freshness signal. Photo and video counts vary by industry, so they're reported but don't count toward the score.",
    howToImplement: [
      "Answer every customer question in Q&A from the owner account.",
      "Reply to at least half of new reviews within a week.",
      "Keep at least 10 photos on the profile at any time (optional, not scored).",
      "Add at least one short video (≤30 seconds) of your team or location (optional, not scored).",
    ],
    inputs: [PLACE_ID_INPUT],
  },
];

export function findFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
