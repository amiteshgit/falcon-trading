"use client";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import ProfileMenu from "./ProfileMenu";
import { useScan } from "@/lib/scan-context";

const TITLES: Record<string, string> = {
  "/": "Intraday",
  "/swing": "Swing",
  "/options": "Options & F&O",
  "/risk": "Risk & Allocation",
  "/portfolio": "Portfolio",
  "/backtest": "Backtest",
};

export default function TopHeader({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { provider } = useScan();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-white/85 dark:bg-[#0A0D12]/85 backdrop-blur border-b border-gray-200 dark:border-[#1E2430]">
      <div className="flex items-center gap-3 min-w-0">
        <button className="md:hidden text-gray-500 dark:text-gray-400" onClick={onMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <h2 className="text-[15px] font-bold truncate">{TITLES[pathname] || "Falcon Trading"}</h2>
      </div>
      <div className="flex items-center gap-3">
        <span className={`chip hidden sm:inline-block ${provider === "kite" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25" : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/25"}`}>
          {provider === "kite" ? "● LIVE (Kite)" : "● MOCK data"}
        </span>
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
