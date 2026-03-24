export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { batchEnrich } from "@/modules/sales/lib/enrichment";

/**
 * POST /api/v1/prospects/enrich-bulk
 * Streams progress via SSE (Server-Sent Events) for real-time progress.
 * Body: { companyIds: string[], skipWithEmail?: boolean }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { companyIds, skipWithEmail = false } = body;

  if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
    return new Response(JSON.stringify({ error: "companyIds array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Use SSE for progress streaming
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await batchEnrich(companyIds, {
          delayMs: 400,
          skipWithEmail,
          onProgress: (done, total, id, success) => {
            send({ type: "progress", done, total, id, success });
          },
        });

        send({
          type: "complete",
          enriched: result.enriched,
          failed: result.failed,
          skipped: result.skipped,
          errors: result.errors.slice(0, 10),
        });
      } catch (err) {
        send({ type: "error", error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
