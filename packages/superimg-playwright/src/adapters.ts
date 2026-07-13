//! Playwright adapters implementing FrameRenderer and VideoEncoder contracts

import type { Page } from "playwright";
import type {
  FrameRendererConfig,
  FrameReadinessPolicy,
  FrameRenderer,
  ResolvedAssetDeclaration,
  AssetMeta,
} from "@superimg/types";
import { RenderError } from "@superimg/types";
import { buildPageShell } from "@superimg/core/html";

import { FrameExtractor } from "./frame-extractor.js";
import { preloadThreeModule } from "./three-preload.js";
import { preloadLottieModule } from "./lottie-preload.js";
import {
  WAIT_ATTR,
  formatReadinessFail,
  formatReadinessTimeout,
  readinessEvaluateInPage,
  resolveReadinessPolicy,
} from "./readiness.js";

const CLIP_SYNC_ATTR = "data-superimg-clip";
const EXTERNAL_EMBED_ATTR = "data-superimg-external-embed";
const CLIP_TAG_RE = /<([a-z0-9-]+)\b(?=[^>]*\bdata-superimg-clip\b)[^>]*>(?:<\/\1>)?/gi;
const EXTERNAL_EMBED_TAG_RE = /<([a-z0-9-]+)\b(?=[^>]*\bdata-superimg-external-embed\b)[^>]*>(?:<\/\1>)?/gi;

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

function buildExternalEmbedPlaceholder(tag: string): string {
  const style = getAttr(tag, "style") ?? "width:100%;height:100%;display:block";
  const provider = getAttr(tag, "data-provider") || "external";
  const poster = getAttr(tag, "data-poster");
  if (poster) {
    return `<img src="${poster}" style="${style}" alt="${provider} embed placeholder">`;
  }
  return [
    `<div style="${style};background:#111827;color:#f9fafb;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-size:18px;text-align:center;padding:24px;box-sizing:border-box">`,
    `${provider} embed unavailable for deterministic export`,
    `</div>`,
  ].join("");
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
  private readiness: FrameReadinessPolicy | undefined;

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
    this.readiness = config.readiness;
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
    await this.page.evaluate(() => document.fonts.ready);
  }

  async advanceClock(ms: number): Promise<void> {
    await this.page.clock.runFor(ms);
  }

  async captureFrame(
    html: string,
    options?: { alpha?: boolean; signal?: AbortSignal },
  ): Promise<Buffer> {
    const injected = await this.injectClipFrames(html, options?.signal);

    if (injected.includes("__SUPERIMG_THREE__")) {
      await preloadThreeModule(this.page);
    }
    if (
      injected.includes("data-superimg-lottie") ||
      injected.includes("lottie.loadAnimation") ||
      injected.includes("loadAnimation({")
    ) {
      await preloadLottieModule(this.page, injected.includes("lottie.min.js"));
    }

    // Per-frame protocol: reset → inject HTML + run scripts (may done() sync) → wait.
    // Reset MUST run before scripts; resetting after wipes three.scene / canvas signals.
    await this.page.evaluate(async (h: string) => {
      const ready = (
        window as unknown as { __superimgReady?: { __reset?: () => void } }
      ).__superimgReady;
      ready?.__reset?.();

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
    }, injected);

    const policy = resolveReadinessPolicy(this.readiness);
    const waitFonts = policy.waitImplicit.includes("fonts");
    const waitImages = policy.waitImplicit.includes("images");

    const readinessResult = await this.page.evaluate(readinessEvaluateInPage, {
      timeoutMs: policy.timeoutMs,
      waitFonts,
      waitImages,
      waitAttr: WAIT_ATTR,
    });

    if (!readinessResult.ok) {
      const msg =
        !readinessResult.error || readinessResult.error === "timeout"
          ? formatReadinessTimeout(readinessResult.open, policy.timeoutMs)
          : formatReadinessFail(readinessResult.open, readinessResult.error);
      throw new Error(msg);
    }

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
      scale: "css",
      caret: "initial",
    });

    return Buffer.isBuffer(png) ? png : Buffer.from(png);
  }

  private async injectClipFrames(html: string, signal?: AbortSignal): Promise<string> {
    let nextHtml = this.injectExternalEmbedPlaceholders(html);
    if (!nextHtml.includes(CLIP_SYNC_ATTR)) return nextHtml;

    const matches = [...nextHtml.matchAll(CLIP_TAG_RE)];
    if (matches.length === 0) return nextHtml;

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
          const png = await this.frameExtractor.extractFrame(src, t, this.fps, signal);
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

    let result = nextHtml;
    for (const { tag, replacement } of replacements) {
      result = result.replace(tag, replacement);
    }
    return result;
  }

  private injectExternalEmbedPlaceholders(html: string): string {
    if (!html.includes(EXTERNAL_EMBED_ATTR)) return html;
    return html.replace(EXTERNAL_EMBED_TAG_RE, (tag) => buildExternalEmbedPlaceholder(tag));
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
