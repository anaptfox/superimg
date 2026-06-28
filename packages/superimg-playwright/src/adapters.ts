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
import { RenderError } from "@superimg/types";
import { buildPageShell } from "@superimg/core/html";

import { FrameExtractor } from "./frame-extractor.js";
import { preloadThreeModule } from "./three-preload.js";

const CLIP_SYNC_ATTR = "data-superimg-clip";
const CLIP_IMG_RE = /<img\b(?=[^>]*\bdata-superimg-clip\b)[^>]*>/gi;

function getAttr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`);
  const quoted = tag.match(re);
  if (quoted) return quoted[1];
  if (tag.includes(` ${name} `) || tag.endsWith(` ${name}`) || tag.includes(` ${name}>`)) {
    return "";
  }
  return undefined;
}

function buildInjectedImgTag(tag: string, dataUri: string): string {
  const style = getAttr(tag, "style");
  const alt = getAttr(tag, "alt") ?? "";
  const parts = [`<img src="${dataUri}"`];
  if (style !== undefined) parts.push(` style="${style}"`);
  if (alt) parts.push(` alt="${alt}"`);
  parts.push(">");
  return parts.join("");
}

/**
 * Playwright-based frame renderer.
 * Captures HTML to PNG buffer via browser screenshot.
 */
export class PlaywrightFrameRenderer implements FrameRenderer<Buffer> {
  private width = 0;
  private height = 0;
  private fps = 30;
  private mode: 'frame' | 'animation' = 'frame';

  constructor(
    private readonly page: Page,
    /** When true, dispose() closes the browser context so per-render pages don't leak. */
    private readonly closeContextOnDispose = false,
    private readonly frameExtractor: FrameExtractor = new FrameExtractor(),
  ) {}

  async init(config: FrameRendererConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;
    this.fps = config.fps ?? 30;
    this.mode = config.mode ?? 'frame';
    await this.page.setViewportSize({ width: config.width, height: config.height });
    if (this.mode === 'animation') {
      await this.page.clock.install({ time: 0 });
    }
    const shell = buildPageShell({
      fonts: config.fonts ?? [],
      inlineCss: config.inlineCss ?? [],
      stylesheets: config.stylesheets ?? [],
      ...(config.tailwind !== undefined ? { tailwind: config.tailwind } : {}),
    });
    await this.page.setContent(shell, { waitUntil: "load" });
    await preloadThreeModule(this.page);
    await this.page.evaluate(() => document.fonts.ready);
  }

  async advanceClock(ms: number): Promise<void> {
    await this.page.clock.runFor(ms);
  }

  async captureFrame(html: string, options?: { alpha?: boolean }): Promise<Buffer> {
    const injected = await this.injectClipFrames(html);

    await this.page.evaluate(async (h: string) => {
      const el = document.getElementById("frame");
      if (!el) return;
      el.innerHTML = h;

      // innerHTML does not execute <script> — re-insert so WebGL/three scenes run.
      const scripts = Array.from(el.querySelectorAll("script"));
      for (const old of scripts) {
        const s = document.createElement("script");
        if (old.src) {
          s.src = old.src;
          s.async = false;
        } else {
          s.textContent = old.textContent;
        }
        if (old.type) s.type = old.type;
        for (const attr of old.attributes) {
          if (attr.name !== "src" && attr.name !== "type") s.setAttribute(attr.name, attr.value);
        }
        old.replaceWith(s);
        if (s.src) {
          await new Promise<void>((resolve, reject) => {
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(`Failed to load script: ${s.src}`));
          });
        }
      }

      await document.fonts.ready;
    }, injected);

    if (process.env.SUPERIMG_PROFILE === "1") {
      const stats = this.frameExtractor.getStats();
      if (stats.misses > 0 || stats.hits > 0) {
        console.error(
          `[SUPERIMG_PROFILE] clip extract: ${stats.extractMs.toFixed(0)}ms (${stats.hits} hits, ${stats.misses} misses)`,
        );
      }
    }

    // Use JPEG for speed unless alpha channel is needed (JPEG doesn't support transparency)
    const useAlpha = options?.alpha === true;
    const png = await this.page.screenshot({
      type: useAlpha ? "png" : "jpeg",
      ...(useAlpha ? {} : { quality: 95 }),
      clip: { x: 0, y: 0, width: this.width, height: this.height },
      omitBackground: useAlpha,
    });

    return Buffer.isBuffer(png) ? png : Buffer.from(png);
  }

  private async injectClipFrames(html: string): Promise<string> {
    if (!html.includes(CLIP_SYNC_ATTR)) return html;

    const matches = [...html.matchAll(CLIP_IMG_RE)];
    if (matches.length === 0) return html;

    const replacements = await Promise.all(
      matches.map(async (match) => {
        const tag = match[0];
        const src = getAttr(tag, "data-src");
        const tRaw = getAttr(tag, "data-t");
        if (!src || tRaw === undefined) {
          throw new RenderError({
            frame: -1,
            browserError: `Clip placeholder missing data-src or data-t: ${tag}`,
          });
        }
        const t = Number(tRaw);
        const frameRaw = getAttr(tag, "data-frame");
        const frameIndex = frameRaw !== undefined ? Number(frameRaw) : Math.round(t * this.fps);
        void frameIndex;

        try {
          const png = await this.frameExtractor.extractFrame(src, t, this.fps);
          const dataUri = `data:image/png;base64,${png.toString("base64")}`;
          return { tag, replacement: buildInjectedImgTag(tag, dataUri) };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new RenderError({
            frame: -1,
            browserError: `Clip frame extraction failed: ${src} at t=${t}s: ${message}`,
          });
        }
      }),
    );

    let result = html;
    for (const { tag, replacement } of replacements) {
      result = result.replace(tag, replacement);
    }
    return result;
  }

  async dispose(): Promise<void> {
    if (this.closeContextOnDispose) {
      await this.page.context().close();
    }
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
    if (config.resolvedAudio) {
      encoderConfig.resolvedAudio = config.resolvedAudio;
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