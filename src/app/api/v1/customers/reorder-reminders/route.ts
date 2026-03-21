export const dynamic = "force-dynamic";
/**
 * JAX-302: POST /api/v1/customers/reorder-reminders
 * Generates reminder notifications for accounts approaching reorder date (< 7 days).
 */
import { NextResponse } from "next/server";
import { getAllReorderPredictions, refreshReorderEstimates } from "@/modules/customers/lib/reorder-engine";
import { sqlite } from "@/lib/db";

export async function POST() {
  // First refresh reorder estimates
  const estimatesUpdated = refreshReorderEstimates();

  // Get predictions needing reminders (7_day and overdue)
  const approaching = getAllReorderPredictions().filter(
    p => p.reminderStatus === "7_day" || p.reminderStatus === "overdue"
  );

  let remindersCreated = 0;

  for (const pred of approaching) {
    // Check if we already sent a reminder for this account recently (within 3 days)
    const existing = sqlite.prepare(
      `SELECT id FROM notifications
       WHERE entity_id = ? AND type = 'reorder_reminder' AND dismissed = 0
       AND created_at > datetime('now', '-3 days')`
    ).get(pred.accountId);

    if (existing) continue; // Already reminded recently

    const severity = pred.reminderStatus === "overdue" ? "high" : "medium";
    const daysText = pred.daysUntilReorder !== null
      ? pred.daysUntilReorder < 0
        ? `${Math.abs(pred.daysUntilReorder)} days overdue`
        : `${pred.daysUntilReorder} days away`
      : "unknown";

    sqlite.prepare(
      `INSERT INTO notifications (id, type, title, message, severity, module, entity_id, entity_type, read, dismissed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`
    ).run(
      crypto.randomUUID(),
      "reorder_reminder",
      `Reorder reminder: ${pred.companyName}`,
      `Predicted reorder date is ${daysText} (${pred.predictedReorderDate || "N/A"}). Avg cycle: ${pred.avgDaysBetweenOrders} days. Total orders: ${pred.totalOrders}.`,
      severity,
      "customers",
      pred.accountId,
      "customer_account",
    );
    remindersCreated++;
  }

  return NextResponse.json({
    estimatesUpdated,
    approaching: approaching.length,
    remindersCreated,
    predictions: approaching,
  });
}
