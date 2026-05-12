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
    shortLabel: "Core Listing",
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
    slug: "categories",
    shortLabel: "Categories",
    title: "Primary & Secondary Categories",
    summary:
      "Primary category match, 3–9 secondary categories, no vague top-level terms.",
    whyItMatters:
      "Google ranks you for the services tied to your primary category. Missing or vague categories means you don't show up for the queries your customers actually type.",
    howToImplement: [
      "Set the primary category to the most specific term that matches your main service.",
      "Add 3–9 secondary categories covering every distinct service you offer.",
      "Avoid generic top-level terms like \"Service\" or \"Establishment\".",
      "Review categories quarterly — Google adds new ones every year.",
      "Cross-check against the services listed on your website.",
    ],
    inputs: [PLACE_ID_INPUT],
  },
  {
    slug: "profile-completeness",
    shortLabel: "Profile Sections",
    title: "Profile Completeness",
    summary:
      "Description, regular hours, holiday hours, products, services, and attributes.",
    whyItMatters:
      "A complete profile gives Google more signals to rank you, and gives customers fewer reasons to bounce. Empty sections show up as blank rows on your listing.",
    howToImplement: [
      "Write a 200+ character description focused on what you do and who you serve.",
      "Set regular hours for every day you operate.",
      "Add holiday hours for the next 3 months (Thanksgiving, Christmas, etc.).",
      "List products if applicable; list services either way.",
      "Fill at least one attribute (wheelchair accessible, free Wi-Fi, by appointment).",
    ],
    inputs: [PLACE_ID_INPUT],
  },
  {
    slug: "media",
    shortLabel: "Media",
    title: "Photos, Videos, Logo & Cover",
    summary:
      "Logo, cover photo, ≥10 total photos, ≥1 video, and recent owner uploads.",
    whyItMatters:
      "Listings with fresh photos get more clicks and direction requests. A missing logo or cover photo is the first thing a customer notices.",
    howToImplement: [
      "Upload a clean square logo at 720×720 minimum.",
      "Upload a wide cover photo that shows your storefront or workplace.",
      "Keep at least 10 photos on the profile at any time.",
      "Add at least one short video (≤30 seconds) of your team or location.",
      "Upload 3+ new photos every 90 days to signal you're active.",
    ],
    inputs: [PLACE_ID_INPUT],
  },
  {
    slug: "engagement",
    shortLabel: "Engagement",
    title: "Posts, Q&A & Reviews",
    summary:
      "Recent Google Posts, owner answers on Q&A, and a review-response rate ≥50%.",
    whyItMatters:
      "Posts and replies signal to Google that your business is active. Customers reading your replies see whether you actually engage — or ignore them.",
    howToImplement: [
      "Publish a Google Post at least once a week.",
      "Answer every customer question in Q&A from the owner account.",
      "Reply to at least half of new reviews within a week.",
      "Use review replies to address specifics, not generic thank-yous.",
      "Pre-seed common questions you get from customers in the Q&A section.",
    ],
    inputs: [PLACE_ID_INPUT],
  },
];

export function findFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
