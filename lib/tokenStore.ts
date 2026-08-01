// Small server-side token store so BOTH the browser app and the MCP endpoint
// can use the same Kite access token when running locally.
// (On Vercel the filesystem is ephemeral — there the browser cookie is the source
//  of truth and the MCP-with-live-data feature is intended for local use.)
import fs from "fs";
import os from "os";
import path from "path";

const FILE = path.join(os.tmpdir(), "falcon_trading_token");

export function saveToken(token: string) {
  try { fs.writeFileSync(FILE, token, "utf8"); } catch { /* ignore */ }
}

export function readStoredToken(): string | null {
  try {
    const t = fs.readFileSync(FILE, "utf8").trim();
    return t || null;
  } catch { return null; }
}

export function clearStoredToken() {
  try { fs.unlinkSync(FILE); } catch { /* ignore */ }
}
