import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-middleware";
import {
  getXeroConnectionStatus,
  getXeroAuthUrl,
  disconnectXero,
  syncSettlementToXero,
  getChartOfAccounts,
  isXeroConfigured,
  getXeroSetupInstructions,
} from "@/modules/finance/lib/xero-client";

// GET /api/v1/finance/xero — connection status + auth URL
export const GET = apiHandler(async () => {
  const status = getXeroConnectionStatus();
  const configured = isXeroConfigured();
  const authUrl = configured ? getXeroAuthUrl() : null;

  return NextResponse.json({
    configured,
    ...status,
    authUrl,
    setupInstructions: configured ? undefined : getXeroSetupInstructions(),
  });
}, { auth: true, roles: ["owner", "finance"] });

// POST /api/v1/finance/xero — actions: sync, disconnect, chart-of-accounts
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { action, settlementId } = body;

  switch (action) {
    case "sync": {
      if (!settlementId) return NextResponse.json({ error: "settlementId required" }, { status: 400 });
      const result = await syncSettlementToXero(settlementId);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    case "chart-of-accounts": {
      const result = await getChartOfAccounts();
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    case "disconnect": {
      disconnectXero();
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}, { auth: true, roles: ["owner", "finance"], audit: true });
