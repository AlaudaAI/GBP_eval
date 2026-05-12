"use client";

import Link from "next/link";
import { useWorkspace } from "./WorkspaceProvider";

export function WorkspaceFallback() {
  const { error, reload, addProject, state } = useWorkspace();

  if (error) {
    const isConfig =
      error.status === 500 &&
      /upstash|kv_rest_api|not configured/i.test(error.message);

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm">
        <h2 className="text-base font-semibold text-red-900">
          Couldn&apos;t load workspace
        </h2>
        <p className="mt-2 text-red-900">
          <span className="font-mono text-xs">
            {error.status ? `HTTP ${error.status}` : "network error"}
          </span>
          : {error.message}
        </p>

        {isConfig && (
          <div className="mt-3 rounded-lg border border-red-200 bg-white p-3 text-slate-800">
            <p className="font-medium">Likely fix</p>
            <ol className="mt-1 list-decimal list-inside space-y-1 text-xs">
              <li>
                Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to{" "}
                <code className="rounded bg-slate-100 px-1">.env.local</code>.
              </li>
              <li>
                Set <code className="rounded bg-slate-100 px-1">KV_REST_API_URL</code> and{" "}
                <code className="rounded bg-slate-100 px-1">KV_REST_API_TOKEN</code> from your
                Upstash Redis instance.
              </li>
              <li>Restart the dev server.</li>
            </ol>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No error, but no active project (state may be null or have zero projects).
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
      <h2 className="text-base font-semibold text-slate-900">No project yet</h2>
      <p className="mt-1 text-slate-600">
        Create your first business to start running audits. You can rename or
        delete it later from the project switcher.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!state}
          onClick={() => {
            const name = prompt("Business name?");
            if (name && name.trim()) addProject(name.trim());
          }}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Create project
        </button>
        <Link
          href="/settings"
          className="text-xs text-slate-700 hover:text-slate-900"
        >
          Open settings →
        </Link>
      </div>
    </div>
  );
}
