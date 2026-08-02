"use client";
import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, Wallet, ChevronDown, DoorOpen } from "lucide-react";
import { useScan } from "@/lib/scan-context";
import { logout, signOutApp } from "@/lib/api";
import { money } from "@/lib/format";

export default function ProfileMenu() {
  const { session, provider, capital, setCapital, refreshSession } = useScan();
  const [open, setOpen] = useState(false);
  const [capitalInput, setCapitalInput] = useState(String(capital));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setCapitalInput(String(capital)), [capital]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function doLogout() {
    await logout().catch(() => {});
    await refreshSession();
    setOpen(false);
  }

  async function doSignOut() {
    await signOutApp().catch(() => {});
    // Full navigation so the middleware re-runs and lands on /login.
    window.location.href = "/login";
  }

  const authenticated = !session?.live || session?.authenticated;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg pl-1.5 pr-2 py-1.5 hover:bg-gray-100 dark:hover:bg-[#1B2130] transition"
      >
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white text-[12px] font-bold flex items-center justify-center">
          {provider === "kite" ? "ZK" : "MK"}
        </span>
        <span className="hidden sm:block text-left leading-tight">
          <span className="block text-[12.5px] font-semibold">{provider === "kite" ? "Zerodha (live)" : "Mock account"}</span>
          <span className={`block text-[10px] ${authenticated ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
            {authenticated ? "Connected" : "Not connected"}
          </span>
        </span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 card !p-0 overflow-hidden z-50 shadow-lg">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1E2430]">
            <div className="text-[12.5px] font-semibold">{provider === "kite" ? "Zerodha Kite" : "Mock data"}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {session?.live ? (authenticated ? "Session active — expires ~7:30 AM IST" : "Live mode, not logged in") : "Running on sample data, no credentials needed"}
            </div>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1E2430]">
            <label className="text-[10.5px] text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <Wallet size={12} /> Position-sizing capital
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">₹</span>
              <input
                className="field flex-1 !py-1.5"
                type="number"
                step={10000}
                value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value)}
                onBlur={() => setCapital(parseFloat(capitalInput) || capital)}
              />
            </div>
            <div className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1">{money(capital)} · used to size shorts &amp; futures lots</div>
          </div>

          <div className="p-2">
            {session?.live && !session.authenticated ? (
              <a href="/api/kite/login" className="btn btn-blue w-full flex items-center justify-center gap-1.5 no-underline !text-white">
                <LogIn size={14} /> Log in to Kite
              </a>
            ) : session?.live && session.authenticated ? (
              <button onClick={doLogout} className="btn-ghost w-full rounded-lg px-4 py-2 text-sm font-semibold flex items-center justify-center gap-1.5">
                <LogOut size={14} /> Log out
              </button>
            ) : (
              <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-1.5">
                Set DATA_PROVIDER=kite to go live
              </div>
            )}
          </div>

          <div className="p-2 pt-0">
            <button
              onClick={doSignOut}
              className="w-full rounded-lg px-4 py-2 text-[12.5px] font-medium flex items-center justify-center gap-1.5
                text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1B2130] transition"
            >
              <DoorOpen size={13} /> Sign out of Falcon
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
