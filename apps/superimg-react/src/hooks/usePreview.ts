//! React hook for canvas preview rendering

import { useEffect, useState, useCallback, useLayoutEffect, type RefObject } from "react";
import { CanvasRenderer, type RenderContext } from "superimg";

export type RenderFn = (ctx: RenderContext) => string;

export interface UsePreviewConfig {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
}

export interface UsePreviewReturn {
  /** The canvas renderer instance (null until ready) */
  sink: CanvasRenderer | null;
  /** Whether the preview is ready for rendering */
  ready: boolean;
  /** Render a frame to the preview canvas */
  renderFrame: (render: RenderFn, ctx: RenderContext) => Promise<ImageData | null>;
  /** Clear the preview canvas */
  clear: () => void;
}

/**
 * Hook for managing canvas preview rendering.
 *
 * @example
 * ```tsx
 * const canvasRef = useRef<HTMLCanvasElement>(null);
 * const { ready, renderFrame } = usePreview(canvasRef, { width: 1920, height: 1080 });
 *
 * useEffect(() => {
 *   if (ready) {
 *     renderFrame(myRenderFn, myContext);
 *   }
 * }, [ready, renderFrame]);
 * ```
 */
export function usePreview(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  config: UsePreviewConfig
): UsePreviewReturn {
  const [sink, setSink] = useState<CanvasRenderer | null>(null);
  const [ready, setReady] = useState(false);

  // Track canvas element in state to avoid canvasRef.current in deps
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  // Sync ref to state on layout (before paint)
  useLayoutEffect(() => {
    setCanvas(canvasRef.current);
  });

  // Initialize canvas renderer when canvas is available
  useEffect(() => {
    if (!canvas) {
      setSink(null);
      setReady(false);
      return;
    }

    // Update canvas dimensions
    canvas.width = config.width;
    canvas.height = config.height;

    // Create new canvas renderer and warmup for faster first render
    const newSink = new CanvasRenderer(canvas);

    // Start warmup (pre-cache fonts), then set ready
    let cancelled = false;
    newSink.warmup().then(() => {
      if (!cancelled) {
        setSink(newSink);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      setReady(false);
    };
  }, [canvas, config.width, config.height]);

  const renderFrame = useCallback(async (
    render: RenderFn,
    ctx: RenderContext
  ): Promise<ImageData | null> => {
    if (!sink) return null;
    return sink.renderFrame(render, ctx);
  }, [sink]);

  const clear = useCallback(() => {
    sink?.clear();
  }, [sink]);

  return {
    sink,
    ready,
    renderFrame,
    clear,
  };
}
