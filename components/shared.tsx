"use client";
import { Conviction } from "@/lib/universe";
import type { OrderRequest } from "@/lib/provider/types";

export type PlaceResult = { ok: boolean; orderId?: string; error?: string };
export type PlaceFn = (
  order: OrderRequest,
  meta: { title: string; lines: [string, string][]; warn: string }
) => Promise<PlaceResult>;

const CONV_STYLE: Record<Conviction, string> = {
  High: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-gray-100 text-gray-500 border border-gray-200",
  NA: "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

export function ConvChip({ c }: { c: Conviction }) {
  return <span className={`chip ${CONV_STYLE[c]}`}>{c === "NA" ? "F&O ext" : `${c} conv`}</span>;
}

export function pnlClass(x: number) {
  return x >= 0 ? "text-emerald-600" : "text-red-600";
}
