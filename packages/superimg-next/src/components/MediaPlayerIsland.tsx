//! Client-only Player island: serializable payload props + local template import.
"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  createSkeletonMarkup,
  mediaStageStyle,
  renderPosterMarkup,
  type SerializableMediaPayload,
} from "@superimg/adapters";
import {
  Player,
  type LoadResult,
  type PlayerInput,
  type PlayerProps,
} from "@foxworth/superimg/react/player";

export type MediaPlayerIslandProps = {
  /** RSC-safe props from createServerPayload / toClientProps. */
  payload: Pick<
    SerializableMediaPayload,
    "schemaVersion" | "sourceId" | "poster" | "media" | "data"
  >;
  /**
   * Template module — must be imported in this client module tree.
   * Never pass templates across the RSC boundary as props from the server.
   */
  media: PlayerInput;
  /** Override data (defaults to payload.data). */
  data?: Record<string, unknown>;
  /** Show adapter poster until first successful Player load. @default true */
  showPosterUntilReady?: boolean;
  /**
   * When true (default), use a ratio-correct shimmer if the payload has no
   * custom poster html/image — still fills the slot before first frame.
   */
  skeletonFallback?: boolean;
  className?: string;
  style?: CSSProperties;
  controls?: PlayerProps["controls"];
  onLoad?: (result: LoadResult) => void;
  children?: ReactNode;
} & Omit<PlayerProps, "media" | "data" | "onLoad" | "style" | "controls">;

/**
 * Client island: ratio-correct stage + optional poster/skeleton until load,
 * then SuperImg Player. Template is a client-side import; payload is the only
 * RSC-passed media contract.
 */
export function MediaPlayerIsland({
  payload,
  media,
  data,
  showPosterUntilReady = true,
  skeletonFallback = true,
  className,
  style,
  controls = "minimal",
  onLoad,
  children,
  ...rest
}: MediaPlayerIslandProps) {
  const [ready, setReady] = useState(false);
  const width = payload.poster.width;
  const height = payload.poster.height;
  const hasCustomPoster = !!(
    payload.poster.imageUrl ||
    (payload.poster.html && !payload.poster.html.includes("data-superimg-skeleton"))
  );
  const shellHtml =
    showPosterUntilReady && !ready
      ? hasCustomPoster || !skeletonFallback
        ? renderPosterMarkup(payload.poster)
        : createSkeletonMarkup({
            width,
            height,
            alt: payload.poster.alt ?? "Loading media",
          })
      : null;

  return (
    <div
      className={className}
      data-superimg-next-island=""
      data-superimg-stage="1"
      data-source-id={payload.sourceId}
      style={{
        ...mediaStageStyle(width, height),
        ...style,
      }}
    >
      {shellHtml ? (
        <div
          data-superimg-poster-shell=""
          data-superimg-stage-fill=""
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            overflow: "hidden",
            opacity: ready ? 0 : 1,
            transition: "opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
            pointerEvents: "none",
          }}
          dangerouslySetInnerHTML={{ __html: shellHtml }}
        />
      ) : null}
      <div
        data-superimg-stage-player=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
          opacity: ready ? 1 : 0,
          transition: "opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <Player
          media={media}
          {...(data !== undefined
            ? { data }
            : payload.data !== undefined
              ? { data: payload.data }
              : {})}
          controls={controls}
          style={{
            width: "100%",
            height: "100%",
            background: ready ? undefined : "transparent",
          }}
          onLoad={(result) => {
            if (result.status === "success") setReady(true);
            onLoad?.(result);
          }}
          {...rest}
        />
      </div>
      {children}
    </div>
  );
}
