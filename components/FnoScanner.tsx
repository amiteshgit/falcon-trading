"use client";
import { useEffect, useMemo, useState } from "react";
import { STRATEGIES, candidates, ScanRow } from "@/lib/strategies";
import { money, fmt, tick } from "@/lib/format";
import { fetchInstruments, fetchLtp } from "@/lib/api";
import { useScan } from "@/lib/scan-context";
import type { OrderRequest, Instrument } from "@/lib/provider/types";
import { ConvChip, Metric, TONE } from "./shared";
import StrategyControls from "./StrategyControls";

interface Resolved {
  none?: boolean;
  fut?: { tradingsymbol: string; lotSize: number; expiry: string };
  notional?: number; margin?: number;
  opt?: { expiry: string; atm: number; lot: number; ce?: string; pe?: string; cePx: number | null; pePx: number | null };
}

async function resolve(row: ScanRow): Promise<Resolved> {
  const { instruments } = await fetchInstruments(row.symbol);
  const today = new Date().toISOString().slice(0, 10);
  const futs = instruments.filter((i) => i.instrumentType === "FUT" && i.expiry >= today).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const fut = futs[0];
  if (!fut) return { none: true };
  let opt: Resolved["opt"] = undefined;
  const opts = instruments.filter((i) => (i.instrumentType === "CE" || i.instrumentType === "PE") && i.expiry >= today);
  if (opts.length) {
    const nearExp = opts.map((o) => o.expiry).sort()[0];
    const chain = opts.filter((o) => o.expiry === nearExp);
    const strikes = Array.from(new Set(chain.map((o) => o.strike)));
    const atm = strikes.reduce((p, c) => (Math.abs(c - row.ltp) < Math.abs(p - row.ltp) ? c : p), strikes[0]);
    const ce = chain.find((o) => o.strike === atm && o.instrumentType === "CE");
    const pe = chain.find((o) => o.strike === atm && o.instrumentType === "PE");
    let cePx: number | null = null, pePx: number | null = null;
    try {
      const keys = [ce && "NFO:" + ce.tradingsymbol, pe && "NFO:" + pe.tradingsymbol].filter(Boolean) as string[];
      const { ltp } = await fetchLtp(keys);
      if (ce) cePx = ltp["NFO:" + ce.tradingsymbol] ?? null;
      if (pe) pePx = ltp["NFO:" + pe.tradingsymbol] ?? null;
    } catch {}
    opt = { expiry: nearExp, atm, lot: fut.lotSize, ce: ce?.tradingsymbol, pe: pe?.tradingsymbol, cePx, pePx };
  }
  const notional = row.ltp * fut.lotSize;
  return { fut: { tradingsymbol: fut.tradingsymbol, lotSize: fut.lotSize, expiry: fut.expiry }, notional, margin: notional * 0.18, opt };
}

export default function FnoScanner() {
  const { rows, fnoStrat, setFnoStrat, fnoThr, setFnoThr, capital, place } = useScan();
  const s = STRATEGIES[fnoStrat];
  const cands = useMemo(() => candidates(rows, s, fnoThr), [rows, s, fnoThr]);

  return (
    <div>
      <StrategyControls strat={fnoStrat} setStrat={setFnoStrat} thr={fnoThr} setThr={setFnoThr} />
      <div className={`rounded-lg px-3 py-2 text-xs my-3 ${TONE.red}`}>
        <b>Capital reality:</b> one lot of a stock future needs ~₹70k–₹1.8L margin — more than your set capital ({money(capital)}). At this capital, buy the <b>PUT</b> instead (defined risk, affordable). Raise capital in the profile menu if you&apos;re funded for futures.
      </div>
      <div className="sect !mt-4">F&amp;O short candidates — {s.label}</div>
      {cands.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">No candidate reached the {fnoThr}% {s.thrLabel.toLowerCase()} today.</p>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {cands.map((r) => <FnoCard key={r.symbol} r={r} strat={s} capital={capital} place={place} />)}
        </div>
      )}
    </div>
  );
}

function FnoCard({ r, strat, capital, place }: { r: ScanRow; strat: any; capital: number; place: any }) {
  const [res, setRes] = useState<Resolved | null>(null);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => { let on = true; resolve(r).then((x) => on && setRes(x)).catch(() => on && setRes({ none: true })); return () => { on = false; }; }, [r.symbol]);

  const stop = tick(r.ltp * (1 + strat.stopPct / 100));

  async function shortFuture() {
    if (!res?.fut) return;
    const lots = Math.floor(capital / (res.margin || 1));
    const order: OrderRequest = { variety: "co", exchange: "NFO", tradingsymbol: res.fut.tradingsymbol, transactionType: "SELL", orderType: "MARKET", product: "MIS", quantity: lots * res.fut.lotSize, triggerPrice: +stop.toFixed(2), validity: "DAY", tag: "fno-fade" };
    const out = await place(order, { title: `Confirm SHORT FUTURE — ${r.symbol}`, warn: "Leveraged short futures. Losses can exceed the shown margin if the stop gaps. Stop is built in; exits at close.", lines: [["Contract", res.fut.tradingsymbol], ["Sell", `${lots} lot × ${res.fut.lotSize}`], ["Stop", fmt(stop)], ["Est. margin", money((res.margin || 0) * lots)]] });
    if (out.ok) setResult(`Futures short placed — ID ${out.orderId}`); else if (out.error !== "cancelled") setResult(out.error || "failed");
  }
  async function buyPut() {
    const o = res?.opt; if (!o || o.pePx == null || !o.pe) return;
    const cost = o.pePx * o.lot;
    const order: OrderRequest = { variety: "regular", exchange: "NFO", tradingsymbol: o.pe, transactionType: "BUY", orderType: "LIMIT", price: +o.pePx.toFixed(2), product: "MIS", quantity: o.lot, validity: "DAY", tag: "fade-put" };
    const out = await place(order, { title: `Buy PUT — ${r.symbol}`, warn: "Defined-risk short expression. Option P&L differs from the tested underlying move (decay/IV). Exit same day.", lines: [["Buy", `${o.lot} × ${o.pe}`], ["Limit", fmt(o.pePx)], ["Premium cost", money(cost)], ["Max loss", money(cost)]] });
    if (out.ok) setResult(`Put buy placed — ID ${out.orderId}`); else if (out.error !== "cancelled") setResult(out.error || "failed");
  }

  const lots = res?.margin ? Math.floor(capital / res.margin) : 0;
  return (
    <div className="card border-l-4 border-l-red-600">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-base font-bold">{r.symbol}</span> <span className="text-[11px] text-gray-500 dark:text-gray-400">{r.sector}</span>
          <span className={`chip ml-1.5 ${TONE.red}`}>SHORT FUT</span> <ConvChip c={r.conv} />
        </div>
        <div className="text-[15px] font-bold text-red-600 dark:text-red-400">{strat.sigText(strat.signal(r))}</div>
      </div>
      {!res ? <div className="text-[11.5px] text-gray-400 dark:text-gray-600 my-3">Resolving contract…</div> : res.none ? <div className="text-[11.5px] text-gray-400 dark:text-gray-600 my-3">No listed derivative found.</div> : (<>
        <div className="grid grid-cols-3 gap-2 my-3">
          <Metric k="Future" v={res.fut!.tradingsymbol} /><Metric k="Lot" v={String(res.fut!.lotSize)} /><Metric k={`Stop ${strat.stopPct}%`} v={fmt(stop)} cls="text-red-600 dark:text-red-400" />
          <Metric k="1-lot notional" v={money(res.notional!)} /><Metric k="Est. margin/lot" v={money(res.margin!)} /><Metric k="Lots you can take" v={String(lots)} cls={lots >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
        </div>
        {lots >= 1 ? <button className="btn w-full mb-2" onClick={shortFuture}>Short {lots} lot{lots > 1 ? "s" : ""} (Futures CO)</button>
          : <button className="btn w-full mb-2 !bg-gray-200 dark:!bg-gray-800 !text-gray-400 dark:!text-gray-600" disabled>Needs {money(res.margin!)} margin — above capital</button>}
        {res.opt && (
          <div className={`rounded-lg px-3 py-2.5 mt-1 ${TONE.violet}`}>
            <div className="text-xs font-semibold mb-1">Options — {res.opt.expiry} · ATM {res.opt.atm}</div>
            <div className="text-[11.5px] opacity-90">PUT {res.opt.pe || "—"} ≈ ₹{res.opt.pePx != null ? fmt(res.opt.pePx) : "—"} · CALL {res.opt.ce || "—"} ≈ ₹{res.opt.cePx != null ? fmt(res.opt.cePx) : "—"}</div>
            {res.opt.pePx != null && <>
              <div className="text-[11.5px] opacity-90 my-1.5">Affordable short: <b>buy 1 lot PUT</b> ≈ {money(res.opt.pePx * res.opt.lot)} — max loss = premium.</div>
              <button className="btn btn-violet w-full" onClick={buyPut}>Buy 1 lot PUT (~{money(res.opt.pePx * res.opt.lot)})</button>
            </>}
          </div>
        )}
      </>)}
      {result && <div className={`mt-2.5 rounded-lg px-3 py-2 text-[12.5px] ${TONE.emerald}`}>{result}</div>}
    </div>
  );
}
