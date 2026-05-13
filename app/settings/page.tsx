"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkspaceFallback } from "@/components/WorkspaceFallback";
import { BusinessSearch } from "@/components/BusinessSearch";
import type { BusinessCandidate } from "@/lib/places-search";
import {
  emptySettings,
  SETTING_HELP,
  SETTING_LABELS,
  type Settings,
} from "@/lib/settings";

const AUTOFILLED_KEYS: (keyof Settings)[] = [
  "businessName",
  "gbpName",
  "googlePlaceId",
  "address",
  "phone",
  "domain",
];

const CONTEXT_KEYS: (keyof Settings)[] = ["cities", "services"];

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function SettingsPage() {
  const { activeProject, updateSettings, renameProject, loading } = useWorkspace();
  const [form, setForm] = useState<Settings>(emptySettings());
  const [saved, setSaved] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setForm(activeProject.settings);
      setShowDetails(false);
    }
  }, [activeProject?.id, activeProject?.settings]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!activeProject) return <WorkspaceFallback />;

  function applyCandidate(c: BusinessCandidate) {
    const next: Settings = {
      ...form,
      businessName: c.name,
      gbpName: c.name,
      googlePlaceId: c.placeId,
      address: c.address,
      phone: c.phone ?? "",
      domain: c.website ? extractDomain(c.website) : "",
    };
    setForm(next);
    setShowDetails(false);
    if (activeProject && c.name && activeProject.name !== c.name) {
      renameProject(activeProject.id, c.name);
    }
  }

  function setField(key: keyof Settings, value: string) {
    setForm({ ...form, [key]: value });
  }

  function renderField(key: keyof Settings) {
    const isLong = key === "address" || key === "services" || key === "cities";
    return (
      <div key={key}>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {SETTING_LABELS[key]}
        </label>
        {isLong ? (
          <textarea
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
            value={form[key]}
            onChange={(e) => setField(key, e.target.value)}
          />
        ) : (
          <input
            type={key === "outscraperApiKey" ? "password" : "text"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
            value={form[key]}
            onChange={(e) => setField(key, e.target.value)}
          />
        )}
        {SETTING_HELP[key] && (
          <p className="mt-1 text-xs text-slate-500">{SETTING_HELP[key]}</p>
        )}
      </div>
    );
  }

  const hasBusiness = Boolean(form.googlePlaceId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Project settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Pick your business below — Google Places fills the listing details
          automatically. Only the service area needs manual input.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <BusinessSearch onPick={applyCandidate} />
      </section>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          updateSettings(activeProject.id, form);
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }}
      >
        {hasBusiness && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Selected business
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {form.businessName || form.gbpName || "(unnamed)"}
                </p>
                {form.address && (
                  <p className="text-sm text-slate-600">{form.address}</p>
                )}
                <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  {form.phone && (
                    <>
                      <dt>Phone</dt>
                      <dd>{form.phone}</dd>
                    </>
                  )}
                  {form.domain && (
                    <>
                      <dt>Website</dt>
                      <dd>{form.domain}</dd>
                    </>
                  )}
                  <dt>Place ID</dt>
                  <dd className="truncate font-mono">{form.googlePlaceId}</dd>
                </dl>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails((s) => !s)}
                className="shrink-0 text-xs text-slate-600 hover:text-slate-900"
              >
                {showDetails ? "Hide details" : "Edit details"}
              </button>
            </div>

            {showDetails && (
              <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">
                  Override individual values if Google Places returned something
                  incorrect. Re-running the search will overwrite these.
                </p>
                {AUTOFILLED_KEYS.map(renderField)}
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Service area</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Used by audits to score local-relevance signals. Comma-separated.
            </p>
          </div>
          {CONTEXT_KEYS.map(renderField)}
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Save settings
          </button>
          {saved && <span className="text-xs text-emerald-700">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
