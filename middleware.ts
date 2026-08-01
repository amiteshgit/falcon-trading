import { NextRequest, NextResponse } from "next/server";

// Optional Basic-Auth gate so a public Vercel deployment isn't wide open.
// ENABLE by setting BASIC_AUTH_USER and BASIC_AUTH_PASS in your env. If unset, it's a no-op.
// (Excludes the Kite OAuth callback and the MCP endpoint so those keep working.)
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next(); // disabled

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    if (decoded.slice(0, i) === user && decoded.slice(i + 1) === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="falcon-trading"' },
  });
}

// protect everything except static assets, the OAuth callback, and the MCP endpoint
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/kite|api/mcp).*)"],
};
