export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { socialPosts, socialAccounts } from "@/modules/marketing/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const posts = db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt)).all();
    const accounts = db.select().from(socialAccounts).all();

    // Seed default accounts if empty
    if (accounts.length === 0) {
      const defaults = [
        { platform: "instagram" as const, handle: "@getjaxy", followers: 12400, posts: 234, engagementRate: 3.8, growth: 2.1 },
        { platform: "tiktok" as const, handle: "@jaxyeyewear", followers: 8200, posts: 89, engagementRate: 5.4, growth: 4.7 },
        { platform: "pinterest" as const, handle: "jaxyeyewear", followers: 3100, posts: 156, engagementRate: 2.1, growth: 1.8 },
      ];
      for (const a of defaults) {
        db.insert(socialAccounts).values({ id: crypto.randomUUID(), ...a }).run();
      }
      const seeded = db.select().from(socialAccounts).all();
      return NextResponse.json({ posts, accounts: seeded });
    }

    return NextResponse.json({ posts, accounts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, platform, scheduledDate } = body;
    if (!content || !platform) return NextResponse.json({ error: "content and platform required" }, { status: 400 });

    const id = crypto.randomUUID();
    db.insert(socialPosts).values({
      id, content, platform,
      status: scheduledDate ? "scheduled" : "draft",
      scheduledDate: scheduledDate || null,
    }).run();

    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    db.delete(socialPosts).where(eq(socialPosts.id, id)).run();
    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, followers, engagementRate, growth } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    db.update(socialAccounts).set({
      ...(followers !== undefined && { followers }),
      ...(engagementRate !== undefined && { engagementRate }),
      ...(growth !== undefined && { growth }),
    }).where(eq(socialAccounts.id, id)).run();
    return NextResponse.json({ updated: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
