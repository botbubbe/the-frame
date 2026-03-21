/**
 * Faire Settlement Sync
 * 
 * Parses Faire settlement CSV reports and maps to unified settlement schema.
 * Faire pays monthly with 25% commission on first orders, 15% on reorders.
 */

import { db } from "@/lib/db";
import { settlements, settlementLineItems } from "@/modules/finance/schema";
import { orders } from "@/modules/orders/schema";
import { eq, and, gte, lte } from "drizzle-orm";

/**
 * Import Faire settlement from CSV export.
 * Expected columns: Settlement ID, Settlement Date, Order Number, Order Date,
 * Retailer, Gross Amount, Commission, Shipping Credit, Adjustments, Net Amount
 */
export async function importFaireSettlementCSV(
  csvData: string
): Promise<{ imported: number; skipped: number; matchedOrders: number }> {
  const Papa = await import("papaparse");
  const parsed = Papa.default.parse(csvData, { header: true, skipEmptyLines: true });
  const rows = parsed.data as Record<string, string>[];

  if (rows.length === 0) return { imported: 0, skipped: 0, matchedOrders: 0 };

  // Group by Settlement ID
  const settlementGroups = new Map<string, Array<Record<string, string>>>();
  for (const row of rows) {
    const sid = row["Settlement ID"] || row["settlement_id"] || "unknown";
    if (!settlementGroups.has(sid)) settlementGroups.set(sid, []);
    settlementGroups.get(sid)!.push(row);
  }

  let imported = 0;
  let skipped = 0;
  let matchedOrders = 0;

  for (const [settlementExtId, rows] of settlementGroups) {
    const externalId = `faire_settlement_${settlementExtId}`;
    const existing = db.select().from(settlements).where(eq(settlements.externalId, externalId)).get();
    if (existing) { skipped++; continue; }

    let grossAmount = 0;
    let totalFees = 0;
    let totalAdjustments = 0;
    const lineItems: Array<{
      type: "sale" | "refund" | "fee" | "adjustment";
      description: string;
      amount: number;
      orderId?: string;
    }> = [];

    // Determine period from row dates
    let earliestDate = "9999-12-31";
    let latestDate = "0000-01-01";
    let settlementDate = "";

    for (const row of rows) {
      const orderDate = row["Order Date"] || row["order_date"] || "";
      const settDate = row["Settlement Date"] || row["settlement_date"] || "";
      if (orderDate < earliestDate) earliestDate = orderDate;
      if (orderDate > latestDate) latestDate = orderDate;
      if (settDate) settlementDate = settDate;

      const gross = parseFloat(row["Gross Amount"] || row["gross_amount"] || "0");
      const commission = Math.abs(parseFloat(row["Commission"] || row["commission"] || "0"));
      const adj = parseFloat(row["Adjustments"] || row["adjustments"] || "0");
      const orderNum = row["Order Number"] || row["order_number"] || "";
      const retailer = row["Retailer"] || row["retailer"] || "";

      grossAmount += gross;
      totalFees += commission;
      totalAdjustments += adj;

      // Try to match to our order
      let matchedOrderId: string | undefined;
      if (orderNum) {
        const matchedOrder = db
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.channel, "faire"), eq(orders.orderNumber, orderNum)))
          .get();
        if (matchedOrder) {
          matchedOrderId = matchedOrder.id;
          matchedOrders++;
        }
      }

      if (gross > 0) {
        lineItems.push({
          type: "sale",
          description: `${retailer} — Order ${orderNum}`.trim(),
          amount: gross,
          orderId: matchedOrderId,
        });
      } else if (gross < 0) {
        lineItems.push({
          type: "refund",
          description: `Return — ${retailer} Order ${orderNum}`.trim(),
          amount: gross,
          orderId: matchedOrderId,
        });
      }
    }

    const netAmount = grossAmount - totalFees + totalAdjustments;
    const settlementId = crypto.randomUUID();

    db.insert(settlements).values({
      id: settlementId,
      channel: "faire",
      periodStart: earliestDate !== "9999-12-31" ? earliestDate : settlementDate,
      periodEnd: latestDate !== "0000-01-01" ? latestDate : settlementDate,
      grossAmount,
      fees: totalFees,
      adjustments: totalAdjustments,
      netAmount,
      currency: "USD",
      externalId,
      status: "received",
      receivedAt: settlementDate,
    }).run();

    // Insert line items
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      db.insert(settlementLineItems).values({
        settlementId,
        type: li.type,
        description: li.description,
        amount: li.amount,
        orderId: li.orderId,
      }).run();
    }

    // Fee line item
    if (totalFees > 0) {
      db.insert(settlementLineItems).values({
        settlementId,
        type: "fee",
        description: "Faire commission",
        amount: -totalFees,
      }).run();
    }

    // Adjustments line item
    if (totalAdjustments !== 0) {
      db.insert(settlementLineItems).values({
        settlementId,
        type: "adjustment",
        description: "Faire adjustments",
        amount: totalAdjustments,
      }).run();
    }

    imported++;
  }

  return { imported, skipped, matchedOrders };
}
