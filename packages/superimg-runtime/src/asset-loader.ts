//! Asset loader for images and videos

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
