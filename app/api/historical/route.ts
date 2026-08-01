import { NextResponse } from "next/server";
import { getProvider, NotAuthenticatedError } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const token = Number(sp.get("token"));
    const interval = sp.get("interval") || "day";
    const from = sp.get("from") || "2024-01-01 09:15:00";
    const to = sp.get("to") || new Date().toISOString().slice(0, 10) + " 15:30:00";
    const p = await getProvider();
    const candles = await p.getHistorical(token, interval, from, to);
    return NextResponse.json({ candles });
  } catch (e: any) {
    if (e instanceof NotAuthenticatedError)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    return NextResponse.json({ error: e.message || "error" }, { status: 500 });
  }
}
