import Anthropic from "@anthropic-ai/sdk";
import type { Project } from "./workspace-types";
import { FEATURES } from "./features";

const MODEL = "claude-haiku-4-5-20251001";
const TARGET_ITEMS = 5;
const MAX_TITLE_CHARS = 70;
const MAX_BODY_CHARS = 220;

const GROWTH_FILLERS: Array<{ title: string; body: string }> = [
  {
    title: "Build review momentum",
    body: "Customers trust businesses with a steady stream of recent reviews. Make review requests a routine part of how you close every job.",
  },
  {
    title: "Show an active, current business",
    body: "Profiles that look maintained convert better. Regular updates — photos, posts, seasonal notes — signal that you're paying attention.",
  },
  {
    title: "Strengthen the customer-voice signal",
    body: "Visible Q&A answers and review replies are the clearest sign that a business is responsive. They shape first impressions before a customer ever calls.",
  },
  {
    title: "Sharpen category positioning",
    body: "Showing up for the right searches starts with how you're categorized. Periodically revisit categories as your service mix evolves.",
  },
  {
    title: "Plan for seasonal moments",
    body: "Holiday hours, busy-season posts, and timely promotions turn search visibility into bookings during the periods that matter most.",
  },
  {
    title: "Lean into rich media over time",
    body: "Photos and short videos are still the most effective profile assets. A small library, refreshed regularly, compounds over months.",
  },
];

export type PlanPriority = "P0" | "P1" | "P2" | "P3";

export type PlanItem = {
  priority: PlanPriority;
  title: string;
  body: string;
  source: string;
};

export type ActionPlan = {
  diagnosis: string;
  items: PlanItem[];
};

const SYSTEM = `You are a senior local-SEO consultant writing a brief for a small-business client.

The client will read this plan; an internal team executes it. So your job is to
explain WHAT to focus on and WHY it matters to customers — not to hand the
client step-by-step instructions. Think strategic recommendations from an
advisor, not a checklist from an implementer.

HARD RULES
- Output ONLY JSON: {"diagnosis": string, "items": PlanItem[]}.
- diagnosis: ONE sentence, max 30 words, plain English, framed around the
  customer experience or business outcome (not a count of failed checks).
- Aim for 5 items. 3–5 is acceptable if the listing is genuinely strong;
  never exceed 5.
- Order items by priority (P0 first).
- title: ≤ 60 chars, a strategic theme or focus area, not an imperative task.
  GOOD: "Strengthen first-impression signals", "Rebuild category positioning"
  BAD:  "Upload a 720x720 logo to GBP", "Set holiday hours for Thanksgiving"
- body: ≤ 30 words, explains WHY this matters to customers and what good
  looks like — not the steps to do it.
- source: the audit slug it came from (e.g. "core-listing", "profile-completeness",
  "media") for items rooted in a failed check, or "growth" for proactive
  strategic add-ons.

INPUT NOTES
- failed_checks is already filtered to only checks that affect the score.
- Each check has a "weight" field (1 = standard, 0.5 = soft signal).
  Group related weight-0.5 items into one strategic theme rather than
  surfacing each as its own row.

REACHING 5 ITEMS
- Cluster related failed checks into one strategic theme (e.g. multiple
  profile-completeness gaps → "Round out the profile basics").
- If there are fewer than 5 themes after clustering, fill remaining rows
  with proactive growth recommendations (review momentum, ongoing media
  refresh, customer-voice strengthening, category positioning, seasonal
  planning). Use source "growth" and priority P3 for these.

PRIORITY GUIDE
- P0: visible to customers right now and actively hurting trust (wrong phone,
  closed status, no primary category, no logo, no address)
- P1: missing fundamentals that limit how the listing performs (no description,
  hours absent, services list empty)
- P2: soft / weight-0.5 signals as a cluster (description depth, Q&A coverage,
  review-response cadence)
- P3: proactive growth recommendations, longer-horizon plays

VOICE
- Plain English, consultative. No GBP/SEO jargon, no implementation steps,
  no pixel dimensions, no exact word counts.`;

let cached: Anthropic | null = null;
function client(): Anthropic | null {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  cached = new Anthropic({ apiKey: key });
  return cached;
}

export async function generateActionPlan(project: Project): Promise<ActionPlan> {
  const failedChecks = collectFailedChecks(project);
  const c = client();
  if (!c) return deterministicPlan(failedChecks);

  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 1500,
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
                "Draft a consultant-style action plan (3–5 strategic themes, 5 preferred). " +
                "Cluster related failed checks into themes; fill any remaining rows with " +
                "proactive growth recommendations. Output JSON only.\n\n" +
                JSON.stringify({
                  business: project.name,
                  failed_checks: failedChecks,
                }),
            },
          ],
        },
      ],
    });
    const text = firstText(resp);
    const parsed = safeJSON<ActionPlan>(text);
    if (!parsed || !Array.isArray(parsed.items)) return deterministicPlan(failedChecks);
    return capPlan(parsed, failedChecks.length);
  } catch {
    return deterministicPlan(failedChecks);
  }
}

function collectFailedChecks(project: Project): Array<{
  audit: string;
  check: string;
  detail: string;
  weight: number;
}> {
  const out: Array<{ audit: string; check: string; detail: string; weight: number }> = [];
  for (const feature of FEATURES) {
    const cached = project.results[feature.slug];
    if (!cached) continue;
    for (const check of cached.result.checks) {
      if (check.passed) continue;
      if (check.optional) continue;
      const weight = typeof check.weight === "number" && check.weight >= 0 ? check.weight : 1;
      out.push({ audit: feature.slug, check: check.name, detail: check.detail, weight });
    }
  }
  // Surface heavier-weighted (more impactful) checks first so the LLM sees
  // them at the top of the failed_checks payload.
  out.sort((a, b) => b.weight - a.weight);
  return out;
}

function deterministicPlan(
  failedChecks: Array<{ audit: string; check: string; detail: string }>,
): ActionPlan {
  // One strategic theme per audit, derived from its first failed check.
  const themesByAudit: Array<{ audit: string; theme: { title: string; body: string } }> = [];
  const seen = new Set<string>();
  for (const f of failedChecks) {
    if (seen.has(f.audit)) continue;
    seen.add(f.audit);
    themesByAudit.push({ audit: f.audit, theme: themeForAudit(f.audit) });
  }

  const priorityForAudit = (audit: string): PlanPriority =>
    audit === "core-listing" ? "P0" : audit === "profile-completeness" ? "P1" : "P2";

  const items: PlanItem[] = themesByAudit.map(({ audit, theme }) => ({
    priority: priorityForAudit(audit),
    title: theme.title,
    body: theme.body,
    source: audit,
  }));

  padWithGrowth(items, TARGET_ITEMS);

  return {
    diagnosis: failedChecks.length === 0
      ? "Your profile is in a strong spot — the next moves are about compounding the lead you already have."
      : "A handful of strategic shifts will lift how the profile shows up and converts for the customers it already reaches.",
    items: items.slice(0, TARGET_ITEMS),
  };
}

function themeForAudit(audit: string): { title: string; body: string } {
  switch (audit) {
    case "core-listing":
      return {
        title: "Fix the fundamentals customers see first",
        body: "Address, phone, website, and operational status are the first things a search result shows. Any gap or mismatch erodes trust before a call happens.",
      };
    case "profile-completeness":
      return {
        title: "Round out the profile basics",
        body: "Empty sections — a thin description, missing hours, no logo, weak categories — leave customers guessing and Google with less to rank against.",
      };
    case "media":
      return {
        title: "Strengthen the customer-voice signal",
        body: "Q&A and review replies are the clearest proof that someone's home. They shape how a profile feels long before a customer reaches out.",
      };
    default:
      return {
        title: "Address profile gaps in the audit",
        body: "There are score-affecting items that, addressed together, will measurably lift how the profile performs.",
      };
  }
}

function padWithGrowth(items: PlanItem[], target: number): void {
  let i = 0;
  while (items.length < target && i < GROWTH_FILLERS.length) {
    const filler = GROWTH_FILLERS[i++];
    if (items.some((it) => it.title === filler.title)) continue;
    items.push({ priority: "P3", title: filler.title, body: filler.body, source: "growth" });
  }
}

function capPlan(plan: ActionPlan, failedCount: number): ActionPlan {
  const validPriorities: PlanPriority[] = ["P0", "P1", "P2", "P3"];
  const items: PlanItem[] = plan.items
    .filter((it) => it && typeof it.title === "string" && typeof it.body === "string")
    .map((it) => ({
      priority: validPriorities.includes(it.priority) ? it.priority : ("P2" as PlanPriority),
      title: it.title.slice(0, MAX_TITLE_CHARS),
      body: it.body.slice(0, MAX_BODY_CHARS),
      source: typeof it.source === "string" ? it.source : "",
    }));

  // The prompt asks for 3–5 items, target 5. If the model returned fewer,
  // top off with strategic growth themes so the client PDF stays full.
  padWithGrowth(items, TARGET_ITEMS);

  return {
    diagnosis: ((plan.diagnosis || "").trim() ||
      (failedCount === 0
        ? "Your profile is in a strong spot — the next moves are about compounding the lead you already have."
        : "A handful of strategic shifts will lift how the profile shows up and converts."))
      .slice(0, 250),
    items: items.slice(0, TARGET_ITEMS),
  };
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
