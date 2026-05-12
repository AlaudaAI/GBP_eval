import Anthropic from "@anthropic-ai/sdk";
import type { Feature } from "./features";
import type { CheckResult } from "./eval-types";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_RECS = 5;
const MAX_REC_CHARS = 220;

let cached: Anthropic | null = null;
function client(): Anthropic | null {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  cached = new Anthropic({ apiKey: key });
  return cached;
}

const SYSTEM = `You are an SEO consultant writing recommendations for a small-business owner.

HARD RULES
- Output ONLY JSON matching the schema. No markdown, no prose preamble.
- 1–5 recommendation strings, each 10–25 words, max 30 words.
- Outcome-focused, plain English. No jargon.
- Address the business owner directly ("Add a logo so customers recognize you in search").
- Never reference internal terms like "audit", "score", "check".
- Prefer concrete actions over abstractions ("Add 3 interior photos" not "Improve photo strategy").

JARGON → PLAIN ENGLISH
- "NAP consistency" → "matching contact info"
- "SERP" → "search results"
- "CTR" → "people clicking through"
- "schema markup" → "structured data on your site"

GOOD: "Add a clear logo to your profile so customers recognize you when you appear in Google Maps."
BAD:  "Implement brand-aligned logo assets to maximize SERP visibility and brand recall."`;

export async function enhanceRecommendations(args: {
  feature: Feature;
  checks: CheckResult[];
  fallback: string[];
}): Promise<string[]> {
  const c = client();
  if (!c) return capFallback(args.fallback);
  try {
    const failed = args.checks.filter((c) => !c.passed);
    if (failed.length === 0) return [];
    const userPayload = {
      feature: { slug: args.feature.slug, title: args.feature.title },
      failed_checks: failed.map((f) => ({ name: f.name, detail: f.detail })),
    };
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Generate 3–5 outcome-focused recommendations for the failed checks below. " +
                "Output JSON only: {\"recommendations\": string[]}.\n\n" +
                JSON.stringify(userPayload),
            },
          ],
        },
      ],
    });
    const text = firstText(resp);
    const parsed = safeJSON<{ recommendations: string[] }>(text);
    const recs = parsed?.recommendations;
    if (!recs || !Array.isArray(recs)) return capFallback(args.fallback);
    return cap(recs);
  } catch {
    return capFallback(args.fallback);
  }
}

function firstText(resp: { content: Array<{ type: string; text?: string }> }): string {
  for (const block of resp.content) {
    if (block.type === "text" && typeof block.text === "string") return block.text;
  }
  return "";
}

function safeJSON<T>(text: string): T | null {
  try {
    const trimmed = text.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function cap(recs: string[]): string[] {
  return recs
    .filter((r) => typeof r === "string" && r.trim().length > 0)
    .map((r) => (r.length > MAX_REC_CHARS ? r.slice(0, MAX_REC_CHARS - 1).trim() + "…" : r))
    .slice(0, MAX_RECS);
}

function capFallback(recs: string[]): string[] {
  return cap(recs);
}
