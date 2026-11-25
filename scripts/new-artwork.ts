#!/usr/bin/env npx tsx
/**
 * Scaffold a new Scene Studio artwork under apps/scene-studio/src/artworks/<name>/.
 *
 * Usage: npx tsx scripts/new-artwork.ts <name>
 *    or: just new-artwork <name>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2]?.trim();

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("Usage: new-artwork <kebab-case-name>");
  process.exit(1);
}

const pascal = name
  .split("-")
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");
const dir = path.join(root, "apps/scene-studio/src/artworks", name);

if (fs.existsSync(dir)) {
  console.error(`Artwork already exists: ${dir}`);
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });

const media = `import { captionStates, centeredCamera, defineInteractive, focusOn } from "@foxworth/superimg/interactive/define";

const ACTS = ["intro", "hold"] as const;

const inlineCss = \`* { margin: 0; box-sizing: border-box; }
      body { background: #0b0d12; color: #f5f0e6; font-family: system-ui, sans-serif; }
      .scene-root {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        background: var(--art-bg, #0b0d12);
        color: var(--art-ink, #f5f0e6);
      }
      .scaffold-card {
        width: min(70%, 720px);
        padding: 48px 56px;
        border-radius: 28px;
        border: 1px solid rgba(255,255,255,.12);
        background: linear-gradient(160deg, #171a24, #0f121a);
        box-shadow: 0 40px 80px rgba(0,0,0,.35);
      }
      .scaffold-card h1 { font-size: 56px; letter-spacing: -0.03em; }
      .scaffold-card p { margin-top: 12px; opacity: .7; font-size: 22px; }
      .art-caption-stack {
        position: absolute;
        left: 6.5%;
        right: 6.5%;
        bottom: 7%;
        min-height: 80px;
        pointer-events: none;
      }
      .art-caption {
        position: absolute;
        left: 0;
        bottom: 0;
        max-width: 720px;
        font: 500 42px/1.05 system-ui, sans-serif;
        letter-spacing: -0.03em;
        text-shadow: 0 6px 30px rgba(0,0,0,.28);
      }\`;

export default defineInteractive({
  guide: {
    id: "${name}",
    steps: ACTS.map((id) => ({
      id,
      label: id === "intro" ? "Intro" : "Hold",
      duration: "3s",
      scene: { state: id },
      focusNodeId: "card",
    })),
  },
  sample: { edition: "${pascal}", debugOverlay: false },
  render(ctx) {
    const { scene, std, timeline, width, height, data } = ctx;
    const floatY = std.oscillate(timeline.seconds, { period: "3s", from: -8, to: 8 });
    const quiet = {
      card: { opacity: 1, transform: { y: 0, scale: 1 } },
    };

    scene.states({
      intro: {
        nodes: {
          ...focusOn(quiet, {
            card: { opacity: 1, transform: { y: 24, scale: 0.96 } },
          }),
          ...captionStates(ACTS, "intro"),
        },
        camera: centeredCamera(width, height, {
          zoom: 1,
          fit: { target: "card", padding: 80 },
        }),
      },
      hold: {
        nodes: {
          ...focusOn(quiet, {
            card: { opacity: 1, transform: { y: 0, scale: 1 } },
          }),
          ...captionStates(ACTS, "hold"),
        },
        camera: centeredCamera(width, height, {
          zoom: 1.06,
          fit: { target: "card", padding: 64 },
        }),
      },
    });

    const card = scene.node(
      "card",
      \`<div class="scaffold-card" style="transform: translateY(\${floatY.toFixed(2)}px)">
        <h1>\${data.edition ?? "${pascal}"}</h1>
        <p>Scaffolded semantic scene — replace me.</p>
      </div>\`,
      { kind: "panel", role: "subject", parent: "story" },
    );

    const captionHtml = ACTS.map((id) =>
      scene.node(
        \`caption.\${id}\`,
        \`<div class="art-caption">\${id}</div>\`,
        { kind: "caption", role: "narration", parent: "caption", space: "screen" },
      ),
    ).join("");

    const debugClass = data.debugOverlay ? " is-debug" : "";
    const storyLayer = scene.layer(
      "story",
      \`<div class="art-story">\${card}</div>\`,
      { role: "narrative", space: "world" },
    );
    const captionLayer = scene.layer(
      "caption",
      \`<div class="art-caption-stack">\${captionHtml}</div>\`,
      { role: "narration", space: "screen" },
    );
    return \`<style>\${inlineCss}</style><div class="scene-root\${debugClass}" style="\${std.css({ width, height }, std.css.center())}">
      \${storyLayer}
      \${captionLayer}
    </div>\`;
  },
});
`;

const renderer = `import { createSurfaceRenderer } from "../../kit/surface-renderer";

export const ${name.replace(/-/g, "_")}Profiles = {
  default: \`
    :root {
      --art-bg: #0b0d12;
      --art-bg-2: #171a24;
      --art-ink: #f5f0e6;
      --art-muted: rgba(245, 240, 230, .6);
      --art-accent: #ff7658;
      --art-accent-2: #70e8d0;
      --art-accent-3: #8f7cff;
      --art-line: rgba(245, 240, 230, .2);
      --art-grid: rgba(255,255,255,.04);
      --art-glow: rgba(255, 118, 88, .3);
      --art-blend: screen;
    }
  \`,
} as const;

export const ${name.replace(/-/g, "_")}Renderer = createSurfaceRenderer({
  id: "${name}-v1",
  profiles: ${name.replace(/-/g, "_")}Profiles,
  defaultProfile: "default",
  debugNodeLabels: true,
});
`;

const artwork = `import { defineArtwork } from "../../kit/artwork";
import template from "./${name}.media";
import { ${name.replace(/-/g, "_")}Profiles, ${name.replace(/-/g, "_")}Renderer } from "./renderer";

export const ${name.replace(/-/g, "")}Artwork = defineArtwork({
  id: "${name}",
  template,
  renderer: ${name.replace(/-/g, "_")}Renderer,
  acts: [
    { id: "intro", numeral: "01", label: "Intro", note: "Enter the frame.", focus: "card" },
    { id: "hold", numeral: "02", label: "Hold", note: "Settle the reading.", focus: "card" },
  ],
  surfaces: [{ id: "default", label: "Default", swatch: "#ff7658" }],
  roleFilters: [{ role: "subject", label: "subject" }, { role: "narration", label: "narration" }],
  defaultSurface: "default",
  editions: [
    { id: "landscape", label: "Landscape", glyph: "▰", width: 1440, height: 960 },
  ],
  defaultEdition: "landscape",
  resetCamera: { x: 0, y: 0, zoom: 1, rotation: 0, fit: null, follow: null },
  surfaceCss: ${name.replace(/-/g, "_")}Profiles,
  requiredNodes: ["card", "caption.intro", "caption.hold"],
  exclusiveParent: "caption",
  meta: {
    title: "${pascal}",
    eyebrow: "Scaffolded artwork",
    synopsis: "Replace this scaffold with a real semantic scene.",
    description: "Generated by just new-artwork ${name}.",
  },
});
`;

const test = `import { describe, expect, it } from "vitest";
import { lowerInteractiveDefinition } from "@foxworth/superimg/interactive/define";
import { assertSurfaceCssVarParity } from "../../kit/surface-renderer";
import { ${name.replace(/-/g, "")}Artwork } from "./artwork";
import template from "./${name}.media";
import { ${name.replace(/-/g, "_")}Profiles, ${name.replace(/-/g, "_")}Renderer } from "./renderer";

describe("${pascal} interactive contract", () => {
  it("is singular and follows its declared acts", () => {
    expect(template.kind).toBe("interactive");
    expect(template.guide.steps.map((step) => step.id)).toEqual(
      ${name.replace(/-/g, "")}Artwork.acts.map((act) => act.id),
    );
    expect(template).not.toHaveProperty("entries");
  });

  it("lowers through the explicit interactive package", () => {
    const runtime = lowerInteractiveDefinition(template, {
      sceneRenderer: ${name.replace(/-/g, "_")}Renderer,
      sceneStyle: ${name.replace(/-/g, "")}Artwork.defaultSurface,
    });
    expect(runtime.config?.duration).toBe("6s");
    assertSurfaceCssVarParity(${name.replace(/-/g, "_")}Profiles);
  });
});
`;

fs.writeFileSync(path.join(dir, `${name}.media.ts`), media);
fs.writeFileSync(path.join(dir, "renderer.ts"), renderer);
fs.writeFileSync(path.join(dir, "artwork.ts"), artwork);
fs.writeFileSync(path.join(dir, `${name}.test.ts`), test);

console.log(`Created artwork scaffold at apps/scene-studio/src/artworks/${name}/`);
console.log("");
console.log("Register it in apps/scene-studio/src/artworks/index.ts:");
console.log(`  import { ${name.replace(/-/g, "")}Artwork } from "./${name}/artwork";`);
console.log(`  export const ARTWORKS = [livingCanvasArtwork, ${name.replace(/-/g, "")}Artwork];`);
console.log("");
console.log("Then run: pnpm --filter @superimg/scene-studio test");
