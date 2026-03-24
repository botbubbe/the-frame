export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { enrichViaOutscraper } from "@/modules/sales/lib/enrichment";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing prospect ID" }, { status: 400 });
  }

  const result = await enrichViaOutscraper(id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, newFields: [] },
      { status: result.error?.includes("not configured") ? 400 : 500 }
    );
  }

  return NextResponse.json({
    success: true,
    newFields: result.newFields || [],
  });
}
