/**
 * Business Health Score
 * Composite score from pipeline, inventory, customers, finance.
 */

export interface BusinessHealth {
  overall: number;
  status: "excellent" | "good" | "fair" | "poor";
  components: {
    pipeline: { score: number; label: string };
    inventory: { score: number; label: string };
    customers: { score: number; label: string };
    finance: { score: number; label: string };
  };
}

export function calculateBusinessHealth(): BusinessHealth {
  // TODO: Wire to real data from each module
  const pipeline = { score: 72, label: "12 active deals, 3 stale" };
  const inventory = { score: 65, label: "2 SKUs low, 1 out of stock" };
  const customers = { score: 81, label: "85% healthy, 10% at-risk" };
  const finance = { score: 78, label: "Positive cash flow, margins stable" };

  const overall = Math.round(
    pipeline.score * 0.3 + inventory.score * 0.25 + customers.score * 0.25 + finance.score * 0.2
  );

  const status = overall >= 80 ? "excellent" : overall >= 65 ? "good" : overall >= 50 ? "fair" : "poor";

  return { overall, status, components: { pipeline, inventory, customers, finance } };
}
