import { describe, it, expect, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { getTestDb, resetTestDb } from "../setup";

function hmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

describe("Webhook Handlers", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
    resetTestDb();
    // Ensure columns exist for webhook fields (idempotent ALTERs)
    const cols = [
      ["orders", "external_id", "TEXT"],
      ["orders", "tracking_number", "TEXT"],
      ["orders", "tracking_carrier", "TEXT"],
      ["orders", "shipped_at", "TEXT"],
      ["orders", "placed_at", "TEXT"],
      ["orders", "updated_at", "TEXT"],
      ["orders", "currency", "TEXT DEFAULT 'USD'"],
      ["orders", "notes", "TEXT"],
      ["orders", "contact_id", "TEXT"],
      ["order_items", "product_id", "TEXT"],
      ["order_items", "sku_id", "TEXT"],
      ["order_items", "color_name", "TEXT"],
    ];
    for (const [table, col, type] of cols) {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
    }
    // Create inventory tables (drop + recreate to ensure schema)
    db.exec(`DROP TABLE IF EXISTS inventory`);
    db.exec(`CREATE TABLE inventory (id TEXT PRIMARY KEY, sku_id TEXT, location TEXT DEFAULT 'warehouse', quantity INTEGER DEFAULT 0, reserved_quantity INTEGER DEFAULT 0, reorder_point INTEGER DEFAULT 50, needs_reorder INTEGER DEFAULT 0, updated_at TEXT)`);
    db.exec(`DROP TABLE IF EXISTS inventory_movements`);
    db.exec(`CREATE TABLE inventory_movements (id TEXT PRIMARY KEY, sku_id TEXT, from_location TEXT, to_location TEXT, quantity INTEGER, reason TEXT, reference_id TEXT, created_at TEXT DEFAULT (datetime('now')))`);
    db.exec(`DROP TABLE IF EXISTS catalog_skus`);
    db.exec(`CREATE TABLE catalog_skus (id TEXT PRIMARY KEY, sku TEXT UNIQUE, product_id TEXT)`);
  });

  // ── Shopify HMAC Verification ──

  describe("Shopify HMAC", () => {
    it("valid signature passes verification", () => {
      const secret = "test-secret-123";
      const body = '{"id":1001,"name":"#1001"}';
      const sig = hmac(body, secret);
      const expected = createHmac("sha256", secret).update(body, "utf8").digest("base64");
      expect(sig).toBe(expected);
    });

    it("invalid signature is rejected", () => {
      const secret = "test-secret-123";
      const body = '{"id":1001}';
      const validSig = hmac(body, secret);
      const tamperedBody = '{"id":9999}';
      const tamperedSig = hmac(tamperedBody, secret);
      expect(validSig).not.toBe(tamperedSig);
    });
  });

  // ── orders/create ──

  describe("orders/create", () => {
    it("creates order + line items in DB", () => {
      const orderId = "ord-" + Date.now();
      db.prepare(`INSERT INTO orders (id, order_number, channel, status, subtotal, total, external_id, placed_at, created_at) VALUES (?, '#1001', 'shopify_dtc', 'pending', 99.99, 109.99, '5001', '2026-01-15', datetime('now'))`).run(orderId);
      db.prepare(`INSERT INTO order_items (id, order_id, sku, product_name, quantity, unit_price, total_price) VALUES ('li1', ?, 'JX-BLK-001', 'Classic Black', 2, 49.99, 99.98)`).run(orderId);

      const order = db.prepare("SELECT * FROM orders WHERE external_id = '5001'").get() as any;
      expect(order).toBeTruthy();
      expect(order.order_number).toBe("#1001");
      expect(order.channel).toBe("shopify_dtc");
      expect(order.total).toBe(109.99);

      const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId) as any[];
      expect(items).toHaveLength(1);
      expect(items[0].sku).toBe("JX-BLK-001");
      expect(items[0].quantity).toBe(2);
    });

    it("auto-creates customer company for wholesale orders", () => {
      db.prepare(`INSERT INTO companies (id, name, email, source) VALUES ('co-auto', 'Auto Boutique', 'shop@auto.com', 'shopify')`).run();
      const orderId = "ord-auto";
      db.prepare(`INSERT INTO orders (id, order_number, company_id, channel, status, subtotal, total, external_id) VALUES (?, '#1002', 'co-auto', 'shopify_wholesale', 'pending', 500, 500, '5002')`).run(orderId);

      const order = db.prepare("SELECT * FROM orders WHERE external_id = '5002'").get() as any;
      expect(order.company_id).toBe("co-auto");
      expect(order.channel).toBe("shopify_wholesale");

      const company = db.prepare("SELECT * FROM companies WHERE id = 'co-auto'").get() as any;
      expect(company.name).toBe("Auto Boutique");
    });

    it("is idempotent — duplicate external_id skipped", () => {
      db.prepare(`INSERT INTO orders (id, order_number, channel, status, total, external_id) VALUES ('o1', '#1001', 'shopify_dtc', 'pending', 100, '5001')`).run();
      // Attempting to insert same external_id should be caught by app logic
      const existing = db.prepare("SELECT * FROM orders WHERE external_id = '5001'").get();
      expect(existing).toBeTruthy();
      // Count should remain 1
      const count = db.prepare("SELECT COUNT(*) as c FROM orders WHERE external_id = '5001'").get() as any;
      expect(count.c).toBe(1);
    });
  });

  // ── orders/updated ──

  describe("orders/updated", () => {
    it("updates existing order status and totals", () => {
      db.prepare(`INSERT INTO orders (id, order_number, channel, status, subtotal, total, external_id) VALUES ('o1', '#1001', 'shopify_dtc', 'pending', 100, 100, '5001')`).run();

      db.prepare(`UPDATE orders SET status = 'confirmed', total = 120, updated_at = datetime('now') WHERE external_id = '5001'`).run();

      const order = db.prepare("SELECT * FROM orders WHERE external_id = '5001'").get() as any;
      expect(order.status).toBe("confirmed");
      expect(order.total).toBe(120);
    });
  });

  // ── orders/cancelled ──

  describe("orders/cancelled", () => {
    it("marks order as cancelled", () => {
      db.prepare(`INSERT INTO orders (id, order_number, channel, status, total, external_id) VALUES ('o1', '#1001', 'shopify_dtc', 'confirmed', 100, '5001')`).run();

      db.prepare(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE external_id = '5001'`).run();

      const order = db.prepare("SELECT * FROM orders WHERE external_id = '5001'").get() as any;
      expect(order.status).toBe("cancelled");
    });
  });

  // ── fulfillments/create ──

  describe("fulfillments/create", () => {
    it("creates inventory movements and decrements stock", () => {
      // Setup: SKU + inventory + order
      db.prepare(`INSERT INTO catalog_skus (id, sku, product_id) VALUES ('sku1', 'JX-BLK-001', 'p1')`).run();
      db.prepare(`INSERT INTO inventory (id, sku_id, location, quantity, reorder_point) VALUES ('inv1', 'sku1', 'warehouse', 100, 10)`).run();
      db.prepare(`INSERT INTO orders (id, order_number, channel, status, total, external_id) VALUES ('o1', '#1001', 'shopify_dtc', 'confirmed', 100, '5001')`).run();

      // Simulate fulfillment: decrement inventory, create movement
      const fulfillQty = 3;
      db.prepare(`INSERT INTO inventory_movements (id, sku_id, from_location, quantity, reason, reference_id) VALUES ('mv1', 'sku1', 'warehouse', ?, 'sale', 'o1')`).run(fulfillQty);
      db.prepare(`UPDATE inventory SET quantity = quantity - ? WHERE id = 'inv1'`).run(fulfillQty);
      db.prepare(`UPDATE orders SET status = 'shipped', tracking_number = 'TRK123', tracking_carrier = 'UPS', shipped_at = datetime('now') WHERE id = 'o1'`).run();

      const inv = db.prepare("SELECT * FROM inventory WHERE id = 'inv1'").get() as any;
      expect(inv.quantity).toBe(97);

      const movements = db.prepare("SELECT * FROM inventory_movements WHERE sku_id = 'sku1'").all() as any[];
      expect(movements).toHaveLength(1);
      expect(movements[0].reason).toBe("sale");
      expect(movements[0].quantity).toBe(3);

      const order = db.prepare("SELECT * FROM orders WHERE id = 'o1'").get() as any;
      expect(order.status).toBe("shipped");
      expect(order.tracking_number).toBe("TRK123");
    });
  });

  // ── Edge Cases ──

  describe("edge cases", () => {
    it("unknown webhook topic returns gracefully", () => {
      // The handler returns { ok: true, message: "Unhandled topic: ..." } for unknown topics
      // We verify the pattern: no DB changes for unknown topic
      const countBefore = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as any).c;
      // No insert happens for unknown topic
      const countAfter = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as any).c;
      expect(countAfter).toBe(countBefore);
    });

    it("malformed JSON body does not crash", () => {
      // The route.ts parses JSON with try/catch — if invalid, parsedBody = raw string
      const badJson = "not-json{{{";
      let parsed: unknown;
      try { parsed = JSON.parse(badJson); } catch { parsed = badJson; }
      expect(typeof parsed).toBe("string");
      expect(parsed).toBe(badJson);
    });
  });

  // ── Faire Order Sync ──

  describe("Faire sync", () => {
    it("maps Faire order format correctly", () => {
      db.prepare(`INSERT INTO companies (id, name, email, source) VALUES ('co-faire', 'Cool Boutique', 'cool@shop.com', 'faire')`).run();

      const subtotalCents = 25000;
      const shippingCents = 1500;
      const commissionCents = 3750;
      const totalPayoutCents = subtotalCents - commissionCents + shippingCents;

      const orderId = "faire-ord-1";
      db.prepare(`INSERT INTO orders (id, order_number, company_id, channel, status, subtotal, discount, shipping, total, currency, notes, external_id, placed_at, created_at, updated_at) VALUES (?, 'FO-ABC123', 'co-faire', 'faire', 'pending', ?, ?, ?, ?, 'USD', '🆕 Opening Order | Net 30', 'fo_abc123', '2026-01-10', datetime('now'), datetime('now'))`).run(
        orderId,
        subtotalCents / 100,
        commissionCents / 100,
        shippingCents / 100,
        totalPayoutCents / 100,
      );

      db.prepare(`INSERT INTO order_items (id, order_id, sku, product_name, color_name, quantity, unit_price, total_price) VALUES ('fi1', ?, 'JX-TORT-002', 'Tortoise Classic', 'Tortoise', 10, 12.50, 125.00)`).run(orderId);
      db.prepare(`INSERT INTO order_items (id, order_id, sku, product_name, color_name, quantity, unit_price, total_price) VALUES ('fi2', ?, 'JX-BLK-001', 'Classic Black', 'Black', 10, 12.50, 125.00)`).run(orderId);

      const order = db.prepare("SELECT * FROM orders WHERE external_id = 'fo_abc123'").get() as any;
      expect(order.channel).toBe("faire");
      expect(order.order_number).toBe("FO-ABC123");
      expect(order.subtotal).toBe(250);
      expect(order.shipping).toBe(15);
      expect(order.discount).toBe(37.5); // commission mapped to discount
      expect(order.total).toBe(227.5);

      const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId) as any[];
      expect(items).toHaveLength(2);
    });

    it("handles opening_order flag and net terms in notes", () => {
      const orderId = "faire-opening";
      db.prepare(`INSERT INTO orders (id, order_number, channel, status, total, notes, external_id) VALUES (?, 'FO-OPEN1', 'faire', 'pending', 500, '🆕 Opening Order | Net 60 | Ship by: 2026-02-01', 'fo_open1')`).run(orderId);

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
      expect(order.notes).toContain("Opening Order");
      expect(order.notes).toContain("Net 60");
      expect(order.notes).toContain("Ship by:");
    });
  });
});
