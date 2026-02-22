//! Engine orchestration - create render plans and execute them with pluggable adapters

import type {
  RenderPlan,
  RenderProgress,
  RenderJob,
  FrameRenderer,
  VideoEncoder,
} from "@superimg/types";
import { compileTemplate } from "./compiler.js";
import { createRenderContext } from "./wasm.js";
import { buildCompositeHtml } from "./html.js";

export interface ExecuteRenderPlanCallbacks {
  onProgress?: (progress: RenderProgress) => void;
}

/**
 * Create a render plan from a render job.
 * Pure computation: compile template, collect fonts, calculate total frames.
 */
export function createRenderPlan(job: RenderJob): RenderPlan {
  const {
    templateCode,
    durationSeconds,
    width,
    height,
    fps,
    fonts: globalFonts,
    audio,
    outputName = "default",
    encoding,
    data,
    background,
  } = job;

  // Compile template
  const result = compileTemplate(templateCode);
  if (result.error || !result.template) {
    throw new Error(`Template compilation failed: ${result.error?.message || "Unknown error"}`);
  }
  const template = result.template;

  // Collect fonts
  const fontSet = new Set<string>(globalFonts ?? []);
  if (template.config?.fonts) {
    for (const f of template.config.fonts) fontSet.add(f);
  }
  const fonts = Array.from(fontSet);

  const totalFrames = Math.ceil(durationSeconds * fps);

  return {
    template,
    durationSeconds,
    width,
    height,
    fps,
    totalFrames,
    fonts,
    audio,
    outputName,
    encoding,
    data,
    background,
  };
}

/**
 * Execute a render plan with the given renderer and encoder.
 * Simple frame loop: build context -> render -> capture -> encode.
 */
export async function executeRenderPlan<TFrame>(
  plan: RenderPlan,
  renderer: FrameRenderer<TFrame>,
  encoder: VideoEncoder<TFrame>,
  callbacks?: ExecuteRenderPlanCallbacks
): Promise<Uint8Array> {
  const {
    template,
    width,
    height,
    fps,
    totalFrames,
    fonts,
    outputName,
    encoding,
    data,
    background,
  } = plan;

  await renderer.init({ width, height, fonts });
  await encoder.init({
    width,
    height,
    fps,
    encoding,
    audio: plan.audio,
  });

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      const mergedData = { ...(template.defaults ?? {}), ...(data ?? {}) };
      const ctx = createRenderContext(
        frame,
        fps,
        totalFrames,
        width,
        height,
        mergedData,
        outputName
      );

      const html = template.render(ctx);
      const compositeHtml = buildCompositeHtml(html, background, width, height);

      const capturedFrame = await renderer.captureFrame(compositeHtml, {
        alpha: encoding?.video?.alpha === "keep",
      });

      const timestamp = frame / fps;
      await encoder.addFrame(capturedFrame, timestamp);

      callbacks?.onProgress?.({ frame, totalFrames, fps });
    }

    const result = await encoder.finalize();
    return result;
  } finally {
    await renderer.dispose();
    await encoder.dispose();
  }
}
