import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RenderEngine, TemplateBundle } from "@superimg/types";
import type { ParsedTemplate } from "../cli/utils/template-config.js";
import type { ManifestEntry } from "../render-from-bundle.js";

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

vi.mock("@superimg/core/engine", () => ({
  createRenderPlan: vi.fn().mockReturnValue({}),
  executeRenderPlan: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
}));

vi.mock("../utils/build-render-job.js", () => ({
  buildRenderJob: vi.fn().mockReturnValue({
    job: { encoding: undefined, audio: undefined },
    resolvedAssets: [],
  }),
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

function makeManifestEntry(): ManifestEntry {
  const bundle: TemplateBundle = {
    code: "export default {}",
    sourceMap: { version: 3, sources: [], names: [], mappings: "" },
    sourceFile: "/fake/template.ts",
  };
  const parsed: ParsedTemplate = {
    templateCode: "",
    metasample: { hasRenderExport: true, hasDefaultExport: false },
    medium: "html",
    animated: true,
    templateConfig: { fps: 30, duration: 4 },
    resolvedAssets: [],
    config: { width: 1920, height: 1080 },
  };
  return { bundle, parsed };
}

describe("renderFromBundle — engine injection seam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("owns the engine lifecycle when no engine is provided", async () => {
    const { renderFromBundle } = await import("../render-from-bundle.js");

    await renderFromBundle(makeManifestEntry());

    expect(defaultMockEngine.init).toHaveBeenCalledOnce();
    expect(defaultMockEngine.dispose).toHaveBeenCalledOnce();
  });

  it("skips init() and dispose() when an engine is injected", async () => {
    const { renderFromBundle } = await import("../render-from-bundle.js");
    const engine = makeMockEngine();

    await renderFromBundle(makeManifestEntry(), { engine });

    expect(engine.init).not.toHaveBeenCalled();
    expect(engine.dispose).not.toHaveBeenCalled();
  });

  it("calls getBaseUrl() on the injected engine", async () => {
    const { renderFromBundle } = await import("../render-from-bundle.js");
    const engine = makeMockEngine();

    await renderFromBundle(makeManifestEntry(), { engine });

    expect(engine.getBaseUrl).toHaveBeenCalled();
  });

  it("passes empty autoDiscovered and blank templateDir to buildRenderJob", async () => {
    const { buildRenderJob } = await import("../utils/build-render-job.js");
    const { renderFromBundle } = await import("../render-from-bundle.js");

    await renderFromBundle(makeManifestEntry(), { engine: makeMockEngine() });

    expect(vi.mocked(buildRenderJob)).toHaveBeenCalledWith(
      expect.objectContaining({ autoDiscovered: [], templateDir: "" })
    );
  });

  it("passes the manifest bundle and parsed into buildRenderJob", async () => {
    const { buildRenderJob } = await import("../utils/build-render-job.js");
    const { renderFromBundle } = await import("../render-from-bundle.js");
    const entry = makeManifestEntry();

    await renderFromBundle(entry, { engine: makeMockEngine() });

    expect(vi.mocked(buildRenderJob)).toHaveBeenCalledWith(
      expect.objectContaining({ templateBundle: entry.bundle, parsed: entry.parsed })
    );
  });

  it("returns the bytes from executeRenderPlan", async () => {
    const { renderFromBundle } = await import("../render-from-bundle.js");

    const result = await renderFromBundle(makeManifestEntry(), { engine: makeMockEngine() });

    expect(result).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("disposes the owned engine even if rendering throws", async () => {
    const { executeRenderPlan } = await import("@superimg/core/engine");
    vi.mocked(executeRenderPlan).mockRejectedValueOnce(new Error("render boom"));

    const { renderFromBundle } = await import("../render-from-bundle.js");

    await expect(renderFromBundle(makeManifestEntry())).rejects.toThrow("render boom");

    expect(defaultMockEngine.dispose).toHaveBeenCalledOnce();
  });

  it("does NOT dispose the injected engine if rendering throws", async () => {
    const { executeRenderPlan } = await import("@superimg/core/engine");
    vi.mocked(executeRenderPlan).mockRejectedValueOnce(new Error("render boom"));

    const { renderFromBundle } = await import("../render-from-bundle.js");
    const engine = makeMockEngine();

    await expect(renderFromBundle(makeManifestEntry(), { engine })).rejects.toThrow("render boom");

    expect(engine.dispose).not.toHaveBeenCalled();
  });
});
