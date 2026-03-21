import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, resetTestDb } from "../setup";
import { createRequest, parseResponse } from "../api-helpers";

// Route handlers
import { GET as getHealth } from "@/app/api/v1/customers/health/route";
import { GET as getCustomerDetail } from "@/app/api/v1/customers/[id]/route";
import { GET as getReorderPredictions } from "@/app/api/v1/customers/reorder-predictions/route";
import { POST as postSync } from "@/app/api/v1/customers/sync/route";
import { POST as postChurnAnalysis } from "@/app/api/v1/customers/churn-analysis/route";
import { POST as postReorderReminders } from "@/app/api/v1/customers/reorder-reminders/route";

// Business logic
import { calculateTier } from "@/modules/customers/lib/account-sync";
import { healthStatusFromScore, calculateHealthScore } from "@/modules/customers/lib/health-scoring";

beforeEach(() => {
  resetTestDb();
  // Re-seed user (resetTestDb doesn't clear users)
});

// ── Helpers ──

function seedCustomerData() {
  const db = getTestDb();
  // Companies
  db.prepare("INSERT INTO companies (id, name, state, status) VALUES ('c1', 'Sunny Shades', 'CA', 'qualified')").run();
  db.prepare("INSERT INTO companies (id, name, state, status) VALUES ('c2', 'Cool Frames', 'NY', 'qualified')").run();
  db.prepare("INSERT INTO companies (id, name, state, status) VALUES ('c3', 'Beach Eyes', 'FL', 'qualified')").run();

  // Customer accounts
  db.prepare(`INSERT INTO customer_accounts (id, company_id, tier, lifetime_value, total_orders, avg_order_value, health_score, health_status, first_order_at, last_order_at)
    VALUES ('ca1', 'c1', 'gold', 5000, 6, 833, 85, 'healthy', '2025-01-01', '2026-02-15')`).run();
  db.prepare(`INSERT INTO customer_accounts (id, company_id, tier, lifetime_value, total_orders, avg_order_value, health_score, health_status, first_order_at, last_order_at)
    VALUES ('ca2', 'c2', 'bronze', 200, 1, 200, 30, 'churning', '2025-03-01', '2025-03-01')`).run();
  db.prepare(`INSERT INTO customer_accounts (id, company_id, tier, lifetime_value, total_orders, avg_order_value, health_score, health_status, first_order_at, last_order_at)
    VALUES ('ca3', 'c3', 'silver', 1000, 3, 333, 55, 'at_risk', '2025-01-01', '2025-10-01')`).run();

  // Orders for c1
  const past = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
  db.prepare("INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES ('o1', '1001', 'c1', 'direct', 'delivered', 1000, ?)").run(past(120));
  db.prepare("INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES ('o2', '1002', 'c1', 'direct', 'delivered', 1500, ?)").run(past(60));
  db.prepare("INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES ('o3', '1003', 'c1', 'faire', 'delivered', 2500, ?)").run(past(10));

  // Orders for c2 (single old order)
  db.prepare("INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES ('o4', '1004', 'c2', 'faire', 'delivered', 200, ?)").run(past(300));

  // Orders for c3 (multiple but aging)
  db.prepare("INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES ('o5', '1005', 'c3', 'direct', 'delivered', 500, ?)").run(past(200));
  db.prepare("INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES ('o6', '1006', 'c3', 'direct', 'delivered', 500, ?)").run(past(100));
}

// ── Health Summary ──

describe("GET /customers/health", () => {
  it("returns health summary grouped by status and tier", async () => {
    seedCustomerData();
    const res = await getHealth(createRequest("GET", "/api/v1/customers/health"));
    const { status, data } = await parseResponse<{ byStatus: any[]; byTier: any[] }>(res);
    expect(status).toBe(200);
    expect(data.byStatus).toBeDefined();
    expect(data.byTier).toBeDefined();
    expect(data.byTier.length).toBeGreaterThan(0);
  });
});

// ── Customer Detail ──

describe("GET /customers/[id]", () => {
  it("returns customer with orders and health history", async () => {
    seedCustomerData();
    const res = await getCustomerDetail(
      createRequest("GET", "/api/v1/customers/ca1"),
      { params: Promise.resolve({ id: "ca1" }) },
    );
    const { status, data } = await parseResponse<{ account: any; orders: any[]; healthHistory: any[] }>(res);
    expect(status).toBe(200);
    expect(data.account.company_name).toBe("Sunny Shades");
    expect(data.orders.length).toBe(3);
  });

  it("returns 404 for unknown customer", async () => {
    const res = await getCustomerDetail(
      createRequest("GET", "/api/v1/customers/nonexistent"),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    expect(res.status).toBe(404);
  });
});

// ── Reorder Predictions ──

describe("GET /customers/reorder-predictions", () => {
  it("returns predictions for accounts with 2+ orders", async () => {
    seedCustomerData();
    const res = await getReorderPredictions(createRequest("GET", "/api/v1/customers/reorder-predictions"));
    const { data } = await parseResponse<{ predictions: any[]; total: number; summary: any }>(res);
    // c1 has 3 orders, c3 has 2 — both should appear
    expect(data.total).toBeGreaterThanOrEqual(2);
    expect(data.summary).toBeDefined();
  });

  it("returns single prediction by accountId", async () => {
    seedCustomerData();
    const res = await getReorderPredictions(createRequest("GET", "/api/v1/customers/reorder-predictions", {
      searchParams: { accountId: "ca1" },
    }));
    const { data } = await parseResponse<any>(res);
    expect(data.accountId).toBe("ca1");
    expect(data.companyName).toBe("Sunny Shades");
  });
});

// ── Sync ──

describe("POST /customers/sync", () => {
  it("creates customer accounts from orders", async () => {
    const db = getTestDb();
    db.prepare("INSERT INTO companies (id, name, state, status) VALUES ('c10', 'New Shop', 'TX', 'new')").run();
    db.prepare("INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES ('o10', '2001', 'c10', 'direct', 'delivered', 500, datetime('now'))").run();

    const res = await postSync(createRequest("POST", "/api/v1/customers/sync"));
    const { data } = await parseResponse<{ success: boolean; created: number }>(res);
    expect(data.success).toBe(true);
    expect(data.created).toBeGreaterThanOrEqual(1);

    // Verify account was created
    const acct = db.prepare("SELECT * FROM customer_accounts WHERE company_id = 'c10'").get() as any;
    expect(acct).toBeTruthy();
    expect(acct.total_orders).toBe(1);
  });
});

// ── Churn Analysis ──

describe("POST /customers/churn-analysis", () => {
  it("runs churn analysis and updates health statuses", async () => {
    seedCustomerData();
    const res = await postChurnAnalysis(createRequest("POST", "/api/v1/customers/churn-analysis"));
    const { data } = await parseResponse<{ analyzed: number; updated: number; newAlerts: number }>(res);
    expect(data.analyzed).toBeGreaterThan(0);
    expect(data.updated).toBeGreaterThan(0);
  });

  it("creates notifications for newly at-risk accounts", async () => {
    const db = getTestDb();
    db.prepare("INSERT INTO companies (id, name, state, status) VALUES ('cx', 'Stale Co', 'OH', 'qualified')").run();
    // Account currently "healthy" but order is very old → should flip
    db.prepare(`INSERT INTO customer_accounts (id, company_id, tier, lifetime_value, total_orders, avg_order_value, health_score, health_status, first_order_at, last_order_at)
      VALUES ('cax', 'cx', 'bronze', 100, 1, 100, 50, 'healthy', '2024-01-01', '2024-01-01')`).run();
    db.prepare("INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES ('ox', '9001', 'cx', 'direct', 'delivered', 100, '2024-01-01')").run();

    await postChurnAnalysis(createRequest("POST", "/api/v1/customers/churn-analysis"));

    const notifs = db.prepare("SELECT * FROM notifications WHERE entity_id = 'cax'").all();
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Reorder Reminders ──

describe("POST /customers/reorder-reminders", () => {
  it("generates reminders for approaching reorders", async () => {
    seedCustomerData();
    // Make c3's reorder overdue by setting last_order_at far back
    const db = getTestDb();
    db.prepare("UPDATE customer_accounts SET last_order_at = '2025-06-01' WHERE id = 'ca3'").run();

    const res = await postReorderReminders(createRequest("POST", "/api/v1/customers/reorder-reminders"));
    const { data } = await parseResponse<{ estimatesUpdated: number; remindersCreated: number }>(res);
    expect(data).toBeDefined();
    // Just verify it ran without error
    expect(typeof data.estimatesUpdated).toBe("number");
    expect(typeof data.remindersCreated).toBe("number");
  });
});

// ── Tier Assignment Logic ──

describe("Tier assignment", () => {
  it("bronze: 1 order, low LTV", () => {
    expect(calculateTier(1, 100)).toBe("bronze");
  });

  it("silver: 2+ orders or $500+ LTV", () => {
    expect(calculateTier(2, 400)).toBe("silver");
    expect(calculateTier(1, 500)).toBe("silver");
  });

  it("gold: 5+ orders or $2K+ LTV", () => {
    expect(calculateTier(5, 1000)).toBe("gold");
    expect(calculateTier(3, 2000)).toBe("gold");
  });

  it("platinum: $5K+ LTV", () => {
    expect(calculateTier(2, 5000)).toBe("platinum");
  });
});

// ── Health Status Transitions ──

describe("Health status from score", () => {
  it("healthy >= 70", () => {
    expect(healthStatusFromScore(70)).toBe("healthy");
    expect(healthStatusFromScore(100)).toBe("healthy");
  });

  it("at_risk 40-69", () => {
    expect(healthStatusFromScore(40)).toBe("at_risk");
    expect(healthStatusFromScore(69)).toBe("at_risk");
  });

  it("churning 20-39", () => {
    expect(healthStatusFromScore(20)).toBe("churning");
    expect(healthStatusFromScore(39)).toBe("churning");
  });

  it("churned < 20", () => {
    expect(healthStatusFromScore(19)).toBe("churned");
    expect(healthStatusFromScore(0)).toBe("churned");
  });
});

describe("Health score calculation", () => {
  it("high score for recent frequent buyer", () => {
    const result = calculateHealthScore({
      totalOrders: 6,
      avgOrderValue: 1000,
      lifetimeValue: 6000,
      lastOrderAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      firstOrderAt: new Date(Date.now() - 365 * 86400000).toISOString(),
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.status).toBe("healthy");
  });

  it("low score for old single-order customer", () => {
    const result = calculateHealthScore({
      totalOrders: 1,
      avgOrderValue: 150,
      lifetimeValue: 150,
      lastOrderAt: new Date(Date.now() - 400 * 86400000).toISOString(),
      firstOrderAt: new Date(Date.now() - 400 * 86400000).toISOString(),
    });
    expect(result.score).toBeLessThan(40);
    expect(["churning", "churned"]).toContain(result.status);
  });
});
