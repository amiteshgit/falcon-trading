import { NextResponse } from "next/server";
import { isLiveMode, resolveAccessToken, AT_COOKIE } from "@/lib/auth";
import { clearStoredToken } from "@/lib/tokenStore";
import { tradingStatus } from "@/lib/trading";

export const dynamic = "force-dynamic";

export async function GET() {
  const live = isLiveMode();
  // Must match how getProvider() resolves the token, otherwise the UI can show a
  // login banner while the data routes are already serving live Kite data.
  const authenticated = !live || !!(await resolveAccessToken());
  const trading = tradingStatus(live ? "kite" : "mock");
  return NextResponse.json({ live, authenticated, trading });
}

// logout — must clear BOTH credentials that resolveAccessToken() accepts, or the
// server-side token would silently keep the session alive after logging out.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AT_COOKIE);
  clearStoredToken();
  return res;
}
