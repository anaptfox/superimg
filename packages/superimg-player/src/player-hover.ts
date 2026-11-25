import type { HoverBehavior } from "@superimg/types";

export interface HoverPlaybackTarget {
  play(): void;
  pause(): void;
  seek(to: { frame: number } | { progress: number } | { seconds: number }): void;
}

export interface HoverConfig {
  behavior: HoverBehavior;
  delayMs: number;
  /**
   * What to do when the pointer leaves.
   * - `"pause"` (default for play): keep the current frame as the rest poster
   * - `"reset"`: seek to frame 0 (often an empty intro — prefer pause)
   *
   * `preview-scrub` always resets scrub position to 0 on leave.
   */
  leaveBehavior?: "pause" | "reset";
}

export class HoverController {
  private timeoutId: number | undefined;
  private disposers: Array<() => void> = [];
  private suppressed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly config: HoverConfig,
    private readonly getTarget: () => HoverPlaybackTarget | null
  ) {}

  install(): void {
    if (this.config.behavior === "none") return;

    const leaveBehavior =
      this.config.leaveBehavior ??
      (this.config.behavior === "preview-scrub" ? "reset" : "pause");

    const onMouseEnter = () => {
      if (this.suppressed) return;
      if (this.config.behavior !== "play") return;
      this.timeoutId = window.setTimeout(() => this.getTarget()?.play(), this.config.delayMs);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (this.suppressed) return;
      if (this.config.behavior !== "preview-scrub") return;
      const target = this.getTarget();
      if (!target) return;
      const rect = this.container.getBoundingClientRect();
      const progress = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
      target.seek({ progress });
    };

    const onMouseLeave = () => {
      if (this.suppressed) return;
      if (this.timeoutId !== undefined) {
        window.clearTimeout(this.timeoutId);
        this.timeoutId = undefined;
      }
      const target = this.getTarget();
      if (!target) return;
      target.pause();
      // Rest on a painted frame. Seeking to 0 lands many templates on an
      // opacity-0 intro (blank plate). Only reset for scrub or explicit reset.
      if (this.config.behavior === "preview-scrub" || leaveBehavior === "reset") {
        target.seek({ frame: 0 });
      }
    };

    this.container.addEventListener("mouseenter", onMouseEnter);
    this.container.addEventListener("mousemove", onMouseMove);
    this.container.addEventListener("mouseleave", onMouseLeave);
    this.disposers.push(() => {
      this.container.removeEventListener("mouseenter", onMouseEnter);
      this.container.removeEventListener("mousemove", onMouseMove);
      this.container.removeEventListener("mouseleave", onMouseLeave);
    });
  }

  suppress(active: boolean): void {
    this.suppressed = active;
    if (active && this.timeoutId !== undefined) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  dispose(): void {
    if (this.timeoutId !== undefined) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }
}
