import { NextResponse } from "next/server";
import { getProvider, NotAuthenticatedError } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { symbols } = await req.json();
    const p = await getProvider();
    const quotes = await p.getQuotes(symbols);
    return NextResponse.json({ quotes, provider: p.name });
  } catch (e: any) {
    if (e instanceof NotAuthenticatedError)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    return NextResponse.json({ error: e.message || "error" }, { status: 500 });
  }
}
