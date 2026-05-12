"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CachedAuditResult, Project, WorkspaceState } from "@/lib/workspace-types";
import { newProjectId } from "@/lib/workspace-types";
import { emptySettings, type Settings } from "@/lib/settings";

const TOKEN_KEY = "alauda.bearerToken";

export type WorkspaceError = { status: number | null; message: string };

type Ctx = {
  state: WorkspaceState | null;
  loading: boolean;
  error: WorkspaceError | null;
  reload: () => void;
  token: string | null;
  setToken: (t: string) => void;
  signOut: () => void;
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  addProject: (name: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  updateSettings: (id: string, settings: Settings) => void;
  saveResult: (id: string, cached: CachedAuditResult) => void;
  clearResults: (id: string) => void;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function useWorkspace(): Ctx {
  const v = useContext(WorkspaceCtx);
  if (!v) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return v;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WorkspaceError | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const pendingWrite = useRef<WorkspaceState | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  useEffect(() => {
    const t = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (t) setTokenState(t);
    else setLoading(false);
  }, []);

  const setToken = useCallback((t: string) => {
    window.localStorage.setItem(TOKEN_KEY, t);
    setTokenState(t);
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    setTokenState(null);
    setState(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resp = await fetch("/api/workspace", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.status === 401) {
          if (!cancelled) signOut();
          return;
        }
        if (!resp.ok) {
          let msg = `Workspace fetch failed (HTTP ${resp.status})`;
          try {
            const body = (await resp.json()) as { error?: string };
            if (body?.error) msg = body.error;
          } catch {
            // Non-JSON body — keep the generic message.
          }
          throw Object.assign(new Error(msg), { status: resp.status });
        }
        const data = (await resp.json()) as WorkspaceState;
        if (!cancelled) {
          setState(data);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        const status =
          e && typeof e === "object" && "status" in e && typeof (e as { status?: number }).status === "number"
            ? (e as { status: number }).status
            : null;
        setError({ status, message });
        setState(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, signOut, reloadNonce]);

  const persist = useCallback(
    (next: WorkspaceState) => {
      pendingWrite.current = next;
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(async () => {
        const body = pendingWrite.current;
        if (!body || !token) return;
        try {
          await fetch("/api/workspace", {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch {
          // Optimistic — swallow; user can re-trigger by editing again.
        }
      }, 250);
    },
    [token],
  );

  const mutate = useCallback(
    (fn: (s: WorkspaceState) => WorkspaceState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const activeProject = useMemo<Project | null>(() => {
    if (!state) return null;
    return state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0] ?? null;
  }, [state]);

  const setActiveProjectId = useCallback(
    (id: string) => mutate((s) => ({ ...s, activeProjectId: id })),
    [mutate],
  );

  const addProject = useCallback(
    (name: string) =>
      mutate((s) => {
        const id = newProjectId();
        const project: Project = {
          id,
          name: name.trim() || "New business",
          settings: emptySettings(),
          results: {},
        };
        return { ...s, projects: [...s.projects, project], activeProjectId: id };
      }),
    [mutate],
  );

  const renameProject = useCallback(
    (id: string, name: string) =>
      mutate((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)),
      })),
    [mutate],
  );

  const deleteProject = useCallback(
    (id: string) =>
      mutate((s) => {
        const remaining = s.projects.filter((p) => p.id !== id);
        if (remaining.length === 0) return s; // never zero projects
        const activeProjectId = s.activeProjectId === id ? remaining[0].id : s.activeProjectId;
        return { ...s, projects: remaining, activeProjectId };
      }),
    [mutate],
  );

  const updateSettings = useCallback(
    (id: string, settings: Settings) =>
      mutate((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === id ? { ...p, settings } : p)),
      })),
    [mutate],
  );

  const saveResult = useCallback(
    (id: string, cached: CachedAuditResult) =>
      mutate((s) => ({
        ...s,
        projects: s.projects.map((p) =>
          p.id === id ? { ...p, results: { ...p.results, [cached.slug]: cached } } : p,
        ),
      })),
    [mutate],
  );

  const clearResults = useCallback(
    (id: string) =>
      mutate((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === id ? { ...p, results: {} } : p)),
      })),
    [mutate],
  );

  const value: Ctx = {
    state,
    loading,
    error,
    reload,
    token,
    setToken,
    signOut,
    activeProject,
    setActiveProjectId,
    addProject,
    renameProject,
    deleteProject,
    updateSettings,
    saveResult,
    clearResults,
  };

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}
