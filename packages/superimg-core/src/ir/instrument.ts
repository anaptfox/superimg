//! Internal IR instrumentation sink (not author-facing).

import type { MediaIREasing, MediaIRFrameRange } from "@superimg/types";

export interface IrMotionEvent {
  localId: string;
  sceneId: string;
  kind: "motion" | "tween" | "value";
  target?: string;
  property?: string;
  /** Scene-local progress window [0,1] for enter */
  enterStart: number;
  enterEnd: number;
  exitStart?: number;
  exitEnd?: number;
  from?: Record<string, number>;
  to?: Record<string, number>;
  exitTo?: Record<string, number>;
  easing?: MediaIREasing;
  /** Mirrored exit easing as applied at runtime. */
  exitEasing?: MediaIREasing;
  pattern?: "linear" | "sine" | "pulse" | "bounce";
  frame: number;
  sceneStartFrame: number;
  totalFrames: number;
}

export interface IrTrackEvent {
  localId: string;
  sceneId: string;
  kind: "author-track" | "transcript" | "markers";
  wordCount?: number;
  markerCount?: number;
  frame: number;
  sceneStartFrame: number;
  totalFrames: number;
}

export interface IrStackEvent {
  localId: string;
  sceneId: string;
  itemIds: string[];
  frame: number;
  sceneStartFrame: number;
  totalFrames: number;
}

export interface IrCarouselEvent {
  localId: string;
  sceneId: string;
  itemIds: string[];
  frame: number;
  sceneStartFrame: number;
  totalFrames: number;
}

export interface IrVideoSyncEvent {
  localId: string;
  sceneId: string;
  src: string;
  mediaTime: number;
  frame: number;
  sceneStartFrame: number;
  totalFrames: number;
}

export interface IrDirectorEvent {
  sceneId: string;
  phases: { name: string; start: number; end: number }[];
  frame: number;
  sceneStartFrame: number;
  totalFrames: number;
}

export interface IrMarkupEvent {
  frame: number;
  markupHash: string;
  sceneHash: string;
  sceneId: string;
  html: string;
}

export interface IrInstrumentSink {
  onDirector?(event: IrDirectorEvent): void;
  onMotion?(event: IrMotionEvent): void;
  onTrack?(event: IrTrackEvent): void;
  onStack?(event: IrStackEvent): void;
  onCarousel?(event: IrCarouselEvent): void;
  onVideoSync?(event: IrVideoSyncEvent): void;
  onMarkup?(event: IrMarkupEvent): void;
  onIssue?(issue: {
    code: string;
    message: string;
    sceneId?: string;
    id?: string;
    frame?: number;
  }): void;
  /** When true, missing motion/track IDs throw. */
  strictIds?: boolean;
  sceneId?: string;
  sceneStartFrame?: number;
  totalFrames?: number;
  frame?: number;
}

/**
 * Map scene-local progress [0,1] window to half-open frames.
 * Aligns with createTimeline: frame index maps via frame/(N-1) for N>1.
 */
export function progressWindowToRange(
  start: number,
  end: number,
  sceneLocalTotalFrames: number,
  sceneStartFrame: number,
): MediaIRFrameRange {
  const clamp = (p: number) => Math.max(0, Math.min(1, p));
  const s = clamp(start);
  const e = clamp(end);
  const n = Math.max(1, sceneLocalTotalFrames);
  const toFrame = (p: number) =>
    n <= 1 ? 0 : Math.min(n - 1, Math.round(p * (n - 1)));
  const startLocal = toFrame(s);
  // endFrame exclusive: map progress end to last inclusive frame + 1
  let endLocal = e >= 1 ? n : toFrame(e) + (e > s ? 1 : 0);
  if (endLocal <= startLocal) endLocal = startLocal + 1;
  endLocal = Math.min(n, endLocal);
  return {
    startFrame: sceneStartFrame + startLocal,
    endFrame: sceneStartFrame + endLocal,
  };
}

export class IrCollector {
  readonly motions = new Map<string, IrMotionEvent[]>();
  readonly tracks = new Map<string, IrTrackEvent[]>();
  readonly stacks = new Map<string, IrStackEvent[]>();
  readonly carousels = new Map<string, IrCarouselEvent[]>();
  readonly videoSyncs = new Map<string, IrVideoSyncEvent[]>();
  readonly directors: IrDirectorEvent[] = [];
  readonly markupByFrame = new Map<number, { markupHash: string; sceneHash: string; sceneId: string }>();
  readonly issues: Array<{
    code: string;
    message: string;
    sceneId?: string;
    id?: string;
    frame?: number;
  }> = [];
  private readonly issueKeys = new Set<string>();

  sink(base: Partial<IrInstrumentSink> = {}): IrInstrumentSink {
    const self = this;
    return {
      strictIds: false,
      ...base,
      onDirector(e) {
        self.directors.push(e);
        base.onDirector?.(e);
      },
      onMotion(e) {
        const id = `${e.sceneId}::${e.localId}`;
        const list = self.motions.get(id) ?? [];
        list.push(e);
        self.motions.set(id, list);
        base.onMotion?.(e);
      },
      onTrack(e) {
        const id = `${e.sceneId}::${e.localId}`;
        const list = self.tracks.get(id) ?? [];
        list.push(e);
        self.tracks.set(id, list);
        base.onTrack?.(e);
      },
      onStack(e) {
        const id = `${e.sceneId}::${e.localId}`;
        const list = self.stacks.get(id) ?? [];
        list.push(e);
        self.stacks.set(id, list);
        base.onStack?.(e);
      },
      onCarousel(e) {
        const id = `${e.sceneId}::${e.localId}`;
        const list = self.carousels.get(id) ?? [];
        list.push(e);
        self.carousels.set(id, list);
        base.onCarousel?.(e);
      },
      onVideoSync(e) {
        const id = `${e.sceneId}::${e.localId}`;
        const list = self.videoSyncs.get(id) ?? [];
        list.push(e);
        self.videoSyncs.set(id, list);
        base.onVideoSync?.(e);
      },
      onMarkup(e) {
        self.markupByFrame.set(e.frame, {
          markupHash: e.markupHash,
          sceneHash: e.sceneHash,
          sceneId: e.sceneId,
        });
        base.onMarkup?.(e);
      },
      onIssue(issue) {
        const key = [
          issue.code,
          issue.sceneId ?? "",
          issue.id ?? "",
          issue.message,
        ].join("\0");
        if (!self.issueKeys.has(key)) {
          self.issueKeys.add(key);
          self.issues.push(issue);
        }
        base.onIssue?.(issue);
      },
    };
  }
}
