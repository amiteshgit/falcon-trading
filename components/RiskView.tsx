"use client";
import { Lock, ShieldCheck } from "lucide-react";
import { useScan } from "@/lib/scan-context";
import { allocate, riskPerTrade, DEFAULT_PROFILE, OPTIONS_SIZING_STALE } from "@/lib/capital";
import { money } from "@/lib/format";
import { TONE, Stat } from "./shared";

export default function RiskView() {
  const { capital, setCapital } = useScan();
  const profile = { capital, ...DEFAULT_PROFILE };
  const buckets = allocate(profile);
  const perTrade = riskPerTrade(profile);
  const maxHeat = Math.round((capital * profile.maxPortfolioHeatPct) / 100);

  return (
    <div>
      <div className="flex items-end gap-2.5 flex-wrap mb-5">
        <label className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
          Total trading capital ₹
          <input
            className="field w-40" type="number" step={50000} value={capital}
            onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] mb-2">
        <Stat k="Risk per trade" v={money(perTrade)} s={`${profile.riskPerTradePct}% of capital`} />
        <Stat k="Max portfolio heat" v={money(maxHeat)} s={`${profile.maxPortfolioHeatPct}% at risk at once`} />
        <Stat k="Never at risk" v={`${100 - profile.maxPortfolioHeatPct}%`} s="even when fully loaded" cls="text-emerald-600 dark:text-emerald-400" />
        <Stat k="Buckets unlocked" v={`${buckets.filter((b) => b.unlocked && b.policy.maxHeatPct > 0).length} / 3`} s="at this capital" />
      </div>

      <div className={`rounded-lg px-3.5 py-3 text-[12.5px] my-4 ${TONE.indigo}`}>
        <div className="flex items-center gap-1.5 font-semibold mb-1">
          <ShieldCheck size={14} /> Why risk, not rupees
        </div>
        <p className="opacity-90">
          Leverage breaks the link between capital and exposure — an intraday MIS short controls
          roughly 5× its margin, a cash swing long exactly 1×. Budgeting by &ldquo;money deployed&rdquo;
          would silently make the intraday book 5× riskier at the same rupee figure. So every bucket
          is budgeted in <b>% of capital you are willing to lose</b>, and quantity is derived from
          that and the stop distance.
        </p>
      </div>

      <div className="sect">Allocation by bucket</div>
      <div className="flex flex-col gap-3">
        {buckets.map(({ policy, maxRiskAmount, unlocked, gateReason }) => (
          <div key={policy.bucket} className="card">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[14px]">{policy.label}</span>
                {unlocked ? (
                  <span className={`chip ${TONE.emerald}`}>Unlocked</span>
                ) : (
                  <span className={`chip ${TONE.gray}`}>
                    <Lock size={9} className="inline mb-px mr-0.5" />Locked
                  </span>
                )}
              </div>
              <div className="text-right">
                {policy.maxHeatPct > 0 ? (
                  <>
                    <div className="text-[15px] font-bold">{money(maxRiskAmount)}</div>
                    <div className="text-[10.5px] text-gray-500 dark:text-gray-400">max risk ({policy.maxHeatPct}% of capital)</div>
                  </>
                ) : (
                  <div className="text-[12.5px] text-gray-500 dark:text-gray-400">reserve — not deployed</div>
                )}
              </div>
            </div>
            <p className="text-[12px] text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{policy.rationale}</p>
            {!unlocked && gateReason && (
              <div className={`rounded-lg px-3 py-2 text-[11.5px] mt-2 ${TONE.amber}`}>{gateReason}</div>
            )}
            {policy.bucket === "options" && OPTIONS_SIZING_STALE && (
              <div className={`rounded-lg px-3 py-2 text-[11.5px] mt-2 ${TONE.red}`}>
                <b>Sizing is stale.</b> NSE cut index lot sizes in January 2026 (Nifty 75→65,
                BankNifty 35→30), and the original strangle research used different sizes again.
                Every per-lot rupee figure needs rescaling before this bucket is tradeable — the
                percentage edge survives a lot-size change, the rupee figures do not.
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sect">The three caps</div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Layer</th><th>Limit</th><th>Protects against</th></tr></thead>
          <tbody>
            <tr><td>Per-trade risk</td><td>{money(perTrade)}</td><td className="!text-left">One bad trade</td></tr>
            <tr><td>Bucket heat</td><td>1–3%</td><td className="!text-left">One strategy family breaking down</td></tr>
            <tr><td><b>Portfolio heat</b></td><td><b>{money(maxHeat)}</b></td><td className="!text-left"><b>A correlated day</b> — several &ldquo;independent&rdquo; fade shorts all lose together when the market gaps up and keeps running</td></tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-gray-400 dark:text-gray-600 mt-3">
        The portfolio-heat cap is the one most retail traders lack, and it is what turns a bad day
        into a blown account. Minimum-capital gates are derived from tail risk, not margin: margin is
        what a broker permits, the tail is what a bad week does to you.
      </p>
    </div>
  );
}
