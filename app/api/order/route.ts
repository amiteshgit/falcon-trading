import { NextResponse } from "next/server";
import { getProvider, NotAuthenticatedError } from "@/lib/provider";
import { tradingStatus } from "@/lib/trading";
import type { OrderRequest } from "@/lib/provider/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const order = (await req.json()) as OrderRequest;
    const p = await getProvider();

    // Read-only deployments refuse orders before anything is sent to the broker.
    const status = tradingStatus(p.name);
    if (!status.enabled) {
      return NextResponse.json({ error: status.reason, code: "trading_disabled" }, { status: 403 });
    }

    const result = await p.placeOrder(order);
    return NextResponse.json({ result, provider: p.name });
  } catch (e: any) {
    if (e instanceof NotAuthenticatedError)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    return NextResponse.json({ error: e.message || "order failed" }, { status: 500 });
  }
}
