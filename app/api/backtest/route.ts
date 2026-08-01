import { NextResponse } from "next/server";
import { getProvider, NotAuthenticatedError } from "@/lib/provider";
import { runBacktest } from "@/lib/backtest";
import { CORE29 } from "@/lib/universe";
import type { Candle } from "@/lib/provider/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const symbols: string[] = body.symbols?.length ? body.symbols : CORE29;
    const gap = body.gap ?? 2;
    const stopPct = body.stopPct ?? 2;
    const from = body.from ?? "2022-01-01 09:15:00";
    const to = body.to ?? new Date().toISOString().slice(0, 10) + " 15:30:00";

    const p = await getProvider();
    const quotes = await p.getQuotes(symbols);
    const candlesBySymbol: Record<string, Candle[]> = {};
    for (const s of symbols) {
      const tok = quotes[s]?.instrumentToken;
      if (!tok) continue;
      try { candlesBySymbol[s] = await p.getHistorical(tok, "day", from, to); } catch { /* skip */ }
    }
    const result = runBacktest(candlesBySymbol, gap, stopPct);
    return NextResponse.json({ result, provider: p.name, symbolsTested: Object.keys(candlesBySymbol).length });
  } catch (e: any) {
    if (e instanceof NotAuthenticatedError)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    return NextResponse.json({ error: e.message || "backtest failed" }, { status: 500 });
  }
}
