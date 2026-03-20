import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { db } from "@/lib/db";
import { apiKeys, errorLogs, changeLogs } from "@/modules/core/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ── Types ──

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  authMethod: "jwt" | "api_key";
}

export interface ApiContext {
  user: AuthenticatedUser;
  requestId: string;
}

type RouteHandler = (
  request: NextRequest,
  context: ApiContext
) => Promise<NextResponse> | NextResponse;

interface ApiHandlerOptions {
  auth?: boolean;
  rateLimit?: { max: number; window: string };
  audit?: boolean;
  roles?: string[];
}

// ── Request ID ──

function generateRequestId(): string {
  return `req_${crypto.randomUUID().slice(0, 12)}`;
}

// ── Auth middleware ──

async function resolveAuth(request: NextRequest): Promise<AuthenticatedUser | null> {
  // Try API key first
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const key = db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).get();
    if (key && (!key.expiresAt || new Date(key.expiresAt) > new Date())) {
      // Update last used
      db.update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.id, key.id)).run();
      return {
        id: key.userId || "system",
        email: "api-key",
        name: key.name,
        role: "ai", // API keys default to ai role; permissions checked separately
        authMethod: "api_key",
      };
    }
    return null;
  }

  // Try JWT
  const token = await getToken({ req: request });
  if (token) {
    return {
      id: token.id as string,
      email: token.email || "",
      name: token.name || "",
      role: token.role as string,
      authMethod: "jwt",
    };
  }

  return null;
}

// ── Rate limiting (SQLite-based) ──

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smh])$/);
  if (!match) return 60000; // default 1 minute
  const [, num, unit] = match;
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000 };
  return parseInt(num) * (multipliers[unit] || 60000);
}

function checkRateLimit(identifier: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;

  // In-memory rate limiting (acceptable for Phase 0 single-server)
  if (!rateLimitStore.has(identifier)) {
    rateLimitStore.set(identifier, []);
  }
  const timestamps = rateLimitStore.get(identifier)!;
  // Remove old entries
  const filtered = timestamps.filter((t) => t > windowStart);
  rateLimitStore.set(identifier, filtered);

  if (filtered.length >= max) return false;
  filtered.push(now);
  return true;
}

// In-memory rate limit store (cleared on restart — acceptable for Phase 0)
const rateLimitStore = new Map<string, number[]>();

// Periodic cleanup every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 3600000; // 1 hour
  for (const [key, timestamps] of rateLimitStore) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }
}, 300000);

// ── Error handler ──

function handleError(err: unknown, requestId: string): NextResponse {
  const message = err instanceof Error ? err.message : "Internal server error";
  const stack = err instanceof Error ? err.stack : undefined;

  // Log to error_logs async
  setImmediate(() => {
    try {
      db.insert(errorLogs).values({
        level: "error",
        source: "api-middleware",
        message,
        stackTrace: stack ?? null,
        metadata: { requestId },
      }).run();
    } catch {
      console.error("[ApiMiddleware] Failed to log error:", message);
    }
  });

  return NextResponse.json(
    { error: message, requestId },
    { status: 500, headers: { "X-Request-Id": requestId } }
  );
}

// ── Audit logging ──

function auditMutation(request: NextRequest, context: ApiContext): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;

  setImmediate(() => {
    try {
      db.insert(changeLogs).values({
        entityType: "api_request",
        entityId: context.requestId,
        field: "mutation",
        oldValue: null,
        newValue: `${request.method} ${request.nextUrl.pathname}`,
        userId: context.user.id,
        source: context.user.authMethod === "api_key" ? "api" : "ui",
        requestId: context.requestId,
      }).run();
    } catch {
      console.error("[ApiMiddleware] Failed to audit log");
    }
  });
}

// ── Main wrapper ──

export function apiHandler(
  handler: RouteHandler,
  options: ApiHandlerOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  const { auth = true, rateLimit, audit = false, roles } = options;

  return async (request: NextRequest) => {
    const requestId = generateRequestId();

    try {
      // Auth check
      let user: AuthenticatedUser | null = null;
      if (auth) {
        user = await resolveAuth(request);
        if (!user) {
          return NextResponse.json(
            { error: "Unauthorized", requestId },
            { status: 401, headers: { "X-Request-Id": requestId } }
          );
        }

        // Role check
        if (roles && !roles.includes(user.role)) {
          return NextResponse.json(
            { error: "Forbidden", requestId },
            { status: 403, headers: { "X-Request-Id": requestId } }
          );
        }
      }

      // Rate limit check
      if (rateLimit) {
        const identifier = user?.id || request.headers.get("x-forwarded-for") || "anonymous";
        const windowMs = parseWindow(rateLimit.window);
        if (!checkRateLimit(identifier, rateLimit.max, windowMs)) {
          return NextResponse.json(
            { error: "Rate limit exceeded", requestId },
            { status: 429, headers: { "X-Request-Id": requestId, "Retry-After": String(Math.ceil(windowMs / 1000)) } }
          );
        }
      }

      const context: ApiContext = {
        user: user || { id: "anonymous", email: "", name: "Anonymous", role: "support", authMethod: "jwt" },
        requestId,
      };

      // Audit mutations
      if (audit) {
        auditMutation(request, context);
      }

      // Execute handler
      const response = await handler(request, context);

      // Add request ID header
      response.headers.set("X-Request-Id", requestId);
      return response;
    } catch (err) {
      return handleError(err, requestId);
    }
  };
}

// ── Convenience wrappers ──

export function withAuth(handler: RouteHandler): (request: NextRequest) => Promise<NextResponse> {
  return apiHandler(handler, { auth: true });
}

export function withRateLimit(
  handler: RouteHandler,
  options: { max: number; window: string }
): (request: NextRequest) => Promise<NextResponse> {
  return apiHandler(handler, { auth: true, rateLimit: options });
}

export function withAuditLog(handler: RouteHandler): (request: NextRequest) => Promise<NextResponse> {
  return apiHandler(handler, { auth: true, audit: true });
}

export function withErrorHandler(handler: RouteHandler): (request: NextRequest) => Promise<NextResponse> {
  return apiHandler(handler, { auth: false });
}
