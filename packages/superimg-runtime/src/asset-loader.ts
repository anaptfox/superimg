//! Asset loader for images and videos

import type {
  AssetMeta,
  ImageAssetMeta,
  VideoAssetMeta,
  AudioAssetMeta,
  ResolvedAssetDeclaration,
} from "@superimg/types";

export class VideoAsset {
  private video: HTMLVideoElement;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  public duration: number = 0;

  private constructor(video: HTMLVideoElement) {
    this.video = video;
    // Create offscreen canvas for frame extraction
    this.canvas = new OffscreenCanvas(video.videoWidth || 1920, video.videoHeight || 1080);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for video frame extraction");
    }
    this.ctx = ctx;
  }

  static async load(url: string): Promise<VideoAsset> {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => {
        resolve();
      };
      video.onerror = (e) => {
        reject(new Error(`Failed to load video: ${url}`));
      };
      // Fallback timeout
      setTimeout(() => {
        if (video.readyState >= 2) {
          resolve();
        } else {
          reject(new Error(`Video load timeout: ${url}`));
        }
      }, 30000);
    });

    const asset = new VideoAsset(video);
    asset.duration = video.duration || 0;
    
    // Update canvas size to match video dimensions
    if (video.videoWidth && video.videoHeight) {
      asset.canvas.width = video.videoWidth;
      asset.canvas.height = video.videoHeight;
    }

    return asset;
  }

  async getFrameAt(time: number): Promise<ImageBitmap> {
    // Handle looping
    const actualTime = this.duration > 0 ? time % this.duration : time;
    
    this.video.currentTime = actualTime;
    
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        this.video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      this.video.addEventListener("seeked", onSeeked);
      
      // Fallback timeout
      setTimeout(() => {
        this.video.removeEventListener("seeked", onSeeked);
        resolve();
      }, 1000);
    });

    // Draw video frame to canvas
    this.ctx.drawImage(this.video, 0, 0);
    
    return createImageBitmap(this.canvas);
  }

  dispose(): void {
    this.video.src = "";
    this.video.load(); // Reset video element
  }
}

export class AssetLoader {
  private imageCache = new Map<string, ImageBitmap>();
  private videoCache = new Map<string, VideoAsset>();

  /**
   * Preload multiple images
   */
  async preloadImages(urls: string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.loadImage(url)));
  }

  /**
   * Load an image and cache it
   */
  async loadImage(url: string): Promise<ImageBitmap> {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${url} (${response.status})`);
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    this.imageCache.set(url, bitmap);
    return bitmap;
  }

  /**
   * Load a video and cache it
   */
  async loadVideo(url: string): Promise<VideoAsset> {
    if (this.videoCache.has(url)) {
      return this.videoCache.get(url)!;
    }

    const asset = await VideoAsset.load(url);
    this.videoCache.set(url, asset);
    return asset;
  }

  /**
   * Dispose of all cached assets
   */
  dispose(): void {
    // Close all image bitmaps
    this.imageCache.forEach((bitmap) => bitmap.close());
    this.imageCache.clear();

    // Dispose all videos
    this.videoCache.forEach((video) => video.dispose());
    this.videoCache.clear();
  }
}

// =============================================================================
// Asset Metadata Loading (for ctx.assets)
// =============================================================================

interface AssetHeaders {
  size: number;
  mimeType: string;
}

/** Fetch size and mimeType via HEAD request */
async function getAssetHeaders(src: string): Promise<AssetHeaders> {
  try {
    const res = await fetch(src, { method: "HEAD" });
    return {
      size: parseInt(res.headers.get("content-length") ?? "0", 10) || 0,
      mimeType: res.headers.get("content-type")?.split(";")[0]?.trim() || "",
    };
  } catch {
    return { size: 0, mimeType: "" };
  }
}

/** Load image and extract metadata */
async function loadImageMetadata(
  src: string,
  headers: AssetHeaders
): Promise<ImageAssetMeta> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve({
        type: "image",
        url: src,
        mimeType: headers.mimeType || "image/png",
        size: headers.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Load video and extract metadata */
async function loadVideoMetadata(
  src: string,
  headers: AssetHeaders
): Promise<VideoAssetMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.addEventListener(
      "loadedmetadata",
      () => {
        resolve({
          type: "video",
          url: src,
          mimeType: headers.mimeType || "video/mp4",
          size: headers.size,
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        });
      },
      { once: true }
    );
    video.addEventListener("error", () => reject(video.error), { once: true });
    video.src = src;
  });
}

/** Load audio and extract metadata */
async function loadAudioMetadata(
  src: string,
  headers: AssetHeaders
): Promise<AudioAssetMeta> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.addEventListener(
      "loadedmetadata",
      () => {
        resolve({
          type: "audio",
          url: src,
          mimeType: headers.mimeType || "audio/mpeg",
          size: headers.size,
          duration: audio.duration,
        });
      },
      { once: true }
    );
    audio.addEventListener("error", () => reject(audio.error), { once: true });
    audio.src = src;
  });
}

/**
 * Load asset and extract full metadata in browser environment.
 * Used by Player to populate ctx.assets.
 */
export async function loadAssetWithMetadata(
  decl: ResolvedAssetDeclaration
): Promise<AssetMeta> {
  const headers = await getAssetHeaders(decl.src);

  try {
    switch (decl.type) {
      case "image":
        return await loadImageMetadata(decl.src, headers);
      case "video":
        return await loadVideoMetadata(decl.src, headers);
      case "audio":
        return await loadAudioMetadata(decl.src, headers);
      default:
        // Fallback to image
        return await loadImageMetadata(decl.src, headers);
    }
  } catch (err) {
    // Return fallback metadata on failure
    console.warn(`[superimg] Failed to load asset ${decl.key}:`, err);
    const base = {
      url: decl.src,
      mimeType:
        decl.type === "image"
          ? "image/png"
          : decl.type === "video"
            ? "video/mp4"
            : "audio/mpeg",
      size: headers.size,
    };
    if (decl.type === "video") {
      return { type: "video", ...base, width: 0, height: 0, duration: 0 };
    }
    if (decl.type === "audio") {
      return { type: "audio", ...base, duration: 0 };
    }
    return { type: "image", ...base, width: 0, height: 0 };
  }
}

/**
 * Load all assets in parallel. Returns metadata map for ctx.assets.
 */
export async function loadAllAssetsWithMetadata(
  declarations: ResolvedAssetDeclaration[]
): Promise<Record<string, AssetMeta>> {
  if (declarations.length === 0) return {};

  const results = await Promise.all(
    declarations.map(async (decl) => ({
      key: decl.key,
      meta: await loadAssetWithMetadata(decl),
    }))
  );

  return Object.fromEntries(results.map(({ key, meta }) => [key, meta]));
}
