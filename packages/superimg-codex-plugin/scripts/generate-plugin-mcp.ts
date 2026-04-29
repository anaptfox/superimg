// Generate plugin/.mcp.json.
//
// Two modes:
//   • production (default) — `npx -y @superimg/mcp` (resolves from npm)
//   • dev (SUPERIMG_PLUGIN_DEV=1) — points node at the local built binary so
//     a freshly-cloned monorepo can install the plugin without a published mcp

import { writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, "..");
const REPO_ROOT = join(PKG_ROOT, "..", "..");
const LOCAL_MCP_BIN = join(REPO_ROOT, "packages/superimg-mcp/dist/bin/superimg-mcp.js");
const TARGET = join(PKG_ROOT, "plugin", ".mcp.json");

const isDev = process.env.SUPERIMG_PLUGIN_DEV === "1";

function buildContent(): string {
  if (isDev) {
    if (!existsSync(LOCAL_MCP_BIN)) {
      throw new Error(
        `Dev mode requested but @superimg/mcp binary not built.\n` +
          `Run \`pnpm --filter @superimg/mcp build\` first.\n` +
          `Expected: ${LOCAL_MCP_BIN}`
      );
    }
    return JSON.stringify(
      {
        mcpServers: {
          superimg: {
            type: "stdio",
            command: "node",
            args: [LOCAL_MCP_BIN],
          },
        },
      },
      null,
      2
    ) + "\n";
  }

  return JSON.stringify(
    {
      mcpServers: {
        superimg: {
          type: "stdio",
          command: "npx",
          args: ["-y", "@superimg/mcp"],
        },
      },
    },
    null,
    2
  ) + "\n";
}

writeFileSync(TARGET, buildContent());
console.log(
  `@superimg/codex-plugin: generated .mcp.json (${isDev ? "dev — local node binary" : "production — npx @superimg/mcp"})`
);
