"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { money, fmt, pct } from "@/lib/format";
import { fetchPortfolio } from "@/lib/api";
import type { Holding, Position } from "@/lib/provider/types";
import { pnlClass, Stat, TONE } from "./shared";

export default function PortfolioView() {
  const [data, setData] = useState<{ holdings: Holding[]; positions: Position[] } | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setErr("");
    try { const d = await fetchPortfolio(); setData(d); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading && !data) return <p className="text-gray-500 dark:text-gray-400 text-sm">Loading portfolio…</p>;
  if (err === "not_authenticated") return <p className="text-gray-500 dark:text-gray-400 text-sm">Log in to Kite above to see your live portfolio.</p>;
  if (err) return <p className="text-red-600 dark:text-red-400 text-sm">{err}</p>;
  if (!data) return null;

  const H = data.holdings;
  const invested = H.reduce((a, h) => a + h.qty * h.avgPrice, 0);
  const current = H.reduce((a, h) => a + h.qty * h.ltp, 0);
  const pnl = H.reduce((a, h) => a + h.pnl, 0);
  const open = data.positions.filter((p) => p.qty !== 0);
  const posPnl = data.positions.reduce((a, p) => a + p.pnl, 0);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn btn-blue flex items-center gap-1.5" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh portfolio
        </button>
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] mb-2">
        <Stat k="Holdings value" v={money(current)} s={`invested ${money(invested)}`} />
        <Stat k="Holdings P&L" v={(pnl >= 0 ? "+" : "−") + money(Math.abs(pnl))} s={pct(invested > 0 ? (pnl / invested) * 100 : 0)} cls={pnlClass(pnl)} />
        <Stat k="Positions P&L (today)" v={(posPnl >= 0 ? "+" : "−") + money(Math.abs(posPnl))} s="live" cls={pnlClass(posPnl)} />
        <Stat k="Open positions" v={String(open.length)} s="intraday/derivative" />
      </div>

      <div className="sect">Open positions</div>
      {open.length === 0 ? <p className="text-gray-500 dark:text-gray-400 text-sm">No open positions.</p> : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Instrument</th><th>Side</th><th>Qty</th><th>Avg</th><th>LTP</th><th>P&L</th></tr></thead>
            <tbody>
              {open.map((p) => (
                <tr key={p.symbol + p.product}>
                  <td>{p.symbol} <span className="text-gray-400 dark:text-gray-600 text-[11px]">{p.product}</span></td>
                  <td><span className={`chip ${p.qty > 0 ? TONE.emerald : TONE.red}`}>{p.qty > 0 ? "LONG" : "SHORT"}</span></td>
                  <td>{Math.abs(p.qty)}</td><td>{fmt(p.avgPrice)}</td><td>{fmt(p.ltp)}</td>
                  <td className={pnlClass(p.pnl)}>{(p.pnl >= 0 ? "+" : "−") + money(Math.abs(p.pnl))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sect">Holdings</div>
      {H.length === 0 ? <p className="text-gray-500 dark:text-gray-400 text-sm">No delivery holdings.</p> : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Stock</th><th>Qty</th><th>Avg</th><th>LTP</th><th>Value</th><th>P&L</th><th>P&L%</th><th>Day</th></tr></thead>
            <tbody>
              {[...H].sort((a, b) => b.qty * b.ltp - a.qty * a.ltp).map((h) => {
                const plp = h.avgPrice > 0 ? (h.pnl / (h.qty * h.avgPrice)) * 100 : 0;
                return (
                  <tr key={h.symbol}>
                    <td>{h.symbol}</td><td>{h.qty}</td><td>{fmt(h.avgPrice)}</td><td>{fmt(h.ltp)}</td><td>{money(h.qty * h.ltp)}</td>
                    <td className={pnlClass(h.pnl)}>{(h.pnl >= 0 ? "+" : "−") + money(Math.abs(h.pnl))}</td>
                    <td className={pnlClass(plp)}>{pct(plp)}</td><td className={pnlClass(h.dayChangePct)}>{pct(h.dayChangePct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
