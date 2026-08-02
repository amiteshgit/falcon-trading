"use client";
import { useMemo, useState } from "react";
import { STRATEGIES, CANDIDATE_STRATEGIES, candidates, type ScanRow, type Strategy } from "@/lib/strategies";
import { DEFAULT_PROFILE, type Bucket } from "@/lib/capital";
import { useScan } from "@/lib/scan-context";
import { fmt } from "@/lib/format";
import StrategyPicker from "./StrategyPicker";
import TradeCard from "./TradeCard";
import { TONE } from "./shared";

/** Strategies for one horizon, validated first so the good ones lead. */
function forHorizon(horizon: Bucket): Record<string, Strategy> {
  const all = { ...STRATEGIES, ...CANDIDATE_STRATEGIES };
  const out: Record<string, Strategy> = {};
  for (const s of Object.values(all).filter((s) => s.meta.horizon === horizon)) out[s.id] = s;
  return Object.fromEntries(
    Object.entries(out).sort(([, a], [, b]) => (a.meta.status === "validated" ? -1 : 1) - (b.meta.status === "validated" ? -1 : 1))
  );
}

export default function ScannerView({ horizon, emptyNote }: { horizon: Bucket; emptyNote: string }) {
  const { rows, capital, place } = useScan();
  const strategies = useMemo(() => forHorizon(horizon), [horizon]);
  const ids = Object.keys(strategies);

  const [stratId, setStratId] = useState(ids[0] ?? "");
  const [thr, setThr] = useState(strategies[ids[0]]?.thrDefault ?? 2);

  const profile = { capital, ...DEFAULT_PROFILE };
  const strat = strategies[stratId];

  const cands = useMemo(
    () => (strat ? candidates(rows, strat, thr) : []),
    [rows, strat, thr]
  );

  if (!strat) {
    return (
      <div className={`rounded-lg p-4 text-[13px] ${TONE.indigo}`}>
        <b>No strategies for this horizon yet.</b>
        <p className="mt-1 opacity-90">{emptyNote}</p>
      </div>
    );
  }

  const movers = rows
    .map((r) => ({ r, v: strat.signal(r) }))
    .filter((x): x is { r: ScanRow; v: number } => x.v != null)
    .sort((a, b) => b.v - a.v)
    .slice(0, 10);

  return (
    <div>
      <StrategyPicker
        strategies={strategies}
        value={stratId}
        onChange={setStratId}
        thr={thr}
        setThr={setThr}
      />

      <p className="text-[12.5px] text-gray-500 dark:text-gray-400 my-3">{strat.blurb}</p>

      {strat.meta.status !== "validated" && (
        <div className={`rounded-lg px-3.5 py-2.5 text-[12px] mb-4 ${TONE.amber}`}>
          <b>Paper trading only.</b> This strategy hasn&apos;t passed an out-of-sample train/test split,
          so order placement is disabled. Signals are shown so you can log them and see how they would
          have performed — that&apos;s the evidence needed to validate or reject it.
        </div>
      )}

      <div className="sect">
        Trade setups — {cands.length} {cands.length === 1 ? "signal" : "signals"}
      </div>

      {cands.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm py-2">
          Nothing reached the {thr}% {strat.thrLabel.toLowerCase()} threshold. 0–2 signals a day is
          normal — the selectivity is where the edge comes from, so an empty scan is the strategy
          working, not failing.
        </p>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {cands.map((r) => (
            <TradeCard key={r.symbol} r={r} strat={strat} profile={profile} place={place} />
          ))}
        </div>
      )}

      <div className="sect">Closest to triggering</div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr><th>Stock</th><th>{strat.thrLabel}</th><th>Conviction</th><th>LTP</th><th>Status</th></tr>
          </thead>
          <tbody>
            {movers.map(({ r, v }) => (
              <tr key={r.symbol}>
                <td>{r.symbol}</td>
                <td className={v >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                  {v >= 0 ? "+" : ""}{v.toFixed(2)}%
                </td>
                <td>{r.conv === "NA" ? "—" : r.conv}</td>
                <td>{fmt(r.ltp)}</td>
                <td>{v >= thr ? <span className="text-red-600 dark:text-red-400 font-semibold">SIGNAL</span> : "—"}</td>
              </tr>
            ))}
            {movers.length === 0 && (
              <tr><td colSpan={5} className="!text-center text-gray-400 dark:text-gray-600 py-3">Run a scan to populate.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
