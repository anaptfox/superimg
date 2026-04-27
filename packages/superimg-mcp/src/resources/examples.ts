//! MCP Resource: superimg://examples and superimg://examples/{name}
//! Examples sourced from @superimg/skill (build-time-embedded).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperimgMcpOptions } from "../server.js";
import { listExamples, getExample } from "@superimg/skill";

export function registerExamplesResource(server: McpServer, _options: SuperimgMcpOptions): void {
  server.registerResource(
    "examples-list",
    "superimg://examples",
    {
      description: "List of available SuperImg example templates",
      mimeType: "application/json",
    },
    async () => ({
      contents: [{
        uri: "superimg://examples",
        mimeType: "application/json",
        text: JSON.stringify(
          listExamples().map((name) => ({ name, uri: `superimg://examples/${name}` })),
          null,
          2
        ),
      }],
    })
  );

  server.registerResource(
    "example",
    "superimg://examples/{name}",
    {
      description: "SuperImg example template source code",
      mimeType: "text/typescript",
    },
    async (uri) => {
      const match = uri.href.match(/superimg:\/\/examples\/(.+)$/);
      const name = match?.[1];

      if (!name) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: "Invalid example URI",
          }],
        };
      }

      const code = getExample(name);
      if (!code) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `Example "${name}" not found. Available: ${listExamples().join(", ")}`,
          }],
        };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/typescript",
          text: code,
        }],
      };
    }
  );
}
