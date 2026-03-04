//! Playwright adapters implementing FrameRenderer and VideoEncoder contracts

import type { Page } from "playwright";
import type {
  FrameRendererConfig,
  VideoEncoderConfig,
  FrameRenderer,
  VideoEncoder,
  ResolvedAssetDeclaration,
  AssetMeta,
} from "@superimg/types";
import { buildPageShell } from "@superimg/core/html";
import { resolveAudio } from "@superimg/core";

/**
 * Playwright-based frame renderer.
 * Captures HTML to PNG buffer via browser screenshot.
 */
export class PlaywrightFrameRenderer implements FrameRenderer<Buffer> {
  private width = 0;
  private height = 0;

  constructor(private readonly page: Page) {}

  async init(config: FrameRendererConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;
    await this.page.setViewportSize({ width: config.width, height: config.height });
    const shell = buildPageShell({
      fonts: config.fonts ?? [],
      inlineCss: config.inlineCss ?? [],
      stylesheets: config.stylesheets ?? [],
      tailwind: config.tailwind,
    });
    await this.page.setContent(shell, { waitUntil: "load" });
    await this.page.evaluate(() => document.fonts.ready);
  }

  async captureFrame(html: string, options?: { alpha?: boolean }): Promise<Buffer> {
    await this.page.evaluate(
      (h: string) => {
        const el = document.getElementById("frame");
        if (el) el.innerHTML = h;
      },
      html
    );
    await this.page.evaluate(() => document.fonts.ready);

    const png = await this.page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: this.width, height: this.height },
      omitBackground: options?.alpha === true,
    });

    return Buffer.isBuffer(png) ? png : Buffer.from(png);
  }

  async dispose(): Promise<void> {
    // No-op
  }

  async preloadAssets(
    declarations: ResolvedAssetDeclaration[]
  ): Promise<Record<string, AssetMeta>> {
    if (declarations.length === 0) return {};

    return this.page.evaluate(
      async (decls: ResolvedAssetDeclaration[]) => {
        const result: Record<string, AssetMeta> = {};

        const getHeaders = async (src: string, type: string) => {
          try {
            const res = await fetch(src, { method: "HEAD" });
            return {
              size: parseInt(res.headers.get("content-length") ?? "0", 10) || 0,
              mimeType:
                res.headers.get("content-type")?.split(";")[0]?.trim() ||
                (type === "image" ? "image/png" : type === "video" ? "video/mp4" : "audio/mpeg"),
            };
          } catch {
            return {
              size: 0,
              mimeType: type === "image" ? "image/png" : type === "video" ? "video/mp4" : "audio/mpeg",
            };
          }
        };

        for (const d of decls) {
          try {
            const { size, mimeType } = await getHeaders(d.src, d.type);

            if (d.type === "image") {
              const meta = await new Promise<AssetMeta>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () =>
                  resolve({
                    type: "image",
                    url: d.src,
                    mimeType,
                    size,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                img.onerror = () => reject(new Error(`Failed to load image: ${d.src}`));
                img.src = d.src;
              });
              result[d.key] = meta;
            } else if (d.type === "video") {
              const meta = await new Promise<AssetMeta>((resolve, reject) => {
                const video = document.createElement("video");
                video.crossOrigin = "anonymous";
                video.preload = "metadata";
                video.addEventListener(
                  "loadedmetadata",
                  () => {
                    resolve({
                      type: "video",
                      url: d.src,
                      mimeType,
                      size,
                      width: video.videoWidth,
                      height: video.videoHeight,
                      duration: video.duration,
                    });
                  },
                  { once: true }
                );
                video.addEventListener("error", () => reject(video.error), { once: true });
                video.src = d.src;
              });
              result[d.key] = meta;
            } else {
              const meta = await new Promise<AssetMeta>((resolve, reject) => {
                const audio = new Audio();
                audio.crossOrigin = "anonymous";
                audio.addEventListener(
                  "loadedmetadata",
                  () => {
                    resolve({
                      type: "audio",
                      url: d.src,
                      mimeType,
                      size,
                      duration: audio.duration,
                    });
                  },
                  { once: true }
                );
                audio.addEventListener("error", () => reject(audio.error), { once: true });
                audio.src = d.src;
              });
              result[d.key] = meta;
            }
          } catch (err) {
            console.warn(`[superimg] Failed to load asset ${d.key}:`, err);
            result[d.key] = {
              type: d.type,
              url: d.src,
              mimeType: d.type === "image" ? "image/png" : d.type === "video" ? "video/mp4" : "audio/mpeg",
              size: 0,
              ...(d.type === "image" ? { width: 0, height: 0 } : {}),
              ...(d.type === "video" ? { width: 0, height: 0, duration: 0 } : {}),
              ...(d.type === "audio" ? { duration: 0 } : {}),
            } as AssetMeta;
          }
        }
        return result;
      },
      declarations
    );
  }
}

/**
 * Playwright-based video encoder.
 * Uses browser harness (BrowserEncoder) to encode frames to video.
 */
export class PlaywrightVideoEncoder implements VideoEncoder<Buffer> {
  private width = 0;
  private height = 0;

  constructor(private readonly page: Page) {}

  async init(config: VideoEncoderConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;

    const encoderConfig: Record<string, unknown> = {
      width: config.width,
      height: config.height,
      fps: config.fps,
      encoding: config.encoding,
    };
    if (config.audio) {
      const resolved = resolveAudio(config.audio);
      encoderConfig.audio = resolved;
    }

    await this.page.evaluate(
      async (cfg: Record<string, unknown>) => {
        await (window as unknown as { __superimg: { initEncoder: (c: unknown) => Promise<void> } }).__superimg.initEncoder(cfg);
      },
      encoderConfig
    );
  }

  async addFrame(frame: Buffer, timestamp: number): Promise<void> {
    const b64 = frame.toString("base64");
    await this.page.evaluate(
      async (args: { b64: string; ts: number }) => {
        await (window as unknown as { __superimg: { addFrame: (b64: string, ts: number) => Promise<void> } }).__superimg.addFrame(args.b64, args.ts);
      },
      { b64, ts: timestamp }
    );
  }

  async finalize(): Promise<Uint8Array> {
    const result = await this.page.evaluate(async () => {
      return await (window as unknown as { __superimg: { finalize: () => Promise<Uint8Array> } }).__superimg.finalize();
    });
    return new Uint8Array(result);
  }

  async dispose(): Promise<void> {
    // No-op
  }
}
