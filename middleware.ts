import { NextRequest, NextResponse } from "next/server";
import { authEnabled, verifySessionToken, SESSION_COOKIE } from "@/lib/app-auth";

// Gates the whole app behind a login page so a public deployment isn't wide open.
// ENABLE by setting APP_USER + APP_PASSWORD (or the legacy BASIC_AUTH_USER/PASS).
// If unset, it's a no-op and everything is reachable — fine for local dev.
//
// Unauthenticated browsers are REDIRECTED to /login (a real page). API calls get a
// 401 JSON body instead, so a fetch never receives an HTML login page it can't parse.
export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  // Preserve where they were headed so login can send them back.
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

// Protect everything except static assets, the login page and its endpoint, the
// Kite OAuth callback (Zerodha redirects here), and the MCP endpoint (a connector
// can't complete a browser login — it authenticates with MCP_AUTH_TOKEN instead).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/login|api/kite|api/mcp).*)",
  ],
};
