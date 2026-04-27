//! Skill contract tests
//!
//! Verify the canonical skill content stays valid as the framework evolves:
//!
//! (a) Every example in skills/superimg/examples/ renders one frame without throwing.
//! (c) Every TypeScript code block inside skills/superimg/SKILL.md transpiles cleanly
//!     (catches syntax errors and obvious typos in the documented patterns).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { createRenderContext } from "@superimg/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const SKILL_ROOT = join(REPO_ROOT, "skills", "superimg");
const EXAMPLES_DIR = join(SKILL_ROOT, "examples");
const SKILL_MD = join(SKILL_ROOT, "SKILL.md");

interface SceneLike {
  data?: Record<string, unknown>;
  config?: { width?: number; height?: number; duration?: number; fps?: number };
  render: (ctx: ReturnType<typeof createRenderContext>) => string;
}

function listExampleFiles(): string[] {
  return readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .map((f) => join(EXAMPLES_DIR, f));
}

async function loadScene(filePath: string): Promise<SceneLike> {
  const mod = await import(pathToFileURL(filePath).href);
  const def = (mod.default ?? mod) as SceneLike;
  if (typeof def?.render !== "function") {
    throw new Error(`Example ${filePath} does not export a SceneDef with .render()`);
  }
  return def;
}

describe("skill contract — examples render", () => {
  const files = listExampleFiles();
  it("examples directory contains files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`renders: ${file.replace(REPO_ROOT, ".")}`, async () => {
      const scene = await loadScene(file);
      const width = scene.config?.width ?? 1920;
      const height = scene.config?.height ?? 1080;
      const fps = scene.config?.fps ?? 30;
      const totalFrames = (scene.config?.duration ?? 3) * fps;
      const ctx = createRenderContext(0, fps, totalFrames, width, height, scene.data ?? {});
      const html = scene.render(ctx);
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
    });
  }
});

describe("skill contract — SKILL.md code blocks compile", () => {
  it("every typescript code block transpiles without diagnostics", () => {
    const md = readFileSync(SKILL_MD, "utf-8");
    const blocks = extractTypescriptBlocks(md);
    expect(blocks.length).toBeGreaterThan(0);

    const failures: { block: number; preview: string; messages: string[] }[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const code = blocks[i] ?? "";
      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          jsx: ts.JsxEmit.Preserve,
          isolatedModules: true,
          allowImportingTsExtensions: false,
        },
        reportDiagnostics: true,
      });
      const errors = (result.diagnostics ?? [])
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
      if (errors.length > 0) {
        failures.push({ block: i + 1, preview: code.slice(0, 120), messages: errors });
      }
    }

    if (failures.length > 0) {
      const detail = failures
        .map((f) => `block #${f.block}\n  preview: ${f.preview}\n  errors:\n    - ${f.messages.join("\n    - ")}`)
        .join("\n\n");
      throw new Error(`SKILL.md has ${failures.length} broken code block(s):\n\n${detail}`);
    }
  });
});

function extractTypescriptBlocks(md: string): string[] {
  const blocks: string[] = [];
  const re = /```(?:typescript|ts)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    if (m[1]) blocks.push(m[1]);
  }
  return blocks;
}
