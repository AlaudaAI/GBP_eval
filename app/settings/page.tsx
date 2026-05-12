"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { WorkspaceFallback } from "@/components/WorkspaceFallback";
import {
  emptySettings,
  REQUIRED_SETTINGS,
  SETTING_HELP,
  SETTING_LABELS,
  SETTING_ORDER,
  type Settings,
} from "@/lib/settings";

export default function SettingsPage() {
  const { activeProject, updateSettings, loading } = useWorkspace();
  const [form, setForm] = useState<Settings>(emptySettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeProject) setForm(activeProject.settings);
  }, [activeProject?.id, activeProject?.settings]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!activeProject) return <WorkspaceFallback />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Project settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          These values are reused across audits. Required fields are marked with{" "}
          <span className="text-red-600">*</span>.
        </p>
      </header>

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
          return (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {SETTING_LABELS[key]}
                {required && <span className="text-red-600 ml-1">*</span>}
              </label>
              {isLong ? (
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ) : (
                <input
                  type={key === "outscraperApiKey" ? "password" : "text"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
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
