export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { syncFaireOrders } from "@/modules/orders/lib/faire-sync";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.FAIRE_API_TOKEN) {
      return NextResponse.json(
        { error: "FAIRE_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    const result = await syncFaireOrders();

    return NextResponse.json({
      ok: true,
      ...result,
      message: `Faire sync complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped${result.errors.length ? `, ${result.errors.length} errors` : ""}`,
    });
  } catch (error) {
    console.error("[Faire Sync API]", error);
    return NextResponse.json(
      { error: "Faire sync failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
