// Turns a scanner signal into a complete, executable trade plan:
// entry, target, stop, quantity, order type — and the REASONING for each.
//
// The reasoning matters as much as the numbers. A number you can't justify is a
// number you'll abandon the moment the trade goes against you.

import type { ScanRow, Strategy } from "./strategies";
import type { RiskProfile } from "./capital";
import { sizeFromRisk, riskPerTrade } from "./capital";
import { tick } from "./format";

export type OrderType = "MARKET" | "LIMIT";

export interface TradePlan {
  symbol: string;
  direction: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  targetBasis: string;
  qty: number;
  exposure: number;
  marginNeeded: number;
  riskAmount: number;
  rewardAmount: number;
  rr: number;
  orderType: OrderType;
  limitPrice: number;
  orderReasoning: string;
  exitRule: string;
  warnings: string[];
  tradable: boolean;
}

/**
 * Spread as % of price — the cost of crossing to get an immediate fill.
 * Above ~0.10% a market order starts eating a meaningful slice of a ~0.4% edge.
 */
function spreadPct(r: ScanRow): number | null {
  if (r.bid == null || r.ask == null || r.bid <= 0 || r.ask <= 0) return null;
  return ((r.ask - r.bid) / r.ltp) * 100;
}

const WIDE_SPREAD_PCT = 0.1;

/**
 * Market vs limit, with a reason.
 *
 * The trade-off: a fade edge decays through the session, so a missed fill costs
 * the whole trade. But crossing a wide spread costs a fixed slice of a small edge.
 * So: cross when the spread is cheap, post when it isn't — and post when price has
 * already run your way, because chasing a move that has started is how you buy the
 * bottom of the fade.
 */
function decideOrderType(r: ScanRow, strat: Strategy): { type: OrderType; limitPrice: number; reasoning: string } {
  const sp = spreadPct(r);
  const short = strat.meta.direction === "short";

  // How far price has already moved from the open in our favour.
  const movedPct = r.open > 0 ? ((r.ltp - r.open) / r.open) * 100 : 0;
  const alreadyMovedOurWay = short ? movedPct < -0.3 : movedPct > 0.3;

  if (sp != null && sp > WIDE_SPREAD_PCT) {
    const price = short ? (r.bid ?? r.ltp) : (r.ask ?? r.ltp);
    return {
      type: "LIMIT",
      limitPrice: tick(price),
      reasoning: `Spread is ${sp.toFixed(2)}% of price — wide. A market order would give up roughly ${(sp / 2).toFixed(2)}% on entry alone, which is a large slice of a ~0.4% edge. Posting a limit at ${short ? "the bid" : "the ask"} avoids paying it, at the cost of possibly not filling.`,
    };
  }

  if (alreadyMovedOurWay) {
    return {
      type: "LIMIT",
      limitPrice: tick(r.ltp),
      reasoning: `Price has already moved ${Math.abs(movedPct).toFixed(2)}% ${short ? "down" : "up"} from the open — part of the expected move is gone. Chasing with a market order enters late and worsens your risk/reward. A limit at ${r.ltp.toFixed(2)} only fills if you get a reasonable price.`,
    };
  }

  return {
    type: "MARKET",
    limitPrice: tick(r.ltp),
    reasoning:
      sp != null
        ? `Spread is tight (${sp.toFixed(2)}% of price) and the move hasn't started yet. This edge decays through the session, so a certain fill is worth more than saving half a tick.`
        : `Liquid name and the move hasn't started. This edge decays through the session — a certain fill is worth more than optimising entry by a tick.`,
  };
}

/**
 * The profit target, and why it sits where it does.
 *
 * For a gap fade the natural target is the FULL GAP FILL — yesterday's close. It is
 * the level the thesis actually predicts, not an arbitrary percentage. If the gap
 * closes, the overreaction has corrected and the trade is done.
 */
function decideTarget(r: ScanRow, strat: Strategy): { target: number; basis: string } {
  if (strat.targetPct != null) {
    const mult = strat.meta.direction === "short" ? 1 - strat.targetPct / 100 : 1 + strat.targetPct / 100;
    return { target: tick(r.ltp * mult), basis: `${strat.targetPct}% move from entry (strategy target)` };
  }

  if (strat.meta.direction === "short" && r.prevClose > 0 && r.prevClose < r.ltp) {
    return {
      target: tick(r.prevClose),
      basis: "Yesterday's close — full gap fill, the level the thesis actually predicts",
    };
  }

  const avg = strat.meta.backtest?.testReturnPct ?? 0.4;
  const mult = strat.meta.direction === "short" ? 1 - avg / 100 : 1 + avg / 100;
  return { target: tick(r.ltp * mult), basis: `Historical average move (${avg}% out-of-sample)` };
}

export function buildTradePlan(
  r: ScanRow,
  strat: Strategy,
  profile: RiskProfile,
  opts: { leverage?: number } = {}
): TradePlan {
  const short = strat.meta.direction === "short";
  const entry = r.ltp;
  const stop = tick(short ? entry * (1 + strat.stopPct / 100) : entry * (1 - strat.stopPct / 100));
  const { target, basis } = decideTarget(r, strat);

  const leverage = opts.leverage ?? (strat.meta.horizon === "intraday" ? 5 : 1);
  const sized = sizeFromRisk(entry, stop, profile, { leverage });

  const rewardPerShare = Math.abs(target - entry);
  const riskPerShare = Math.abs(stop - entry);
  const rr = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;

  const order = decideOrderType(r, strat);

  const warnings: string[] = [];
  if (strat.meta.status !== "validated") {
    warnings.push("This strategy has NOT passed out-of-sample validation. Signals are for paper-trading only — order placement is disabled.");
  }
  if (rr < 1) {
    warnings.push(`Risk/reward is ${rr.toFixed(2)}:1 — you're risking more than the target pays. The edge here comes from win RATE, not payoff, so this is expected for fades, but it means discipline on the stop is everything.`);
  }
  if (sized.qty === 0) {
    warnings.push(`Position size rounds to zero: a single share risks more than your ₹${riskPerTrade(profile).toLocaleString("en-IN")} per-trade budget. Increase capital or skip this signal.`);
  }
  if (short && strat.meta.horizon !== "intraday") {
    warnings.push("Short equity positions cannot be held overnight in India. This must be closed today or expressed through derivatives.");
  }

  return {
    symbol: r.symbol,
    direction: strat.meta.direction,
    entry, stop, target, targetBasis: basis,
    qty: sized.qty,
    exposure: sized.exposure,
    marginNeeded: sized.marginNeeded,
    riskAmount: sized.riskAmount,
    rewardAmount: Math.round(sized.qty * rewardPerShare),
    rr: +rr.toFixed(2),
    orderType: order.type,
    limitPrice: order.limitPrice,
    orderReasoning: order.reasoning,
    exitRule:
      strat.meta.horizon === "intraday"
        ? "Cover at the close. The stop rides with the order (Cover Order), so protection sits at the exchange."
        : `Exit at target, at stop, or after ${5} sessions — whichever comes first.`,
    warnings,
    tradable: strat.meta.status === "validated" && sized.qty > 0,
  };
}
