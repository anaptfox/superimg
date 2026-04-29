//! Auto-managed container component for use with useVideoSession

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
 * Container component that auto-integrates with useVideoSession.
 *
 * Uses CSS transform scaling - templates render at logical dimensions
 * and scale to fit the container while maintaining aspect ratio.
 * Automatically manages container ref registration with the session.
 *
 * @example
 * ```tsx
 * function MyVideoEditor() {
 *   const session = useVideoSession({ initialFormat: "vertical", duration: 5 });
 *
 *   return (
 *     <div>
 *       <VideoCanvas
 *         session={session}
 *         className="preview"
 *         style={{ width: "100%", aspectRatio: "9/16" }}
 *       />
 *       <Timeline store={session.store} showTime />
 *     </div>
 *   );
 * }
 * ```
 */
export function VideoCanvas({ session, className, style }: VideoCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Register container with session on mount/unmount
  useEffect(() => {
    session.setContainer(containerRef.current);

    return () => {
      session.setContainer(null);
    };
  }, [session]);

  return <div ref={containerRef} className={className} style={style} />;
}
