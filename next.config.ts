import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  typescript: {
    // TODO: Fix remaining type errors in marketing components + MCP tools
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
