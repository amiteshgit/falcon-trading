"use client";
import { useState } from "react";
import { Lock, Info as InfoIcon, AlertTriangle } from "lucide-react";
import type { ScanRow, Strategy } from "@/lib/strategies";
import type { RiskProfile } from "@/lib/capital";
import { buildTradePlan, type OrderType } from "@/lib/trade-plan";
import { money, fmt } from "@/lib/format";
import type { OrderRequest } from "@/lib/provider/types";
import { ConvChip, TONE, pnlClass } from "./shared";

export default function TradeCard({
  r, strat, profile, place,
}: {
  r: ScanRow; strat: Strategy; profile: RiskProfile; place: any;
}) {
  const plan = buildTradePlan(r, strat, profile);
  const [otype, setOtype] = useState<OrderType>(plan.orderType);
  const [showWhy, setShowWhy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const short = plan.direction === "short";

  async function submit() {
    if (!plan.tradable) return;
    const order: OrderRequest = {
      variety: "co", exchange: "NSE", tradingsymbol: r.symbol,
      transactionType: short ? "SELL" : "BUY",
      orderType: otype, product: "MIS", quantity: plan.qty,
      triggerPrice: +plan.stop.toFixed(2), validity: "DAY", tag: strat.id.slice(0, 8),
      ...(otype === "LIMIT" ? { price: +plan.limitPrice.toFixed(2) } : {}),
    };
    const res = await place(order, {
      title: `Confirm ${short ? "SHORT" : "BUY"} — ${r.symbol}`,
      warn: plan.exitRule,
      lines: [
        ["Action", `${short ? "SELL" : "BUY"} ${plan.qty} @ ${otype === "LIMIT" ? "LIMIT " + fmt(plan.limitPrice) : "MARKET"}`],
        ["Target", `${fmt(plan.target)}  (+${money(plan.rewardAmount)})`],
        ["Stop", `${fmt(plan.stop)}  (−${money(plan.riskAmount)})`],
        ["Risk / reward", `${plan.rr}:1`],
        ["Exposure", money(plan.exposure)],
      ],
    });
    if (res.ok) setResult({ ok: true, msg: `Order placed — ID ${res.orderId}` });
    else if (res.error !== "cancelled") setResult({ ok: false, msg: res.error || "failed" });
  }

  return (
    <div className={`card border-l-4 ${short ? "border-l-red-600" : "border-l-emerald-600"}`}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <span className="text-base font-bold">{r.symbol}</span>{" "}
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{r.sector}</span>{" "}
          <span className={`chip ml-1 ${short ? TONE.red : TONE.emerald}`}>{short ? "SHORT" : "BUY"}</span>{" "}
          <ConvChip c={r.conv} />
        </div>
        <div className={`text-[15px] font-bold ${short ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {strat.sigText(strat.signal(r)!)}
        </div>
      </div>

      {/* the three prices that define the trade */}
      <div className="grid grid-cols-3 gap-2 my-3 text-center">
        <Price label="Entry" value={fmt(plan.entry)} sub="current price" />
        <Price label="Target" value={fmt(plan.target)} sub={`+${money(plan.rewardAmount)}`} tone="emerald" />
        <Price label="Stop loss" value={fmt(plan.stop)} sub={`−${money(plan.riskAmount)}`} tone="red" />
      </div>

      <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 -mt-1">
        Target basis: {plan.targetBasis}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Metric k="Quantity" v={String(plan.qty)} />
        <Metric k="Exposure" v={money(plan.exposure)} />
        <Metric k="Risk : reward" v={`${plan.rr}:1`} cls={plan.rr >= 1 ? pnlClass(1) : pnlClass(-1)} />
      </div>

      {/* order type, preselected with reasoning */}
      <div className="mb-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10.5px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Order type</span>
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <InfoIcon size={11} /> Why {plan.orderType.toLowerCase()}?
          </button>
        </div>
        <div className="inline-flex border border-gray-300 dark:border-[#2A3142] rounded-md overflow-hidden">
          {(["MARKET", "LIMIT"] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOtype(t)}
              className={`px-3.5 py-1.5 text-[12.5px] font-semibold ${
                otype === t
                  ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                  : "bg-white dark:bg-[#0F1319] text-gray-700 dark:text-gray-300"
              }`}
            >
              {t === "LIMIT" ? `Limit @ ${fmt(plan.limitPrice)}` : "Market"}
              {plan.orderType === t && <span className="ml-1 opacity-70">✓</span>}
            </button>
          ))}
        </div>
        {showWhy && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-[11.5px] ${TONE.indigo}`}>
            <b>{plan.orderType} preselected.</b> {plan.orderReasoning}
          </div>
        )}
      </div>

      <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2.5">{plan.exitRule}</div>

      {plan.warnings.map((w, i) => (
        <div key={i} className={`rounded-lg px-3 py-2 text-[11.5px] mb-2 flex items-start gap-1.5 ${TONE.amber}`}>
          <AlertTriangle size={13} className="mt-px shrink-0" />
          <span>{w}</span>
        </div>
      ))}

      {plan.tradable ? (
        <button className="btn w-full" onClick={submit}>
          Place {short ? "short" : "buy"} order — {plan.qty} @ {otype === "LIMIT" ? fmt(plan.limitPrice) : "market"}
        </button>
      ) : (
        <button
          className="btn w-full !bg-gray-200 dark:!bg-gray-800 !text-gray-500 dark:!text-gray-500 flex items-center justify-center gap-1.5"
          disabled
        >
          <Lock size={14} />
          {strat.meta.status !== "validated" ? "Paper only — not validated" : "Size too small to trade"}
        </button>
      )}

      {result && (
        <div className={`mt-2.5 rounded-lg px-3 py-2 text-[12.5px] ${result.ok ? TONE.emerald : TONE.red}`}>{result.msg}</div>
      )}
    </div>
  );
}

function Price({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "emerald" | "red" }) {
  const color =
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "red" ? "text-red-600 dark:text-red-400"
    : "";
  return (
    <div className="rounded-lg border border-gray-200 dark:border-[#232A3A] py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-[15px] font-bold ${color}`}>{value}</div>
      <div className="text-[10.5px] text-gray-400 dark:text-gray-500">{sub}</div>
    </div>
  );
}

function Metric({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{k}</div>
      <div className={`text-sm font-semibold ${cls}`}>{v}</div>
    </div>
  );
}
