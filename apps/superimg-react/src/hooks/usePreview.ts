//! React hook for canvas preview rendering

import { useEffect, useState, useCallback, useLayoutEffect, type RefObject } from "react";
import { CanvasPresenter, HtmlPresenter, type RenderContext, type FramePresenter } from "superimg/browser";

export type RenderFn = (ctx: RenderContext) => string;

export interface UsePreviewConfig {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Mode to use for rendering */
  mode?: "html" | "canvas";
}

export interface UsePreviewReturn {
  /** The presenter instance (null until ready) */
  sink: FramePresenter | null;
  /** Whether the preview is ready for rendering */
  ready: boolean;
  /** Render a frame to the preview canvas */
  renderFrame: (render: RenderFn, ctx: RenderContext) => Promise<void>;
  /** Clear the preview canvas */
  clear: () => void;
}

/**
 * Hook for managing preview rendering.
 */
export function usePreview(
  containerRef: RefObject<HTMLElement | null>,
  config: UsePreviewConfig
): UsePreviewReturn {
  const [sink, setSink] = useState<FramePresenter | null>(null);
  const [ready, setReady] = useState(false);

  // Track container element in state to avoid ref.current in deps
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Sync ref to state on layout (before paint)
  useLayoutEffect(() => {
    setContainer(containerRef.current);
  });

  // Initialize presenter when container is available
  useEffect(() => {
    if (!container) {
      setSink(null);
      setReady(false);
      return;
    }

    // Create new presenter
    const newSink: FramePresenter = config.mode === "canvas" 
      ? new CanvasPresenter(container, config.width, config.height)
      : new HtmlPresenter(container, config.width, config.height);

    // Start warmup (pre-cache fonts), then set ready
    let cancelled = false;
    
    const warmupPromise = newSink.warmup ? newSink.warmup() : Promise.resolve();
    
    warmupPromise.then(() => {
      if (!cancelled) {
        setSink(newSink);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      setReady(false);
      newSink.dispose();
    };
  }, [container, config.width, config.height, config.mode]);

  const renderFrame = useCallback(async (
    render: RenderFn,
    ctx: RenderContext
  ): Promise<void> => {
    if (!sink) return;
    const html = render(ctx);
    await sink.present(html, ctx);
  }, [sink]);

  const clear = useCallback(() => {
    // Presenters don't have a clear method, but we could implement one or just re-render empty
  }, []);

  return {
    sink,
    ready,
    renderFrame,
    clear,
  };
}
