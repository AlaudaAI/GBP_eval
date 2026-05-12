import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { runAudit, type AuditInputs } from "@/lib/audits";
import { findFeature } from "@/lib/features";
import { emptySettings, type Settings } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  inputs: AuditInputs;
  settings: Settings;
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  if (!findFeature(slug)) {
    return NextResponse.json({ error: `Unknown audit: ${slug}` }, { status: 404 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.inputs?.placeId) {
    return NextResponse.json({ error: "inputs.placeId is required" }, { status: 400 });
  }
  const settings: Settings = { ...emptySettings(), ...(body.settings ?? {}) };
  try {
    const result = await runAudit(slug, body.inputs, settings);
    return NextResponse.json({ result, inputs: body.inputs, ranAt: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
