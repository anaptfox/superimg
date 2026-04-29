//! MCP Resource: superimg://easings
//! List of all valid easing function names

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EASING_NAMES } from "@superimg/stdlib/easing";

export function registerEasingsResource(server: McpServer): void {
  server.registerResource(
    "easings",
    "superimg://easings",
    {
      description: "List of all valid easing function names for std.interpolate() and t.motion()",
      mimeType: "application/json",
    },
    async () => ({
      contents: [{
        uri: "superimg://easings",
        mimeType: "application/json",
        text: JSON.stringify({
          count: EASING_NAMES.length,
          easings: EASING_NAMES,
          usage: 'std.interpolate(progress, [0, 1], [from, to], "easeOutCubic")',
        }, null, 2),
      }],
    })
  );
}
