"use client";
import { useState } from "react";
import { runBacktestApi } from "@/lib/api";
import type { BacktestResult, Metrics } from "@/lib/backtest";
import { pnlClass } from "./shared";

export default function BacktestView() {
  const [gap, setGap] = useState(2);
  const [stopPct, setStopPct] = useState(2);
  const [res, setRes] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  const [n, setN] = useState(0);

  async function run() {
    setRunning(true); setErr(""); setRes(null);
    try { const r = await runBacktestApi({ gap, stopPct }); setRes(r.result); setN(r.symbolsTested); }
    catch (e: any) { setErr(e.message); }
    finally { setRunning(false); }
  }

  const Row = ({ label, m }: { label: string; m: Metrics }) => (
    <tr>
      <td>{label}</td><td>{m.n}</td><td>{m.win.toFixed(1)}%</td>
      <td className={pnlClass(m.avg)}>{m.avg >= 0 ? "+" : ""}{m.avg.toFixed(2)}</td>
      <td>{m.pf === 99 ? "∞" : m.pf.toFixed(2)}</td><td>{m.tot.toFixed(0)}</td><td>{m.mdd.toFixed(0)}</td>
    </tr>
  );

  return (
    <div>
      <div className="flex items-end gap-2.5 flex-wrap">
        <label className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
          Gap threshold %<input className="field w-24" type="number" step={0.5} value={gap} onChange={(e) => setGap(parseFloat(e.target.value) || 2)} />
        </label>
        <label className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
          Stop %<input className="field w-24" type="number" step={0.5} value={stopPct} onChange={(e) => setStopPct(parseFloat(e.target.value) || 2)} />
        </label>
        <button className="btn btn-blue" onClick={run} disabled={running}>{running ? "Running…" : "Run backtest (core 29)"}</button>
      </div>
      <p className="text-[12.5px] text-gray-500 dark:text-gray-400 my-3">
        Gap-up fade short, backtested on daily history with a train/test split at 2024-07-01. Costs 0.10% round-trip.
        {err && <span className="text-red-600 dark:text-red-400"> {err}</span>}
      </p>
      {res && (
        <>
          <div className="sect">Results ({n} stocks)</div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Window</th><th>N</th><th>Win%</th><th>Avg%/trade</th><th>PF</th><th>Total%</th><th>MaxDD</th></tr></thead>
              <tbody>
                <Row label="Train (< 2024-07)" m={res.train} />
                <Row label="Test (≥ 2024-07)" m={res.test} />
                <Row label="All" m={res.all} />
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-gray-400 dark:text-gray-600 mt-3">A strategy is trustworthy only if it stays positive in BOTH train and test. Momentum/breakout variants fail this; the gap-fade holds.</p>
        </>
      )}
    </div>
  );
}
