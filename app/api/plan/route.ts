import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { generateActionPlan } from "@/lib/plan";
import type { Project } from "@/lib/workspace-types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let project: Project;
  try {
    const body = await req.json();
    project = body?.project as Project;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!project || typeof project !== "object" || !project.results) {
    return NextResponse.json({ error: "Missing or malformed project" }, { status: 400 });
  }
  try {
    const plan = await generateActionPlan(project);
    return NextResponse.json({ plan });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
