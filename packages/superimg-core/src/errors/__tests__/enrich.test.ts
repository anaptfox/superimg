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
        sample: {},
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

  it("wraps an untyped rolldown-shaped error as TemplateCompilationError", () => {
    const fake = new Error('Transform failed: Unexpected ")"');
    (fake as any).loc = { file: "test.ts", line: 1, column: 1 };
    const enriched = enrichError(fake);
    expect(enriched).toBeInstanceOf(TemplateCompilationError);
    expect(enriched.message).toContain("Template compilation failed");
  });

  it("extracts location + synthetic code frame from rolldown error loc and frame", () => {
    // Mirrors what rolldown throws on Build failure
    const fake = new Error('Unexpected token "return"');
    (fake as any).loc = {
      file: "/abs/path/to/demo.video.ts",
      line: 7,
      column: 4,
    };
    (fake as any).frame = "> 7 |     return '<div>oops</div>';\n    |    ^";

    const enriched = enrichError(fake);
    expect(enriched).toBeInstanceOf(TemplateCompilationError);
    expect(enriched.message).toContain('Unexpected token "return"');
    expect(enriched.location).toEqual({
      file: "/abs/path/to/demo.video.ts",
      line: 7,
      column: 4,
    });
    // Synthetic code frame comes directly from rolldown's frame.
    expect(enriched.codeFrame).toBeTruthy();
    expect(enriched.codeFrame).toContain("> 7 |     return '<div>oops</div>';");
    expect(enriched.codeFrame).toContain("^");
  });

  it("prefers full source from sourceCache over rolldown frame", () => {
    const sourceCache = new Map<string, string>();
    sourceCache.set(
      "/demo.video.ts",
      Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n"),
    );

    const fake = new Error("Transform failed");
    (fake as any).loc = {
      file: "/demo.video.ts",
      line: 5,
      column: 0,
    };
    (fake as any).frame = "> 5 | line 5\n    | ^"; // single line frame

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

    // Find a (line, col) pair that maps back to user source. The bundle size is
    // implementation-defined — Rolldown inlines dependencies, so the user-mapped
    // region can sit thousands of lines in. Anchor the search on the generated
    // line of the `throw` rather than assuming it lands in the first N lines.
    const { mapFrame, parseStackTrace } = await import("../source-map.js");
    const genLines = bundled.code.split("\n");
    const genLine = genLines.findIndex((l) => l.includes("from blob")) + 1;
    expect(genLine).toBeGreaterThan(0);
    let genCol = 0;
    let mapped: ReturnType<typeof mapFrame> = null;
    for (let c = 0; c < 200 && !mapped; c++) {
      const fakeFrame = {
        file: "blob:http://localhost:3000/abc",
        line: genLine,
        column: c + 1,
        fnName: "",
        kind: "eval" as const,
        isEval: true,
      };
      mapped = mapFrame(fakeFrame, bundled.sourceMap);
      if (mapped) {
        genCol = c + 1;
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
