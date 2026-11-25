//! Framework-neutral DOM Player surface over the unified MediaSession.

import type { NormalizedCue } from "@superimg/core/player-core";
import type {
  MediaFrameResult,
  MediaSession,
  RuntimeState,
  RuntimeStore,
} from "@superimg/media";
import type {
  AudioValue,
  CanvasSize,
  CompositionSchedule,
  DriveSource,
  PlaybackMode,
  ResolveBreakdown,
  ResolveCueFinding,
} from "@superimg/types";
import type { PlayerAudioController } from "./player-audio.js";
import {
  loadErrorResult,
  openPlayerSession,
  prepareSessionLoad,
  resolveMediaIRForSession,
  supersededLoadResult,
} from "./player-load.js";
import { LatestLoadTransaction } from "./load-transaction.js";
import { assertAcceptedSeek, PlayerNotReadyError, toRenderedPayload } from "./player-types.js";
import type {
  LoadOptions,
  LoadResult,
  PlayerEvents,
  PlayerInput,
  PlayerUpdate,
  PlayerPresentation,
  PlayerPerformanceSnapshot,
} from "./player-types.js";

export interface DomPlayerOptions {
  /** Host element or CSS selector. Posters and fallbacks remain host-owned. */
  container: string | HTMLElement;
  /** Optional preview canvas override. */
  size?: CanvasSize;
  playbackMode?: PlaybackMode;
  playerMode?: "render-only" | "dev";
  /** Enable WebAudio preview playback when the loaded media declares `audio` (default `true`). */
  audio?: boolean;
  /** Initial WebAudio mute state (default `false`). */
  muted?: boolean;
  /** Initial WebAudio master volume 0..1 (default `1`). */
  volume?: number;
}

export type DomPlayerEvents = Omit<PlayerEvents, "checkpoint">;

export interface DomPlayer {
  readonly container: HTMLElement;
  readonly store: RuntimeStore;
  readonly isMuted: boolean;
  readonly volume: number;
  load(input: PlayerInput, options?: LoadOptions): Promise<LoadResult>;
  update(update: PlayerUpdate): Promise<void>;
  play(): void;
  pause(): void;
  togglePlayPause(): void;
  seek(to: { frame: number } | { progress: number } | { seconds: number }): Promise<void>;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  getState(): RuntimeState;
  getPresentation(): PlayerPresentation;
  getPerformance(): PlayerPerformanceSnapshot | null;
  /** Refresh host geometry after a CSS transform that does not resize its box. */
  refreshGeometry(): void;
  /** Reload after data changes to resolve new cues. */
  getCues(): readonly NormalizedCue[];
  getCompositionSchedule(): CompositionSchedule | null;
  /** Script/film diagnostics published by `resolve()`. */
  getCueFindings(): readonly ResolveCueFinding[];
  /** Per-shot cast & prop breakdown published by `resolve()`. */
  getBreakdown(): ResolveBreakdown | null;
  getDriveKind(): DriveSource | null;
  suspendDrive(): () => void;
  cancelPendingLoad(): void;
  subscribe(listener: () => void): () => void;
  on<K extends keyof DomPlayerEvents>(event: K, callback: DomPlayerEvents[K]): () => void;
  off<K extends keyof DomPlayerEvents>(event: K, callback?: DomPlayerEvents[K]): void;
  dispose(): void;
}

/**
 * Create the small browser playback module. Loading is a two-phase candidate
 * commit, so a bad replacement never tears down the last valid frame.
 */
export function createDomPlayer(options: DomPlayerOptions): DomPlayer {
  const container = resolveContainer(options.container);
  ensurePlayerHost(container);
  if (options.size) applyHostAspectRatio(container, options.size.width, options.size.height);

  let session: MediaSession | null = null;
  let stage: HTMLElement | null = null;
  let sessionDisposers: Array<() => void> = [];
  let disposed = false;
  let generation = 0;
  let compositionSchedule: CompositionSchedule | null = null;
  let resolveCues: ((fps: number, duration: number) => readonly NormalizedCue[]) | null = null;
  const getCues = (): readonly NormalizedCue[] => {
    const state = session?.getState();
    return state && resolveCues ? resolveCues(state.fps, state.duration) : [];
  };
  let resolvedCueFindings: readonly ResolveCueFinding[] = [];
  let resolvedBreakdown: ResolveBreakdown | null = null;
  let audioController: PlayerAudioController | null = null;
  const audioEnabled = options.audio ?? true;
  let audioMuted = options.muted ?? false;
  let audioVolume = Math.max(0, Math.min(1, options.volume ?? 1));
  const loadTransaction = new LatestLoadTransaction();
  let playbackMode = options.playbackMode ?? "once";
  const explicitPlaybackMode = options.playbackMode !== undefined;
  const listeners = new Set<() => void>();
  let events: Partial<{ [K in keyof DomPlayerEvents]: Set<DomPlayerEvents[K]> }> = {};

  const requireSession = (operation: string): MediaSession => {
    if (disposed || !session) throw new PlayerNotReadyError(operation);
    return session;
  };

  const currentSeconds = (current: MediaSession): number => {
    const state = current.getState();
    return state.fps > 0 ? state.currentFrame / state.fps : 0;
  };

  const emitState = (): void => listeners.forEach((listener) => listener());
  const emit = <K extends keyof DomPlayerEvents>(
    event: K,
    ...args: Parameters<DomPlayerEvents[K]>
  ): void => {
    events[event]?.forEach((callback) => {
      (callback as (...values: Parameters<DomPlayerEvents[K]>) => void)(...args);
    });
  };

  const clearSessionWiring = (): void => {
    for (const dispose of sessionDisposers) dispose();
    sessionDisposers = [];
  };

  const getPresentation = (): PlayerPresentation => Object.freeze({
    generation,
    ...(session?.getPresentation() ?? { requestedFrame: null, accepted: null, isReady: false, isPending: false, disposed }),
  });

  const wireSession = (next: MediaSession): void => {
    sessionDisposers = [
      next.subscribe(emitState),
      next.on("presentation", () => emit("presentation", getPresentation())),
      next.on("rendered", (result) => {
        emit("rendered", toRenderedPayload(result));
        emit("frame", result.frame, next.getState().totalFrames);
      }),
      next.on("ready", () => emit("ready")),
      next.on("play", () => emit("play")),
      next.on("pause", () => emit("pause")),
      next.on("ended", () => {
        audioController?.pause();
        emit("ended");
      }),
      next.on("error", (error) => emit("error", error)),
    ];
  };

  const store: RuntimeStore = {
    getState: () => requireSession("store.getState").getState(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: () => {
      const current = requireSession("store.play");
      current.play();
      audioController?.play(currentSeconds(current));
    },
    pause: () => {
      requireSession("store.pause").pause();
      audioController?.pause();
    },
    togglePlayPause: () => {
      const current = requireSession("store.togglePlayPause");
      current.togglePlayPause();
      if (current.getState().isPlaying) audioController?.play(currentSeconds(current));
      else audioController?.pause();
    },
    beginScrub: () => requireSession("store.beginScrub").beginScrub(),
    endScrub: () => requireSession("store.endScrub").endScrub(),
    seekFrame: async (frame) => {
      const current = requireSession("store.seekFrame");
      const res = await current.seekFrame(frame);
      const state = current.getState();
      if (state.fps > 0) audioController?.seek(res.frame / state.fps, state.isPlaying);
    },
    seekProgress: async (progress) => {
      const current = requireSession("store.seekProgress");
      const res = await current.seekProgress(progress);
      const state = current.getState();
      if (state.fps > 0) audioController?.seek(res.frame / state.fps, state.isPlaying);
    },
  };

  return {
    container,
    store,
    get isMuted() { return audioMuted; },
    get volume() { return audioVolume; },
    async load(input, loadOptions = {}) {
      if (disposed) throw new Error("DomPlayer is disposed");
      const outcome = await loadTransaction.run({
        prepare: async (scope) => {
          let candidate: MediaSession | null = null;
          let candidateStage: HTMLElement | null = null;
          const candidateDisposers: Array<() => void> = [];
          const disposeCandidateEvents = () => {
            for (const dispose of candidateDisposers.splice(0)) dispose();
          };
          scope.defer(disposeCandidateEvents);
          scope.defer(() => candidateStage?.remove());
          scope.defer(() => candidate?.dispose());

          const prepared = await prepareSessionLoad(input, loadOptions, options.size);
          let nextPlaybackMode = playbackMode;
          if (!explicitPlaybackMode) {
            const temporal = (prepared.sessionInput as { config?: { temporal?: string } }).config?.temporal;
            nextPlaybackMode = temporal === "loop" ? "loop" : "once";
          }
          candidate = await openPlayerSession(
            prepared,
            loadOptions,
            loadOptions.playerMode ?? options.playerMode ?? "render-only",
            nextPlaybackMode,
          );
          const initialState = candidate.getState();
          resolveMediaIRForSession(loadOptions, {
            width: initialState.width,
            height: initialState.height,
            fps: initialState.fps,
            totalFrames: initialState.totalFrames,
          });

          const buffered: Array<{ type: "rendered"; result: MediaFrameResult } | { type: "ready" }> = [];
          candidateDisposers.push(
            candidate.on("rendered", (result) => buffered.push({ type: "rendered", result })),
            candidate.on("ready", () => buffered.push({ type: "ready" })),
          );
          candidateStage = createStage();
          candidateStage.style.visibility = "hidden";
          container.appendChild(candidateStage);
          const ready = candidate.ready();
          void ready.catch(() => undefined);
          await candidate.mount(candidateStage);
          await ready;
          disposeCandidateEvents();
          let nextAudioController: PlayerAudioController | null = null;
          const authoredAudio = (prepared.sessionInput as { config?: { audio?: AudioValue } })?.config?.audio;
          if (audioEnabled && authoredAudio !== undefined) {
            const { createPlayerAudioController } = await import("./player-audio.js");
            nextAudioController = createPlayerAudioController({
              audio: authoredAudio,
              fps: initialState.fps,
              durationSeconds: initialState.duration,
              ...(loadOptions.assetResolver !== undefined ? { assetResolver: loadOptions.assetResolver } : {}),
              muted: audioMuted,
              volume: audioVolume,
            });
            scope.defer(() => nextAudioController?.dispose());
          }
          return {
            prepared,
            candidate,
            stage: candidateStage,
            buffered,
            initialState,
            playbackMode: nextPlaybackMode,
            audioController: nextAudioController,
            compositionSchedule: prepared.sessionInput.composition?.schedule ?? null,
            resolveCues: prepared.resolveCues,
          };
        },
        commit: (next) => {
          // Commit the already-painted candidate before removing the old surface.
          next.stage.style.visibility = "visible";
          audioController?.dispose();
          audioController = next.audioController;
          clearSessionWiring();
          session?.dispose();
          stage?.remove();
          session = next.candidate;
          generation++;
          compositionSchedule = next.compositionSchedule;
          resolveCues = next.resolveCues;
          resolvedCueFindings = next.prepared.cueFindings ? Object.freeze([...next.prepared.cueFindings]) : [];
          resolvedBreakdown = next.prepared.breakdown ?? null;
          stage = next.stage;
          playbackMode = next.playbackMode;
          wireSession(session);
          applyHostAspectRatio(container, next.initialState.width, next.initialState.height);
          emitState();
          emit("presentation", getPresentation());
          for (const event of next.buffered) {
            if (event.type === "rendered") {
              emit("rendered", toRenderedPayload(event.result));
              emit("frame", event.result.frame, session.getState().totalFrames);
            } else {
              emit("ready");
            }
          }
          const state = session.getState();
          return {
            status: "success" as const,
            cues: getCues(),
            totalFrames: state.totalFrames,
            duration: state.duration,
            width: state.width,
            height: state.height,
            fps: state.fps,
            ...(next.prepared.cueFindings !== undefined ? { cueFindings: resolvedCueFindings } : {}),
            ...(next.prepared.breakdown !== undefined ? { breakdown: next.prepared.breakdown } : {}),
          };
        },
      });
      if (outcome.status === "committed") return outcome.value;
      if (outcome.status === "superseded") return supersededLoadResult();
      const err = outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error));
      emit("error", err);
      return loadErrorResult(outcome.error);
    },
    async update(update) {
      const current = requireSession("update");
      const next = { ...update };
      const size = next.size ? { ...next.size } : undefined;
      if (next.size) {
        next.width = next.size.width;
        next.height = next.size.height;
        delete next.size;
      }
      await current.update(next);
      if (size && session === current) options.size = size;
    },
    play: () => {
      const current = requireSession("play");
      current.play();
      audioController?.play(currentSeconds(current));
    },
    pause: () => {
      requireSession("pause").pause();
      audioController?.pause();
    },
    togglePlayPause: () => {
      const current = requireSession("togglePlayPause");
      current.togglePlayPause();
      if (current.getState().isPlaying) audioController?.play(currentSeconds(current));
      else audioController?.pause();
    },
    async seek(to) {
      const current = requireSession("seek");
      const result = "frame" in to ? await current.seekFrame(to.frame)
        : "seconds" in to ? await current.seekTimeSeconds(to.seconds)
          : await current.seekProgress(to.progress);
      assertAcceptedSeek(result, "frame" in to ? to.frame : undefined);
      const state = current.getState();
      if (state.fps > 0) audioController?.seek(result.frame / state.fps, state.isPlaying);
    },
    setMuted(muted) {
      audioMuted = muted;
      audioController?.setMuted(muted);
    },
    setVolume(volume) {
      audioVolume = Math.max(0, Math.min(1, volume));
      audioController?.setVolume(audioVolume);
    },
    getState: () => requireSession("getState").getState(),
    getPresentation,
    getPerformance: () => {
      const snapshot = session?.getPerformance();
      return snapshot ? Object.freeze({ generation, ...snapshot }) : null;
    },
    refreshGeometry: () => requireSession("refreshGeometry").refreshGeometry(),
    getCues,
    getCompositionSchedule: () => compositionSchedule,
    getCueFindings: () => resolvedCueFindings,
    getBreakdown: () => resolvedBreakdown,
    getDriveKind: () => null,
    cancelPendingLoad: () => loadTransaction.invalidate(),
    suspendDrive: () => {
      if (disposed) throw new Error("DomPlayer is disposed");
      return () => undefined;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    on(event, callback) {
      let set = events[event] as Set<typeof callback> | undefined;
      if (!set) {
        set = new Set<typeof callback>();
        Object.assign(events, { [event]: set });
      }
      set.add(callback);
      return () => this.off(event, callback);
    },
    off(event, callback) {
      if (!callback) {
        events[event]?.clear();
        return;
      }
      events[event]?.delete(callback as never);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      loadTransaction.invalidate();
      audioController?.dispose();
      audioController = null;
      clearSessionWiring();
      session?.dispose();
      session = null;
      stage?.remove();
      stage = null;
      compositionSchedule = null;
      resolveCues = null;
      resolvedCueFindings = [];
      resolvedBreakdown = null;
      emit("presentation", getPresentation());
      listeners.clear();
      events = {};
    },
  };
}

function resolveContainer(target: string | HTMLElement): HTMLElement {
  if (typeof target === "string") {
    const element = document.querySelector(target);
    if (!element) throw new Error(`DomPlayer container not found: ${target}`);
    return element as HTMLElement;
  }
  return target;
}

function ensurePlayerHost(container: HTMLElement): void {
  if (typeof getComputedStyle === "function" && getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
}

function createStage(): HTMLElement {
  const stage = document.createElement("div");
  stage.setAttribute("data-superimg-dom-stage", "1");
  stage.style.cssText = "position:absolute;inset:0;width:100%;height:100%;min-height:1px;";
  return stage;
}

function applyHostAspectRatio(container: HTMLElement, width?: number, height?: number): void {
  if (!(width && height && width > 0 && height > 0)) return;
  if (!container.style.aspectRatio) container.style.aspectRatio = `${width} / ${height}`;
  if (!container.style.width) container.style.width = "100%";
  if (!container.style.maxWidth) container.style.maxWidth = "100%";
  if (!container.style.background) container.style.background = "transparent";
  container.setAttribute("data-superimg-stage", "1");
  container.setAttribute("data-superimg-width", String(width));
  container.setAttribute("data-superimg-height", String(height));
}
