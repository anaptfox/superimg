//! MCP Tool: list_videos
//! Discover all *.video.ts files in a project

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperimgMcpOptions } from "../server.js";
import { z } from "zod";
import { readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  ".vercel",
  "dist",
  "out",
  ".git",
  "build",
  ".turbo",
]);

interface DiscoveredVideo {
  name: string;
  shortName: string;
  entrypoint: string;
  relativePath: string;
}

function extractShortName(relPath: string): string {
  const parts = relPath.replace(/\\/g, "/").split("/");
  const filename = parts[parts.length - 1];
  const baseName = filename.replace(/\.video\.(ts|js)$/, "");
  const parentFolder = parts.length > 1 ? parts[parts.length - 2] : "";

  if (parentFolder && baseName === parentFolder) return parentFolder;
  if (baseName === "index" && parentFolder) return parentFolder;
  return baseName;
}

function discoverVideos(projectRoot: string): DiscoveredVideo[] {
  const results: DiscoveredVideo[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) walk(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".video.ts") || entry.name.endsWith(".video.js")) {
          const relPath = relative(projectRoot, fullPath);
          results.push({
            name: relPath.replace(/\.video\.(ts|js)$/, "").replace(/\\/g, "/"),
            shortName: extractShortName(relPath),
            entrypoint: fullPath,
            relativePath: relPath.replace(/\\/g, "/"),
          });
        }
      }
    }
  }

  walk(projectRoot);
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

export function registerListVideosTool(server: McpServer, options: SuperimgMcpOptions): void {
  server.registerTool(
    "list_videos",
    {
      description:
        "Discover all *.video.ts and *.video.js files in the project. Returns video names, paths, and short names for CLI usage.",
      inputSchema: {
        projectRoot: z.string().optional().describe("Project root directory (default: current working directory)"),
      },
    },
    async ({ projectRoot }) => {
      const root = projectRoot || options.projectRoot || process.cwd();

      try {
        const videos = discoverVideos(root);

        if (videos.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No *.video.ts or *.video.js files found in ${root}\n\nCreate a video with: npx superimg new my-video`,
              },
            ],
          };
        }

        const list = videos
          .map((v) => `- ${v.shortName} (${v.relativePath})`)
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${videos.length} video(s) in ${root}:\n\n${list}\n\nRender with: npx superimg render <name>`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to discover videos: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
