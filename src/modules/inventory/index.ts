import type { ModuleDefinition } from "@/modules/shared/types";

export const inventoryModule: ModuleDefinition = {
  name: "inventory",
  label: "Inventory",
  description: "Stock tracking, purchase orders, and supply chain management",
  routes: [
    { path: "/inventory", label: "Inventory", icon: "📦" },
    { path: "/inventory/purchase-orders", label: "Purchase Orders", icon: "📋" },
  ],
  schema: [],
  mcpTools: [],
  eventHooks: {},
};
