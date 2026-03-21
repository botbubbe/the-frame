export const dynamic = "force-dynamic";
/**
 * JAX-301: POST /api/v1/customers/churn-analysis
 * Runs churn predictor, updates health_status, creates notifications for newly at-risk accounts.
 */
import { NextResponse } from "next/server";
import { predictChurn } from "@/modules/customers/agents/churn-predictor";
import { sqlite } from "@/lib/db";

export async function POST() {
  const risks = predictChurn();

  let updated = 0;
  let newAtRisk = 0;

  for (const risk of risks) {
    // Get current status before updating
    const current = sqlite.prepare(
      `SELECT health_status FROM customer_accounts WHERE id = ?`
    ).get(risk.accountId) as { health_status: string } | undefined;

    const previousStatus = current?.health_status;

    // Update health_status and health_score on account
    sqlite.prepare(
      `UPDATE customer_accounts SET health_status = ?, health_score = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(risk.healthStatus, risk.healthScore, risk.accountId);
    updated++;

    // Record health history
    sqlite.prepare(
      `INSERT INTO account_health_history (id, customer_account_id, score, status, factors, calculated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      crypto.randomUUID(),
      risk.accountId,
      risk.healthScore,
      risk.healthStatus,
      JSON.stringify(risk.riskFactors),
    );

    // Create notification if newly at-risk (status worsened)
    const isNewlyAtRisk = previousStatus === "healthy" && risk.healthStatus !== "healthy";
    const isNewlyChurning = previousStatus !== "churning" && previousStatus !== "churned"
      && (risk.healthStatus === "churning" || risk.healthStatus === "churned");

    if (isNewlyAtRisk || isNewlyChurning) {
      newAtRisk++;
      const severity = risk.healthStatus === "churned" ? "critical"
        : risk.healthStatus === "churning" ? "high"
        : "medium";

      sqlite.prepare(
        `INSERT INTO notifications (id, type, title, message, severity, module, entity_id, entity_type, read, dismissed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))`
      ).run(
        crypto.randomUUID(),
        "churn_alert",
        `${risk.companyName} — ${risk.healthStatus.replace("_", " ")}`,
        `${risk.riskFactors.join(". ")}. Recommended: ${risk.recommendation}`,
        severity,
        "customers",
        risk.accountId,
        "customer_account",
      );
    }
  }

  return NextResponse.json({
    analyzed: risks.length,
    updated,
    newAlerts: newAtRisk,
    risks: risks.slice(0, 20), // Return top 20 for UI
  });
}

export async function GET() {
  // Return latest churn analysis results without re-running
  const risks = predictChurn();
  return NextResponse.json({
    total: risks.length,
    risks,
    summary: {
      churned: risks.filter(r => r.healthStatus === "churned").length,
      churning: risks.filter(r => r.healthStatus === "churning").length,
      at_risk: risks.filter(r => r.healthStatus === "at_risk").length,
    },
  });
}
