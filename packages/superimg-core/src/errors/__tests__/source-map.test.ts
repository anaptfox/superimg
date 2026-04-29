import { describe, it, expect } from "vitest";
import {
  parseStackTrace,
  mapFrame,
  findUserFrame,
} from "../source-map.js";
import { extractInlineSourceMap } from "../../bundler/bundler.js";

describe("parseStackTrace", () => {
  it("parses standard V8 frames with fn name and (file:line:col)", () => {
    const err = new Error("boom");
    err.stack = [
      "Error: boom",
      "    at fooBar (/Users/x/proj/src/file.ts:10:5)",
      "    at Module._compile (node:internal/modules:123:45)",
    ].join("\n");

    const frames = parseStackTrace(err);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({
      file: "/Users/x/proj/src/file.ts",
      line: 10,
      column: 5,
      fnName: "fooBar",
      kind: "user",
    });
    expect(frames[1]).toMatchObject({
      file: "node:internal/modules",
      kind: "internal",
    });
  });

  it("parses anonymous frames from `new Function` (V8 wraps as eval)", () => {
    const err = new Error("inside eval");
    // Real V8 output for an error thrown inside `new Function(code)()`.
    err.stack = [
      "Error: inside eval",
      "    at eval (eval at compileTemplate (/path/compiler.ts:20:5), <anonymous>:5:7)",
      "    at compileTemplate (/path/compiler.ts:20:5)",
    ].join("\n");

    const frames = parseStackTrace(err);
    // First frame must be the inner <anonymous> position — that's the only useful
    // location we have for sourcemap mapping back to user code.
    expect(frames[0]).toMatchObject({
      file: "<anonymous>",
      line: 5,
      column: 7,
      kind: "eval",
      isEval: true,
    });
  });

  it("classifies @superimg framework frames", () => {
    const err = new Error("x");
    err.stack = [
      "Error: x",
      "    at safeRender (/repo/packages/superimg-core/dist/engine.js:42:13)",
      "    at handler (/repo/node_modules/@superimg/player/dist/player.js:99:7)",
    ].join("\n");

    const frames = parseStackTrace(err);
    expect(frames[0]?.kind).toBe("framework");
    expect(frames[1]?.kind).toBe("framework");
  });

  it("classifies blob: URLs (Blob-imported modules in browser dev UI) as eval", () => {
    // Real Chrome stack line for an error inside a Blob-URL module import.
    const err = new Error("x");
    err.stack = [
      "Error: x",
      "    at userFn (blob:http://localhost:3000/abc-uuid:5:7)",
    ].join("\n");

    const frames = parseStackTrace(err);
    expect(frames[0]).toMatchObject({
      file: "blob:http://localhost:3000/abc-uuid",
      line: 5,
      column: 7,
      kind: "eval",
    });
  });

  it("classifies data: URLs as eval", () => {
    const err = new Error("x");
    err.stack = [
      "Error: x",
      "    at fn (data:text/javascript;base64,Zm9v:1:1)",
    ].join("\n");

    const frames = parseStackTrace(err);
    expect(frames[0]?.kind).toBe("eval");
  });

  it("returns empty array when stack is missing", () => {
    const err = new Error("no stack");
    err.stack = undefined;
    expect(parseStackTrace(err)).toEqual([]);
  });
});

describe("extractInlineSourceMap + mapFrame end-to-end through new Function()", () => {
  it("maps an <anonymous> frame back to original source", async () => {
    // Use the real bundler so we exercise the whole pipeline.
    const { bundleTemplateCodeWithMap } = await import("../../bundler/bundler.js");

    const userSource = `import { defineScene } from "superimg";

export default defineScene({
  render(ctx) {
    if (ctx.frame === 0) {
      throw new Error("kaboom from line 6");
    }
    return "<div>ok</div>";
  },
});
`;

    const bundled = await bundleTemplateCodeWithMap(userSource, {
      sourcefile: "test.video.ts",
    });

    // Sanity: the bundle has an inline sourcemap.
    expect(extractInlineSourceMap(bundled.code)).toBeTruthy();

    // Run the bundle through `new Function(...)` and capture the thrown error.
    const factory = new Function(bundled.code + "\nreturn __template;");
    const exports = factory();
    const tpl = exports.default;

    let caught: Error | undefined;
    try {
      tpl.render({
        frame: 0,
        globalFrame: 0,
        sceneFrame: 0,
        sceneTimeSeconds: 0,
        sceneProgress: 0,
        globalTimeSeconds: 0,
        fps: 30,
        totalFrames: 1,
        width: 100,
        height: 100,
        data: {},
        outputName: "test",
        assets: {},
      } as any);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeDefined();

    const frames = parseStackTrace(caught!);
    // The top frame should be the eval/anonymous frame from new Function.
    const topEval = frames.find((f) => f.kind === "eval");
    expect(topEval).toBeDefined();

    // Map it through the sourcemap.
    const mapped = mapFrame(topEval!, bundled.sourceMap);
    expect(mapped).toBeDefined();
    // Mapping should point at the test.video.ts source (or the entry source name).
    expect(mapped!.file).toMatch(/test\.video\.ts$/);
    // sourcesContent should be embedded by esbuild.
    expect(mapped!.source).toBeTruthy();
    expect(mapped!.source).toContain("kaboom from line 6");
    // Mapped line should land somewhere inside the render() function body.
    // esbuild's mapping granularity isn't statement-precise, but the line
    // must be within the body (lines 4-8 in our source).
    expect(mapped!.line).toBeGreaterThanOrEqual(4);
    expect(mapped!.line).toBeLessThanOrEqual(8);
  });
});

describe("findUserFrame", () => {
  it("returns first user-classified frame without remapping", () => {
    const err = new Error("x");
    err.stack = [
      "Error: x",
      "    at framework (/repo/packages/superimg-core/dist/engine.js:1:1)",
      "    at userFn (/Users/me/proj/file.ts:42:7)",
    ].join("\n");

    const result = findUserFrame(parseStackTrace(err));
    expect(result?.frame.file).toBe("/Users/me/proj/file.ts");
    expect(result?.mapped).toBeUndefined();
  });

  it("skips framework/internal/node_modules and returns null when no user frame exists", () => {
    const err = new Error("x");
    err.stack = [
      "Error: x",
      "    at f (/repo/packages/superimg-core/dist/engine.js:1:1)",
      "    at g (node:internal/modules:1:1)",
    ].join("\n");

    expect(findUserFrame(parseStackTrace(err))).toBeNull();
  });
});

describe("extractInlineSourceMap", () => {
  it("returns null when no inline map present", () => {
    expect(extractInlineSourceMap("const x = 1;")).toBeNull();
  });

  it("decodes a real inline map from a bundle", async () => {
    const { bundleTemplateCodeWithMap } = await import("../../bundler/bundler.js");
    const bundled = await bundleTemplateCodeWithMap(
      `import { defineScene } from "superimg";\nexport default defineScene({ render: () => "x" });`,
      { sourcefile: "x.video.ts" },
    );
    const map = extractInlineSourceMap(bundled.code);
    expect(map).toBeTruthy();
    expect(map!.version).toBe(3);
    expect(map!.sources.length).toBeGreaterThan(0);
  });
});
