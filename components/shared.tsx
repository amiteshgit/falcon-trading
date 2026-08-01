"use client";
import { Conviction } from "@/lib/universe";
import type { OrderRequest } from "@/lib/provider/types";

export type PlaceResult = { ok: boolean; orderId?: string; error?: string };
export type PlaceFn = (
  order: OrderRequest,
  meta: { title: string; lines: [string, string][]; warn: string }
) => Promise<PlaceResult>;

// Reusable tone classes for banners, chips and badges — same hue in both themes,
// just lower-opacity fills so they don't glare on a dark card.
export const TONE = {
  red: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/25",
  emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25",
  amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25",
  orange: "bg-orange-50 dark:bg-orange-500/10 text-orange-800 dark:text-orange-400 border border-orange-200 dark:border-orange-500/25",
  indigo: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/25",
  violet: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/25",
  gray: "bg-gray-100 dark:bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20",
} as const;

const CONV_STYLE: Record<Conviction, string> = {
  High: TONE.emerald,
  Medium: TONE.amber,
  Low: TONE.gray,
  NA: TONE.indigo,
};

export function ConvChip({ c }: { c: Conviction }) {
  return <span className={`chip ${CONV_STYLE[c]}`}>{c === "NA" ? "F&O ext" : `${c} conv`}</span>;
}

export function pnlClass(x: number) {
  return x >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

export function Metric({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{k}</div>
      <div className={`text-sm font-semibold ${cls}`}>{v}</div>
    </div>
  );
}

export function Stat({ k, v, s, cls = "" }: { k: string; v: string; s: string; cls?: string }) {
  return (
    <div className="card">
      <div className="text-[10.5px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{k}</div>
      <div className={`text-[19px] font-bold mt-0.5 ${cls}`}>{v}</div>
      <div className="text-[11.5px] mt-0.5 text-gray-500 dark:text-gray-400">{s}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
    </div>
  );
}
