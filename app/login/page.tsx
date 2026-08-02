"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, AlertCircle } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Sign in failed. Please try again.");
        setBusy(false);
        return;
      }
      // Full navigation so the middleware re-runs with the new cookie.
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-6">
          <div className="text-4xl leading-none mb-3">🦅</div>
          <h1 className="text-xl font-bold tracking-tight">Falcon Trading</h1>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1">
            NSE Strategy Console
          </p>
        </div>

        <form onSubmit={onSubmit} className="card">
          <h2 className="text-[15px] font-semibold mb-4">Sign in</h2>

          <label className="block mb-3">
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Username</span>
            <input
              className="field w-full"
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label className="block mb-4">
            <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Password</span>
            <input
              className="field w-full"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] mb-4
                bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400
                border border-red-200 dark:border-red-500/25"
            >
              <AlertCircle size={14} className="mt-px shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button className="btn w-full flex items-center justify-center gap-1.5" disabled={busy}>
            <LogIn size={15} />
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center mt-5 leading-relaxed">
          Private trading console. Signing in only unlocks this app —
          connecting your Zerodha account is a separate step inside.
        </p>
      </div>
    </div>
  );
}
