import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";
import { searchBusinesses } from "@/lib/places-search";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });
  try {
    const results = await searchBusinesses(q);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
