import { describe, expect, it } from "vitest";
import { compilerDiagnostics, normalizeCompilerError } from "../compiler-diagnostics.js";
import { bundleTemplateCodeWithMap } from "../../bundler/bundler.js";
import { formatError } from "../format.js";

describe("compiler diagnostics", () => {
  it("keeps every aggregate child, labels, help and plugin with stable coordinates", () => {
    const failure = { errors: [
      { code: "MISSING_EXPORT", message: "missing", loc: { file: "entry.ts", line: 2, column: 0 }, labels: [{ start: 4, end: 8, message: "binding" }], helpMessage: "import an exported name" },
      { code: "PLUGIN_ERROR", message: "failed", plugin: "authoring", loc: { file: "helper.ts", line: 3, column: 5 } },
    ] };
    const normalized = normalizeCompilerError(failure, "generate");
    expect(compilerDiagnostics(normalized, "evaluate")).toEqual([
      expect.objectContaining({ code: "MISSING_EXPORT", stage: "resolve", file: "entry.ts", line: 2, column: 0, help: "import an exported name", labels: [{ start: 4, end: 8, message: "binding" }] }),
      expect.objectContaining({ code: "PLUGIN_ERROR", plugin: "authoring", file: "helper.ts" }),
    ]);
    expect(formatError(normalized).json.details.compilerDiagnostics).toHaveLength(2);
    expect(normalizeCompilerError(normalized, "evaluate")).toBe(normalized);
  });
  it("retains OXC UTF-16 labels and source error code through CLI serialization", async () => {
    const code = '// 😀\nimport { image } from "@foxworth/superimg";\nexport default image({ render: ( });';
    try { await bundleTemplateCodeWithMap(code, { sourcefile: "broken.media.ts" }); throw new Error("Expected parser failure"); }
    catch (error) {
      expect(error).toMatchObject({ code: "MEDIA_SOURCE_PARSE_ERROR" });
      expect(compilerDiagnostics(error, "generate")[0]).toMatchObject({ stage: "source", line: 3, labels: [{ start: code.lastIndexOf("}"), end: code.lastIndexOf("}") + 1 }] });
    }
  });
});
