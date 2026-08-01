"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { STRATEGIES } from "@/lib/strategies";
import { FNO_UNIVERSE, CORE29, SECTORS, conviction } from "@/lib/universe";
import { fetchQuotes, fetchPriorReturns, placeOrder, fetchSession } from "@/lib/api";
import type { ScanRow } from "@/lib/strategies";
import type { OrderRequest } from "@/lib/provider/types";
import type { PlaceFn, PlaceResult } from "@/components/shared";

export type ScanSet = "fno" | "core";

interface ModalState {
  title: string;
  lines: [string, string][];
  warn: string;
  resolve: (r: PlaceResult) => void;
  order: OrderRequest;
}

interface ScanContextValue {
  session: { live: boolean; authenticated: boolean } | null;
  refreshSession: () => Promise<void>;

  scanSet: ScanSet;
  setScanSet: (s: ScanSet) => void;

  capital: number;
  setCapital: (n: number) => void;

  eqStrat: string; setEqStrat: (s: string) => void;
  eqThr: number; setEqThr: (n: number) => void;
  fnoStrat: string; setFnoStrat: (s: string) => void;
  fnoThr: number; setFnoThr: (n: number) => void;

  rows: ScanRow[];
  ts: string | null;
  provider: string;
  loading: boolean;
  status: string;
  err: string;
  runScan: () => Promise<void>;

  place: PlaceFn;
  modal: ModalState | null;
  confirmModal: () => Promise<void>;
  cancelModal: () => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

const CAPITAL_DEFAULT = Number(process.env.NEXT_PUBLIC_CAPITAL || 50000);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ live: boolean; authenticated: boolean } | null>(null);
  const [scanSet, setScanSet] = useState<ScanSet>("fno");
  const [capital, setCapital] = useState(CAPITAL_DEFAULT);

  const [eqStrat, setEqStrat] = useState("gap_fade");
  const [eqThr, setEqThr] = useState(2);
  const [fnoStrat, setFnoStrat] = useState("gap_fade");
  const [fnoThr, setFnoThr] = useState(2);

  const [rows, setRows] = useState<ScanRow[]>([]);
  const [ts, setTs] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const [modal, setModal] = useState<ModalState | null>(null);

  const refreshSession = useCallback(async () => {
    try { setSession(await fetchSession()); } catch {}
  }, []);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  const scanList = useCallback(() => (scanSet === "core" ? CORE29 : FNO_UNIVERSE), [scanSet]);

  const runScan = useCallback(async () => {
    setLoading(true); setErr(""); setStatus("Fetching live quotes…");
    try {
      const list0 = scanList();
      const { quotes, provider } = await fetchQuotes(list0);
      setProvider(provider);
      let list: ScanRow[] = [];
      for (const s of list0) {
        const q = quotes[s]; if (!q) continue;
        list.push({ ...q, sector: SECTORS[s] || "F&O", conv: conviction(s), yret: null });
      }
      const needHist = [STRATEGIES[eqStrat], STRATEGIES[fnoStrat]].find((x) => x.needsHistory);
      if (needHist) {
        const uni = needHist.universe || list0;
        setStatus("Fetching prior-day moves…");
        try {
          const { yret } = await fetchPriorReturns(list.filter((r) => uni.includes(r.symbol)).map((r) => r.symbol));
          list = list.map((r) => ({ ...r, yret: yret[r.symbol] ?? null }));
        } catch {}
      }
      setRows(list); setTs(new Date().toISOString());
      setStatus(`${provider === "mock" ? "MOCK data" : "Kite connected"} · scanned ${list.length} stocks · ${new Date().toLocaleTimeString("en-IN")}`);
    } catch (e: any) {
      if (e.code === "not_authenticated") setStatus("Not logged in to Kite.");
      else setErr(e.message || "scan failed");
    } finally { setLoading(false); }
  }, [scanList, eqStrat, fnoStrat]);

  useEffect(() => {
    if (session && (!session.live || session.authenticated)) runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, scanSet]);

  const place: PlaceFn = (order, meta) =>
    new Promise((resolve) => setModal({ ...meta, order, resolve }));

  async function confirmModal() {
    if (!modal) return;
    const m = modal; setModal(null);
    try { const { result } = await placeOrder(m.order); m.resolve({ ok: true, orderId: result.orderId }); }
    catch (e: any) { m.resolve({ ok: false, error: e.message }); }
  }

  function cancelModal() {
    if (!modal) return;
    modal.resolve({ ok: false, error: "cancelled" });
    setModal(null);
  }

  const value: ScanContextValue = {
    session, refreshSession,
    scanSet, setScanSet,
    capital, setCapital,
    eqStrat, setEqStrat, eqThr, setEqThr,
    fnoStrat, setFnoStrat, fnoThr, setFnoThr,
    rows, ts, provider, loading, status, err, runScan,
    place, modal, confirmModal, cancelModal,
  };

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within ScanProvider");
  return ctx;
}
