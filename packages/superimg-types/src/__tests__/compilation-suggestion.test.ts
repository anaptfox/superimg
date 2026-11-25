import { describe, expect, it } from "vitest";
import { TemplateCompilationError } from "../results.js";

describe("compilation diagnostic", () => {
  it("suggests the current media-tree return contract", () => {
    const error = new TemplateCompilationError({ syntaxError: "bad token", line: 4 });
    expect(error.suggestion).toContain("line 4");
    expect(error.suggestion).toContain("media tree");
    expect(error.suggestion).not.toContain("returns a string");
  });
  it("preserves a caller's explicit suggestion", () => {
    const error = new TemplateCompilationError({ syntaxError: "bad token", suggestion: "Fix the token" });
    expect(error.suggestion).toBe("Fix the token");
  });
});
