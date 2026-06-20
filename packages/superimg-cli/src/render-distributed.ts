//! Distributed chunk rendering orchestrator.
//! Splits a video into time-range chunks, renders each chunk on a remote
//! container endpoint in parallel, then stitches the results with ffmpeg.

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import type { EncodingOptions, AudioValue } from "@superimg/types";

export interface DistributedRenderOptions {
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
}

interface TemplateInfo {
  totalFrames: number;
  fps: number;
  durationSeconds: number;
  width: number;
  height: number;
}

async function fetchTemplateInfo(endpoint: string, templateName: string): Promise<TemplateInfo> {
  const url = `${endpoint.replace(/\/$/, "")}/info/${encodeURIComponent(templateName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET /info/${templateName} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<TemplateInfo>;
}

async function renderChunk(
  endpoint: string,
  opts: {
    templateName: string;
    data?: Record<string, unknown>;
    encoding?: EncodingOptions;
    startFrame: number;
    endFrame: number;
  }
): Promise<Uint8Array> {
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
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Chunk [${opts.startFrame}–${opts.endFrame}] failed on ${endpoint} (${res.status}): ${body}`
    );
  }

  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

function resolveAudioPath(audio: AudioValue): string | null {
  if (typeof audio === "string") return audio;
  if (typeof audio === "object" && audio !== null && "src" in audio) {
    return (audio as { src: string }).src;
  }
  return null;
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
  } = opts;

  if (endpoints.length === 0) throw new Error("renderDistributed: at least one endpoint is required");

  // 1. Query template metadata from the first endpoint.
  const info = await fetchTemplateInfo(endpoints[0], templateName);
  const { totalFrames, fps } = info;

  // 2. Split into chunks.
  const chunkFrames = Math.max(1, Math.round(chunkSeconds * fps));
  const chunks: Array<{ startFrame: number; endFrame: number; endpoint: string }> = [];
  for (let start = 0; start < totalFrames; start += chunkFrames) {
    const end = Math.min(start + chunkFrames, totalFrames);
    chunks.push({
      startFrame: start,
      endFrame: end,
      endpoint: endpoints[chunks.length % endpoints.length],
    });
  }

  const totalChunks = chunks.length;
  console.log(
    `[renderDistributed] ${templateName}: ${totalFrames} frames → ${totalChunks} chunks × ${chunkSeconds}s across ${endpoints.length} endpoint(s)`
  );

  // 3. Render all chunks in parallel.
  const tempDir = join("/tmp", `superimg-dist-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  let chunksComplete = 0;
  const chunkPaths = new Array<string>(totalChunks);

  try {
    await Promise.all(
      chunks.map(async (chunk, i) => {
        const bytes = await renderChunk(chunk.endpoint, {
          templateName,
          data,
          encoding,
          startFrame: chunk.startFrame,
          endFrame: chunk.endFrame,
        });
        const chunkPath = join(tempDir, `chunk_${String(i).padStart(5, "0")}.mp4`);
        writeFileSync(chunkPath, bytes);
        chunkPaths[i] = chunkPath;
        chunksComplete++;
        onProgress?.(chunksComplete, totalChunks);
        console.log(`[renderDistributed] chunk ${i + 1}/${totalChunks} done (${bytes.byteLength} bytes)`);
      })
    );

    // 4. Write ffmpeg concat list (chunks already in order by index).
    const concatList = chunkPaths.map((p) => `file '${p}'`).join("\n");
    const concatListPath = join(tempDir, "concat.txt");
    writeFileSync(concatListPath, concatList);

    // 5. Concat chunks (stream copy — no re-encode).
    const videoOnlyPath = audio ? join(tempDir, "video_only.mp4") : outputPath;
    await execa("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c", "copy",
      videoOnlyPath,
    ]);

    // 6. Mux audio if provided.
    if (audio) {
      const audioPath = resolveAudioPath(audio);
      if (!audioPath) throw new Error("renderDistributed: audio.src must be a local file path");
      await execa("ffmpeg", [
        "-y",
        "-i", videoOnlyPath,
        "-i", audioPath,
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        outputPath,
      ]);
    }

    console.log(`[renderDistributed] done → ${outputPath}`);
  } finally {
    // Clean up temp directory.
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
  }
}
