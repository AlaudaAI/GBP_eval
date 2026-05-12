"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";

export function ProjectSwitcher() {
  const { state, activeProject, setActiveProjectId, addProject, renameProject, deleteProject } =
    useWorkspace();
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setRenamingId(null);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!state || !activeProject) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="max-w-[180px] truncate">{activeProject.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-20">
          {state.projects.map((p) => {
            const isActive = p.id === activeProject.id;
            const isRenaming = renamingId === p.id;
            return (
              <div
                key={p.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 ${
                  isActive ? "bg-brand-light" : "hover:bg-slate-100"
                }`}
              >
                {isRenaming ? (
                  <input
                    autoFocus
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameProject(p.id, renameValue);
                        setRenamingId(null);
                      } else if (e.key === "Escape") {
                        setRenamingId(null);
                      }
                    }}
                    onBlur={() => {
                      renameProject(p.id, renameValue);
                      setRenamingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="flex-1 text-left text-sm truncate"
                    onClick={() => {
                      setActiveProjectId(p.id);
                      setOpen(false);
                    }}
                  >
                    {p.name}
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-800 opacity-0 group-hover:opacity-100"
                  onClick={() => {
                    setRenamingId(p.id);
                    setRenameValue(p.name);
                  }}
                >
                  rename
                </button>
                {state.projects.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      if (confirm(`Delete project "${p.name}"? This removes its settings and cached audit results.`)) {
                        deleteProject(p.id);
                      }
                    }}
                  >
                    delete
                  </button>
                )}
              </div>
            );
          })}
          <div className="border-t border-slate-200 my-1.5" />
          <button
            type="button"
            className="w-full text-left rounded-lg px-2 py-1.5 text-sm text-brand hover:bg-brand-light"
            onClick={() => {
              const name = prompt("Business name?");
              if (name && name.trim()) addProject(name.trim());
              setOpen(false);
            }}
          >
            + Add business
          </button>
        </div>
      )}
    </div>
  );
}
