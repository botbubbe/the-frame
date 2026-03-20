/**
 * Migrate Catalog Tool Database → The Frame
 *
 * Reads from ~/.jaxy-catalog/catalog-tool.db (existing catalog tool)
 * Writes into data/the-frame.db (The Frame)
 *
 * Usage: npx tsx src/scripts/migrate-catalog.ts
 */

import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const SOURCE_PATH = path.join(os.homedir(), ".jaxy-catalog", "catalog-tool.db");
const TARGET_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "data", "the-frame.db");

if (!fs.existsSync(SOURCE_PATH)) {
  console.error(`Source database not found at ${SOURCE_PATH}`);
  process.exit(1);
}

const source = new Database(SOURCE_PATH, { readonly: true });
const target = new Database(TARGET_PATH);

// Ensure WAL mode on target
target.pragma("journal_mode = WAL");
target.pragma("foreign_keys = OFF"); // Temporarily disable for migration order

// Table mapping: source table → target table
const TABLE_MAP: Record<string, string> = {
  purchase_orders: "catalog_purchase_orders",
  products: "catalog_products",
  skus: "catalog_skus",
  image_types: "catalog_image_types",
  images: "catalog_images",
  tags: "catalog_tags",
  name_options: "catalog_name_options",
  notes: "catalog_notes",
  exports: "catalog_exports",
  copy_versions: "catalog_copy_versions",
};

// Migration order (respects foreign keys)
const MIGRATION_ORDER = [
  "purchase_orders",
  "products",
  "skus",
  "image_types",
  "images",
  "tags",
  "name_options",
  "notes",
  "exports",
  "copy_versions",
];

// Create target tables
function createTables() {
  target.exec(`
    CREATE TABLE IF NOT EXISTS catalog_purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE,
      supplier TEXT,
      order_date TEXT,
      notes TEXT,
      status TEXT DEFAULT 'ordered',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS catalog_products (
      id TEXT PRIMARY KEY,
      sku_prefix TEXT UNIQUE,
      name TEXT,
      description TEXT,
      short_description TEXT,
      bullet_points TEXT,
      category TEXT,
      frame_shape TEXT,
      frame_material TEXT,
      gender TEXT,
      lens_type TEXT,
      wholesale_price REAL,
      retail_price REAL,
      msrp REAL,
      purchase_order_id TEXT REFERENCES catalog_purchase_orders(id),
      factory_name TEXT,
      factory_sku TEXT,
      seo_title TEXT,
      meta_description TEXT,
      status TEXT DEFAULT 'intake',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS catalog_skus (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES catalog_products(id),
      sku TEXT UNIQUE,
      color_name TEXT,
      color_hex TEXT,
      size TEXT,
      upc TEXT,
      weight_oz REAL,
      cost_price REAL,
      wholesale_price REAL,
      retail_price REAL,
      in_stock INTEGER DEFAULT 1,
      raw_image_filename TEXT,
      seo_title TEXT,
      meta_description TEXT,
      twelve_pack_sku TEXT,
      twelve_pack_upc TEXT,
      status TEXT DEFAULT 'intake',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS catalog_image_types (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE,
      label TEXT,
      aspect_ratio TEXT,
      min_width INTEGER,
      min_height INTEGER,
      platform TEXT DEFAULT 'all',
      description TEXT,
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS catalog_images (
      id TEXT PRIMARY KEY,
      sku_id TEXT NOT NULL REFERENCES catalog_skus(id),
      file_path TEXT,
      image_type_id TEXT REFERENCES catalog_image_types(id),
      position INTEGER DEFAULT 0,
      alt_text TEXT,
      width INTEGER,
      height INTEGER,
      ai_model_used TEXT,
      ai_prompt TEXT,
      status TEXT DEFAULT 'draft',
      is_best INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS catalog_tags (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES catalog_products(id),
      tag_name TEXT,
      dimension TEXT,
      source TEXT
    );
    CREATE TABLE IF NOT EXISTS catalog_name_options (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES catalog_products(id),
      name TEXT,
      selected INTEGER DEFAULT 0,
      ai_generated INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS catalog_notes (
      id TEXT PRIMARY KEY,
      entity_type TEXT,
      entity_id TEXT,
      author TEXT DEFAULT 'admin',
      text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS catalog_exports (
      id TEXT PRIMARY KEY,
      platform TEXT,
      file_path TEXT,
      product_count INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      created_by TEXT DEFAULT 'admin'
    );
    CREATE TABLE IF NOT EXISTS catalog_copy_versions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES catalog_products(id),
      field_name TEXT,
      content TEXT,
      ai_model TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function migrateTable(sourceTable: string, targetTable: string): number {
  const rows = source.prepare(`SELECT * FROM ${sourceTable}`).all();
  if (rows.length === 0) return 0;

  // Clear target first (idempotent)
  target.prepare(`DELETE FROM ${targetTable}`).run();

  // Get target columns to only copy matching ones
  const targetCols = (target.prepare(`PRAGMA table_info(${targetTable})`).all() as { name: string }[]).map((c) => c.name);
  const sourceCols = Object.keys(rows[0] as Record<string, unknown>);
  const columns = sourceCols.filter((c) => targetCols.includes(c));

  const placeholders = columns.map(() => "?").join(", ");
  const colNames = columns.join(", ");

  const insert = target.prepare(`INSERT INTO ${targetTable} (${colNames}) VALUES (${placeholders})`);

  const tx = target.transaction((data: Record<string, unknown>[]) => {
    for (const row of data) {
      insert.run(...columns.map((c) => (row as Record<string, unknown>)[c]));
    }
  });

  tx(rows as Record<string, unknown>[]);
  return rows.length;
}

// Run
console.log("=== Catalog Tool → The Frame Migration ===\n");
console.log(`Source: ${SOURCE_PATH}`);
console.log(`Target: ${TARGET_PATH}\n`);

createTables();

const stats: Record<string, number> = {};

for (const table of MIGRATION_ORDER) {
  const targetTable = TABLE_MAP[table];
  const count = migrateTable(table, targetTable);
  stats[table] = count;
  console.log(`  ${table} → ${targetTable}: ${count} rows`);
}

// Re-enable foreign keys
target.pragma("foreign_keys = ON");

// Verify
console.log("\n=== Verification ===\n");
for (const table of MIGRATION_ORDER) {
  const targetTable = TABLE_MAP[table];
  const sourceCount = (source.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
  const targetCount = (target.prepare(`SELECT COUNT(*) as c FROM ${targetTable}`).get() as { c: number }).c;
  const match = sourceCount === targetCount ? "✅" : "❌ MISMATCH";
  console.log(`  ${table}: ${sourceCount} → ${targetCount} ${match}`);
}

source.close();
target.close();

console.log("\n✅ Migration complete!");
