import type { HoverBehavior } from "@superimg/types";
import type { WebRuntime } from "@superimg/runtime-web";

export interface HoverConfig {
  behavior: HoverBehavior;
  delayMs: number;
}

export class HoverController {
  private timeoutId: number | undefined;
  private disposers: Array<() => void> = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly config: HoverConfig,
    private readonly getRuntime: () => WebRuntime | null
  ) {}

  install(): void {
    if (this.config.behavior === "none") return;

    const onMouseEnter = () => {
      if (this.config.behavior !== "play") return;
      this.timeoutId = window.setTimeout(() => this.getRuntime()?.play(), this.config.delayMs);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (this.config.behavior !== "preview-scrub") return;
      const runtime = this.getRuntime();
      if (!runtime) return;
      const rect = this.container.getBoundingClientRect();
      const progress = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
      runtime.seekProgress(progress);
    };

    const onMouseLeave = () => {
      if (this.timeoutId !== undefined) {
        window.clearTimeout(this.timeoutId);
        this.timeoutId = undefined;
      }
      const runtime = this.getRuntime();
      if (!runtime) return;
      runtime.pause();
      if (this.config.behavior !== "none") runtime.seekFrame(0);
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

  dispose(): void {
    if (this.timeoutId !== undefined) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }
}
