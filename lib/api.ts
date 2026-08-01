// Client-side fetch helpers for the API routes.
import type { Quote, Holding, Position, Instrument, OrderRequest } from "./provider/types";
import type { BacktestResult } from "./backtest";

async function j(res: Response) {
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || "request failed"), { status: res.status, code: data.error });
  return data;
}

export async function fetchQuotes(symbols: string[]): Promise<{ quotes: Record<string, Quote>; provider: string }> {
  return j(await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbols }) }));
}
export async function fetchPortfolio(): Promise<{ holdings: Holding[]; positions: Position[]; provider: string }> {
  return j(await fetch("/api/holdings"));
}
export async function fetchInstruments(name: string): Promise<{ instruments: Instrument[] }> {
  return j(await fetch(`/api/instruments?name=${encodeURIComponent(name)}`));
}
export async function fetchLtp(instruments: string[]): Promise<{ ltp: Record<string, number> }> {
  return j(await fetch("/api/ltp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruments }) }));
}
export async function placeOrder(order: OrderRequest): Promise<{ result: { orderId: string }; provider: string }> {
  return j(await fetch("/api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) }));
}
export async function fetchPriorReturns(symbols: string[]): Promise<{ yret: Record<string, number> }> {
  return j(await fetch("/api/prior-returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbols }) }));
}
export async function runBacktestApi(body: { symbols?: string[]; gap?: number; stopPct?: number }): Promise<{ result: BacktestResult; provider: string; symbolsTested: number }> {
  return j(await fetch("/api/backtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}
export interface SessionInfo {
  live: boolean;
  authenticated: boolean;
  trading: { enabled: boolean; reason: string };
}
export async function fetchSession(): Promise<SessionInfo> {
  return j(await fetch("/api/session"));
}
export async function logout(): Promise<{ ok: boolean }> {
  return j(await fetch("/api/session", { method: "DELETE" }));
}
