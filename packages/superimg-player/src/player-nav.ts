//! Checkpoint navigation helpers for passive Player playback.

import type { CheckpointResolver } from "@superimg/core/player-core";
import type { Checkpoint, JsonObject } from "@superimg/types";
import { PlayerNotReadyError } from "./player-types.js";
import { mergeCheckpointList } from "./player-session.js";

export interface PlayerNavHost {
  readonly currentFrame: number;
  seekFrame(frame: number): void;
  readonly checkpointResolverInstance: CheckpointResolver | null;
  get checkpointCache(): Checkpoint[] | null;
  set checkpointCache(v: Checkpoint[] | null);
  requireCheckpointResolver(operation: string): CheckpointResolver;
}

export function listCheckpoints(host: PlayerNavHost): readonly Checkpoint[] {
  if (host.checkpointCache) return host.checkpointCache;
  host.checkpointCache = mergeCheckpointList(host.checkpointResolverInstance);
  return host.checkpointCache;
}

export function getCurrentCheckpoint(host: PlayerNavHost): Checkpoint | undefined {
  const frame = host.currentFrame;
  let current: Checkpoint | undefined;
  for (const checkpoint of listCheckpoints(host)) {
    if (checkpoint.frame <= frame) current = checkpoint;
    else break;
  }
  return current;
}

export function goToCheckpoint(host: PlayerNavHost, id: string): void {
  const checkpoint = listCheckpoints(host).find((item) => item.id === id);
  if (checkpoint) host.seekFrame(checkpoint.frame);
}

export function nextCheckpoint(host: PlayerNavHost): void {
  const checkpoint = listCheckpoints(host).find(
    (item) => item.frame > host.currentFrame,
  );
  if (checkpoint) host.seekFrame(checkpoint.frame);
}

export function prevCheckpoint(host: PlayerNavHost): void {
  let previous: Checkpoint | undefined;
  for (const checkpoint of listCheckpoints(host)) {
    if (checkpoint.frame >= host.currentFrame) break;
    previous = checkpoint;
  }
  if (previous) host.seekFrame(previous.frame);
}

export function addCheckpoint(
  host: PlayerNavHost,
  id: string,
  frame: number,
  options?: { label?: string; metadata?: JsonObject },
): Checkpoint {
  const resolver = host.requireCheckpointResolver("addCheckpoint");
  const checkpoint = resolver.add(id, frame, options);
  host.checkpointCache = null;
  return checkpoint;
}

export function removeCheckpoint(host: PlayerNavHost, id: string): boolean {
  const removed = host.checkpointResolverInstance?.remove(id) ?? false;
  if (removed) host.checkpointCache = null;
  return removed;
}
