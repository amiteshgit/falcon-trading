// Validated fade strategies (out-of-sample tested). Shared by server + client.
import { Quote } from "./provider/types";
import { Conviction, CORE29, LOWVOL } from "./universe";
import { tick } from "./format";

export const RISK_MAX = 1000;

export interface ScanRow extends Quote {
  sector: string;
  conv: Conviction;
  yret?: number | null; // yesterday's single-day return %, for reversal
}

export interface Strategy {
  id: string;
  label: string;
  thrLabel: string;
  thrDefault: number;
  stopPct: number;
  needsHistory: boolean;
  universe?: string[];
  signal: (r: ScanRow) => number | null;
  sigText: (v: number) => string;
  blurb: string;
}

const gapPct = (r: ScanRow) => ((r.open - r.prevClose) / r.prevClose) * 100;

export const STRATEGIES: Record<string, Strategy> = {
  gap_fade: {
    id: "gap_fade",
    label: "Gap-up fade (short) — 2%",
    thrLabel: "Gap-up %", thrDefault: 2.0, stopPct: 2.0, needsHistory: false,
    signal: gapPct, sigText: (v) => `+${v.toFixed(2)}% gap`,
    blurb: "Short stocks that OPEN ≥ threshold above yesterday's close; cover at close. Backtest +0.47%/+0.37% (train/test), PF ~1.5 — strongest in low-vol names.",
  },
  bigup_reversal: {
    id: "bigup_reversal",
    label: "Big up-day reversal (short) — 4%",
    thrLabel: "Prior-day gain %", thrDefault: 4.0, stopPct: 3.0, needsHistory: true, universe: CORE29,
    signal: (r) => (r.yret == null ? null : r.yret), sigText: (v) => `+${v.toFixed(2)}% yest`,
    blurb: "Short stocks the day AFTER a single-day jump ≥ threshold; cover at close. Backtest +0.75%/+0.13% (train/test), PF ~2.0/1.2.",
  },
  gap_fade_lowvol: {
    id: "gap_fade_lowvol",
    label: "Gap-up fade — low-vol only (highest conviction)",
    thrLabel: "Gap-up %", thrDefault: 2.0, stopPct: 2.0, needsHistory: false, universe: LOWVOL,
    signal: gapPct, sigText: (v) => `+${v.toFixed(2)}% gap`,
    blurb: "Gap-up fade restricted to the 9 lowest-volatility large-caps, where the edge concentrates. Backtest +0.97%/+0.77% (train/test), PF ~3.5/3.1 — best risk-adjusted, but rare.",
  },
};

export function candidates(rows: ScanRow[], strat: Strategy, thr: number): ScanRow[] {
  const uni = strat.universe;
  return rows
    .filter((r) => !uni || uni.includes(r.symbol))
    .filter((r) => { const v = strat.signal(r); return v != null && v >= thr; })
    .sort((a, b) => (strat.signal(b)! - strat.signal(a)!));
}

export interface ShortCalc {
  stop: number; qty: number; maxLoss: number; exposure: number; stopPct: number;
}

export function calcShort(entry: number, stopPct: number, capital: number): ShortCalc {
  const stop = tick(entry * (1 + stopPct / 100));
  const risk = stop - entry;
  const qty = Math.max(1, Math.min(Math.floor(capital / entry), Math.floor(RISK_MAX / risk)));
  return { stop, qty, maxLoss: qty * risk, exposure: qty * entry, stopPct };
}
