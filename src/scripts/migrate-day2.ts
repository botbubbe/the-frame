/**
 * Day 2 Migration: smart_lists + agent_runs tables + seed default smart lists
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), "data", "the-frame.db");
const sqlite = new Database(DB_PATH);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// ── Create smart_lists table ──
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS smart_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    filters TEXT NOT NULL DEFAULT '{}',
    owner_id TEXT REFERENCES users(id),
    is_shared INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    result_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Create agent_runs table ──
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    module TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input TEXT,
    output TEXT,
    tokens_used INTEGER,
    cost INTEGER,
    duration_ms INTEGER,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );
`);

// ── Seed default smart lists ──
const defaults = [
  {
    name: "Outreach Ready",
    description: "Companies with email and qualified status — ready for outreach",
    filters: JSON.stringify({ has_email: "true", status: ["qualified"] }),
  },
  {
    name: "High ICP Boutiques",
    description: "Boutiques with ICP score 80+",
    filters: JSON.stringify({ category: ["boutique"], icp_min: "80" }),
  },
  {
    name: "California Prospects",
    description: "All prospects in California",
    filters: JSON.stringify({ state: ["CA"] }),
  },
  {
    name: "Needs Enrichment",
    description: "Companies missing email and phone — need data enrichment",
    filters: JSON.stringify({ has_email: "false", has_phone: "false" }),
  },
  {
    name: "Car Wash Segment",
    description: "Prospects from car wash data sources",
    filters: JSON.stringify({ source: ["car-wash"] }),
  },
];

const insert = sqlite.prepare(`
  INSERT OR IGNORE INTO smart_lists (id, name, description, filters, is_shared, is_default, result_count)
  VALUES (?, ?, ?, ?, 1, 1, 0)
`);

for (const d of defaults) {
  insert.run(crypto.randomUUID(), d.name, d.description, d.filters);
}

// ── Update result counts for all smart lists ──
// We'll do this by running the filter queries
function countForFilters(filters: Record<string, unknown>): number {
  const clauses: string[] = [];
  const params: unknown[] = [];

  const stateArr = filters.state as string[] | undefined;
  if (stateArr?.length) {
    clauses.push(`state IN (${stateArr.map(() => "?").join(",")})`);
    params.push(...stateArr);
  }

  const catArr = filters.category as string[] | undefined;
  if (catArr?.length) {
    clauses.push(`(${catArr.map(() => "tags LIKE ?").join(" OR ")})`);
    params.push(...catArr.map(c => `%${c}%`));
  }

  const srcArr = filters.source as string[] | undefined;
  if (srcArr?.length) {
    clauses.push(`(${srcArr.map(() => "source LIKE ?").join(" OR ")})`);
    params.push(...srcArr.map(s => `%${s}%`));
  }

  const statusArr = filters.status as string[] | undefined;
  if (statusArr?.length) {
    clauses.push(`status IN (${statusArr.map(() => "?").join(",")})`);
    params.push(...statusArr);
  }

  if (filters.icp_min) {
    clauses.push(`icp_score >= ?`);
    params.push(Number(filters.icp_min));
  }
  if (filters.icp_max) {
    clauses.push(`icp_score <= ?`);
    params.push(Number(filters.icp_max));
  }

  if (filters.has_email === "true") clauses.push(`email IS NOT NULL AND email != ''`);
  else if (filters.has_email === "false") clauses.push(`(email IS NULL OR email = '')`);

  if (filters.has_phone === "true") clauses.push(`phone IS NOT NULL AND phone != ''`);
  else if (filters.has_phone === "false") clauses.push(`(phone IS NULL OR phone = '')`);

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const row = sqlite.prepare(`SELECT count(*) as c FROM companies ${where}`).get(...params) as { c: number };
  return row.c;
}

const allLists = sqlite.prepare("SELECT id, filters FROM smart_lists").all() as { id: string; filters: string }[];
const updateCount = sqlite.prepare("UPDATE smart_lists SET result_count = ?, updated_at = datetime('now') WHERE id = ?");

for (const list of allLists) {
  try {
    const filters = JSON.parse(list.filters);
    const count = countForFilters(filters);
    updateCount.run(count, list.id);
  } catch {
    // skip invalid filters
  }
}

console.log("✅ Day 2 migration complete");
console.log(`   - smart_lists table created with ${allLists.length} default lists`);
console.log("   - agent_runs table created");

sqlite.close();
