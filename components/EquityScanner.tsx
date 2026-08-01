"use client";
import { useMemo, useState } from "react";
import { STRATEGIES, candidates, calcShort, ScanRow } from "@/lib/strategies";
import { money, fmt } from "@/lib/format";
import { useScan } from "@/lib/scan-context";
import type { OrderRequest } from "@/lib/provider/types";
import { ConvChip, Metric, TONE } from "./shared";
import StrategyControls from "./StrategyControls";

export default function EquityScanner() {
  const { rows, eqStrat, setEqStrat, eqThr, setEqThr, capital, place } = useScan();
  const s = STRATEGIES[eqStrat];
  const cands = useMemo(() => candidates(rows, s, eqThr), [rows, s, eqThr]);
  const movers = useMemo(
    () => rows.map((r) => ({ r, v: s.signal(r) })).filter((x): x is { r: ScanRow; v: number } => x.v != null).sort((a, b) => b.v - a.v).slice(0, 12),
    [rows, s]
  );

  return (
    <div>
      <StrategyControls strat={eqStrat} setStrat={setEqStrat} thr={eqThr} setThr={setEqThr} />
      <p className="text-[12.5px] text-gray-500 dark:text-gray-400 my-3">{s.blurb}</p>

      <div className="sect">Short candidates — {s.label}</div>
      {cands.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm py-2">No candidate reached the {eqThr}% {s.thrLabel.toLowerCase()}. 0–2 is normal; the selectivity is the edge.</p>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {cands.map((r) => <EquityCard key={r.symbol} r={r} strat={s} capital={capital} place={place} />)}
        </div>
      )}

      <div className="sect">Biggest movers — across the scanned universe</div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Stock</th><th>{s.thrLabel}</th><th>Conv.</th><th>LTP</th><th>Note</th></tr></thead>
          <tbody>
            {movers.map(({ r, v }) => (
              <tr key={r.symbol}>
                <td>{r.symbol}</td>
                <td className={v >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>{v >= 0 ? "+" : ""}{v.toFixed(2)}%</td>
                <td>{r.conv === "NA" ? "—" : r.conv}</td>
                <td>{fmt(r.ltp)}</td>
                <td>{v >= eqThr ? <span className="text-red-600 dark:text-red-400 font-semibold">SHORT</span> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquityCard({ r, strat, capital, place }: { r: ScanRow; strat: any; capital: number; place: any }) {
  const c = calcShort(r.ltp, strat.stopPct, capital);
  const [otype, setOtype] = useState<"MARKET" | "LIMIT">("MARKET");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit() {
    const order: OrderRequest = {
      variety: "co", exchange: "NSE", tradingsymbol: r.symbol, transactionType: "SELL", orderType: otype,
      product: "MIS", quantity: c.qty, triggerPrice: +c.stop.toFixed(2), validity: "DAY", tag: "fade",
      ...(otype === "LIMIT" ? { price: +r.ltp.toFixed(2) } : {}),
    };
    const res = await place(order, {
      title: `Confirm SHORT — ${r.symbol}`,
      warn: "Real SHORT via intraday Cover Order. Stop is built in; exits at the close.",
      lines: [
        ["Action", `SELL ${c.qty} @ ${otype === "LIMIT" ? "LIMIT " + fmt(r.ltp) : "MARKET"}`],
        ["Stop (buy trigger)", `${fmt(c.stop)} (${c.stopPct}%)`],
        ["Exposure", money(c.exposure)],
        ["Max loss", money(c.maxLoss)],
      ],
    });
    if (res.ok) setResult({ ok: true, msg: `Short placed — ID ${res.orderId}. Cover by close.` });
    else if (res.error !== "cancelled") setResult({ ok: false, msg: res.error || "failed" });
  }

  return (
    <div className="card border-l-4 border-l-red-600">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-base font-bold">{r.symbol}</span> <span className="text-[11px] text-gray-500 dark:text-gray-400">{r.sector}</span>
          <span className={`chip ml-1.5 ${TONE.red}`}>SHORT</span> <ConvChip c={r.conv} />
        </div>
        <div className="text-[15px] font-bold text-red-600 dark:text-red-400">{strat.sigText(strat.signal(r))}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 my-3">
        <Metric k="Entry (LTP)" v={fmt(r.ltp)} /><Metric k={`Stop ${c.stopPct}%`} v={fmt(c.stop)} cls="text-red-600 dark:text-red-400" /><Metric k="Exit" v="at close" cls="text-emerald-600 dark:text-emerald-400" />
        <Metric k="Qty" v={String(c.qty)} /><Metric k="Exposure" v={money(c.exposure)} /><Metric k="Max loss" v={money(c.maxLoss)} />
      </div>
      <div className="inline-flex border border-gray-300 dark:border-[#2A3142] rounded-md overflow-hidden mb-2">
        {(["MARKET", "LIMIT"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setOtype(t)}
            className={`px-3.5 py-1.5 text-[12.5px] font-semibold ${otype === t ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "bg-white dark:bg-[#0F1319] text-gray-700 dark:text-gray-300"}`}
          >
            {t === "LIMIT" ? `Limit @ ${fmt(r.ltp)}` : "Market"}
          </button>
        ))}
      </div>
      <button className="btn w-full" onClick={submit}>Place Short Cover Order</button>
      {result && (
        <div className={`mt-2.5 rounded-lg px-3 py-2 text-[12.5px] ${result.ok ? TONE.emerald : TONE.red}`}>{result.msg}</div>
      )}
    </div>
  );
}
