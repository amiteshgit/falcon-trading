// Kite Connect login helpers (server-only). Access token lives in an httpOnly cookie.
import crypto from "crypto";

export const AT_COOKIE = "kite_at";

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
