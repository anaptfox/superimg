//! Browser scheduler with requestAnimationFrame

import type { RenderContext, EncodingOptions } from "@superimg/types";
import { createRenderContext } from "@superimg/core";
import { BrowserRenderer } from "./renderer.js";
import { BrowserEncoder } from "./encoder.js";

/**
 * Browser scheduler for timeline-based rendering
 */
export class BrowserScheduler {
  private durationSeconds: number;
  private fps: number;
  private width: number;
  private height: number;
  private renderer: BrowserRenderer;

  constructor(
    durationSeconds: number,
    fps: number,
    width: number,
    height: number
  ) {
    this.durationSeconds = durationSeconds;
    this.fps = fps;
    this.width = width;
    this.height = height;
    this.renderer = new BrowserRenderer();
  }

  /**
   * Run export: sequential frame rendering.
   * Uses persistent renderer session (init-once, capture-many, dispose-once).
   * @param data - Template data merged into ctx.data for every frame
   */
  async runExport(
    renderFn: (ctx: RenderContext) => string,
    encoding?: EncodingOptions,
    data?: Record<string, unknown>
  ): Promise<Blob> {
    const totalFrames = Math.ceil(this.durationSeconds * this.fps);
    const encoder = new BrowserEncoder(
      this.width,
      this.height,
      this.fps,
      encoding
    );
    await encoder.init();

    try {
      await this.renderer.init({
        width: this.width,
        height: this.height,
      });

      for (let frame = 0; frame < totalFrames; frame++) {
        const ctx = createRenderContext(
          frame,
          this.fps,
          totalFrames,
          this.width,
          this.height,
          data ?? {}
        );

        const html = renderFn(ctx);
        const imageData = await this.renderer.captureFrame(html);

        const timestamp = frame / this.fps;
        await encoder.addFrame(imageData, timestamp);
      }
    } finally {
      await this.renderer.dispose();
    }

    return encoder.finalize();
  }
}
