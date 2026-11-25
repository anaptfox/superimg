//! MediaSession is the single browser playback authority: one clock, one state,
//! one evaluator, and one presenter.

import {
  createPreparedStdlibForTemplate,
  type PreparedStdlib,
  type RuntimeTemplate,
} from "@superimg/core/player-core";
import type { AssetMeta, CanvasSize } from "@superimg/types";
import { MediaClock, type MediaClockState, type MediaPlaybackMode } from "./clock.js";
import { IframePresenter, type DomPresenter } from "./dom-presenter.js";
import {
  FrameEvaluator,
  type EvaluatedFrame,
  type FrameEvaluatorOptions,
} from "./frame-evaluator.js";
import { buildMediaGraph, type MediaGraph } from "./graph.js";
import { syncPlateMedia } from "./plate-sync.js";
import {
  RuntimePerformanceProbe,
  type FramePerformanceSample,
  type RuntimePerformanceOptions,
  type RuntimePerformanceSnapshot,
} from "./performance.js";
import type { PlayerMode } from "./player-policy.js";
import { DomMediaSurface, type MediaSurface, type MediaSurfaceMountOptions } from "./surface.js";
import type {
  PreResolvedFonts,
  RuntimeInput,
  RuntimeStore,
  RuntimeUpdate,
  RuntimeState,
  RuntimeAcceptedPresentation,
  RuntimePresentation,
} from "./runtime-contract.js";

export type MediaSessionPlayback = "native" | "deterministic";

export interface MediaSessionOptions {
  data?: Record<string, unknown>;
  size?: CanvasSize;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  fonts?: PreResolvedFonts;
  playback?: MediaSessionPlayback;
  playbackMode?: MediaPlaybackMode;
  /** Product seam: production render-only or trusted development islands. */
  playerMode?: PlayerMode;
  /** Internal adapter seam used by browser and presenter contract tests. */
  presenter?: DomPresenter;
  /** Internal host hook for semantics associated with the evaluated request. */
  captureSemantic?: FrameEvaluatorOptions["captureSemantic"];
  /** Internal host validation for a candidate clock, before publication. */
  validateClock?: (clock: { fps: number; duration: number }) => void;
  /** Opt-in bounded numeric diagnostics; never retains HTML or user data. */
  performance?: RuntimePerformanceOptions;
}

export interface MediaSessionUpdate {
  data?: Record<string, unknown>;
  size?: CanvasSize;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  fonts?: PreResolvedFonts;
  playbackMode?: MediaPlaybackMode;
}

export interface MediaSessionState extends RuntimeState {
  graph: MediaGraph;
  surface: MediaSurface | null;
}

export interface MediaFrameResult extends RuntimeAcceptedPresentation {
  graph: MediaGraph;
  stale?: boolean;
}

export interface MediaSessionEvents {
  ready: () => void;
  rendered: (result: MediaFrameResult) => void;
  presentation: (presentation: RuntimePresentation) => void;
  play: () => void;
  pause: () => void;
  ended: () => void;
  error: (error: Error) => void;
}

type Listener = () => void;

export async function createMediaSession(
  template: RuntimeInput,
  options: MediaSessionOptions = {},
): Promise<MediaSession> {
  const preparedStdlib = await createPreparedStdlibForTemplate(template as RuntimeTemplate);
  let captureSemantic = options.captureSemantic;
  if (!captureSemantic && template.composition) {
    const { interactiveCompositionRuntimes } = await import("@superimg/core/player-composition");
    const entries = interactiveCompositionRuntimes(template);
    if (entries.length) captureSemantic = () => Object.fromEntries(entries.map(({ path, runtime }) => [path, runtime.getSnapshot()]));
  }
  return new MediaSession(template, { ...options, ...(captureSemantic ? { captureSemantic } : {}) }, preparedStdlib);
}

export class MediaSession {
  private options: MediaSessionOptions;
  private evaluator: FrameEvaluator;
  private readonly presenter: DomPresenter;
  private readonly clock: MediaClock;
  private state: MediaSessionState;
  private surface: MediaSurface | null = null;
  private readonly listeners = new Set<Listener>();
  private renderToken = 0;
  private acceptedRenderToken = 0;
  // Clock frames are expendable; data candidates only yield to another update
  // or an explicit seek/render. A busy presenter must not starve live data.
  private updateToken = 0;
  private inputRevision = 0;
  private pendingUpdateToken: number | null = null;
  private renderChain: Promise<void> = Promise.resolve();
  private lastResult: MediaFrameResult | null = null;
  private requestedFrame: number | null = null;
  private acceptedRevision = 0;
  private lastGraphHtml: string | null = null;
  private suppressClockRender = false;
  private suppressClockPublication = false;
  private disposed = false;
  private targetRoot: Document | Element | null = null;
  private targetRevision: number | null = null;
  private videoTargets: HTMLVideoElement[] | null = null;
  private plateTargets: HTMLElement[] | null = null;
  private events: Partial<{ [K in keyof MediaSessionEvents]: Set<MediaSessionEvents[K]> }> = {};
  private readonly readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (error: unknown) => void;
  private readonly runtimeStore: RuntimeStore;
  private readonly performance: RuntimePerformanceProbe | null;

  constructor(
    private readonly template: RuntimeInput,
    options: MediaSessionOptions = {},
    preparedStdlib?: PreparedStdlib,
  ) {
    this.options = { ...options };
    this.performance = options.performance ? new RuntimePerformanceProbe(options.performance) : null;
    this.evaluator = new FrameEvaluator(template, toEvaluatorOptions(this.options), preparedStdlib);
    const playerMode = options.playerMode ?? "render-only";
    this.presenter = options.presenter ?? new IframePresenter({ playerMode });
    this.applyPresenterPolicy(playerMode, !!this.evaluator.info.tailwind);

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.state = freezeState({
      medium: this.evaluator.info.medium,
      animated: this.evaluator.info.isAnimated,
      isReady: false,
      isPlaying: false,
      isScrubbing: false,
      currentFrame: 0,
      totalFrames: this.evaluator.info.totalFrames,
      fps: this.evaluator.info.fps,
      duration: this.evaluator.info.duration,
      width: this.evaluator.info.width,
      height: this.evaluator.info.height,
      progress: 0,
      graph: buildMediaGraph(""),
      surface: null,
    });

    this.clock = new MediaClock({
      fps: this.state.fps,
      totalFrames: this.state.totalFrames,
      playbackMode: options.playbackMode ?? "once",
      onFrame: (frame) => {
        if (!this.suppressClockRender) {
          void this.requestFrame(frame, false).catch((error) => this.handleRenderError(error));
        }
      },
      onPlay: () => {
        this.updateFromClock();
        this.playNativeMedia();
        this.emitEvent("play");
      },
      onPause: () => {
        this.updateFromClock();
        this.pauseNativeMedia();
        this.emitEvent("pause");
      },
      onEnded: () => {
        this.updateFromClock();
        this.pauseNativeMedia();
        this.emitEvent("ended");
      },
      onObserverError: (error) => this.emitError(error),
    });
    this.clock.subscribe(() => {
      if (this.suppressClockPublication) return;
      this.updateFromClock();
      this.emit();
    });

    this.runtimeStore = {
      getState: () => this.getState(),
      subscribe: (listener) => this.subscribe(listener),
      play: () => this.play(),
      pause: () => this.pause(),
      togglePlayPause: () => this.togglePlayPause(),
      beginScrub: () => this.beginScrub(),
      endScrub: () => this.endScrub(),
      seekFrame: async (frame) => { await this.seekFrame(frame); },
      seekProgress: async (progress) => { await this.seekProgress(progress); },
    };
  }

  async mount(container: HTMLElement, options: MediaSurfaceMountOptions = {}): Promise<this> {
    this.assertActive("mount");
    if (options.surface && options.surface !== "dom") {
      throw new Error(`Unsupported media surface: ${options.surface}`);
    }
    this.presenter.attach(container);
    this.configurePresenter(this.evaluator, this.options);
    this.surface = new DomMediaSurface(() => this.presenter.getElement());

    try {
      await this.renderFrame(this.state.currentFrame);
      await this.waitForSurfaceReady();
      this.markReady();
    } catch (error) {
      this.rejectReady(error);
      throw error;
    }
    return this;
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  play(): void {
    this.assertActive("play");
    if (!this.state.animated) return;
    this.clock.play();
  }

  pause(): void {
    this.assertActive("pause");
    this.clock.pause();
  }

  togglePlayPause(): void {
    this.state.isPlaying ? this.pause() : this.play();
  }

  async seekFrame(frame: number): Promise<MediaFrameResult> {
    this.assertActive("seekFrame");
    return this.renderFrame(frame);
  }

  async seekProgress(progress: number): Promise<MediaFrameResult> {
    const clamped = Math.max(0, Math.min(1, progress));
    return this.seekFrame(Math.round(clamped * Math.max(0, this.state.totalFrames - 1)));
  }

  async seekTimeSeconds(seconds: number): Promise<MediaFrameResult> {
    return this.seekFrame(Math.floor(seconds * this.state.fps));
  }

  beginScrub(): void {
    this.assertActive("beginScrub");
    if (this.state.isPlaying) this.pause();
    if (this.state.isScrubbing) return;
    // Taking scrub/inspection ownership invalidates a pending live candidate,
    // including when the clock was already paused. Restore accepted input at
    // the controlled clock position before its actions become eligible again.
    void this.renderFrame(this.clock.getState().currentFrame).catch((error) => this.handleRenderError(error));
    this.state = freezeState({ ...this.state, isScrubbing: true });
    this.emit();
  }

  endScrub(): void {
    this.assertActive("endScrub");
    if (!this.state.isScrubbing) return;
    this.state = freezeState({ ...this.state, isScrubbing: false });
    this.emit();
  }

  async renderFrame(frame: number): Promise<MediaFrameResult> {
    this.assertActive("renderFrame");
    return this.requestFrame(frame, true);
  }

  private async requestFrame(frame: number, explicit: boolean): Promise<MediaFrameResult> {
    if (explicit) {
      this.updateToken += 1;
      this.pendingUpdateToken = null;
      // Position explicit requests when requested, never after an async paint.
      // An accepted clock frame must not rebase the running clock backwards.
      this.suppressClockRender = true;
      try { this.clock.seekFrame(frame); }
      finally { this.suppressClockRender = false; }
      frame = this.clock.getState().currentFrame;
    }
    const authorityToken = this.updateToken;
    const token = ++this.renderToken;
    const sample = this.performance?.request(explicit ? "render" : "clock", frame, this.inputRevision);
    const queuedAt = sample?.start();
    this.requestedFrame = frame;
    this.emitEvent("presentation", this.getPresentation());
    let accepted: MediaFrameResult | null = null;
    const task = this.renderChain.then(async () => {
      if (queuedAt !== undefined) sample?.end("queue", queuedAt);
      if (token !== this.renderToken || this.disposed) {
        if (sample) this.performance?.finish(sample, "superseded");
        return;
      }
      let evaluated: EvaluatedFrame;
      let presentationAttempted = false;
      try {
        if (sample) sample.inputRevision = this.inputRevision;
        const evaluateAt = sample?.start();
        evaluated = this.evaluator.render(frame, sample);
        if (evaluateAt !== undefined) sample?.end("evaluate", evaluateAt);
        if (sample) this.performance?.evaluated(sample, evaluated.frame);
        presentationAttempted = true;
        await this.present(evaluated, this.evaluator, sample);
        this.syncFrameResources(evaluated, this.options, sample);
      } catch (error) {
        let restored = !presentationAttempted;
        if (presentationAttempted && !this.disposed) {
          try { await this.restoreAcceptedPresentation(); restored = true; }
          catch (rollbackError) { this.emitError(rollbackError); }
        }
        if (restored) this.settleFailedRequest(token);
        if (sample) this.performance?.finish(sample, "failed");
        this.emitError(error);
        throw error;
      }
      if (authorityToken !== this.updateToken || this.disposed) {
        if (sample) this.performance?.finish(sample, "superseded");
        return;
      }
      accepted = this.acceptEvaluatedFrame(evaluated, this.evaluator, token, sample);
      if (sample) this.performance?.finish(sample, "accepted", accepted.frame, accepted.revision);
    });
    this.renderChain = task.catch(() => undefined);
    await task;

    if (accepted) return accepted;
    if (this.lastResult) return { ...this.lastResult, stale: true };
    throw new Error(`MediaSession renderFrame(${frame}) was superseded before the first frame`);
  }

  /** Render and present the current frame before committing option/state changes. */
  async update(update: MediaSessionUpdate): Promise<void> {
    this.assertActive("update");
    const nextOptions = mergeOptions(this.options, update);
    const evaluatorUpdate = toRuntimeUpdate(update);
    const changesFrame = Object.keys(evaluatorUpdate).length > 0 || update.fonts !== undefined;

    if (!changesFrame) {
      this.updateToken += 1;
      const wasPending = this.pendingUpdateToken !== null || this.renderToken !== this.acceptedRenderToken;
      this.pendingUpdateToken = null;
      this.options = nextOptions;
      if (update.playbackMode !== undefined) {
        this.clock.configure({ playbackMode: update.playbackMode });
        this.updateFromClock();
        this.emit();
      }
      // A mode-only request can cancel a candidate but must leave a real frame
      // request to restore/qualify the accepted input after that cancellation.
      if (wasPending) await this.requestFrame(this.clock.getState().currentFrame, false);
      return;
    }

    // Every update request takes publication authority, even if constructing
    // its evaluator fails. The failed latest request must not revive an older
    // candidate that was already waiting for its presenter.
    const updateToken = ++this.updateToken;
    this.pendingUpdateToken = updateToken;
    const token = ++this.renderToken;
    let candidate: FrameEvaluator;
    try {
      candidate = this.evaluator.withUpdate(evaluatorUpdate);
      if (!Number.isFinite(candidate.info.fps) || candidate.info.fps <= 0 ||
          !Number.isFinite(candidate.info.duration) || candidate.info.duration <= 0 ||
          !Number.isSafeInteger(candidate.info.totalFrames) || candidate.info.totalFrames < 1) {
        throw new RangeError("MediaSession update requires positive finite fps and duration with a safe frame count");
      }
      this.options.validateClock?.(candidate.info);
    }
    catch (error) {
      this.requestedFrame = this.clock.getState().currentFrame;
      const sample = this.performance?.request("update", this.requestedFrame, this.inputRevision + 1);
      const queuedAt = sample?.start();
      this.emitEvent("presentation", this.getPresentation());
      const task = this.renderChain.then(async () => {
        if (queuedAt !== undefined) sample?.end("queue", queuedAt);
        if (!this.disposed && updateToken === this.updateToken) {
          let restored = false;
          try { await this.restoreAcceptedPresentation(); restored = true; }
          catch (rollbackError) { this.emitError(rollbackError); }
          // A newer update/seek may arrive while rollback is awaiting paint.
          if (this.pendingUpdateToken === updateToken) this.pendingUpdateToken = null;
          if (restored) this.settleFailedRequest(token);
        }
        if (sample) this.performance?.finish(sample, "failed");
        this.emitError(error);
        throw error;
      });
      this.renderChain = task.catch(() => undefined);
      await task;
      return;
    }
    this.requestedFrame = this.frameForEvaluator(candidate);
    const sample = this.performance?.request("update", this.requestedFrame, this.inputRevision + 1);
    const queuedAt = sample?.start();
    this.emitEvent("presentation", this.getPresentation());
    let accepted = false;
    const task = this.renderChain.then(async () => {
      if (queuedAt !== undefined) sample?.end("queue", queuedAt);
      if (updateToken !== this.updateToken || this.disposed) {
        if (sample) this.performance?.finish(sample, "superseded");
        return;
      }
      let evaluated: EvaluatedFrame;
      let presentationAttempted = false;
      try {
        if (sample) sample.inputRevision = this.inputRevision + 1;
        const targetFrame = this.frameForEvaluator(candidate);
        const evaluateAt = sample?.start();
        evaluated = candidate.render(targetFrame, sample);
        if (evaluateAt !== undefined) sample?.end("evaluate", evaluateAt);
        if (sample) this.performance?.evaluated(sample, evaluated.frame);
        presentationAttempted = true;
        this.configurePresenter(candidate, nextOptions);
        await this.present(evaluated, candidate, sample);
        this.syncFrameResources(evaluated, nextOptions, sample);
      } catch (error) {
        let restored = !presentationAttempted;
        if (!this.disposed && presentationAttempted) {
          try { await this.restoreAcceptedPresentation(); restored = true; }
          catch (rollbackError) { this.emitError(rollbackError); }
        }
        if (this.pendingUpdateToken === updateToken) this.pendingUpdateToken = null;
        if (restored) this.settleFailedRequest(token);
        if (sample) this.performance?.finish(sample, "failed");
        this.emitError(error);
        throw error;
      }
      if (updateToken !== this.updateToken || this.disposed) {
        if (!this.disposed) {
          try { await this.restoreAcceptedPresentation(); }
          catch (error) {
            if (sample) this.performance?.finish(sample, "failed");
            this.emitError(error);
            throw error;
          }
        }
        if (sample) this.performance?.finish(sample, "superseded");
        return;
      }
      // No observer may see new clock metadata alongside the old accepted data
      // or semantics. configure() is synchronous, but emits clock subscribers.
      const previousClock = this.clock.getState();
      const changesClockContract = previousClock.fps !== candidate.info.fps || previousClock.totalFrames !== candidate.info.totalFrames;
      this.suppressClockPublication = true;
      let result!: MediaFrameResult;
      try {
        this.clock.batch(() => {
          this.options = nextOptions;
          this.evaluator = candidate;
          this.inputRevision += 1;
          this.pendingUpdateToken = null;
          this.clock.configure({
            fps: candidate.info.fps,
            totalFrames: candidate.info.totalFrames,
            ...(update.playbackMode !== undefined ? { playbackMode: update.playbackMode } : {}),
          });
          // Frames queued under the previous fps/duration have a different
          // meaning. Data updates retain useful frames on the same clock.
          const acceptedToken = changesClockContract ? ++this.renderToken : token;
          result = this.acceptEvaluatedFrame(evaluated, candidate, acceptedToken, sample);
        });
      } finally { this.suppressClockPublication = false; }
      if (sample) this.performance?.finish(sample, "accepted", result.frame, result.revision);
      accepted = true;
    });
    this.renderChain = task.catch(() => undefined);
    await task;
    if (!accepted) throw Object.assign(new Error("MediaSession update was superseded by a newer request."), { code: "MEDIA_SESSION_UPDATE_SUPERSEDED" as const });
  }

  getState(): MediaSessionState {
    return this.state;
  }

  getPresentation(): RuntimePresentation {
    const result = this.lastResult;
    return Object.freeze({
      requestedFrame: this.requestedFrame,
      accepted: result && !this.disposed ? Object.freeze({
        frame: result.frame,
        revision: result.revision,
        ...(result.inputRevision !== undefined ? { inputRevision: result.inputRevision } : {}),
        html: result.html,
        compositeHtml: result.compositeHtml,
        ...(result.semantic !== undefined ? { semantic: result.semantic } : {}),
      }) : null,
      isReady: this.state.isReady,
      isPending: !this.disposed && (this.pendingUpdateToken !== null || this.renderToken !== this.acceptedRenderToken),
      disposed: this.disposed,
    });
  }

  getClock(): MediaClock {
    return this.clock;
  }

  getPerformance(): RuntimePerformanceSnapshot | null {
    return this.performance?.snapshot() ?? null;
  }

  /** Refresh host geometry after transform changes outside ResizeObserver. */
  refreshGeometry(): void {
    this.assertActive("refreshGeometry");
    this.presenter.refreshGeometry?.();
  }

  getSurface(): MediaSurface | null {
    return this.surface;
  }

  asStore(): RuntimeStore {
    return this.runtimeStore;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  on<K extends keyof MediaSessionEvents>(event: K, callback: MediaSessionEvents[K]): () => void {
    let set = this.events[event] as Set<MediaSessionEvents[K]> | undefined;
    if (!set) {
      set = new Set<MediaSessionEvents[K]>();
      Object.assign(this.events, { [event]: set });
    }
    set.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof MediaSessionEvents>(event: K, callback?: MediaSessionEvents[K]): void {
    if (!callback) {
      this.events[event]?.clear();
      return;
    }
    this.events[event]?.delete(callback as never);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderToken += 1;
    this.updateToken += 1;
    this.pendingUpdateToken = null;
    this.clock.dispose();
    this.presenter.dispose();
    this.surface = null;
    this.targetRoot = null;
    this.videoTargets = null;
    this.plateTargets = null;
    this.state = freezeState({
      ...this.state,
      isReady: false,
      isPlaying: false,
      isScrubbing: false,
      surface: null,
    });
    this.emitEvent("presentation", this.getPresentation());
    this.listeners.clear();
    this.events = {};
  }

  private async present(frame: EvaluatedFrame, evaluator: FrameEvaluator, sample?: FramePerformanceSample): Promise<void> {
    const presentAt = sample?.start();
    try {
      await this.presenter.present(
        frame.compositeHtml,
        evaluator.info.width,
        evaluator.info.height,
        { ...(frame.escapedTree ? { escapedTree: frame.escapedTree } : {}), ...(sample ? { performance: sample } : {}) },
      );
    } finally { if (presentAt !== undefined) sample?.end("present", presentAt); }
  }

  private acceptEvaluatedFrame(frame: EvaluatedFrame, evaluator: FrameEvaluator, token: number, sample?: FramePerformanceSample): MediaFrameResult {
    const acceptAt = sample?.start();
    const graph = frame.html === this.lastGraphHtml && this.lastResult
      ? this.lastResult.graph
      : buildMediaGraph(frame.html);
    const result: MediaFrameResult = {
      revision: ++this.acceptedRevision,
      inputRevision: this.inputRevision,
      frame: frame.frame,
      html: frame.html,
      compositeHtml: frame.compositeHtml,
      graph,
      ...(frame.semantic !== undefined ? { semantic: frame.semantic } : {}),
    };
    this.lastGraphHtml = frame.html;
    this.lastResult = result;
    this.acceptedRenderToken = token;

    const clock = this.clock.getState();
    this.state = freezeState({
      ...this.state,
      medium: evaluator.info.medium,
      animated: evaluator.info.isAnimated,
      currentFrame: clock.currentFrame,
      isPlaying: clock.isPlaying,
      totalFrames: evaluator.info.totalFrames,
      fps: evaluator.info.fps,
      duration: evaluator.info.duration,
      width: evaluator.info.width,
      height: evaluator.info.height,
      progress: clock.progress,
      graph,
      surface: this.surface,
    });
    // Bind internal request ownership before public store/clock observers can
    // issue another request. Observer faults cannot undo an accepted frame.
    try { frame.acceptEvaluation?.(); } catch (error) { this.emitError(error); }
    if (acceptAt !== undefined) sample?.end("accept", acceptAt);
    const callbacksAt = sample?.start();
    this.emit();
    this.emitEvent("presentation", this.getPresentation());
    this.emitEvent("rendered", result);
    if (callbacksAt !== undefined) sample?.end("callbacks", callbacksAt);
    return result;
  }

  private async restoreAcceptedPresentation(): Promise<void> {
    this.configurePresenter(this.evaluator, this.options);
    if (!this.lastResult) return;
    await this.presenter.present(
      this.lastResult.compositeHtml,
      this.evaluator.info.width,
      this.evaluator.info.height,
      // Rollback is rare and must preserve the same sanitizer boundary.
      {},
    );
    this.syncFrameResources(this.lastResult, this.options);
  }

  private settleFailedRequest(token: number): void {
    // A failure with a successful rollback is settled, rather than an eternal
    // pending request. A newer queued frame/update retains its own fence.
    if (token === this.renderToken && this.pendingUpdateToken === null) {
      this.acceptedRenderToken = token;
      this.emitEvent("presentation", this.getPresentation());
    }
  }

  private frameForEvaluator(evaluator: FrameEvaluator): number {
    const clock = this.clock.getState();
    return Math.min(Math.floor(clock.currentFrame / clock.fps * evaluator.info.fps), evaluator.info.totalFrames - 1);
  }

  private updateFromClock(): void {
    const clockState: MediaClockState = this.clock.getState();
    this.state = freezeState({
      ...this.state,
      isPlaying: clockState.isPlaying,
      currentFrame: clockState.currentFrame,
      fps: clockState.fps,
      totalFrames: clockState.totalFrames,
      duration: clockState.duration,
      progress: clockState.progress,
    });
  }

  private configurePresenter(evaluator: FrameEvaluator, options: MediaSessionOptions): void {
    const preResolved = options.fonts;
    const fontUrls = preResolved
      ? [...(preResolved.stylesheets ?? [])]
      : (evaluator.info.fonts ?? []).map((font) => {
          const family = encodeURIComponent(font.trim());
          return `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
        });
    const stylesheets = [...fontUrls, ...(evaluator.info.stylesheets ?? [])];
    const inlineCss = [
      ...(preResolved ? (preResolved.css ? [preResolved.css] : []) : evaluator.info.fontCss),
      ...evaluator.info.inlineCss,
    ];
    this.presenter.injectStyles(inlineCss, stylesheets, evaluator.info.tailwind);
  }

  private applyPresenterPolicy(playerMode: PlayerMode, hasTailwind: boolean): void {
    if (this.presenter instanceof IframePresenter) {
      this.presenter.applyPolicy({ playerMode, hasTailwind });
    }
  }

  private async waitForSurfaceReady(): Promise<void> {
    const root = this.getSurfaceRoot();
    if (!root) return;
    const doc = root.nodeType === Node.DOCUMENT_NODE ? root as Document : root.ownerDocument;
    const fonts = doc ? (doc as Document & { fonts?: FontFaceSet }).fonts : undefined;
    if (fonts?.ready) await fonts.ready.catch(() => undefined);
  }

  private syncFrameResources(frame: { readonly frame: number }, options: MediaSessionOptions, sample?: FramePerformanceSample): void {
    const resourcesAt = sample?.start();
    try {
      // Native data-t belongs to the presented evaluator's frame/fps. Preserve
      // authored clip offsets instead of substituting live clock metadata.
      this.syncNativeMedia(options);
      this.syncPlates(frame.frame, options);
    } finally { if (resourcesAt !== undefined) sample?.end("resources", resourcesAt); }
  }

  private syncPlates(frame: number, options: MediaSessionOptions): void {
    const root = this.getSurfaceRoot();
    if (!root) return;
    const indexed = this.refreshTargetIndex(root);
    if (indexed && !this.plateTargets) this.plateTargets = Array.from(root.querySelectorAll<HTMLElement>("[data-superimg-plate]"));
    syncPlateMedia(root, frame, options.assetResolver, indexed ? this.plateTargets! : undefined);
  }

  private syncNativeMedia(options: MediaSessionOptions = this.options): void {
    const root = this.getSurfaceRoot();
    if (!root) return;
    const videos = this.getVideoTargets(root);
    const shouldPlay = options.playback !== "deterministic" && this.clock.getState().isPlaying;
    const seekTolerance = shouldPlay ? 0.05 : 0.002;
    for (const video of videos) {
      const time = Number(video.dataset.t ?? "0");
      if (Number.isFinite(time) && Math.abs(video.currentTime - time) > seekTolerance) {
        try { video.currentTime = time; } catch { /* leave failed remote seeks to browser */ }
      }
      if (shouldPlay) {
        try { void video.play?.()?.catch(() => undefined); } catch { /* remote/autoplay failure */ }
      } else {
        try { video.pause?.(); } catch { /* media lifecycle failure */ }
      }
    }
  }

  private playNativeMedia(): void {
    this.syncNativeMedia();
  }

  private pauseNativeMedia(): void {
    const root = this.getSurfaceRoot();
    if (!root) return;
    const videos = this.getVideoTargets(root);
    for (const video of videos) {
      try { video.pause?.(); } catch { /* media lifecycle failure */ }
    }
  }

  private getVideoTargets(root: Document | Element): HTMLVideoElement[] {
    const indexed = this.refreshTargetIndex(root);
    if (indexed && this.videoTargets) return this.videoTargets;
    const targets = Array.from(root.querySelectorAll<HTMLVideoElement>("video[data-superimg-media]"));
    if (indexed) this.videoTargets = targets;
    return targets;
  }

  private refreshTargetIndex(root: Document | Element): boolean {
    const revision = this.presenter.getDomRevision?.();
    // Custom presenters without a revision contract retain the scanning path.
    if (revision === undefined) return false;
    if (this.targetRoot !== root || this.targetRevision !== revision) {
      this.targetRoot = root;
      this.targetRevision = revision;
      this.videoTargets = null;
      this.plateTargets = null;
    }
    return true;
  }

  private getSurfaceRoot(): Document | Element | null {
    const element = this.surface?.getElement();
    if (!element) return null;
    if (element instanceof HTMLIFrameElement) return element.contentDocument;
    return element;
  }

  private markReady(): void {
    if (this.state.isReady) return;
    this.state = freezeState({ ...this.state, isReady: true, surface: this.surface });
    this.emit();
    this.emitEvent("ready");
    this.emitEvent("presentation", this.getPresentation());
    this.resolveReady();
  }

  private handleRenderError(error: unknown): void {
    if (!this.state.isReady) this.rejectReady(error);
  }

  private emitError(error: unknown): void {
    this.emitEvent("error", error instanceof Error ? error : new Error(String(error)));
  }

  private assertActive(operation: string): void {
    if (this.disposed) throw new Error(`MediaSession is disposed; cannot ${operation}()`);
  }

  private emit(): void {
    this.listeners.forEach((listener) => {
      try { listener(); } catch (error) { this.emitError(error); }
    });
  }

  private emitEvent<K extends keyof MediaSessionEvents>(
    event: K,
    ...args: Parameters<MediaSessionEvents[K]>
  ): void {
    this.events[event]?.forEach((callback) => {
      try { (callback as (...values: Parameters<MediaSessionEvents[K]>) => void)(...args); }
      catch (error) {
        // Observer failure cannot reject a transaction whose DOM/data already
        // committed. Error observers are terminal to avoid recursive errors.
        if (event !== "error") this.emitError(error);
      }
    });
  }
}

function toEvaluatorOptions(options: MediaSessionOptions): FrameEvaluatorOptions {
  const size = options.size ?? {};
  return {
    ...size,
    ...(options.width !== undefined ? { width: options.width } : {}),
    ...(options.height !== undefined ? { height: options.height } : {}),
    ...(options.fps !== undefined ? { fps: options.fps } : {}),
    ...(options.duration !== undefined ? { duration: options.duration } : {}),
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.assets !== undefined ? { assets: options.assets } : {}),
    ...(options.assetResolver !== undefined ? { assetResolver: options.assetResolver } : {}),
    ...(options.fonts !== undefined ? { fonts: options.fonts } : {}),
    ...(options.captureSemantic !== undefined ? { captureSemantic: options.captureSemantic } : {}),
  };
}

function toRuntimeUpdate(update: MediaSessionUpdate): RuntimeUpdate {
  const size = update.size ?? {};
  return {
    ...size,
    ...(update.width !== undefined ? { width: update.width } : {}),
    ...(update.height !== undefined ? { height: update.height } : {}),
    ...(update.fps !== undefined ? { fps: update.fps } : {}),
    ...(update.duration !== undefined ? { duration: update.duration } : {}),
    ...(update.data !== undefined ? { data: update.data } : {}),
    ...(update.assets !== undefined ? { assets: update.assets } : {}),
    ...(update.assetResolver !== undefined ? { assetResolver: update.assetResolver } : {}),
  };
}

function mergeOptions(current: MediaSessionOptions, update: MediaSessionUpdate): MediaSessionOptions {
  return {
    ...current,
    ...update,
    ...(update.data !== undefined
      ? { data: { ...(current.data ?? {}), ...update.data } }
      : {}),
  };
}

function freezeState(state: MediaSessionState): MediaSessionState {
  return Object.freeze(state);
}
