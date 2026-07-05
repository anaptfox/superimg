import {
  createRuntime,
  type PreResolvedFonts,
  type RuntimeInput,
  type RuntimeOptions,
  type RuntimeRenderedPayload,
  type RuntimeUpdate,
  type WebRuntime,
} from "./dom-runtime.js";
import { getPreset } from "@superimg/stdlib";
import type { AssetMeta, Medium, PlaybackMode, ResolvedScene } from "@superimg/types";
import { MediaClock, type MediaClockState, type MediaPlaybackMode } from "./clock.js";
import type { DomPresenter } from "./dom-presenter.js";
import { buildMediaGraph, type MediaGraph } from "./graph.js";
import { DomMediaSurface, type MediaSurface, type MediaSurfaceMountOptions } from "./surface.js";

const FORMAT_ALIASES: Record<string, string> = {
  vertical: "instagram.video.reel",
  horizontal: "youtube.video.long",
  square: "instagram.video.feed",
};

export type FormatOption =
  | "vertical"
  | "horizontal"
  | "square"
  | string
  | { width: number; height: number };

export type MediaSessionPlayback = "native" | "deterministic";

export interface MediaSessionOptions {
  data?: Record<string, unknown>;
  format?: FormatOption;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  fonts?: PreResolvedFonts;
  playback?: MediaSessionPlayback;
  playbackMode?: MediaPlaybackMode;
  outputName?: string;
  allowScripts?: boolean;
  presenter?: DomPresenter;
}

export interface MediaSessionUpdate {
  data?: Record<string, unknown>;
  format?: FormatOption;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  fonts?: PreResolvedFonts;
}

export interface MediaSessionState {
  medium: Medium;
  animated: boolean;
  isReady: boolean;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  duration: number;
  width: number;
  height: number;
  progress: number;
  graph: MediaGraph;
  surface: MediaSurface | null;
}

export interface MediaFrameResult {
  frame: number;
  html: string;
  compositeHtml: string;
  graph: MediaGraph;
  stale?: boolean;
}

export interface MediaSessionEvents {
  ready: () => void;
  rendered: (result: MediaFrameResult) => void;
  play: () => void;
  pause: () => void;
  ended: () => void;
  error: (error: Error) => void;
  scenechange: (scene: ResolvedScene) => void;
}

type Listener = () => void;

export async function createMediaSession(
  template: RuntimeInput,
  options: MediaSessionOptions = {},
): Promise<MediaSession> {
  return new MediaSession(template, options);
}

export class MediaSession {
  private readonly template: RuntimeInput;
  private options: MediaSessionOptions;
  private runtime: WebRuntime | null = null;
  private clock: MediaClock;
  private state: MediaSessionState;
  private surface: MediaSurface | null = null;
  private readonly listeners = new Set<Listener>();
  private runtimeEventDisposers: Array<() => void> = [];
  private renderToken = 0;
  private lastResult: MediaFrameResult | null = null;
  private suppressClockRender = false;
  private events: Partial<{ [K in keyof MediaSessionEvents]: Set<MediaSessionEvents[K]> }> = {};
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (error: unknown) => void;

  constructor(template: RuntimeInput, options: MediaSessionOptions = {}) {
    this.template = template;
    this.options = options;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    const infoRuntime = createRuntime(template, this.toRuntimeOptions({ autoplay: false }));
    const runtimeState = infoRuntime.getState();
    infoRuntime.dispose();

    const graph = buildMediaGraph("");
    this.state = {
      medium: runtimeState.medium,
      animated: runtimeState.animated,
      isReady: false,
      isPlaying: false,
      currentFrame: 0,
      totalFrames: runtimeState.totalFrames,
      fps: runtimeState.fps,
      duration: runtimeState.duration,
      width: runtimeState.width,
      height: runtimeState.height,
      progress: runtimeState.progress,
      graph,
      surface: null,
    };

    this.clock = new MediaClock({
      fps: runtimeState.fps,
      totalFrames: runtimeState.totalFrames,
      playbackMode: options.playbackMode ?? "once",
      onFrame: (frame) => {
        if (!this.suppressClockRender) {
          void this.renderFrame(frame).catch((error) => this.rejectReady(error));
        }
      },
      onEnded: () => {
        this.updateFromClock();
        this.pauseNativeMedia();
        this.emitEvent("ended");
      },
    });
    this.clock.subscribe(() => {
      this.updateFromClock();
      this.emit();
    });
  }

  async mount(container: HTMLElement, options: MediaSurfaceMountOptions = {}): Promise<this> {
    if (options.surface && options.surface !== "dom") {
      throw new Error(`Unsupported media surface: ${options.surface}`);
    }

    this.clearRuntimeEventDisposers();
    this.runtime?.dispose();
    this.runtime = createRuntime(this.template, this.toRuntimeOptions({ autoplay: false }));
    this.runtimeEventDisposers.push(
      this.runtime.on("scenechange", (scene) => this.emitEvent("scenechange", scene)),
    );
    this.surface = new DomMediaSurface(() => this.runtime?.getElement() ?? null);
    this.runtime.attach(container);

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
    this.clock.play();
    this.playNativeMedia();
    this.emitEvent("play");
  }

  pause(): void {
    this.clock.pause();
    this.pauseNativeMedia();
    this.emitEvent("pause");
  }

  async seekFrame(frame: number): Promise<MediaFrameResult> {
    this.suppressClockRender = true;
    try {
      this.clock.seekFrame(frame);
    } finally {
      this.suppressClockRender = false;
    }
    return this.renderFrame(this.clock.getState().currentFrame);
  }

  async renderFrame(frame: number): Promise<MediaFrameResult> {
    const runtime = this.requireRuntime("renderFrame");
    const token = ++this.renderToken;
    let payload: RuntimeRenderedPayload;
    try {
      payload = await this.renderRuntimeFrame(runtime, frame);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emitEvent("error", err);
      throw err;
    }
    const graph = buildMediaGraph(payload.html);
    const result: MediaFrameResult = {
      frame: payload.frame,
      html: payload.html,
      compositeHtml: payload.compositeHtml,
      graph,
    };

    if (token !== this.renderToken) {
      return this.lastResult ? { ...this.lastResult, stale: true } : { ...result, stale: true };
    }

    this.lastResult = result;
    this.state = {
      ...this.state,
      isReady: this.state.isReady,
      currentFrame: payload.frame,
      graph,
      surface: this.surface,
    };
    this.syncClockToRenderedFrame(payload.frame);
    this.syncNativeMedia();
    this.emit();
    this.emitEvent("rendered", result);
    return result;
  }

  update(update: MediaSessionUpdate): void {
    if (update.format !== undefined) this.options.format = update.format;
    if (update.width !== undefined) this.options.width = update.width;
    if (update.height !== undefined) this.options.height = update.height;
    if (update.fps !== undefined) this.options.fps = update.fps;
    if (update.duration !== undefined) this.options.duration = update.duration;
    if (update.data !== undefined) this.options.data = { ...(this.options.data ?? {}), ...update.data };
    if (update.assets !== undefined) this.options.assets = update.assets;
    if (update.assetResolver !== undefined) this.options.assetResolver = update.assetResolver;
    if (update.fonts !== undefined) this.options.fonts = update.fonts;

    const runtime = this.runtime;
    if (!runtime) return;

    const dimensions = update.format !== undefined ? resolveFormat(update.format) : {};
    const runtimeUpdate: RuntimeUpdate = { ...dimensions };
    if (update.width !== undefined) runtimeUpdate.width = update.width;
    if (update.height !== undefined) runtimeUpdate.height = update.height;
    if (update.fps !== undefined) runtimeUpdate.fps = update.fps;
    if (update.duration !== undefined) runtimeUpdate.duration = update.duration;
    if (update.data !== undefined) runtimeUpdate.data = update.data;
    if (update.assets !== undefined) runtimeUpdate.assets = update.assets;
    if (update.assetResolver !== undefined) runtimeUpdate.assetResolver = update.assetResolver;
    runtime.update(runtimeUpdate);
    const runtimeState = runtime.getState();
    this.clock.configure({ fps: runtimeState.fps, totalFrames: runtimeState.totalFrames });
    this.state = {
      ...this.state,
      medium: runtimeState.medium,
      animated: runtimeState.animated,
      totalFrames: runtimeState.totalFrames,
      fps: runtimeState.fps,
      duration: runtimeState.duration,
      width: runtimeState.width,
      height: runtimeState.height,
      progress: runtimeState.progress,
    };
    this.emit();
  }

  getState(): MediaSessionState {
    return this.state;
  }

  getClock(): MediaClock {
    return this.clock;
  }

  getSurface(): MediaSurface | null {
    return this.surface;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  on<K extends keyof MediaSessionEvents>(event: K, callback: MediaSessionEvents[K]): () => void {
    const set = (this.events[event] ??= new Set<MediaSessionEvents[K]>());
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
    this.clock.dispose();
    this.clearRuntimeEventDisposers();
    this.runtime?.dispose();
    this.runtime = null;
    this.surface = null;
    this.listeners.clear();
    this.events = {};
  }

  private toRuntimeOptions(extra: { autoplay?: boolean } = {}): RuntimeOptions {
    const dimensions = this.options.format ? resolveFormat(this.options.format) : {};
    const runtimeOptions: RuntimeOptions = {
      autoplay: extra.autoplay ?? false,
      playbackMode: toRuntimePlaybackMode(this.options.playbackMode),
      ...dimensions,
    };
    if (this.options.width !== undefined) runtimeOptions.width = this.options.width;
    if (this.options.height !== undefined) runtimeOptions.height = this.options.height;
    if (this.options.fps !== undefined) runtimeOptions.fps = this.options.fps;
    if (this.options.duration !== undefined) runtimeOptions.duration = this.options.duration;
    if (this.options.data !== undefined) runtimeOptions.data = this.options.data;
    if (this.options.assets !== undefined) runtimeOptions.assets = this.options.assets;
    if (this.options.assetResolver !== undefined) runtimeOptions.assetResolver = this.options.assetResolver;
    if (this.options.fonts !== undefined) runtimeOptions.fonts = this.options.fonts;
    if (this.options.outputName !== undefined) runtimeOptions.outputName = this.options.outputName;
    if (this.options.allowScripts !== undefined) runtimeOptions.allowScripts = this.options.allowScripts;
    if (this.options.presenter !== undefined) runtimeOptions.presenter = this.options.presenter;
    return runtimeOptions;
  }

  private async renderRuntimeFrame(runtime: WebRuntime, frame: number): Promise<RuntimeRenderedPayload> {
    let payload: RuntimeRenderedPayload | null = null;
    const offRendered = runtime.on("rendered", (next) => {
      if (next.frame === runtime.getState().currentFrame || next.frame === Math.floor(frame)) {
        payload = next;
      }
    });
    try {
      await runtime.render(frame);
    } finally {
      offRendered();
    }
    if (!payload) throw new Error(`MediaSession renderFrame(${frame}) did not produce a frame`);
    return payload;
  }

  private syncClockToRenderedFrame(frame: number): void {
    const runtimeState = this.requireRuntime("syncClock").getState();
    this.clock.configure({
      fps: runtimeState.fps,
      totalFrames: runtimeState.totalFrames,
      playbackMode: this.options.playbackMode ?? "once",
    });
    const clockState = this.clock.getState();
    this.state = {
      ...this.state,
      medium: runtimeState.medium,
      animated: runtimeState.animated,
      isPlaying: clockState.isPlaying,
      currentFrame: frame,
      totalFrames: runtimeState.totalFrames,
      fps: runtimeState.fps,
      duration: runtimeState.duration,
      width: runtimeState.width,
      height: runtimeState.height,
      progress: runtimeState.progress,
    };
  }

  private updateFromClock(): void {
    const clockState: MediaClockState = this.clock.getState();
    this.state = {
      ...this.state,
      isPlaying: clockState.isPlaying,
      currentFrame: clockState.currentFrame,
      fps: clockState.fps,
      totalFrames: clockState.totalFrames,
      duration: clockState.duration,
      progress: clockState.progress,
    };
  }

  private async waitForSurfaceReady(): Promise<void> {
    const root = this.getSurfaceRoot();
    if (!root) return;
    const doc = root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument;
    const fonts = doc ? (doc as Document & { fonts?: FontFaceSet }).fonts : undefined;
    if (fonts?.ready) await fonts.ready.catch(() => undefined);
  }

  private syncNativeMedia(): void {
    const root = this.getSurfaceRoot();
    if (!root) return;
    const videos = Array.from(root.querySelectorAll?.("video[data-superimg-media]") ?? []) as HTMLVideoElement[];
    const shouldPlayNative = this.options.playback !== "deterministic" && this.clock.getState().isPlaying;
    for (const video of videos) {
      const time = Number(video.dataset.t ?? "0");
      if (Number.isFinite(time) && Math.abs(video.currentTime - time) > 0.05) {
        try {
          video.currentTime = time;
        } catch {
          // Browser previews can point at remote assets; leave failed seeks to native media.
        }
      }
      if (shouldPlayNative) {
        void video.play?.().catch(() => undefined);
      } else {
        video.pause?.();
      }
    }
  }

  private playNativeMedia(): void {
    this.syncNativeMedia();
  }

  private pauseNativeMedia(): void {
    const root = this.getSurfaceRoot();
    if (!root) return;
    const videos = Array.from(root.querySelectorAll?.("video[data-superimg-media]") ?? []) as HTMLVideoElement[];
    for (const video of videos) video.pause?.();
  }

  private getSurfaceRoot(): Document | Element | null {
    const element = this.runtime?.getElement();
    if (!element) return null;
    if (element instanceof HTMLIFrameElement) return element.contentDocument;
    return element;
  }

  private markReady(): void {
    if (this.state.isReady) return;
    this.state = { ...this.state, isReady: true, surface: this.surface };
    this.emit();
    this.emitEvent("ready");
    this.resolveReady();
  }

  private requireRuntime(operation: string): WebRuntime {
    if (!this.runtime) throw new Error(`MediaSession must be mounted before ${operation}()`);
    return this.runtime;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private clearRuntimeEventDisposers(): void {
    for (const dispose of this.runtimeEventDisposers) dispose();
    this.runtimeEventDisposers = [];
  }

  private emitEvent<K extends keyof MediaSessionEvents>(event: K, ...args: Parameters<MediaSessionEvents[K]>): void {
    this.events[event]?.forEach((callback) => {
      (callback as (...a: Parameters<MediaSessionEvents[K]>) => void)(...args);
    });
  }
}

function resolveFormat(format: FormatOption): { width: number; height: number } {
  if (typeof format === "object") return format;
  const presetPath = FORMAT_ALIASES[format] ?? format;
  const preset = getPreset(presetPath);
  if (!preset) throw new Error(`Unknown format: ${format}`);
  return { width: preset.width, height: preset.height };
}

function toRuntimePlaybackMode(mode: MediaPlaybackMode | undefined): PlaybackMode {
  return mode === "loop" ? "loop" : "once";
}
