import { describe, expect, it, vi } from "vitest";
import type { MediaSurface } from "@superimg/media";
import { captureSurfaceFrame, requireSurfaceElement, type BrowserCaptureBackend } from "./capture.js";

describe("browser capture backend boundary", () => {
  it("captures through a mounted MediaSurface element", async () => {
    const element = document.createElement("div");
    const backend: BrowserCaptureBackend = {
      warmup: vi.fn(),
      capture: vi.fn(async () => new ImageData(2, 2)),
    };
    const surface: MediaSurface = {
      kind: "dom",
      getElement: () => element,
    };

    const imageData = await captureSurfaceFrame(backend, surface, {
      width: 2,
      height: 2,
    });

    expect(imageData.width).toBe(2);
    expect(backend.capture).toHaveBeenCalledWith(element, { width: 2, height: 2 });
  });

  it("fails clearly when MediaSession has no capture surface", () => {
    expect(() => requireSurfaceElement(null)).toThrow(/no mounted DOM surface/i);
  });
});
