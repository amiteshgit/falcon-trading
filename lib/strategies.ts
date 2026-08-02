// Trading strategies. Shared by server + client.
//
// Every entry carries a `meta` block declaring its validation status. Only
// "validated" strategies may place live orders — see canPlaceOrders(). Candidates
// appear in the UI and generate signals, but their order buttons are disabled.
import { Quote } from "./provider/types";
import { Conviction, CORE29, LOWVOL } from "./universe";
import { tick } from "./format";
import type { StrategyMeta } from "./strategy-meta";

/**
 * Legacy flat risk cap in rupees, kept so existing callers keep working.
 * Prefer lib/capital.ts sizeFromRisk() — a fixed ₹1,000 is 2% of a ₹50,000 account
 * but 0.1% of a ₹10,00,000 one, so it silently changes meaning as capital grows.
 */
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
  meta: StrategyMeta;
  /** Profit target as % from entry. Undefined = exit at close (intraday fades). */
  targetPct?: number;
}

const gapPct = (r: ScanRow) => ((r.open - r.prevClose) / r.prevClose) * 100;

export const STRATEGIES: Record<string, Strategy> = {
  gap_fade: {
    id: "gap_fade",
    label: "Gap-up fade (short) — 2%",
    thrLabel: "Gap-up %", thrDefault: 2.0, stopPct: 2.0, needsHistory: false,
    signal: gapPct, sigText: (v) => `+${v.toFixed(2)}% gap`,
    blurb: "Short stocks that OPEN ≥ threshold above yesterday's close; cover at close. Backtest +0.47%/+0.37% (train/test), PF ~1.5 — strongest in low-vol names.",
    meta: {
      horizon: "intraday",
      status: "validated",
      direction: "short",
      backtest: {
        trainReturnPct: 0.47, testReturnPct: 0.37, trainPf: 1.5, testPf: 1.5,
        splitDate: "2024-07-01", costPct: 0.1,
        source: "research/equity-fade — 29 F&O large-caps, 4.5y daily bars",
      },
      info: {
        thesis: "Short a liquid large-cap that opens ≥2% above yesterday's close, and cover at the close the same day.",
        rationale:
          "A large opening gap is usually an overreaction to overnight news, amplified by retail orders queued before the open. Once liquidity returns, market makers and institutions fade the imbalance. You are being paid to supply liquidity to an over-eager crowd — a structural, repeatable behaviour rather than a chart pattern.",
        mechanics: [
          "Entry: short at/near the open once the gap is confirmed ≥ threshold.",
          "Stop: 2% above entry, submitted WITH the order as a Cover Order so it lives at the exchange.",
          "Exit: cover at the close. This is an intraday strategy — MIS positions are auto-squared by the broker anyway.",
          "Universe: liquid F&O-listed stocks only. Illiquid names have spreads that eat the edge.",
        ],
        failureModes: [
          "Genuine re-rating: an earnings beat or upgrade gaps the stock and it keeps running all day. The 2% stop is what caps this.",
          "Strong trending markets, where every gap holds and fades stop working for weeks at a time.",
          "News-driven gaps (M&A, regulatory) which are information, not overreaction.",
        ],
        cautions: [
          "You cannot hold this overnight — Indian rules require intraday shorts to be squared off the same day.",
          "The edge is roughly +0.4% per trade before slippage. It only compounds if costs stay low; over-trading destroys it.",
          "Signals are rare — 0–2 per day is normal. An empty scan is the strategy working, not failing.",
        ],
        expectation:
          "About 0–2 signals a day, average ~+0.4% per trade after costs, profit factor ~1.5. Expect roughly 45–55% winners: the edge comes from winners being larger than losers, not from being right often.",
      },
    },
  },
  bigup_reversal: {
    id: "bigup_reversal",
    label: "Big up-day reversal (short) — 4%",
    thrLabel: "Prior-day gain %", thrDefault: 4.0, stopPct: 3.0, needsHistory: true, universe: CORE29,
    signal: (r) => (r.yret == null ? null : r.yret), sigText: (v) => `+${v.toFixed(2)}% yest`,
    blurb: "Short stocks the day AFTER a single-day jump ≥ threshold; cover at close. Backtest +0.75%/+0.13% (train/test), PF ~2.0/1.2.",
    meta: {
      horizon: "intraday",
      status: "validated",
      direction: "short",
      backtest: {
        trainReturnPct: 0.75, testReturnPct: 0.13, trainPf: 2.0, testPf: 1.2,
        splitDate: "2024-07-01", costPct: 0.1,
        source: "research/equity-fade — core-29 universe",
      },
      info: {
        thesis: "Short the day AFTER a stock posts a single-day gain of ≥4%, and cover at that day's close.",
        rationale:
          "Same overreaction principle as the gap fade, but on a slower clock. A one-day 4%+ move in a large-cap usually overshoots fair value; the following session tends to give some back as momentum buyers are filled and profit-taking begins.",
        mechanics: [
          "Signal computed from yesterday's close-to-close return, so it needs one extra historical fetch.",
          "Entry: short near the open on the day after the jump.",
          "Stop: 3% — wider than the gap fade because these names are already moving.",
          "Exit: cover at the close.",
          "Universe: core-29 large-caps only — this was never validated on the wider 202.",
        ],
        failureModes: [
          "Momentum continuation, where a 4% day is the START of a re-rating rather than an overshoot.",
          "The out-of-sample edge is much weaker than in-sample (+0.13% vs +0.75%) — treat this as the thinnest of the three.",
        ],
        cautions: [
          "⚠️ Weakest validated edge here. It stays positive out-of-sample, which is the bar, but PF falls from 2.0 to 1.2 — barely above break-even after real slippage.",
          "Signals are much rarer than the gap fade. Do not lower the threshold to manufacture trades; the threshold is where the edge was measured.",
          "Consider sizing this at half your normal risk given the thin out-of-sample margin.",
        ],
        expectation:
          "A handful of signals a month. Out-of-sample average ~+0.13%/trade — genuinely marginal. Include it for diversification of signal timing, not as a primary earner.",
      },
    },
  },
  gap_fade_lowvol: {
    id: "gap_fade_lowvol",
    label: "Gap-up fade — low-vol only (highest conviction)",
    thrLabel: "Gap-up %", thrDefault: 2.0, stopPct: 2.0, needsHistory: false, universe: LOWVOL,
    signal: gapPct, sigText: (v) => `+${v.toFixed(2)}% gap`,
    blurb: "Gap-up fade restricted to the 9 lowest-volatility large-caps, where the edge concentrates. Backtest +0.97%/+0.77% (train/test), PF ~3.5/3.1 — best risk-adjusted, but rare.",
    meta: {
      horizon: "intraday",
      status: "validated",
      direction: "short",
      backtest: {
        trainReturnPct: 0.97, testReturnPct: 0.77, trainPf: 3.5, testPf: 3.1,
        splitDate: "2024-07-01", costPct: 0.1,
        source: "research/equity-fade — 9 lowest-volatility large-caps",
      },
      info: {
        thesis: "The same gap-up fade, restricted to the nine calmest large-caps in the universe.",
        rationale:
          "The volatility study found the fade edge is not spread evenly — it concentrates in low-volatility names. A 2% gap in a stock that normally moves 1% a day is a far bigger anomaly than the same gap in one that routinely moves 4%. Restricting the universe raises the signal-to-noise ratio dramatically.",
        mechanics: [
          "Identical entry, stop and exit to the standard gap fade.",
          "Universe restricted to: ICICIBANK, ITC, SUNPHARMA, HINDUNILVR, BHARTIARTL, HDFCBANK, RELIANCE, TCS, KOTAKBANK.",
        ],
        failureModes: [
          "Rare signals. A 2% gap in these names is genuinely unusual, so you may go weeks without a trade.",
          "Regime change: if one of these names enters a volatile period (a scandal, a merger), it no longer belongs in a low-vol basket. The list is static in code and should be re-derived periodically.",
        ],
        cautions: [
          "Best risk-adjusted result in the whole research programme (PF 3.1 out-of-sample) — but the sample is small precisely because signals are rare. Small samples overstate confidence.",
          "Resist widening the universe to get more trades. The narrow universe IS the edge.",
        ],
        expectation:
          "Very few signals — possibly a handful per quarter. Average ~+0.77%/trade out-of-sample with PF ~3.1. This is the highest-quality signal available; size it at full risk when it appears.",
      },
    },
  },
};

/**
 * CANDIDATES — implemented and visible, but PAPER ONLY until they pass a train/test
 * split. Order buttons stay disabled (canPlaceOrders() returns false).
 *
 * These are long-side by design. All three validated strategies are short, and NSE
 * forbids holding a short equity position overnight — so a 2–5 day swing book has to
 * be long, or expressed through derivatives where the tested edge does not transfer.
 */
export const CANDIDATE_STRATEGIES: Record<string, Strategy> = {
  swing_downday_bounce: {
    id: "swing_downday_bounce",
    label: "3-down-day bounce (long) — CANDIDATE",
    thrLabel: "Cumulative drop %", thrDefault: 4.0, stopPct: 4.0, needsHistory: true, universe: LOWVOL,
    targetPct: 5.0,
    signal: (r) => (r.yret == null ? null : -r.yret),
    sigText: (v) => `−${v.toFixed(2)}% recent`,
    blurb: "UNVALIDATED. Buy low-volatility large-caps after consecutive down days, targeting a 2–5 day mean-reversion bounce. Must pass train/test before it can place orders.",
    meta: {
      horizon: "swing",
      status: "candidate",
      direction: "long",
      info: {
        thesis: "Buy a low-volatility large-cap after a run of consecutive down days, and hold 2–5 days for a mean-reversion bounce.",
        rationale:
          "The mirror of the fade edge. If overreaction upward reverts intraday, sustained selling in a fundamentally stable large-cap should also overshoot. Long-side matters structurally: it can be held overnight in the cash market (CNC), which a short cannot.",
        mechanics: [
          "Signal: cumulative decline over recent sessions in a low-volatility name.",
          "Entry: buy at the open (delivery/CNC, so it can be held).",
          "Stop: 4% below entry. Wider than intraday because overnight gaps are unavoidable.",
          "Exit: profit target ~5%, or time-stop after 5 sessions — whichever comes first.",
        ],
        failureModes: [
          "Catching a falling knife: consecutive down days can be the start of a genuine de-rating, not an overshoot.",
          "Overnight gap risk. A stop does NOT protect you — a bad-news gap opens below it and you take the full loss.",
          "Unleveraged, so capital-hungry compared to intraday.",
        ],
        cautions: [
          "⚠️ NOT VALIDATED. No train/test split has been run. It is displayed so signals can be paper-traded and logged, nothing more.",
          "The 3-down-day pattern is widely published, which is a reason for suspicion — well-known patterns are often arbitraged away.",
          "Do not trade real money on this until it clears the same bar as the fades.",
        ],
        expectation:
          "Unknown. That is the honest answer, and the reason orders are disabled. Expect the backtest to reject it — most candidates fail, which is the process working.",
      },
    },
  },
};

/** Everything shown in the UI. Validation status decides what can actually trade. */
export const ALL_STRATEGIES: Record<string, Strategy> = {
  ...STRATEGIES,
  ...CANDIDATE_STRATEGIES,
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
