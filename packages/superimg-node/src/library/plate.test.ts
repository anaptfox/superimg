import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, symlink, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { preparePlate } from "./plate.js";

describe("preparePlate", () => {
  it("produces an atlas and a matching portable manifest from a real clip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "plate-test-"));
    try {
      const input = join(dir, "clip.mp4");
      execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=red:s=32x24:r=4:d=1", "-pix_fmt", "yuv420p", input]);
      const { manifest, atlas } = await preparePlate(input);
      const metadata = await sharp(atlas).metadata();
      expect(manifest.compiled.totalFrames).toBe(4);
      expect(manifest.atlas.sheets).toEqual([{ file: "frames/sheet-000.webp", startFrame: 0, frameCount: 4 }]);
      expect(metadata.width).toBe(manifest.atlas.columns * manifest.atlas.tileWidth);
      expect(metadata.height).toBe(manifest.atlas.rows * manifest.atlas.tileHeight);
      expect(await readdir(dir)).toEqual(["clip.mp4"]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("rejects an already cancelled operation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(preparePlate("missing.mp4", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
  it("removes temporary frames when extraction is cancelled", async () => {
    const dir = await mkdtemp(join(tmpdir(), "plate-cancel-test-"));
    const originalPath = process.env.PATH;
    const before = new Set((await readdir(tmpdir())).filter((name) => name.startsWith("superimg-plate-")));
    try {
      const input = join(dir, "clip.mp4");
      execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=red:s=32x24:r=4:d=1", "-pix_fmt", "yuv420p", input]);
      const probe = execFileSync("which", ["ffprobe"], { encoding: "utf8" }).trim();
      await symlink(probe, join(dir, "ffprobe"));
      await writeFile(join(dir, "ffmpeg"), `#!/bin/sh\n/usr/bin/touch '${dir}/started'\nexec /bin/sleep 30\n`, { mode: 0o755 });
      process.env.PATH = dir;
      const controller = new AbortController();
      const pending = preparePlate(input, { signal: controller.signal });
      for (let i = 0; i < 200; i++) {
        if (await access(join(dir, "started")).then(() => true, () => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await access(join(dir, "started"));
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      const remaining = (await readdir(tmpdir())).filter((name) => name.startsWith("superimg-plate-") && !before.has(name));
      expect(remaining).toEqual([]);
    } finally {
      process.env.PATH = originalPath;
      await rm(dir, { recursive: true, force: true });
    }
  });

});
