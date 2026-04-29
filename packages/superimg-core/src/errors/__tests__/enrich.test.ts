import { describe, it, expect } from "vitest";
import {
  SuperImgError,
  TemplateRuntimeError,
  TemplateCompilationError,
} from "@superimg/types";
import { enrichError } from "../enrich.js";
import { bundleTemplateCodeWithMap } from "../../bundler/bundler.js";

describe("enrichError", () => {
  it("augments an existing SuperImgError with mapped location + codeFrame", async () => {
    const userSource = `import { defineScene } from "superimg";

export default defineScene({
  render(ctx) {
    if (ctx.frame === 0) {
      throw new Error("kaboom");
    }
    return "<div>ok</div>";
  },
});
`;
    const bundled = await bundleTemplateCodeWithMap(userSource, {
      sourcefile: "demo.video.ts",
    });

    const factory = new Function(bundled.code + "\nreturn __template;");
    const tpl = factory().default;

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

    // Wrap it in a TemplateRuntimeError as safeRender would, then enrich.
    const tre = new TemplateRuntimeError({
      frame: 0,
      originalError: caught!.message,
    });
    // Carry the original stack so enrichError can map it.
    tre.stack = caught!.stack;

    const enriched = enrichError(tre, {
      sourceMap: bundled.sourceMap,
      sourceFile: bundled.sourceFile,
    });

    expect(enriched).toBeInstanceOf(TemplateRuntimeError);
    expect(enriched.location).toBeDefined();
    expect(enriched.location!.file).toMatch(/demo\.video\.ts$/);
    expect(enriched.codeFrame).toBeTruthy();
    expect(enriched.codeFrame).toContain("kaboom");
  });

  it("wraps an untyped esbuild-shaped error as TemplateCompilationError", () => {
    const fake = new Error('Build failed: ERROR: Unexpected ")"');
    (fake as any).errors = [{ text: 'Unexpected ")"' }];
    const enriched = enrichError(fake);
    expect(enriched).toBeInstanceOf(TemplateCompilationError);
    expect(enriched.message).toContain("Template compilation failed");
  });

  it("extracts location + synthetic code frame from esbuild errors[].location.lineText", () => {
    // Mirrors what esbuild throws on Build failure: BuildFailure with errors[]
    // whose `location` carries file/line/column/lineText/length.
    const fake = new Error('Build failed with 1 error');
    (fake as any).errors = [
      {
        text: "Unexpected token \"return\"",
        location: {
          file: "/abs/path/to/demo.video.ts",
          line: 7,
          column: 4,
          length: 6,
          lineText: "    return '<div>oops</div>';",
        },
      },
    ];

    const enriched = enrichError(fake);
    expect(enriched).toBeInstanceOf(TemplateCompilationError);
    // Specific text wins over the parent "Build failed with 1 error" string.
    expect(enriched.message).toContain('Unexpected token "return"');
    expect(enriched.location).toEqual({
      file: "/abs/path/to/demo.video.ts",
      line: 7,
      column: 4,
    });
    // Synthetic 2-line code frame: gutter line + caret line under the column.
    expect(enriched.codeFrame).toBeTruthy();
    expect(enriched.codeFrame).toContain("> 7 |     return '<div>oops</div>';");
    expect(enriched.codeFrame).toContain("^^^^^^"); // length: 6
  });

  it("prefers full source from sourceCache over single-line lineText for esbuild errors", () => {
    const sourceCache = new Map<string, string>();
    sourceCache.set(
      "/demo.video.ts",
      Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n"),
    );

    const fake = new Error("Build failed");
    (fake as any).errors = [
      {
        text: "syntax",
        location: {
          file: "/demo.video.ts",
          line: 5,
          column: 0,
          lineText: "line 5", // would produce a 2-line frame
        },
      },
    ];

    const enriched = enrichError(fake, { sourceCache });
    // With cache, we render multi-line context (default linesAbove/linesBelow=2).
    expect(enriched.codeFrame).toContain("line 3");
    expect(enriched.codeFrame).toContain("line 7");
  });

  it("maps blob: URL frames through sourceMap (browser dev UI path)", async () => {
    // Build a real bundle so we have a real sourcemap, then synthesize a stack
    // whose top frame is a `blob:` URL pointing at a known generated position.
    const { bundleTemplateCodeWithMap } = await import("../../bundler/bundler.js");
    const userSource = `import { defineScene } from "superimg";

export default defineScene({
  render(ctx) {
    if (ctx.frame === 0) {
      throw new Error("from blob");
    }
    return "<div>x</div>";
  },
});
`;
    const bundled = await bundleTemplateCodeWithMap(userSource, {
      sourcefile: "blob-demo.video.ts",
    });

    // Use the consumer to find any (line, col) pair that maps back to user source.
    const { mapFrame, parseStackTrace } = await import("../source-map.js");
    // Walk a few generated lines until we get a non-null mapping.
    let genLine = 1;
    let genCol = 0;
    let mapped: ReturnType<typeof mapFrame> = null;
    for (let l = 1; l < 100 && !mapped; l++) {
      for (let c = 0; c < 80 && !mapped; c++) {
        const fakeFrame = {
          file: "blob:http://localhost:3000/abc",
          line: l,
          column: c + 1,
          fnName: "",
          kind: "eval" as const,
          isEval: true,
        };
        mapped = mapFrame(fakeFrame, bundled.sourceMap);
        if (mapped) {
          genLine = l;
          genCol = c + 1;
        }
      }
    }
    expect(mapped).toBeTruthy();

    // Build a real Error with a synthetic blob: stack frame.
    const err = new Error("synthetic");
    err.stack = [
      "Error: synthetic",
      `    at fn (blob:http://localhost:3000/abc:${genLine}:${genCol})`,
    ].join("\n");

    // Confirm parseStackTrace classifies the blob frame as eval.
    const frames = parseStackTrace(err);
    expect(frames[0]?.kind).toBe("eval");

    const enriched = enrichError(err, {
      sourceMap: bundled.sourceMap,
      sourceFile: bundled.sourceFile,
    });
    expect(enriched.location?.file).toMatch(/blob-demo\.video\.ts$/);
    expect(enriched.codeFrame).toBeTruthy();
  });

  it("wraps a plain runtime error as TemplateRuntimeError", () => {
    const enriched = enrichError(new Error("boom"));
    expect(enriched).toBeInstanceOf(TemplateRuntimeError);
    expect(enriched).toBeInstanceOf(SuperImgError);
  });

  it("preserves original stack on wrapped errors", () => {
    const original = new Error("boom");
    const stack = original.stack;
    const enriched = enrichError(original);
    expect(enriched.stack).toBe(stack);
  });
});
