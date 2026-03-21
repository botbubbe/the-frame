/**
 * Marketing Module MCP Tools
 */
import { sqlite } from "@/lib/db";
import type { McpTool } from "@/modules/core/mcp/server";
import { generateContentIdeas } from "../agents/content-idea-generator";
import { analyzeContent } from "../agents/seo-optimizer";

export const marketingMcpTools: McpTool[] = [
  {
    name: "marketing.list_content",
    description: "List content calendar items with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["idea", "planned", "draft", "scheduled", "published"] },
        platform: { type: "string" },
        limit: { type: "number", default: 25 },
      },
    },
    handler: async (input: Record<string, unknown>) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (input.status) { conditions.push("status = ?"); params.push(input.status); }
      if (input.platform) { conditions.push("platform = ?"); params.push(input.platform); }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const limit = (input.limit as number) || 25;
      const rows = sqlite.prepare(`SELECT * FROM content_calendar ${where} ORDER BY scheduled_date DESC LIMIT ?`).all(...params, limit);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  },
  {
    name: "marketing.add_content",
    description: "Add a new content calendar item",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        type: { type: "string", enum: ["blog", "social", "email", "ad"] },
        platform: { type: "string" },
        scheduled_date: { type: "string" },
        content: { type: "string" },
      },
      required: ["title", "type", "platform"],
    },
    handler: async (input: Record<string, unknown>) => {
      const id = crypto.randomUUID();
      sqlite.prepare(
        "INSERT INTO content_calendar (id, title, type, platform, status, scheduled_date, content, created_at) VALUES (?, ?, ?, ?, 'idea', ?, ?, datetime('now'))"
      ).run(id, input.title, input.type, input.platform, input.scheduled_date || null, input.content || null);
      return { content: [{ type: "text", text: `Created content item ${id}: ${input.title}` }] };
    },
  },
  {
    name: "marketing.get_seo_rankings",
    description: "Get current SEO keyword rankings",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const rows = sqlite.prepare("SELECT * FROM seo_rankings ORDER BY current_rank ASC LIMIT 50").all();
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  },
  {
    name: "marketing.list_influencers",
    description: "List tracked influencers",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string" } },
    },
    handler: async (input: Record<string, unknown>) => {
      const where = input.status ? "WHERE status = ?" : "";
      const params = input.status ? [input.status] : [];
      const rows = sqlite.prepare(`SELECT * FROM influencers ${where} ORDER BY followers DESC`).all(...params);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    },
  },
  {
    name: "marketing.get_ad_stats",
    description: "Get ad campaign performance stats",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const rows = sqlite.prepare("SELECT * FROM ad_campaigns ORDER BY start_date DESC").all();
      const totalSpend = rows.reduce((sum: number, r: Record<string, unknown>) => sum + ((r.spend as number) || 0), 0);
      const totalRevenue = rows.reduce((sum: number, r: Record<string, unknown>) => sum + ((r.revenue as number) || 0), 0);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ campaigns: rows, summary: { totalSpend, totalRevenue, roas: totalSpend > 0 ? totalRevenue / totalSpend : 0 } }, null, 2),
        }],
      };
    },
  },
  {
    name: "marketing.generate_ideas",
    description: "Generate content ideas based on trends and calendar",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const ideas = await generateContentIdeas();
      return { content: [{ type: "text", text: JSON.stringify(ideas, null, 2) }] };
    },
  },
  {
    name: "marketing.analyze_seo",
    description: "Analyze content for SEO quality",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        metaDescription: { type: "string" },
        targetKeyword: { type: "string" },
      },
      required: ["title", "body"],
    },
    handler: async (input: Record<string, unknown>) => {
      const analysis = analyzeContent({
        title: input.title as string,
        body: input.body as string,
        metaDescription: input.metaDescription as string | undefined,
        targetKeyword: input.targetKeyword as string | undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
    },
  },
];
