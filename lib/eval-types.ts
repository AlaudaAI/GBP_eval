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
