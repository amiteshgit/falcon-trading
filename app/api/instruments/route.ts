import { NextResponse } from "next/server";
import { getProvider, NotAuthenticatedError } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const name = new URL(req.url).searchParams.get("name") || "";
    const p = await getProvider();
    const instruments = await p.searchInstruments(name);
    return NextResponse.json({ instruments });
  } catch (e: any) {
    if (e instanceof NotAuthenticatedError)
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    return NextResponse.json({ error: e.message || "error" }, { status: 500 });
  }
}
