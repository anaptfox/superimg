import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaSurface } from "@superimg/media";
import { captureSurfaceFrame, requireSurfaceElement, SnapdomCaptureBackend, type BrowserCaptureBackend } from "./capture.js";

const { snapdomMock } = vi.hoisted(() => ({ snapdomMock: vi.fn() }));
vi.mock("@zumer/snapdom", () => ({ snapdom: snapdomMock }));
afterEach(() => { vi.restoreAllMocks(); snapdomMock.mockReset(); });

function raster(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const pixels = new ImageData(width, height);
  pixels.data[0] = 255;
  vi.spyOn(canvas, "getContext").mockReturnValue({ getImageData: () => pixels } as unknown as CanvasRenderingContext2D);
  const toCanvas = vi.fn(async () => canvas);
  snapdomMock.mockResolvedValue({ toCanvas });
  return { canvas, toCanvas, pixels };
}

describe("browser capture backend boundary", () => {
  it("captures through a mounted MediaSurface element", async () => {
    const element = document.createElement("div");
    const backend: BrowserCaptureBackend = { warmup: vi.fn(), capture: vi.fn(async () => new ImageData(2, 2)) };
    const surface: MediaSurface = { kind: "dom", getElement: () => element };
    const imageData = await captureSurfaceFrame(backend, surface, { width: 2, height: 2, dpr: 1 });
    expect(imageData.width).toBe(2);
    expect(backend.capture).toHaveBeenCalledWith(element, { width: 2, height: 2, dpr: 1 });
  });

  it("folds scale into explicit dimensions once and retains default DPR 2", async () => {
    const { canvas } = raster(20, 12);
    const image = await new SnapdomCaptureBackend().capture(document.createElement("div"), { width: 5, height: 3, scale: 2 });
    expect([image.width, image.height]).toEqual([20, 12]);
    expect(snapdomMock).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ width: 10, height: 6, dpr: 2, scale: 1, quality: 1 }));
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it("forwards region and reconciliation through a fresh, observer-free capture", async () => {
    raster(120, 45);
    await new SnapdomCaptureBackend().capture(document.createElement("div"), {
      width: 100, height: 50, dpr: 1.5, region: { x: 10, y: 20, width: 80, height: 30 },
      reconcile: true, burst: true, invalidate: true, fast: false,
    });
    const options = snapdomMock.mock.calls[0]![1];
    expect(options).toMatchObject({ width: 80, height: 30, clip: { x: 10, y: 20, width: 80, height: 30 }, reconcile: true, fast: false, cache: "disabled", invalidate: true, plugins: [] });
    expect(options.filter(document.createElement("div"))).toBe(true);
    expect(options).not.toHaveProperty("burst");
  });

  it("warms resources with a real capture without rasterization or intent hooks", async () => {
    const { toCanvas } = raster(2, 2);
    const backend = new SnapdomCaptureBackend();
    await backend.warmup(document.createElement("div"), { width: 1, height: 1 });
    expect(snapdomMock.mock.calls[0]![1]).toMatchObject({ cache: "soft", embedFonts: true, invalidate: true, filter: expect.any(Function) });
    expect(toCanvas).not.toHaveBeenCalled();
    await backend.dispose();
    await expect(backend.warmup(document.createElement("div"), { width: 1, height: 1 })).rejects.toThrow(/disposed/i);
  });

  it("owns cached bytes and invalidation without retaining raster backing stores", async () => {
    raster(2, 2);
    const backend = new SnapdomCaptureBackend();
    const element = document.createElement("div");
    document.body.append(element);
    try {
      const options = { width: 2, height: 2, dpr: 1, burst: true };
      const first = await backend.capture(element, options);
      first.data[0] = 0;
      const second = await backend.capture(element, options);
      expect(second.data[0]).toBe(255);
      expect(snapdomMock).toHaveBeenCalledTimes(1);
      raster(2, 2);
      await backend.capture(element, { ...options, invalidate: true });
      expect(snapdomMock).toHaveBeenCalledTimes(2);
      await backend.dispose();
      await expect(backend.capture(element, options)).rejects.toThrow(/disposed/i);
    } finally { element.remove(); }
  });

  it("rejects silently downscaled pixels and releases their backing store", async () => {
    const { canvas } = raster(2, 2);
    await expect(new SnapdomCaptureBackend().capture(document.createElement("div"), { width: 10, height: 10, dpr: 1 })).rejects.toThrow(/resized.*captureArtifact/i);
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it("validates output geometry before calling the dependency", async () => {
    await expect(new SnapdomCaptureBackend().capture(document.createElement("div"), { width: 0, height: 10 })).rejects.toThrow(/finite and positive/i);
    expect(snapdomMock).not.toHaveBeenCalled();
  });

  it("fails clearly when MediaSession has no capture surface", () => {
    expect(() => requireSurfaceElement(null)).toThrow(/no mounted DOM surface/i);
  });
});
