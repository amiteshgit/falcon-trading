# Overextension Fade — Trading Console (Next.js)

A full-stack rebuild of the gap-fade scanner: a validated NSE short-fade strategy scanner, F&O (futures + options) console, live portfolio, and an in-app backtester. Built with **Next.js 14 (App Router) + TypeScript + Tailwind**.

It runs with **realistic mock data out of the box** (no credentials), and flips to **live Zerodha data** by adding your Kite Connect API key.

---

## Quick start (mock mode — no API key needed)

```bash
cp .env.example .env      # defaults to DATA_PROVIDER=mock
npm install
npm run dev
```

Open http://localhost:3000 — the whole app works on sample data (scan, F&O, portfolio, backtest, order placement is simulated).

---

## Going live with Zerodha (Kite Connect)

1. Create an app at **https://kite.trade** → you get an **API key** and **API secret**. (Kite Connect is a paid add-on, ~₹500/mo; historical data is a separate add-on needed for the Backtest tab.)
2. In your Kite app settings, set the **Redirect URL** to exactly: `http://127.0.0.1:3000/api/kite/callback`
3. Fill in `.env`:
   ```
   DATA_PROVIDER=kite
   KITE_API_KEY=your_key
   KITE_API_SECRET=your_secret
   KITE_REDIRECT_URL=http://127.0.0.1:3000/api/kite/callback
   ```
4. `npm run dev`, open the app, click **Log in to Kite** (top banner). You'll be redirected to Zerodha, then back — an httpOnly cookie holds your daily access token.
   *Kite expires all sessions every morning ~7:30 AM IST, so you re-login once per day.*

That's it — every screen now uses your real account. No code changes; the provider swap is driven entirely by `DATA_PROVIDER`.

---

## Architecture

The app is a real multi-route Next.js app: a persistent shell (sidebar + header) wraps four routed pages, with shared scan/session/capital state lifted into a context so pages stay in sync without prop-drilling.

```
app/
  layout.tsx              → <html>, theme/hydration setup, wraps <Providers>
  providers.tsx           → ThemeProvider (next-themes) + ScanProvider + <AppShell>
  page.tsx                → Equity Scanner route (/)
  fno/page.tsx             → F&O route (/fno)
  portfolio/page.tsx       → Portfolio route (/portfolio)
  backtest/page.tsx        → Backtest route (/backtest)
  api/
    quotes, ltp, historical, holdings, instruments, order, prior-returns, backtest, session
    kite/login, kite/callback     → Kite OAuth flow
lib/
  scan-context.tsx         → ScanProvider/useScan() — session, scan universe, capital,
                              per-tab strategy/threshold, scanned rows, order-confirm modal
  provider/
    types.ts              → DataProvider interface + shared types
    mock.ts               → sample-data provider (default)
    kite.ts               → real Kite Connect REST provider
    index.ts              → getProvider() factory (reads DATA_PROVIDER + cookie)
  auth.ts                 → Kite login URL + request_token→access_token exchange
  universe.ts             → 202 F&O stocks, core-29, volatility/conviction tiers
  strategies.ts           → the validated fade strategies + sizing
  backtest.ts             → gap-fade backtest engine (train/test split)
  format.ts, api.ts       → helpers + client fetch wrappers
components/
  AppShell.tsx             → sidebar + header + login banner + order modal, wraps every route
  Sidebar.tsx, TopHeader.tsx → nav, page title, provider badge
  ProfileMenu.tsx           → Kite session status, login/logout, position-sizing capital
  ThemeToggle.tsx            → light/dark switch (next-themes)
  ScanBar.tsx, StrategyControls.tsx → shared scan-universe / strategy controls (Equity + F&O)
  OrderModal.tsx             → order-confirm dialog, driven by ScanProvider
  EquityScanner.tsx, FnoScanner.tsx, PortfolioView.tsx, BacktestView.tsx → per-route content
  shared.tsx                 → conviction chips, tone/color helpers, Metric/Stat/PageHeader
```

**The one seam that matters:** every data call goes through the `DataProvider` interface. `MockProvider` and `KiteProvider` implement it identically, so the UI never knows which is behind it. To add a new broker or data source, implement the interface and wire it into `getProvider()`.

**Theme:** class-based dark mode (Tailwind `darkMode: "class"` + `next-themes`), defaults to the OS preference; the header toggle persists the choice to `localStorage`.

---

## What's inside (ported from the research)

- **Validated strategies only.** Gap-up fade (2%), big up-day reversal (4%), and low-vol-only fade — each survived an out-of-sample train/test split. Momentum/breakout/reversal/overnight/index strategies were tested and **rejected** (they lose out-of-sample) and are deliberately not offered.
- **Conviction tiers** from the volatility study (the fade edge concentrates in low-vol names).
- **Whole liquid market**: scans all 202 F&O stocks (or the core 29) in one call.
- **F&O**: near-month future (lot/notional/margin/affordability) + live ATM call/put, with an affordable **buy-put** to play the short at small capital.
- **Portfolio**: live holdings + positions with P&L.
- **Backtest tab**: runs the gap-fade backtest server-side over daily history with a train/test split.

---

## Notes & next steps

- **Not investment advice.** Edges are modest, backtested, and carry real risk. Order placement sends real orders in live mode — every order has a confirm dialog, and is additionally gated behind `TRADING_ENABLED` (see the static-IP section).
- The Backtest tab currently runs the **core-29** set on demand; widen it by passing more symbols to `/api/backtest`.
- **Real-time streaming**: Kite offers a WebSocket ticker — a natural next upgrade to make quotes self-update instead of on Run Scan.
- **Options income** (premium-selling / short strangles) is the real F&O edge but needs historical option/IV data to validate — not yet included.
- This project was scaffolded without running `npm install` (offline), so run it once locally; if the type-checker flags anything minor, it'll be a small fix.

---

## The static-IP rule — read this before deploying

Since **2026-04-01**, SEBI's retail-algo rules require Zerodha to validate **order** requests against a static IP registered on your Kite developer profile. The split that matters:

| API surface | IP-validated? | Works on Vercel? |
|---|---|---|
| Orders (`/orders/*`) | **Yes** — rejected from unregistered IPs | **No** — serverless egress IPs rotate |
| Quotes, LTP, historical, holdings, positions, WebSocket | No | **Yes** |

So a Vercel deployment is a fully working **read-only console** — scan, backtest, portfolio, quotes — and order placement is disabled there by default (`TRADING_ENABLED` unset). That default is also a safety property: a public URL can't fire real-money orders because someone found it.

Whitelisting is at **developer-account level** (covers all your apps, not per-app), supports IPv4 and IPv6, and can be **changed only once per calendar week** — so get it right. Set it at [developers.kite.trade](https://developers.kite.trade) → profile → IP Whitelist.

### If you want orders from a deployed app

Route **only order calls** through a static-IP proxy via `KITE_PROXY_URL`, then whitelist that proxy's IP. Read calls still go direct, so your access token only crosses the proxy on the one endpoint that requires it.

| Option | ~Cost/month | Notes |
|---|---|---|
| **Own VPS proxy** (Hetzner, or **Oracle Cloud Always Free**) | **₹0–400** | Cheapest, and nobody else handles your order traffic |
| QuotaGuard Static | ~₹1,600 ($19) | Managed; cheaper tier may terminate TLS |
| QuotaGuard Shield | ~₹2,450 ($29) | Adds SSL passthrough (no TLS termination) |
| Vercel Static IPs | ~₹8,400 ($100) | Pro add-on, shared subnet, bandwidth billed on top |

Prefer a proxy that tunnels HTTPS via `CONNECT` rather than terminating TLS — order traffic carries your Kite access token. For a personal account the economics strongly favour a self-hosted proxy: at a ₹50k account size, $19/mo is ~38% of capital per year.

---

## Deploy to Vercel (step by step)

1. **Push this folder to its own GitHub repo.**
2. **Vercel → Add New → Project → import the repo.** Framework auto-detects as Next.js; leave build settings default.
3. **Add Environment Variables** (Project → Settings → Environment Variables). Encrypted at rest, injected server-side only — never in your bundle or repo:
   - `DATA_PROVIDER = kite`
   - `KITE_API_KEY = <your key>`
   - `KITE_API_SECRET = <your secret>` ← server-side only, used in the token exchange
   - `KITE_REDIRECT_URL = https://<your-app>.vercel.app/api/kite/callback`
   - `NEXT_PUBLIC_CAPITAL = 50000`
   - `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` ← **set these**, this deployment shows your portfolio
   - `MCP_AUTH_TOKEN = <long random string>` ← `/api/mcp` is exempt from Basic-Auth (see below)
   - **Do not set** `TRADING_ENABLED` or `ALLOW_SHARED_TOKEN_STORE` here.
4. **Deploy.** Note your production URL.
5. **In your Kite app settings**, set the **Redirect URL** to `https://<your-app>.vercel.app/api/kite/callback` — it must match `KITE_REDIRECT_URL` exactly. Kite allows one redirect URL per app, so local dev and prod can't both be live; either flip it when needed or create a second Kite app (billed ₹500/mo each).
6. Open the app → **Log in to Kite** each morning (sessions expire ~7:30 AM IST).

**Why the secrets are safe:** `KITE_API_SECRET` and the access token are used **only in server code** — never sent to the browser, never `NEXT_PUBLIC_`. The browser holds only a short-lived **httpOnly** cookie it can't read. `.env` is git-ignored.

**Keep the deployment private:** set `BASIC_AUTH_USER` + `BASIC_AUTH_PASS`, or use Vercel's **Deployment Protection** (Settings → Deployment Protection). This app exposes live portfolio data — don't skip this.

**Why the token store is local-only:** `lib/tokenStore.ts` caches the access token on disk so the MCP endpoint can share your session. On a shared/serverless host that would be a session-inheritance hole — `/tmp` outlives a request, so an anonymous visitor hitting a warm instance after you logged in would inherit your Kite session. The store therefore disables itself unless the runtime is local. Override with `ALLOW_SHARED_TOKEN_STORE=true` **only** on a single-user box you own.

---

## Drive it from Claude (MCP connector)

The app ships an **MCP server** at `app/api/mcp/[transport]/route.ts` exposing tools Claude can call: `list_strategies`, `scan_candidates`, `run_backtest`, `get_portfolio`, `get_quotes`.

**Local (recommended):**
1. `npm run dev`, then **log in to Kite once in the browser** — this also stashes the token server-side so the MCP endpoint can use your live session.
2. In Claude (Desktop/Cowork) → **Settings → Connectors → Add custom connector**, URL:
   `http://localhost:3000/api/mcp/mcp`
3. Now in chat you can say *"scan_candidates for gap_fade_lowvol"* or *"run_backtest on core with a 3% gap"* and Claude gets live JSON back, then reasons over it — analytics, comparisons, strategy ideas, all conversational.

**Notes:**
- If Claude requires an `https` connector URL for remote servers, point a tunnel at localhost (e.g. `ngrok http 3000`) and use the `https` URL, or use your Vercel URL.
- **Live-data-via-MCP is a local feature.** It relies on the server-side token store, which is deliberately disabled on serverless hosts (see the deploy section). On Vercel the MCP tools serve **mock** data — still useful for building and testing strategy logic.
- **`/api/mcp` is exempt from Basic-Auth** (a connector can't answer a browser auth prompt), which makes it the one unauthenticated surface on a public deployment. Set `MCP_AUTH_TOKEN` there and send `Authorization: Bearer <token>`; leave it unset locally and the connector works with no setup.
