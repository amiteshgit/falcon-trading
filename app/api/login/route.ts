import { NextResponse } from "next/server";
import {
  checkCredentials, createSessionToken, authEnabled,
  SESSION_COOKIE, sessionCookieOptions,
} from "@/lib/app-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!authEnabled()) {
    return NextResponse.json({ error: "Login is not configured on this deployment." }, { status: 400 });
  }
  let user = "", pass = "";
  try {
    const body = await req.json();
    user = String(body.user ?? "");
    pass = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await checkCredentials(user, pass))) {
    // Deliberately vague: don't reveal which field was wrong.
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  return res;
}

// sign out of the app (separate from disconnecting Kite)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
