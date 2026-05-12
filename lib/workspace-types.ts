import type { EvalResult } from "./eval-types";
import type { Settings } from "./settings";

export type CachedAuditResult = {
  slug: string;
  result: EvalResult;
  inputs: Record<string, string>;
  ranAt: number;
};

export type Project = {
  id: string;
  name: string;
  settings: Settings;
  results: Record<string, CachedAuditResult>;
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
