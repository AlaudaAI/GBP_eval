"use client";

import { useEffect, useRef, useState } from "react";
import type { BusinessCandidate } from "@/lib/places-search";
import { useWorkspace } from "./WorkspaceProvider";

type Props = {
  onPick: (candidate: BusinessCandidate) => void;
};

export function BusinessSearch({ onPick }: Props) {
  const { token } = useWorkspace();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusinessCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !token) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await resp.json()) as {
          results?: BusinessCandidate[];
          error?: string;
        };
        if (cancelled) return;
        if (!resp.ok) {
          setError(json.error ?? `HTTP ${resp.status}`);
          setResults([]);
        } else {
          setError(null);
          setResults(json.results ?? []);
        }
        setOpen(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, token]);

  const showPanel = open && (loading || error || results.length > 0 || query.trim().length >= 2);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        Find your business
      </label>
      <input
        type="text"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
        placeholder='e.g. "Acme Plumbing Boston"'
        value={query}
        onFocus={() => {
          if (results.length > 0 || error) setOpen(true);
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="mt-1 text-xs text-slate-500">
        Searches Google Places. Pick a result to auto-fill the fields below.
      </p>

      {showPanel && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading && (
            <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>
          )}
          {error && (
            <p className="px-3 py-2 text-xs text-red-700">{error}</p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500">No matches.</p>
          )}
          {results.map((r) => (
            <button
              key={r.placeId}
              type="button"
              className="w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
              onClick={() => {
                onPick(r);
                setOpen(false);
                setQuery("");
                setResults([]);
              }}
            >
              <p className="text-sm font-medium text-slate-900">{r.name}</p>
              <p className="text-xs text-slate-500">{r.address}</p>
              {r.primaryCategory && (
                <p className="text-xs text-slate-400">{r.primaryCategory}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
