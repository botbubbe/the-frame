import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/get-session";
import { getNavigationForRole } from "@/lib/auth-middleware";
import type { UserRole } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nav = getNavigationForRole(user.role as UserRole);
  return NextResponse.json(nav);
}
