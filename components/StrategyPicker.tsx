"use client";
import { useState } from "react";
import { Info } from "lucide-react";
import type { Strategy } from "@/lib/strategies";
import { statusLabel } from "@/lib/strategy-meta";
import StrategyInfo from "./StrategyInfo";
import { TONE } from "./shared";

export default function StrategyPicker({
  strategies, value, onChange, thr, setThr, extra,
}: {
  strategies: Record<string, Strategy>;
  value: string;
  onChange: (id: string) => void;
  thr: number;
  setThr: (n: number) => void;
  extra?: React.ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const s = strategies[value];
  if (!s) return null;
  const badge = statusLabel(s.meta.status);

  return (
    <>
      <div className="flex items-end gap-2.5 flex-wrap">
        <label className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
          Strategy
          <div className="flex items-center gap-1.5">
            <select
              className="field min-w-[250px] font-semibold"
              value={value}
              onChange={(e) => { onChange(e.target.value); setThr(strategies[e.target.value].thrDefault); }}
            >
              {Object.values(strategies).map((st) => (
                <option key={st.id} value={st.id}>{st.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              aria-label={`About ${s.label}`}
              title="How this strategy works"
              className="w-9 h-9 flex items-center justify-center rounded-md border border-gray-300 dark:border-[#2A3142]
                text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1B2130] transition shrink-0"
            >
              <Info size={16} />
            </button>
          </div>
        </label>

        <label className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
          {s.thrLabel}
          <input
            className="field w-20" type="number" step={0.25} min={0.25} value={thr}
            onChange={(e) => setThr(parseFloat(e.target.value) || s.thrDefault)}
          />
        </label>

        {extra}
      </div>

      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        <span className={`chip ${TONE[badge.tone]}`}>{badge.text}</span>
        {s.meta.backtest && (
          <span className={`chip ${TONE.gray}`}>
            out-of-sample +{s.meta.backtest.testReturnPct}% · PF {s.meta.backtest.testPf}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="text-[11.5px] text-blue-600 dark:text-blue-400 hover:underline"
        >
          How it works →
        </button>
      </div>

      {showInfo && <StrategyInfo strat={s} onClose={() => setShowInfo(false)} />}
    </>
  );
}
