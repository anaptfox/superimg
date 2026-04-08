//! MCP Tool: validate_template
//! Validate SuperImg template code

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateAITemplate, formatValidationForAI } from "@superimg/core/validation";

export function registerValidateTool(server: McpServer): void {
  server.registerTool(
    "validate_template",
    {
      description:
        "Validate SuperImg template code. Checks syntax, structure, easing names, and renders sample frames to detect NaN/undefined issues.",
      inputSchema: {
        code: z.string().describe("Complete SuperImg template code (TypeScript)"),
        width: z.number().optional().describe("Canvas width (default: 1920)"),
        height: z.number().optional().describe("Canvas height (default: 1080)"),
        duration: z.number().optional().describe("Duration in seconds (default: 3)"),
        data: z.record(z.unknown()).optional().describe("Template data overrides"),
      },
    },
    async ({ code, width, height, duration, data }) => {
      try {
        const result = await validateAITemplate(code, {
          width,
          height,
          duration,
          data,
          sampleFrames: [0, 0.25, 0.5, 0.75, 1.0],
        });

        if (result.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `VALIDATION_PASSED\n\nTemplate is valid. Rendered ${result.samples?.length ?? 0} sample frames successfully in ${result.validationTimeMs.toFixed(0)}ms.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationForAI(result),
            },
          ],
          isError: true,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Validation failed: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
