"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FEATURES } from "@/lib/features";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkspaceFallback } from "@/components/WorkspaceFallback";

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

export default function FullReportPage() {
  const { activeProject, loading } = useWorkspace();
  const searchParams = useSearchParams();
  const print = searchParams.get("print") === "1";

  useEffect(() => {
    document.body.setAttribute("data-report", "true");
    return () => {
      document.body.removeAttribute("data-report");
    };
  }, []);

  useEffect(() => {
    if (!activeProject) return;
    const prevTitle = document.title;
    document.title = `${slugify(activeProject.name)}_full_${todayISO()}`;
    return () => {
      document.title = prevTitle;
    };
  }, [activeProject?.name]);

  useEffect(() => {
    if (!print) return;
    if (loading || !activeProject) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [print, loading, activeProject]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!activeProject) return <WorkspaceFallback />;

  const ranAt = Object.values(activeProject.results).map((r) => r.ranAt);
  const latestRun = ranAt.length ? new Date(Math.max(...ranAt)) : null;

  return (
    <article className="report mx-auto max-w-3xl bg-white p-8 space-y-6 print:p-0">
      <header className="report-section">
        <p className="text-xs text-slate-500">Alauda AI — full GBP audit</p>
        <h1 className="text-3xl font-semibold text-slate-900 mt-1">{activeProject.name}</h1>
        {latestRun && (
          <p className="text-xs text-slate-500 mt-1">
            Latest run: {latestRun.toLocaleString()}
          </p>
        )}
      </header>

      {FEATURES.map((feature) => {
        const cached = activeProject.results[feature.slug];
        if (!cached) return null;
        return (
          <section key={feature.slug} className="report-section border-t border-slate-200 pt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{feature.title}</h2>
              <div className="text-sm">
                <span className="font-semibold tabular-nums">{cached.result.score}</span>
                <span className="ml-2 uppercase text-xs text-slate-500">{cached.result.status}</span>
              </div>
            </div>
            <p className="text-sm text-slate-700 mt-1">{cached.result.summary}</p>

            <h3 className="text-sm font-medium text-slate-900 mt-4">Checks</h3>
            <ul className="mt-1 space-y-1">
              {cached.result.checks.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className={c.passed ? "text-emerald-700" : c.detail === "skipped: data source limited" ? "text-slate-500" : "text-red-700"}>
                    {c.passed ? "✓" : c.detail === "skipped: data source limited" ? "–" : "✗"}
                  </span>{" "}
                  <span className="font-medium">{c.name}{c.optional ? " (optional)" : ""}.</span>{" "}
                  <span className="text-slate-700">{c.detail}</span>
                </li>
              ))}
            </ul>

            {cached.result.recommendations.length > 0 && (
              <>
                <h3 className="text-sm font-medium text-slate-900 mt-4">Recommendations</h3>
                <ol className="mt-1 list-decimal list-inside text-sm text-slate-700 space-y-1">
                  {cached.result.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ol>
              </>
            )}
          </section>
        );
      })}
    </article>
  );
}
