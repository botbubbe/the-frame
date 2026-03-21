/**
 * Settlement API handlers
 */

import { db } from "@/lib/db";
import { settlements, settlementLineItems } from "@/modules/finance/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export async function listSettlements(params: {
  channel?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const { channel, status, dateFrom, dateTo, page = 1, limit = 25 } = params;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (channel) conditions.push(eq(settlements.channel, channel as "shopify_dtc"));
  if (status) conditions.push(eq(settlements.status, status as "pending"));
  if (dateFrom) conditions.push(gte(settlements.periodStart, dateFrom));
  if (dateTo) conditions.push(lte(settlements.periodEnd, dateTo));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(settlements).where(where).orderBy(desc(settlements.periodEnd)).limit(limit).offset(offset).all(),
    db.select({ count: sql<number>`count(*)` }).from(settlements).where(where).get(),
  ]);

  return { settlements: data, total: countResult?.count || 0, page, limit };
}

export async function getSettlement(id: string) {
  const settlement = db.select().from(settlements).where(eq(settlements.id, id)).get();
  if (!settlement) return null;

  const lineItems = db.select().from(settlementLineItems).where(eq(settlementLineItems.settlementId, id)).all();

  return { ...settlement, lineItems };
}

export async function updateSettlementStatus(id: string, status: "pending" | "received" | "reconciled") {
  db.update(settlements).set({ status }).where(eq(settlements.id, id)).run();
}
