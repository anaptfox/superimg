//! MCP Resource: superimg://api
//! Full API reference from references/api.md

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperimgMcpOptions } from "../server.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Paths to try for skills/superimg/references/api.md */
const API_PATHS = [
  join(__dirname, "..", "..", "skills", "superimg", "references", "api.md"),
  join(__dirname, "..", "..", "..", "skills", "superimg", "references", "api.md"),
  join(__dirname, "..", "..", "..", "..", "skills", "superimg", "references", "api.md"),
  join(__dirname, "..", "..", "..", "..", "..", "skills", "superimg", "references", "api.md"),
];

function loadApiContent(customPath?: string): string {
  const paths = customPath
    ? [join(customPath, "references", "api.md"), ...API_PATHS]
    : API_PATHS;

  for (const p of paths) {
    if (existsSync(p)) {
      return readFileSync(p, "utf-8");
    }
  }

  return "# SuperImg API Reference\n\nAPI reference not found. Install the package or check skillsPath option.";
}

export function registerApiResource(server: McpServer, options: SuperimgMcpOptions): void {
  server.registerResource(
    "api-reference",
    "superimg://api",
    {
      description: "Complete SuperImg stdlib API reference - RenderContext, tween, math, color, timeline",
      mimeType: "text/markdown",
    },
    async () => ({
      contents: [{
        uri: "superimg://api",
        mimeType: "text/markdown",
        text: loadApiContent(options.skillsPath),
      }],
    })
  );
}
