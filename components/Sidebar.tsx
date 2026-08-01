"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, CandlestickChart, Briefcase, FlaskConical, X } from "lucide-react";

const NAV = [
  { href: "/", label: "Scanner", sub: "Equity (cash)", icon: LineChart },
  { href: "/fno", label: "F&O", sub: "Futures & options", icon: CandlestickChart },
  { href: "/portfolio", label: "Portfolio", sub: "Holdings & positions", icon: Briefcase },
  { href: "/backtest", label: "Backtest", sub: "Train/test validation", icon: FlaskConical },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-white dark:bg-[#0D1017] border-r border-gray-200 dark:border-[#1E2430]
          flex flex-col transition-transform duration-200 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1E2430]">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">🦅</span>
            <div>
              <div className="text-[14px] font-bold leading-tight">Falcon Trading</div>
              <div className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-tight">NSE Strategy Console</div>
            </div>
          </div>
          <button className="md:hidden text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ href, label, sub, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition
                  ${active
                    ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 font-semibold"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#151A24]"}`}
              >
                <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                <span>
                  {label}
                  <span className="block text-[10.5px] font-normal text-gray-400 dark:text-gray-500">{sub}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-[#1E2430] text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500">
          Only out-of-sample-validated strategies are offered. Not investment advice.
        </div>
      </aside>
    </>
  );
}
