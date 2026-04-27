//! SuperImg MCP Server CLI
//! Usage: npx @superimg/mcp

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSuperimgServer } from "../src/server.js";

async function main() {
  const projectRoot = process.env.SUPERIMG_PROJECT_ROOT || process.cwd();

  const server = createSuperimgServer({ projectRoot });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
