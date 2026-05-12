import type { EvalResult } from "@/lib/eval-types";

export function StatusBadge({ status }: { status: EvalResult["status"] | "running" | "queued" | "skipped" | "failed" }) {
  const map: Record<string, string> = {
    pass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
    fail: "bg-red-100 text-red-800 border-red-200",
    running: "bg-blue-50 text-blue-700 border-blue-200",
    queued: "bg-slate-100 text-slate-700 border-slate-200",
    skipped: "bg-slate-100 text-slate-600 border-slate-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? map.queued}`}>
      {status}
    </span>
  );
}

export function ResultPanel({ result }: { result: EvalResult }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-3xl font-semibold tabular-nums">{result.score}</div>
        <StatusBadge status={result.status} />
        <p className="text-sm text-slate-700">{result.summary}</p>
      </div>

      {result.checks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-900 mb-2">Checks</h3>
          <ul className="space-y-1.5">
            {result.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden
                  className={`mt-1 inline-block h-2 w-2 rounded-full ${
                    c.passed ? "bg-emerald-500" : c.detail === "skipped: data source limited" ? "bg-slate-400" : "bg-red-500"
                  }`}
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-slate-600">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-900 mb-2">Recommendations</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
            {result.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
