import type { EvalResult } from "./eval-types";
import type { ActionPlan } from "./plan";
import type { Settings } from "./settings";

export type CachedAuditResult = {
  slug: string;
  result: EvalResult;
  inputs: Record<string, string>;
  ranAt: number;
};

export type CachedPlan = {
  plan: ActionPlan;
  generatedAt: number;
  // Max ranAt of the audit results used to generate this plan. If any
  // current result has a newer ranAt, the cached plan is stale and the
  // /report/plan page will regenerate.
  generatedFromRanAt: number;
};

export type Project = {
  id: string;
  name: string;
  settings: Settings;
  results: Record<string, CachedAuditResult>;
  cachedPlan?: CachedPlan;
};

export type WorkspaceState = {
  version: 1;
  activeProjectId: string;
  projects: Project[];
};

export function newProjectId(): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `proj_${r}`;
}
