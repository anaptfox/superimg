//! Host orchestrator: discover a project, render singles in parallel, batches serially.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RenderEvent } from "@superimg/types";
import { RENDER_EVENT_VERSION } from "@superimg/types";
import type { OutputFormat } from "@superimg/types";
import { PlaywrightEngine } from "@superimg/node/internal";
import { discoverVideos } from "../cli/utils/discover-videos.js";
import { deriveVideoName } from "../cli/utils/resolve-output-path.js";
import { loadCascadingConfig } from "../cli/utils/config-loader.js";
import { parseTemplate } from "../cli/utils/template-config.js";
import { resolveRenderTargets } from "../cli/commands/render-targets.js";
import { executeRenderTargets } from "../cli/commands/render-execute.js";
import { renderVideo } from "../render-video.js";
import { renderBatch } from "../render-batch.js";
import { discoverBatchSources } from "./discover.js";
import { fingerprint, RenderCache } from "./cache.js";
import { defaultOutputFormat, formatToExtension, inferMediaKind } from "./kind.js";

export interface RenderProjectOptions {
  projectRoot: string;
  outDir: string;
  /** Max concurrent single-template renders (default 2). */
  concurrency?: number;
  /** Per-template timeout in milliseconds (optional). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

function contentHash(filePath: string): string | undefined {
  try {
    return createHash("sha256")
      .update(readFileSync(filePath))
      .digest("hex")
      .slice(0, 12);
  } catch {
    return undefined;
  }
}

function errorEvent(name: string, err: unknown, format?: OutputFormat): RenderEvent {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  return {
    v: RENDER_EVENT_VERSION,
    event: "error",
    name,
    message,
    ...(format !== undefined ? { format } : {}),
    ...(stack !== undefined ? { stack } : {}),
  };
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`)),
        timeoutMs,
      );
    }),
  ]).finally(() => clearTimeout(timer!));
}

async function templateMeta(entrypoint: string, projectRoot: string) {
  const cascading = await loadCascadingConfig(entrypoint, projectRoot);
  const parsed = await parseTemplate(entrypoint, { cascadingConfig: cascading });
  const outputs = parsed.templateConfig?.outputs;
  const hasOutputs = !!outputs && Object.keys(outputs).length > 0;
  const kind = inferMediaKind(parsed.medium, parsed.animated, parsed.templateConfig);
  const format = defaultOutputFormat(kind);
  return { parsed, cascading, hasOutputs, kind, format };
}

/**
 * Render every `*.media.ts` template under `projectRoot` into `outDir`.
 * Yields versioned `RenderEvent` lines; the final event is always `summary`.
 */
export async function* renderProject(
  options: RenderProjectOptions,
): AsyncGenerator<RenderEvent> {
  const projectRoot = resolve(options.projectRoot);
  const outDir = resolve(options.outDir);
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const timeoutMs = options.timeoutMs;

  const cache = new RenderCache(outDir);
  const cacheKeys: string[] = [];
  const byFormat: Partial<Record<OutputFormat, number>> = {};
  let rendered = 0;
  let skipped = 0;
  let failed = 0;

  let batchSources;
  try {
    batchSources = await discoverBatchSources(projectRoot);
  } catch (err) {
    yield {
      v: RENDER_EVENT_VERSION,
      event: "fatal",
      message: err instanceof Error ? err.message : String(err),
      ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
    };
    return;
  }

  const batchByEntry = new Map(batchSources.map((b) => [b.entrypoint, b.batch]));
  const rawItems = discoverVideos(projectRoot);

  type SingleJob = {
    entrypoint: string;
    shortName: string;
    hasOutputs: boolean;
    format: OutputFormat;
  };

  const singleJobs: SingleJob[] = [];
  for (const item of rawItems) {
    if (batchByEntry.has(item.entrypoint)) continue;
    try {
      const meta = await templateMeta(item.entrypoint, projectRoot);
      singleJobs.push({
        entrypoint: item.entrypoint,
        shortName: item.shortName,
        hasOutputs: meta.hasOutputs,
        format: meta.format,
      });
    } catch (err) {
      failed++;
      yield errorEvent(item.shortName, err);
    }
  }

  // --- Parallel singles (preset and default paths share one pool) ---
  const queue = [...singleJobs];
  const engines: PlaywrightEngine[] = [];
  const active = new Map<Promise<void>, PlaywrightEngine>();
  const eventQueue: RenderEvent[] = [];
  let resolveWait: (() => void) | null = null;
  const signalWait = () => {
    resolveWait?.();
    resolveWait = null;
  };
  const push = (e: RenderEvent) => {
    eventQueue.push(e);
    signalWait();
  };
  const wait = () => new Promise<void>((r) => {
    resolveWait = r;
  });

  function flushEvents(): RenderEvent[] {
    const out = eventQueue.splice(0, eventQueue.length);
    return out;
  }

  async function runSingle(job: SingleJob, engine?: PlaywrightEngine): Promise<void> {
    const { entrypoint, shortName, hasOutputs, format } = job;
    const ext = formatToExtension(format);
    const key = `item:${entrypoint}`;
    cacheKeys.push(key);

    let outputPaths: string[];
    if (hasOutputs) {
      const resolved = await resolveRenderTargets(
        entrypoint,
        { output: `${outDir}/`, presets: true },
        format,
      );
      outputPaths = resolved.targets.map((t) => t.outputPath);
    } else {
      outputPaths = [join(outDir, `${shortName}.${ext}`)];
    }

    const fp = await fingerprint(entrypoint);
    if (cache.isFresh(key, fp, outputPaths)) {
      skipped++;
      for (const p of outputPaths) {
        const base = p.split("/").pop()?.replace(/\.[^.]+$/, "") ?? shortName;
        const hash = contentHash(p);
        push({
          v: RENDER_EVENT_VERSION,
          event: "skipped",
          name: base,
          format,
          reason: "fingerprint unchanged",
          fingerprint: fp,
          ...(hash !== undefined ? { contentHash: hash } : {}),
        });
      }
      return;
    }

    push({
      v: RENDER_EVENT_VERSION,
      event: "start",
      name: shortName,
      entrypoint,
      format,
    });

    const startMs = Date.now();
    try {
      if (hasOutputs) {
        const resolved = await resolveRenderTargets(
          entrypoint,
          { output: `${outDir}/`, presets: true },
          format,
        );
        await withTimeout(
          executeRenderTargets({
            resolved,
            options: { output: `${outDir}/`, presets: true },
            onProgress: (target, p) => {
              push({
                v: RENDER_EVENT_VERSION,
                event: "progress",
                name: target.entryLabel ? `${shortName}-${target.entryLabel}` : shortName,
                frame: p.frame,
                totalFrames: p.totalFrames,
              });
            },
            onTargetComplete: (target) => {
              byFormat[target.format ?? format] = (byFormat[target.format ?? format] ?? 0) + 1;
              rendered++;
              push({
                v: RENDER_EVENT_VERSION,
                event: "done",
                name: target.entryLabel ? `${shortName}-${target.entryLabel}-${target.name}` : `${shortName}-${target.name}`,
                outputPath: target.outputPath,
                format: target.format ?? format,
                durationMs: Date.now() - startMs,
                contentHash: contentHash(target.outputPath),
              } as RenderEvent);
            },
          }),
          shortName,
          timeoutMs,
        );
      } else {
        const output = outputPaths[0]!;
        const encoding = format === "gif" ? { format: "gif" as const } : { format };
        await withTimeout(
          renderVideo(entrypoint, {
            output,
            encoding,
            ...(engine !== undefined ? { engine } : {}),
            onProgress: (frame, totalFrames) => {
              push({
                v: RENDER_EVENT_VERSION,
                event: "progress",
                name: shortName,
                frame,
                totalFrames,
              });
            },
          }),
          shortName,
          timeoutMs,
        );
        byFormat[format] = (byFormat[format] ?? 0) + 1;
        rendered++;
        push({
          v: RENDER_EVENT_VERSION,
          event: "done",
          name: shortName,
          outputPath: output,
          format,
          durationMs: Date.now() - startMs,
          contentHash: contentHash(output),
        } as RenderEvent);
      }
      cache.set(key, fp);
    } catch (err) {
      failed++;
      push(errorEvent(shortName, err, format));
    }
  }

  if (singleJobs.length > 0 && !(options.signal?.aborted)) {
    const needsBrowser = await Promise.all(
      singleJobs.map(async (j) => {
        try {
          const meta = await templateMeta(j.entrypoint, projectRoot);
          return meta.parsed.medium !== "svg";
        } catch {
          return true;
        }
      }),
    );
    const browserCount = needsBrowser.filter(Boolean).length;
    const poolSize = Math.min(concurrency, Math.max(1, browserCount));

    for (let i = 0; i < poolSize; i++) {
      const engine = new PlaywrightEngine({ perRenderContext: true });
      await engine.init();
      engines.push(engine);
    }

    let qi = 0;
    const refill = (engine: PlaywrightEngine) => {
      if (qi >= queue.length || options.signal?.aborted) return;
      const job = queue[qi++]!;
      const needsEng = needsBrowser[singleJobs.indexOf(job)];
      const p = runSingle(job, needsEng ? engine : undefined)
        .then(() => {
          active.delete(p);
          refill(engine);
          signalWait();
        })
        .catch(() => {
          active.delete(p);
          refill(engine);
          signalWait();
        });
      active.set(p, engine);
    };

    for (let i = 0; i < Math.min(poolSize, queue.length); i++) {
      refill(engines[i]!);
    }

    while (active.size > 0 || eventQueue.length > 0) {
      for (const e of flushEvents()) yield e;
      if (active.size > 0) await wait();
    }
    for (const e of flushEvents()) yield e;

    await Promise.allSettled(engines.map((e) => e.dispose()));
  }

  // --- Batch templates (serial — renderBatch owns its engine) ---
  for (const { entrypoint, batch } of batchSources) {
    const stem = deriveVideoName(entrypoint);
    const key = `batch:${entrypoint}`;
    cacheKeys.push(key);

    let meta;
    try {
      meta = await templateMeta(entrypoint, projectRoot);
    } catch (err) {
      failed++;
      yield errorEvent(stem, err);
      continue;
    }

    const { hasOutputs, format } = meta;
    const ext = formatToExtension(format);

    let entries;
    try {
      entries = await batch();
    } catch (err) {
      failed++;
      yield errorEvent(stem, err, format);
      continue;
    }

    let outputPaths: string[];
    if (hasOutputs) {
      const resolved = await resolveRenderTargets(
        entrypoint,
        { output: `${outDir}/`, presets: true, batchEntries: entries },
        format,
      );
      outputPaths = resolved.targets.map((t) => t.outputPath);
    } else {
      outputPaths = entries.map((e) => join(outDir, `${stem}-${e.slug}.${ext}`));
    }

    const fp = await fingerprint(entrypoint, entries);
    if (cache.isFresh(key, fp, outputPaths)) {
      skipped += entries.length;
      for (const e of entries) {
        const name = `${stem}-${e.slug}`;
        const first = hasOutputs
          ? outputPaths.find((p) => p.includes(`${stem}-${e.slug}`)) ?? outputPaths[0]!
          : join(outDir, `${name}.${ext}`);
        yield {
          v: RENDER_EVENT_VERSION,
          event: "skipped",
          name,
          format,
          reason: "fingerprint unchanged",
          fingerprint: fp,
          contentHash: contentHash(first),
        } as RenderEvent;
      }
      continue;
    }

    const batchEvents: RenderEvent[] = [];
    try {
      const batchStartMs = Date.now();
      const results = await withTimeout(
        renderBatch(entrypoint, {
          dataset: entries,
          output: outDir,
          ...(hasOutputs ? { presets: true } : {}),
          encoding: format === "gif" ? { format: "gif" } : { format },
          onProgress: (ev) => {
            const slug = entries[ev.entryIndex]?.slug ?? String(ev.entryIndex);
            batchEvents.push({
              v: RENDER_EVENT_VERSION,
              event: "progress",
              name: `${stem}-${slug}`,
              frame: ev.progress.frame,
              totalFrames: ev.progress.totalFrames,
            });
          },
        }),
        stem,
        timeoutMs,
      );

      for (const ev of batchEvents) yield ev;

      for (const res of results) {
        const name = `${stem}-${res.entry.slug}`;
        for (const out of res.outputs) {
          byFormat[format] = (byFormat[format] ?? 0) + 1;
          rendered++;
          yield {
            v: RENDER_EVENT_VERSION,
            event: "done",
            name: out.name === "default" ? name : `${name}-${out.name}`,
            outputPath: out.outputPath,
            format,
            durationMs: Math.round((Date.now() - batchStartMs) / Math.max(1, results.length)),
            contentHash: contentHash(out.outputPath),
          } as RenderEvent;
        }
      }
      cache.set(key, fp);
    } catch (err) {
      failed += entries.length;
      yield errorEvent(stem, err, format);
    }
  }

  cache.prune(cacheKeys);
  cache.save();

  yield {
    v: RENDER_EVENT_VERSION,
    event: "summary",
    rendered,
    skipped,
    failed,
    byFormat,
  };
}