export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import path from "path";
import fs from "fs";

// Load StoreMapper account classification data
let accountClassification: Record<string, { industry: string; relevant: boolean; samples?: string[] }> = {};
try {
  const classPath = path.join(
    process.env.HOME || "/Users/bubbe",
    "Library/CloudStorage/Dropbox/Obsidian/jaxy/sales/prospect-data/storemapper-account-classification.json"
  );
  if (fs.existsSync(classPath)) {
    accountClassification = JSON.parse(fs.readFileSync(classPath, "utf-8"));
  }
} catch { /* classification file not available */ }

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sourceTypeFilter = params.get("source_type");

  // Get all unique source_type + source_id combinations with counts
  const whereClauses: string[] = [];
  const whereParams: unknown[] = [];

  if (sourceTypeFilter) {
    whereClauses.push("c.source_type = ?");
    whereParams.push(sourceTypeFilter);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sources = sqlite.prepare(`
    SELECT 
      c.source_type,
      c.source_id,
      c.source_query,
      count(*) as prospect_count,
      count(CASE WHEN c.status = 'qualified' THEN 1 END) as qualified_count,
      count(CASE WHEN c.status = 'rejected' THEN 1 END) as rejected_count,
      count(CASE WHEN c.status = 'new' THEN 1 END) as new_count
    FROM companies c
    ${whereSQL}
    GROUP BY c.source_type, c.source_id
    ORDER BY prospect_count DESC
  `).all(...whereParams) as {
    source_type: string | null;
    source_id: string | null;
    source_query: string | null;
    prospect_count: number;
    qualified_count: number;
    rejected_count: number;
    new_count: number;
  }[];

  // Enrich with StoreMapper classification data
  const enrichedSources = sources.map(s => {
    const classification = s.source_type === "storemapper" && s.source_id
      ? accountClassification[s.source_id] || null
      : null;

    return {
      ...s,
      industry: classification?.industry || null,
      relevant: classification?.relevant ?? null,
      samples: classification?.samples?.slice(0, 3) || null,
    };
  });

  // Summary stats
  const summary = {
    total_sources: sources.length,
    total_prospects: sources.reduce((sum, s) => sum + s.prospect_count, 0),
    by_type: {} as Record<string, { count: number; prospect_count: number }>,
  };

  for (const s of sources) {
    const type = s.source_type || "unknown";
    if (!summary.by_type[type]) summary.by_type[type] = { count: 0, prospect_count: 0 };
    summary.by_type[type].count++;
    summary.by_type[type].prospect_count += s.prospect_count;
  }

  return NextResponse.json({ data: enrichedSources, summary });
}

// Bulk actions by source
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, source_type, source_id } = body as {
    action: "approve_all" | "reject_all";
    source_type: string;
    source_id: string | null;
  };

  if (!action || !source_type) {
    return NextResponse.json({ error: "action and source_type required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const whereClauses = ["source_type = ?"];
  const whereParams: unknown[] = [source_type];

  if (source_id !== null && source_id !== undefined) {
    whereClauses.push("source_id = ?");
    whereParams.push(source_id);
  } else {
    whereClauses.push("source_id IS NULL");
  }

  const whereSQL = whereClauses.join(" AND ");

  let affected = 0;

  if (action === "approve_all") {
    const result = sqlite.prepare(
      `UPDATE companies SET status = 'qualified', updated_at = ? WHERE ${whereSQL} AND status != 'qualified'`
    ).run(now, ...whereParams);
    affected = result.changes;
  } else if (action === "reject_all") {
    const result = sqlite.prepare(
      `UPDATE companies SET status = 'rejected', disqualify_reason = 'Bulk rejected by source', updated_at = ? WHERE ${whereSQL} AND status != 'rejected'`
    ).run(now, ...whereParams);
    affected = result.changes;
  }

  // Log
  sqlite.prepare(`
    INSERT INTO change_logs (id, entity_type, entity_id, field, old_value, new_value, source, request_id)
    VALUES (?, 'company', 'bulk_source', 'bulk_source_action', NULL, ?, 'api', ?)
  `).run(crypto.randomUUID(), JSON.stringify({ action, source_type, source_id, affected }), crypto.randomUUID());

  return NextResponse.json({ success: true, affected });
}
