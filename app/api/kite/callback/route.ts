import { NextResponse } from "next/server";
import { exchangeRequestToken, AT_COOKIE } from "@/lib/auth";
import { saveToken } from "@/lib/tokenStore";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestToken = url.searchParams.get("request_token");
  if (!requestToken) return NextResponse.redirect(new URL("/?login=failed", url.origin));
  try {
    const accessToken = await exchangeRequestToken(requestToken);
    saveToken(accessToken); // also stash server-side so the local MCP endpoint can use it
    const res = NextResponse.redirect(new URL("/?login=ok", url.origin));
    res.cookies.set(AT_COOKIE, accessToken, {
      httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 16, // ~ until Kite expires it next morning
    });
    return res;
  } catch (e: any) {
    return NextResponse.redirect(new URL("/?login=error", url.origin));
  }
}
