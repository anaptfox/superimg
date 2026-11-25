/**
 * Package-boundary structural tests for runtime/player/ir vs operations.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");

const FORBIDDEN = [
  "playwright",
  "@mediabunny/server",
  "sharp",
  "ffmpeg",
  "better-sqlite3",
  "node:child_process",
];

function packageJson(): { exports: Record<string, unknown>; bin?: unknown } {
  return JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
    exports: Record<string, unknown>;
    bin?: unknown;
  };
}

describe("superimg package boundaries", () => {
  it("exposes runtime, player, and ir without operations or a bin", () => {
    const pkg = packageJson();
    const exports = pkg.exports;
    expect(exports["./runtime"]).toBeTruthy();
    expect(exports["./runtime/html"]).toBeTruthy();
    expect(exports["./ir"]).toBeTruthy();
    expect(exports["./player"]).toBeTruthy();
    expect(exports["./player/deck"]).toBeUndefined();
    expect(exports["./player/program"]).toBeTruthy();
    expect(exports["./composition/prepare"]).toBeTruthy();
    expect(exports["./operations"]).toBeUndefined();
    expect(pkg.bin).toBeUndefined();
    expect(exports["./media"]).toBeUndefined();
    expect(exports["./render-client"]).toBeUndefined();
    for (const removed of [
      "./define",
      "./node",
      "./browser",
      "./edge",
      "./server",
      "./adapters",
      "./bundler",
      "./compile",
    ]) {
      expect(exports[removed]).toBeUndefined();
    }
    expect(exports["./ir/schema/media-ir.json"]).toBeTruthy();
    expect(exports["./ir/schema/media-ir-v1.json"]).toBeUndefined();
  });

  it("client entry sources avoid forbidden server imports", () => {
    for (const rel of [
      "src/runtime.browser.ts",
      "src/runtime.edge.ts",
      "src/runtime.html.ts",
      "src/index.player.ts",
      "src/index.program.ts",
      "src/index.composition-prepare.ts",
      "src/index.ir.ts",
    ]) {
      const text = readFileSync(join(pkgRoot, rel), "utf8");
      // Strip comments so "no FFmpeg" docs do not false-positive
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const bad of FORBIDDEN) {
        expect(
          code,
          `${rel} must not import ${bad}`,
        ).not.toMatch(
          new RegExp(
            `from\\s+["'][^"']*${bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"']*["']`,
          ),
        );
      }
      expect(code).not.toMatch(/compileMediaArtifact|from ["']@superimg\/core\/ir-node/);
    }
  });

  it("draft schema asset is media-ir.json not v1", () => {
    const schemaSrc = join(
      pkgRoot,
      "../superimg-core/src/ir/pure/media-ir.schema.json",
    );
    expect(existsSync(schemaSrc)).toBe(true);
    const schema = readFileSync(schemaSrc, "utf8");
    expect(schema).toContain('"const": 0');
    expect(schema).not.toContain("media-ir-v1");
  });
});
