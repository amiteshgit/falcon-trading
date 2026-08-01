// Real Kite Connect provider — talks to https://api.kite.trade directly.
import { DataProvider, Quote, Candle, Holding, Position, Instrument, OrderRequest, OrderResult } from "./types";

const BASE = "https://api.kite.trade";

// module-level instruments cache (NFO dump is large; refresh daily)
let instrCache: { day: string; rows: Instrument[] } | null = null;

export class KiteProvider implements DataProvider {
  name = "kite" as const;
  constructor(private apiKey: string, private accessToken: string) {}

  private headers() {
    return {
      Authorization: `token ${this.apiKey}:${this.accessToken}`,
      "X-Kite-Version": "3",
    };
  }

  private async get(path: string) {
    const res = await fetch(BASE + path, { headers: this.headers(), cache: "no-store" });
    const json = await res.json();
    if (json.status === "error") throw new Error(json.message || "Kite error");
    return json.data;
  }

  async isAuthenticated() {
    try { await this.get("/user/profile"); return true; } catch { return false; }
  }

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    // batch of <=500; Kite quote endpoint takes repeated i= params
    const out: Record<string, Quote> = {};
    for (let i = 0; i < symbols.length; i += 400) {
      const batch = symbols.slice(i, i + 400);
      const qs = batch.map((s) => `i=NSE:${encodeURIComponent(s)}`).join("&");
      const data = await this.get(`/quote?${qs}`);
      for (const s of batch) {
        const q = data[`NSE:${s}`];
        if (!q || !q.ohlc) continue;
        out[s] = {
          symbol: s, ltp: q.last_price, open: q.ohlc.open, prevClose: q.ohlc.close,
          high: q.ohlc.high, low: q.ohlc.low, volume: q.volume || 0,
          bid: q.depth?.buy?.[0]?.price, ask: q.depth?.sell?.[0]?.price,
          instrumentToken: q.instrument_token,
        };
      }
    }
    return out;
  }

  async getLtp(instruments: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (let i = 0; i < instruments.length; i += 400) {
      const batch = instruments.slice(i, i + 400);
      const qs = batch.map((s) => `i=${encodeURIComponent(s)}`).join("&");
      const data = await this.get(`/quote/ltp?${qs}`);
      for (const key of batch) if (data[key]) out[key] = data[key].last_price;
    }
    return out;
  }

  async getHistorical(token: number, interval: string, from: string, to: string): Promise<Candle[]> {
    const data = await this.get(
      `/instruments/historical/${token}/${interval}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    return (data.candles || []).map((c: any[]) => ({
      date: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5],
    }));
  }

  async getHoldings(): Promise<Holding[]> {
    const data = await this.get("/portfolio/holdings");
    return (data || []).filter((h: any) => h.quantity > 0).map((h: any) => ({
      symbol: h.tradingsymbol, qty: h.quantity, avgPrice: h.average_price, ltp: h.last_price,
      pnl: h.pnl, dayChangePct: h.day_change_percentage,
    }));
  }

  async getPositions(): Promise<Position[]> {
    const data = await this.get("/portfolio/positions");
    return (data.net || []).map((p: any) => ({
      symbol: p.tradingsymbol, product: p.product, qty: p.quantity,
      avgPrice: p.average_price, ltp: p.last_price, pnl: p.pnl,
    }));
  }

  private async loadInstruments(): Promise<Instrument[]> {
    const today = new Date().toISOString().slice(0, 10);
    if (instrCache && instrCache.day === today) return instrCache.rows;
    const res = await fetch(`${BASE}/instruments/NFO`, { headers: this.headers(), cache: "no-store" });
    const csv = await res.text();
    const lines = csv.trim().split("\n");
    const header = lines[0].split(",");
    const idx = (k: string) => header.indexOf(k);
    const rows: Instrument[] = lines.slice(1).map((l) => {
      const c = l.split(",");
      return {
        tradingsymbol: c[idx("tradingsymbol")], name: c[idx("name")],
        instrumentType: c[idx("instrument_type")], strike: parseFloat(c[idx("strike")]) || 0,
        expiry: c[idx("expiry")], lotSize: parseInt(c[idx("lot_size")]) || 0,
        segment: c[idx("segment")],
      };
    });
    instrCache = { day: today, rows };
    return rows;
  }

  async searchInstruments(name: string): Promise<Instrument[]> {
    const all = await this.loadInstruments();
    return all.filter((r) => r.name === name);
  }

  async placeOrder(o: OrderRequest): Promise<OrderResult> {
    const body = new URLSearchParams();
    body.set("exchange", o.exchange);
    body.set("tradingsymbol", o.tradingsymbol);
    body.set("transaction_type", o.transactionType);
    body.set("order_type", o.orderType);
    body.set("product", o.product);
    body.set("quantity", String(o.quantity));
    body.set("validity", o.validity || "DAY");
    if (o.price != null) body.set("price", String(o.price));
    if (o.triggerPrice != null) body.set("trigger_price", String(o.triggerPrice));
    if (o.tag) body.set("tag", o.tag);
    const res = await fetch(`${BASE}/orders/${o.variety}`, {
      method: "POST", headers: { ...this.headers(), "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    const json = await res.json();
    if (json.status === "error") throw new Error(json.message || "Order failed");
    return { orderId: json.data.order_id };
  }
}
