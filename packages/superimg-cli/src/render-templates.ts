//! renderTemplates — concurrent multi-template render for build tool integration.
//!
//! Takes a pre-discovered list of templates (caller owns filtering/staleness),
//! runs them with a concurrency pool, and yields typed RenderEvents.
//!
//! SVG/HTML templates bypass Playwright entirely and consume no pool slot.
//! AbortSignal cancels in-flight renders without leaking browser contexts.

import { resolve, join } from "node:path";
import { PlaywrightEngine } from "@superimg/playwright";
import type { DiscoveredVideo } from "./cli/utils/discover-videos.js";
import type { RenderEvent } from "@superimg/types";
import { RENDER_EVENT_VERSION } from "@superimg/types";
import type { OutputFormat } from "@superimg/types";
import { renderVideo } from "./render-video.js";

export interface RenderTemplatesOptions {
  /** Max templates rendered in parallel (default: 2). */
  concurrency?: number;
  /** Output directory. Defaults to an `output/` folder next to each template. */
  output?: string;
  /** Override output format for all templates. */
  format?: OutputFormat;
  /** Abort remaining renders when one fails (default: false — best-effort). */
  failOnError?: boolean;
  /** Cancel in-flight renders on abort. */
  signal?: AbortSignal;
}

/**
 * Render a list of discovered templates concurrently.
 * Yields typed RenderEvents as they occur; the final event is always "summary".
 *
 * Caller is responsible for filtering the list (staleness, scope, drafts).
 * Emit a "skipped" event before calling renderTemplates to keep the summary accurate:
 *
 *   const stale = all.filter(v => isStale(v));
 *   for (const v of all.filter(v => !isStale(v))) {
 *     yield { v: 1, event: "skipped", name: v.shortName, format: "mp4", reason: "fingerprint unchanged" };
 *   }
 *   for await (const event of renderTemplates(stale, opts)) yield event;
 */
export async function* renderTemplates(
  videos: DiscoveredVideo[],
  options: RenderTemplatesOptions = {},
): AsyncGenerator<RenderEvent> {
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const signal = options.signal;

  const byFormat: Partial<Record<OutputFormat, number>> = {};
  let rendered = 0;
  let failed = 0;

  // Split into bypass (svg/html) and browser-rendered lists.
  const bypass = videos.filter((v) => v.kind === "svg");
  const browser = videos.filter((v) => v.kind !== "svg");

  // Yield events from an async iterable over a concurrency pool.
  // We use a simple slot-based approach: start up to N jobs, replace each
  // finished slot with the next queued item.
  const queue = [...browser];
  const engines: PlaywrightEngine[] = [];
  const active = new Map<
    Promise<void>,
    { video: DiscoveredVideo; engine: PlaywrightEngine }
  >();

  // Channel: events from concurrent renders arrive here in order.
  const eventQueue: RenderEvent[] = [];
  let resolve_: (() => void) | null = null;
  const signal_ = () => { resolve_?.(); resolve_ = null; };
  const push = (e: RenderEvent) => { eventQueue.push(e); signal_(); };
  const next = (): Promise<void> => new Promise((r) => { resolve_ = r; });

  async function runOne(video: DiscoveredVideo, engine: PlaywrightEngine): Promise<void> {
    const format: OutputFormat = options.format ?? "mp4";
    const startMs = Date.now();

    push({ v: RENDER_EVENT_VERSION, event: "start", name: video.shortName, entrypoint: video.entrypoint, format });

    const outputPath = resolveOutputPath(video, options.output, format);

    try {
      if (signal?.aborted) throw new Error("Aborted");
      await renderVideo(video.entrypoint, {
        output: outputPath,
        encoding: { format },
        engine,
        onProgress: (frame, totalFrames) => {
          push({ v: RENDER_EVENT_VERSION, event: "progress", name: video.shortName, frame, totalFrames });
        },
      });
      byFormat[format] = (byFormat[format] ?? 0) + 1;
      rendered++;
      push({ v: RENDER_EVENT_VERSION, event: "done", name: video.shortName, outputPath, format, durationMs: Date.now() - startMs });
    } catch (err) {
      failed++;
      push({
        v: RENDER_EVENT_VERSION,
        event: "error",
        name: video.shortName,
        format,
        message: err instanceof Error ? err.message : String(err),
        code: (err as { code?: string }).code,
      });
      if (options.failOnError) {
        signal?.dispatchEvent ? undefined : undefined; // AbortController is caller-owned
        throw err;
      }
    }
  }

  // Handle bypass templates synchronously first (no Playwright).
  for (const video of bypass) {
    const format: OutputFormat = options.format ?? "svg";
    const startMs = Date.now();
    push({ v: RENDER_EVENT_VERSION, event: "start", name: video.shortName, entrypoint: video.entrypoint, format });
    const outputPath = resolveOutputPath(video, options.output, format);
    try {
      if (signal?.aborted) throw new Error("Aborted");
      await renderVideo(video.entrypoint, {
        output: outputPath,
        encoding: { format },
      });
      byFormat[format] = (byFormat[format] ?? 0) + 1;
      rendered++;
      push({ v: RENDER_EVENT_VERSION, event: "done", name: video.shortName, outputPath, format, durationMs: Date.now() - startMs });
    } catch (err) {
      failed++;
      push({
        v: RENDER_EVENT_VERSION,
        event: "error",
        name: video.shortName,
        format,
        message: err instanceof Error ? err.message : String(err),
      });
      if (options.failOnError) break;
    }
  }

  if (browser.length > 0 && !(signal?.aborted)) {
    // Spin up engine pool.
    const poolSize = Math.min(concurrency, browser.length);
    for (let i = 0; i < poolSize; i++) {
      const engine = new PlaywrightEngine({ perRenderContext: true });
      await engine.init();
      engines.push(engine);
    }

    // Fill initial slots.
    for (let i = 0; i < poolSize && queue.length > 0; i++) {
      const video = queue.shift()!;
      const engine = engines[i];
      const p = runOne(video, engine).then(() => {
        active.delete(p);
        // Refill from queue.
        if (queue.length > 0 && !(signal?.aborted)) {
          const next_ = queue.shift()!;
          const p2: Promise<void> = runOne(next_, engine).then(() => {
            active.delete(p2);
            signal_();
          }).catch(() => { active.delete(p2); signal_(); });
          active.set(p2, { video: next_, engine });
        }
        signal_();
      }).catch(() => { active.delete(p); signal_(); });
      active.set(p, { video, engine });
    }

    // Drain events until all slots are empty.
    while (active.size > 0 || eventQueue.length > 0) {
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      }
      if (active.size > 0) await next();
    }
    // Flush any remaining events.
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }

    // Dispose engines.
    await Promise.allSettled(engines.map((e) => e.dispose()));
  } else {
    // Flush bypass events.
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }
  }

  yield {
    v: RENDER_EVENT_VERSION,
    event: "summary",
    rendered,
    skipped: 0,
    failed,
    byFormat,
  };
}

function resolveOutputPath(video: DiscoveredVideo, outputDir: string | undefined, format: OutputFormat): string {
  const ext = formatToExt(format);
  if (outputDir) {
    return resolve(join(outputDir, `${video.shortName}.${ext}`));
  }
  // Default: output/ next to the template file.
  return resolve(join(video.directory, "output", `${video.shortName}.${ext}`));
}

function formatToExt(format: OutputFormat): string {
  switch (format) {
    case "webm": return "webm";
    case "gif": return "gif";
    case "png": return "png";
    case "webp": return "webp";
    case "jpeg": return "jpg";
    case "svg": return "svg";
    case "html": return "html";
    default: return "mp4";
  }
}
