//! Browser-free HTML rasterizer backed by Blitz wasm (no NAPI).

import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  FrameCaptureOptions,
  Medium,
  Rasterizer,
  RasterizerCapabilities,
  RasterizerConfig,
  ResolvedAssetDeclaration,
  ResolvedFontFace,
  AssetMeta,
} from "@superimg/types";

const BLITZ_CAPABILITIES: RasterizerCapabilities = {
  media: ["html"],
  browserFree: true,
  // Node glue uses `node:fs` to load the wasm (wasm-bindgen nodejs-module target).
  workerSafe: false,
};

const VIDEO_RGBA_FORMATS = new Set(["mp4", "webm"]);

type BlitzEngineInstance = {
  rasterizePng(html: string, t: number): Uint8Array;
  rasterizeRgba(html: string, t: number): Uint8Array;
  addFont(family: string, weight: number, italic: boolean, data: Uint8Array): void;
  setHidpi(scale: number): void;
  free(): void;
  readonly width: number;
  readonly height: number;
};

type BlitzEngineCtor = new (width: number, height: number) => BlitzEngineInstance;

let engineCtor: BlitzEngineCtor | undefined;

function pkgDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "pkg");
}

async function loadEngineCtor(): Promise<BlitzEngineCtor> {
  if (engineCtor) return engineCtor;
  const js = join(pkgDir(), "superimg_blitz.js");
  const wasm = join(pkgDir(), "superimg_blitz_bg.wasm");
  if (!existsSync(js) || !existsSync(wasm)) {
    throw new Error(
      `Blitz wasm is not built. Run \`just blitz-wasm\` (expected ${wasm}).`,
    );
  }
  const mod = (await import("../pkg/superimg_blitz.js")) as {
    BlitzEngine: BlitzEngineCtor;
  };
  engineCtor = mod.BlitzEngine;
  return engineCtor;
}

function isFullDocument(html: string): boolean {
  const head = html.trimStart().slice(0, 15).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

/**
 * SuperImg composite HTML is a fragment of `position:absolute;inset:0` layers.
 * Chromium sizes that against the viewport; Blitz does not unless html/body
 * have an explicit pixel box.
 */
export function wrapHtmlForViewport(html: string, width: number, height: number): string {
  if (isFullDocument(html)) return html;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}#frame{position:relative;width:100%;height:100%}</style></head><body><div id="frame">${html}</div></body></html>`;
}

function guessMime(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "image/png";
  }
}

async function urlToDataUri(url: string): Promise<string | null> {
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || guessMime(url);
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
    const path = url.startsWith("file://") ? fileURLToPath(url) : url;
    if (!existsSync(path)) return null;
    const buf = readFileSync(path);
    return `data:${guessMime(path)};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const SRC_ATTR = /\b(?:src|href)=["']([^"']+)["']/gi;
const CSS_URL = /url\(["']?([^"')]+)["']?\)/gi;

async function inlineRemoteAndLocalUrls(html: string): Promise<string> {
  const found = new Set<string>();
  for (const re of [SRC_ATTR, CSS_URL]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html))) {
      const url = match[1];
      if (url && !url.startsWith("data:") && !url.startsWith("blob:")) found.add(url);
    }
  }
  if (found.size === 0) return html;
  let out = html;
  for (const url of found) {
    const data = await urlToDataUri(url);
    if (data) out = out.split(url).join(data);
  }
  return out;
}

function collectFaces(config: RasterizerConfig): ResolvedFontFace[] {
  const faces =
    config.resolvedFonts && config.resolvedFonts.length > 0
      ? [...config.resolvedFonts]
      : (config.fontBuffers ?? []).map((data) => ({
          family: "",
          weight: 400,
          style: "normal" as const,
          data,
        }));
  // Latin Google subsets are typically the largest file; register those first
  // so generic-family fallbacks are not a Cyrillic-only face.
  faces.sort((a, b) => b.data.byteLength - a.data.byteLength);
  return faces;
}

/**
 * HTML → PNG (stills) or RGBA (mp4/webm) via published Blitz crates compiled
 * to wasm32-unknown-unknown. One live engine per init(); later frames mutate
 * `#frame` instead of rebuilding the document.
 */
export class BlitzRasterizer implements Rasterizer<Uint8Array> {
  readonly capabilities = BLITZ_CAPABILITIES;

  private width = 0;
  private height = 0;
  private format: string | undefined;
  private engine: BlitzEngineInstance | null = null;

  accepts(medium: Medium): boolean {
    return medium === "html";
  }

  async init(config: RasterizerConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;
    this.format = config.format;
    const Ctor = await loadEngineCtor();
    this.engine?.free();
    this.engine = new Ctor(this.width, this.height);
    const dpr = config.dpr ?? 1;
    if (dpr !== 1) this.engine.setHidpi(dpr);
    for (const face of collectFaces(config)) {
      this.engine.addFont(face.family, face.weight, face.style === "italic", face.data);
    }
  }

  async rasterize(markup: string, options?: FrameCaptureOptions): Promise<Uint8Array> {
    if (!this.engine) {
      throw new Error("BlitzRasterizer.init() must run before rasterize()");
    }
    const html = wrapHtmlForViewport(
      await inlineRemoteAndLocalUrls(markup),
      this.width,
      this.height,
    );
    const t = options?.time ?? 0;
    if (this.format && VIDEO_RGBA_FORMATS.has(this.format)) {
      return this.engine.rasterizeRgba(html, t);
    }
    return this.engine.rasterizePng(html, t);
  }

  async preloadAssets(
    declarations: ResolvedAssetDeclaration[],
  ): Promise<Record<string, AssetMeta>> {
    // Inlining happens per-frame from file/http URLs in the markup. Preload is
    // a no-op beyond returning empty metadata so ctx.assets stays defined.
    void declarations;
    return {};
  }

  async dispose(): Promise<void> {
    this.engine?.free();
    this.engine = null;
  }
}
