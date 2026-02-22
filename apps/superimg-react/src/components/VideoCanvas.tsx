//! Auto-managed canvas component for use with useVideoSession

import { useEffect, useRef, type CSSProperties } from "react";
import type { VideoSessionReturn } from "../hooks/useVideoSession.js";

export interface VideoCanvasProps {
  /** The video session from useVideoSession hook */
  session: VideoSessionReturn;
  /** Optional CSS class name */
  className?: string;
  /** Optional inline styles */
  style?: CSSProperties;
}

/**
 * Canvas component that auto-integrates with useVideoSession.
 *
 * Automatically manages canvas ref registration with the session,
 * eliminating the need for manual ref management.
 *
 * @example
 * ```tsx
 * function MyVideoEditor() {
 *   const session = useVideoSession({ initialPreviewFormat: "vertical", duration: 5 });
 *
 *   return (
 *     <div>
 *       <VideoCanvas session={session} className="preview" />
 *       <Timeline store={session.store} showTime />
 *     </div>
 *   );
 * }
 * ```
 */
export function VideoCanvas({ session, className, style }: VideoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Register canvas with session on mount/unmount
  useEffect(() => {
    session.setCanvas(canvasRef.current);

    return () => {
      session.setCanvas(null);
    };
  }, [session]);

  return (
    <canvas
      ref={canvasRef}
      width={session.previewWidth}
      height={session.previewHeight}
      className={className}
      style={style}
    />
  );
}
