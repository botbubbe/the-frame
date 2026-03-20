import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "the-frame.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const now = new Date().toISOString();

// Seed admin user (Daniel)
db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  "582f8be0-cad3-47f2-8c3e-bc12b5a69c72",
  "daniel@getjaxy.com",
  "Daniel Seeff",
  "owner",
  1,
  now,
  now
);

// Seed Bubbe AI user
db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  "379330f9-28c2-4c83-a285-dd9ddd8d8e69",
  "botbubbe@gmail.com",
  "Bubbe Bot",
  "ai",
  1,
  now,
  now
);

// Seed Christina
db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  crypto.randomUUID(),
  "christina@getjaxy.com",
  "Christina",
  "sales_manager",
  1,
  now,
  now
);

console.log("✅ Seed complete: 3 users created");
db.close();
