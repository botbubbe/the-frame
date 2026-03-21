/**
 * P&L Calculation Engine
 * 
 * Calculates P&L from orders, settlements, expenses, and inventory costs.
 * Supports per-channel breakdown and time period filtering.
 */

import { sqlite } from "@/lib/db";

export type PnlPeriod = "mtd" | "qtd" | "ytd" | "custom";

export interface ChannelPnl {
  channel: string;
  channelLabel: string;
  revenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPct: number;
  fees: number;
  orderCount: number;
}

export interface PnlSummary {
  period: { start: string; end: string; label: string };
  revenue: number;
  cogs: number;
  grossMargin: number;
  grossMarginPct: number;
  totalFees: number;
  totalExpenses: number;
  netIncome: number;
  channels: ChannelPnl[];
  expensesByCategory: Array<{ category: string; amount: number; budget: number | null }>;
}

const CHANNEL_LABELS: Record<string, string> = {
  shopify_dtc: "Shopify DTC",
  shopify_wholesale: "Shopify Wholesale",
  faire: "Faire",
  amazon: "Amazon",
  direct: "Direct",
  phone: "Phone",
};

function getPeriodDates(period: PnlPeriod, customStart?: string, customEnd?: string): { start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "mtd":
      return {
        start: `${year}-${String(month + 1).padStart(2, "0")}-01`,
        end: now.toISOString().split("T")[0],
        label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
    case "qtd": {
      const qStart = Math.floor(month / 3) * 3;
      return {
        start: `${year}-${String(qStart + 1).padStart(2, "0")}-01`,
        end: now.toISOString().split("T")[0],
        label: `Q${Math.floor(month / 3) + 1} ${year}`,
      };
    }
    case "ytd":
      return {
        start: `${year}-01-01`,
        end: now.toISOString().split("T")[0],
        label: `YTD ${year}`,
      };
    case "custom":
      return {
        start: customStart || `${year}-01-01`,
        end: customEnd || now.toISOString().split("T")[0],
        label: `${customStart} to ${customEnd}`,
      };
  }
}

export function calculatePnl(
  period: PnlPeriod = "mtd",
  customStart?: string,
  customEnd?: string
): PnlSummary {
  const dates = getPeriodDates(period, customStart, customEnd);

  // Revenue + COGS by channel from orders
  const channelData = sqlite.prepare(`
    SELECT 
      o.channel,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(SUM(o.total), 0) as revenue,
      -- TODO: Add landed cost lookup when inventory_landed_costs table is populated
      0 as cogs
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.placed_at >= ? AND o.placed_at <= ?
      AND o.status NOT IN ('cancelled', 'returned')
    GROUP BY o.channel
  `).all(dates.start, dates.end + "T23:59:59") as Array<{
    channel: string;
    order_count: number;
    revenue: number;
    cogs: number;
  }>;

  // Fees from settlements
  const feeData = sqlite.prepare(`
    SELECT channel, COALESCE(SUM(fees), 0) as total_fees
    FROM settlements
    WHERE period_start >= ? AND period_end <= ?
    GROUP BY channel
  `).all(dates.start, dates.end) as Array<{ channel: string; total_fees: number }>;

  const feesByChannel = new Map(feeData.map(f => [f.channel, f.total_fees]));

  // Build channel P&L
  const channels: ChannelPnl[] = channelData.map(c => {
    const fees = feesByChannel.get(c.channel) || 0;
    const grossMargin = c.revenue - c.cogs;
    return {
      channel: c.channel,
      channelLabel: CHANNEL_LABELS[c.channel] || c.channel,
      revenue: c.revenue,
      cogs: c.cogs,
      grossMargin,
      grossMarginPct: c.revenue > 0 ? (grossMargin / c.revenue) * 100 : 0,
      fees,
      orderCount: c.order_count,
    };
  });

  // Expenses by category
  const expenseData = sqlite.prepare(`
    SELECT 
      ec.name as category,
      COALESCE(SUM(e.amount), 0) as amount,
      ec.budget_monthly as budget
    FROM expenses e
    JOIN expense_categories ec ON e.category_id = ec.id
    WHERE e.date >= ? AND e.date <= ?
    GROUP BY ec.id, ec.name
    ORDER BY amount DESC
  `).all(dates.start, dates.end) as Array<{ category: string; amount: number; budget: number | null }>;

  // Totals
  const revenue = channels.reduce((s, c) => s + c.revenue, 0);
  const cogs = channels.reduce((s, c) => s + c.cogs, 0);
  const totalFees = channels.reduce((s, c) => s + c.fees, 0);
  const totalExpenses = expenseData.reduce((s, e) => s + e.amount, 0);
  const grossMargin = revenue - cogs;

  return {
    period: dates,
    revenue,
    cogs,
    grossMargin,
    grossMarginPct: revenue > 0 ? (grossMargin / revenue) * 100 : 0,
    totalFees,
    totalExpenses,
    netIncome: grossMargin - totalFees - totalExpenses,
    channels,
    expensesByCategory: expenseData,
  };
}
