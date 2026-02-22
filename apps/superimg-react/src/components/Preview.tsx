//! Preview canvas component

import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { usePreview, type UsePreviewReturn } from "../hooks/usePreview.js";

export interface PreviewProps {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Optional CSS class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Called when preview is ready */
  onReady?: (preview: UsePreviewReturn) => void;
}

export interface PreviewRef {
  /** The canvas element */
  canvas: HTMLCanvasElement | null;
  /** The preview hook return value */
  preview: UsePreviewReturn;
}

/**
 * A canvas component with preview rendering capabilities.
 *
 * @example
 * ```tsx
 * const previewRef = useRef<PreviewRef>(null);
 *
 * <Preview
 *   ref={previewRef}
 *   width={1920}
 *   height={1080}
 *   onReady={(preview) => {
 *     preview.renderFrame(myTemplate.render, context);
 *   }}
 * />
 * ```
 */
export const Preview = forwardRef<PreviewRef, PreviewProps>(function Preview(
  { width, height, className, style, onReady },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preview = usePreview(canvasRef, { width, height });

  // Expose canvas and preview via ref
  useImperativeHandle(ref, () => ({
    canvas: canvasRef.current,
    preview,
  }), [preview]);

  // Call onReady when preview becomes ready
  useEffect(() => {
    if (preview.ready) {
      onReady?.(preview);
    }
  }, [preview.ready, onReady]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={style}
    />
  );
});
