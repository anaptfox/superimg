//! React hook for preview rendering with HtmlPresenter

import { useEffect, useState, useCallback, useLayoutEffect, type RefObject } from "react";
import { HtmlPresenter, type RenderContext, type FramePresenter } from "superimg/browser";

export type RenderFn = (ctx: RenderContext) => string;

export interface UsePreviewReturn {
  /** The presenter instance (null until ready) */
  sink: FramePresenter | null;
  /** Whether the preview is ready for rendering */
  ready: boolean;
  /** Render a frame to the preview */
  renderFrame: (render: RenderFn, ctx: RenderContext) => Promise<void>;
  /** Set the logical render size */
  setLogicalSize: (width: number, height: number) => void;
}

/**
 * Hook for managing preview rendering with HtmlPresenter.
 *
 * Uses CSS transform scaling - templates render at logical dimensions
 * and scale to fit the container while maintaining aspect ratio.
 */
export function usePreview(
  containerRef: RefObject<HTMLElement | null>
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

    // Create HtmlPresenter (CSS transform scaling handles dimensions)
    const newSink = new HtmlPresenter(container);

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
  }, [container]);

  const renderFrame = useCallback(
    async (render: RenderFn, ctx: RenderContext): Promise<void> => {
      if (!sink) return;
      const html = render(ctx);
      await sink.present(html, ctx);
    },
    [sink]
  );

  const setLogicalSize = useCallback(
    (width: number, height: number) => {
      if (sink?.setLogicalSize) {
        sink.setLogicalSize(width, height);
      }
    },
    [sink]
  );

  return {
    sink,
    ready,
    renderFrame,
    setLogicalSize,
  };
}
