//! Browser-specific utility functions

/**
 * Get 2D context from canvas, throwing if unavailable
 */
export function get2DContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D;
export function get2DContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D;
export function get2DContext(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Failed to get 2d context from canvas");
  }
  return ctx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}
