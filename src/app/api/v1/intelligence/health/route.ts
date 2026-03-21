export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { calculateBusinessHealth } from "@/modules/intelligence/lib/business-health";

export async function GET() {
  try {
    const health = calculateBusinessHealth();
    return NextResponse.json(health);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
