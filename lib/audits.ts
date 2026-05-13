import type { CheckResult, EvalResult } from "./eval-types";
import { scoreFromChecks } from "./eval-types";
import type { GbpData } from "./gbp-types";
import { loadGbp } from "./gbp-source";
import { enhanceRecommendations } from "./llm";
import { findFeature, type Feature } from "./features";
import { deriveAreaCode, type Settings } from "./settings";

const SKIPPED = "skipped: data source limited";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export type AuditInputs = {
  placeId: string;
};

export async function runAudit(
  slug: string,
  inputs: AuditInputs,
  settings: Settings,
): Promise<EvalResult> {
  const feature = findFeature(slug);
  if (!feature) throw new Error(`Unknown audit: ${slug}`);
  if (!inputs.placeId) throw new Error("Missing Place ID.");

  const data = await loadGbp({
    placeId: inputs.placeId,
    outscraperApiKey: settings.outscraperApiKey,
  });

  let build: {
    checks: CheckResult[];
    summary: string;
    fallbackRecs: string[];
    meta?: Record<string, unknown>;
  };
  switch (slug) {
    case "core-listing":
      build = await auditCoreListing(data, settings);
      break;
    case "profile-completeness":
      build = await auditProfileCompleteness(data);
      break;
    case "media":
      build = await auditMedia(data);
      break;
    default:
      throw new Error(`Unimplemented audit: ${slug}`);
  }
  build.meta = { ...(build.meta ?? {}), source: data.source };
  return finalize(feature, build);
}

async function finalize(
  feature: Feature,
  build: {
    checks: CheckResult[];
    summary: string;
    fallbackRecs: string[];
    meta?: Record<string, unknown>;
  },
): Promise<EvalResult> {
  const scored = build.checks.filter((c) => c.detail !== SKIPPED && !c.optional);
  const { score, status } = scoreFromChecks(scored);
  const recommendations = await enhanceRecommendations({
    feature,
    checks: build.checks,
    fallback: build.fallbackRecs,
  });
  return {
    score,
    status,
    summary: build.summary,
    checks: build.checks,
    recommendations,
    meta: build.meta,
  };
}

// ---------- core-listing ----------

async function auditCoreListing(data: GbpData, settings: Settings) {
  const checks: CheckResult[] = [];
  const fallbackRecs: string[] = [];

  if (!data.address) {
    checks.push({ name: "Address present", passed: false, detail: "No address found on the listing." });
    fallbackRecs.push("Add a street address to your profile so customers can find you.");
  } else if (data.isPoBox) {
    checks.push({ name: "Address is a real street address", passed: false, detail: "Listing uses a PO Box — Google guidelines require a staffed street address." });
    fallbackRecs.push("Replace the PO Box with a real street address where customers can visit or where staff work.");
  } else {
    checks.push({ name: "Address is a real street address", passed: true, detail: `Address: ${data.address}.` });
  }

  const expectedAreaCode = settings.localAreaCode || deriveAreaCode(settings.phone);
  if (!data.phone) {
    checks.push({ name: "Phone present", passed: false, detail: "No phone number on the listing." });
    fallbackRecs.push("Add a phone number so customers can call you directly from search results.");
  } else if (expectedAreaCode) {
    const phoneArea = deriveAreaCode(data.phone);
    const ok = phoneArea === expectedAreaCode;
    checks.push({
      name: "Phone uses local area code",
      passed: ok,
      detail: ok
        ? `Area code ${phoneArea} matches the local area code.`
        : `Phone area code ${phoneArea || "unknown"} does not match local area code ${expectedAreaCode}.`,
    });
    if (!ok) fallbackRecs.push(`Use a local ${expectedAreaCode} phone number on your profile.`);
  } else {
    // Can't verify without a configured area code; don't credit a vacuous pass.
    checks.push({
      name: "Phone uses local area code",
      passed: false,
      detail: SKIPPED,
    });
  }

  const expectedDomain = settings.domain ? normalizeDomain(settings.domain) : "";
  if (!data.website) {
    checks.push({ name: "Website URL present", passed: false, detail: "No website URL on the listing." });
    fallbackRecs.push("Add your website to the profile so visitors can learn more about your services.");
  } else if (expectedDomain) {
    const ok = normalizeDomain(data.website) === expectedDomain;
    checks.push({
      name: "Website matches your domain",
      passed: ok,
      detail: ok
        ? `Website ${normalizeDomain(data.website)} matches the configured domain.`
        : `Website on listing is ${normalizeDomain(data.website)}; expected ${expectedDomain}.`,
    });
    if (!ok) fallbackRecs.push(`Point the profile's website field at ${expectedDomain}.`);
  } else {
    checks.push({ name: "Website URL present", passed: true, detail: `Website: ${data.website}.` });
  }

  if (!data.businessStatus) {
    // No status reported — don't credit a vacuous pass.
    checks.push({
      name: "Business status is OPERATIONAL",
      passed: false,
      detail: "Business status not reported on the listing.",
    });
    fallbackRecs.push("Set business status to OPERATIONAL so customers don't think you're closed.");
  } else {
    const statusOk = data.businessStatus === "OPERATIONAL";
    checks.push({
      name: "Business status is OPERATIONAL",
      passed: statusOk,
      detail: statusOk
        ? "Listing is marked operational."
        : `Listing is marked ${data.businessStatus}. Customers will see this on search.`,
    });
    if (!statusOk) fallbackRecs.push("Update business status to OPERATIONAL — closed or relocated listings hide you from results.");
  }

  const failed = checks.filter((c) => !c.passed && c.detail !== SKIPPED).length;
  const summary = failed === 0
    ? "Core listing fundamentals look correct."
    : `${failed} core listing issue${failed === 1 ? "" : "s"} to fix.`;

  return { checks, summary, fallbackRecs };
}

// ---------- profile-completeness ----------

async function auditProfileCompleteness(data: GbpData) {
  const checks: CheckResult[] = [];
  const fallbackRecs: string[] = [];

  if (!data.primaryCategory) {
    checks.push({ name: "Primary category set", passed: false, detail: "No primary category found." });
    fallbackRecs.push("Pick a primary category that matches your most important service.");
  } else {
    checks.push({
      name: "Primary category set",
      passed: true,
      detail: `Primary category: ${data.primaryCategory}.`,
    });
  }

  if (data.secondaryCategories === undefined) {
    checks.push({ name: "No vague top-level categories", passed: false, detail: SKIPPED });
  } else {
    const count = data.secondaryCategories.length;
    const vague = data.secondaryCategories.filter((c) => /^(service|establishment|point of interest|business)$/i.test(c.trim()));
    checks.push({
      name: "No vague top-level categories",
      passed: count > 0 && vague.length === 0,
      detail: count === 0
        ? "No secondary categories to evaluate."
        : vague.length === 0
          ? "All categories are specific."
          : `Vague terms used: ${vague.join(", ")}.`,
    });
    if (vague.length > 0) fallbackRecs.push("Replace generic categories like \"Service\" with specific service types.");
  }

  if (data.logoPresent === undefined) {
    checks.push({ name: "Logo photo present", passed: false, detail: SKIPPED });
  } else {
    checks.push({
      name: "Logo photo present",
      passed: data.logoPresent,
      detail: data.logoPresent ? "Logo is on the profile." : "No logo photo found.",
    });
    if (!data.logoPresent) fallbackRecs.push("Upload a clean square logo so customers recognize your brand on search.");
  }

  if (data.description === undefined) {
    checks.push({ name: "Description ≥ 200 chars", passed: false, detail: SKIPPED, weight: 0.5 });
  } else {
    const ok = data.description.length >= 200;
    checks.push({
      name: "Description ≥ 200 chars",
      passed: ok,
      detail: ok ? `Description is ${data.description.length} chars.` : `Description is only ${data.description.length} chars (need 200+).`,
      weight: 0.5,
    });
    if (!ok) fallbackRecs.push("Expand your profile description to at least 200 characters, focusing on what you do and for whom.");
  }

  if (data.hoursSet === undefined) {
    checks.push({ name: "Regular hours set", passed: false, detail: SKIPPED });
  } else {
    checks.push({
      name: "Regular hours set",
      passed: data.hoursSet,
      detail: data.hoursSet ? "Regular hours configured." : "No regular hours set.",
    });
    if (!data.hoursSet) fallbackRecs.push("Set your regular operating hours for every day you're open.");
  }

  if (data.holidayHoursSet === undefined) {
    checks.push({ name: "Holiday hours set for next 3 months", passed: false, detail: SKIPPED, optional: true });
  } else {
    checks.push({
      name: "Holiday hours set for next 3 months",
      passed: data.holidayHoursSet,
      detail: data.holidayHoursSet ? "Holiday hours are set." : "No upcoming holiday hours found in the next 90 days.",
      optional: true,
    });
    if (!data.holidayHoursSet) fallbackRecs.push("Add holiday hours for any upcoming closures so customers don't show up to a locked door.");
  }

  if (data.hasServices === undefined) {
    checks.push({ name: "Services listed", passed: false, detail: SKIPPED });
  } else {
    checks.push({
      name: "Services listed",
      passed: Boolean(data.hasServices),
      detail: data.hasServices ? "Services section populated." : "No services listed.",
    });
    if (!data.hasServices) fallbackRecs.push("Add every service you offer to the Services section.");
  }

  if (data.attributes === undefined) {
    checks.push({ name: "At least one attribute set", passed: false, detail: SKIPPED });
  } else {
    const ok = data.attributes.length > 0;
    checks.push({
      name: "At least one attribute set",
      passed: ok,
      detail: ok ? `${data.attributes.length} attribute(s) set.` : "No attributes selected.",
    });
    if (!ok) fallbackRecs.push("Pick at least one attribute (wheelchair accessible, free Wi-Fi, by appointment, etc.).");
  }

  const failed = checks.filter((c) => !c.passed && c.detail !== SKIPPED).length;
  const summary = failed === 0 ? "Profile sections are well filled in." : `${failed} profile section${failed === 1 ? "" : "s"} need filling in.`;
  return { checks, summary, fallbackRecs };
}

// ---------- media ----------

async function auditMedia(data: GbpData) {
  const checks: CheckResult[] = [];
  const fallbackRecs: string[] = [];

  const photos = data.photos ?? [];
  const photoCountKnown = data.photos !== undefined;
  if (!photoCountKnown) {
    checks.push({ name: "At least 10 photos total", passed: false, detail: SKIPPED, optional: true });
  } else {
    const ok = photos.length >= 10;
    checks.push({
      name: "At least 10 photos total",
      passed: ok,
      detail: ok ? `${photos.length} photos on the profile.` : `Only ${photos.length} photos (target: 10+).`,
      optional: true,
    });
    if (!ok) fallbackRecs.push("Add more photos — aim for at least 10 covering interior, exterior, team, and work samples.");
  }

  if (data.videoCount === undefined) {
    checks.push({ name: "At least 1 video", passed: false, detail: SKIPPED, optional: true });
  } else {
    const hasVideo = data.videoCount >= 1;
    checks.push({
      name: "At least 1 video",
      passed: hasVideo,
      detail: hasVideo ? `${data.videoCount} video(s) uploaded.` : "No videos uploaded.",
      optional: true,
    });
    if (!hasVideo) fallbackRecs.push("Upload a short video (≤30 seconds) to stand out in search results.");
  }

  const now = Date.now();
  if (data.questions === undefined) {
    checks.push({ name: "Every Q&A has an owner response", passed: false, detail: SKIPPED, weight: 0.5 });
  } else if (data.questions.length === 0) {
    checks.push({
      name: "Every Q&A has an owner response",
      passed: false,
      detail: "No customer questions on the listing yet.",
      weight: 0.5,
    });
    fallbackRecs.push("Seed your Q&A with the questions customers ask most often, then answer them from the owner account.");
  } else {
    const unanswered = data.questions.filter((q) => !q.ownerAnswered);
    const ok = unanswered.length === 0;
    checks.push({
      name: "Every Q&A has an owner response",
      passed: ok,
      detail: ok ? `${data.questions.length} question(s), all answered by the owner.` : `${unanswered.length} of ${data.questions.length} question(s) have no owner response.`,
      weight: 0.5,
    });
    if (!ok) fallbackRecs.push("Answer every Q&A question from the owner account — leaving customers' questions hanging looks unresponsive.");
  }

  if (data.reviews === undefined) {
    checks.push({ name: "Review-response rate ≥ 50% (last 30 days)", passed: false, detail: SKIPPED, weight: 0.5 });
  } else {
    const recent = data.reviews.filter((r) => r.publishedAt >= now - THIRTY_DAYS);
    if (recent.length === 0) {
      checks.push({
        name: "Review-response rate ≥ 50% (last 30 days)",
        passed: false,
        detail: "No new reviews in the last 30 days — low review velocity is a ranking signal.",
        weight: 0.5,
      });
      fallbackRecs.push("Ask recent customers to leave a review — listings with steady review flow rank higher.");
    } else {
      const responded = recent.filter((r) => r.ownerResponse).length;
      const rate = responded / recent.length;
      const ok = rate >= 0.5;
      checks.push({
        name: "Review-response rate ≥ 50% (last 30 days)",
        passed: ok,
        detail: `Responded to ${responded} of ${recent.length} recent review(s) (${Math.round(rate * 100)}%).`,
        weight: 0.5,
      });
      if (!ok) fallbackRecs.push("Reply to at least half of new reviews within a week — show customers you're paying attention.");
    }
  }

  const failed = checks.filter((c) => !c.passed && c.detail !== SKIPPED).length;
  const summary = failed === 0 ? "Media and customer-voice signals look healthy." : `${failed} media/voice signal${failed === 1 ? "" : "s"} to fix.`;
  return { checks, summary, fallbackRecs };
}

// ---------- helpers ----------

function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split("/")[0];
  s = s.split("?")[0];
  return s;
}
