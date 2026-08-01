import { NextResponse } from "next/server";
import { getProvider, NotAuthenticatedError } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { instruments } = (await req.json()) as { instruments: string[] };
    const p = await getProvider();
    const ltp = await p.getLtp(instruments);
    return NextResponse.json({ ltp });
  } catch (e: any) {
    if (e instanceof NotAuthenticatedError)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    return NextResponse.json({ error: e.message || "error" }, { status: 500 });
  }
}
