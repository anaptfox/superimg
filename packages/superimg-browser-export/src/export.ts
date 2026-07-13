import type {
  EncodingOptions,
  RenderExecutionOptions,
  ResolvedAudioTimeline,
} from "@superimg/types";
import {
  createLinkedExecutionSignal,
  raceWithExecution,
  throwIfExecutionCancelled,
} from "@superimg/types";
import { BrowserEncoder } from "./encoder.js";
import { get2DContext } from "./utils.js";

export interface ExportConfig {
  fps: number;
  width: number;
  height: number;
  duration: number;
  resolvedAudio?: ResolvedAudioTimeline | null;
  encoding?: EncodingOptions;
}

export interface ExportOptions extends RenderExecutionOptions {
  onProgress?: (frame: number, totalFrames: number) => void;
  onStatusChange?: (message: string) => void;
  /** Yield to the browser after this many frames. Default: 1. */
  yieldEveryFrames?: number;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function exportImageDataToVideo(
  config: ExportConfig,
  captureFrame: (frame: number) => Promise<ImageData>,
  options: ExportOptions = {},
): Promise<Blob> {
  const execution = createLinkedExecutionSignal(options);
  const executionOptions: RenderExecutionOptions = {
    signal: execution.signal,
    ...(execution.deadlineMs !== undefined ? { deadlineMs: execution.deadlineMs } : {}),
  };
  const totalFrames = Math.floor(config.duration * config.fps);
  if (totalFrames <= 0) {
    execution.dispose();
    throw new Error("Export duration is too short to generate frames");
  }

  try {
    throwIfExecutionCancelled(executionOptions);
  } catch (error) {
    execution.dispose();
    throw error;
  }
  const encoder = new BrowserEncoder(config.width, config.height, config.fps, config.encoding);
  let complete = false;
  try {
    if (config.resolvedAudio?.clips.length) {
      options.onStatusChange?.("Loading audio...");
      await encoder.setResolvedAudio(config.resolvedAudio, executionOptions);
    }

    options.onStatusChange?.("Rendering frames...");
    const yieldEvery = Math.max(1, Math.floor(options.yieldEveryFrames ?? 1));
    let pendingCapture: Promise<ImageData> = raceWithExecution(
      captureFrame(0),
      executionOptions,
    );
    // A look-ahead capture can outlive an encode failure. Attach a rejection
    // observer immediately so cancellation/error cleanup never leaks an
    // unhandled rejection from that abandoned promise.
    pendingCapture.catch(() => undefined);
    let pendingEncode: { frame: number; promise: Promise<void> } | null = null;

    const flushEncode = async () => {
      if (!pendingEncode) return;
      const { promise } = pendingEncode;
      pendingEncode = null;
      await raceWithExecution(promise, executionOptions);
    };

    for (let frame = 0; frame < totalFrames; frame += 1) {
      throwIfExecutionCancelled(executionOptions);
      const imageData = await pendingCapture;

      if (frame + 1 < totalFrames) {
        pendingCapture = raceWithExecution(captureFrame(frame + 1), executionOptions);
        pendingCapture.catch(() => undefined);
      }

      // Capture N+1 is already running while we wait for encode N-1. At most
      // two ImageData buffers are retained and encoder writes stay ordered.
      await flushEncode();
      pendingEncode = {
        frame,
        promise: encoder.addFrame(imageData, frame / config.fps, executionOptions),
      };
      options.onProgress?.(frame + 1, totalFrames);
      if ((frame + 1) % yieldEvery === 0) {
        await raceWithExecution(yieldToBrowser(), executionOptions);
      }
    }
    await flushEncode();

    options.onStatusChange?.("Finalizing video...");
    const blob = await encoder.finalize(executionOptions);
    complete = true;
    return blob;
  } finally {
    if (!complete) await encoder.cancel();
    execution.dispose();
  }
}

export async function exportToVideo(
  canvas: HTMLCanvasElement,
  config: ExportConfig,
  renderFrame: (frame: number) => Promise<void>,
  options: ExportOptions = {},
): Promise<Blob> {
  const ctx = get2DContext(canvas);
  return exportImageDataToVideo(config, async (frame) => {
    await renderFrame(frame);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, options);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
