export type CheckResult = {
  name: string;
  passed: boolean;
  detail: string;
  // When true, the check is shown in the report but does not count toward
  // the audit's score.
  optional?: boolean;
};

export type EvalResult = {
  score: number;
  status: "pass" | "warn" | "fail";
  summary: string;
  checks: CheckResult[];
  recommendations: string[];
  meta?: Record<string, unknown>;
};

export function scoreFromChecks(checks: CheckResult[]): {
  score: number;
  status: EvalResult["status"];
} {
  if (checks.length === 0) return { score: 0, status: "fail" };
  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  let status: EvalResult["status"];
  if (score >= 80) status = "pass";
  else if (score >= 50) status = "warn";
  else status = "fail";
  return { score, status };
}

const SKIPPED_DETAIL = "skipped: data source limited";

// Aggregate raw check counts across every audit so each scored check carries
// the same weight in the overall number. Optional and skipped checks stay out
// of both the numerator and the denominator.
export function overallFromResults(
  results: Iterable<EvalResult>,
): { score: number; status: EvalResult["status"]; passed: number; total: number } | null {
  let passed = 0;
  let total = 0;
  for (const r of results) {
    for (const c of r.checks) {
      if (c.optional) continue;
      if (c.detail === SKIPPED_DETAIL) continue;
      total += 1;
      if (c.passed) passed += 1;
    }
  }
  if (total === 0) return null;
  const score = Math.round((passed / total) * 100);
  const status: EvalResult["status"] = score >= 80 ? "pass" : score >= 50 ? "warn" : "fail";
  return { score, status, passed, total };
}
