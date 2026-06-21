import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RenderEngine } from "@superimg/types";

// vi.mock factories are hoisted before variable declarations, so shared state
// that the factory needs must be declared via vi.hoisted().
const defaultMockEngine = vi.hoisted(() => ({
  init: vi.fn().mockResolvedValue(undefined),
  getBaseUrl: vi.fn().mockReturnValue("http://localhost:9999"),
  createAdapters: vi.fn().mockReturnValue({ renderer: {}, encoder: {} }),
  dispose: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@superimg/playwright", () => ({
  PlaywrightEngine: vi.fn().mockImplementation(function () {
    return defaultMockEngine;
  }),
}));

vi.mock("@superimg/core/bundler", () => ({
  bundleTemplateWithMap: vi.fn().mockResolvedValue({
    code: "export default {}",
    sourceMap: { version: 3, sources: [], names: [], mappings: "" },
    sourceFile: "/fake/template.ts",
  }),
}));

vi.mock("@superimg/core/engine", () => ({
  createRenderPlan: vi.fn().mockReturnValue({}),
  executeRenderPlan: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

vi.mock("../cli/utils/template-config.js", () => ({
  parseTemplate: vi.fn().mockResolvedValue({
    templateCode: "",
    metasample: { hasRenderExport: true, hasDefaultExport: false },
    templateConfig: {},
    resolvedAssets: [],
    config: {},
  }),
}));

vi.mock("../cli/utils/merge-encoding.js", () => ({
  mergeEncoding: vi.fn().mockReturnValue(undefined),
}));

vi.mock("../cli/utils/load-companion-data.js", () => ({
  loadCompanionData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../cli/utils/asset-discovery.js", () => ({
  discoverTemplateAssets: vi.fn().mockReturnValue([]),
}));

vi.mock("../utils/build-render-job.js", () => ({
  buildRenderJob: vi.fn().mockReturnValue({
    job: { encoding: undefined, audio: undefined },
    resolvedAssets: [],
  }),
}));

vi.mock("../utils/fs.js", () => ({
  writeFileRecursive: vi.fn(),
}));

function makeMockEngine(overrides?: Partial<RenderEngine>): RenderEngine {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    getBaseUrl: vi.fn().mockReturnValue("http://localhost:9999"),
    createAdapters: vi.fn().mockReturnValue({ renderer: {}, encoder: {} }),
    dispose: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("renderVideo — engine injection seam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("owns the engine lifecycle when no engine is provided", async () => {
    const { renderVideo } = await import("../render-video.js");

    await renderVideo("/fake/template.video.ts");

    expect(defaultMockEngine.init).toHaveBeenCalledOnce();
    expect(defaultMockEngine.dispose).toHaveBeenCalledOnce();
  });

  it("skips init() and dispose() when an engine is injected", async () => {
    const { renderVideo } = await import("../render-video.js");
    const engine = makeMockEngine();

    await renderVideo("/fake/template.video.ts", { engine });

    expect(engine.init).not.toHaveBeenCalled();
    expect(engine.dispose).not.toHaveBeenCalled();
  });

  it("calls getBaseUrl() on the injected engine", async () => {
    const { renderVideo } = await import("../render-video.js");
    const engine = makeMockEngine();

    await renderVideo("/fake/template.video.ts", { engine });

    expect(engine.getBaseUrl).toHaveBeenCalled();
  });

  it("returns the bytes from executeRenderPlan", async () => {
    const { renderVideo } = await import("../render-video.js");
    const engine = makeMockEngine();

    const result = await renderVideo("/fake/template.video.ts", { engine });

    expect(result).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("disposes the owned engine even if rendering throws", async () => {
    const { executeRenderPlan } = await import("@superimg/core/engine");
    vi.mocked(executeRenderPlan).mockRejectedValueOnce(new Error("render boom"));

    const { renderVideo } = await import("../render-video.js");

    await expect(renderVideo("/fake/template.video.ts")).rejects.toThrow("render boom");

    expect(defaultMockEngine.dispose).toHaveBeenCalledOnce();
  });

  it("does NOT dispose the injected engine if rendering throws", async () => {
    const { executeRenderPlan } = await import("@superimg/core/engine");
    vi.mocked(executeRenderPlan).mockRejectedValueOnce(new Error("render boom"));

    const { renderVideo } = await import("../render-video.js");
    const engine = makeMockEngine();

    await expect(renderVideo("/fake/template.video.ts", { engine })).rejects.toThrow("render boom");

    expect(engine.dispose).not.toHaveBeenCalled();
  });
});
