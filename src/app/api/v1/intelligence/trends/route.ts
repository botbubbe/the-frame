export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { detectTrends } from "@/modules/intelligence/agents/trend-detector";

// POST /api/v1/intelligence/trends — detect product trends
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const periodDays = body.periodDays || 30;
    const trends = detectTrends(periodDays);
    return NextResponse.json(trends);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET for convenience
export async function GET(req: NextRequest) {
  try {
    const periodDays = parseInt(req.nextUrl.searchParams.get("period") || "30");
    const trends = detectTrends(periodDays);
    return NextResponse.json(trends);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
