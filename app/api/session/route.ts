import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isLiveMode, AT_COOKIE } from "@/lib/auth";
import { tradingStatus } from "@/lib/trading";

export const dynamic = "force-dynamic";

export async function GET() {
  const live = isLiveMode();
  const authenticated = !live || !!(await cookies()).get(AT_COOKIE)?.value;
  const trading = tradingStatus(live ? "kite" : "mock");
  return NextResponse.json({ live, authenticated, trading });
}

// logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AT_COOKIE);
  return res;
}
