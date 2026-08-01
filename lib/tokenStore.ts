// Small server-side token store so BOTH the browser app and the MCP endpoint
// can use the same Kite access token — LOCAL DEVELOPMENT ONLY.
//
// Why it is local-only: on a serverless host the filesystem is per-instance and
// survives between requests from DIFFERENT people. If this token were readable as
// an auth fallback in production, any anonymous visitor who happened to hit a warm
// instance after the owner logged in would inherit the owner's Kite session —
// full portfolio access, and order placement. So the store is disabled unless the
// process is a genuine local dev server.
import fs from "fs";
import os from "os";
import path from "path";

const FILE = path.join(os.tmpdir(), "falcon_trading_token");

// Vercel/AWS/Netlify all set one of these. Only a local `next dev`/`next start`
// with no serverless marker is treated as trusted single-user.
export function isLocalRuntime(): boolean {
  if (process.env.ALLOW_SHARED_TOKEN_STORE === "true") return true; // explicit opt-in (self-hosted VPS)
  return !(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.CF_PAGES
  );
}

export function saveToken(token: string) {
  if (!isLocalRuntime()) return;
  try { fs.writeFileSync(FILE, token, "utf8"); } catch { /* ignore */ }
}

export function readStoredToken(): string | null {
  if (!isLocalRuntime()) return null;
  try {
    const t = fs.readFileSync(FILE, "utf8").trim();
    return t || null;
  } catch { return null; }
}

export function clearStoredToken() {
  if (!isLocalRuntime()) return;
  try { fs.unlinkSync(FILE); } catch { /* ignore */ }
}
