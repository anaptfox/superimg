import {
  createImageRenderContext,
  createRenderContext,
  createSvgRenderContext,
  resolveRuntimeTemplateInfo,
  type RuntimeTemplate,
  type RuntimeTemplateInfo,
} from "@superimg/core";
import { buildCompositeHtml } from "@superimg/core/html";
import type {
  AnyTemplateModule,
  AssetMeta,
  ComposedTemplate,
  RenderContext,
  ResolvedScene,
  TemplateKind,
} from "@superimg/types";
import { isComposedTemplate } from "@superimg/types";
import { IframePresenter, type DomPresenter } from "./presenter.js";
import { superimgDebug } from "./debug.js";

export type RuntimeInput = AnyTemplateModule | ComposedTemplate;
export type RuntimePlaybackMode = "once" | "loop" | "ping-pong";

export interface RuntimeOptions {
  data?: Record<string, unknown>;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  autoplay?: boolean;
  loop?: boolean;
  playbackMode?: RuntimePlaybackMode;
  outputName?: string;
  assetResolver?: (filename: string) => string;
  assets?: Record<string, AssetMeta>;
  presenter?: DomPresenter;
  /** Force the iframe sandbox to allow scripts (default: only when the template
   *  needs them, e.g. `config.tailwind`). Set for templates that run in-frame JS. */
  allowScripts?: boolean;
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
  kind: TemplateKind;
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

export interface RuntimeEvents {
  ready: () => void;
  frame: (frame: number, totalFrames: number) => void;
  rendered: (payload: RuntimeRenderedPayload) => void;
  play: () => void;
  pause: () => void;
  ended: () => void;
  error: (error: Error) => void;
  scenechange: (scene: ResolvedScene) => void;
}

export type RuntimeStore = Pick<WebRuntime, "getState" | "subscribe"> & {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seekFrame: (frame: number) => void;
  seekProgress: (progress: number) => void;
};

type Listener = () => void;

export class WebRuntime {
  private template: RuntimeInput;
  private presenter: DomPresenter;
  private options: RuntimeOptions;
  private info: RuntimeTemplateInfo;
  private data: Record<string, unknown>;
  private assets: Record<string, AssetMeta>;
  private assetResolver?: (filename: string) => string;
  private state: RuntimeState;
  private listeners = new Set<Listener>();
  private events: Partial<{ [K in keyof RuntimeEvents]: Set<RuntimeEvents[K]> }> = {};
  private rafId: number | null = null;
  private startedAtMs = 0;
  private startFrame = 0;
  private lastSceneIndex = -1;

  constructor(template: RuntimeInput, options: RuntimeOptions = {}) {
    this.template = template;
    this.options = options;
    this.data = options.data ?? {};
    this.assets = options.assets ?? {};
    this.assetResolver = options.assetResolver;
    // Resolve info before building the presenter — the sandbox's `allow-scripts`
    // token depends on the template (see needsScripts). resolveInfo() reads only
    // template/options/data, never the presenter, so this ordering is safe.
    this.info = this.resolveInfo();
    this.presenter = options.presenter ?? new IframePresenter({ allowScripts: this.needsScripts() });
    this.state = this.createState(false, false, 0);
  }

  /** Whether the iframe needs `allow-scripts`: Tailwind injects a CDN `<script>`,
   *  and templates may opt in explicitly. Plain templates render script-free. */
  private needsScripts(): boolean {
    return !!this.info.tailwind || this.options.allowScripts === true;
  }

  attach(container: HTMLElement): this {
    this.presenter.attach(container);
    this.configurePresenter();
    void this.render(0).catch(() => {});
    if (!this.state.isReady) {
      this.state = this.createState(true, false, this.state.currentFrame);
      this.emitState();
      this.emit("ready");
    }
    if (this.options.autoplay ?? false) this.play();
    return this;
  }

  update(update: RuntimeUpdate): void {
    if (update.data) this.data = { ...this.data, ...update.data };
    if (update.assets) this.assets = update.assets;
    if (update.assetResolver) this.assetResolver = update.assetResolver;
    this.options = { ...this.options, ...update };
    this.info = this.resolveInfo();
    this.configurePresenter();
    this.state = this.createState(this.state.isReady, this.state.isPlaying, this.state.currentFrame);
    this.seekFrame(this.state.currentFrame);
  }

  async render(frame: number = this.state.currentFrame): Promise<void> {
    const targetFrame = this.clampFrame(frame);
    try {
      const { html, compositeHtml } = this.renderHtml(targetFrame);
      this.presenter.present(compositeHtml, this.info.width, this.info.height);
      this.state = this.createState(this.state.isReady, this.state.isPlaying, targetFrame);
      this.emitState();
      this.emit("rendered", { frame: targetFrame, html, compositeHtml });
      this.emit("frame", targetFrame, this.info.totalFrames);
      this.emitSceneChange(targetFrame);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      throw err;
    }
  }

  play(): void {
    if (!this.info.isAnimated) return;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const frame = this.state.currentFrame >= this.info.totalFrames - 1 ? 0 : this.state.currentFrame;
    this.startedAtMs = performance.now();
    this.startFrame = frame;
    this.state = this.createState(this.state.isReady, true, frame);
    this.emitState();
    this.emit("play");
    this.rafId = requestAnimationFrame(this.tick);
  }

  pause(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.state.isPlaying) {
      this.state = this.createState(this.state.isReady, false, this.state.currentFrame);
      this.emitState();
      this.emit("pause");
    }
  }

  seekFrame(frame: number): void {
    const next = this.clampFrame(frame);
    void this.render(next).catch(() => {});
  }

  seekProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.seekFrame(Math.floor(clamped * Math.max(0, this.info.totalFrames - 1)));
  }

  seekTimeSeconds(seconds: number): void {
    this.seekFrame(Math.floor(seconds * this.info.fps));
  }

  getState(): RuntimeState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  on<K extends keyof RuntimeEvents>(event: K, callback: RuntimeEvents[K]): () => void {
    const set = (this.events[event] ??= new Set() as any);
    set.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof RuntimeEvents>(event: K, callback?: RuntimeEvents[K]): void {
    if (!callback) {
      this.events[event]?.clear();
      return;
    }
    this.events[event]?.delete(callback as never);
  }

  getElement(): HTMLElement {
    return this.presenter.getElement();
  }

  asStore(): RuntimeStore {
    return {
      getState: () => this.getState(),
      subscribe: (listener) => this.subscribe(listener),
      play: () => this.play(),
      pause: () => this.pause(),
      togglePlayPause: () => {
        this.state.isPlaying ? this.pause() : this.play();
      },
      seekFrame: (frame) => this.seekFrame(frame),
      seekProgress: (progress) => this.seekProgress(progress),
    };
  }

  dispose(): void {
    this.pause();
    this.presenter.dispose();
    this.listeners.clear();
    this.events = {};
  }

  private tick = () => {
    if (!this.state.isPlaying) {
      this.rafId = null;
      return;
    }
    const elapsed = (performance.now() - this.startedAtMs) / 1000;
    const frame = this.startFrame + Math.floor(elapsed * this.info.fps);
    if (frame >= this.info.totalFrames) {
      if (this.options.loop || this.options.playbackMode === "loop") {
        this.startedAtMs = performance.now();
        this.startFrame = 0;
        void this.render(0).catch(() => {});
        this.rafId = requestAnimationFrame(this.tick);
        return;
      }
      this.state = this.createState(this.state.isReady, false, this.info.totalFrames - 1);
      this.emitState();
      this.emit("ended");
      this.rafId = null;
      return;
    }
    void this.render(frame).catch(() => {});
    this.rafId = requestAnimationFrame(this.tick);
  };

  private resolveInfo(): RuntimeTemplateInfo {
    return resolveRuntimeTemplateInfo(this.template as RuntimeTemplate, {
      width: this.options.width,
      height: this.options.height,
      fps: this.options.fps,
      duration: this.options.duration,
      data: this.data,
    });
  }

  private createState(isReady: boolean, isPlaying: boolean, frame: number): RuntimeState {
    const currentFrame = this.clampFrame(frame);
    return {
      kind: this.info.kind,
      isReady,
      isPlaying,
      isScrubbing: false,
      currentFrame,
      totalFrames: this.info.totalFrames,
      fps: this.info.fps,
      duration: this.info.duration,
      width: this.info.width,
      height: this.info.height,
      progress: this.info.totalFrames > 1 ? currentFrame / (this.info.totalFrames - 1) : 0,
    };
  }

  private configurePresenter(): void {
    const fontUrls = (this.info.fonts ?? []).map((f) => {
      const family = encodeURIComponent(f.trim());
      return `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
    });
    const stylesheets = [...fontUrls, ...(this.info.stylesheets ?? [])];
    superimgDebug("configurePresenter", {
      fonts: this.info.fonts,
      fontUrls,
      inlineCssCount: this.info.inlineCss?.length ?? 0,
      stylesheets,
      tailwind: this.info.tailwind,
      presenter: this.presenter.constructor.name,
    });
    this.presenter.injectStyles(this.info.inlineCss, stylesheets, this.info.tailwind);
  }

  private clampFrame(frame: number): number {
    return Math.max(0, Math.min(Math.floor(frame), Math.max(0, this.info.totalFrames - 1)));
  }

  private renderHtml(frame: number): RuntimeRenderedPayload {
    const config = this.template.config ?? {};
    const base = {
      data: this.info.data,
      outputName: this.options.outputName ?? "default",
      assets: this.assets,
      assetResolver: this.assetResolver,
      designWidth: config.width,
    };

    if (this.info.kind === "image") {
      const ctx = createImageRenderContext(this.info.width, this.info.height, base);
      const html = (this.template as AnyTemplateModule).render(ctx as never);
      return { frame, html, compositeHtml: html };
    }

    if (this.info.kind === "svg") {
      const ctx = createSvgRenderContext(this.info.width, this.info.height, {
        ...base,
        duration: this.info.duration,
      });
      const html = (this.template as AnyTemplateModule).render(ctx as never);
      return { frame, html, compositeHtml: html };
    }

    const ctx = createRenderContext(
      frame,
      this.info.fps,
      this.info.totalFrames,
      this.info.width,
      this.info.height,
      this.info.data,
      this.options.outputName ?? "default",
      this.assets,
      this.assetResolver,
      config.width
    );
    const html = this.template.render(ctx as RenderContext);
    const compositeHtml = buildCompositeHtml(
      html,
      "background" in config ? config.background : undefined,
      "watermark" in config ? config.watermark : undefined,
      this.info.width,
      this.info.height
    );
    return { frame, html, compositeHtml };
  }

  private emitState(): void {
    this.listeners.forEach((listener) => listener());
  }

  private emit<K extends keyof RuntimeEvents>(event: K, ...args: Parameters<RuntimeEvents[K]>): void {
    this.events[event]?.forEach((callback) => {
      (callback as (...a: Parameters<RuntimeEvents[K]>) => void)(...args);
    });
  }

  private emitSceneChange(frame: number): void {
    if (!isComposedTemplate(this.template)) return;
    const scene = this.template.getSceneAtFrame(frame);
    if (scene.index !== this.lastSceneIndex) {
      this.lastSceneIndex = scene.index;
      this.emit("scenechange", scene);
    }
  }
}

export function createRuntime(template: RuntimeInput, options?: RuntimeOptions): WebRuntime {
  return new WebRuntime(template, options);
}

export function mount(container: HTMLElement, template: RuntimeInput, options?: RuntimeOptions): WebRuntime {
  return createRuntime(template, options).attach(container);
}
