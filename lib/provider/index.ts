// Factory: returns the mock or live Kite provider based on env + session.
// Next 15: cookies() is async, so getProvider() is async.
import { cookies } from "next/headers";
import { DataProvider } from "./types";
import { MockProvider } from "./mock";
import { KiteProvider } from "./kite";
import { AT_COOKIE } from "../auth";
import { readStoredToken } from "../tokenStore";

export class NotAuthenticatedError extends Error {
  constructor() { super("not_authenticated"); this.name = "NotAuthenticatedError"; }
}

export async function getProvider(): Promise<DataProvider> {
  const mode = process.env.DATA_PROVIDER || "mock";
  if (mode === "kite") {
    // browser requests carry the httpOnly cookie; MCP/server requests fall back to the
    // token saved at login (so Claude can use your live session locally).
    const jar = await cookies();
    const at = jar.get(AT_COOKIE)?.value || readStoredToken();
    if (!at) throw new NotAuthenticatedError();
    return new KiteProvider(process.env.KITE_API_KEY!, at);
  }
  return new MockProvider();
}

export * from "./types";
