export type MediaPlaybackMode = "once" | "loop";

export interface MediaClockState {
  currentFrame: number;
  isPlaying: boolean;
  fps: number;
  totalFrames: number;
  duration: number;
  progress: number;
  playbackMode: MediaPlaybackMode;
}

export interface MediaClockOptions {
  fps: number;
  totalFrames: number;
  playbackMode?: MediaPlaybackMode;
  now?: () => number;
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (id: number) => void;
  onFrame?: (frame: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

type Listener = () => void;

const defaultNow = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const defaultRequestFrame = (callback: () => void): number => {
  if (typeof requestAnimationFrame !== "undefined") return requestAnimationFrame(callback);
  return setTimeout(callback, 16) as unknown as number;
};

const defaultCancelFrame = (id: number): void => {
  if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(id);
  else clearTimeout(id);
};

export class MediaClock {
  private fps: number;
  private totalFrames: number;
  private playbackMode: MediaPlaybackMode;
  private currentFrame = 0;
  private isPlaying = false;
  private startedAtMs = 0;
  private startFrame = 0;
  private rafId: number | null = null;
  private readonly now: () => number;
  private readonly requestFrame: (callback: () => void) => number;
  private readonly cancelFrame: (id: number) => void;
  private readonly listeners = new Set<Listener>();
  private readonly onFrame?: (frame: number) => void;
  private readonly onPlay?: () => void;
  private readonly onPause?: () => void;
  private readonly onEnded?: () => void;

  constructor(options: MediaClockOptions) {
    this.fps = options.fps;
    this.totalFrames = Math.max(1, Math.floor(options.totalFrames));
    this.playbackMode = options.playbackMode ?? "once";
    this.now = options.now ?? defaultNow;
    this.requestFrame = options.requestFrame ?? defaultRequestFrame;
    this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
    if (options.onFrame) this.onFrame = options.onFrame;
    if (options.onPlay) this.onPlay = options.onPlay;
    if (options.onPause) this.onPause = options.onPause;
    if (options.onEnded) this.onEnded = options.onEnded;
  }

  configure(options: { fps?: number; totalFrames?: number; playbackMode?: MediaPlaybackMode }): void {
    if (options.fps !== undefined) this.fps = options.fps;
    if (options.totalFrames !== undefined) this.totalFrames = Math.max(1, Math.floor(options.totalFrames));
    if (options.playbackMode !== undefined) this.playbackMode = options.playbackMode;
    this.currentFrame = this.clampFrame(this.currentFrame);
    this.emit();
  }

  getState(): MediaClockState {
    const currentFrame = this.clampFrame(this.currentFrame);
    return {
      currentFrame,
      isPlaying: this.isPlaying,
      fps: this.fps,
      totalFrames: this.totalFrames,
      duration: this.totalFrames / this.fps,
      progress: this.totalFrames > 1 ? currentFrame / (this.totalFrames - 1) : 1,
      playbackMode: this.playbackMode,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  play(): void {
    if (this.isPlaying) return;
    const frame = this.currentFrame >= this.totalFrames - 1 ? 0 : this.currentFrame;
    this.currentFrame = frame;
    this.startFrame = frame;
    this.startedAtMs = this.now();
    this.isPlaying = true;
    this.onPlay?.();
    this.emit();
    this.schedule();
  }

  pause(): void {
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId);
      this.rafId = null;
    }
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.onPause?.();
    this.emit();
  }

  seekFrame(frame: number): void {
    this.currentFrame = this.clampFrame(frame);
    if (this.isPlaying) {
      this.startFrame = this.currentFrame;
      this.startedAtMs = this.now();
    }
    this.onFrame?.(this.currentFrame);
    this.emit();
  }

  seekProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.seekFrame(Math.round(clamped * Math.max(0, this.totalFrames - 1)));
  }

  step(nowMs: number = this.now()): void {
    if (!this.isPlaying) return;
    const elapsed = (nowMs - this.startedAtMs) / 1000;
    const frame = this.startFrame + Math.floor(elapsed * this.fps);
    if (frame >= this.totalFrames) {
      if (this.playbackMode === "loop") {
        this.currentFrame = 0;
        this.startFrame = 0;
        this.startedAtMs = nowMs;
        this.onFrame?.(0);
        this.emit();
        this.schedule();
        return;
      }
      this.currentFrame = this.totalFrames - 1;
      this.isPlaying = false;
      this.rafId = null;
      this.onFrame?.(this.currentFrame);
      this.onEnded?.();
      this.emit();
      return;
    }

    if (frame !== this.currentFrame) {
      this.currentFrame = this.clampFrame(frame);
      this.onFrame?.(this.currentFrame);
      this.emit();
    }
    this.schedule();
  }

  dispose(): void {
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId);
      this.rafId = null;
    }
    this.listeners.clear();
    this.isPlaying = false;
  }

  private schedule(): void {
    if (!this.isPlaying) return;
    if (this.rafId !== null) this.cancelFrame(this.rafId);
    this.rafId = this.requestFrame(() => {
      this.rafId = null;
      this.step();
    });
  }

  private clampFrame(frame: number): number {
    return Math.max(0, Math.min(Math.floor(frame), this.totalFrames - 1));
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
