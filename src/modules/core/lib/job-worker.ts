import { jobQueue } from "./job-queue";
import { logger } from "./logger";

type JobHandler = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

const handlers = new Map<string, JobHandler>();

/**
 * Register a handler for a job type.
 * Convention: each module registers handlers like "catalog.import", "sales.enrich"
 */
export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

let polling = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Process the next available job.
 */
async function processNext(): Promise<boolean> {
  const job = jobQueue.dequeue();
  if (!job) return false;

  const handler = handlers.get(job.type);
  if (!handler) {
    jobQueue.fail(job.id, `No handler registered for job type: ${job.type}`, false);
    logger.logError("warn", "job-worker", `No handler for job type: ${job.type}`);
    return true;
  }

  try {
    const input = (job.input as Record<string, unknown>) ?? {};
    const output = await handler(input);
    jobQueue.complete(job.id, output);
    logger.logEvent("job.completed", "core", { jobId: job.id, type: job.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jobQueue.fail(job.id, message);
    logger.logError("error", "job-worker", `Job ${job.id} (${job.type}) failed: ${message}`);
  }

  return true;
}

/**
 * Start the polling worker. Polls every 5 seconds.
 */
export function startJobWorker(): void {
  if (polling) return;
  polling = true;

  pollTimer = setInterval(async () => {
    try {
      // Process up to 3 jobs per tick
      let processed = 0;
      while (processed < 3) {
        const found = await processNext();
        if (!found) break;
        processed++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.logError("error", "job-worker", `Worker tick error: ${message}`);
    }
  }, 5000);
}

/**
 * Stop the polling worker.
 */
export function stopJobWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  polling = false;
}
