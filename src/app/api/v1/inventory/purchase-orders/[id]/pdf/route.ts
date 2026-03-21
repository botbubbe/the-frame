export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * GET /api/v1/inventory/purchase-orders/[id]/pdf
 * Generate a simple HTML-based PO summary (printable / save as PDF).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const po = db.get(sql`
      SELECT po.*, f.code as factory_code, f.name as factory_name,
             f.contact_name, f.contact_email, f.contact_phone
      FROM inventory_purchase_orders po
      JOIN inventory_factories f ON po.factory_id = f.id
      WHERE po.id = ${id}
    `) as Record<string, unknown> | undefined;

    if (!po) {
      return NextResponse.json({ error: "PO not found" }, { status: 404 });
    }

    const lineItems = db.all(sql`
      SELECT li.*, s.sku, s.color_name, p.name as product_name
      FROM inventory_po_line_items li
      JOIN catalog_skus s ON li.sku_id = s.id
      JOIN catalog_products p ON s.product_id = p.id
      WHERE li.po_id = ${id}
    `) as Record<string, unknown>[];

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Purchase Order ${po.po_number}</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; font-size: 14px; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .subtitle { color: #666; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
  .section h3 { margin: 0 0 8px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .section p { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { background: #f9fafb; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #666; }
  .text-right { text-align: right; }
  .total-row { font-weight: 700; background: #f9fafb; }
  .notes { margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>Purchase Order: ${po.po_number}</h1>
<p class="subtitle">Date: ${po.order_date || new Date().toISOString().split("T")[0]}</p>

<div class="grid">
  <div class="section">
    <h3>From</h3>
    <p><strong>Jaxy Eyewear</strong></p>
    <p>Los Angeles, CA</p>
  </div>
  <div class="section">
    <h3>To — Factory ${po.factory_code}</h3>
    <p><strong>${po.factory_name}</strong></p>
    ${po.contact_name ? `<p>${po.contact_name}</p>` : ""}
    ${po.contact_email ? `<p>${po.contact_email}</p>` : ""}
    ${po.contact_phone ? `<p>${po.contact_phone}</p>` : ""}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>SKU</th>
      <th>Product</th>
      <th>Color</th>
      <th class="text-right">Quantity</th>
      <th class="text-right">Unit Cost</th>
      <th class="text-right">Total</th>
    </tr>
  </thead>
  <tbody>
    ${lineItems
      .map(
        (li) => `<tr>
      <td>${li.sku}</td>
      <td>${li.product_name}</td>
      <td>${li.color_name}</td>
      <td class="text-right">${(li.quantity as number).toLocaleString()}</td>
      <td class="text-right">$${(li.unit_cost as number).toFixed(2)}</td>
      <td class="text-right">$${(li.total_cost as number).toFixed(2)}</td>
    </tr>`
      )
      .join("\n")}
    <tr class="total-row">
      <td colspan="3">Total</td>
      <td class="text-right">${(po.total_units as number).toLocaleString()}</td>
      <td></td>
      <td class="text-right">$${(po.total_cost as number).toFixed(2)}</td>
    </tr>
  </tbody>
</table>

${po.notes ? `<div class="notes"><strong>Notes:</strong> ${po.notes}</div>` : ""}

</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("PO PDF error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
