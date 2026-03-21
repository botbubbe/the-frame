export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const inspections = db.all(sql`
      SELECT * FROM inventory_qc_inspections
      WHERE po_id = ${id}
      ORDER BY created_at DESC
    `);
    return NextResponse.json({ inspections });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch QC inspections" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { inspector, totalUnits, defectCount, result, notes } = body;

    if (!totalUnits || totalUnits <= 0) {
      return NextResponse.json(
        { error: "totalUnits must be positive" },
        { status: 400 }
      );
    }

    const defectRate =
      totalUnits > 0
        ? Math.round((defectCount / totalUnits) * 10000) / 100
        : 0;

    // Allow explicit result override, otherwise auto-determine
    let status: string;
    if (result && ["passed", "failed", "conditional"].includes(result)) {
      status = result;
    } else {
      status = defectRate > 5 ? "failed" : defectRate > 2 ? "conditional" : "passed";
    }

    const qcId = crypto.randomUUID();
    const inspectionDate = new Date().toISOString().split("T")[0];

    db.run(sql`
      INSERT INTO inventory_qc_inspections (id, po_id, inspector, inspection_date, total_units, defect_count, defect_rate, status, notes)
      VALUES (${qcId}, ${id}, ${inspector || "QC Team"}, ${inspectionDate}, ${totalUnits}, ${defectCount || 0}, ${defectRate}, ${status}, ${notes || null})
    `);

    // Generate alert for high defect rate (>5%)
    let alert = null;
    if (defectRate > 5) {
      // Get PO + factory details for alert context
      const po = db.get(sql`
        SELECT po.po_number, f.name as factory_name, f.code as factory_code
        FROM inventory_purchase_orders po
        JOIN inventory_factories f ON po.factory_id = f.id
        WHERE po.id = ${id}
      `) as { po_number: string; factory_name: string; factory_code: string } | undefined;

      alert = {
        type: "high_defect_rate",
        severity: defectRate > 10 ? "critical" : "warning",
        message: `QC Alert: ${defectRate.toFixed(1)}% defect rate on ${po?.po_number || id} (${po?.factory_code || "unknown"} — ${po?.factory_name || "unknown"})`,
        defectRate,
        poId: id,
        inspectionId: qcId,
      };
    }

    // If QC passed, optionally mark PO as complete
    if (status === "passed") {
      const po = db.get(
        sql`SELECT status FROM inventory_purchase_orders WHERE id = ${id}`
      ) as { status: string } | undefined;
      if (po?.status === "received") {
        db.run(
          sql`UPDATE inventory_purchase_orders SET status = 'complete' WHERE id = ${id}`
        );
      }
    }

    return NextResponse.json(
      { id: qcId, defectRate, status, alert },
      { status: 201 }
    );
  } catch (error) {
    console.error("QC create error:", error);
    return NextResponse.json(
      { error: "Failed to create QC inspection" },
      { status: 500 }
    );
  }
}
