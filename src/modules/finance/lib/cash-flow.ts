/**
 * Cash Flow Forecast
 * 
 * Current position from received settlements
 * Expected inflows from pending settlements
 * Expected outflows from POs and recurring expenses
 * 30/60/90 day projections
 */

import { sqlite } from "@/lib/db";

export interface CashFlowSummary {
  currentPosition: number;
  pendingInflows: number;
  expectedOutflows30d: number;
  expectedOutflows60d: number;
  expectedOutflows90d: number;
  forecast: Array<{
    period: string;
    label: string;
    inflows: number;
    outflows: number;
    netCashFlow: number;
    projectedBalance: number;
  }>;
  pendingSettlements: Array<{
    id: string;
    channel: string;
    netAmount: number;
    periodEnd: string;
  }>;
  upcomingExpenses: Array<{
    description: string;
    amount: number;
    vendor: string;
    date: string;
  }>;
}

export function calculateCashFlow(): CashFlowSummary {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Current cash position: sum of received settlements
  const receivedResult = sqlite.prepare(`
    SELECT COALESCE(SUM(net_amount), 0) as total
    FROM settlements
    WHERE status IN ('received', 'reconciled', 'synced_to_xero')
  `).get() as { total: number };

  // Subtract all expenses to date
  const expensesResult = sqlite.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date <= ?
  `).get(today) as { total: number };

  // Subtract PO costs (in production or shipped)
  const poResult = sqlite.prepare(`
    SELECT COALESCE(SUM(total_cost), 0) as total
    FROM inventory_purchase_orders
    WHERE status IN ('confirmed', 'in_production', 'shipped', 'received')
  `).get() as { total: number } | undefined;

  const currentPosition = receivedResult.total - expensesResult.total - (poResult?.total || 0);

  // Pending inflows
  const pendingSettlements = sqlite.prepare(`
    SELECT id, channel, net_amount, period_end
    FROM settlements
    WHERE status = 'pending'
    ORDER BY period_end ASC
  `).all() as Array<{ id: string; channel: string; net_amount: number; period_end: string }>;

  const pendingInflows = pendingSettlements.reduce((s, p) => s + p.net_amount, 0);

  // Recurring monthly expenses
  const monthlyExpenses = sqlite.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE recurring = 1 AND (frequency = 'monthly' OR frequency IS NULL)
  `).get() as { total: number };

  // Upcoming POs not yet paid
  const upcomingPOs = sqlite.prepare(`
    SELECT COALESCE(SUM(total_cost), 0) as total
    FROM inventory_purchase_orders
    WHERE status IN ('draft', 'pending')
  `).get() as { total: number } | undefined;

  const monthlyOutflow = monthlyExpenses.total;
  const pendingPOCost = upcomingPOs?.total || 0;

  // 30/60/90 day forecast
  const forecast = [];
  let runningBalance = currentPosition;

  for (const days of [30, 60, 90]) {
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);
    const months = days / 30;

    // Estimate inflows: average weekly settlement * weeks
    const avgWeeklySettlement = sqlite.prepare(`
      SELECT COALESCE(AVG(net_amount), 0) as avg_net
      FROM settlements
      WHERE status IN ('received', 'reconciled', 'synced_to_xero')
    `).get() as { avg_net: number };

    const estimatedInflows = pendingInflows + (avgWeeklySettlement.avg_net * (days / 7));
    const estimatedOutflows = (monthlyOutflow * months) + (days <= 30 ? pendingPOCost : 0);
    const netCashFlow = estimatedInflows - estimatedOutflows;
    runningBalance += netCashFlow;

    forecast.push({
      period: `${days}d`,
      label: `${days}-Day Outlook`,
      inflows: Math.round(estimatedInflows * 100) / 100,
      outflows: Math.round(estimatedOutflows * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      projectedBalance: Math.round(runningBalance * 100) / 100,
    });

    runningBalance = currentPosition; // Reset for independent projections
  }

  // Upcoming recurring expenses
  const upcomingExpenses = sqlite.prepare(`
    SELECT description, amount, vendor, date
    FROM expenses
    WHERE recurring = 1
    ORDER BY amount DESC
    LIMIT 10
  `).all() as Array<{ description: string; amount: number; vendor: string; date: string }>;

  return {
    currentPosition: Math.round(currentPosition * 100) / 100,
    pendingInflows: Math.round(pendingInflows * 100) / 100,
    expectedOutflows30d: Math.round((monthlyOutflow + pendingPOCost) * 100) / 100,
    expectedOutflows60d: Math.round((monthlyOutflow * 2) * 100) / 100,
    expectedOutflows90d: Math.round((monthlyOutflow * 3) * 100) / 100,
    forecast,
    pendingSettlements: pendingSettlements.map(p => ({
      ...p,
      netAmount: p.net_amount,
    })),
    upcomingExpenses,
  };
}
