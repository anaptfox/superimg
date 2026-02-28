import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { baseURL } from "@/lib/base-url";
import {
  EDITOR_EXAMPLES,
  EXAMPLE_CATEGORIES,
} from "@/lib/video/examples/index";

const WIDGET_URI = "ui://superimg/editor-v3.html";

const CREATE_VIDEO_DESCRIPTION = `Create a SuperImg video template and open the live editor with a preview.

## Template Structure

\`\`\`
import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    title: "Hello",
    accentColor: "#667eea",
  },
  config: {                          // all optional
    width: 1920, height: 1080,       // canvas dimensions
    fps: 30,                         // frames per second
    durationSeconds: 5,              // video length
  },
  render(ctx) {
    const { std, sceneProgress, sceneTimeSeconds, width, height, data } = ctx;
    // ... build and return an HTML string
    return \\\`<div style="width:\${width}px;height:\${height}px">...</div>\\\`;
  },
});
\`\`\`

## RenderContext (ctx) — key fields

- sceneProgress: 0→1 through current scene (primary animation driver)
- sceneTimeSeconds: elapsed seconds in scene (for phase timing)
- sceneDurationSeconds: total scene duration
- width, height: canvas pixels
- isPortrait, isLandscape: orientation booleans
- data: template data (merged with defaults)
- std: standard library (see below)
- fps: frames per second

## Standard Library (ctx.std)

### std.tween — eased interpolation (canonical animation primitive)
  std.tween(from, to, progress, easing?)
  Easings: "easeOutCubic", "easeInOutQuad", "easeOutBack", "easeOutElastic", "easeInCubic", "easeOutQuart", "linear"

### std.math
  std.math.clamp(val, min, max)
  std.math.map(val, inMin, inMax, outMin, outMax)
  std.math.noise(x), std.math.noise2D(x, y) — simplex noise (-1 to 1)

### std.color
  std.color.alpha(color, opacity) — "rgba(…)"
  std.color.mix(color1, color2, t) — blend two colors
  std.color.lighten(color, amount), std.color.darken(color, amount)
  std.color.hsl(h, s, l) — create HSL string

### std.css — object-to-inline-style (auto-px for numbers except opacity/zIndex/lineHeight)
  std.css({ width, height, opacity, transform }) → "width:1920px;height:1080px;opacity:0.8;transform:..."
  std.css.center() → "display:flex;align-items:center;justify-content:center"
  std.css.fill()   → "position:absolute;top:0;left:0;width:100%;height:100%"
  std.css.stack()  → "display:flex;flex-direction:column"

### std.timing — phase management
  const phases = std.timing.sequence({ intro: 1.0, main: 3.0, outro: 1.0 });
  phases.getPhaseProgress(time, 'intro') → 0-1

## Phase Timing Pattern (recommended for multi-stage animations)

\`\`\`
const { std, sceneTimeSeconds: time } = ctx;
const enterProgress = std.math.clamp(time / 1.0, 0, 1);
const exitProgress = std.math.clamp((time - 3.0) / 1.0, 0, 1);
const opacity = std.tween(0, 1, enterProgress, "easeOutCubic") * (1 - exitProgress);
const y = std.tween(40, 0, enterProgress, "easeOutCubic");
\`\`\`

## Staggered Elements

Delay each element by offsetting time:
\`\`\`
const item1Enter = std.math.clamp(time / 1.0, 0, 1);
const item2Enter = std.math.clamp((time - 0.2) / 1.0, 0, 1);
const item3Enter = std.math.clamp((time - 0.4) / 1.0, 0, 1);
\`\`\`

## Complete Example

\`\`\`
import { defineTemplate } from "superimg";

export default defineTemplate({
  defaults: {
    title: "Launch Day",
    subtitle: "Something amazing is coming",
    accentColor: "#667eea",
  },
  render(ctx) {
    const { std, sceneTimeSeconds: time, width, height, data } = ctx;
    const { title, subtitle, accentColor } = data;

    const enterProgress = std.math.clamp(time / 1.5, 0, 1);
    const exitProgress = std.math.clamp((time - 3.5) / 1.0, 0, 1);
    const alive = 1 - exitProgress;

    const titleOpacity = std.tween(0, 1, enterProgress, "easeOutCubic") * alive;
    const titleY = std.tween(40, 0, enterProgress, "easeOutCubic");

    const subEnter = std.math.clamp((time - 0.3) / 1.5, 0, 1);
    const subOpacity = std.tween(0, 0.8, subEnter, "easeOutCubic") * alive;
    const subY = std.tween(30, 0, subEnter, "easeOutCubic");

    const lineEnter = std.math.clamp((time - 0.5) / 1.0, 0, 1);
    const lineWidth = std.tween(0, 100, lineEnter, "easeOutCubic") * alive;

    return \\\`
      <div style="\${std.css({ width, height, background: '#0f0f23', fontFamily: 'system-ui, sans-serif' })};\${std.css.center()}">
        <div style="text-align:center">
          <div style="\${std.css({ width: lineWidth + '%', maxWidth: 400, height: 2, background: std.color.alpha(accentColor, 0.8), margin: '0 auto 24px' })}"></div>
          <h1 style="\${std.css({ fontSize: 72, fontWeight: 700, color: accentColor, margin: 0, opacity: titleOpacity, transform: 'translateY(' + titleY + 'px)' })}">\${title}</h1>
          <p style="\${std.css({ fontSize: 24, color: 'rgba(255,255,255,0.6)', marginTop: 16, opacity: subOpacity, transform: 'translateY(' + subY + 'px)' })}">\${subtitle}</p>
        </div>
      </div>
    \\\`;
  },
});
\`\`\`

## Critical Rules
1. Return HTML template literal strings, NOT JSX/React.
2. Set root element to width: \${width}px; height: \${height}px so it fills the frame.
3. Use sceneProgress or sceneTimeSeconds for animation — never globalProgress.
4. render() must be pure — no side effects, no DOM access, no global state.
5. Import only from "superimg". Everything is available via ctx.std.
6. Use \${} interpolation for all dynamic values inside the HTML string.
7. Always use std.tween() for smooth animations — avoid raw Math for motion.`;

async function fetchWidgetHtml(): Promise<string> {
  const res = await fetch(`${baseURL}/widget`);
  return res.text();
}

function createServer(widgetHtml: string) {
  const server = new McpServer(
    { name: "superimg", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  // Resource: the editor widget (served from /widget page)
  server.registerResource(
    "editor-widget",
    WIDGET_URI,
    {
      title: "SuperImg Editor",
      description: "Interactive video editor powered by SuperImg",
      mimeType: "text/html;profile=mcp-app",
      _meta: {
        ui: {
          prefersBorder: true,
          domain: baseURL,
          csp: {
            connectDomains: [baseURL],
            resourceDomains: [baseURL],
          },
        },
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html;profile=mcp-app",
          text: widgetHtml,
          _meta: {
            ui: {
              prefersBorder: true,
              domain: baseURL,
              csp: {
                connectDomains: [baseURL],
                resourceDomains: [baseURL],
              },
            },
          },
        },
      ],
    })
  );

  // Tool: create_video — AI generates template code, widget renders it
  server.registerTool(
    "create_video",
    {
      title: "Create Video",
      description: CREATE_VIDEO_DESCRIPTION,
      inputSchema: {
        code: z
          .string()
          .describe(
            "Complete SuperImg template. MUST start with: import { defineTemplate } from 'superimg'; " +
            "MUST export default defineTemplate({...}). The render(ctx) function returns an HTML template literal string (NOT JSX). " +
            "Use ${} interpolation for dynamic values. Set root element dimensions to width/height px."
          ),
        title: z
          .string()
          .optional()
          .describe("Short title describing the video"),
        format: z
          .enum(["horizontal", "vertical", "square"])
          .optional()
          .describe("Video format/aspect ratio (default: horizontal)"),
        duration: z
          .number()
          .optional()
          .describe("Duration in seconds (default: 5)"),
      },
      _meta: {
        securitySchemes: [{ type: "noauth" }],
        ui: {
          resourceUri: WIDGET_URI,
          visibility: ["model", "app"],
        },
      },
    },
    async ({ code, title, format, duration }) => ({
      content: [
        {
          type: "text" as const,
          text: `Created video template: ${title ?? "Untitled"}`,
        },
      ],
      structuredContent: {
        code,
        title: title ?? "Untitled",
        format: format ?? "horizontal",
        duration: duration ?? 5,
      },
    })
  );

  // Tool: load_example — load a built-in example template
  server.registerTool(
    "load_example",
    {
      title: "Load Example Template",
      description:
        "Load a built-in SuperImg example template by ID. " +
        "Available categories: " +
        EXAMPLE_CATEGORIES.map((c) => c.title).join(", ") +
        ". Use list_examples to see all available templates.",
      inputSchema: {
        example_id: z
          .string()
          .describe(
            "The example ID to load. Available: " +
              EDITOR_EXAMPLES.map((e) => `${e.id} (${e.title})`).join(", ")
          ),
      },
      _meta: {
        securitySchemes: [{ type: "noauth" }],
        ui: {
          resourceUri: WIDGET_URI,
          visibility: ["model", "app"],
        },
      },
    },
    async ({ example_id }) => {
      const example = EDITOR_EXAMPLES.find((e) => e.id === example_id);
      if (!example) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Example "${example_id}" not found. Available: ${EDITOR_EXAMPLES.map((e) => e.id).join(", ")}`,
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Loaded example: ${example.title} (${example.category})`,
          },
        ],
        structuredContent: {
          code: example.code,
          title: example.title,
          format: "horizontal",
          duration: 5,
        },
      };
    }
  );

  // Tool: list_examples — show available templates (no widget)
  server.registerTool(
    "list_examples",
    {
      title: "List Example Templates",
      description:
        "List all available built-in SuperImg example templates, grouped by category.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe(
            "Filter by category: " +
              EXAMPLE_CATEGORIES.map((c) => c.id).join(", ")
          ),
      },
      annotations: { readOnlyHint: true },
      _meta: {
        securitySchemes: [{ type: "noauth" }],
      },
    },
    async ({ category }) => {
      const filtered = category
        ? EDITOR_EXAMPLES.filter((e) => e.category === category)
        : EDITOR_EXAMPLES;

      const grouped = EXAMPLE_CATEGORIES.map((cat) => {
        const examples = filtered.filter((e) => e.category === cat.id);
        if (examples.length === 0) return null;
        return `**${cat.title}**\n${examples.map((e) => `  - ${e.id}: ${e.title}`).join("\n")}`;
      })
        .filter(Boolean)
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Available SuperImg templates (${filtered.length} total):\n\n` +
              grouped +
              "\n\nUse load_example with any ID to open it in the editor.",
          },
        ],
      };
    }
  );

  return server;
}

const handler = async (req: Request) => {
  const widgetHtml = await fetchWidgetHtml();
  const server = createServer(widgetHtml);

  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);

  return transport.handleRequest(req);
};

export const GET = handler;
export const POST = handler;
