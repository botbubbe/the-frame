import type { ModuleDefinition } from "@/modules/shared/types";

// Register MCP tools (side-effect import)
import "./mcp/tools";

export const salesModule: ModuleDefinition = {
  name: "sales",
  label: "Sales",
  description: "Prospect management and CRM pipeline",
  routes: [{ path: "/sales", label: "Sales", icon: "💼" }, { path: "/sales/prospects", label: "Prospects" }, { path: "/sales/pipeline", label: "Pipeline" }, { path: "/sales/campaigns", label: "Campaigns" }],
  schema: [],
  mcpTools: [
    "sales.list_prospects",
    "sales.get_prospect",
    "sales.update_prospect",
    "sales.bulk_action",
    "sales.import_csv",
    "sales.run_icp_classifier",
    "sales.get_smart_lists",
  ],
  eventHooks: {},
};
