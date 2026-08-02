// Capital allocation and risk budgeting.
//
// THE CORE IDEA: allocate RISK, not capital.
//
// "How much money do I put in each strategy?" is the wrong question, because
// leverage breaks the link between capital and exposure. An intraday MIS short
// controls ~5x its margin; a cash swing long controls exactly 1x. Sizing those by
// rupees deployed would silently make the intraday bucket 5x riskier.
//
// So every bucket gets a budget denominated in "% of total capital I am willing to
// LOSE", and position size is derived from that and the stop distance. Two trades
// in different buckets with the same risk budget hurt the same when they fail.
//
// Three layers, each a hard cap:
//   1. Per-trade risk  — most you can lose on any single position
//   2. Bucket heat     — most you can have at risk in one strategy family at once
//   3. Portfolio heat  — most you can have at risk across everything at once
//
// Layer 3 is what survives a correlated day: three "independent" fade shorts all
// lose together when the whole market gaps up and keeps running.

export type Bucket = "intraday" | "swing" | "options" | "cash";

export interface RiskProfile {
  capital: number;
  /** Most you'll lose on one trade, as % of capital. 1% is the professional default. */
  riskPerTradePct: number;
  /** Ceiling on total simultaneous open risk, as % of capital. */
  maxPortfolioHeatPct: number;
}

export const DEFAULT_PROFILE: Omit<RiskProfile, "capital"> = {
  riskPerTradePct: 1,
  maxPortfolioHeatPct: 6,
};

export interface BucketPolicy {
  bucket: Bucket;
  label: string;
  /** Max simultaneous open risk in this bucket, as % of capital. */
  maxHeatPct: number;
  /**
   * Capital below which this bucket should not be traded at all. Derived from tail
   * risk, not from margin: margin tells you what a broker will let you do, the tail
   * tells you what a bad week does to your account. See minCapitalForTail().
   */
  minCapital: number;
  rationale: string;
}

/**
 * The capital a strategy needs so its worst observed outcome stays survivable.
 *
 * Rule: the worst historical loss should not exceed `maxTailFraction` of capital
 * (default 10%). A 10% drawdown is recoverable and psychologically sustainable;
 * 30% changes how you trade, which is how good strategies get abandoned at the
 * bottom.
 *
 * NOTE this is the worst *observed* loss, not the worst possible. Undefined-risk
 * positions (short options) can and eventually will exceed it.
 */
export function minCapitalForTail(worstObservedLoss: number, maxTailFraction = 0.1): number {
  return Math.ceil(Math.abs(worstObservedLoss) / maxTailFraction);
}

export const BUCKET_POLICIES: BucketPolicy[] = [
  {
    bucket: "cash",
    label: "Cash & margin buffer",
    maxHeatPct: 0,
    minCapital: 0,
    rationale:
      "Not idle money — it is a position. Absorbs drawdowns without forcing you to cut winners, covers intraday margin calls, and lets you take a signal on the day after three losses. Traders who run at 100% deployed get liquidated by ordinary volatility.",
  },
  {
    bucket: "intraday",
    label: "Intraday (validated fades)",
    maxHeatPct: 2,
    minCapital: 50_000,
    rationale:
      "Capital-light: MIS leverage means a ₹25,000 position needs roughly ₹5,000 margin, so risk — not capital — is the binding constraint. Signals are rare (0–2/day), positions close the same day, and there is no overnight gap risk.",
  },
  {
    bucket: "swing",
    label: "Swing (2–5 day holds)",
    maxHeatPct: 3,
    minCapital: 100_000,
    rationale:
      "Needs more capital than intraday for the same risk: cash-market longs are unleveraged, so a position is fully funded. Carries overnight gap risk that a stop cannot protect against, which is why per-trade risk should be sized on the assumption the stop occasionally fails.",
  },
  {
    bucket: "options",
    label: "Options income (short premium)",
    maxHeatPct: 1,
    // Placeholder — recompute from CURRENT lot sizes before trading. See notes below.
    minCapital: 350_000,
    rationale:
      "Undefined risk. Margin (~₹1.45L for a NIFTY strangle) tells you what the broker allows, not what you can survive: the tested edge pays a small premium most weeks in exchange for occasional large losses. Size from the worst observed week, not from margin.",
  },
];

/**
 * ⚠️ The options minCapital above is STALE and must be recomputed.
 *
 * NSE cut index lot sizes in January 2026 (Nifty 75→65, BankNifty 35→30), and the
 * original strangle research was run on different lot sizes again. Every per-lot
 * rupee figure in that research therefore needs rescaling:
 *
 *   newWorstLoss = oldWorstLoss × (newLotSize / lotSizeUsedInResearch)
 *   minCapital   = minCapitalForTail(newWorstLoss)
 *
 * The PERCENTAGE edge from the research survives a lot-size change. The RUPEE
 * figures do not. Do not trade this bucket until the numbers are re-derived from
 * current contract specs.
 */
export const OPTIONS_SIZING_STALE = true;

export interface Allocation {
  policy: BucketPolicy;
  /** Rupees at risk if this bucket is fully loaded. */
  maxRiskAmount: number;
  unlocked: boolean;
  gateReason?: string;
}

export function allocate(profile: RiskProfile): Allocation[] {
  return BUCKET_POLICIES.map((policy) => {
    const unlocked = profile.capital >= policy.minCapital;
    return {
      policy,
      maxRiskAmount: Math.round((profile.capital * policy.maxHeatPct) / 100),
      unlocked,
      gateReason: unlocked
        ? undefined
        : `Needs ₹${policy.minCapital.toLocaleString("en-IN")} — a bad outcome here would be more than 10% of ₹${profile.capital.toLocaleString("en-IN")}.`,
    };
  });
}

/** Rupees you may lose on a single trade. */
export function riskPerTrade(profile: RiskProfile): number {
  return Math.round((profile.capital * profile.riskPerTradePct) / 100);
}

/**
 * Position size from risk budget and stop distance — the only correct way to size.
 * Quantity falls out of "how much am I willing to lose" and "where is my stop",
 * never from "how much money do I have".
 */
export function sizeFromRisk(
  entry: number,
  stop: number,
  profile: RiskProfile,
  opts: { leverage?: number } = {}
): { qty: number; riskAmount: number; exposure: number; marginNeeded: number; capped: "risk" | "capital" } {
  const perShareRisk = Math.abs(stop - entry);
  const budget = riskPerTrade(profile);
  const leverage = opts.leverage ?? 1;

  const byRisk = perShareRisk > 0 ? Math.floor(budget / perShareRisk) : 0;
  const byCapital = Math.floor((profile.capital * leverage) / entry);
  const qty = Math.max(0, Math.min(byRisk, byCapital));

  const exposure = qty * entry;
  return {
    qty,
    riskAmount: Math.round(qty * perShareRisk),
    exposure: Math.round(exposure),
    marginNeeded: Math.round(exposure / leverage),
    capped: byRisk <= byCapital ? "risk" : "capital",
  };
}

/** Whether adding `newRisk` would breach the portfolio-wide ceiling. */
export function heatCheck(
  profile: RiskProfile,
  openRisk: number,
  newRisk: number
): { ok: boolean; usedPct: number; wouldBePct: number; message: string } {
  const maxHeat = (profile.capital * profile.maxPortfolioHeatPct) / 100;
  const wouldBe = openRisk + newRisk;
  const ok = wouldBe <= maxHeat;
  return {
    ok,
    usedPct: +((openRisk / profile.capital) * 100).toFixed(2),
    wouldBePct: +((wouldBe / profile.capital) * 100).toFixed(2),
    message: ok
      ? `Open risk would be ${((wouldBe / profile.capital) * 100).toFixed(1)}% of capital (ceiling ${profile.maxPortfolioHeatPct}%).`
      : `Blocked: this would put ${((wouldBe / profile.capital) * 100).toFixed(1)}% of capital at risk, above your ${profile.maxPortfolioHeatPct}% ceiling. Close something or reduce size.`,
  };
}
