import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-middleware";
import { jobQueue } from "@/modules/core/lib/job-queue";
import { agentOrchestrator } from "@/modules/core/lib/agent-orchestrator";

// POST /api/v1/jobs/schedule — create a recurring job
export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { type, module, input = {}, priority, recurring, scheduledFor } = body;

  if (!type || !module) {
    return NextResponse.json({ error: "type and module are required" }, { status: 400 });
  }

  // Validate recurring format
  if (recurring && !["hourly", "daily", "weekly", "monthly"].includes(recurring)) {
    // Also allow cron expressions
    if (!/^[\d*\/,\-\s]+$/.test(recurring)) {
      return NextResponse.json({ error: "Invalid recurring format. Use: hourly, daily, weekly, monthly, or a cron expression" }, { status: 400 });
    }
  }

  const jobId = jobQueue.enqueue(type, module, input, {
    priority,
    scheduledFor,
    recurring,
  });

  return NextResponse.json({ jobId, status: "scheduled" });
}, { auth: true, roles: ["owner", "ai"] });

// GET /api/v1/jobs/schedule — list agents available for scheduling
export const GET = apiHandler(async () => {
  const agents = agentOrchestrator.listAgents();
  return NextResponse.json({ agents });
}, { auth: true });
