//! Preview component with CSS transform scaling
//! Templates render at logical dimensions and scale to fit container

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { usePreview, type UsePreviewReturn } from "../hooks/usePreview.js";

export interface PreviewProps {
  /** Optional CSS class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Called when preview is ready */
  onReady?: (preview: UsePreviewReturn) => void;
}

export interface PreviewRef {
  /** The container element */
  container: HTMLDivElement | null;
  /** The preview hook return value */
  preview: UsePreviewReturn;
}

/**
 * A container component with preview rendering capabilities.
 * Uses CSS transform scaling - templates render at logical dimensions
 * and scale to fit the container while maintaining aspect ratio.
 *
 * @example
 * ```tsx
 * const previewRef = useRef<PreviewRef>(null);
 *
 * <Preview
 *   ref={previewRef}
 *   style={{ width: "100%", aspectRatio: "16/9" }}
 *   onReady={(preview) => {
 *     preview.renderFrame(myTemplate.render, context);
 *   }}
 * />
 * ```
 */
export const Preview = forwardRef<PreviewRef, PreviewProps>(function Preview(
  { className, style, onReady },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const preview = usePreview(containerRef);

  // Expose container and preview via ref
  useImperativeHandle(
    ref,
    () => ({
      container: containerRef.current,
      preview,
    }),
    [preview]
  );

  // Call onReady when preview becomes ready
  useEffect(() => {
    if (preview.ready) {
      onReady?.(preview);
    }
  }, [preview.ready, onReady]);

  return <div ref={containerRef} className={className} style={style} />;
});
