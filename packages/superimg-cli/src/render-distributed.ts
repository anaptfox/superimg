//! Distributed chunk rendering orchestrator.
//! Splits a video into time-range chunks, renders each chunk on a remote
//! container endpoint in parallel, then stitches the results with ffmpeg.

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { execa } from "execa";
import type {
  EncodingOptions,
  AudioValue,
  RenderExecutionOptions,
} from "@superimg/types";
import {
  createLinkedExecutionSignal,
  throwIfExecutionCancelled,
} from "@superimg/types";
import { listAudioSrcPaths } from "./utils/prepare-assets.js";
import { mapBounded } from "./utils/bounded-pool.js";

export interface DistributedRenderOptions extends RenderExecutionOptions {
  /** Container endpoint URLs. Chunks are distributed round-robin. */
  endpoints: string[];
  /** Template name as registered in the container manifest. */
  templateName: string;
  /** Optional data overrides passed to each chunk render. */
  data?: Record<string, unknown>;
  /** Encoding options (format, codec, bitrate). Audio is stripped per-chunk and muxed post-stitch. */
  encoding?: EncodingOptions;
  /** Audio to mux into the final stitched output. Rendered separately, not per-chunk. */
  audio?: AudioValue;
  /** Absolute path where the final MP4 is written. */
  outputPath: string;
  /** Target duration per chunk in seconds. Default: 10. */
  chunkSeconds?: number;
  /** Called after each chunk completes. */
  onProgress?: (chunksComplete: number, totalChunks: number) => void;
  /** Concurrent requests allowed per endpoint. Default: 1. */
  perEndpointConcurrency?: number;
  /** Maximum generated chunks. Default: 1,000. */
  maxChunks?: number;
  /** Maximum bytes accepted for one chunk response. Default: 512 MiB. */
  maxChunkBytes?: number;
}

interface TemplateInfo {
  totalFrames: number;
  fps: number;
  durationSeconds: number;
  width: number;
  height: number;
}

async function readErrorBody(response: Response, maximumBytes = 16_384): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < maximumBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maximumBytes - size;
      chunks.push(value.subarray(0, remaining));
      size += Math.min(value.byteLength, remaining);
      if (value.byteLength > remaining) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchTemplateInfo(
  endpoint: string,
  templateName: string,
  signal: AbortSignal,
): Promise<TemplateInfo> {
  const url = `${endpoint.replace(/\/$/, "")}/info/${encodeURIComponent(templateName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await readErrorBody(res).catch(() => "");
    throw new Error(`GET /info/${templateName} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<TemplateInfo>;
}

async function renderChunkToFile(
  endpoint: string,
  opts: {
    templateName: string;
    data?: Record<string, unknown>;
    encoding?: EncodingOptions;
    startFrame: number;
    endFrame: number;
    outputPath: string;
    maxBytes: number;
    signal: AbortSignal;
  }
): Promise<number> {
  const url = `${endpoint.replace(/\/$/, "")}/render`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template: opts.templateName,
      data: opts.data,
      encoding: opts.encoding,
      startFrame: opts.startFrame,
      endFrame: opts.endFrame,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await readErrorBody(res).catch(() => "");
    throw new Error(
      `Chunk [${opts.startFrame}–${opts.endFrame}] failed on ${endpoint} (${res.status}): ${body}`
    );
  }

  if (!res.body) throw new Error("Chunk response did not include a body");
  const reader = res.body.getReader();
  const file = openSync(opts.outputPath, "w");
  let total = 0;
  try {
    while (true) {
      throwIfExecutionCancelled({ signal: opts.signal });
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > opts.maxBytes) {
        await reader.cancel("chunk_too_large");
        throw new Error(`Chunk response exceeds ${opts.maxBytes} bytes`);
      }
      writeSync(file, value);
    }
  } finally {
    closeSync(file);
  }
  return total;
}

/**
 * Render a video in parallel chunks across N container endpoints, then stitch
 * with ffmpeg. The final MP4 is written to `opts.outputPath`.
 *
 * Each endpoint must be a running SuperImg container exposing:
 *   GET  /info/:template  → { totalFrames, fps, durationSeconds, width, height }
 *   POST /render          → MP4 bytes (accepts startFrame/endFrame for chunk mode)
 */
export async function renderDistributed(opts: DistributedRenderOptions): Promise<void> {
  const {
    endpoints,
    templateName,
    data,
    encoding,
    audio,
    outputPath,
    chunkSeconds = 10,
    onProgress,
    perEndpointConcurrency = 1,
    maxChunks = 1_000,
    maxChunkBytes = 536_870_912,
  } = opts;

  const renderEndpoints = [...new Set(endpoints.map((endpoint) => endpoint.trim()).filter(Boolean))];
  if (renderEndpoints.length === 0) throw new Error("renderDistributed: at least one endpoint is required");
  if (!Number.isFinite(chunkSeconds) || chunkSeconds <= 0) {
    throw new Error("renderDistributed: chunkSeconds must be greater than zero");
  }
  if (!Number.isSafeInteger(maxChunks) || maxChunks <= 0) {
    throw new Error("renderDistributed: maxChunks must be a positive integer");
  }
  if (!Number.isFinite(maxChunkBytes) || maxChunkBytes <= 0) {
    throw new Error("renderDistributed: maxChunkBytes must be greater than zero");
  }
  if (!Number.isFinite(perEndpointConcurrency) || perEndpointConcurrency <= 0) {
    throw new Error("renderDistributed: perEndpointConcurrency must be greater than zero");
  }
  const firstEndpoint = renderEndpoints[0];
  if (!firstEndpoint) throw new Error("renderDistributed: at least one endpoint is required");

  // 1. Query template metadata from the first endpoint.
  const execution = createLinkedExecutionSignal(opts);
  const failureController = new AbortController();
  const onExecutionAbort = () => failureController.abort(execution.signal.reason);
  if (execution.signal.aborted) onExecutionAbort();
  else execution.signal.addEventListener("abort", onExecutionAbort, { once: true });

  let info: TemplateInfo;
  try {
    info = await fetchTemplateInfo(firstEndpoint, templateName, execution.signal);
  } catch (error) {
    execution.signal.removeEventListener("abort", onExecutionAbort);
    execution.dispose();
    throw error;
  }
  const { totalFrames, fps } = info;
  if (!Number.isSafeInteger(totalFrames) || totalFrames <= 0 || !Number.isFinite(fps) || fps <= 0) {
    execution.signal.removeEventListener("abort", onExecutionAbort);
    execution.dispose();
    throw new Error("Container returned invalid template frame metadata");
  }

  // 2. Split into chunks.
  const chunkFrames = Math.max(1, Math.round(chunkSeconds * fps));
  const totalChunks = Math.ceil(totalFrames / chunkFrames);
  if (totalChunks > maxChunks) {
    execution.signal.removeEventListener("abort", onExecutionAbort);
    execution.dispose();
    throw new Error(`Distributed render requires ${totalChunks} chunks, exceeding maximum ${maxChunks}`);
  }
  const chunks: Array<{ startFrame: number; endFrame: number; endpoint: string }> = [];
  for (let start = 0; start < totalFrames; start += chunkFrames) {
    const end = Math.min(start + chunkFrames, totalFrames);
    const endpoint = renderEndpoints[chunks.length % renderEndpoints.length];
    if (!endpoint) throw new Error("renderDistributed: endpoint list became empty");
    chunks.push({
      startFrame: start,
      endFrame: end,
      endpoint,
    });
  }

  console.log(
    `[renderDistributed] ${templateName}: ${totalFrames} frames → ${totalChunks} chunks × ${chunkSeconds}s across ${renderEndpoints.length} endpoint(s)`
  );

  // 3. Render all chunks in parallel.
  const id = randomUUID();
  const tempDir = join("/tmp", `superimg-dist-${id}`);
  mkdirSync(tempDir, { recursive: true });
  mkdirSync(dirname(outputPath), { recursive: true });
  const outputExtension = extname(outputPath) || ".mp4";
  const finalTempPath = `${outputPath}.superimg-${id}.tmp${outputExtension}`;

  let chunksComplete = 0;
  const chunkPaths = new Array<string>(totalChunks);

  try {
    const indexedChunks = chunks.map((chunk, index) => ({ ...chunk, index }));
    const groups = renderEndpoints.map((endpoint) => indexedChunks.filter((chunk) => chunk.endpoint === endpoint));
    await Promise.all(groups.map(async (group) => {
      if (group.length === 0) return;
      try {
        await mapBounded(group, {
          concurrency: Math.max(1, Math.floor(perEndpointConcurrency)),
          stopOnError: true,
          signal: failureController.signal,
          ...(opts.deadlineMs !== undefined ? { deadlineMs: opts.deadlineMs } : {}),
        }, async (chunk, _groupIndex, _workerIndex, workerSignal) => {
        const chunkPath = join(tempDir, `chunk_${String(chunk.index).padStart(5, "0")}.mp4`);
        const bytesWritten = await renderChunkToFile(chunk.endpoint, {
          templateName,
          startFrame: chunk.startFrame,
          endFrame: chunk.endFrame,
          outputPath: chunkPath,
          maxBytes: maxChunkBytes,
          signal: workerSignal,
          ...(data !== undefined ? { data } : {}),
          ...(encoding !== undefined ? { encoding } : {}),
        });
        chunkPaths[chunk.index] = chunkPath;
        chunksComplete++;
        onProgress?.(chunksComplete, totalChunks);
        console.log(`[renderDistributed] chunk ${chunk.index + 1}/${totalChunks} done (${bytesWritten} bytes)`);
        });
      } catch (error) {
        failureController.abort(error);
        throw error;
      }
    }));

    // 4. Write ffmpeg concat list (chunks already in order by index).
    const concatList = chunkPaths.map((p) => `file '${p}'`).join("\n");
    const concatListPath = join(tempDir, "concat.txt");
    writeFileSync(concatListPath, concatList);

    // 5. Concat chunks (stream copy — no re-encode).
    const videoOnlyPath = audio ? join(tempDir, "video_only.mp4") : finalTempPath;
    await execa("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c", "copy",
      videoOnlyPath,
    ], { cancelSignal: execution.signal, forceKillAfterDelay: 2_000 });

    // 6. Mux audio if provided.
    if (audio) {
      const paths = listAudioSrcPaths(audio);
      if (paths.length !== 1) {
        throw new Error(
          "renderDistributed supports single-clip audio mux only; use standard render for multi-track timelines",
        );
      }
      const audioPath = paths[0];
      if (!audioPath) throw new Error("renderDistributed: audio clip must have a local file path");
      await execa("ffmpeg", [
        "-y",
        "-i", videoOnlyPath,
        "-i", audioPath,
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        finalTempPath,
      ], { cancelSignal: execution.signal, forceKillAfterDelay: 2_000 });
    }

    throwIfExecutionCancelled({ signal: execution.signal, deadlineMs: opts.deadlineMs });
    renameSync(finalTempPath, outputPath);
    console.log(`[renderDistributed] done → ${outputPath}`);
  } finally {
    // Clean up temp directory.
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    rmSync(finalTempPath, { force: true });
    execution.signal.removeEventListener("abort", onExecutionAbort);
    execution.dispose();
  }
}
