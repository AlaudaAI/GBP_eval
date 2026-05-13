// Normalized shape that audits consume. Both outscraper.ts and places.ts
// emit this; fields the underlying source can't provide are left undefined,
// and audits surface them as "skipped: data source limited".

export type GbpPhoto = {
  type?: "logo" | "cover" | "interior" | "exterior" | "team" | "menu" | "other";
  uploadedByOwner?: boolean;
  uploadedAt?: number; // ms epoch
};

export type GbpPost = {
  publishedAt: number; // ms epoch
  type?: string;
  summary?: string;
};

export type GbpReview = {
  rating?: number;
  publishedAt: number;
  ownerResponse?: { text: string; respondedAt?: number } | null;
};

export type GbpQuestion = {
  question: string;
  publishedAt: number;
  ownerAnswered: boolean;
};

export type GbpData = {
  source: "outscraper" | "places";
  placeId: string;

  // Core identity
  name?: string;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | "RELOCATED" | string;
  address?: string;
  isPoBox?: boolean;
  isVirtualOffice?: boolean;
  phone?: string;
  website?: string;

  // Categorization
  primaryCategory?: string;
  secondaryCategories?: string[];

  // Profile sections
  description?: string;
  hoursSet?: boolean;
  holidayHoursSet?: boolean;
  hasProducts?: boolean;
  hasServices?: boolean;
  attributes?: string[]; // e.g. "wheelchair_accessible", "free_wifi"

  // Media
  photos?: GbpPhoto[];
  logoPresent?: boolean;
  coverPresent?: boolean;
  videoCount?: number;

  // Engagement
  posts?: GbpPost[];
  questions?: GbpQuestion[];
  reviews?: GbpReview[];

  // Which fields the underlying source could not populate.
  unsupported?: string[];
};
