"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkspaceFallback } from "@/components/WorkspaceFallback";
import { overallFromResults } from "@/lib/eval-types";
import type { ActionPlan, PlanPriority } from "@/lib/plan";

const priorityClass: Record<PlanPriority, string> = {
  P0: "bg-red-100 text-red-800 border-red-200",
  P1: "bg-amber-100 text-amber-800 border-amber-200",
  P2: "bg-blue-100 text-blue-800 border-blue-200",
};

function maxResultsRanAt(results: Record<string, { ranAt: number }>): number {
  const values = Object.values(results);
  return values.length === 0 ? 0 : Math.max(...values.map((r) => r.ranAt));
}

function overallScore(
  results: Record<string, { result: import("@/lib/eval-types").EvalResult }>,
): { score: number; status: "pass" | "warn" | "fail"; label: string } | null {
  const summary = overallFromResults(Object.values(results).map((r) => r.result));
  if (!summary) return null;
  const label = summary.status === "pass" ? "on track" : summary.status === "warn" ? "watch" : "needs work";
  return { score: summary.score, status: summary.status, label };
}

const statusClass: Record<"pass" | "warn" | "fail", string> = {
  pass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warn: "bg-amber-100 text-amber-800 border-amber-200",
  fail: "bg-red-100 text-red-800 border-red-200",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "business";
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PlanReportPage() {
  const { activeProject, token, loading, savePlan } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const print = searchParams.get("print") === "1";
  const force = searchParams.get("force") === "1";
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  // Track which latestRanAt we already force-regenerated for, so savePlan()
  // updating activeProject doesn't bounce us back into another regen while
  // ?force=1 is still in the URL.
  const forceHandledForRanAt = useRef<number | null>(null);

  const latestRanAt = useMemo(
    () => (activeProject ? maxResultsRanAt(activeProject.results) : 0),
    [activeProject],
  );

  useEffect(() => {
    document.body.setAttribute("data-report", "true");
    return () => {
      document.body.removeAttribute("data-report");
    };
  }, []);

  useEffect(() => {
    if (!activeProject) return;
    const prevTitle = document.title;
    document.title = `${slugify(activeProject.name)}_plan_${todayISO()}`;
    return () => {
      document.title = prevTitle;
    };
  }, [activeProject?.name]);

  useEffect(() => {
    if (!token || !activeProject) return;

    const cached = activeProject.cachedPlan;

    // If we've already kicked off a force-regen for this audit run, treat
    // subsequent renders as cached — otherwise savePlan() updating
    // activeProject would re-enter this effect while ?force=1 is still in
    // the URL and we'd regenerate forever.
    if (force && forceHandledForRanAt.current === latestRanAt) {
      if (cached) setPlan(cached.plan);
      return;
    }

    // Use cached plan unless audits have been re-run since it was generated
    // or the user passed ?force=1 to regenerate.
    if (cached && !force && cached.generatedFromRanAt >= latestRanAt) {
      setPlan(cached.plan);
      return;
    }

    if (force) forceHandledForRanAt.current = latestRanAt;

    let cancelled = false;
    setGenerating(true);
    setError(null);
    (async () => {
      try {
        const resp = await fetch("/api/plan", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ project: activeProject }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as { plan: ActionPlan };
        if (cancelled) return;
        setPlan(json.plan);
        savePlan(activeProject.id, {
          plan: json.plan,
          generatedAt: Date.now(),
          generatedFromRanAt: latestRanAt,
        });
        // Drop the ?force=1 from the URL so future renders (and back/forward
        // navigation) fall through to the cached branch.
        if (force) router.replace("/report/plan");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeProject, force, latestRanAt, savePlan, router]);

  useEffect(() => {
    if (!print) return;
    if (loading || !plan) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [print, plan, loading]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!activeProject) return <WorkspaceFallback />;
  if (error) return <p className="text-sm text-red-700">Plan failed: {error}</p>;
  if (!plan) return <p className="text-sm text-slate-500">Generating action plan…</p>;

  const cached = activeProject.cachedPlan;
  const overall = overallScore(activeProject.results);

  return (
    <article className="report mx-auto max-w-2xl bg-white p-8 space-y-6 print:p-0">
      <header className="report-section">
        <p className="text-xs text-slate-500">Alauda AI — action plan</p>
        <h1 className="text-3xl font-semibold text-slate-900 mt-1">{activeProject.name}</h1>
        {overall && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-4xl font-semibold tabular-nums text-slate-900">{overall.score}</span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass[overall.status]}`}>
              {overall.label}
            </span>
          </div>
        )}
        <p className="text-sm text-slate-700 mt-3">{plan.diagnosis}</p>
        {cached && (
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 print:hidden">
            <span>Generated {new Date(cached.generatedAt).toLocaleString()}.</span>
            <a
              href="?force=1"
              className="text-brand hover:underline"
              onClick={(e) => {
                if (generating) e.preventDefault();
              }}
            >
              {generating ? "Regenerating…" : "Regenerate plan"}
            </a>
          </div>
        )}
      </header>

      <section className="report-section">
        {plan.items.length === 0 ? (
          <p className="text-sm text-slate-700">No urgent actions — your profile is in good shape.</p>
        ) : (
          <ol className="space-y-3">
            {plan.items.map((item, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityClass[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mt-1">{item.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
