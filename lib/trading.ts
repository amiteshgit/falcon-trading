// Order-placement policy (server-only).
//
// Background: since SEBI's retail-algo rules took effect 2026-04-01, Zerodha
// validates ORDER endpoints against a static IP registered on your Kite developer
// profile. Read endpoints (quotes, LTP, historical, holdings, positions, WebSocket)
// are NOT IP-validated and work from anywhere.
//
// Serverless hosts (Vercel included) egress from rotating IPs, so orders sent from
// them are rejected by Zerodha. A deployment is therefore read-only unless you
// route order traffic through a static-IP proxy (KITE_PROXY_URL) whose address you
// have whitelisted at https://developers.kite.trade.
//
// Keeping this OFF by default is also a safety property: a public URL cannot fire
// real money orders because someone found it.

export interface TradingStatus {
  enabled: boolean;
  reason: string;
}

export function tradingStatus(providerName: string): TradingStatus {
  if (providerName !== "kite") {
    return { enabled: true, reason: "Mock mode — orders are simulated, nothing is sent to a broker." };
  }
  if (process.env.TRADING_ENABLED !== "true") {
    return {
      enabled: false,
      reason:
        "Order placement is disabled on this deployment (read-only). Zerodha rejects orders from unregistered IPs, and this host egresses from rotating addresses. Set TRADING_ENABLED=true once requests leave via a whitelisted static IP.",
    };
  }
  return { enabled: true, reason: "Live trading enabled." };
}

/** Proxy used ONLY for order calls, so they egress from a whitelisted static IP. */
export function orderProxyUrl(): string | undefined {
  return process.env.KITE_PROXY_URL || undefined;
}
