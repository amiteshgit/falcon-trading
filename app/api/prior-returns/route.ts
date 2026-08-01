import { NextResponse } from "next/server";
import { getProvider, NotAuthenticatedError } from "@/lib/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Yesterday's single-day return % per symbol (for the big up-day reversal strategy).
export async function POST(req: Request) {
  try {
    const { symbols } = (await req.json()) as { symbols: string[] };
    const p = await getProvider();
    const quotes = await p.getQuotes(symbols);
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10);
    const yret: Record<string, number> = {};
    await Promise.all(symbols.map(async (s) => {
      const tok = quotes[s]?.instrumentToken;
      if (!tok) return;
      try {
        const bars = await p.getHistorical(tok, "day", from + " 09:15:00", today + " 15:30:00");
        const done = bars.filter((b) => b.date.slice(0, 10) < today);
        if (done.length >= 2) yret[s] = (done[done.length - 1].close / done[done.length - 2].close - 1) * 100;
      } catch { /* skip */ }
    }));
    return NextResponse.json({ yret });
  } catch (e: any) {
    if (e instanceof NotAuthenticatedError)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    return NextResponse.json({ error: e.message || "error" }, { status: 500 });
  }
}
