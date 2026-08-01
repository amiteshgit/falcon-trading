// Mock provider — realistic sample data so the whole app runs with no credentials.
import { DataProvider, Quote, Candle, Holding, Position, Instrument, OrderRequest, OrderResult } from "./types";
import { FNO_UNIVERSE } from "../universe";

// deterministic pseudo-random from a string seed (stable within a run)
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// a per-day salt so mock candidates change day to day but are stable within a day
const DAY = new Date().toISOString().slice(0, 10);

function basePrice(sym: string): number {
  const r = seeded(sym)();
  return Math.round((40 + r * 3960) * 100) / 100; // ₹40–₹4000
}

function mockQuote(sym: string, i: number): Quote {
  const rnd = seeded(sym + DAY);
  const prevClose = basePrice(sym);
  // most days small gap; ~8% of names get a >2% gap up to create candidates
  const roll = rnd();
  let gapPct: number;
  if (roll > 0.94) gapPct = 2 + rnd() * 2.5;        // big gap up
  else if (roll > 0.9) gapPct = -(2 + rnd() * 2.5); // big gap down
  else gapPct = (rnd() - 0.5) * 2.4;                // normal ±1.2%
  const open = Math.round(prevClose * (1 + gapPct / 100) * 100) / 100;
  const drift = (rnd() - 0.55) * 1.5;               // intraday drift (slightly down = fade)
  const ltp = Math.round(open * (1 + drift / 100) * 100) / 100;
  const high = Math.max(open, ltp) * (1 + rnd() * 0.006);
  const low = Math.min(open, ltp) * (1 - rnd() * 0.006);
  const spread = ltp * (rnd() * 0.001);
  return {
    symbol: sym, ltp, open, prevClose,
    high: Math.round(high * 100) / 100, low: Math.round(low * 100) / 100,
    volume: Math.round(1e5 + rnd() * 2e7),
    bid: Math.round((ltp - spread) * 20) / 20, ask: Math.round((ltp + spread) * 20) / 20,
    instrumentToken: 100000 + i,
  };
}

export class MockProvider implements DataProvider {
  name = "mock" as const;
  async isAuthenticated() { return true; }

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const out: Record<string, Quote> = {};
    symbols.forEach((s, i) => { out[s] = mockQuote(s, i); });
    return out;
  }

  async getLtp(instruments: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const key of instruments) {
      const rnd = seeded(key + DAY);
      // options (…CE/…PE) get a small premium; anything else a mid price
      if (/CE$|PE$/.test(key)) out[key] = Math.round((5 + rnd() * 60) * 20) / 20;
      else out[key] = Math.round(basePrice(key.split(":").pop() || key) * 100) / 100;
    }
    return out;
  }

  async getHistorical(token: number, interval: string, from: string, to: string): Promise<Candle[]> {
    // synth daily candles (random walk) between the dates
    const start = new Date(from), end = new Date(to);
    const rnd = seeded("hist" + token);
    let price = 100 + rnd() * 1500;
    const out: Candle[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay(); if (wd === 0 || wd === 6) continue;
      const o = price;
      const ch = (rnd() - 0.5) * 0.03;
      const c = o * (1 + ch);
      out.push({
        date: d.toISOString().slice(0, 10) + "T00:00:00+0530",
        open: +o.toFixed(2), high: +(Math.max(o, c) * (1 + rnd() * 0.01)).toFixed(2),
        low: +(Math.min(o, c) * (1 - rnd() * 0.01)).toFixed(2), close: +c.toFixed(2),
        volume: Math.round(1e5 + rnd() * 5e6),
      });
      price = c;
    }
    return out;
  }

  async getHoldings(): Promise<Holding[]> {
    const names = ["RELIANCE", "TATAPOWER", "ADANIPORTS", "INFY"];
    return names.map((s) => {
      const rnd = seeded("hold" + s);
      const avg = basePrice(s) * (0.6 + rnd() * 0.3);
      const ltp = basePrice(s);
      const qty = Math.round(5 + rnd() * 40);
      return { symbol: s, qty, avgPrice: +avg.toFixed(2), ltp, pnl: +((ltp - avg) * qty).toFixed(2), dayChangePct: +((rnd() - 0.5) * 4).toFixed(2) };
    });
  }

  async getPositions(): Promise<Position[]> {
    return [
      { symbol: "SBIN", product: "MIS", qty: -46, avgPrice: 1014, ltp: 1008.2, pnl: 266.8 },
      { symbol: "TCS", product: "MIS", qty: -20, avgPrice: 2398, ltp: 2405, pnl: -140 },
    ];
  }

  async searchInstruments(name: string): Promise<Instrument[]> {
    const px = basePrice(name);
    const step = px > 2000 ? 50 : px > 500 ? 20 : px > 100 ? 5 : 2.5;
    const atm = Math.round(px / step) * step;
    const lot = Math.max(1, Math.round(500000 / px / 25) * 25);
    const out: Instrument[] = [];
    const expiry = "2026-08-27";
    out.push({ tradingsymbol: `${name}26AUGFUT`, name, instrumentType: "FUT", strike: 0, expiry, lotSize: lot, segment: "NFO-FUT" });
    for (let k = -3; k <= 3; k++) {
      const strike = atm + k * step;
      out.push({ tradingsymbol: `${name}26AUG${strike}CE`, name, instrumentType: "CE", strike, expiry, lotSize: lot, segment: "NFO-OPT" });
      out.push({ tradingsymbol: `${name}26AUG${strike}PE`, name, instrumentType: "PE", strike, expiry, lotSize: lot, segment: "NFO-OPT" });
    }
    return out;
  }

  async placeOrder(o: OrderRequest): Promise<OrderResult> {
    return { orderId: "MOCK-" + Math.random().toString(36).slice(2, 10).toUpperCase() };
  }
}
