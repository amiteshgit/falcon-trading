"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import OrderModal from "./OrderModal";
import { useScan } from "@/lib/scan-context";
import { TONE } from "./shared";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { session, provider } = useScan();

  return (
    <div className="flex min-h-screen">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader onMenu={() => setNavOpen(true)} />
        <main className="flex-1 px-4 md:px-6 py-5 max-w-6xl w-full mx-auto">
          {session?.live && !session.authenticated && (
            <div className={`rounded-lg p-3.5 mb-5 ${TONE.orange}`}>
              <div className="font-bold text-sm">Connect your Zerodha account</div>
              <div className="text-[11.5px] my-1.5 opacity-90">Live mode needs a daily Kite login (sessions expire every morning ~7:30 AM IST).</div>
              <a className="btn btn-blue inline-block no-underline !text-white" href="/api/kite/login">Log in to Kite ↗</a>
            </div>
          )}
          {children}
          <p className="text-[11.5px] text-gray-400 dark:text-gray-600 mt-8 leading-relaxed">
            Only strategies that survived out-of-sample validation are offered. Data-driven edges, not guarantees — intraday shorting (and leveraged futures) carries real risk of loss. Not investment advice.
            {provider === "mock" && " · Running on MOCK data — set DATA_PROVIDER=kite with your API key for live."}
          </p>
        </main>
      </div>
      <OrderModal />
    </div>
  );
}
