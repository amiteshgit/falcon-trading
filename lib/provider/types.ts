// Shared data types + the provider interface both mock and Kite implement.

export interface Quote {
  symbol: string;        // "RELIANCE"
  ltp: number;
  open: number;          // today's open
  prevClose: number;     // yesterday's close
  high: number;
  low: number;
  volume: number;
  bid?: number;
  ask?: number;
  instrumentToken?: number;
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Holding {
  symbol: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  dayChangePct: number;
}

export interface Position {
  symbol: string;
  product: string;
  qty: number;          // negative = short
  avgPrice: number;
  ltp: number;
  pnl: number;
}

export interface Instrument {
  tradingsymbol: string;
  name: string;
  instrumentType: "FUT" | "CE" | "PE" | "EQ" | string;
  strike: number;
  expiry: string;       // "2026-08-25"
  lotSize: number;
  segment: string;
}

export interface OrderRequest {
  variety: string;                    // "regular" | "co"
  exchange: string;                   // "NSE" | "NFO"
  tradingsymbol: string;
  transactionType: "BUY" | "SELL";
  orderType: string;                  // "MARKET" | "LIMIT" | "SL" | "SL-M"
  product: string;                    // "MIS" | "CNC" | "NRML"
  quantity: number;
  price?: number;
  triggerPrice?: number;
  validity?: string;
  tag?: string;
}

export interface OrderResult {
  orderId: string;
}

export interface DataProvider {
  name: "mock" | "kite";
  isAuthenticated(): Promise<boolean>;
  getQuotes(symbols: string[]): Promise<Record<string, Quote>>;
  // exchange-qualified instruments e.g. "NFO:RELIANCE26AUG1270PE" -> last price
  getLtp(instruments: string[]): Promise<Record<string, number>>;
  getHistorical(
    instrumentToken: number,
    interval: string,
    from: string,
    to: string
  ): Promise<Candle[]>;
  getHoldings(): Promise<Holding[]>;
  getPositions(): Promise<Position[]>;
  searchInstruments(name: string): Promise<Instrument[]>;
  placeOrder(o: OrderRequest): Promise<OrderResult>;
}
