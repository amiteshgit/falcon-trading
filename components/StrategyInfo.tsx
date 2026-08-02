"use client";
import { useEffect } from "react";
import { X, Target, Lightbulb, ListOrdered, AlertTriangle, ShieldAlert, TrendingUp } from "lucide-react";
import type { Strategy } from "@/lib/strategies";
import { statusLabel } from "@/lib/strategy-meta";
import { TONE } from "./shared";

export default function StrategyInfo({ strat, onClose }: { strat: Strategy; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const { info, status, backtest, direction, horizon } = strat.meta;
  const badge = statusLabel(status);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#12161F] rounded-2xl max-w-[680px] w-full my-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100 dark:border-[#232A3A]">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">{strat.label}</h2>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`chip ${TONE[badge.tone]}`}>{badge.text}</span>
              <span className={`chip ${TONE.gray}`}>{horizon}</span>
              <span className={`chip ${direction === "short" ? TONE.red : TONE.emerald}`}>{direction.toUpperCase()}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5 text-[13px] leading-relaxed">
          <Section icon={<Target size={14} />} title="What this trade is">
            <p>{info.thesis}</p>
          </Section>

          <Section icon={<Lightbulb size={14} />} title="Why the edge should exist">
            <p className="text-gray-600 dark:text-gray-300">{info.rationale}</p>
          </Section>

          {backtest && (
            <Section icon={<TrendingUp size={14} />} title="Measured performance">
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Window</th><th>Avg %/trade</th><th>Profit factor</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Train (before {backtest.splitDate})</td>
                      <td className="text-emerald-600 dark:text-emerald-400">+{backtest.trainReturnPct}%</td>
                      <td>{backtest.trainPf}</td>
                    </tr>
                    <tr>
                      <td><b>Test (out-of-sample)</b></td>
                      <td className="text-emerald-600 dark:text-emerald-400"><b>+{backtest.testReturnPct}%</b></td>
                      <td><b>{backtest.testPf}</b></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-2">
                After {backtest.costPct}% round-trip costs. Source: {backtest.source}.
                <br />
                The test column is the one that matters — anything can look good in-sample.
              </p>
            </Section>
          )}

          <Section icon={<ListOrdered size={14} />} title="How it's traded">
            <ul className="list-disc pl-4 flex flex-col gap-1 text-gray-600 dark:text-gray-300">
              {info.mechanics.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </Section>

          <Section icon={<AlertTriangle size={14} />} title="When it loses">
            <ul className="list-disc pl-4 flex flex-col gap-1 text-gray-600 dark:text-gray-300">
              {info.failureModes.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </Section>

          <div className={`rounded-lg px-3.5 py-3 ${TONE.amber}`}>
            <div className="flex items-center gap-1.5 font-semibold text-[12.5px] mb-1.5">
              <ShieldAlert size={14} /> Things to keep in mind
            </div>
            <ul className="list-disc pl-4 flex flex-col gap-1 text-[12.5px]">
              {info.cautions.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>

          <Section icon={<TrendingUp size={14} />} title="What to realistically expect">
            <p className="text-gray-600 dark:text-gray-300">{info.expectation}</p>
          </Section>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-[#232A3A] text-[11px] text-gray-400 dark:text-gray-600">
          Backtested edges are estimates from historical data, not predictions. Past performance does not guarantee future results.
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}
