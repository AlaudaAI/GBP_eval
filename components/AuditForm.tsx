"use client";

import { useMemo, useState } from "react";
import type { Feature } from "@/lib/features";
import { defaultValueForInput } from "@/lib/settings";
import type { Project, CachedAuditResult } from "@/lib/workspace-types";
import { useWorkspace } from "./WorkspaceProvider";
import { ResultPanel } from "./ResultPanel";

export function AuditForm({ feature, project }: { feature: Feature; project: Project }) {
  const { token, saveResult } = useWorkspace();
  const initial = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const f of feature.inputs) obj[f.name] = defaultValueForInput(f.name, project.settings);
    return obj;
  }, [feature, project.settings]);
  const [inputs, setInputs] = useState<Record<string, string>>(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cached = project.results[feature.slug];

  async function run() {
    if (!token) return;
    setRunning(true);
    setError(null);
    try {
      const resp = await fetch(`/api/eval/${feature.slug}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, settings: project.settings }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const json = (await resp.json()) as CachedAuditResult;
      saveResult(project.id, {
        slug: feature.slug,
        result: json.result,
        inputs: json.inputs,
        ranAt: json.ranAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-900 mb-3">Run the audit</h2>
        <div className="space-y-3">
          {feature.inputs.map((field) => {
            const fromSettings = field.fromSettings === true;
            const prefilled = (initial[field.name] || "") === inputs[field.name] && initial[field.name] !== "";
            return (
              <div key={field.name}>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {field.label}
                  {fromSettings && prefilled && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                      from settings
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
                  placeholder={field.placeholder}
                  value={inputs[field.name] ?? ""}
                  onChange={(e) => setInputs({ ...inputs, [field.name]: e.target.value })}
                />
                {field.help && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
              </div>
            );
          })}
          <button
            type="button"
            onClick={run}
            disabled={running || !inputs.placeId}
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {running ? "Running…" : "Run audit"}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </div>

      {cached && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          Ran at {new Date(cached.ranAt).toLocaleString()} with{" "}
          {Object.entries(cached.inputs)
            .map(([k, v]) => `${k}=${v || "(empty)"}`)
            .join(" · ")}
          . Re-run to refresh.
        </div>
      )}

      {cached && <ResultPanel result={cached.result} />}
    </div>
  );
}
