import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ generate: vi.fn(), rolldown: vi.fn() }));
vi.mock("@rolldown/browser", () => ({ VERSION: "test", rolldown: mock.rolldown }));
import { bundleTemplateBrowser, initBundler } from "./browser.js";
const source = 'import { image, Text } from "@foxworth/superimg"; export default image({ render: () => Text("ready") });';
const failure = () => new AggregateError([{ code: "MISSING_EXPORT", message: '"lower" is not exported by "\0superimg-virtual", imported by "stdin.ts"', loc: { file: "stdin.ts", line: 1, column: 14 } }], "Build failed");
beforeEach(() => {
  mock.generate.mockReset(); mock.rolldown.mockReset();
  mock.generate.mockResolvedValue({ output: [{ type: "chunk", code: "bundled", map: { version: 3, sources: [], mappings: "" } }] });
  mock.rolldown.mockImplementation(async (options) => {
    if (options.input !== "\0warmup") options.onLog("warn", { code: "PLUGIN_WARNING", message: "authoring warning", plugin: "test" }, () => {});
    return { generate: mock.generate, close: async () => {} };
  });
});
describe("browser diagnostic parity", () => {
  it("retains warnings that are quiet on the console", async () => {
    const bundle = await bundleTemplateBrowser(source);
    expect(bundle.diagnostics).toContainEqual(expect.objectContaining({ code: "PLUGIN_WARNING", severity: "warning", plugin: "test" }));
    expect(bundle.inputIdentity).toMatch(/^[a-f0-9]{64}$/);
  });
  it("normalizes a creation-time missing export", async () => {
    await initBundler(); mock.rolldown.mockRejectedValueOnce(failure());
    await expect(bundleTemplateBrowser(source)).rejects.toMatchObject({ code: "TEMPLATE_MISSING_EXPORT", details: { compilerDiagnostics: [expect.objectContaining({ code: "MISSING_EXPORT", line: 1, column: 14 })] } });
  });
  it("normalizes a generate-time missing export identically", async () => {
    mock.generate.mockRejectedValueOnce(failure());
    await expect(bundleTemplateBrowser(source)).rejects.toMatchObject({ code: "TEMPLATE_MISSING_EXPORT", details: { compilerDiagnostics: expect.arrayContaining([
      expect.objectContaining({ code: "MISSING_EXPORT", stage: "resolve", file: "stdin.ts" }),
      expect.objectContaining({ code: "PLUGIN_WARNING", severity: "warning" }),
    ]) } });
  });
  it("rejects a surviving unresolved browser import with source location", async () => {
    mock.rolldown.mockImplementation(async options => {
      options.onLog("warn", { code: "UNRESOLVED_IMPORT", exporter: "missing-browser", id: "stdin.ts", loc: { file: "stdin.ts", line: 1, column: 0 }, message: "unresolved" }, () => {});
      return { generate: async () => ({ output: [{ type: "chunk", imports: ["missing-browser"], dynamicImports: [], code: "", map: { version: 3, sources: [], mappings: "" } }] }), close: async () => {} };
    });
    await expect(bundleTemplateBrowser(source)).rejects.toMatchObject({ code: "UNRESOLVED_IMPORT", message: expect.stringContaining('missing-browser'), details: { compilerDiagnostics: expect.arrayContaining([expect.objectContaining({ stage: "resolve", severity: "error", file: "stdin.ts" })]) } });
  });

});
