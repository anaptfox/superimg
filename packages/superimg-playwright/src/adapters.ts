//! Playwright adapters implementing FrameRenderer and VideoEncoder contracts

import type { Page } from "playwright";
import type { FrameRendererConfig, VideoEncoderConfig, FrameRenderer, VideoEncoder } from "@superimg/types";
import { buildPageShell, resolveAudio } from "@superimg/core";

/**
 * Playwright-based frame renderer.
 * Captures HTML to PNG buffer via browser screenshot.
 */
export class PlaywrightFrameRenderer implements FrameRenderer<Buffer> {
  private width = 0;
  private height = 0;

  constructor(private readonly page: Page) {}

  async init(config: FrameRendererConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;
    await this.page.setViewportSize({ width: config.width, height: config.height });
    const shell = buildPageShell({
      fonts: config.fonts ?? [],
      inlineCss: config.inlineCss ?? [],
      stylesheets: config.stylesheets ?? [],
    });
    await this.page.setContent(shell, { waitUntil: "load" });
    await this.page.evaluate(() => document.fonts.ready);
  }

  async captureFrame(html: string, options?: { alpha?: boolean }): Promise<Buffer> {
    await this.page.evaluate(
      (h: string) => {
        const el = document.getElementById("frame");
        if (el) el.innerHTML = h;
      },
      html
    );
    await this.page.evaluate(() => document.fonts.ready);

    const png = await this.page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: this.width, height: this.height },
      omitBackground: options?.alpha === true,
    });

    return Buffer.isBuffer(png) ? png : Buffer.from(png);
  }

  async dispose(): Promise<void> {
    // No-op
  }
}

/**
 * Playwright-based video encoder.
 * Uses browser harness (BrowserEncoder) to encode frames to video.
 */
export class PlaywrightVideoEncoder implements VideoEncoder<Buffer> {
  private width = 0;
  private height = 0;

  constructor(private readonly page: Page) {}

  async init(config: VideoEncoderConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;

    const encoderConfig: Record<string, unknown> = {
      width: config.width,
      height: config.height,
      fps: config.fps,
      encoding: config.encoding,
    };
    if (config.audio) {
      const resolved = resolveAudio(config.audio);
      encoderConfig.audio = resolved;
    }

    await this.page.evaluate(
      async (cfg: Record<string, unknown>) => {
        await (window as unknown as { __superimg: { initEncoder: (c: unknown) => Promise<void> } }).__superimg.initEncoder(cfg);
      },
      encoderConfig
    );
  }

  async addFrame(frame: Buffer, timestamp: number): Promise<void> {
    const b64 = frame.toString("base64");
    await this.page.evaluate(
      async (args: { b64: string; ts: number }) => {
        await (window as unknown as { __superimg: { addFrame: (b64: string, ts: number) => Promise<void> } }).__superimg.addFrame(args.b64, args.ts);
      },
      { b64, ts: timestamp }
    );
  }

  async finalize(): Promise<Uint8Array> {
    const result = await this.page.evaluate(async () => {
      return await (window as unknown as { __superimg: { finalize: () => Promise<Uint8Array> } }).__superimg.finalize();
    });
    return new Uint8Array(result);
  }

  async dispose(): Promise<void> {
    // No-op
  }
}
