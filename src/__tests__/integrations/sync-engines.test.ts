/**
 * JAX-326: Sync Engine Tests
 * Tests for Instantly client, Instantly sync, Faire sync, and Account sync
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { calculateTier } from "@/modules/customers/lib/account-sync";

// ── 1. Instantly Client Tests ──

describe("Instantly Client", () => {
  it("constructs correct API URLs and auth headers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", fetchSpy);
    process.env.INSTANTLY_API_KEY = "test-key-123";

    vi.resetModules();
    const { instantlyClient } = await import("@/modules/sales/lib/instantly-client");

    await instantlyClient.listCampaigns();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.instantly.ai/api/v2/campaigns",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key-123",
          "Content-Type": "application/json",
        }),
      })
    );

    delete process.env.INSTANTLY_API_KEY;
    vi.unstubAllGlobals();
  });

  it("returns mock data when API key is not set", async () => {
    delete process.env.INSTANTLY_API_KEY;
    vi.resetModules();
    const { instantlyClient } = await import("@/modules/sales/lib/instantly-client");

    expect(instantlyClient.isMock).toBe(true);
    const campaigns = await instantlyClient.listCampaigns();
    expect(campaigns.length).toBeGreaterThan(0);
    expect(campaigns[0]).toHaveProperty("id");
    expect(campaigns[0]).toHaveProperty("name");
    expect(campaigns[0]).toHaveProperty("status");
  });

  it("parses campaign analytics correctly in mock mode", async () => {
    delete process.env.INSTANTLY_API_KEY;
    vi.resetModules();
    const { instantlyClient } = await import("@/modules/sales/lib/instantly-client");

    const campaigns = await instantlyClient.listCampaigns();
    const analytics = await instantlyClient.getCampaignAnalytics(campaigns[0].id);

    expect(analytics).toHaveProperty("campaign_id");
    expect(analytics).toHaveProperty("emails_sent");
    expect(analytics).toHaveProperty("open_rate");
    expect(analytics).toHaveProperty("reply_rate");
    expect(typeof analytics.emails_sent).toBe("number");
    expect(analytics.emails_sent).toBeGreaterThan(0);
  });
});

// ── 2. Instantly Sync Tests ──

describe("Instantly Sync — push and pull", () => {
  beforeEach(() => {
    delete process.env.INSTANTLY_API_KEY;
  });

  it("pushes unsynced campaigns and formats leads correctly", async () => {
    // Use the mocked db directly from @/lib/db after importing
    const { sqlite } = await import("@/lib/db");
    
    // Ensure instantly_sync table
    sqlite.exec(`CREATE TABLE IF NOT EXISTS instantly_sync (id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT, instantly_id TEXT, last_synced_at TEXT, sync_status TEXT)`);
    
    // Clean slate
    try { sqlite.exec("DELETE FROM campaigns"); } catch {}
    try { sqlite.exec("DELETE FROM campaign_leads"); } catch {}
    try { sqlite.exec("DELETE FROM instantly_sync"); } catch {}
    try { sqlite.exec("DELETE FROM companies"); } catch {}
    try { sqlite.exec("DELETE FROM contacts"); } catch {}

    const campId = crypto.randomUUID();
    const compId = crypto.randomUUID();
    const contactId = crypto.randomUUID();
    const leadId = crypto.randomUUID();

    sqlite.prepare("INSERT INTO campaigns (id, name, status) VALUES (?, ?, ?)").run(campId, "Test Campaign", "active");
    sqlite.prepare("INSERT INTO companies (id, name, website) VALUES (?, ?, ?)").run(compId, "Acme Optics", "https://acme.com");
    sqlite.prepare("INSERT INTO contacts (id, company_id, first_name, last_name, email, phone) VALUES (?, ?, ?, ?, ?, ?)").run(contactId, compId, "Jane", "Doe", "jane@acme.com", "555-1234");

    const { runInstantlySync } = await import("@/modules/sales/lib/instantly-sync");
    const result1 = await runInstantlySync();

    // Campaign should be pushed (created in Instantly mock)
    expect(result1.pushed.campaigns).toBe(1);
    expect(result1.errors.length).toBe(0);

    const updated = sqlite.prepare("SELECT instantly_campaign_id FROM campaigns WHERE id = ?").get(campId) as any;
    expect(updated.instantly_campaign_id).toBeTruthy();

    // Now add a lead and sync again to test lead push
    sqlite.prepare("INSERT INTO campaign_leads (id, campaign_id, company_id, contact_id, email) VALUES (?, ?, ?, ?, ?)").run(leadId, campId, compId, contactId, "jane@acme.com");

    const result2 = await runInstantlySync();
    expect(result2.pushed.leads).toBeGreaterThanOrEqual(1);

    const lead = sqlite.prepare("SELECT instantly_lead_id, status FROM campaign_leads WHERE id = ?").get(leadId) as any;
    expect(lead.instantly_lead_id).toBeTruthy();
    expect(lead.status).toBe("sent");
  });

  it("pulls analytics and updates campaign stats", async () => {
    const { sqlite } = await import("@/lib/db");
    
    sqlite.exec(`CREATE TABLE IF NOT EXISTS instantly_sync (id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT, instantly_id TEXT, last_synced_at TEXT, sync_status TEXT)`);
    try { sqlite.exec("DELETE FROM campaigns"); } catch {}

    const campId = crypto.randomUUID();
    sqlite.prepare("INSERT INTO campaigns (id, name, instantly_campaign_id, status, sent, opened, replied) VALUES (?, ?, ?, ?, 0, 0, 0)").run(campId, "Synced Campaign", "mock-camp-001", "active");
    sqlite.prepare("INSERT INTO instantly_sync (id, entity_type, entity_id, instantly_id, sync_status) VALUES (?, 'campaign', ?, 'mock-camp-001', 'synced')").run(crypto.randomUUID(), campId);

    const { runInstantlySync } = await import("@/modules/sales/lib/instantly-sync");
    const result = await runInstantlySync();

    expect(result.pulled.campaigns).toBe(1);

    const camp = sqlite.prepare("SELECT sent, opened, replied FROM campaigns WHERE id = ?").get(campId) as any;
    expect(camp.sent).toBeGreaterThan(0);
    expect(camp.opened).toBeGreaterThan(0);
  });
});

// ── 3. Faire Sync Tests ──

describe("Faire Sync — order format mapping", () => {
  it("converts dollar amounts and maps status correctly", async () => {
    const { sqlite } = await import("@/lib/db");
    try { sqlite.exec("DELETE FROM orders"); sqlite.exec("DELETE FROM order_items"); } catch {}

    const { importFaireOrders } = await import("@/modules/orders/lib/faire-sync");

    const result = await importFaireOrders([{
      order_number: "FO-TEST001",
      retailer_name: "Test Boutique",
      retailer_email: "test@boutique.com",
      product_name: "Classic Frame",
      sku: "JX-CF-001",
      quantity: "10",
      unit_price: "12.50",
      total: "125.00",
      order_date: "2026-03-01",
      status: "PROCESSING",
    }]);

    expect(result.imported).toBe(1);

    const order = sqlite.prepare("SELECT * FROM orders WHERE channel = 'faire'").get() as any;
    expect(order).toBeTruthy();
    expect(order.subtotal).toBe(125.0);
    expect(order.status).toBe("confirmed");
  });

  it("handles all Faire status mappings", async () => {
    const { sqlite } = await import("@/lib/db");
    const { importFaireOrders } = await import("@/modules/orders/lib/faire-sync");

    const statuses = [
      { input: "NEW", expected: "pending" },
      { input: "IN_TRANSIT", expected: "shipped" },
      { input: "DELIVERED", expected: "delivered" },
      { input: "CANCELED", expected: "cancelled" },
    ];

    for (const { input, expected } of statuses) {
      try { sqlite.exec("DELETE FROM orders"); sqlite.exec("DELETE FROM order_items"); } catch {}

      const result = await importFaireOrders([{
        order_number: `FO-${input}`,
        retailer_name: `Shop ${input}`,
        retailer_email: `${input.toLowerCase()}@test.com`,
        product_name: "Frame",
        sku: "JX-001",
        quantity: "1",
        unit_price: "10",
        total: "10",
        order_date: "2026-03-01",
        status: input,
      }]);
      expect(result.imported).toBe(1);
      const order = sqlite.prepare("SELECT status FROM orders WHERE channel = 'faire'").get() as any;
      expect(order.status).toBe(expected);
    }
  });

  it("skips duplicate orders (idempotency)", async () => {
    const { sqlite } = await import("@/lib/db");
    try { sqlite.exec("DELETE FROM orders"); sqlite.exec("DELETE FROM order_items"); } catch {}

    const { importFaireOrders } = await import("@/modules/orders/lib/faire-sync");

    const row = {
      order_number: "FO-DUPE001",
      retailer_name: "Dupe Shop",
      retailer_email: "dupe@shop.com",
      product_name: "Frame",
      sku: "JX-001",
      quantity: "5",
      unit_price: "10",
      total: "50",
      order_date: "2026-03-01",
      status: "NEW",
    };

    const first = await importFaireOrders([row]);
    expect(first.imported).toBe(1);

    const second = await importFaireOrders([row]);
    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(1);
  });
});

// ── 4. Account Sync — tier assignment (pure function) ──

describe("Account Sync — tier assignment", () => {
  it("assigns bronze for < $500 LTV and 1 order", () => {
    expect(calculateTier(1, 100)).toBe("bronze");
    expect(calculateTier(1, 499)).toBe("bronze");
    expect(calculateTier(0, 0)).toBe("bronze");
  });

  it("assigns silver for $500-$1999 LTV or 2-4 orders", () => {
    expect(calculateTier(1, 500)).toBe("silver");
    expect(calculateTier(2, 100)).toBe("silver");
    expect(calculateTier(4, 400)).toBe("silver");
    expect(calculateTier(1, 1999)).toBe("silver");
  });

  it("assigns gold for $2000-$4999 LTV or 5+ orders", () => {
    expect(calculateTier(1, 2000)).toBe("gold");
    expect(calculateTier(5, 100)).toBe("gold");
    expect(calculateTier(1, 4999)).toBe("gold");
  });

  it("assigns platinum for $5000+ LTV", () => {
    expect(calculateTier(1, 5000)).toBe("platinum");
    expect(calculateTier(1, 50000)).toBe("platinum");
  });
});

describe("Account Sync — LTV calculation", () => {
  it("calculates LTV and excludes cancelled orders", async () => {
    const { sqlite } = await import("@/lib/db");
    try { sqlite.exec("DELETE FROM orders"); sqlite.exec("DELETE FROM customer_accounts"); sqlite.exec("DELETE FROM companies"); } catch {}

    const compId = crypto.randomUUID();
    sqlite.prepare("INSERT INTO companies (id, name) VALUES (?, ?)").run(compId, "Big Buyer");

    for (let i = 0; i < 3; i++) {
      sqlite.prepare(
        "INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(crypto.randomUUID(), `ORD-${i}`, compId, "direct", "confirmed", 1000, "2026-01-01");
    }
    // Cancelled — should be excluded
    sqlite.prepare(
      "INSERT INTO orders (id, order_number, company_id, channel, status, total, placed_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(crypto.randomUUID(), "ORD-CANCEL", compId, "direct", "cancelled", 500, "2026-01-01");

    const { ensureCustomerAccount } = await import("@/modules/customers/lib/account-sync");
    const accountId = ensureCustomerAccount(compId);

    const account = sqlite.prepare("SELECT * FROM customer_accounts WHERE id = ?").get(accountId) as any;
    expect(account).toBeTruthy();
    expect(account.total_orders).toBe(3);
    expect(account.lifetime_value).toBe(3000);
    expect(account.tier).toBe("gold");
  });

  it("handles company with no orders gracefully", async () => {
    const { sqlite } = await import("@/lib/db");
    try { sqlite.exec("DELETE FROM orders"); sqlite.exec("DELETE FROM customer_accounts"); sqlite.exec("DELETE FROM companies"); } catch {}

    const compId = crypto.randomUUID();
    sqlite.prepare("INSERT INTO companies (id, name) VALUES (?, ?)").run(compId, "New Company");

    const { ensureCustomerAccount } = await import("@/modules/customers/lib/account-sync");
    const accountId = ensureCustomerAccount(compId);

    const account = sqlite.prepare("SELECT * FROM customer_accounts WHERE id = ?").get(accountId) as any;
    expect(account).toBeTruthy();
    expect(account.total_orders).toBe(0);
    expect(account.lifetime_value).toBe(0);
    expect(account.tier).toBe("bronze");
  });
});
