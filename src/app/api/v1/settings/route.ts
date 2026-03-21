import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/modules/core/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = db.select().from(settings).all();
    const result: Record<string, string | null> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[settings] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    db.insert(settings)
      .values({
        key,
        value: String(value ?? ""),
        type: "string",
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: String(value ?? ""),
          updatedAt: new Date().toISOString(),
        },
      })
      .run();

    return NextResponse.json({ ok: true, key, value });
  } catch (error) {
    console.error("[settings] PUT error:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
