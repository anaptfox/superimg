import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { preparePlate } from "../../superimg-node/src/library/plate.js";
import { syncPlateMedia } from "./plate-sync.js";

it("paints a frame using a real prepared plate manifest and atlas", async () => {
  const dir = await mkdtemp(join(tmpdir(), "plate-playback-"));
  try {
    const input = join(dir, "fixture.mp4");
    execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=red:s=32x24:r=4:d=1", "-pix_fmt", "yuv420p", input]);
    const { manifest, atlas } = await preparePlate(input);
    const root = document.createElement("div");
    const node = document.createElement("div");
    node.setAttribute("data-superimg-plate", "fixture.mp4");
    root.append(node);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => manifest })));
    class ImageStub {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      value = "";
      get src(): string { return this.value; }
      set src(value: string) {
        this.value = value;
        expect(value).toBe(`/fixture/${manifest.atlas.sheets[0]!.file}`);
        expect(atlas.subarray(0, 4).toString()).toBe("RIFF");
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", ImageStub);
    syncPlateMedia(root, 3, () => "/fixture/manifest.json");
    await vi.waitFor(() => expect(node.style.backgroundImage).toContain("/fixture/frames/sheet-000.webp"));
    expect(node.style.backgroundPosition).toBe("-300% 0%");
  } finally { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); }
});
