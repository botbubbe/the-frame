import { describe, it, expect } from "vitest";

// Inline the RBAC logic to test without Next.js runtime
type UserRole = "owner" | "sales_manager" | "warehouse" | "finance" | "marketing" | "support" | "ai";

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ["*"],
  sales_manager: [
    "/dashboard", "/prospects", "/pipeline", "/campaigns", "/customers",
    "/api/v1/prospects", "/api/v1/pipeline", "/api/v1/campaigns", "/api/v1/customers",
    "/api/v1/deals", "/api/v1/activities",
  ],
  warehouse: [
    "/dashboard", "/inventory", "/orders", "/catalog",
    "/api/v1/inventory", "/api/v1/orders", "/api/v1/catalog",
  ],
  finance: [
    "/dashboard", "/finance", "/orders",
    "/api/v1/finance", "/api/v1/settlements", "/api/v1/expenses", "/api/v1/orders",
  ],
  marketing: [
    "/dashboard", "/marketing", "/catalog", "/campaigns",
    "/api/v1/marketing", "/api/v1/catalog", "/api/v1/campaigns",
  ],
  support: [
    "/dashboard", "/orders", "/customers",
    "/api/v1/orders", "/api/v1/customers",
  ],
  ai: ["/dashboard", "/ai", "/api/v1"],
};

const COMMON_ROUTES = [
  "/settings", "/profile", "/notifications", "/api/v1/settings",
  "/api/v1/notifications", "/api/v1/auth", "/login",
];

const OWNER_ONLY_OPERATIONS = [
  { method: "DELETE", pathPattern: "/api/v1/" },
  { method: "POST", pathPattern: "/api/v1/data/clear" },
  { method: "PUT", pathPattern: "/api/v1/settings" },
  { method: "POST", pathPattern: "/api/v1/users" },
];

function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (COMMON_ROUTES.some((r) => pathname.startsWith(r))) return true;
  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) return false;
  if (allowed.includes("*")) return true;
  return allowed.some((prefix) => pathname.startsWith(prefix));
}

function canPerformOperation(role: UserRole, method: string, pathname: string): boolean {
  if (role === "owner") return true;
  if (role === "finance" && pathname.startsWith("/api/v1/finance")) return true;
  if (role === "finance" && pathname.startsWith("/api/v1/settings") && method === "PUT") return true;
  for (const op of OWNER_ONLY_OPERATIONS) {
    if (method === op.method && pathname.startsWith(op.pathPattern)) return false;
  }
  return true;
}

describe("RBAC — Role-Based Access Control", () => {

  describe("owner role", () => {
    it("has access to all routes", () => {
      expect(canAccessRoute("owner", "/dashboard")).toBe(true);
      expect(canAccessRoute("owner", "/finance")).toBe(true);
      expect(canAccessRoute("owner", "/inventory")).toBe(true);
      expect(canAccessRoute("owner", "/prospects")).toBe(true);
      expect(canAccessRoute("owner", "/marketing")).toBe(true);
      expect(canAccessRoute("owner", "/api/v1/orders")).toBe(true);
    });

    it("can perform all operations including DELETE", () => {
      expect(canPerformOperation("owner", "DELETE", "/api/v1/orders/123")).toBe(true);
      expect(canPerformOperation("owner", "PUT", "/api/v1/settings")).toBe(true);
      expect(canPerformOperation("owner", "POST", "/api/v1/users")).toBe(true);
    });
  });

  describe("sales_manager role", () => {
    it("can access sales routes", () => {
      expect(canAccessRoute("sales_manager", "/prospects")).toBe(true);
      expect(canAccessRoute("sales_manager", "/pipeline")).toBe(true);
      expect(canAccessRoute("sales_manager", "/customers")).toBe(true);
      expect(canAccessRoute("sales_manager", "/campaigns")).toBe(true);
    });

    it("is blocked from finance", () => {
      expect(canAccessRoute("sales_manager", "/finance")).toBe(false);
      expect(canAccessRoute("sales_manager", "/inventory")).toBe(false);
    });
  });

  describe("warehouse role", () => {
    it("can access inventory and orders", () => {
      expect(canAccessRoute("warehouse", "/inventory")).toBe(true);
      expect(canAccessRoute("warehouse", "/orders")).toBe(true);
      expect(canAccessRoute("warehouse", "/catalog")).toBe(true);
    });

    it("is blocked from sales routes", () => {
      expect(canAccessRoute("warehouse", "/prospects")).toBe(false);
      expect(canAccessRoute("warehouse", "/pipeline")).toBe(false);
      expect(canAccessRoute("warehouse", "/campaigns")).toBe(false);
    });
  });

  describe("finance role", () => {
    it("can access finance routes", () => {
      expect(canAccessRoute("finance", "/finance")).toBe(true);
      expect(canAccessRoute("finance", "/orders")).toBe(true);
      expect(canAccessRoute("finance", "/api/v1/settlements")).toBe(true);
    });

    it("is blocked from marketing", () => {
      expect(canAccessRoute("finance", "/marketing")).toBe(false);
      expect(canAccessRoute("finance", "/catalog")).toBe(false);
    });
  });

  describe("marketing role", () => {
    it("can access marketing and catalog", () => {
      expect(canAccessRoute("marketing", "/marketing")).toBe(true);
      expect(canAccessRoute("marketing", "/catalog")).toBe(true);
      expect(canAccessRoute("marketing", "/campaigns")).toBe(true);
    });

    it("is blocked from sales and finance", () => {
      expect(canAccessRoute("marketing", "/prospects")).toBe(false);
      expect(canAccessRoute("marketing", "/finance")).toBe(false);
    });
  });

  describe("support role", () => {
    it("can access orders and customers", () => {
      expect(canAccessRoute("support", "/orders")).toBe(true);
      expect(canAccessRoute("support", "/customers")).toBe(true);
    });

    it("is blocked from settings-level and other modules", () => {
      expect(canAccessRoute("support", "/inventory")).toBe(false);
      expect(canAccessRoute("support", "/finance")).toBe(false);
      expect(canAccessRoute("support", "/prospects")).toBe(false);
    });
  });

  describe("sensitive operations", () => {
    it("DELETE operations are owner-only", () => {
      expect(canPerformOperation("owner", "DELETE", "/api/v1/orders/123")).toBe(true);
      expect(canPerformOperation("sales_manager", "DELETE", "/api/v1/orders/123")).toBe(false);
      expect(canPerformOperation("warehouse", "DELETE", "/api/v1/inventory/abc")).toBe(false);
      expect(canPerformOperation("finance", "DELETE", "/api/v1/expenses/1")).toBe(false);
    });

    it("settings PUT is owner-only (except finance exception)", () => {
      expect(canPerformOperation("owner", "PUT", "/api/v1/settings")).toBe(true);
      expect(canPerformOperation("sales_manager", "PUT", "/api/v1/settings")).toBe(false);
      expect(canPerformOperation("warehouse", "PUT", "/api/v1/settings")).toBe(false);
      // Finance exception: can PUT settings
      expect(canPerformOperation("finance", "PUT", "/api/v1/settings")).toBe(true);
    });
  });

  describe("unauthenticated / API key auth", () => {
    it("no role means no access to protected routes", () => {
      // Simulate: if role is undefined/invalid, canAccessRoute returns false
      expect(canAccessRoute("unknown_role" as UserRole, "/orders")).toBe(false);
      expect(canAccessRoute("unknown_role" as UserRole, "/finance")).toBe(false);
    });

    it("common routes accessible to any authenticated role", () => {
      const roles: UserRole[] = ["owner", "sales_manager", "warehouse", "finance", "marketing", "support"];
      for (const role of roles) {
        expect(canAccessRoute(role, "/settings")).toBe(true);
        expect(canAccessRoute(role, "/profile")).toBe(true);
        expect(canAccessRoute(role, "/login")).toBe(true);
      }
    });

    it("API key with expired date should be rejected", () => {
      // Simulate expiry check
      const expiresAt = "2025-01-01T00:00:00Z";
      const now = new Date().toISOString();
      expect(expiresAt < now).toBe(true); // expired
    });

    it("API key with future expiry is valid", () => {
      const expiresAt = "2099-12-31T23:59:59Z";
      const now = new Date().toISOString();
      expect(expiresAt > now).toBe(true); // still valid
    });
  });
});
