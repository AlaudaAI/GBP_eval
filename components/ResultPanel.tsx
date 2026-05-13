import type { EvalResult } from "@/lib/eval-types";

export function StatusBadge({ status }: { status: EvalResult["status"] | "running" | "queued" | "skipped" | "failed" }) {
  const styles: Record<string, string> = {
    pass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
    fail: "bg-red-100 text-red-800 border-red-200",
    running: "bg-blue-50 text-blue-700 border-blue-200",
    queued: "bg-slate-100 text-slate-700 border-slate-200",
    skipped: "bg-slate-100 text-slate-600 border-slate-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  };
  // Customer-facing labels — "fail" sounds like a system bug.
  const labels: Record<string, string> = {
    pass: "on track",
    warn: "watch",
    fail: "needs work",
    running: "running",
    queued: "queued",
    skipped: "skipped",
    failed: "error",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.queued}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function SourceBadge({ source }: { source: unknown }) {
  if (source !== "outscraper" && source !== "places") return null;
  const isOutscraper = source === "outscraper";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        isOutscraper
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-amber-50 text-amber-800 border-amber-200"
      }`}
      title={isOutscraper ? "Full GBP data via Outscraper" : "Limited data — Outscraper had no record for this Place ID, fell back to Google Places"}
    >
      via {isOutscraper ? "Outscraper" : "Google Places (limited)"}
    </span>
  );
}

export function ResultPanel({ result }: { result: EvalResult }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-3xl font-semibold tabular-nums">{result.score}</div>
        <StatusBadge status={result.status} />
        <SourceBadge source={result.meta?.source} />
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
                  <div className="font-medium text-slate-900">
                    {c.name}
                    {c.optional && (
                      <span className="ml-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        optional
                      </span>
                    )}
                    {!c.optional && typeof c.weight === "number" && c.weight < 1 && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800"
                        title={`Counts as ${c.weight}× weight in the score.`}
                      >
                        ½ weight
                      </span>
                    )}
                  </div>
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
