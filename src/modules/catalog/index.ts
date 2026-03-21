import type { ModuleDefinition } from "@/modules/shared/types";
import "./mcp/tools";

export const catalogModule: ModuleDefinition = {
  name: "catalog",
  label: "Catalog",
  description: "Product catalog and content management",
  routes: [
    { path: "/catalog", label: "Catalog", icon: "👓" },
    { path: "/catalog/export", label: "Export" },
    { path: "/catalog/intake", label: "Intake" },
  ],
  schema: [],
  mcpTools: [
    "catalog.list_products", "catalog.get_product", "catalog.update_product",
    "catalog.generate_copy", "catalog.suggest_tags", "catalog.export",
  ],
  eventHooks: {},
};
