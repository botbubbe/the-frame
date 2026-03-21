export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";

// PATCH: Update reorder point for a specific inventory item
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, reorderPoint } = body;

    if (!id || reorderPoint === undefined) {
      return NextResponse.json({ error: "id and reorderPoint are required" }, { status: 400 });
    }

    const rp = parseInt(reorderPoint);
    if (isNaN(rp) || rp < 0) {
      return NextResponse.json({ error: "reorderPoint must be a non-negative integer" }, { status: 400 });
    }

    const existing = sqlite.prepare("SELECT id, quantity FROM inventory WHERE id = ?").get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    sqlite.prepare(
      `UPDATE inventory SET reorder_point = ?, needs_reorder = (quantity < ?), updated_at = datetime('now') WHERE id = ?`
    ).run(rp, rp, id);

    return NextResponse.json({ success: true, id, reorderPoint: rp, needsReorder: existing.quantity < rp });
  } catch (error: any) {
    console.error("Reorder point update error:", error);
    return NextResponse.json({ error: "Failed to update reorder point" }, { status: 500 });
  }
}
