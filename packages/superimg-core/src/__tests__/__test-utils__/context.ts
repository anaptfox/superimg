import type { RenderContext } from "@superimg/types";
import { createRenderContext } from "../../rendering/create-render-context.js";
import { bundleTemplateCode } from "../../bundler/bundler.js";
import { compileTemplate } from "../../rendering/compiler.js";

export function makeTestContext(overrides?: Partial<RenderContext>): RenderContext {
  const base = createRenderContext(0, 30, 60, 1920, 1080);
  return { ...base, ...overrides };
}

/** Build context at a specific timeline progress (0–1). */
export function makeTestContextAtProgress(
  progress: number,
  fps = 30,
  totalFrames = 60,
): RenderContext {
  const frame = Math.round(progress * (totalFrames - 1));
  return createRenderContext(frame, fps, totalFrames, 1920, 1080);
}

/** Build context at specific timeline seconds. */
export function makeTestContextAtSeconds(
  seconds: number,
  fps = 30,
  totalFrames = 60,
): RenderContext {
  const duration = totalFrames / fps;
  const progress = duration > 0 ? Math.min(seconds / duration, 1) : 0;
  return makeTestContextAtProgress(progress, fps, totalFrames);
}

/** Bundle template code from string, then compile. Used for tests. */
export async function compileFromString(code: string) {
  const bundled = await bundleTemplateCode(code);
  return compileTemplate(bundled);
}