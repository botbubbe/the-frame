/**
 * Role-Based Access Control Middleware
 * 
 * Maps user roles to allowed route prefixes and enforces access at both
 * API and navigation levels.
 */

import { auth, type UserRole } from "@/lib/auth";
import { NextResponse } from "next/server";

// ── Role → Route Permissions ──

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ["*"], // full access
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
  ai: [
    "/dashboard", "/ai", "/api/v1",
  ],
};

// Routes ALL authenticated users can access
const COMMON_ROUTES = [
  "/settings", "/profile", "/notifications", "/api/v1/settings",
  "/api/v1/notifications", "/api/v1/auth", "/login",
];

// Sensitive operations that require owner role
const OWNER_ONLY_OPERATIONS: Array<{ method: string; pathPattern: string }> = [
  { method: "DELETE", pathPattern: "/api/v1/" }, // All DELETE operations
  { method: "POST", pathPattern: "/api/v1/data/clear" },
  { method: "PUT", pathPattern: "/api/v1/settings" },
  { method: "POST", pathPattern: "/api/v1/users" },
];

/**
 * Check if a user role can access a given path.
 */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  // Common routes are always accessible
  if (COMMON_ROUTES.some((r) => pathname.startsWith(r))) return true;

  const allowed = ROLE_PERMISSIONS[role];
  if (!allowed) return false;

  // Owner has full access
  if (allowed.includes("*")) return true;

  return allowed.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Check if a user role can perform a sensitive operation.
 */
export function canPerformOperation(role: UserRole, method: string, pathname: string): boolean {
  if (role === "owner") return true;

  // Finance role can modify finance settings
  if (role === "finance" && pathname.startsWith("/api/v1/finance")) return true;
  if (role === "finance" && pathname.startsWith("/api/v1/settings") && method === "PUT") return true;

  for (const op of OWNER_ONLY_OPERATIONS) {
    if (method === op.method && pathname.startsWith(op.pathPattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Middleware helper: check auth + RBAC for an API route.
 * Returns null if authorized, or a NextResponse with error.
 */
export async function requireRoleForRoute(
  allowedRoles?: UserRole[]
): Promise<{ user: { id: string; role: UserRole; name: string; email: string } } | NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as UserRole;

  if (allowedRoles && !allowedRoles.includes(role) && role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { user: session.user as { id: string; role: UserRole; name: string; email: string } };
}

/**
 * Get sidebar navigation items filtered by user role.
 */
export function getNavigationForRole(role: UserRole): {
  sales: string[];
  operations: string[];
  insights: string[];
} {
  const allSales = ["Dashboard", "Prospects", "Pipeline", "Campaigns", "Inbox", "Customers"];
  const allOperations = ["Orders", "Catalog", "Inventory", "Finance"];
  const allInsights = ["Marketing", "Intelligence", "AI Center", "Notifications"];

  if (role === "owner") {
    return { sales: allSales, operations: allOperations, insights: allInsights };
  }

  const routeToNav: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/prospects": "Prospects",
    "/pipeline": "Pipeline",
    "/campaigns": "Campaigns",
    "/campaigns/inbox": "Inbox",
    "/customers": "Customers",
    "/orders": "Orders",
    "/catalog": "Catalog",
    "/inventory": "Inventory",
    "/finance": "Finance",
    "/marketing": "Marketing",
    "/intelligence": "Intelligence",
    "/ai": "AI Center",
    "/notifications": "Notifications",
  };

  const allowed = ROLE_PERMISSIONS[role] || [];
  const allowedNavItems = new Set<string>();
  allowedNavItems.add("Dashboard"); // Everyone gets dashboard
  allowedNavItems.add("Notifications"); // Everyone gets notifications

  for (const prefix of allowed) {
    const navItem = routeToNav[prefix];
    if (navItem) allowedNavItems.add(navItem);
  }

  return {
    sales: allSales.filter((n) => allowedNavItems.has(n)),
    operations: allOperations.filter((n) => allowedNavItems.has(n)),
    insights: allInsights.filter((n) => allowedNavItems.has(n)),
  };
}
