/**
 * Trend Detector Agent
 * Identifies trending products, declining products, and dead stock.
 */

export interface TrendData {
  trending_up: { sku: string; name: string; change_pct: number }[];
  trending_down: { sku: string; name: string; change_pct: number }[];
  dead_stock: { sku: string; name: string; days_since_sale: number }[];
}

export function detectTrends(): TrendData {
  // TODO: Wire to real sell-through data
  return {
    trending_up: [
      { sku: "JX1001-BLK", name: "Golden Hour", change_pct: 18.5 },
      { sku: "JX1003-TRT", name: "Midnight Drive", change_pct: 12.3 },
    ],
    trending_down: [
      { sku: "JX2002-BLU", name: "Ocean Blue", change_pct: -15.2 },
      { sku: "JX4003-PNK", name: "Rose Garden", change_pct: -28.4 },
    ],
    dead_stock: [
      { sku: "JX1008-GRN", name: "Forest Walk", days_since_sale: 67 },
    ],
  };
}
