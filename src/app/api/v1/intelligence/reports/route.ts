export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { generateReport, getReportHistory } from "@/modules/intelligence/agents/report-generator";

// POST /api/v1/intelligence/reports — generate a new report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const period = body.period === "monthly" ? "monthly" : "weekly";
    const report = generateReport(period);
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/v1/intelligence/reports — get report history
export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");
    const reports = getReportHistory(limit);
    return NextResponse.json({ reports });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
