import { db } from "@/lib/db";
import { errorLogs, changeLogs, reportingLogs } from "@/modules/core/schema";

type ErrorLevel = "error" | "warn" | "critical";
type ChangeSource = "ui" | "api" | "agent" | "system" | "webhook";

// ── Change log buffer (per CTO review: batch writes) ──

interface ChangeLogEntry {
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string | null;
  source: ChangeSource;
  requestId?: string;
}

const changeBuffer: ChangeLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushChangeBuffer() {
  if (changeBuffer.length === 0) return;
  const batch = changeBuffer.splice(0, changeBuffer.length);
  try {
    for (const entry of batch) {
      db.insert(changeLogs).values({
        entityType: entry.entityType,
        entityId: entry.entityId,
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        userId: entry.userId,
        source: entry.source,
        requestId: entry.requestId,
      }).run();
    }
  } catch (err) {
    console.error("[Logger] Failed to flush change buffer:", err);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushChangeBuffer();
  }, 100); // Flush every 100ms per CTO review
}

// ── Telegram alerting ──

async function sendTelegramAlert(level: ErrorLevel, source: string, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) return;

  const emoji = level === "critical" ? "🚨" : "⚠️";
  const text = `${emoji} *${level.toUpperCase()}* — ${source}\n\n${message}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch {
    console.error("[Logger] Failed to send Telegram alert");
  }
}

// ── Logger class ──

class Logger {
  logError(
    level: ErrorLevel,
    source: string,
    message: string,
    stackTrace?: string,
    metadata?: Record<string, unknown>
  ): void {
    setImmediate(() => {
      try {
        db.insert(errorLogs).values({
          level,
          source,
          message,
          stackTrace: stackTrace ?? null,
          metadata: metadata ?? null,
        }).run();
      } catch (err) {
        console.error("[Logger] Failed to write error log:", err);
      }

      // Alert on critical errors
      if (level === "critical") {
        sendTelegramAlert(level, source, message).catch(() => {});
      }
    });
  }

  logChange(
    entityType: string,
    entityId: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    userId: string | null,
    source: ChangeSource,
    requestId?: string
  ): void {
    changeBuffer.push({ entityType, entityId, field, oldValue, newValue, userId, source, requestId });
    if (changeBuffer.length >= 10) {
      // Flush immediately at 10 entries per CTO review
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      setImmediate(flushChangeBuffer);
    } else {
      scheduleFlush();
    }
  }

  logEvent(
    eventType: string,
    module: string,
    metadata?: Record<string, unknown>,
    userId?: string,
    durationMs?: number
  ): void {
    setImmediate(() => {
      try {
        db.insert(reportingLogs).values({
          eventType,
          module,
          metadata: metadata ?? null,
          userId: userId ?? null,
          durationMs: durationMs ?? null,
        }).run();
      } catch (err) {
        console.error("[Logger] Failed to write reporting log:", err);
      }
    });
  }
}

export const logger = new Logger();
