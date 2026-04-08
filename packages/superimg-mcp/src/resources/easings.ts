//! MCP Resource: superimg://easings
//! List of all valid easing function names

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EASING_NAMES } from "@superimg/stdlib/tween";

export function registerEasingsResource(server: McpServer): void {
  server.registerResource(
    "easings",
    "superimg://easings",
    {
      description: "List of all 31 valid easing function names for std.tween()",
      mimeType: "application/json",
    },
    async () => ({
      contents: [{
        uri: "superimg://easings",
        mimeType: "application/json",
        text: JSON.stringify({
          count: EASING_NAMES.length,
          easings: EASING_NAMES,
          usage: 'std.tween(from, to, progress, "easeOutCubic")',
        }, null, 2),
      }],
    })
  );
}
