// Kite Connect login helpers (server-only). Access token lives in an httpOnly cookie.
import crypto from "crypto";
import { cookies } from "next/headers";
import { readStoredToken } from "./tokenStore";

export const AT_COOKIE = "kite_at";

/**
 * The single source of truth for "am I logged in to Kite?".
 *
 * Browser requests carry the httpOnly cookie. Local server-to-server callers (the
 * MCP endpoint) fall back to the token saved at login — local runtimes only, see
 * lib/tokenStore.ts. Both /api/session and getProvider() must agree on this, or the
 * UI shows a "log in" banner while live data is already flowing.
 */
export async function resolveAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(AT_COOKIE)?.value || readStoredToken();
}

export function kiteLoginUrl(): string {
  const key = process.env.KITE_API_KEY;
  return `https://kite.zerodha.com/connect/login?v=3&api_key=${key}`;
}

// Exchange the request_token (from the redirect) for a daily access_token.
export async function exchangeRequestToken(requestToken: string): Promise<string> {
  const apiKey = process.env.KITE_API_KEY!;
  const apiSecret = process.env.KITE_API_SECRET!;
  const checksum = crypto.createHash("sha256").update(apiKey + requestToken + apiSecret).digest("hex");
  const body = new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum });
  const res = await fetch("https://api.kite.trade/session/token", {
    method: "POST",
    headers: { "X-Kite-Version": "3", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (json.status === "error") throw new Error(json.message || "token exchange failed");
  return json.data.access_token as string;
}

export function isLiveMode(): boolean {
  return (process.env.DATA_PROVIDER || "mock") === "kite";
}
