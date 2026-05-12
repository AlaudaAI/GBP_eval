"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceProvider";
import type { ActionPlan, PlanPriority } from "@/lib/plan";

const priorityClass: Record<PlanPriority, string> = {
  P0: "bg-red-100 text-red-800 border-red-200",
  P1: "bg-amber-100 text-amber-800 border-amber-200",
  P2: "bg-blue-100 text-blue-800 border-blue-200",
  P3: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function PlanReportPage() {
  const { activeProject, token, loading } = useWorkspace();
  const searchParams = useSearchParams();
  const print = searchParams.get("print") === "1";
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.setAttribute("data-report", "true");
    return () => {
      document.body.removeAttribute("data-report");
    };
  }, []);

  useEffect(() => {
    if (!token || !activeProject) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/plan", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ project: activeProject }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as { plan: ActionPlan };
        if (!cancelled) setPlan(json.plan);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, activeProject]);

  useEffect(() => {
    if (!print) return;
    if (loading || !plan) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [print, plan, loading]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!activeProject) return <p className="text-sm text-slate-500">No project.</p>;
  if (error) return <p className="text-sm text-red-700">Plan failed: {error}</p>;
  if (!plan) return <p className="text-sm text-slate-500">Generating action plan…</p>;

  return (
    <article className="report mx-auto max-w-2xl bg-white p-8 space-y-6 print:p-0">
      <header className="report-section">
        <p className="text-xs text-slate-500">Alauda AI — action plan</p>
        <h1 className="text-3xl font-semibold text-slate-900 mt-1">{activeProject.name}</h1>
        <p className="text-sm text-slate-700 mt-3">{plan.diagnosis}</p>
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
