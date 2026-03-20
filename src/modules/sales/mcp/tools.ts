/**
 * F1-012: MCP Tools — Sales Module
 * Registers sales-related MCP tools that reuse existing API/business logic.
 */
import { mcpRegistry } from "@/modules/core/mcp/server";
import { sqlite } from "@/lib/db";
import { z } from "zod";
import { agentOrchestrator } from "@/modules/core/lib/agent-orchestrator";
import { getUnscoredCompanyIds } from "@/modules/sales/agents/icp-classifier";

// ── sales.list_prospects ──
mcpRegistry.register(
  "sales.list_prospects",
  "Search and filter prospects with pagination. Supports FTS search, state/category/status filters, ICP range, email/phone presence.",
  z.object({
    search: z.string().optional().describe("Full-text search query"),
    page: z.number().optional().describe("Page number (default 1)"),
    limit: z.number().optional().describe("Results per page (default 25, max 100)"),
    sort: z.string().optional().describe("Sort column: name, state, city, icp_score, status, created_at"),
    order: z.string().optional().describe("Sort order: asc or desc"),
    state: z.string().optional().describe("Comma-separated state filter"),
    category: z.string().optional().describe("Comma-separated category filter"),
    status: z.string().optional().describe("Comma-separated status filter"),
    icp_min: z.number().optional().describe("Minimum ICP score"),
    icp_max: z.number().optional().describe("Maximum ICP score"),
    has_email: z.string().optional().describe("'true' or 'false'"),
    has_phone: z.string().optional().describe("'true' or 'false'"),
  }),
  async (args) => {
    const page = args.page ?? 1;
    const limit = Math.min(100, Math.max(1, args.limit ?? 25));
    const offset = (page - 1) * limit;
    const sortOrder = args.order === "desc" ? "DESC" : "ASC";

    const sortColumns: Record<string, string> = {
      name: "c.name", state: "c.state", city: "c.city",
      icp_score: "c.icp_score", status: "c.status", created_at: "c.created_at",
    };
    const sortCol = sortColumns[args.sort ?? "name"] ?? "c.name";

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (args.search) {
      try {
        const fts = sqlite.prepare("SELECT rowid FROM companies_fts WHERE companies_fts MATCH ? LIMIT 10000")
          .all(args.search + "*") as { rowid: number }[];
        if (fts.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ data: [], total: 0, page, limit, totalPages: 0 }) }] };
        }
        clauses.push(`c.rowid IN (${fts.map(r => r.rowid).join(",")})`);
      } catch {
        clauses.push("c.name LIKE ?");
        params.push(`%${args.search}%`);
      }
    }

    if (args.state) {
      const states = args.state.split(",").map(s => s.trim());
      clauses.push(`c.state IN (${states.map(() => "?").join(",")})`);
      params.push(...states);
    }
    if (args.category) {
      const cats = args.category.split(",").map(s => s.trim());
      clauses.push(`(${cats.map(() => "c.tags LIKE ?").join(" OR ")})`);
      params.push(...cats.map(c => `%${c}%`));
    }
    if (args.status) {
      const statuses = args.status.split(",").map(s => s.trim());
      clauses.push(`c.status IN (${statuses.map(() => "?").join(",")})`);
      params.push(...statuses);
    }
    if (args.icp_min != null) { clauses.push("c.icp_score >= ?"); params.push(args.icp_min); }
    if (args.icp_max != null) { clauses.push("c.icp_score <= ?"); params.push(args.icp_max); }
    if (args.has_email === "true") clauses.push("c.email IS NOT NULL AND c.email != ''");
    else if (args.has_email === "false") clauses.push("(c.email IS NULL OR c.email = '')");
    if (args.has_phone === "true") clauses.push("c.phone IS NOT NULL AND c.phone != ''");
    else if (args.has_phone === "false") clauses.push("(c.phone IS NULL OR c.phone = '')");

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const total = (sqlite.prepare(`SELECT count(*) as c FROM companies c ${where}`).get(...params) as { c: number }).c;
    const rows = sqlite.prepare(`
      SELECT c.id, c.name, c.city, c.state, c.type, c.source, c.phone, c.email, c.icp_score, c.icp_tier, c.status, c.tags
      FROM companies c ${where} ORDER BY ${sortCol} ${sortOrder} NULLS LAST LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Record<string, unknown>[];

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          data: rows.map(r => ({ ...r, tags: r.tags ? JSON.parse(r.tags as string) : [] })),
          total, page, limit, totalPages: Math.ceil(total / limit),
        }, null, 2),
      }],
    };
  }
);

// ── sales.get_prospect ──
mcpRegistry.register(
  "sales.get_prospect",
  "Get a single company with its stores and contacts",
  z.object({
    id: z.string().describe("Company UUID"),
  }),
  async ({ id }) => {
    const company = sqlite.prepare("SELECT * FROM companies WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!company) {
      return { content: [{ type: "text" as const, text: "Company not found" }], isError: true };
    }
    const stores = sqlite.prepare("SELECT * FROM stores WHERE company_id = ? ORDER BY is_primary DESC, name ASC").all(id);
    const contacts = sqlite.prepare("SELECT * FROM contacts WHERE company_id = ? ORDER BY is_primary DESC, first_name ASC").all(id);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          company: { ...company, tags: company.tags ? JSON.parse(company.tags as string) : [] },
          stores, contacts,
        }, null, 2),
      }],
    };
  }
);

// ── sales.update_prospect ──
mcpRegistry.register(
  "sales.update_prospect",
  "Update company fields (status, icp_tier, owner, tags, notes, etc.)",
  z.object({
    id: z.string().describe("Company UUID"),
    status: z.string().optional().describe("new, contacted, qualified, rejected, customer"),
    icp_tier: z.string().optional().describe("A, B, C, D, or F"),
    icp_score: z.number().optional().describe("ICP score 0-100"),
    owner_id: z.string().optional().describe("Owner user UUID"),
    tags: z.array(z.string()).optional().describe("Replace tags array"),
    notes: z.string().optional().describe("Notes text"),
  }),
  async (args) => {
    const { id, ...fields } = args;
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      if (key === "tags") {
        sets.push("tags = ?");
        values.push(JSON.stringify(val));
      } else {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (sets.length === 0) {
      return { content: [{ type: "text" as const, text: "No fields to update" }], isError: true };
    }

    sets.push("updated_at = datetime('now')");
    values.push(id);
    sqlite.prepare(`UPDATE companies SET ${sets.join(", ")} WHERE id = ?`).run(...values);

    return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, updated: Object.keys(fields).filter(k => fields[k as keyof typeof fields] !== undefined) }) }] };
  }
);

// ── sales.bulk_action ──
mcpRegistry.register(
  "sales.bulk_action",
  "Perform bulk actions on multiple prospects: approve, reject, tag, assign",
  z.object({
    action: z.string().describe("Action: approve, reject, tag, assign"),
    ids: z.array(z.string()).describe("Array of company UUIDs"),
    tag: z.string().optional().describe("Tag name (for 'tag' action)"),
    owner_id: z.string().optional().describe("Owner UUID (for 'assign' action)"),
  }),
  async (args) => {
    const { action, ids } = args;
    if (ids.length === 0) return { content: [{ type: "text" as const, text: "No IDs provided" }], isError: true };

    const now = new Date().toISOString();
    const placeholders = ids.map(() => "?").join(",");
    let affected = 0;

    const run = sqlite.transaction(() => {
      switch (action) {
        case "approve":
          affected = sqlite.prepare(`UPDATE companies SET status = 'qualified', updated_at = ? WHERE id IN (${placeholders})`).run(now, ...ids).changes;
          break;
        case "reject":
          affected = sqlite.prepare(`UPDATE companies SET status = 'rejected', updated_at = ? WHERE id IN (${placeholders})`).run(now, ...ids).changes;
          break;
        case "tag": {
          if (!args.tag) throw new Error("tag required for tag action");
          for (const id of ids) {
            const row = sqlite.prepare("SELECT tags FROM companies WHERE id = ?").get(id) as { tags: string | null } | undefined;
            const existing: string[] = row?.tags ? JSON.parse(row.tags) : [];
            if (!existing.includes(args.tag)) {
              existing.push(args.tag);
              sqlite.prepare("UPDATE companies SET tags = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(existing), now, id);
            }
          }
          affected = ids.length;
          break;
        }
        case "assign":
          if (!args.owner_id) throw new Error("owner_id required for assign action");
          affected = sqlite.prepare(`UPDATE companies SET owner_id = ?, updated_at = ? WHERE id IN (${placeholders})`).run(args.owner_id, now, ...ids).changes;
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    });

    try {
      run();
      return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, action, affected }) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ── sales.import_csv ──
mcpRegistry.register(
  "sales.import_csv",
  "Trigger a CSV import job. Provide the file path to the CSV.",
  z.object({
    csv_path: z.string().describe("Absolute path to CSV file"),
    batch_size: z.number().optional().describe("Batch size (default 500)"),
  }),
  async ({ csv_path, batch_size }) => {
    // Dynamically import to avoid circular deps at module load
    const { importProspectsFromCSV } = await import("@/modules/sales/lib/import-engine");
    try {
      const stats = await importProspectsFromCSV(csv_path, { batchSize: batch_size });
      return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: `Import error: ${(err as Error).message}` }], isError: true };
    }
  }
);

// ── sales.run_icp_classifier ──
mcpRegistry.register(
  "sales.run_icp_classifier",
  "Trigger ICP classification on unscored companies (or specific IDs)",
  z.object({
    company_ids: z.array(z.string()).optional().describe("Specific company UUIDs (omit for all unscored)"),
  }),
  async ({ company_ids }) => {
    let ids = company_ids;
    if (!ids || ids.length === 0) {
      ids = getUnscoredCompanyIds();
      if (ids.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ message: "All companies already classified", count: 0 }) }] };
      }
    }

    if (ids.length <= 100) {
      const result = await agentOrchestrator.runAgentSync("icp-classifier", { companyIds: ids });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }

    const runId = await agentOrchestrator.runAgent("icp-classifier", { companyIds: ids });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ message: `ICP classification started for ${ids.length} companies`, runId, status: "running" }),
      }],
    };
  }
);

// ── sales.get_smart_lists ──
mcpRegistry.register(
  "sales.get_smart_lists",
  "List all saved smart lists with their filters and result counts",
  z.object({}),
  async () => {
    const lists = sqlite.prepare("SELECT * FROM smart_lists ORDER BY is_default DESC, name ASC").all();
    return { content: [{ type: "text" as const, text: JSON.stringify(lists, null, 2) }] };
  }
);
