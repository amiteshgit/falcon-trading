// Factory: returns the mock or live Kite provider based on env + session.
// Next 15: cookies() is async, so getProvider() is async.
import { DataProvider } from "./types";
import { MockProvider } from "./mock";
import { KiteProvider } from "./kite";
import { resolveAccessToken } from "../auth";

export class NotAuthenticatedError extends Error {
  constructor() { super("not_authenticated"); this.name = "NotAuthenticatedError"; }
}

export async function getProvider(): Promise<DataProvider> {
  const mode = process.env.DATA_PROVIDER || "mock";
  if (mode === "kite") {
    // Shared with /api/session so the UI's "logged in?" state always matches what
    // the data routes can actually do. See resolveAccessToken() in lib/auth.ts.
    const at = await resolveAccessToken();
    if (!at) throw new NotAuthenticatedError();
    return new KiteProvider(process.env.KITE_API_KEY!, at);
  }
  return new MockProvider();
}

export * from "./types";
