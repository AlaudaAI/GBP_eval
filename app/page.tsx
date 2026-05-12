"use client";

import { useWorkspace } from "@/components/WorkspaceProvider";
import { Overview } from "@/components/Overview";

export default function Page() {
  const { loading, activeProject } = useWorkspace();
  if (loading) return <p className="text-sm text-slate-500">Loading workspace…</p>;
  if (!activeProject) return <p className="text-sm text-slate-500">No project.</p>;
  return <Overview />;
}
