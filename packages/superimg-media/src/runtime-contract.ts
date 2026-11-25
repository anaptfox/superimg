import type { AssetMeta, MediaDefinition, Medium } from "@superimg/types";

/** A browser session may load any valid define()-authored media program. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RuntimeInput = MediaDefinition<any>;

/** Host-resolved font CSS. Supplying this avoids browser font discovery. */
export interface PreResolvedFonts {
  css?: string;
  stylesheets?: string[];
}

export interface RuntimeUpdate {
  data?: Record<string, unknown>;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
}

export interface RuntimeState {
  medium: Medium;
  animated: boolean;
  isReady: boolean;
  isPlaying: boolean;
  isScrubbing: boolean;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  duration: number;
  width: number;
  height: number;
  progress: number;
}

export interface RuntimeRenderedPayload {
  frame: number;
  html: string;
  compositeHtml: string;
}

/** One render accepted by the mounted DOM presenter. Revisions are session-local. */
export interface RuntimeAcceptedPresentation extends RuntimeRenderedPayload {
  readonly revision: number;
  /** Accepted input transaction revision. MediaSession starts at zero and supplies this. */
  readonly inputRevision?: number;
  /** Semantic state captured during this render, before asynchronous presentation. */
  readonly semantic?: Readonly<Record<string, unknown>>;
}

/** Requested clock position and last accepted render are deliberately separate. */
export interface RuntimePresentation {
  readonly requestedFrame: number | null;
  readonly accepted: RuntimeAcceptedPresentation | null;
  /** A render request has not been accepted, including same-frame data updates.
   * MediaSession always supplies this; absence on a legacy host cannot qualify actions.
   */
  readonly isPending?: boolean;
  readonly isReady: boolean;
  readonly disposed: boolean;
}

/** Stable compatibility surface backed directly by one MediaSession. */
export interface RuntimeStore {
  getState: () => RuntimeState;
  subscribe: (listener: () => void) => () => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  beginScrub: () => void;
  endScrub: () => void;
  seekFrame: (frame: number) => void | Promise<void>;
  seekProgress: (progress: number) => void | Promise<void>;
}
