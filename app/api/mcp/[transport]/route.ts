// MCP server — exposes the app's data + strategy engine as tools Claude can call.
// Endpoints: /api/mcp/mcp (Streamable HTTP)  and  /api/mcp/sse
// Add it in Claude as a custom connector (see README).
//
// NOTE: middleware.ts deliberately exempts this path from Basic-Auth (a connector
// can't answer a browser auth prompt), so on a public deployment this route is the
// one unauthenticated surface. Set MCP_AUTH_TOKEN to require a bearer token.
import crypto from "crypto";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getProvider } from "@/lib/provider";
import { STRATEGIES, candidates, calcShort, ScanRow } from "@/lib/strategies";
import { runBacktest } from "@/lib/backtest";
import { FNO_UNIVERSE, CORE29, SECTORS, conviction } from "@/lib/universe";
import type { Candle } from "@/lib/provider/types";

const CAPITAL = Number(process.env.NEXT_PUBLIC_CAPITAL || 50000);
const j = (o: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(o, null, 2) }] });

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "list_strategies",
      "List the validated trading strategies and their default parameters.",
      {},
      async () =>
        j(Object.values(STRATEGIES).map((s) => ({ id: s.id, label: s.label, thrDefault: s.thrDefault, stopPct: s.stopPct, blurb: s.blurb })))
    );

    server.tool(
      "scan_candidates",
      "Scan the market right now for a strategy's short candidates (with entry/stop/size).",
      {
        strategy: z.string().default("gap_fade"),
        threshold: z.number().optional(),
        universe: z.enum(["fno", "core"]).default("fno"),
      },
      async ({ strategy, threshold, universe }) => {
        const p = await getProvider();
        const strat = STRATEGIES[strategy] ?? STRATEGIES.gap_fade;
        const syms = strat.universe ?? (universe === "core" ? CORE29 : FNO_UNIVERSE);
        const quotes = await p.getQuotes(syms);
        const rows: ScanRow[] = syms
          .map((s) => quotes[s])
          .filter(Boolean)
          .map((q) => ({ ...q, sector: SECTORS[q.symbol] || "F&O", conv: conviction(q.symbol), yret: null }));
        if (strat.needsHistory) {
          const today = new Date().toISOString().slice(0, 10);
          const from = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10);
          await Promise.all(
            rows.map(async (r) => {
              if (!r.instrumentToken) return;
              try {
                const bars = await p.getHistorical(r.instrumentToken, "day", from + " 09:15:00", today + " 15:30:00");
                const done = bars.filter((b) => b.date.slice(0, 10) < today);
                if (done.length >= 2) r.yret = (done[done.length - 1].close / done[done.length - 2].close - 1) * 100;
              } catch { /* skip */ }
            })
          );
        }
        const thr = threshold ?? strat.thrDefault;
        const cands = candidates(rows, strat, thr).map((r) => {
          const c = calcShort(r.ltp, strat.stopPct, CAPITAL);
          return { symbol: r.symbol, signalPct: +strat.signal(r)!.toFixed(2), ltp: r.ltp, conviction: r.conv, stop: c.stop, qty: c.qty, maxLoss: Math.round(c.maxLoss) };
        });
        return j({ strategy: strat.id, threshold: thr, count: cands.length, candidates: cands });
      }
    );

    server.tool(
      "run_backtest",
      "Backtest the gap-up fade over daily history with a train/test split. Defaults to the core-29 large-caps.",
      { symbols: z.array(z.string()).optional(), gap: z.number().default(2), stopPct: z.number().default(2) },
      async ({ symbols, gap, stopPct }) => {
        const p = await getProvider();
        const syms = symbols?.length ? symbols : CORE29;
        const quotes = await p.getQuotes(syms);
        const candles: Record<string, Candle[]> = {};
        const to = new Date().toISOString().slice(0, 10) + " 15:30:00";
        for (const s of syms) {
          const tok = quotes[s]?.instrumentToken;
          if (!tok) continue;
          try { candles[s] = await p.getHistorical(tok, "day", "2022-01-01 09:15:00", to); } catch { /* skip */ }
        }
        return j(runBacktest(candles, gap, stopPct));
      }
    );

    server.tool("get_portfolio", "Live holdings and open positions with P&L.", {}, async () => {
      const p = await getProvider();
      const [holdings, positions] = await Promise.all([p.getHoldings(), p.getPositions()]);
      return j({ holdings, positions });
    });

    server.tool(
      "get_quotes",
      "Live quotes for specific NSE symbols (e.g. ['RELIANCE','INFY']).",
      { symbols: z.array(z.string()) },
      async ({ symbols }) => {
        const p = await getProvider();
        return j(await p.getQuotes(symbols));
      }
    );
  },
  {},
  { basePath: "/api/mcp" }
);

function tokenMatches(got: string, want: string): boolean {
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// If MCP_AUTH_TOKEN is set, require `Authorization: Bearer <token>`. Unset (the
// local default) leaves the endpoint open so the connector works with no setup.
function withAuth<T extends (...args: any[]) => any>(h: T): T {
  return (async (req: Request, ...rest: any[]) => {
    const want = process.env.MCP_AUTH_TOKEN;
    if (want) {
      const got = req.headers.get("authorization") ?? "";
      if (!got.startsWith("Bearer ") || !tokenMatches(got.slice(7), want)) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return h(req, ...rest);
  }) as unknown as T;
}

const guarded = withAuth(handler);
export { guarded as GET, guarded as POST };
