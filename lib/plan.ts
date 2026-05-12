import Anthropic from "@anthropic-ai/sdk";
import type { Project } from "./workspace-types";
import { FEATURES } from "./features";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_ITEMS = 6;
const MAX_TITLE_CHARS = 70;
const MAX_BODY_CHARS = 220;

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

const SYSTEM = `You write short action plans for small-business owners.

HARD RULES
- Output ONLY JSON: {"diagnosis": string, "items": PlanItem[]}.
- diagnosis: ONE sentence, max 30 words, plain English, customer-facing.
- 1–6 items total, ordered by priority (P0 first).
- title: ≤ 60 chars, imperative ("Add a cover photo"), no jargon.
- body: ≤ 30 words, explains the customer outcome.
- source: the audit slug it came from.
- Prioritize fixes by customer-visible impact, not technical difficulty.

PRIORITY GUIDE
- P0: visible to customers right now and hurting trust (wrong phone, closed status, no photos)
- P1: missing fundamentals (no description, no hours, no logo)
- P2: completeness boost (more photos, more posts, holiday hours)
- P3: nice-to-have polish

JARGON → PLAIN ENGLISH
- "GBP" → "your Google Business Profile"
- "category taxonomy" → "what you're listed as"
- "schema" → "structured data"

GOOD title: "Add hours of operation"
BAD title:  "Implement structured business hours data"`;

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
  if (failedChecks.length === 0) {
    return {
      diagnosis: "Your profile is in good shape — no urgent actions.",
      items: [],
    };
  }

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
                "Generate a ≤6-item action plan for the failed checks below. " +
                "Output JSON only.\n\n" +
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
    return capPlan(parsed);
  } catch {
    return deterministicPlan(failedChecks);
  }
}

function collectFailedChecks(project: Project): Array<{
  audit: string;
  check: string;
  detail: string;
}> {
  const out: Array<{ audit: string; check: string; detail: string }> = [];
  for (const feature of FEATURES) {
    const cached = project.results[feature.slug];
    if (!cached) continue;
    for (const check of cached.result.checks) {
      if (!check.passed) {
        out.push({ audit: feature.slug, check: check.name, detail: check.detail });
      }
    }
  }
  return out;
}

function deterministicPlan(
  failedChecks: Array<{ audit: string; check: string; detail: string }>,
): ActionPlan {
  // Group by audit; pick the first failed check per audit; assign rotating priorities.
  const byAudit = new Map<string, { check: string; detail: string }>();
  for (const f of failedChecks) {
    if (!byAudit.has(f.audit)) byAudit.set(f.audit, { check: f.check, detail: f.detail });
  }
  const priorities: PlanPriority[] = ["P0", "P0", "P1", "P1", "P2", "P3"];
  const items: PlanItem[] = [];
  let i = 0;
  for (const [audit, payload] of byAudit) {
    if (items.length >= MAX_ITEMS) break;
    items.push({
      priority: priorities[i] ?? "P3",
      title: payload.check.length > MAX_TITLE_CHARS
        ? payload.check.slice(0, MAX_TITLE_CHARS - 1) + "…"
        : payload.check,
      body: payload.detail.length > MAX_BODY_CHARS
        ? payload.detail.slice(0, MAX_BODY_CHARS - 1) + "…"
        : payload.detail,
      source: audit,
    });
    i++;
  }
  return {
    diagnosis: `${failedChecks.length} check${failedChecks.length === 1 ? "" : "s"} need attention across your profile.`,
    items,
  };
}

function capPlan(plan: ActionPlan): ActionPlan {
  const validPriorities: PlanPriority[] = ["P0", "P1", "P2", "P3"];
  const items = plan.items
    .filter((it) => it && typeof it.title === "string" && typeof it.body === "string")
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      priority: validPriorities.includes(it.priority) ? it.priority : ("P2" as PlanPriority),
      title: it.title.slice(0, MAX_TITLE_CHARS),
      body: it.body.slice(0, MAX_BODY_CHARS),
      source: typeof it.source === "string" ? it.source : "",
    }));
  return {
    diagnosis: (plan.diagnosis || "").slice(0, 250),
    items,
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
