import { NextRequest, NextResponse } from "next/server";
import { exchangeXeroCode } from "@/modules/finance/lib/xero-client";
import { db } from "@/lib/db";
import { settings } from "@/modules/core/schema";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/settings?xero=error&message=" + encodeURIComponent(error), request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings?xero=error&message=no_code", request.url));
  }

  const result = await exchangeXeroCode(code);
  if (!result.success) {
    return NextResponse.redirect(new URL("/settings?xero=error&message=token_exchange_failed", request.url));
  }

  // Store tokens in settings
  const tokenData = result.tokens!;
  const entries = [
    { key: "xero_access_token", value: tokenData.accessToken, type: "string" as const },
    { key: "xero_refresh_token", value: tokenData.refreshToken, type: "string" as const },
    { key: "xero_token_expires_at", value: String(tokenData.expiresAt), type: "string" as const },
    { key: "xero_tenant_id", value: tokenData.tenantId || "", type: "string" as const },
    { key: "xero_tenant_name", value: tokenData.tenantName || "", type: "string" as const },
    { key: "xero_connected_at", value: new Date().toISOString(), type: "string" as const },
  ];

  for (const entry of entries) {
    db.insert(settings)
      .values({ key: entry.key, value: entry.value, type: entry.type, module: "finance" })
      .onConflictDoUpdate({ target: settings.key, set: { value: entry.value, updatedAt: new Date().toISOString() } })
      .run();
  }

  return NextResponse.redirect(new URL("/settings?xero=connected", request.url));
}
