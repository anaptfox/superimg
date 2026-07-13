//! renderTemplates — concurrent multi-template render for build tool integration.
//!
//! Takes a pre-discovered list of templates (caller owns filtering/staleness),
//! runs them with a concurrency pool, and yields typed RenderEvents.
//!
//! SVG/HTML templates bypass Playwright entirely and consume no pool slot.
//! AbortSignal cancels in-flight renders without leaking browser contexts.

import { resolve, join } from "node:path";
import { PlaywrightEngine } from "@superimg/node/internal";
import type { DiscoveredVideo } from "./cli/utils/discover-videos.js";
import type { RenderEvent } from "@superimg/types";
import { RENDER_EVENT_VERSION } from "@superimg/types";
import type { OutputFormat } from "@superimg/types";
import { renderVideo } from "./render-video.js";
import { parseTemplate } from "./cli/utils/template-config.js";
import { mapBounded } from "./utils/bounded-pool.js";

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

  // Split into browser-free (svg medium → resvg) and Playwright lists. Medium
  // comes from each template's parsed config, not the filename.
  const media = await mapBounded(
    videos,
    {
      concurrency: Math.min(16, Math.max(concurrency, 4)),
      ...(signal !== undefined ? { signal } : {}),
    },
    async (v) => {
      try {
        return { v, medium: (await parseTemplate(v.entrypoint)).medium };
      } catch {
        return { v, medium: "html" as const };
      }
    },
  );
  const bypass = media.filter((m) => m.medium === "svg").map((m) => m.v);
  const browser = media.filter((m) => m.medium !== "svg").map((m) => m.v);

  // Yield events from an async iterable over a concurrency pool.
  // We use a simple slot-based approach: start up to N jobs, replace each
  // finished slot with the next queued item.
  const engines: PlaywrightEngine[] = [];

  // Channel: events from concurrent renders arrive here in order.
  const eventQueue: RenderEvent[] = [];
  let resolve_: (() => void) | null = null;
  const signal_ = () => { resolve_?.(); resolve_ = null; };
  const push = (e: RenderEvent) => {
    // Keep only the newest pending progress event per template. Terminal and
    // lifecycle events are never dropped.
    if (e.event === "progress") {
      const existing = eventQueue.findIndex(
        (queued) => queued.event === "progress" && queued.name === e.name,
      );
      if (existing >= 0) eventQueue.splice(existing, 1);
    }
    eventQueue.push(e);
    signal_();
  };
  const next = (): Promise<void> => new Promise((r) => { resolve_ = r; });

  async function runOne(
    video: DiscoveredVideo,
    engine: PlaywrightEngine,
    executionSignal: AbortSignal,
  ): Promise<void> {
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
        signal: executionSignal,
        onProgress: (frame, totalFrames) => {
          push({ v: RENDER_EVENT_VERSION, event: "progress", name: video.shortName, frame, totalFrames });
        },
      });
      byFormat[format] = (byFormat[format] ?? 0) + 1;
      rendered++;
      push({ v: RENDER_EVENT_VERSION, event: "done", name: video.shortName, outputPath, format, durationMs: Date.now() - startMs });
    } catch (err) {
      failed++;
      const code = (err as { code?: string }).code;
      push({
        v: RENDER_EVENT_VERSION,
        event: "error",
        name: video.shortName,
        format,
        message: err instanceof Error ? err.message : String(err),
        ...(code !== undefined ? { code } : {}),
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
        ...(signal !== undefined ? { signal } : {}),
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
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
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

    let poolDone = false;
    let poolError: unknown;
    const pool = mapBounded(
      browser,
      {
        concurrency: poolSize,
        stopOnError: options.failOnError ?? false,
        ...(signal !== undefined ? { signal } : {}),
      },
      async (video, _itemIndex, workerIndex, workerSignal) => {
        const engine = engines[workerIndex];
        if (!engine) throw new Error(`Missing render engine for worker ${workerIndex}`);
        await runOne(video, engine, workerSignal);
      },
    ).catch((error) => {
      poolError = error;
    }).finally(() => {
      poolDone = true;
      signal_();
    });

    try {
      while (!poolDone || eventQueue.length > 0) {
        while (eventQueue.length > 0) yield eventQueue.shift()!;
        if (!poolDone) await next();
      }
      await pool;
      if (poolError !== undefined && options.failOnError) throw poolError;
    } finally {
      await Promise.allSettled(engines.map((e) => e.dispose()));
    }
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
