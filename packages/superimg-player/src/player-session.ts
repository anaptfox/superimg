//! Session event wiring + store sync + checkpoint list helpers for Player.

import { CheckpointResolver } from "@superimg/core/player-core";
import type { MediaSession } from "@superimg/media";
import type { Checkpoint, Marker } from "@superimg/types";
import type { PlayerEvents } from "./player-types.js";
import { toRenderedPayload } from "./player-types.js";

export function createCheckpointResolver(
  session: MediaSession | null,
  markers: Marker[],
): CheckpointResolver | null {
  const state = session?.getState();
  if (!state) return null;
  return new CheckpointResolver(markers, state.totalFrames, state.fps);
}

export function mergeCheckpointList(
  resolver: CheckpointResolver | null,
): Checkpoint[] {
  return [...(resolver?.getAll() ?? [])].sort((a, b) => a.frame - b.frame);
}

export interface SessionEventHandlers {
  onReady: () => void;
  onRendered: (frame: number, total: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError: (error: Error) => void;
  getTotalFrames: () => number;
  emitRendered: PlayerEvents["rendered"];
}

/** Subscribe to MediaSession events; returns disposers. */
export function wireMediaSessionEvents(
  session: MediaSession,
  handlers: SessionEventHandlers,
): Array<() => void> {
  return [
    session.on("ready", handlers.onReady),
    session.on("rendered", (result) => {
      handlers.emitRendered(toRenderedPayload(result));
      const total = handlers.getTotalFrames() || session.getState().totalFrames;
      handlers.onRendered(result.frame, total);
    }),
    session.on("play", handlers.onPlay),
    session.on("pause", handlers.onPause),
    session.on("ended", handlers.onEnded),
    session.on("error", handlers.onError),
  ];
}
