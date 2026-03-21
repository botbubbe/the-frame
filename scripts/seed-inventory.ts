/**
 * Seed inventory tables: factories, inventory records for all 112 SKUs
 * Run: npx tsx scripts/seed-inventory.ts
 */
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "data", "the-frame.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Create tables ──
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_factories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    production_lead_days INTEGER NOT NULL DEFAULT 30,
    transit_lead_days INTEGER NOT NULL DEFAULT 25,
    moq INTEGER DEFAULT 300,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL REFERENCES catalog_skus(id),
    location TEXT NOT NULL DEFAULT 'warehouse',
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 50,
    sell_through_weekly REAL DEFAULT 0,
    days_of_stock REAL DEFAULT 0,
    reorder_date TEXT,
    needs_reorder INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_inventory_sku_id ON inventory(sku_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location);
  CREATE INDEX IF NOT EXISTS idx_inventory_needs_reorder ON inventory(needs_reorder);

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL REFERENCES catalog_skus(id),
    from_location TEXT,
    to_location TEXT,
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_movements_sku_id ON inventory_movements(sku_id);
  CREATE INDEX IF NOT EXISTS idx_movements_created_at ON inventory_movements(created_at);

  CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
    id TEXT PRIMARY KEY,
    po_number TEXT NOT NULL UNIQUE,
    factory_id TEXT NOT NULL REFERENCES inventory_factories(id),
    status TEXT NOT NULL DEFAULT 'draft',
    total_units INTEGER NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    order_date TEXT,
    expected_ship_date TEXT,
    expected_arrival_date TEXT,
    actual_arrival_date TEXT,
    tracking_number TEXT,
    tracking_carrier TEXT,
    shipping_cost REAL DEFAULT 0,
    duties_cost REAL DEFAULT 0,
    freight_cost REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory_po_line_items (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
    sku_id TEXT NOT NULL REFERENCES catalog_skus(id),
    quantity INTEGER NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON inventory_po_line_items(po_id);

  CREATE TABLE IF NOT EXISTS inventory_qc_inspections (
    id TEXT PRIMARY KEY,
    po_id TEXT NOT NULL REFERENCES inventory_purchase_orders(id),
    inspector TEXT,
    inspection_date TEXT,
    total_units INTEGER NOT NULL DEFAULT 0,
    defect_count INTEGER NOT NULL DEFAULT 0,
    defect_rate REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

console.log("✅ Tables created");

// ── Seed factories ──
const factoryData = [
  { code: "JX1", name: "Taga", contactName: "Li Wei", contactEmail: "liwei@taga-optical.cn", contactPhone: "+86-577-8888-1001", prodDays: 30, transitDays: 25, moq: 300 },
  { code: "JX2", name: "Huide", contactName: "Zhang Ming", contactEmail: "zhang@huide-eyewear.cn", contactPhone: "+86-577-8888-2002", prodDays: 35, transitDays: 25, moq: 500 },
  { code: "JX3", name: "Geya", contactName: "Chen Fang", contactEmail: "chenfang@geya-optical.cn", contactPhone: "+86-577-8888-3003", prodDays: 28, transitDays: 25, moq: 200 },
  { code: "JX4", name: "Brilliant Vision", contactName: "Wang Hua", contactEmail: "wang@brilliantvision.cn", contactPhone: "+86-577-8888-4004", prodDays: 32, transitDays: 25, moq: 400 },
];

// Clear existing
db.exec("DELETE FROM inventory_qc_inspections");
db.exec("DELETE FROM inventory_po_line_items");
db.exec("DELETE FROM inventory_purchase_orders");
db.exec("DELETE FROM inventory_movements");
db.exec("DELETE FROM inventory");
db.exec("DELETE FROM inventory_factories");

const insertFactory = db.prepare(`
  INSERT INTO inventory_factories (id, code, name, contact_name, contact_email, contact_phone, production_lead_days, transit_lead_days, moq)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const factoryIds: Record<string, string> = {};
for (const f of factoryData) {
  const fId = crypto.randomUUID();
  factoryIds[f.code] = fId;
  insertFactory.run(fId, f.code, f.name, f.contactName, f.contactEmail, f.contactPhone, f.prodDays, f.transitDays, f.moq);
}
console.log("✅ 4 factories seeded");

// ── Seed inventory for all SKUs ──
const allSkus = db.prepare("SELECT id, sku FROM catalog_skus").all() as Array<{ id: string; sku: string }>;

const insertInventory = db.prepare(`
  INSERT INTO inventory (id, sku_id, location, quantity, reserved_quantity, reorder_point, sell_through_weekly, days_of_stock, needs_reorder)
  VALUES (?, ?, 'warehouse', ?, ?, ?, ?, ?, ?)
`);

let lowCount = 0;
let outCount = 0;
for (const sku of allSkus) {
  const rand = Math.random();
  let qty: number;
  let sellThrough: number;

  // Mix of stock levels
  if (rand < 0.08) {
    qty = 0; // out of stock
    outCount++;
  } else if (rand < 0.2) {
    qty = Math.floor(Math.random() * 30) + 5; // low stock
    lowCount++;
  } else if (rand < 0.85) {
    qty = Math.floor(Math.random() * 200) + 50; // normal
  } else {
    qty = Math.floor(Math.random() * 500) + 300; // overstocked
  }

  // Sell-through: varies by "popularity"
  const popularity = Math.random();
  if (popularity < 0.15) {
    sellThrough = Math.round((Math.random() * 2 + 0.5) * 10) / 10; // slow: 0.5-2.5/week
  } else if (popularity < 0.7) {
    sellThrough = Math.round((Math.random() * 8 + 3) * 10) / 10; // normal: 3-11/week
  } else {
    sellThrough = Math.round((Math.random() * 20 + 10) * 10) / 10; // fast: 10-30/week
  }

  const daysOfStock = sellThrough > 0 ? Math.round((qty / sellThrough) * 7 * 10) / 10 : 9999;
  const reorderPoint = Math.max(Math.round(sellThrough * 8), 20); // ~8 weeks of stock as reorder point
  const factoryCode = sku.sku.substring(0, 3); // JX1, JX2, etc.
  const factory = factoryData.find(f => f.code === factoryCode) || factoryData[0];
  const leadTimeDays = factory.prodDays + factory.transitDays;
  
  // needs reorder if days of stock <= lead time + 7
  const needsReorder = daysOfStock <= (leadTimeDays + 7) ? 1 : 0;
  const reserved = qty > 10 ? Math.floor(Math.random() * Math.min(qty * 0.2, 20)) : 0;

  insertInventory.run(
    crypto.randomUUID(),
    sku.id,
    qty,
    reserved,
    reorderPoint,
    sellThrough,
    daysOfStock,
    needsReorder
  );
}

console.log(`✅ ${allSkus.length} inventory records seeded (${outCount} out of stock, ${lowCount} low stock)`);

// ── Seed a few sample POs ──
const insertPO = db.prepare(`
  INSERT INTO inventory_purchase_orders (id, po_number, factory_id, status, total_units, total_cost, order_date, expected_ship_date, expected_arrival_date, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const samplePOs = [
  { num: "PO-2026-001", factory: "JX1", status: "complete", units: 1200, cost: 8400, orderDate: "2025-11-15", shipDate: "2025-12-15", arrivalDate: "2026-01-09", notes: "Initial launch order" },
  { num: "PO-2026-002", factory: "JX2", status: "in_transit", units: 800, cost: 6400, orderDate: "2026-01-20", shipDate: "2026-02-24", arrivalDate: "2026-03-21", notes: "Q1 restock" },
  { num: "PO-2026-003", factory: "JX3", status: "in_production", units: 600, cost: 4200, orderDate: "2026-02-10", shipDate: "2026-03-10", arrivalDate: "2026-04-04", notes: "Spring collection" },
  { num: "PO-2026-004", factory: "JX4", status: "draft", units: 1500, cost: 12000, orderDate: "2026-03-15", shipDate: null, arrivalDate: null, notes: "Summer restock planning" },
];

for (const po of samplePOs) {
  insertPO.run(
    crypto.randomUUID(),
    po.num,
    factoryIds[po.factory],
    po.status,
    po.units,
    po.cost,
    po.orderDate,
    po.shipDate,
    po.arrivalDate,
    po.notes
  );
}
console.log("✅ 4 sample POs seeded");

db.close();
console.log("🎉 Inventory seed complete!");
