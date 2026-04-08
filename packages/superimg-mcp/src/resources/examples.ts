//! MCP Resource: superimg://examples/{name}
//! Example templates from skills/superimg/examples/

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperimgMcpOptions } from "../server.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Paths to try for skills/superimg/examples/ */
const EXAMPLE_PATHS = [
  join(__dirname, "..", "..", "skills", "superimg", "examples"),
  join(__dirname, "..", "..", "..", "skills", "superimg", "examples"),
  join(__dirname, "..", "..", "..", "..", "skills", "superimg", "examples"),
  join(__dirname, "..", "..", "..", "..", "..", "skills", "superimg", "examples"),
];

interface Example {
  name: string;
  code: string;
}

function findExamplesDir(customPath?: string): string | null {
  const paths = customPath
    ? [join(customPath, "examples"), ...EXAMPLE_PATHS]
    : EXAMPLE_PATHS;

  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function loadExamples(customPath?: string): Example[] {
  const dir = findExamplesDir(customPath);
  if (!dir) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  return files.map((file) => ({
    name: basename(file, ".ts"),
    code: readFileSync(join(dir, file), "utf-8"),
  }));
}

function loadExample(name: string, customPath?: string): string | null {
  const dir = findExamplesDir(customPath);
  if (!dir) return null;

  const filePath = join(dir, `${name}.ts`);
  if (!existsSync(filePath)) return null;

  return readFileSync(filePath, "utf-8");
}

export function registerExamplesResource(server: McpServer, options: SuperimgMcpOptions): void {
  // List all examples
  server.registerResource(
    "examples-list",
    "superimg://examples",
    {
      description: "List of available SuperImg example templates",
      mimeType: "application/json",
    },
    async () => {
      const examples = loadExamples(options.skillsPath);
      return {
        contents: [{
          uri: "superimg://examples",
          mimeType: "application/json",
          text: JSON.stringify(
            examples.map((e) => ({
              name: e.name,
              uri: `superimg://examples/${e.name}`,
            })),
            null,
            2
          ),
        }],
      };
    }
  );

  // Individual example resource template
  server.registerResource(
    "example",
    "superimg://examples/{name}",
    {
      description: "SuperImg example template source code",
      mimeType: "text/typescript",
    },
    async (uri) => {
      // Extract name from URI
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

      const code = loadExample(name, options.skillsPath);

      if (!code) {
        const examples = loadExamples(options.skillsPath);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: `Example "${name}" not found. Available: ${examples.map((e) => e.name).join(", ")}`,
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
