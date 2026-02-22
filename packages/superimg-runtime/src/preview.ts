//! Canvas renderer for HTML → ImageData → Canvas drawing

import type { RenderContext } from "@superimg/types";
import { BrowserRenderer } from "./renderer.js";
import { get2DContext } from "./utils.js";

/**
 * Canvas renderer that handles HTML → ImageData → Canvas drawing
 * Provides efficient frame rendering with scaling support and frame caching
 */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: BrowserRenderer;
  // Cached temp canvas to avoid memory leak from creating one every frame
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = get2DContext(canvas);
    this.renderer = new BrowserRenderer();
  }

  /**
   * Pre-cache fonts/images for faster first render
   */
  async warmup(): Promise<void> {
    await this.renderer.warmup();
  }

  /**
   * Get or create a cached scaling canvas with the given dimensions
   */
  private getScalingCanvas(width: number, height: number): CanvasRenderingContext2D {
    if (!this.tempCanvas || this.tempCanvas.width !== width || this.tempCanvas.height !== height) {
      this.tempCanvas = document.createElement("canvas");
      this.tempCanvas.width = width;
      this.tempCanvas.height = height;
      this.tempCtx = get2DContext(this.tempCanvas);
    }
    return this.tempCtx!;
  }

  /**
   * Render a frame to the canvas
   */
  async renderFrame(
    renderFn: (ctx: RenderContext) => string,
    ctx: RenderContext
  ): Promise<ImageData> {
    const html = renderFn(ctx);
    const imageData = await this.renderer.render(html, {
      width: this.canvas.width,
      height: this.canvas.height,
    });

    // Scale imageData if it doesn't match canvas dimensions
    if (imageData.width !== this.canvas.width || imageData.height !== this.canvas.height) {
      // Use cached temp canvas to scale
      const tempCtx = this.getScalingCanvas(imageData.width, imageData.height);
      tempCtx.putImageData(imageData, 0, 0);

      // Draw scaled to preview canvas
      this.ctx.drawImage(this.tempCanvas!, 0, 0, this.canvas.width, this.canvas.height);

      // Return the scaled imageData from the main canvas
      return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.putImageData(imageData, 0, 0);
      return imageData;
    }
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
