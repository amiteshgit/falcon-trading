"use client";
import { RefreshCw } from "lucide-react";
import { useScan } from "@/lib/scan-context";

export default function ScanBar() {
  const { scanSet, setScanSet, loading, status, err, runScan } = useScan();
  return (
    <div className="flex items-end gap-2.5 flex-wrap mb-4">
      <label className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-1">
        Scan universe <span className="text-gray-400 dark:text-gray-600 text-[10px]">(shared with F&amp;O)</span>
        <select className="field min-w-[220px] font-semibold" value={scanSet} onChange={(e) => setScanSet(e.target.value as any)}>
          <option value="fno">Liquid shortable stocks (202)</option>
          <option value="core">Core large-caps (29, backtested)</option>
        </select>
      </label>
      <button className="btn btn-blue flex items-center gap-1.5" onClick={runScan} disabled={loading}>
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {loading ? "Scanning…" : "Run Scan"}
      </button>
      <div className="text-[12.5px] text-gray-500 dark:text-gray-400 min-h-[16px]">
        {loading ? "Loading…" : status}{err && <span className="text-red-600 dark:text-red-400"> {err}</span>}
      </div>
    </div>
  );
}
