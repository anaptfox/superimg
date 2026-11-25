import { describe, expect, it, vi } from "vitest";
import { plateManifestHref, syncPlateMedia } from "./plate-sync.js";

describe("plateManifestHref", () => {
  it("keeps an explicit manifest path", () => {
    expect(plateManifestHref(".superimg/plates/mascot/manifest.json", undefined))
      .toBe(".superimg/plates/mascot/manifest.json");
  });

  it("maps a clip filename to the compiled atlas manifest", () => {
    expect(plateManifestHref("mascot.mp4", undefined))
      .toBe(".superimg/plates/mascot/manifest.json");
  });

  it("lets the host resolve the manifest path", () => {
    expect(plateManifestHref("mascot.mp4", (file) => `/cdn/${file}`))
      .toBe("/cdn/.superimg/plates/mascot/manifest.json");
  });

  it("uses provided target indices and rejects stale asynchronous resource paints", async () => {
    const root = document.createElement("div");
    const node = document.createElement("div");
    node.setAttribute("data-superimg-plate", "freshness-test.mp4");
    root.appendChild(node);
    const queries = vi.spyOn(root, "querySelectorAll");
    const releases = new Map<string, (value: unknown) => void>();
    vi.stubGlobal("fetch", vi.fn((href: string) => new Promise((resolve) => { releases.set(href, resolve); })));
    class ImmediateImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      value = "";
      get src(): string { return this.value; }
      set src(value: string) { this.value = value; queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", ImmediateImage);
    const response = { ok: true, json: async () => ({
      compiled: { fps: 10, totalFrames: 10, width: 100, height: 100 },
      atlas: { columns: 2, rows: 5, sheets: [{ file: "sheet.png", startFrame: 0, frameCount: 10 }] },
    }) };
    try {
      syncPlateMedia(root, 1, () => "/old/manifest.json", [node]);
      syncPlateMedia(root, 4, () => "/new/manifest.json", [node]);
      for (let frame = 5; frame <= 9; frame++) syncPlateMedia(root, frame, () => "/new/manifest.json", [node]);
      expect(queries).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(2);
      releases.get("/new/manifest.json")!(response);
      await vi.waitFor(() => expect(node.style.backgroundImage).toContain("/new/sheet.png"));
      expect(node.style.backgroundPosition).toBe("-100% -400%");
      releases.get("/old/manifest.json")!(response);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(node.style.backgroundImage).toContain("/new/sheet.png");
      expect(node.style.backgroundPosition).toBe("-100% -400%");
    } finally { vi.unstubAllGlobals(); }
  });
});
