"use client";
import { STRATEGIES } from "@/lib/strategies";

export default function StrategyControls({
  strat, setStrat, thr, setThr, extra,
}: {
  strat: string; setStrat: (s: string) => void;
  thr: number; setThr: (n: number) => void;
  extra?: React.ReactNode;
}) {
  const s = STRATEGIES[strat];
  return (
    <div className="flex items-end gap-2.5 flex-wrap">
      <label className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
        Strategy
        <select
          className="field min-w-[230px] font-semibold"
          value={strat}
          onChange={(e) => { setStrat(e.target.value); setThr(STRATEGIES[e.target.value].thrDefault); }}
        >
          {Object.values(STRATEGIES).map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
        {s.thrLabel}
        <input className="field w-20" type="number" step={0.25} min={0.25} value={thr} onChange={(e) => setThr(parseFloat(e.target.value) || s.thrDefault)} />
      </label>
      {extra}
    </div>
  );
}
