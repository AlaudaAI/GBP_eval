"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FEATURES } from "@/lib/features";
import { defaultValueForInput } from "@/lib/settings";
import { overallFromResults } from "@/lib/eval-types";
import { runAll, type RunAllEvent } from "@/lib/run-all";
import type { CachedAuditResult } from "@/lib/workspace-types";
import { useWorkspace } from "./WorkspaceProvider";
import { StatusBadge, SourceBadge } from "./ResultPanel";

type AuditStatus =
  | { kind: "queued" }
  | { kind: "running" }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; error: string }
  | { kind: "done" };

export function Overview() {
  const { activeProject, token, saveResult, clearResults } = useWorkspace();
  const [running, setRunning] = useState(false);
  const [statusBySlug, setStatusBySlug] = useState<Record<string, AuditStatus>>({});
  const [progress, setProgress] = useState<{ done: number; total: number; inFlight: number; queued: number } | null>(null);

  const overall = useMemo(() => {
    if (!activeProject) return null;
    return overallFromResults(
      Object.values(activeProject.results).map((r) => r.result),
    );
  }, [activeProject]);

  if (!activeProject) return null;

  async function runAllAudits() {
    if (!token || !activeProject) return;
    if (!activeProject.settings.googlePlaceId) {
      alert("Add a Google Place ID in Settings before running audits.");
      return;
    }
    setRunning(true);
    const init: Record<string, AuditStatus> = {};
    for (const f of FEATURES) init[f.slug] = { kind: "queued" };
    setStatusBySlug(init);

    await runAll(
      FEATURES.map((f) => ({
        key: f.slug,
        run: async () => {
          const inputs: Record<string, string> = {};
          for (const field of f.inputs) inputs[field.name] = defaultValueForInput(field.name, activeProject.settings);
          const resp = await fetch(`/api/eval/${f.slug}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ inputs, settings: activeProject.settings }),
          });
          if (!resp.ok) {
            const body = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
            throw new Error(body.error ?? `HTTP ${resp.status}`);
          }
          return (await resp.json()) as CachedAuditResult;
        },
      })),
      // Concurrency 1: Outscraper rate-limits aggregate request rate, and each
      // audit makes 3-4 sub-requests. Running audits in parallel triggers 429s.
      1,
      (e: RunAllEvent<CachedAuditResult>) => {
        setProgress({ done: e.done, total: e.total, inFlight: e.inFlight, queued: e.queued });
        setStatusBySlug((prev) => {
          const next = { ...prev };
          if (e.type === "start") next[e.key] = { kind: "running" };
          else if (e.type === "ok") next[e.key] = { kind: "done" };
          else if (e.type === "err") next[e.key] = { kind: "failed", error: errorMessage(e.error) };
          return next;
        });
        if (e.type === "ok") {
          // e.key is the feature slug from the runAll task — the API response
          // body doesn't echo it, so without this the cache key would be
          // `undefined` and every card would show "not run".
          saveResult(activeProject.id, {
            slug: e.key,
            result: e.value.result,
            inputs: e.value.inputs,
            ranAt: e.value.ranAt,
          });
        }
      },
    );

    setRunning(false);
    setProgress(null);
  }

  const hasResults = Object.keys(activeProject.results).length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          {activeProject.name} — GBP scoreboard
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Three audits cover the GBP best-practice items: core listing health,
          profile completeness, and media/Q&amp;A/reviews.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-semibold tabular-nums">{overall ? overall.score : "—"}</div>
          {overall && <StatusBadge status={overall.status} />}
          <div className="text-sm text-slate-600">
            {overall
              ? `Overall score: ${overall.passed} of ${overall.total} scored checks passed (optional checks excluded).`
              : "No audits run yet."}
          </div>
        </div>
        {progress && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
            Running: {progress.done}/{progress.total} complete — {progress.inFlight} in flight, {progress.queued} queued
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runAllAudits}
            disabled={running}
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {running ? "Running…" : "Run all audits"}
          </button>
          <Link
            href="/report/plan?print=1"
            target="_blank"
            aria-disabled={!hasResults}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${
              hasResults ? "border-slate-300 text-slate-800 hover:bg-slate-50" : "border-slate-200 text-slate-400 pointer-events-none"
            }`}
          >
            Export client plan
          </Link>
          <Link
            href="/report?print=1"
            target="_blank"
            aria-disabled={!hasResults}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${
              hasResults ? "border-slate-300 text-slate-800 hover:bg-slate-50" : "border-slate-200 text-slate-400 pointer-events-none"
            }`}
          >
            Export full audit
          </Link>
          <button
            type="button"
            disabled={!hasResults}
            onClick={() => {
              if (confirm("Clear all cached audit scores for this project?")) clearResults(activeProject.id);
            }}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Clear scores
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FEATURES.map((f, i) => {
          const cached = activeProject.results[f.slug];
          const live = statusBySlug[f.slug];
          let badge: React.ReactNode;
          if (live?.kind === "running") badge = <StatusBadge status="running" />;
          else if (live?.kind === "queued") badge = <StatusBadge status="queued" />;
          else if (live?.kind === "failed") badge = <StatusBadge status="failed" />;
          else if (cached) badge = (
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">{cached.result.score}</span>
              <StatusBadge status={cached.result.status} />
            </span>
          );
          else badge = <span className="text-xs text-slate-500">not run</span>;

          return (
            <Link
              key={f.slug}
              href={`/features/${f.slug}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-slate-500">{String(i + 1).padStart(2, "0")}.</div>
                  <h3 className="font-medium text-slate-900 mt-0.5">{f.title}</h3>
                  <p className="text-xs text-slate-600 mt-1">{f.summary}</p>
                  {cached && (
                    <div className="text-[11px] text-slate-500 mt-2 flex flex-wrap items-center gap-2">
                      <span>Ran {new Date(cached.ranAt).toLocaleString()}</span>
                      <SourceBadge source={cached.result.meta?.source} />
                    </div>
                  )}
                  {live?.kind === "failed" && (
                    <p className="text-[11px] text-red-700 mt-2 truncate">Error: {live.error}</p>
                  )}
                </div>
                <div className="shrink-0">{badge}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
