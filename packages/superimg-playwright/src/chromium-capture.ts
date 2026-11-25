import type { CDPSession, Page } from "playwright";

export interface ChromiumCaptureOptions {
  readonly region: { x: number; y: number; width: number; height: number };
  readonly format: "png" | "jpeg";
  readonly jpegQuality: number;
  readonly alpha: boolean;
  readonly scale: "css" | "device";
  /** Capture density owned by the renderer; do not infer it after CDP capture. */
  readonly dpr: number;
  /** Null preserves frame-mode suppression; a number samples CSS/WAAPI exactly. */
  readonly animationTimeMs: number | null;
}

/** Chromium's lossless fast-PNG path, owned per renderer (no Playwright internals). */
export class ChromiumCapture {
  private session: Promise<CDPSession> | undefined;

  constructor(private readonly page: Page) {}

  async sampleAnimations(animationTimeMs: number | null): Promise<void> {
    await this.page.evaluate(prepareCaptureInPage, { animationTimeMs, hideCaret: false });
  }

  async capture(options: ChromiumCaptureOptions): Promise<Buffer> {
    const cdp = await (this.session ??= this.page.context().newCDPSession(this.page));
    // Pausing and seeking animations keeps compositor time out of the result.
    // In particular, do not use screenshot animations:"disabled" in animation mode:
    // that finishes finite animations and rewinds infinite ones.
    await this.page.evaluate(prepareCaptureInPage, { animationTimeMs: options.animationTimeMs, hideCaret: true });
    try {
      if (options.alpha) {
        await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
      }
      const { cssVisualViewport } = await cdp.send("Page.getLayoutMetrics");
      const { region } = options;
      const result = await cdp.send("Page.captureScreenshot", {
        format: options.format,
        ...(options.format === "jpeg" ? { quality: options.jpegQuality } : {}),
        optimizeForSpeed: options.format === "png",
        fromSurface: true,
        captureBeyondViewport: false,
        clip: {
          x: cssVisualViewport.pageX + region.x,
          y: cssVisualViewport.pageY + region.y,
          width: region.width,
          height: region.height,
          // This is a separate CDP session, not Playwright's emulation session:
          // captureScreenshot's scale is explicitly owned here in output pixels.
          scale: options.scale === "device" ? options.dpr : 1,
        },
      });
      return Buffer.from(result.data, "base64");
    } finally {
      // A canceled capture discards its page. Otherwise return the shared page to
      // a neutral background/caret state before the next renderer can use it.
      await Promise.allSettled([
        ...(options.alpha ? [cdp.send("Emulation.setDefaultBackgroundColorOverride", {})] : []),
        this.page.evaluate(() => {
          for (const style of document.querySelectorAll("style[data-superimg-capture-caret]")) style.remove();
        }),
      ]);
    }
  }

  async dispose(): Promise<void> {
    const session = this.session;
    this.session = undefined;
    if (session) await session.then((cdp) => cdp.detach()).catch(() => undefined);
  }
}

/** Self-contained page payload; also works after a reverse or nonzero first seek. */
async function prepareCaptureInPage(options: { animationTimeMs: number | null; hideCaret: boolean }): Promise<number> {
  if (options.hideCaret) {
    const style = document.createElement("style");
    style.setAttribute("data-superimg-capture-caret", "");
    style.textContent = "*{caret-color:transparent!important}";
    document.head.appendChild(style);
  }
  // Force style resolution so newly inserted CSS animations exist before seeking.
  void document.documentElement.offsetWidth;
  const animations = document.getAnimations();
  if (options.animationTimeMs === null) {
    // Frame capture follows screenshot suppression: finish finite animations
    // and remove looping effects so their underlying authored styles are used.
    for (const animation of animations) {
      if (!animation.effect || animation.playbackRate === 0) continue;
      if (Number.isFinite(Number(animation.effect.getComputedTiming().endTime))) {
        animation.finish();
      } else {
        animation.cancel();
      }
    }
  } else {
    for (const animation of animations) animation.pause();
    // Wait for a pending pause before seeking the exact authored time.
    await Promise.all(animations.map((animation) => animation.ready.catch(() => undefined)));
    for (const animation of animations) animation.currentTime = options.animationTimeMs;
  }
  void document.documentElement.offsetWidth;
  // Seeking/finishing animations and forcing layout establishes authored state.
  // CDP capture owns the paint fence; wall-clock rAF waits add no resource proof.
  return window.devicePixelRatio || 1;
}
