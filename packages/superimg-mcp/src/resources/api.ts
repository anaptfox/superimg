//! MCP Resource: superimg://api
//! Full API reference, sourced from @superimg/skill (build-time-embedded).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperimgMcpOptions } from "../server.js";
import { getReference } from "@superimg/skill";

export function registerApiResource(server: McpServer, _options: SuperimgMcpOptions): void {
  server.registerResource(
    "api-reference",
    "superimg://api",
    {
      description: "Complete SuperImg stdlib API reference - RenderContext, tween, math, color, score, cue",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [{
        uri: "superimg://api",
        mimeType: "text/markdown",
        text: getReference("api") ?? "# SuperImg API Reference\n\nReference content unavailable.",
      }],
    })
  );
}
