//! React hook for preview rendering with runtime-web

import { useEffect, useState, useCallback, useLayoutEffect, type RefObject } from "react";
import { IframePresenter, type DomPresenter } from "@superimg/runtime-web";
import type { RenderContext } from "../../index.browser.js";

export type RenderFn = (ctx: RenderContext) => string;

export interface UsePreviewReturn {
  /** The presenter instance (null until ready) */
  sink: DomPresenter | null;
  /** Whether the preview is ready for rendering */
  ready: boolean;
  /** Render a frame to the preview */
  renderFrame: (render: RenderFn, ctx: RenderContext) => Promise<void>;
  /** Set the logical render size */
  setLogicalSize: (width: number, height: number) => void;
  /** Inject CSS styles into the preview iframe */
  injectStyles: (inlineCss?: string[], stylesheets?: string[]) => void;
}

/**
 * Hook for managing preview rendering with runtime-web's iframe presenter.
 *
 * Uses CSS transform scaling - templates render at logical dimensions
 * and scale to fit the container while maintaining aspect ratio.
 */
export function usePreview(
  containerRef: RefObject<HTMLElement | null>
): UsePreviewReturn {
  const [sink, setSink] = useState<DomPresenter | null>(null);
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

    const newSink = new IframePresenter();
    newSink.attach(container);
    setSink(newSink);
    setReady(true);

    return () => {
      setReady(false);
      newSink.dispose();
    };
  }, [container]);

  const renderFrame = useCallback(
    async (render: RenderFn, ctx: RenderContext): Promise<void> => {
      if (!sink) return;
      const html = render(ctx);
      sink.present(html, ctx.width, ctx.height);
    },
    [sink]
  );

  const setLogicalSize = useCallback(
    (width: number, height: number) => {
      void width;
      void height;
    },
    [sink]
  );

  const injectStyles = useCallback(
    (inlineCss?: string[], stylesheets?: string[]) => {
      if (sink?.injectStyles) {
        sink.injectStyles(inlineCss, stylesheets);
      }
    },
    [sink]
  );

  return {
    sink,
    ready,
    renderFrame,
    setLogicalSize,
    injectStyles,
  };
}
