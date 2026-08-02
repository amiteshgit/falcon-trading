// Strategy metadata: what a strategy is, whether it has earned the right to place
// real orders, and the honest documentation behind the ⓘ panel.
//
// The validation gate is the point of this file. Every strategy carries a status,
// and only "validated" ones may place live orders. A strategy is validated when it
// is profitable after costs in BOTH halves of an out-of-sample train/test split —
// not when it looks good on a chart, and not when it is profitable overall (which
// a single lucky period can produce).
//
// Rejected strategies stay listed on purpose. Deleting them loses the most
// expensive thing the research produced: the knowledge that they don't work. This
// list is what stops the same idea being re-added in six months.

import type { Bucket } from "./capital";

export type ValidationStatus = "validated" | "candidate" | "rejected";

export interface BacktestRecord {
  trainReturnPct: number;   // avg % per trade, in-sample
  testReturnPct: number;    // avg % per trade, out-of-sample
  trainPf: number;          // profit factor
  testPf: number;
  splitDate: string;
  costPct: number;          // round-trip cost assumed
  source: string;           // where these numbers came from
}

export interface StrategyInfo {
  /** One line: what the trade actually is. */
  thesis: string;
  /** Why the edge should exist — the market behaviour being exploited. */
  rationale: string;
  /** Concrete mechanics: entry, exit, stop. */
  mechanics: string[];
  /** When this loses. Every strategy has conditions that break it. */
  failureModes: string[];
  /** Practical cautions specific to trading it on NSE. */
  cautions: string[];
  /** Honest expectation — frequency and magnitude, not a promise. */
  expectation: string;
}

export interface StrategyMeta {
  horizon: Bucket;
  status: ValidationStatus;
  /** Long or short. Matters: NSE forbids holding a short equity position overnight. */
  direction: "long" | "short";
  backtest?: BacktestRecord;
  /** Rupee capital below which this shouldn't be traded. Falls back to bucket policy. */
  minCapital?: number;
  info: StrategyInfo;
  /** For rejected entries: why it failed. */
  rejectionReason?: string;
}

/** Only validated strategies may place live orders. Everything else is paper-only. */
export function canPlaceOrders(meta: StrategyMeta): boolean {
  return meta.status === "validated";
}

export function statusLabel(status: ValidationStatus): { text: string; tone: "emerald" | "amber" | "red" } {
  switch (status) {
    case "validated": return { text: "Validated", tone: "emerald" };
    case "candidate": return { text: "Candidate — paper only", tone: "amber" };
    case "rejected":  return { text: "Rejected", tone: "red" };
  }
}

/**
 * Strategies that were tested and FAILED out-of-sample. Kept visible with their
 * failure reasons so they don't get resurrected without new evidence.
 */
export const REJECTED: { id: string; label: string; reason: string }[] = [
  { id: "orb", label: "Opening-range breakout", reason: "Failed out-of-sample. Breakouts on NSE large-caps mean-revert more often than they continue — this is the losing side of the fade edge." },
  { id: "momentum_breakout", label: "Momentum / price breakout", reason: "Positive in-sample, negative out-of-sample. Classic overfit to a trending period." },
  { id: "high52", label: "52-week-high momentum", reason: "Did not survive the train/test split after costs." },
  { id: "rsi2", label: "RSI(2) mean-reversion", reason: "Edge disappeared out-of-sample once realistic costs were applied." },
  { id: "xs_reversal", label: "Cross-sectional short-term reversal", reason: "Too thin after costs; the signal exists but does not clear transaction friction." },
  { id: "momentum_rotation", label: "Momentum rotation", reason: "Failed out-of-sample." },
  { id: "overnight_drift", label: "Overnight drift", reason: "No reliable edge; also structurally hard — you cannot short equities overnight in India." },
  { id: "index_gap", label: "Index directional gap & reversal", reason: "Index gaps behave differently from single stocks — no edge found on NIFTY/BankNifty." },
  { id: "iron_condor", label: "Iron condor (hedged strangle)", reason: "Every wing width failed out-of-sample. Key insight: the short strangle's edge IS payment for bearing the tail. Buying wings removes the premium that constitutes the edge." },
];
