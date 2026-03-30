export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const updates: { id: string; status: string; disqualify_reason?: string; segment?: string }[] = body.updates;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates array required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const statusStmt = sqlite.prepare(
    `UPDATE companies SET status = ?, disqualify_reason = ?, updated_at = ? WHERE id = ?`
  );
  const segmentStmt = sqlite.prepare(
    `UPDATE companies SET segment = ?, updated_at = ? WHERE id = ?`
  );

  const transaction = sqlite.transaction(() => {
    for (const u of updates) {
      if (u.status) {
        statusStmt.run(u.status, u.disqualify_reason || null, now, u.id);
      }
      if (u.segment !== undefined) {
        segmentStmt.run(u.segment || null, now, u.id);
      }
    }
  });

  transaction();

  return NextResponse.json({ success: true, updated: updates.length });
}
