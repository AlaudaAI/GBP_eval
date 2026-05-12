"use client";

import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";

export function TokenGate({ children }: { children: React.ReactNode }) {
  const { token, setToken } = useWorkspace();
  const [value, setValue] = useState("");

  if (token) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = value.trim();
          if (trimmed) setToken(trimmed);
        }}
      >
        <h1 className="text-lg font-semibold text-slate-900">Enter bearer token</h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste the team's <code className="rounded bg-slate-100 px-1">SHARED_API_TOKEN</code>. It
          will be stored in this browser only.
        </p>
        <input
          autoFocus
          type="password"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light"
          placeholder="bearer token"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
