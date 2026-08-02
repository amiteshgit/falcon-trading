// App gate — the username/password that protects the whole deployment.
//
// This replaces HTTP Basic-Auth (which forced the browser's unstyleable native
// dialog) with a normal login page backed by a signed session cookie.
//
// Runs in BOTH the Edge middleware and Node route handlers, so it uses Web Crypto
// only — no `node:crypto` import, which would break the middleware bundle.

export const SESSION_COOKIE = "falcon_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Credentials come from APP_USER/APP_PASSWORD, falling back to the older
 * BASIC_AUTH_* names so existing deployments keep working without an env change.
 * If either is missing the gate is disabled entirely (local dev convenience).
 */
function credentials(): { user: string; pass: string } | null {
  const user = process.env.APP_USER || process.env.BASIC_AUTH_USER;
  const pass = process.env.APP_PASSWORD || process.env.BASIC_AUTH_PASS;
  return user && pass ? { user, pass } : null;
}

export function authEnabled(): boolean {
  return credentials() !== null;
}

/** Signing key. Distinct from the password when AUTH_SECRET is set. */
function signingKey(): string {
  const c = credentials();
  return process.env.AUTH_SECRET || (c ? c.pass : "");
}

function b64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Constant-time string compare — avoids leaking the signature byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Token is `<expiry-ms>.<hmac>` so it can't be forged or replayed after expiry. */
export async function createSessionToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${await hmac(exp, signingKey())}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true; // gate disabled — everything is public
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  return safeEqual(sig, await hmac(exp, signingKey()));
}

export async function checkCredentials(user: string, pass: string): Promise<boolean> {
  const c = credentials();
  if (!c) return false;
  // Compare hashes so both checks take the same time regardless of input length.
  const [u, p, cu, cp] = await Promise.all([
    hmac(user, "u"), hmac(pass, "p"), hmac(c.user, "u"), hmac(c.pass, "p"),
  ]);
  return safeEqual(u, cu) && safeEqual(p, cp);
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};
