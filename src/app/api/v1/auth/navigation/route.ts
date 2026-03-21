import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNavigationForRole } from "@/lib/auth-middleware";
import type { UserRole } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nav = getNavigationForRole(session.user.role as UserRole);
  return NextResponse.json(nav);
}
