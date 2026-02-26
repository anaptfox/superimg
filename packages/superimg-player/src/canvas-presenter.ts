import type { FramePresenter, RenderContext } from "@superimg/types";
import { CanvasRenderer } from "@superimg/runtime";

export class CanvasPresenter implements FramePresenter {
  private canvas: HTMLCanvasElement;
  private renderer: CanvasRenderer;
  private frameCache: Map<number, ImageData> = new Map();
  private maxCacheFrames: number;

  constructor(container: HTMLElement, width = 1920, height = 1080, maxCacheFrames = 30) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.display = "block";
    this.canvas.style.maxWidth = "100%";
    this.canvas.style.height = "auto";
    container.appendChild(this.canvas);

    this.renderer = new CanvasRenderer(this.canvas);
    this.maxCacheFrames = maxCacheFrames;
  }

  async warmup(): Promise<void> {
    await this.renderer.warmup();
  }

  async present(html: string, ctx: RenderContext): Promise<void> {
    // Check cache first
    const cached = this.frameCache.get(ctx.sceneFrame);
    if (cached) {
      const ctx2d = this.canvas.getContext("2d")!;
      ctx2d.putImageData(cached, 0, 0);
      return;
    }

    // Render using snapdom
    const imageData = await this.renderer.renderFrame(() => html, ctx);
    
    // Cache with LRU eviction
    if (this.frameCache.size >= this.maxCacheFrames) {
      const firstKey = this.frameCache.keys().next().value;
      if (firstKey !== undefined) {
        this.frameCache.delete(firstKey);
      }
    }
    this.frameCache.set(ctx.sceneFrame, imageData);
  }

  getElement(): HTMLElement {
    return this.canvas;
  }

  setLogicalSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.frameCache.clear();
  }

  /**
   * @deprecated Use setLogicalSize instead
   */
  resize(width: number, height: number): void {
    this.setLogicalSize(width, height);
  }

  dispose(): void {
    this.frameCache.clear();
    this.canvas.remove();
  }
}
