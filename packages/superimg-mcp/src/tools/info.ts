//! MCP Tool: template_info
//! Get metadata about a SuperImg template

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SuperimgMcpOptions } from "../server.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { bundleTemplateCode } from "@superimg/core/bundler";
import { compileTemplate } from "@superimg/core";

interface TemplateInfo {
  path: string;
  name: string;
  config: {
    width?: number;
    height?: number;
    fps?: number;
    duration?: number | string;
    fonts?: string[];
  };
  data: Record<string, unknown>;
  totalFrames: number;
  durationSeconds: number;
}

async function getTemplateInfo(templatePath: string): Promise<TemplateInfo> {
  const absPath = resolve(templatePath);

  if (!existsSync(absPath)) {
    throw new Error(`Template not found: ${absPath}`);
  }

  const code = readFileSync(absPath, "utf-8");
  const bundled = await bundleTemplateCode(code, dirname(absPath));
  const result = compileTemplate(bundled);

  if (result.error) {
    throw new Error(`Failed to compile template: ${result.error.message}`);
  }

  const template = result.template!;
  const config = template.config ?? {};
  const width = config.width ?? 1920;
  const height = config.height ?? 1080;
  const fps = config.fps ?? 30;

  let durationSeconds = 5;
  if (typeof config.duration === "number") {
    durationSeconds = config.duration;
  } else if (typeof config.duration === "string") {
    const match = config.duration.match(/^(\d+(?:\.\d+)?)(s|ms|f)?$/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2] || "s";
      if (unit === "ms") durationSeconds = value / 1000;
      else if (unit === "f") durationSeconds = value / fps;
      else durationSeconds = value;
    }
  }

  const totalFrames = Math.ceil(durationSeconds * fps);

  return {
    path: absPath,
    name: basename(absPath).replace(/\.video\.(ts|js)$/, ""),
    config: {
      width,
      height,
      fps,
      duration: config.duration ?? durationSeconds,
      fonts: config.fonts,
    },
    data: template.data ?? {},
    totalFrames,
    durationSeconds,
  };
}

export function registerTemplateInfoTool(server: McpServer, options: SuperimgMcpOptions): void {
  server.registerTool(
    "template_info",
    {
      description:
        "Get metadata about a SuperImg template including config, data, dimensions, and duration.",
      inputSchema: {
        template: z.string().describe("Path to the template file (*.video.ts)"),
      },
    },
    async ({ template }) => {
      try {
        const resolvedPath = template.startsWith("/")
          ? template
          : resolve(options.projectRoot || process.cwd(), template);

        const info = await getTemplateInfo(resolvedPath);

        const lines = [
          `Template: ${info.name}`,
          `Path: ${info.path}`,
          "",
          "Config:",
          `  Resolution: ${info.config.width}x${info.config.height}`,
          `  FPS: ${info.config.fps}`,
          `  Duration: ${info.durationSeconds}s (${info.totalFrames} frames)`,
        ];

        if (info.config.fonts?.length) {
          lines.push(`  Fonts: ${info.config.fonts.join(", ")}`);
        }

        if (Object.keys(info.data).length > 0) {
          lines.push("", "Data:", JSON.stringify(info.data, null, 2));
        }

        return {
          content: [
            {
              type: "text" as const,
              text: lines.join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get template info: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
