import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { fileURLToPath } from "node:url";
import { sync } from "@superimg/stdlib/video";
import { video as mediaVideo, youtube as mediaYoutube } from "@superimg/stdlib/media";
import { PlaywrightRasterizer } from "./adapters.js";
import type { FrameExtractorBackend } from "./frame-extractor.js";
import { FrameExtractor } from "./frame-extractor.js";

// The static backend only needs an existing local path; it never reads video bytes.
const fixturePath = fileURLToPath(import.meta.url);

const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

class StaticPngBackend implements FrameExtractorBackend {
  async extract(): Promise<Buffer> {
    return TINY_PNG;
  }
  async dispose(): Promise<void> {}
}

type InjectClipFrames = (html: string) => Promise<string>;

async function injectClips(html: string): Promise<string> {
  const renderer = new PlaywrightRasterizer({} as Page, false, new FrameExtractor(new StaticPngBackend()));
  return (renderer as unknown as { injectClipFrames: InjectClipFrames }).injectClipFrames(html);
}

describe("PlaywrightRasterizer Html scripts", () => {
  it("re-inserts <script> after innerHTML so export Chromium runs Html() scripts", () => {
    const src = readFileSync(new URL("./adapters.ts", import.meta.url), "utf8");
    expect(src).toContain("el.innerHTML = h");
    expect(src).toContain('el.querySelectorAll("script")');
    expect(src).toContain("old.replaceWith(s)");
  });
});

describe("PlaywrightRasterizer clip injection", () => {
  it("preserves width/height/object-fit style from sync placeholder", async () => {
    const clip = sync(
      { src: fixturePath, at: 1, width: 640, height: 360, objectFit: "cover" },
      30,
    );
    const injected = await injectClips(clip.html);

    expect(injected).toContain('style="width:640px;height:360px;object-fit:cover;display:block"');
    expect(injected).toMatch(/src="data:image\/png;base64,/);
  });

  it("strips clip extraction attrs after injection", async () => {
    const clip = sync({ src: fixturePath, at: 0.5 }, 30);
    const injected = await injectClips(clip.html);

    expect(injected).not.toContain("data-superimg-clip");
    expect(injected).not.toContain("data-src=");
    expect(injected).not.toContain("data-t=");
    expect(injected).not.toContain("data-frame=");
  });

  it("injects frames for native std.media.video markers", async () => {
    const clip = mediaVideo(
      { src: fixturePath, at: 1, width: 640, height: 360, fit: "contain" },
      30,
    );
    const injected = await injectClips(clip.html);

    expect(injected).toContain("<img");
    expect(injected).toContain('style="width:640px;height:360px;object-fit:contain;display:block"');
    expect(injected).toMatch(/src="data:image\/png;base64,/);
    expect(injected).not.toContain("<video");
    expect(injected).not.toContain("data-superimg-clip");
  });

  it("replaces unresolved external embeds with deterministic placeholders", async () => {
    const embed = mediaYoutube({ videoId: "dQw4w9WgXcQ", at: 0, width: 640, height: 360 }, 30);
    const injected = await injectClips(embed.html);

    expect(injected).toContain("youtube embed unavailable for deterministic export");
    expect(injected).not.toContain("<iframe");
    expect(injected).not.toContain("youtube.com/embed");
  });
});
