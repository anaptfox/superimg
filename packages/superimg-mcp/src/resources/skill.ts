//! MCP Resource: superimg://skill
//! Canonical SuperImg skill body, sourced from @superimg/skill (build-time-embedded).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperimgMcpOptions } from "../server.js";
import { getSkillContent } from "@superimg/skill";

export function registerSkillResource(server: McpServer, _options: SuperimgMcpOptions): void {
  server.registerResource(
    "skill",
    "superimg://skill",
    {
      description: "Complete SuperImg skill guide - mental model, patterns, cheat sheet",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [{
        uri: "superimg://skill",
        mimeType: "text/markdown",
        text: getSkillContent({ format: "raw" }),
      }],
    })
  );
}
