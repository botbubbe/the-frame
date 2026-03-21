/**
 * JAX-327: AI Agent Logic Tests
 * Tests pure logic functions — no LLM calls, no DB required for most.
 */
import { describe, it, expect } from "vitest";
import "../setup";

// ── 1. Conversion Scorer ──
import { scoreCompany } from "@/modules/sales/agents/conversion-scorer";

describe("Conversion Scorer — scoreCompany", () => {
  const base = { id: "c1", email: null, phone: null, website: null, google_rating: null, google_review_count: null, icp_tier: null, state: null };

  it("returns 0 for empty company", () => {
    expect(scoreCompany(base)).toBe(0);
  });

  it("scores email +20, phone +15, website +10", () => {
    expect(scoreCompany({ ...base, email: "a@b.com" })).toBe(20);
    expect(scoreCompany({ ...base, phone: "555" })).toBe(15);
    expect(scoreCompany({ ...base, website: "x.com" })).toBe(10);
    expect(scoreCompany({ ...base, email: "a@b.com", phone: "555", website: "x.com" })).toBe(45);
  });

  it("scores google rating >= 4.0 +10", () => {
    expect(scoreCompany({ ...base, google_rating: 4.0 })).toBe(10);
    expect(scoreCompany({ ...base, google_rating: 3.9 })).toBe(0);
  });

  it("scores google reviews >= 50 +10", () => {
    expect(scoreCompany({ ...base, google_review_count: 50 })).toBe(10);
    expect(scoreCompany({ ...base, google_review_count: 49 })).toBe(0);
  });

  it("scores ICP tiers: A=30, B=20, C=10", () => {
    expect(scoreCompany({ ...base, icp_tier: "A" })).toBe(30);
    expect(scoreCompany({ ...base, icp_tier: "B" })).toBe(20);
    expect(scoreCompany({ ...base, icp_tier: "C" })).toBe(10);
  });

  it("scores target state +5", () => {
    expect(scoreCompany({ ...base, state: "CA" })).toBe(5);
    expect(scoreCompany({ ...base, state: "WA" })).toBe(0);
  });

  it("caps at 100", () => {
    expect(scoreCompany({
      id: "c1", email: "a@b.com", phone: "555", website: "x.com",
      google_rating: 5, google_review_count: 100, icp_tier: "A", state: "CA",
    })).toBe(100);
  });
});

// ── 2. Response Classifier ──
import { classifyReply } from "@/modules/sales/agents/response-classifier";

describe("Response Classifier — classifyReply", () => {
  it("classifies out-of-office", () => {
    expect(classifyReply("I'm out of office until Monday").classification).toBe("out_of_office");
  });

  it("classifies auto-reply", () => {
    expect(classifyReply("This is an automated response").classification).toBe("auto_reply");
  });

  it("classifies wrong person", () => {
    expect(classifyReply("She left the company last year").classification).toBe("wrong_person");
  });

  it("classifies not interested", () => {
    expect(classifyReply("No thanks, we're good").classification).toBe("not_interested");
  });

  it("classifies interested", () => {
    expect(classifyReply("Sounds great, send me the catalog").classification).toBe("interested");
  });

  it("classifies questions", () => {
    expect(classifyReply("How much does it cost?").classification).toBe("question");
  });

  it("prioritizes out-of-office over interested keywords", () => {
    expect(classifyReply("I'm out of office but interested").classification).toBe("out_of_office");
  });

  it("defaults short unknown text to question", () => {
    const result = classifyReply("OK");
    expect(result.classification).toBe("question");
    expect(result.confidence).toBe(0.3);
  });

  it("confidence increases with more keyword matches", () => {
    const single = classifyReply("not interested");
    const multi = classifyReply("not interested, no thanks, please remove me");
    expect(multi.confidence).toBeGreaterThan(single.confidence);
  });
});

// ── 3. Health Scoring (used by Churn Predictor) ──
import { calculateHealthScore, healthStatusFromScore } from "@/modules/customers/lib/health-scoring";

describe("Health Scoring — healthStatusFromScore", () => {
  it("maps score ranges to statuses", () => {
    expect(healthStatusFromScore(80)).toBe("healthy");
    expect(healthStatusFromScore(70)).toBe("healthy");
    expect(healthStatusFromScore(50)).toBe("at_risk");
    expect(healthStatusFromScore(40)).toBe("at_risk");
    expect(healthStatusFromScore(25)).toBe("churning");
    expect(healthStatusFromScore(20)).toBe("churning");
    expect(healthStatusFromScore(10)).toBe("churned");
  });
});

describe("Health Scoring — calculateHealthScore", () => {
  it("scores a healthy recent high-value customer high", () => {
    const result = calculateHealthScore({
      totalOrders: 6,
      avgOrderValue: 2000,
      lifetimeValue: 12000,
      lastOrderAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      firstOrderAt: new Date(Date.now() - 180 * 86_400_000).toISOString(),
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.status).toBe("healthy");
  });

  it("scores a lapsed single-order customer low", () => {
    const result = calculateHealthScore({
      totalOrders: 1,
      avgOrderValue: 150,
      lifetimeValue: 150,
      lastOrderAt: new Date(Date.now() - 400 * 86_400_000).toISOString(),
      firstOrderAt: new Date(Date.now() - 400 * 86_400_000).toISOString(),
    });
    expect(result.score).toBeLessThan(40);
    expect(["churning", "churned"]).toContain(result.status);
  });

  it("returns all factor subscores", () => {
    const result = calculateHealthScore({
      totalOrders: 3,
      avgOrderValue: 500,
      lifetimeValue: 1500,
      lastOrderAt: new Date(Date.now() - 45 * 86_400_000).toISOString(),
      firstOrderAt: new Date(Date.now() - 200 * 86_400_000).toISOString(),
    });
    expect(result.factors).toHaveProperty("recency");
    expect(result.factors).toHaveProperty("frequency");
    expect(result.factors).toHaveProperty("monetary");
    expect(result.factors).toHaveProperty("engagement");
  });
});

// ── 4. SEO Optimizer ──
import { analyzeContent } from "@/modules/marketing/agents/seo-optimizer";

describe("SEO Optimizer — analyzeContent", () => {
  it("penalizes missing title heavily", () => {
    const result = analyzeContent({ title: "", body: "Some content here ".repeat(100) });
    expect(result.score).toBeLessThanOrEqual(80);
    expect(result.issues.some(i => i.message.includes("title"))).toBe(true);
  });

  it("penalizes short body", () => {
    const result = analyzeContent({ title: "Good Title For SEO Testing", body: "Short." });
    expect(result.issues.some(i => i.message.includes("short"))).toBe(true);
  });

  it("flags missing meta description", () => {
    const result = analyzeContent({ title: "Good Title For SEO Testing", body: "word ".repeat(500) });
    expect(result.issues.some(i => i.message.includes("meta description"))).toBe(true);
  });

  it("flags keyword not in title", () => {
    const result = analyzeContent({
      title: "Something else entirely for testing",
      body: "sunglasses ".repeat(200),
      targetKeyword: "sunglasses",
    });
    expect(result.issues.some(i => i.message.includes("keyword not in title"))).toBe(true);
  });

  it("gives high score to well-optimized content", () => {
    const result = analyzeContent({
      title: "Best Wholesale Sunglasses Guide",
      body: ("wholesale sunglasses are great. ## Why Choose Wholesale\n" + "content ".repeat(200)),
      metaDescription: "Discover the best wholesale sunglasses for your retail store. Complete guide with pricing and tips.",
      targetKeyword: "wholesale sunglasses",
    });
    expect(result.score).toBeGreaterThanOrEqual(60);
  });
});

// ── 5. Skipped agents (pure LLM wrappers or DB-only) ──
// Content Idea Generator: async, DB-dependent for product lookup, seasonal logic is trivial array push.
// Upsell Recommender: all logic requires DB queries (account + order lookups).
// Demand Forecaster: getSellThroughForWindow and runDemandForecast both query DB; trend/seasonal logic is inline and not exported.
// Margin Optimizer: analyzeMargins queries DB; margin calc logic is inline in the map callback.
// Email Copywriter: fillTemplate is not exported; writeEmail requires DB for company lookup.
// These would need integration tests with seeded DB data rather than unit tests.
