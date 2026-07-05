import { describe, expect, it, vi } from "vitest";
import type { MediaSession } from "@superimg/media";
import { createBrowserExporter } from "./exporter.js";
import type { BrowserCaptureBackend } from "./capture.js";

describe("createBrowserExporter", () => {
  it("renders the requested MediaSession frame before capture", async () => {
    const element = document.createElement("div");
    const session = {
      renderFrame: vi.fn(async (frame: number) => ({
        frame,
        html: "",
        compositeHtml: "",
        graph: { nodes: [], deterministicClips: [], externalEmbeds: [] },
      })),
      getSurface: () => ({
        kind: "dom",
        getElement: () => element,
      }),
    } as unknown as MediaSession;
    const backend: BrowserCaptureBackend = {
      warmup: vi.fn(),
      capture: vi.fn(async () => new ImageData(4, 3)),
    };

    const exporter = createBrowserExporter(session, {
      width: 4,
      height: 3,
      backend,
    });
    const frame = await exporter.captureFrame(7);

    expect(frame.width).toBe(4);
    expect(session.renderFrame).toHaveBeenCalledWith(7);
    expect(backend.capture).toHaveBeenCalledWith(element, { width: 4, height: 3 });
  });
});
