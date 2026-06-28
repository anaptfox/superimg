//! Player - high-level browser controller for SuperImg runtime-web

import { CheckpointResolver } from "@superimg/core";
import {
  createRuntime,
  type RuntimeInput,
  type RuntimeRenderedPayload,
  type RuntimeState,
  type RuntimeStore,
  type WebRuntime,
} from "@superimg/runtime-web";
import { getPreset } from "@superimg/stdlib";
import { HoverController } from "./player-hover.js";
import {
  isComposedTemplate,
  SuperImgError,
  type AssetMeta,
  type Checkpoint,
  type ComposedTemplate,
  type HoverBehavior,
  type LoadMode,
  type Marker,
  type PlaybackMode,
  type ResolvedScene,
} from "@superimg/types";

/** Simple format aliases that map to stdlib presets */
const SIMPLE_ALIASES: Record<string, string> = {
  vertical: "instagram.video.reel",
  horizontal: "youtube.video.long",
  square: "instagram.video.feed",
} as const;

/**
 * Format option: simple alias, stdlib preset path, or custom dimensions.
 */
export type FormatOption =
  | "vertical"
  | "horizontal"
  | "square"
  | string
  | { width: number; height: number };

export function resolveFormat(format: FormatOption): { width: number; height: number } {
  if (typeof format === "object") return format;

  const presetPath = SIMPLE_ALIASES[format] ?? format;
  const preset = getPreset(presetPath);
  if (!preset) {
    throw new Error(`Unknown format: ${format}`);
  }
  return { width: preset.width, height: preset.height };
}

export interface PlayerOptions {
  /** Container element or CSS selector */
  container: string | HTMLElement;
  /** Format for rendering - simple alias, stdlib preset path, or custom dimensions */
  format?: FormatOption;
  /** Playback mode when video ends (default: "once") */
  playbackMode?: PlaybackMode;
  /** When the caller should load the template (default: "eager") */
  loadMode?: LoadMode;
  /** Behavior on hover (default: "none") */
  hoverBehavior?: HoverBehavior;
  /** Delay before hover playback triggers, in milliseconds (default: 200) */
  hoverDelayMs?: number;
}

export interface LoadOptions {
  /** Runtime data merged over template defaults */
  data?: Record<string, unknown>;
  /** Explicit markers for checkpoint navigation */
  markers?: Marker[];
  /** Runtime asset metadata */
  assets?: Record<string, AssetMeta>;
  /** Resolve co-located asset filenames to URLs */
  assetResolver?: (filename: string) => string;
}

export type LoadResult =
  | {
      status: "success";
      totalFrames: number;
      duration: number;
      width: number;
      height: number;
      fps: number;
    }
  | {
      status: "error";
      errorType: "compilation" | "validation" | "network";
      message: string;
      suggestion: string;
      details?: Record<string, unknown>;
    };

export type PlayerInput = RuntimeInput;

export interface PlayerUpdate {
  data?: Record<string, unknown>;
  format?: FormatOption;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
}

export interface PlayerEvents {
  frame: (frame: number, totalFrames: number) => void;
  rendered: (payload: RuntimeRenderedPayload) => void;
  play: () => void;
  pause: () => void;
  ended: () => void;
  ready: () => void;
  error: (error: Error) => void;
  checkpoint: (checkpoint: Checkpoint) => void;
  scenechange: (scene: ResolvedScene) => void;
}

class PlayerNotReadyError extends SuperImgError {
  constructor(operation: string) {
    super(
      `Player not ready for operation: ${operation}`,
      "PLAYER_NOT_READY",
      { operation },
      `Call load() and wait for it to complete before calling ${operation}().`,
      "https://superimg.dev/docs/player"
    );
    this.name = "PlayerNotReadyError";
  }
}

export class Player {
  private container: HTMLElement;
  private runtime: WebRuntime | null = null;
  private runtimeStore: RuntimeStore | null = null;
  private template: PlayerInput | null = null;
  private checkpointResolverInstance: CheckpointResolver | null = null;
  private markerList: Marker[] = [];
  private format: FormatOption | undefined;
  private readonly options: {
    playbackMode: PlaybackMode;
    loadMode: LoadMode;
    hoverBehavior: HoverBehavior;
    hoverDelayMs: number;
  };
  private events: Partial<{ [K in keyof PlayerEvents]: Set<PlayerEvents[K]> }> = {};
  private hoverController!: HoverController;
  private lastCheckpointId: string | null = null;

  constructor(options: PlayerOptions) {
    if (typeof options.container === "string") {
      const element = document.querySelector(options.container);
      if (!element) throw new Error(`Container not found: ${options.container}`);
      this.container = element as HTMLElement;
    } else {
      this.container = options.container;
    }

    this.format = options.format;
    this.options = {
      playbackMode: options.playbackMode ?? "once",
      loadMode: options.loadMode ?? "eager",
      hoverBehavior: options.hoverBehavior ?? "none",
      hoverDelayMs: options.hoverDelayMs ?? 200,
    };

    this.hoverController = new HoverController(
      this.container,
      { behavior: this.options.hoverBehavior, delayMs: this.options.hoverDelayMs },
      () => this.runtime
    );
    this.hoverController.install();
  }

  async load(input: PlayerInput, options: LoadOptions = {}): Promise<LoadResult> {
    try {
      this.runtime?.dispose();
      this.template = input;
      this.markerList = options.markers ?? [];
      this.lastCheckpointId = null;

      const dimensions = this.format ? resolveFormat(this.format) : {};
      this.runtime = createRuntime(input, {
        ...dimensions,
        ...(options.data !== undefined ? { data: options.data } : {}),
        ...(options.assets !== undefined ? { assets: options.assets } : {}),
        ...(options.assetResolver !== undefined ? { assetResolver: options.assetResolver } : {}),
        playbackMode: this.options.playbackMode,
      });
      this.runtimeStore = this.runtime.asStore();
      this.checkpointResolverInstance = null;
      this.wireRuntimeEvents(this.runtime);
      this.runtime.attach(this.container);
      this.rebuildCheckpointResolver();

      const state = this.runtime.getState();
      return {
        status: "success",
        totalFrames: state.totalFrames,
        duration: state.duration,
        width: state.width,
        height: state.height,
        fps: state.fps,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      return {
        status: "error",
        errorType: "validation",
        message: err.message,
        suggestion: "Verify the template was created with define().",
        details: { error: err.name },
      };
    }
  }

  update(update: PlayerUpdate): void {
    const runtime = this.requireRuntime("update");
    const next = { ...update };
    if (next.format) {
      this.format = next.format;
      const dimensions = resolveFormat(next.format);
      next.width = dimensions.width;
      next.height = dimensions.height;
      delete next.format;
    }
    runtime.update(next);
    this.rebuildCheckpointResolver();
  }

  render(frame?: number): Promise<void> {
    return this.requireRuntime("render").render(frame);
  }

  play(): void {
    this.requireRuntime("play").play();
  }

  pause(): void {
    this.requireRuntime("pause").pause();
  }

  seekFrame(frame: number): void {
    this.requireRuntime("seekFrame").seekFrame(frame);
  }

  seekProgress(progress: number): void {
    this.requireRuntime("seekProgress").seekProgress(progress);
  }

  seekTimeSeconds(seconds: number): void {
    this.requireRuntime("seekTimeSeconds").seekTimeSeconds(seconds);
  }

  getState(): RuntimeState {
    return this.requireRuntime("getState").getState();
  }

  subscribe(listener: () => void): () => void {
    return this.requireRuntime("subscribe").subscribe(listener);
  }

  getRuntimeStore(): RuntimeStore {
    if (!this.runtimeStore) throw new PlayerNotReadyError("getRuntimeStore");
    return this.runtimeStore;
  }

  on<K extends keyof PlayerEvents>(event: K, callback: PlayerEvents[K]): () => void {
    const set = (this.events[event] ??= new Set<PlayerEvents[K]>());
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

  seekScene(indexOrId: number | string): void {
    const template = this.requireComposedTemplate("seekScene");
    const scene =
      typeof indexOrId === "number"
        ? template.getScene(indexOrId)
        : template.getSceneById(indexOrId);
    if (scene) this.seekFrame(scene.startFrame);
  }

  nextScene(): void {
    const scene = this.currentScene;
    const template = this.requireComposedTemplate("nextScene");
    if (!scene) return;
    const next = template.getScene(scene.index + 1);
    if (next) this.seekFrame(next.startFrame);
  }

  previousScene(): void {
    const scene = this.currentScene;
    const template = this.requireComposedTemplate("previousScene");
    if (!scene) return;
    const previous = template.getScene(scene.index - 1);
    if (previous) this.seekFrame(previous.startFrame);
  }

  getCheckpoints(): Checkpoint[] {
    const checkpoints = this.checkpointResolverInstance?.getAll() ?? [];
    const sceneCheckpoints =
      this.template && isComposedTemplate(this.template) ? this.template.getCheckpoints() : [];
    return [...sceneCheckpoints, ...checkpoints].sort((a, b) => a.frame - b.frame);
  }

  getCurrentCheckpoint(): Checkpoint | undefined {
    const frame = this.currentFrame;
    let current: Checkpoint | undefined;
    for (const checkpoint of this.getCheckpoints()) {
      if (checkpoint.frame <= frame) current = checkpoint;
      else break;
    }
    return current;
  }

  goToCheckpoint(id: string): void {
    const checkpoint = this.getCheckpoints().find((item) => item.id === id);
    if (checkpoint) this.seekFrame(checkpoint.frame);
  }

  nextCheckpoint(): void {
    const checkpoint = this.getCheckpoints().find((item) => item.frame > this.currentFrame);
    if (checkpoint) this.seekFrame(checkpoint.frame);
  }

  prevCheckpoint(): void {
    let previous: Checkpoint | undefined;
    for (const checkpoint of this.getCheckpoints()) {
      if (checkpoint.frame >= this.currentFrame) break;
      previous = checkpoint;
    }
    if (previous) this.seekFrame(previous.frame);
  }

  addCheckpoint(
    id: string,
    frame: number = this.currentFrame,
    options?: { label?: string; metadata?: Record<string, unknown> }
  ): Checkpoint {
    const resolver = this.requireCheckpointResolver("addCheckpoint");
    return resolver.add(id, frame, options);
  }

  removeCheckpoint(id: string): boolean {
    return this.checkpointResolverInstance?.remove(id) ?? false;
  }

  dispose(): void {
    this.hoverController.dispose();
    this.runtime?.dispose();
    this.runtime = null;
    this.runtimeStore = null;
    this.template = null;
    this.checkpointResolverInstance = null;
    this.events = {};
  }

  get isReady(): boolean {
    return this.runtime?.getState().isReady ?? false;
  }

  get isPlaying(): boolean {
    return this.runtime?.getState().isPlaying ?? false;
  }

  get currentFrame(): number {
    return this.runtime?.getState().currentFrame ?? 0;
  }

  get totalFrames(): number {
    return this.runtime?.getState().totalFrames ?? 0;
  }

  get fps(): number {
    return this.runtime?.getState().fps ?? 30;
  }

  get currentProgress(): number {
    return this.runtime?.getState().progress ?? 0;
  }

  get currentTimeSeconds(): number {
    return this.currentFrame / this.fps;
  }

  get totalDurationSeconds(): number {
    return this.runtime?.getState().duration ?? 0;
  }

  get renderWidth(): number {
    return this.runtime?.getState().width ?? 0;
  }

  get renderHeight(): number {
    return this.runtime?.getState().height ?? 0;
  }

  get scenes(): readonly ResolvedScene[] {
    return this.template && isComposedTemplate(this.template) ? this.template.scenes : [];
  }

  get currentScene(): ResolvedScene | null {
    if (!this.template || !isComposedTemplate(this.template)) return null;
    return this.template.getSceneAtFrame(this.currentFrame);
  }

  get checkpointResolver(): CheckpointResolver | null {
    return this.checkpointResolverInstance;
  }

  private wireRuntimeEvents(runtime: WebRuntime): void {
    runtime.on("ready", () => this.emit("ready"));
    runtime.on("rendered", (payload) => this.emit("rendered", payload));
    runtime.on("play", () => this.emit("play"));
    runtime.on("pause", () => this.emit("pause"));
    runtime.on("ended", () => this.emit("ended"));
    runtime.on("error", (error) => this.emit("error", error));
    runtime.on("scenechange", (scene) => this.emit("scenechange", scene));
    runtime.on("frame", (frame, totalFrames) => {
      this.emit("frame", frame, totalFrames);
      this.emitCheckpoint(frame);
    });
  }

  private rebuildCheckpointResolver(): void {
    const state = this.runtime?.getState();
    if (!state) {
      this.checkpointResolverInstance = null;
      return;
    }
    this.checkpointResolverInstance = new CheckpointResolver(
      this.markerList,
      state.totalFrames,
      state.fps
    );
  }

  private emitCheckpoint(frame: number): void {
    const checkpoint = this.getCheckpoints().find((item) => item.frame === frame);
    if (!checkpoint || checkpoint.id === this.lastCheckpointId) return;
    this.lastCheckpointId = checkpoint.id;
    this.emit("checkpoint", checkpoint);
  }



  private requireRuntime(operation: string): WebRuntime {
    if (!this.runtime) throw new PlayerNotReadyError(operation);
    return this.runtime;
  }

  private requireCheckpointResolver(operation: string): CheckpointResolver {
    if (!this.checkpointResolverInstance) throw new PlayerNotReadyError(operation);
    return this.checkpointResolverInstance;
  }

  private requireComposedTemplate(operation: string): ComposedTemplate {
    if (!this.template || !isComposedTemplate(this.template)) {
      throw new PlayerNotReadyError(operation);
    }
    return this.template;
  }

  private emit<K extends keyof PlayerEvents>(event: K, ...args: Parameters<PlayerEvents[K]>): void {
    this.events[event]?.forEach((callback) => {
      (callback as (...a: Parameters<PlayerEvents[K]>) => void)(...args);
    });
  }
}
