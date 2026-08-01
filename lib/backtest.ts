// Gap-up fade short backtest (same-day: short at open, cover at close, % stop above entry).
import { Candle } from "./provider/types";

export interface Trade { date: string; symbol: string; ret: number }
export interface Metrics { n: number; win: number; avg: number; pf: number; tot: number; mdd: number }
export interface BacktestResult {
  params: { gap: number; stopPct: number; cost: number; splitDate: string };
  all: Metrics; train: Metrics; test: Metrics; bySymbol: Record<string, Metrics>;
}

export function gapFadeTrades(symbol: string, candles: Candle[], gap: number, stopPct: number, cost: number): Trade[] {
  const out: Trade[] = [];
  const c = [...candles].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < c.length; i++) {
    const pc = c[i - 1].close, o = c[i].open;
    if (pc <= 0 || ((o / pc - 1) * 100) < gap) continue;
    let ret: number;
    if (c[i].high >= o * (1 + stopPct / 100)) ret = -stopPct;         // stopped out
    else ret = (o / c[i].close - 1) * 100;                            // short: profit if close < open
    out.push({ date: c[i].date.slice(0, 10), symbol, ret: ret - cost });
  }
  return out;
}

export function metrics(rets: number[]): Metrics {
  if (!rets.length) return { n: 0, win: 0, avg: 0, pf: 0, tot: 0, mdd: 0 };
  const wins = rets.filter((r) => r > 0), losses = rets.filter((r) => r <= 0);
  const gl = Math.abs(losses.reduce((a, b) => a + b, 0));
  let eq = 0, peak = 0, mdd = 0;
  for (const r of rets) { eq += r; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq - peak); }
  return {
    n: rets.length,
    win: (wins.length / rets.length) * 100,
    avg: rets.reduce((a, b) => a + b, 0) / rets.length,
    pf: gl > 0 ? wins.reduce((a, b) => a + b, 0) / gl : 99,
    tot: rets.reduce((a, b) => a + b, 0),
    mdd,
  };
}

export function runBacktest(
  candlesBySymbol: Record<string, Candle[]>,
  gap = 2, stopPct = 2, cost = 0.1, splitDate = "2024-07-01"
): BacktestResult {
  const all: Trade[] = [];
  const bySymbol: Record<string, Metrics> = {};
  for (const [sym, candles] of Object.entries(candlesBySymbol)) {
    const t = gapFadeTrades(sym, candles, gap, stopPct, cost);
    bySymbol[sym] = metrics(t.map((x) => x.ret));
    all.push(...t);
  }
  const trainR = all.filter((t) => t.date < splitDate).map((t) => t.ret);
  const testR = all.filter((t) => t.date >= splitDate).map((t) => t.ret);
  return {
    params: { gap, stopPct, cost, splitDate },
    all: metrics(all.map((t) => t.ret)),
    train: metrics(trainR),
    test: metrics(testR),
    bySymbol,
  };
}
