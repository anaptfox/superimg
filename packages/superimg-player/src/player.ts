//! Player - high-level browser controller over MediaSession

import type { CheckpointResolver, NormalizedCue } from "@superimg/core/player-core";
import type {
  MediaFrameResult,
  MediaSession,
  RuntimeState,
  RuntimeStore,
} from "@superimg/media";
import type { PlayerAudioController } from "./player-audio.js";
import { DriveController } from "./player-drive.js";
import { HoverController } from "./player-hover.js";
import type {
  Checkpoint,
  DriveSource,
  HoverBehavior,
  Marker,
  MediaIR,
  PlaybackMode,
  JsonObject,
  CompositionSchedule,
  ResolveBreakdown,
  ResolveCueFinding,
} from "@superimg/types";
import {
  loadErrorResult,
  openPlayerSession,
  prepareSessionLoad,
  resolveMediaIRForSession,
  supersededLoadResult,
} from "./player-load.js";
import { LatestLoadTransaction } from "./load-transaction.js";
import {
  addCheckpoint as navAddCheckpoint,
  getCurrentCheckpoint as navGetCurrentCheckpoint,
  goToCheckpoint as navGoToCheckpoint,
  listCheckpoints,
  nextCheckpoint as navNextCheckpoint,
  prevCheckpoint as navPrevCheckpoint,
  removeCheckpoint as navRemoveCheckpoint,
  type PlayerNavHost,
} from "./player-nav.js";
import {
  createCheckpointResolver,
  wireMediaSessionEvents,
} from "./player-session.js";
import {
  assertMediaIRMatchesRuntime,
  assertAcceptedSeek,
  PlayerNotReadyError,
  toRenderedPayload,
  type LoadOptions,
  type LoadResult,
  type PlayerEvents,
  type PlayerInput,
  type PlayerOptions,
  type PlayerUpdate,
  type PlayerPresentation,
  type PlayerPerformanceSnapshot,
} from "./player-types.js";

export type {
  PlayerOptions,
  LoadOptions,
  LoadResult,
  PlayerInput,
  PlayerUpdate,
  PlayerEvents,
  PlayerPresentation,
  PlayerPerformanceSnapshot,
} from "./player-types.js";

export class Player {
  private container: HTMLElement;
  private session: MediaSession | null = null;
  private resolveCues: ((fps: number, duration: number) => readonly NormalizedCue[]) | null = null;
  private stage: HTMLElement | null = null;
  private sessionEventDisposers: Array<() => void> = [];
  private checkpointResolverInstance: CheckpointResolver | null = null;
  private checkpointCache: Checkpoint[] | null = null;
  private markerList: Marker[] = [];
  private resolvedCueFindings: readonly ResolveCueFinding[] = [];
  private resolvedBreakdown: ResolveBreakdown | null = null;
  private size: import("@superimg/types").CanvasSize | undefined;
  private options: {
    playbackMode: PlaybackMode;
    hoverBehavior: HoverBehavior;
    hoverDelayMs: number;
    hoverLeaveBehavior: "pause" | "reset";
    playerMode: "render-only" | "dev";
    drive?: DriveSource;
    audio: boolean;
  };
  private audioController: PlayerAudioController | null = null;
  private audioMuted = false;
  private audioVolume = 1;
  private driveController: DriveController | null = null;
  private gestureActive = false;
  private driveSuspensions = 0;
  private generation = 0;
  private disposed = false;
  private compositionSchedule: CompositionSchedule | null = null;
  private events: Partial<{ [K in keyof PlayerEvents]: Set<PlayerEvents[K]> }> = {};
  private hoverController!: HoverController;
  private lastCheckpointId: string | null = null;
  private _mediaIR: MediaIR | null = null;
  /** True when the host set playbackMode explicitly (do not override from temporal). */
  private explicitPlaybackMode = false;
  /** Only the newest prepared candidate may commit. */
  private readonly loadTransaction = new LatestLoadTransaction();

  constructor(options: PlayerOptions) {
    if (typeof options.container === "string") {
      const element = document.querySelector(options.container);
      if (!element) throw new Error(`Container not found: ${options.container}`);
      this.container = element as HTMLElement;
    } else {
      this.container = options.container;
    }

    this.size = options.size;
    this.explicitPlaybackMode = options.playbackMode !== undefined;
    this.options = {
      playbackMode: options.playbackMode ?? "once",
      hoverBehavior: options.hoverBehavior ?? "none",
      hoverDelayMs: options.hoverDelayMs ?? 200,
      hoverLeaveBehavior: options.hoverLeaveBehavior ?? "pause",
      playerMode: options.playerMode ?? "render-only",
      audio: options.audio ?? true,
      ...(options.drive !== undefined ? { drive: options.drive } : {}),
    };
    this.audioMuted = options.muted ?? false;
    this.audioVolume = Math.max(0, Math.min(1, options.volume ?? 1));

    if (options.drive && options.hoverBehavior === "preview-scrub") {
      console.warn(
        '[superimg] hoverBehavior "preview-scrub" is overridden by drive. Set hoverBehavior: "none".',
      );
    }

    this.hoverController = new HoverController(
      this.container,
      {
        behavior: this.options.hoverBehavior,
        delayMs: this.options.hoverDelayMs,
        leaveBehavior: this.options.hoverLeaveBehavior,
      },
      () => (this.session ? {
        play: () => this.play(), pause: () => this.pause(), seek: (to) => this.seekFromInput(to),
      } : null),
    );
    this.hoverController.install();
  }

  async load(input: PlayerInput, options: LoadOptions = {}): Promise<LoadResult> {
    if (this.disposed) throw new Error("Player is disposed");
    const outcome = await this.loadTransaction.run({
      // Prepare + validate the next session *before* tearing down so a failed
      // load keeps the last valid preview (Studio compile-error contract).
      prepare: async (scope) => {
        let nextSession: Awaited<ReturnType<typeof openPlayerSession>> | null = null;
        let nextStage: HTMLElement | null = null;
        const bufferedEvents: Array<
          | { type: "rendered"; result: MediaFrameResult }
          | { type: "ready" }
        > = [];
        const candidateDisposers: Array<() => void> = [];
        const disposeCandidateEvents = () => {
          for (const dispose of candidateDisposers.splice(0)) dispose();
        };
        scope.defer(disposeCandidateEvents);
        scope.defer(() => nextStage?.remove());
        scope.defer(() => nextSession?.dispose());

        const prepared = await prepareSessionLoad(input, options, this.size);
        const playerMode = options.playerMode ?? this.options.playerMode ?? "render-only";
        let nextPlaybackMode = this.options.playbackMode;
        // temporal: "loop" ⇒ looping preview unless host set playbackMode explicitly
        if (!this.explicitPlaybackMode) {
          const mod = prepared.sessionInput as { config?: { temporal?: string } };
          nextPlaybackMode = mod?.config?.temporal === "loop" ? "loop" : "once";
        }
        nextSession = await openPlayerSession(
          prepared,
          options,
          playerMode,
          nextPlaybackMode,
        );
        const initialState = nextSession.getState();
        // Validate IR against the *new* session before discarding the old one.
        const nextMediaIR = resolveMediaIRForSession(options, {
          width: initialState.width,
          height: initialState.height,
          fps: initialState.fps,
          totalFrames: initialState.totalFrames,
        });

        // Paint into a hidden candidate surface. The host's current frame (and
        // any SSR poster beneath it) remains untouched until readiness commits.
        candidateDisposers.push(
          nextSession.on("rendered", (result) => {
            bufferedEvents.push({ type: "rendered", result });
          }),
          nextSession.on("ready", () => {
            bufferedEvents.push({ type: "ready" });
          }),
        );
        const candidateReady = nextSession.ready();
        // mount() rejects the same readiness promise before rethrowing. Attach a
        // handler now so a failed first paint cannot surface as an
        // unhandled rejection while load() returns its structured error.
        void candidateReady.catch(() => undefined);
        nextStage = createPlayerStage();
        nextStage.style.visibility = "hidden";
        this.container.appendChild(nextStage);
        await nextSession.mount(nextStage);
        await candidateReady;
        disposeCandidateEvents();
        let nextAudioController: PlayerAudioController | null = null;
        const authoredAudio = (prepared.sessionInput as { config?: { audio?: import("@superimg/types").AudioValue } })?.config?.audio;
        if (this.options.audio && authoredAudio !== undefined) {
          const { createPlayerAudioController } = await import("./player-audio.js");
          nextAudioController = createPlayerAudioController({
            audio: authoredAudio,
            fps: initialState.fps,
            durationSeconds: initialState.duration,
            ...(options.assetResolver !== undefined ? { assetResolver: options.assetResolver } : {}),
            muted: this.audioMuted,
            volume: this.audioVolume,
          });
          scope.defer(() => nextAudioController?.dispose());
        }
        return {
          prepared,
          session: nextSession,
          stage: nextStage,
          mediaIR: nextMediaIR,
          playbackMode: nextPlaybackMode,
          audioController: nextAudioController,
          bufferedEvents,
        };
      },
      commit: (candidate) => {
        // Commit only after prepare, IR validation, mount, and first paint.
        candidate.stage.style.visibility = "visible";
        this.teardownPlayback();
        this.options.playbackMode = candidate.playbackMode;
        this.audioController = candidate.audioController;
        this.lastCheckpointId = null;
        this.markerList = candidate.prepared.markers;
        this.resolvedCueFindings = candidate.prepared.cueFindings ? Object.freeze([...candidate.prepared.cueFindings]) : [];
        this.resolvedBreakdown = candidate.prepared.breakdown ?? null;
        this.session = candidate.session;
        this.resolveCues = candidate.prepared.resolveCues;
        this.generation++;
        this.compositionSchedule = candidate.prepared.sessionInput.composition?.schedule ?? null;
        this.stage = candidate.stage;
        this._mediaIR = candidate.mediaIR;
        this.rebuildCheckpointResolver();
        this.emit("presentation", this.getPresentation());

        for (const event of candidate.bufferedEvents) {
          if (event.type === "rendered") {
            this.emit("rendered", toRenderedPayload(event.result));
            const total = this.session.getState().totalFrames;
            this.handleRenderedFrame(event.result.frame, total);
          } else {
            this.emit("ready");
          }
        }
        this.wireSessionEvents(this.session);
        this.installDrive();

        const sessionState = this.session.getState();
        return {
          status: "success" as const,
          cues: this.getCues(),
          totalFrames: sessionState.totalFrames,
          duration: sessionState.duration,
          width: sessionState.width,
          height: sessionState.height,
          fps: sessionState.fps,
          ...(candidate.prepared.cueFindings !== undefined ? { cueFindings: this.resolvedCueFindings } : {}),
          ...(candidate.prepared.breakdown !== undefined ? { breakdown: candidate.prepared.breakdown } : {}),
        };
      },
    });
    if (outcome.status === "committed") return outcome.value;
    if (outcome.status === "superseded") return supersededLoadResult();
    const err = outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error));
    this.emit("error", err);
    return loadErrorResult(outcome.error);
  }

  async update(update: PlayerUpdate): Promise<void> {
    const session = this.requireSession("update");
    const next = { ...update };
    const size = next.size ? { ...next.size } : undefined;
    if (next.size) {
      next.width = next.size.width;
      next.height = next.size.height;
      delete next.size;
    }
    await session.update(next);
    if (size && this.session === session) this.size = size;
    this.rebuildCheckpointResolver();
  }

  render(frame?: number): Promise<void> {
    const target = frame ?? this.currentFrame;
    return this.requireSession("render").renderFrame(target).then((result) => { assertAcceptedSeek(result, target); });
  }

  play(): void {
    const session = this.requireSession("play");
    session.play();
    this.audioController?.play(this.currentTimeSeconds);
  }

  pause(): void {
    this.requireSession("pause").pause();
    this.audioController?.pause();
  }

  async seek(to: { frame: number } | { progress: number } | { seconds: number }): Promise<void> {
    const session = this.requireSession("seek");
    const result = "frame" in to ? await session.seekFrame(to.frame)
      : "seconds" in to ? await session.seekTimeSeconds(to.seconds)
        : await session.seekProgress(to.progress);
    assertAcceptedSeek(result, "frame" in to ? to.frame : undefined);
    this.audioController?.seek(result.frame / this.fps, this.isPlaying);
  }

  /** Mute or unmute WebAudio preview playback. */
  setMuted(muted: boolean): void {
    this.audioMuted = muted;
    this.audioController?.setMuted(muted);
  }

  /** Set WebAudio preview master volume (0..1). */
  setVolume(volume: number): void {
    this.audioVolume = Math.max(0, Math.min(1, volume));
    this.audioController?.setVolume(this.audioVolume);
  }

  get isMuted(): boolean { return this.audioMuted; }
  get volume(): number { return this.audioVolume; }

  beginGestureSeek(): void {
    this.gestureActive = true;
    this.hoverController.suppress(true);
    this.requireSession("beginGestureSeek").beginScrub();
  }

  endGestureSeek(): void {
    this.gestureActive = false;
    this.session?.endScrub();
    this.hoverController.suppress(this.driveSuspensions > 0);
  }

  private installDrive(): void {
    this.driveController?.dispose();
    this.driveController = null;
    if (this.stage) this.stage.style.pointerEvents = "";
    const source = this.options.drive;
    if (!source) return;
    this.options.playbackMode = "once";
    this.pause();
    if (this.driveSuspensions > 0) return;
    if (source === "pointer" && this.stage) this.stage.style.pointerEvents = "none";
    this.driveController = new DriveController(this.container, source, () => {
      if (!this.session) return null;
      const player = this;
      return {
        seek: (to) => this.seekFromInput(to),
        get currentProgress() { return player.currentProgress; },
        get totalFrames() { return player.totalFrames; },
        beginGestureSeek: () => this.beginGestureSeek(),
        endGestureSeek: () => this.endGestureSeek(),
      };
    });
    this.driveController.install();
  }

  getState(): RuntimeState {
    return this.requireSession("getState").getState();
  }

  getPerformance(): PlayerPerformanceSnapshot | null {
    const snapshot = this.session?.getPerformance();
    return snapshot ? Object.freeze({ generation: this.generation, ...snapshot }) : null;
  }

  /** Refresh after a host/ancestor transform that ResizeObserver cannot observe. */
  refreshGeometry(): void {
    this.requireSession("refreshGeometry").refreshGeometry();
  }

  getPresentation(): PlayerPresentation {
    return Object.freeze({
      generation: this.generation,
      ...(this.session?.getPresentation() ?? {
        requestedFrame: null, accepted: null, isReady: false, isPending: false, disposed: this.disposed,
      }),
    });
  }

  /** Cues from the accepted load, expressed on the accepted clock. Reload after data changes to resolve new cues. */
  getCues(): readonly NormalizedCue[] {
    const state = this.session?.getState();
    return state && this.resolveCues ? this.resolveCues(state.fps, state.duration) : [];
  }

  getCompositionSchedule(): CompositionSchedule | null { return this.compositionSchedule; }

  /** Script/film diagnostics published by `resolve()`. */
  getCueFindings(): readonly ResolveCueFinding[] { return this.resolvedCueFindings; }

  /** Per-shot cast & prop breakdown published by `resolve()`. */
  getBreakdown(): ResolveBreakdown | null { return this.resolvedBreakdown; }

  getDriveKind(): DriveSource | null { return this.options.drive ?? null; }

  /** Suspend input ownership until every lease is released, including across reloads. */
  suspendDrive(): () => void {
    if (this.disposed) throw new Error("Player is disposed");
    this.driveSuspensions++;
    this.driveController?.dispose();
    this.driveController = null;
    if (this.stage) this.stage.style.pointerEvents = "";
    this.hoverController.suppress(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.driveSuspensions--;
      if (this.disposed || this.driveSuspensions > 0) return;
      this.hoverController.suppress(false);
      if (this.session) this.installDrive();
    };
  }

  /** Invalidate an invisible candidate when host preparation starts a newer selection. */
  cancelPendingLoad(): void { this.loadTransaction.invalidate(); }

  private seekFromInput(to: { frame: number } | { progress: number } | { seconds: number }): void {
    void this.seek(to).catch((error: unknown) => {
      if (this.disposed || (error as { code?: string })?.code === "PLAYER_PRESENTATION_SUPERSEDED") return;
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    });
  }

  /** Host mount element, exposed for optional host-driven composition bridges. */
  get hostElement(): HTMLElement {
    return this.container;
  }

  subscribe(listener: () => void): () => void {
    return this.requireSession("subscribe").subscribe(listener);
  }

  /** The session-backed store used by React and development controls. */
  get store(): RuntimeStore {
    return this.requireSession("store").asStore();
  }

  /** Media IR attached at load (if provided). */
  get mediaIR(): MediaIR | null {
    return this._mediaIR;
  }

  /**
   * Attach or clear Media IR after load. Validates canvas/clock against current session.
   */
  setMediaIR(ir: MediaIR | null): void {
    if (!ir) {
      this._mediaIR = null;
      return;
    }
    const state = this.session?.getState();
    if (!state) throw new PlayerNotReadyError("setMediaIR");
    assertMediaIRMatchesRuntime(
      ir,
      {
        width: state.width,
        height: state.height,
        fps: state.fps,
        totalFrames: state.totalFrames,
      },
      "MediaIR clock/canvas does not match resolved template",
    );
    this._mediaIR = ir;
  }

  get playbackMode(): PlaybackMode {
    return this.options.playbackMode;
  }

  set playbackMode(mode: PlaybackMode) {
    this.explicitPlaybackMode = true;
    this.options.playbackMode = mode;
    void this.session?.update({ playbackMode: mode }).catch((error) => this.emit("error", error));
  }

  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): () => void {
    let set = this.events[event] as Set<PlayerEvents[K]> | undefined;
    if (!set) {
      set = new Set<PlayerEvents[K]>();
      Object.assign(this.events, { [event]: set });
    }
    set.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof PlayerEvents>(event: K, callback?: PlayerEvents[K]): void {
    if (!callback) {
      this.events[event]?.clear();
      return;
    }
    this.events[event]?.delete(callback as never);
  }

  getCheckpoints(): Checkpoint[] {
    return [...listCheckpoints(this.navHost())];
  }

  getCurrentCheckpoint(): Checkpoint | undefined {
    return navGetCurrentCheckpoint(this.navHost());
  }

  goToCheckpoint(id: string): void {
    navGoToCheckpoint(this.navHost(), id);
  }

  nextCheckpoint(): void {
    navNextCheckpoint(this.navHost());
  }

  prevCheckpoint(): void {
    navPrevCheckpoint(this.navHost());
  }

  addCheckpoint(
    id: string,
    frame: number = this.currentFrame,
    options?: { label?: string; metadata?: JsonObject },
  ): Checkpoint {
    return navAddCheckpoint(this.navHost(), id, frame, options);
  }

  removeCheckpoint(id: string): boolean {
    return navRemoveCheckpoint(this.navHost(), id);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.loadTransaction.invalidate();
    this.driveController?.dispose();
    this.driveController = null;
    this.teardownPlayback();
    this.hoverController.dispose();
    this.checkpointResolverInstance = null;
    this.checkpointCache = null;
    this.compositionSchedule = null;
    this.resolveCues = null;
    this.emit("presentation", this.getPresentation());
    this.events = {};
  }

  get isReady(): boolean { return this.session?.getState().isReady ?? false; }
  get isPlaying(): boolean { return this.session?.getState().isPlaying ?? false; }
  get currentFrame(): number { return this.session?.getState().currentFrame ?? 0; }
  get totalFrames(): number { return this.session?.getState().totalFrames ?? 0; }
  get fps(): number { return this.session?.getState().fps ?? 30; }
  get currentProgress(): number {
    const total = this.totalFrames;
    return total > 1 ? this.currentFrame / (total - 1) : 0;
  }
  get currentTimeSeconds(): number { return this.currentFrame / this.fps; }
  get totalDurationSeconds(): number { return this.session?.getState().duration ?? 0; }
  get renderWidth(): number { return this.session?.getState().width ?? 0; }
  get renderHeight(): number { return this.session?.getState().height ?? 0; }
  get checkpointResolver(): CheckpointResolver | null {
    return this.checkpointResolverInstance;
  }

  private navHost(): PlayerNavHost {
    const self = this;
    return {
      get currentFrame() { return self.currentFrame; },
      seekFrame: (frame) => self.seekFromInput({ frame }),
      get checkpointResolverInstance() { return self.checkpointResolverInstance; },
      get checkpointCache() { return self.checkpointCache; },
      set checkpointCache(v) { self.checkpointCache = v; },
      requireCheckpointResolver: (op) => self.requireCheckpointResolver(op),
    };
  }

  private handlePlaybackEnd(): void {
    this.audioController?.pause();
    this.emit("ended");
  }

  private teardownPlayback(): void {
    this.audioController?.dispose();
    this.audioController = null;
    for (const dispose of this.sessionEventDisposers) dispose();
    this.sessionEventDisposers = [];
    this.session?.dispose();
    this.session = null;
    this.stage?.remove();
    this.stage = null;
  }

  private wireSessionEvents(session: MediaSession): void {
    this.sessionEventDisposers.push(
      session.on("presentation", () => this.emit("presentation", this.getPresentation())),
      ...wireMediaSessionEvents(session, {
        onReady: () => {
          this.emit("ready");
        },
        onRendered: (frame, total) => this.handleRenderedFrame(frame, total),
        onPlay: () => this.emit("play"),
        onPause: () => this.emit("pause"),
        onEnded: () => this.handlePlaybackEnd(),
        onError: (error) => this.emit("error", error),
        getTotalFrames: () => this.session?.getState().totalFrames ?? 0,
        emitRendered: (payload) => this.emit("rendered", payload),
      }),
    );
  }

  private handleRenderedFrame(frame: number, total: number): void {
    this.emit("frame", frame, total);
    this.emitCheckpoint(frame);
  }

  private rebuildCheckpointResolver(): void {
    this.checkpointCache = null;
    this.checkpointResolverInstance = createCheckpointResolver(this.session, this.markerList);
  }

  private emitCheckpoint(frame: number): void {
    const checkpoint = listCheckpoints(this.navHost()).find((item) => item.frame === frame);
    if (!checkpoint || checkpoint.id === this.lastCheckpointId) return;
    this.lastCheckpointId = checkpoint.id;
    this.emit("checkpoint", checkpoint);
  }

  private requireSession(operation: string): MediaSession {
    if (!this.session) throw new PlayerNotReadyError(operation);
    return this.session;
  }

  private requireCheckpointResolver(operation: string): CheckpointResolver {
    if (!this.checkpointResolverInstance) throw new PlayerNotReadyError(operation);
    return this.checkpointResolverInstance;
  }

  private emit<K extends keyof PlayerEvents>(
    event: K,
    ...args: Parameters<PlayerEvents[K]>
  ): void {
    this.events[event]?.forEach((callback) => {
      (callback as (...a: Parameters<PlayerEvents[K]>) => void)(...args);
    });
  }
}

function createPlayerStage(): HTMLElement {
  const stage = document.createElement("div");
  stage.setAttribute("data-superimg-player-stage", "1");
  stage.style.cssText = "position:absolute;inset:0;width:100%;height:100%;min-height:1px;";
  return stage;
}
