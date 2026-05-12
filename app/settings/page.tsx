"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkspaceFallback } from "@/components/WorkspaceFallback";
import { BusinessSearch } from "@/components/BusinessSearch";
import type { BusinessCandidate } from "@/lib/places-search";
import {
  emptySettings,
  REQUIRED_SETTINGS,
  SETTING_HELP,
  SETTING_LABELS,
  SETTING_ORDER,
  type Settings,
} from "@/lib/settings";

const AUTOFILLED_KEYS = new Set<keyof Settings>([
  "businessName",
  "gbpName",
  "googlePlaceId",
  "address",
  "phone",
  "domain",
]);

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
  const [autofilled, setAutofilled] = useState<Set<keyof Settings>>(new Set());

  useEffect(() => {
    if (activeProject) {
      setForm(activeProject.settings);
      setAutofilled(new Set());
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
      phone: c.phone ?? form.phone,
      domain: c.website ? extractDomain(c.website) : form.domain,
    };
    setForm(next);
    setAutofilled(new Set(AUTOFILLED_KEYS));
    if (activeProject && c.name && activeProject.name !== c.name) {
      renameProject(activeProject.id, c.name);
    }
  }

  function setField(key: keyof Settings, value: string) {
    setForm({ ...form, [key]: value });
    if (autofilled.has(key)) {
      const nextAutofilled = new Set(autofilled);
      nextAutofilled.delete(key);
      setAutofilled(nextAutofilled);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Project settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Search for your business below to auto-fill the fields. All values are
          still editable. Required fields are marked with{" "}
          <span className="text-red-600">*</span>.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <BusinessSearch onPick={applyCandidate} />
      </section>

      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          updateSettings(activeProject.id, form);
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }}
      >
        {SETTING_ORDER.map((key) => {
          const required = REQUIRED_SETTINGS.includes(key);
          const isLong = key === "address" || key === "services" || key === "cities";
          const isAutofilled = autofilled.has(key);
          return (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {SETTING_LABELS[key]}
                {required && <span className="text-red-600 ml-1">*</span>}
                {isAutofilled && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    from Places
                  </span>
                )}
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
        })}

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
