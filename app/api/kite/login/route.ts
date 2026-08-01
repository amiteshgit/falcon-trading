import { NextResponse } from "next/server";
import { kiteLoginUrl } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.redirect(kiteLoginUrl());
}
