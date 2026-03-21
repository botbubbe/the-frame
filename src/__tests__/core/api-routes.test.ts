import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb } from "../setup";
import { createRequest, parseResponse } from "../api-helpers";

// Import route handlers
import { GET as getNotifications, POST as postNotification } from "@/app/api/v1/notifications/route";
import { PATCH as patchNotification, DELETE as deleteNotification } from "@/app/api/v1/notifications/[id]/route";
import { GET as getNotificationCount } from "@/app/api/v1/notifications/count/route";
import { GET as getSearch } from "@/app/api/v1/search/route";
import { GET as getSettings, PUT as putSettings } from "@/app/api/v1/settings/route";
import { GET as getProfile, PUT as putProfile } from "@/app/api/v1/profile/route";
import { GET as getEvents } from "@/app/api/v1/events/route";
import { GET as getErrorLogs } from "@/app/api/v1/logs/errors/route";
import { GET as getChangeLogs } from "@/app/api/v1/logs/changes/route";
import { GET as getReportingLogs } from "@/app/api/v1/logs/reporting/route";

beforeEach(() => {
  resetTestDb();
});

// ── Helpers ──

function insertNotification(overrides: Record<string, unknown> = {}) {
  const db = getTestDb();
  const id = overrides.id || crypto.randomUUID();
  db.prepare(
    `INSERT INTO notifications (id, type, title, message, severity, module, read, dismissed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    overrides.type || "order",
    overrides.title || "Test",
    overrides.message || "Test message",
    overrides.severity || "medium",
    overrides.module || "orders",
    overrides.read ?? 0,
    overrides.dismissed ?? 0,
  );
  return id as string;
}

// ── Notifications ──

describe("Notifications API", () => {
  it("GET /notifications — returns list", async () => {
    insertNotification({ title: "N1" });
    insertNotification({ title: "N2" });
    const res = await getNotifications(createRequest("GET", "/api/v1/notifications"));
    const { status, data } = await parseResponse<any[]>(res);
    expect(status).toBe(200);
    expect(data).toHaveLength(2);
  });

  it("GET /notifications?unread=true — filters unread", async () => {
    insertNotification({ title: "Read", read: 1 });
    insertNotification({ title: "Unread", read: 0 });
    const res = await getNotifications(createRequest("GET", "/api/v1/notifications", { searchParams: { unread: "true" } }));
    const { data } = await parseResponse<any[]>(res);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Unread");
  });

  it("GET /notifications?type=order — filters by type", async () => {
    insertNotification({ type: "order" });
    insertNotification({ type: "inventory" });
    const res = await getNotifications(createRequest("GET", "/api/v1/notifications", { searchParams: { type: "order" } }));
    const { data } = await parseResponse<any[]>(res);
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("order");
  });

  it("GET /notifications?limit=1 — respects limit", async () => {
    insertNotification();
    insertNotification();
    const res = await getNotifications(createRequest("GET", "/api/v1/notifications", { searchParams: { limit: "1" } }));
    const { data } = await parseResponse<any[]>(res);
    expect(data).toHaveLength(1);
  });

  it("POST /notifications — creates notification", async () => {
    const res = await postNotification(createRequest("POST", "/api/v1/notifications", {
      body: { type: "order", title: "New Order", message: "Order #123", severity: "high", module: "orders" },
    }));
    const { status, data } = await parseResponse<{ id: string; success: boolean }>(res);
    expect(status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();
  });

  it("POST /notifications — 400 on missing fields", async () => {
    const res = await postNotification(createRequest("POST", "/api/v1/notifications", {
      body: { type: "order" },
    }));
    expect(res.status).toBe(400);
  });

  it("PATCH /notifications/:id — marks as read", async () => {
    const id = insertNotification();
    const res = await patchNotification(
      createRequest("PATCH", `/api/v1/notifications/${id}`, { body: { read: true } }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const row = getTestDb().prepare("SELECT read FROM notifications WHERE id = ?").get(id) as any;
    expect(row.read).toBe(1);
  });

  it("DELETE /notifications/:id — deletes", async () => {
    const id = insertNotification();
    const res = await deleteNotification(
      createRequest("DELETE", `/api/v1/notifications/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const row = getTestDb().prepare("SELECT * FROM notifications WHERE id = ?").get(id);
    expect(row).toBeUndefined();
  });
});

// ── Notification Count ──

describe("GET /notifications/count", () => {
  it("returns unread count", async () => {
    insertNotification({ read: 0 });
    insertNotification({ read: 0 });
    insertNotification({ read: 1 });
    const res = await getNotificationCount();
    const { data } = await parseResponse<{ unread: number }>(res);
    expect(data.unread).toBe(2);
  });
});

// ── Search ──

describe("GET /search", () => {
  it("searches companies by name", async () => {
    const db = getTestDb();
    db.prepare("INSERT INTO companies (id, name, state, status) VALUES ('c1', 'Sunny Shades', 'CA', 'new')").run();
    const res = await getSearch(createRequest("GET", "/api/v1/search", { searchParams: { q: "Sunny" } }));
    const { data } = await parseResponse<{ results: any[] }>(res);
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    expect(data.results[0].type).toBe("prospect");
  });

  it("returns empty for short query", async () => {
    const res = await getSearch(createRequest("GET", "/api/v1/search", { searchParams: { q: "S" } }));
    const { data } = await parseResponse<{ results: any[] }>(res);
    expect(data.results).toHaveLength(0);
  });

  it("searches products", async () => {
    const db = getTestDb();
    db.prepare("INSERT INTO catalog_products (id, sku_prefix, name, status) VALUES ('p1', 'SUN-001', 'Aviator Classic', 'active')").run();
    const res = await getSearch(createRequest("GET", "/api/v1/search", { searchParams: { q: "Aviator" } }));
    const { data } = await parseResponse<{ results: any[] }>(res);
    expect(data.results.some((r: any) => r.type === "product")).toBe(true);
  });
});

// ── Settings ──

describe("Settings API", () => {
  it("PUT then GET settings", async () => {
    await putSettings(createRequest("PUT", "/api/v1/settings", { body: { key: "theme", value: "dark" } }));
    const res = await getSettings(createRequest("GET", "/api/v1/settings"));
    const { data } = await parseResponse<Record<string, string>>(res);
    expect(data.theme).toBe("dark");
  });

  it("PUT /settings — 400 without key", async () => {
    const res = await putSettings(createRequest("PUT", "/api/v1/settings", { body: { value: "x" } }));
    expect(res.status).toBe(400);
  });
});

// ── Profile ──

describe("Profile API", () => {
  it("GET /profile — returns user", async () => {
    const res = await getProfile(createRequest("GET", "/api/v1/profile"));
    const { data } = await parseResponse<{ user: any }>(res);
    expect(data.user.name).toBe("Daniel");
  });

  it("PUT /profile — updates name", async () => {
    const res = await putProfile(createRequest("PUT", "/api/v1/profile", { body: { name: "Danny" } }));
    const { data } = await parseResponse<{ user: any }>(res);
    expect(data.user.name).toBe("Danny");
  });

  it("PUT /profile — 400 without name or email", async () => {
    const res = await putProfile(createRequest("PUT", "/api/v1/profile", { body: {} }));
    expect(res.status).toBe(400);
  });
});

// ── Events ──

describe("GET /events", () => {
  it("returns activity feed", async () => {
    const db = getTestDb();
    db.prepare("INSERT INTO activity_feed (id, event_type, module, created_at) VALUES ('e1', 'order_created', 'orders', datetime('now'))").run();
    const res = await getEvents(createRequest("GET", "/api/v1/events"));
    const { data } = await parseResponse<{ events: any[]; count: number }>(res);
    expect(data.count).toBe(1);
    expect(data.events[0].eventType).toBe("order_created");
  });
});

// ── Logs ──

describe("Logs API", () => {
  it("GET /logs/errors — returns error logs", async () => {
    const db = getTestDb();
    db.prepare("INSERT INTO error_logs (id, level, source, message, created_at) VALUES ('el1', 'error', 'api', 'Something broke', datetime('now'))").run();
    const res = await getErrorLogs(createRequest("GET", "/api/v1/logs/errors"));
    const { data } = await parseResponse<{ logs: any[]; count: number }>(res);
    expect(data.count).toBe(1);
  });

  it("GET /logs/changes — returns change logs", async () => {
    const db = getTestDb();
    db.prepare("INSERT INTO change_logs (id, entity_type, entity_id, field, old_value, new_value, source, user_id, timestamp) VALUES ('cl1', 'deal', 'd1', 'stage', 'outreach', 'contact_made', 'ui', 'u1', datetime('now'))").run();
    const res = await getChangeLogs(createRequest("GET", "/api/v1/logs/changes"));
    const { data } = await parseResponse<{ logs: any[]; count: number }>(res);
    expect(data.count).toBe(1);
  });

  it("GET /logs/reporting — returns reporting logs", async () => {
    const db = getTestDb();
    db.prepare("INSERT INTO reporting_logs (id, event_type, module, created_at) VALUES ('rl1', 'agent_run', 'sales', datetime('now'))").run();
    const res = await getReportingLogs(createRequest("GET", "/api/v1/logs/reporting"));
    const { data } = await parseResponse<{ logs: any[]; count: number }>(res);
    expect(data.count).toBe(1);
  });
});
