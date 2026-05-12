import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { readWorkspace, writeWorkspace } from "@/lib/kv";
import type { WorkspaceState } from "@/lib/workspace-types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const state = await readWorkspace();
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: WorkspaceState;
  try {
    body = (await req.json()) as WorkspaceState;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.projects)) {
    return NextResponse.json({ error: "Invalid workspace shape" }, { status: 400 });
  }
  try {
    await writeWorkspace(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
