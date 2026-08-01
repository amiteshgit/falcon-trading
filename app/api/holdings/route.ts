import { NextResponse } from "next/server";
import { getProvider, NotAuthenticatedError } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const p = await getProvider();
    const [holdings, positions] = await Promise.all([p.getHoldings(), p.getPositions()]);
    return NextResponse.json({ holdings, positions, provider: p.name });
  } catch (e: any) {
    if (e instanceof NotAuthenticatedError)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    return NextResponse.json({ error: e.message || "error" }, { status: 500 });
  }
}
