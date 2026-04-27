//! SuperImg MCP Server Factory
//! Creates an MCP server exposing SuperImg capabilities to AI assistants.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSkillResource, registerApiResource, registerExamplesResource, registerEasingsResource } from "./resources/index.js";
import { registerValidateTool, registerListVideosTool, registerTemplateInfoTool } from "./tools/index.js";

export interface SuperimgMcpOptions {
  /** Project root for video discovery (default: cwd) */
  projectRoot?: string;
}

/**
 * Create a configured SuperImg MCP server.
 *
 * Skill content (SKILL.md, references, examples) is sourced from
 * `@superimg/skill` at build time — no runtime filesystem access for skill data.
 *
 * @example
 * ```ts
 * import { createSuperimgServer } from "@superimg/mcp/server";
 * import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
 *
 * const server = createSuperimgServer({ projectRoot: process.cwd() });
 * const transport = new StdioServerTransport();
 * await server.connect(transport);
 * ```
 */
export function createSuperimgServer(options: SuperimgMcpOptions = {}): McpServer {
  const server = new McpServer(
    { name: "superimg", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  registerSkillResource(server, options);
  registerApiResource(server, options);
  registerExamplesResource(server, options);
  registerEasingsResource(server);

  registerValidateTool(server);
  registerListVideosTool(server, options);
  registerTemplateInfoTool(server, options);

  return server;
}
