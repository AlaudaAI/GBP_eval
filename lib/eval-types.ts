export type CheckResult = {
  name: string;
  passed: boolean;
  detail: string;
  // When true, the check is shown in the report but does not count toward
  // the audit's score.
  optional?: boolean;
  // Score weight. Defaults to 1; "softer" checks use 0.5 so they nudge the
  // score but don't dominate it. Skipped/optional checks are excluded from
  // the denominator regardless of weight.
  weight?: number;
};

export type EvalResult = {
  score: number;
  status: "pass" | "warn" | "fail";
  summary: string;
  checks: CheckResult[];
  recommendations: string[];
  meta?: Record<string, unknown>;
};

const SKIPPED_DETAIL = "skipped: data source limited";

function weightOf(c: CheckResult): number {
  return typeof c.weight === "number" && c.weight >= 0 ? c.weight : 1;
}

function statusFor(score: number): EvalResult["status"] {
  if (score >= 80) return "pass";
  if (score >= 50) return "warn";
  return "fail";
}

export function scoreFromChecks(checks: CheckResult[]): {
  score: number;
  status: EvalResult["status"];
} {
  let weightTotal = 0;
  let weightPassed = 0;
  for (const c of checks) {
    const w = weightOf(c);
    weightTotal += w;
    if (c.passed) weightPassed += w;
  }
  if (weightTotal === 0) return { score: 0, status: "fail" };
  const score = Math.round((weightPassed / weightTotal) * 100);
  return { score, status: statusFor(score) };
}

// Aggregate weighted pass/fail across every audit so each scored check
// carries its declared weight. Optional and skipped checks stay out of both
// the numerator and the denominator. `passed`/`total` are integer check
// counts (for display) — the percentage uses weighted sums.
export function overallFromResults(
  results: Iterable<EvalResult>,
): {
  score: number;
  status: EvalResult["status"];
  passed: number;
  total: number;
  weightPassed: number;
  weightTotal: number;
} | null {
  let passed = 0;
  let total = 0;
  let weightPassed = 0;
  let weightTotal = 0;
  for (const r of results) {
    for (const c of r.checks) {
      if (c.optional) continue;
      if (c.detail === SKIPPED_DETAIL) continue;
      const w = weightOf(c);
      total += 1;
      weightTotal += w;
      if (c.passed) {
        passed += 1;
        weightPassed += w;
      }
    }
  }
  if (weightTotal === 0) return null;
  const score = Math.round((weightPassed / weightTotal) * 100);
  return { score, status: statusFor(score), passed, total, weightPassed, weightTotal };
}
