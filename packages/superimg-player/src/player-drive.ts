//! Omakase input → integer-frame seek. Scroll or pointer only.

import type { DriveSource } from "@superimg/types";
import { clampRubber, createSpring, momentumProject } from "./spring.js";

export interface DriveTarget {
  seek(to: { frame: number } | { progress: number } | { seconds: number }): void;
  get currentProgress(): number;
  get totalFrames(): number;
  beginGestureSeek(): void;
  endGestureSeek(): void;
}

export class DriveController {
  private spring = createSpring(0);
  private raf = 0;
  private lastTs = 0;
  private lastFrame = -1;
  private dragging = false;
  private pointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerT = 0;
  private pointerVelocity = 0;
  private reduced = false;
  private media: MediaQueryList | null = null;
  private disposers: Array<() => void> = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly source: DriveSource,
    private readonly getTarget: () => DriveTarget | null,
  ) {}

  install(): void {
    this.dispose();
    this.lastFrame = -1;
    if (typeof window === "undefined") return;

    this.media = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = this.media.matches;
    const onMotion = () => {
      this.reduced = this.media?.matches ?? false;
      if (this.reduced) {
        this.stopRaf();
        this.dragging = false;
        this.releasePointer();
        this.getTarget()?.endGestureSeek();
        this.spring.interrupt(0, 0);
        this.spring.target = 0;
        this.lastFrame = 0;
        this.getTarget()?.seek({ frame: 0 });
      } else {
        this.lastFrame = -1;
        const progress = this.getTarget()?.currentProgress ?? 0;
        this.spring.interrupt(progress, 0);
        this.spring.target = progress;
        if (this.source === "scroll") this.setTarget(this.measureScroll(), true);
      }
    };
    this.media.addEventListener("change", onMotion);
    this.disposers.push(() => this.media?.removeEventListener("change", onMotion));

    if (this.reduced) {
      this.lastFrame = 0;
      this.getTarget()?.seek({ frame: 0 });
    }

    if (this.source === "scroll") {
      const onScroll = () => this.setTarget(this.measureScroll(), false);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      this.disposers.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });
      onScroll();
      return;
    }

    const onDown = (event: PointerEvent) => {
      if (this.reduced || this.pointerId !== null) return;
      this.container.setPointerCapture(event.pointerId);
      this.pointerId = event.pointerId;
      this.dragging = true;
      this.getTarget()?.beginGestureSeek();
      this.lastPointerX = event.clientX;
      this.lastPointerT = event.timeStamp;
      this.pointerVelocity = 0;
      const progress = this.pointerProgress(event);
      this.spring.interrupt(progress, 0);
      this.spring.target = progress;
      this.writeFrame(progress);
      this.startRaf();
    };
    const onMove = (event: PointerEvent) => {
      if (this.reduced) return;
      if (this.pointerId !== null && event.pointerId !== this.pointerId) return;
      const progress = this.pointerProgress(event);
      const dt = event.timeStamp - this.lastPointerT;
      if (dt > 0) {
        this.pointerVelocity = (event.clientX - this.lastPointerX) / dt * 1000;
      }
      this.lastPointerX = event.clientX;
      this.lastPointerT = event.timeStamp;
      if (this.dragging) {
        this.spring.interrupt(progress, 0);
        this.spring.target = progress;
        this.writeFrame(progress);
        return;
      }
      this.setTarget(progress, false);
    };
    const onUp = (event: PointerEvent) => {
      if (!this.dragging || event.pointerId !== this.pointerId) return;
      this.dragging = false;
      const width = Math.max(this.container.getBoundingClientRect().width, 1);
      const v = this.pointerVelocity / width;
      const projected = clampRubber(this.spring.position + momentumProject(v));
      this.spring.interrupt(this.spring.position, v);
      this.spring.target = Math.min(1, Math.max(0, projected));
      this.startRaf();
      this.releasePointer();
    };
    const onCancel = (event: PointerEvent) => {
      if (!this.dragging || event.pointerId !== this.pointerId) return;
      this.dragging = false;
      this.stopRaf();
      this.spring.interrupt(this.spring.position, 0);
      this.spring.target = this.spring.position;
      this.releasePointer();
      this.getTarget()?.endGestureSeek();
    };

    this.container.addEventListener("pointerdown", onDown);
    this.container.addEventListener("pointermove", onMove);
    this.container.addEventListener("pointerup", onUp);
    this.container.addEventListener("pointercancel", onCancel);
    this.container.addEventListener("lostpointercapture", onCancel);
    this.disposers.push(() => {
      this.container.removeEventListener("pointerdown", onDown);
      this.container.removeEventListener("pointermove", onMove);
      this.container.removeEventListener("pointerup", onUp);
      this.container.removeEventListener("pointercancel", onCancel);
      this.container.removeEventListener("lostpointercapture", onCancel);
    });
  }

  dispose(): void {
    this.stopRaf();
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.dragging = false;
    this.releasePointer();
    this.getTarget()?.endGestureSeek();
  }

  private releasePointer(): void {
    if (this.pointerId === null) return;
    const pointerId = this.pointerId;
    this.pointerId = null;
    try { this.container.releasePointerCapture(pointerId); } catch { /* already released */ }
  }

  private setTarget(progress: number, immediate: boolean): void {
    if (this.reduced) return;
    const next = clampRubber(progress);
    if (immediate || this.lastFrame === -1) {
      this.spring.interrupt(next, 0);
      this.spring.target = Math.min(1, Math.max(0, next));
      this.writeFrame(this.spring.position);
      return;
    }
    this.spring.target = Math.min(1, Math.max(0, next));
    this.startRaf();
  }

  private measureScroll(): number {
    const section = this.container.parentElement ?? this.container;
    const travel = Math.max(section.offsetHeight - this.container.offsetHeight, 1);
    return (-section.getBoundingClientRect().top) / travel;
  }

  private pointerProgress(event: PointerEvent): number {
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return (event.clientX - rect.left) / rect.width;
  }

  private startRaf(): void {
    if (this.reduced || this.raf !== 0) return;
    this.lastTs = 0;
    const tick = (now: number) => {
      this.raf = 0;
      if (this.reduced) return;
      const dt = this.lastTs === 0 ? 16 : now - this.lastTs;
      this.lastTs = now;
      if (!this.dragging) this.spring.step(dt);
      this.writeFrame(this.spring.position);
      if (!this.dragging && !this.spring.atRest) this.startRaf();
      else if (!this.dragging) this.getTarget()?.endGestureSeek();
    };
    this.raf = window.requestAnimationFrame(tick);
  }

  private stopRaf(): void {
    if (this.raf === 0) return;
    window.cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private writeFrame(raw: number): void {
    const target = this.getTarget();
    if (!target) return;
    const progress = clampRubber(raw);
    const total = Math.max(target.totalFrames, 1);
    const frame = Math.round(Math.min(1, Math.max(0, progress)) * Math.max(total - 1, 0));
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    target.seek({ frame });
  }
}
