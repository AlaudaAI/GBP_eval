import { Redis } from "@upstash/redis";
import { emptySettings } from "./settings";
import {
  newProjectId,
  type WorkspaceState,
} from "./workspace-types";

// Distinct Redis key namespace so this repo can coexist with WebSEO_eval
// on a single Upstash instance if we ever consolidate.
export const WORKSPACE_KEY = "alauda:gbp";

let client: Redis | null = null;

function getClient(): Redis {
  if (client) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.",
    );
  }
  client = new Redis({ url, token });
  return client;
}

export async function readWorkspace(): Promise<WorkspaceState> {
  const raw = await getClient().get<WorkspaceState | string>(WORKSPACE_KEY);
  if (!raw) return defaultWorkspace();
  const parsed = typeof raw === "string" ? (JSON.parse(raw) as WorkspaceState) : raw;
  return normalize(parsed);
}

export async function writeWorkspace(state: WorkspaceState): Promise<void> {
  await getClient().set(WORKSPACE_KEY, JSON.stringify(normalize(state)));
}

function defaultWorkspace(): WorkspaceState {
  const id = newProjectId();
  return {
    version: 1,
    activeProjectId: id,
    projects: [
      {
        id,
        name: "New business",
        settings: emptySettings(),
        results: {},
      },
    ],
  };
}

function normalize(state: WorkspaceState): WorkspaceState {
  // Defensive: ensure shape invariants. Tolerates older snapshots.
  if (!state.projects || state.projects.length === 0) return defaultWorkspace();
  const ids = new Set(state.projects.map((p) => p.id));
  const activeProjectId = ids.has(state.activeProjectId)
    ? state.activeProjectId
    : state.projects[0].id;
  return {
    version: 1,
    activeProjectId,
    projects: state.projects.map((p) => ({
      ...p,
      settings: { ...emptySettings(), ...p.settings },
      results: p.results ?? {},
    })),
  };
}
