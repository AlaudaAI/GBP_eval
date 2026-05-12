import type { NextRequest } from "next/server";

// Constant-time bearer-token comparison. Refuses to operate if SHARED_API_TOKEN
// is unset — better to be locked down by default than wide-open.
export function checkAuth(req: NextRequest): boolean {
  const expected = process.env.SHARED_API_TOKEN;
  if (!expected) return false;
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m) return false;
  const given = m[1];
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
