import { describe, it, expect } from "vitest";
import {
  TemplateRuntimeError,
  TemplateCompilationError,
  ValidationError,
  IOError,
} from "@superimg/types";
import { formatError } from "../format.js";

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("formatError", () => {
  it("produces ansi/html/json/plain for TemplateRuntimeError", () => {
    const err = new TemplateRuntimeError({
      frame: 30,
      originalError: "ctx.std.tween is not a function",
      timeContext: {
        sceneFrame: 30,
        sceneTimeSeconds: 1.0,
        sceneProgress: 0.25,
        globalTimeSeconds: 1.0,
      },
      dataSnapshot: { hello: "world" },
    });

    const out = formatError(err);

    expect(stripAnsi(out.ansi)).toContain("TemplateRuntimeError");
    expect(stripAnsi(out.ansi)).toContain("Frame 30");
    expect(stripAnsi(out.ansi)).toContain("Suggestion:");
    expect(out.html).toContain("TemplateRuntimeError");
    expect(out.html).toContain("Frame 30");
    expect(out.json.code).toBe("TEMPLATE_RUNTIME_ERROR");
    expect(out.json.suggestion).toBeTruthy();
    expect(out.plain).toContain("TemplateRuntimeError");
    expect(out.plain).not.toMatch(/\x1b\[/); // no ANSI in plain
  });

  it("renders source location and code frame for compilation errors", () => {
    const err = new TemplateCompilationError({
      file: "/abs/demo.video.ts",
      line: 12,
      column: 4,
      syntaxError: "Unexpected token",
    });
    err.codeFrame = "  10 | foo\n> 12 |   bad\n     |   ^";

    const out = formatError(err);
    expect(stripAnsi(out.ansi)).toContain("/abs/demo.video.ts:12");
    expect(stripAnsi(out.ansi)).toContain("bad");
    expect(out.html).toContain("vscode://file/");
    expect(out.html).toContain("/abs/demo.video.ts");
  });

  it("html escapes unsafe characters in messages", () => {
    const err = new ValidationError({
      field: "<script>alert(1)</script>",
      expectedType: "string",
      receivedValue: 42,
    });
    const out = formatError(err);
    expect(out.html).not.toContain("<script>alert");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("json shape is stable for IOError", () => {
    const err = new IOError({
      operation: "write",
      path: "/no/such/dir/out.mp4",
      originalError: "ENOENT",
    });
    const out = formatError(err);
    expect(out.json).toMatchObject({
      name: "IOError",
      code: "IO_ERROR",
      message: expect.stringContaining("Failed to write"),
      details: expect.objectContaining({ operation: "write" }),
      suggestion: expect.any(String),
    });
  });

  it("wraps plain Error via enrichError before rendering", () => {
    const out = formatError(new Error("raw"));
    expect(out.json.name).toMatch(/TemplateRuntimeError|SuperImgError/);
    expect(out.json.message).toContain("raw");
  });
});
