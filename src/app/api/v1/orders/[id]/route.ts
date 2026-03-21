import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, returns } from "@/modules/orders/schema";
import { companies, contacts } from "@/modules/sales/schema";
import { activityFeed } from "@/modules/core/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/v1/orders/:id — order detail
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = db.select().from(orderItems).where(eq(orderItems.orderId, id)).all();
  const orderReturns = db.select().from(returns).where(eq(returns.orderId, id)).all();

  const company = order.companyId
    ? db.select().from(companies).where(eq(companies.id, order.companyId)).get()
    : null;
  const contact = order.contactId
    ? db.select().from(contacts).where(eq(contacts.id, order.contactId)).get()
    : null;

  // Activity timeline
  const timeline = db
    .select()
    .from(activityFeed)
    .where(eq(activityFeed.entityId, id))
    .orderBy(desc(activityFeed.createdAt))
    .all();

  return NextResponse.json({
    ...order,
    company,
    contact,
    items,
    returns: orderReturns,
    timeline,
  });
}

// PATCH /api/v1/orders/:id — update order
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const order = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.status) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.trackingNumber) updates.trackingNumber = body.trackingNumber;
  if (body.trackingCarrier) updates.trackingCarrier = body.trackingCarrier;
  if (body.status === "shipped" && !order.shippedAt) updates.shippedAt = new Date().toISOString();
  if (body.status === "delivered" && !order.deliveredAt) updates.deliveredAt = new Date().toISOString();

  db.update(orders).set(updates).where(eq(orders.id, id)).run();

  return NextResponse.json(db.select().from(orders).where(eq(orders.id, id)).get());
}
