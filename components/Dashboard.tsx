"use client";
import { useEffect, useMemo, useState } from "react";
import { STRATEGIES, candidates, calcShort, ScanRow, RISK_MAX } from "@/lib/strategies";
import { FNO_UNIVERSE, CORE29, SECTORS, conviction } from "@/lib/universe";
import { money, fmt, pct, volFmt } from "@/lib/format";
import { fetchQuotes, fetchPortfolio, fetchPriorReturns, placeOrder, fetchSession, runBacktestApi } from "@/lib/api";
import type { OrderRequest, Holding, Position } from "@/lib/provider/types";
import type { BacktestResult } from "@/lib/backtest";
import { ConvChip, pnlClass, PlaceFn, PlaceResult } from "./shared";
import FnoTab from "./FnoTab";

type Tab = "eq" | "fno" | "port" | "backtest";
const CAPITAL_DEFAULT = Number(process.env.NEXT_PUBLIC_CAPITAL || 50000);

export default function Dashboard() {
  const [session, setSession] = useState<{ live: boolean; authenticated: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("eq");
  const [scanSet, setScanSet] = useState<"fno" | "core">("fno");
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [ts, setTs] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const [eqStrat, setEqStrat] = useState("gap_fade");
  const [eqThr, setEqThr] = useState(2);
  const [fnoStrat, setFnoStrat] = useState("gap_fade");
  const [fnoThr, setFnoThr] = useState(2);
  const [capital, setCapital] = useState(CAPITAL_DEFAULT);

  const [modal, setModal] = useState<null | { title: string; lines: [string, string][]; warn: string; resolve: (r: PlaceResult) => void; order: OrderRequest }>(null);

  useEffect(() => { fetchSession().then(setSession).catch(() => {}); }, []);
  useEffect(() => { if (session && (!session.live || session.authenticated)) runScan(); /* eslint-disable-next-line */ }, [session, scanSet]);

  function scanList() { return scanSet === "core" ? CORE29 : FNO_UNIVERSE; }

  async function runScan() {
    setLoading(true); setErr(""); setStatus("Fetching live quotes…");
    try {
      const { quotes, provider } = await fetchQuotes(scanList());
      setProvider(provider);
      let list: ScanRow[] = [];
      let t: string | null = null;
      for (const s of scanList()) {
        const q = quotes[s]; if (!q) continue;
        list.push({ ...q, sector: SECTORS[s] || "F&O", conv: conviction(s), yret: null });
      }
      // history needed for reversal strategy
      const needHist = [STRATEGIES[eqStrat], STRATEGIES[fnoStrat]].find((x) => x.needsHistory);
      if (needHist) {
        const uni = needHist.universe || scanList();
        setStatus("Fetching prior-day moves…");
        try {
          const { yret } = await fetchPriorReturns(list.filter((r) => uni.includes(r.symbol)).map((r) => r.symbol));
          list = list.map((r) => ({ ...r, yret: yret[r.symbol] ?? null }));
        } catch {}
      }
      setRows(list); setTs(new Date().toISOString());
      setStatus(`${provider === "mock" ? "MOCK data" : "Kite connected"} · scanned ${list.length} stocks · ${new Date().toLocaleTimeString("en-IN")}`);
    } catch (e: any) {
      if (e.code === "not_authenticated") setStatus("Not logged in to Kite.");
      else setErr(e.message || "scan failed");
    } finally { setLoading(false); }
  }

  const place: PlaceFn = (order, meta) =>
    new Promise((resolve) => setModal({ ...meta, order, resolve }));

  async function confirmModal() {
    if (!modal) return;
    const m = modal; setModal(null);
    try { const { result } = await placeOrder(m.order); m.resolve({ ok: true, orderId: result.orderId }); }
    catch (e: any) { m.resolve({ ok: false, error: e.message }); }
  }

  return (
    <div>
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">🦅 Falcon Trading</h1>
          <p className="text-xs text-gray-500 mt-0.5">Validated NSE fade strategies · scan, portfolio & backtest</p>
        </div>
        <ProviderBadge session={session} provider={provider} />
      </header>

      <div className="text-[12.5px] text-gray-500 my-3 min-h-[16px]">{loading ? "Loading…" : status}{err && <span className="text-red-600"> {err}</span>}</div>

      {session?.live && !session.authenticated && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3.5 mb-4">
          <div className="font-bold text-orange-800 text-sm">Connect your Zerodha account</div>
          <div className="text-[11.5px] text-orange-800 my-1.5">Live mode needs a daily Kite login (sessions expire every morning ~7:30 AM IST).</div>
          <a className="btn btn-blue inline-block no-underline" href="/api/kite/login">Log in to Kite ↗</a>
        </div>
      )}

      <div className="flex items-end gap-2.5 flex-wrap mb-1">
        <label className="text-xs text-gray-500 flex flex-col gap-1">Scan universe <span className="text-gray-400 text-[10px]">(applies to all tabs)</span>
          <select className="field min-w-[220px] font-semibold" value={scanSet} onChange={(e) => setScanSet(e.target.value as any)}>
            <option value="fno">Liquid shortable stocks (202)</option>
            <option value="core">Core large-caps (29, backtested)</option>
          </select>
        </label>
      </div>

      <nav className="flex gap-1.5 border-b border-gray-200 my-4">
        {([["eq", "Equity (Cash)"], ["fno", "F&O"], ["port", "Portfolio"], ["backtest", "Backtest"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-[13.5px] font-semibold -mb-px border-b-2 ${tab === id ? "text-gray-900 border-red-600" : "text-gray-500 border-transparent"}`}>{label}</button>
        ))}
      </nav>

      {tab === "eq" && <EquityTab rows={rows} strat={eqStrat} setStrat={setEqStrat} thr={eqThr} setThr={setEqThr} capital={capital} place={place} onRescan={runScan} ts={ts} />}
      {tab === "fno" && <FnoTab rows={rows} strat={fnoStrat} setStrat={setFnoStrat} thr={fnoThr} setThr={setFnoThr} capital={capital} setCapital={setCapital} place={place} />}
      {tab === "port" && <PortfolioTab />}
      {tab === "backtest" && <BacktestTab scanSet={scanSet} />}

      {modal && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-50" onClick={() => { modal.resolve({ ok: false, error: "cancelled" }); setModal(null); }}>
          <div className="bg-white rounded-2xl p-5 max-w-[420px] w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2">{modal.title}</h3>
            {modal.lines.map(([k, v], i) => <div className="kv" key={i}><span className="text-gray-500">{k}</span><span>{v}</span></div>)}
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2.5 py-2 text-xs my-3">{modal.warn}</div>
            <div className="flex gap-2.5 mt-3.5">
              <button className="btn btn-ghost flex-1" onClick={() => { modal.resolve({ ok: false, error: "cancelled" }); setModal(null); }}>Cancel</button>
              <button className="btn flex-1" onClick={confirmModal}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11.5px] text-gray-400 mt-7 leading-relaxed">
        Only strategies that survived out-of-sample validation are offered. Data-driven edges, not guarantees — intraday shorting (and leveraged futures) carries real risk of loss. Not investment advice.
        {provider === "mock" && " · Running on MOCK data — set DATA_PROVIDER=kite with your API key for live."}
      </p>
    </div>
  );
}

function ProviderBadge({ session, provider }: { session: any; provider: string }) {
  const live = session?.live;
  const ok = provider === "kite" || (session && !live);
  return (
    <span className={`chip ${provider === "kite" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"}`}>
      {provider === "kite" ? "● LIVE (Kite)" : "● MOCK data"}
    </span>
  );
}

/* ---------------- Equity tab ---------------- */
function ScanControls({ strat, setStrat, thr, setThr, onRescan, extra }: any) {
  const s = STRATEGIES[strat];
  return (
    <div className="flex items-end gap-2.5 flex-wrap">
      <label className="text-xs text-gray-500 flex flex-col gap-1">Strategy
        <select className="field min-w-[230px] font-semibold" value={strat} onChange={(e) => { setStrat(e.target.value); setThr(STRATEGIES[e.target.value].thrDefault); }}>
          {Object.values(STRATEGIES).map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-500 flex flex-col gap-1">{s.thrLabel}
        <input className="field w-20" type="number" step={0.25} min={0.25} value={thr} onChange={(e) => setThr(parseFloat(e.target.value) || s.thrDefault)} />
      </label>
      {extra}
      <button className="btn" onClick={onRescan}>Run Scan</button>
    </div>
  );
}

function EquityTab({ rows, strat, setStrat, thr, setThr, capital, place, onRescan, ts }: any) {
  const s = STRATEGIES[strat];
  const cands = useMemo(() => candidates(rows, s, thr), [rows, strat, thr]);
  const movers = useMemo(() => rows.map((r: ScanRow) => ({ r, v: s.signal(r) })).filter((x: any) => x.v != null).sort((a: any, b: any) => b.v - a.v).slice(0, 12), [rows, strat]);
  return (
    <div>
      <ScanControls strat={strat} setStrat={setStrat} thr={thr} setThr={setThr} onRescan={onRescan} />
      <p className="text-[12.5px] text-gray-500 my-3">{s.blurb}</p>
      <div className="sect">Short candidates — {s.label}</div>
      {cands.length === 0 ? <p className="text-gray-500 text-sm py-2">No candidate reached the {thr}% {s.thrLabel.toLowerCase()}. 0–2 is normal; the selectivity is the edge.</p> :
        <div className="grid gap-3.5 md:grid-cols-2">
          {cands.map((r: ScanRow) => <EquityCard key={r.symbol} r={r} strat={s} capital={capital} place={place} />)}
        </div>}
      <div className="sect">Biggest movers — across the scanned universe</div>
      <table className="tbl"><thead><tr><th>Stock</th><th>{s.thrLabel}</th><th>Conv.</th><th>LTP</th><th>Note</th></tr></thead>
        <tbody>{movers.map(({ r, v }: any) => (
          <tr key={r.symbol}><td>{r.symbol}</td><td className={v >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>{v >= 0 ? "+" : ""}{v.toFixed(2)}%</td>
            <td>{r.conv === "NA" ? "—" : r.conv}</td><td>{fmt(r.ltp)}</td><td>{v >= thr ? <span className="text-red-600 font-semibold">SHORT</span> : ""}</td></tr>))}
        </tbody></table>
    </div>
  );
}

function EquityCard({ r, strat, capital, place }: { r: ScanRow; strat: any; capital: number; place: PlaceFn }) {
  const c = calcShort(r.ltp, strat.stopPct, capital);
  const [otype, setOtype] = useState<"MARKET" | "LIMIT">("MARKET");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  async function submit() {
    const order: OrderRequest = { variety: "co", exchange: "NSE", tradingsymbol: r.symbol, transactionType: "SELL", orderType: otype, product: "MIS", quantity: c.qty, triggerPrice: +c.stop.toFixed(2), validity: "DAY", tag: "fade", ...(otype === "LIMIT" ? { price: +r.ltp.toFixed(2) } : {}) };
    const res = await place(order, { title: `Confirm SHORT — ${r.symbol}`, warn: "Real SHORT via intraday Cover Order. Stop is built in; exits at the close.", lines: [["Action", `SELL ${c.qty} @ ${otype === "LIMIT" ? "LIMIT " + fmt(r.ltp) : "MARKET"}`], ["Stop (buy trigger)", `${fmt(c.stop)} (${c.stopPct}%)`], ["Exposure", money(c.exposure)], ["Max loss", money(c.maxLoss)]] });
    if (res.ok) setResult({ ok: true, msg: `Short placed — ID ${res.orderId}. Cover by close.` });
    else if (res.error !== "cancelled") setResult({ ok: false, msg: res.error || "failed" });
  }
  return (
    <div className="card border-l-4 border-l-red-600">
      <div className="flex items-baseline justify-between">
        <div><span className="text-base font-bold">{r.symbol}</span> <span className="text-[11px] text-gray-500">{r.sector}</span>
          <span className="chip bg-red-50 text-red-700 border border-red-200 ml-1.5">SHORT</span> <ConvChip c={r.conv} /></div>
        <div className="text-[15px] font-bold text-red-600">{strat.sigText(strat.signal(r))}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 my-3">
        <Metric k="Entry (LTP)" v={fmt(r.ltp)} /><Metric k={`Stop ${c.stopPct}%`} v={fmt(c.stop)} cls="text-red-600" /><Metric k="Exit" v="at close" cls="text-emerald-600" />
        <Metric k="Qty" v={String(c.qty)} /><Metric k="Exposure" v={money(c.exposure)} /><Metric k="Max loss" v={money(c.maxLoss)} />
      </div>
      <div className="inline-flex border border-gray-300 rounded-md overflow-hidden mb-2">
        {(["MARKET", "LIMIT"] as const).map((t) => <button key={t} onClick={() => setOtype(t)} className={`px-3.5 py-1.5 text-[12.5px] font-semibold ${otype === t ? "bg-gray-900 text-white" : "bg-white text-gray-700"}`}>{t === "LIMIT" ? `Limit @ ${fmt(r.ltp)}` : "Market"}</button>)}
      </div>
      <button className="btn w-full" onClick={submit}>Place Short Cover Order</button>
      {result && <div className={`mt-2.5 rounded-lg px-3 py-2 text-[12.5px] ${result.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}>{result.msg}</div>}
    </div>
  );
}

export function Metric({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return <div><div className="text-[10.5px] text-gray-500 uppercase tracking-wide">{k}</div><div className={`text-sm font-semibold ${cls}`}>{v}</div></div>;
}

/* ---------------- Portfolio tab ---------------- */
function PortfolioTab() {
  const [data, setData] = useState<{ holdings: Holding[]; positions: Position[] } | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() { setLoading(true); setErr(""); try { const d = await fetchPortfolio(); setData(d); } catch (e: any) { setErr(e.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  if (loading && !data) return <p className="text-gray-500 text-sm">Loading portfolio…</p>;
  if (err) return <p className="text-red-600 text-sm">{err}</p>;
  if (!data) return null;
  const H = data.holdings;
  const invested = H.reduce((a, h) => a + h.qty * h.avgPrice, 0);
  const current = H.reduce((a, h) => a + h.qty * h.ltp, 0);
  const pnl = H.reduce((a, h) => a + h.pnl, 0);
  const open = data.positions.filter((p) => p.qty !== 0);
  const posPnl = data.positions.reduce((a, p) => a + p.pnl, 0);
  return (
    <div>
      <div className="flex justify-end mb-3"><button className="btn btn-blue" onClick={load}>Refresh portfolio</button></div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] mb-2">
        <Stat k="Holdings value" v={money(current)} s={`invested ${money(invested)}`} />
        <Stat k="Holdings P&L" v={(pnl >= 0 ? "+" : "−") + money(Math.abs(pnl))} s={pct(invested > 0 ? (pnl / invested) * 100 : 0)} cls={pnlClass(pnl)} />
        <Stat k="Positions P&L (today)" v={(posPnl >= 0 ? "+" : "−") + money(Math.abs(posPnl))} s="live" cls={pnlClass(posPnl)} />
        <Stat k="Open positions" v={String(open.length)} s="intraday/derivative" />
      </div>
      <div className="sect">Open positions</div>
      {open.length === 0 ? <p className="text-gray-500 text-sm">No open positions.</p> :
        <table className="tbl"><thead><tr><th>Instrument</th><th>Side</th><th>Qty</th><th>Avg</th><th>LTP</th><th>P&L</th></tr></thead>
          <tbody>{open.map((p) => <tr key={p.symbol + p.product}><td>{p.symbol} <span className="text-gray-400 text-[11px]">{p.product}</span></td>
            <td><span className={`chip ${p.qty > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{p.qty > 0 ? "LONG" : "SHORT"}</span></td>
            <td>{Math.abs(p.qty)}</td><td>{fmt(p.avgPrice)}</td><td>{fmt(p.ltp)}</td><td className={pnlClass(p.pnl)}>{(p.pnl >= 0 ? "+" : "−") + money(Math.abs(p.pnl))}</td></tr>)}</tbody></table>}
      <div className="sect">Holdings</div>
      {H.length === 0 ? <p className="text-gray-500 text-sm">No delivery holdings.</p> :
        <table className="tbl"><thead><tr><th>Stock</th><th>Qty</th><th>Avg</th><th>LTP</th><th>Value</th><th>P&L</th><th>P&L%</th><th>Day</th></tr></thead>
          <tbody>{[...H].sort((a, b) => b.qty * b.ltp - a.qty * a.ltp).map((h) => { const plp = h.avgPrice > 0 ? (h.pnl / (h.qty * h.avgPrice)) * 100 : 0; return (
            <tr key={h.symbol}><td>{h.symbol}</td><td>{h.qty}</td><td>{fmt(h.avgPrice)}</td><td>{fmt(h.ltp)}</td><td>{money(h.qty * h.ltp)}</td>
              <td className={pnlClass(h.pnl)}>{(h.pnl >= 0 ? "+" : "−") + money(Math.abs(h.pnl))}</td><td className={pnlClass(plp)}>{pct(plp)}</td><td className={pnlClass(h.dayChangePct)}>{pct(h.dayChangePct)}</td></tr>); })}</tbody></table>}
    </div>
  );
}

function Stat({ k, v, s, cls = "" }: { k: string; v: string; s: string; cls?: string }) {
  return <div className="card"><div className="text-[10.5px] text-gray-500 uppercase tracking-wide">{k}</div><div className={`text-[19px] font-bold mt-0.5 ${cls}`}>{v}</div><div className="text-[11.5px] mt-0.5 text-gray-500">{s}</div></div>;
}

/* ---------------- Backtest tab ---------------- */
function BacktestTab({ scanSet }: { scanSet: string }) {
  const [gap, setGap] = useState(2);
  const [stopPct, setStopPct] = useState(2);
  const [res, setRes] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  const [n, setN] = useState(0);
  async function run() {
    setRunning(true); setErr(""); setRes(null);
    try { const r = await runBacktestApi({ gap, stopPct }); setRes(r.result); setN(r.symbolsTested); }
    catch (e: any) { setErr(e.message); } finally { setRunning(false); }
  }
  const Row = ({ label, m }: { label: string; m: any }) => (
    <tr><td>{label}</td><td>{m.n}</td><td>{m.win.toFixed(1)}%</td><td className={pnlClass(m.avg)}>{m.avg >= 0 ? "+" : ""}{m.avg.toFixed(2)}</td><td>{m.pf === 99 ? "∞" : m.pf.toFixed(2)}</td><td>{m.tot.toFixed(0)}</td><td>{m.mdd.toFixed(0)}</td></tr>
  );
  return (
    <div>
      <div className="flex items-end gap-2.5 flex-wrap">
        <label className="text-xs text-gray-500 flex flex-col gap-1">Gap threshold %<input className="field w-24" type="number" step={0.5} value={gap} onChange={(e) => setGap(parseFloat(e.target.value) || 2)} /></label>
        <label className="text-xs text-gray-500 flex flex-col gap-1">Stop %<input className="field w-24" type="number" step={0.5} value={stopPct} onChange={(e) => setStopPct(parseFloat(e.target.value) || 2)} /></label>
        <button className="btn btn-blue" onClick={run} disabled={running}>{running ? "Running…" : "Run backtest (core 29)"}</button>
      </div>
      <p className="text-[12.5px] text-gray-500 my-3">Gap-up fade short, backtested on daily history with a train/test split at 2024-07-01. Costs 0.10% round-trip. {err && <span className="text-red-600">{err}</span>}</p>
      {res && (<>
        <div className="sect">Results ({n} stocks)</div>
        <table className="tbl"><thead><tr><th>Window</th><th>N</th><th>Win%</th><th>Avg%/trade</th><th>PF</th><th>Total%</th><th>MaxDD</th></tr></thead>
          <tbody><Row label="Train (< 2024-07)" m={res.train} /><Row label="Test (≥ 2024-07)" m={res.test} /><Row label="All" m={res.all} /></tbody></table>
        <p className="text-[11.5px] text-gray-400 mt-3">A strategy is trustworthy only if it stays positive in BOTH train and test. Momentum/breakout variants fail this; the gap-fade holds.</p>
      </>)}
    </div>
  );
}
