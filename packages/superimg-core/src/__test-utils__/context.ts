import type { RenderContext } from "@superimg/types";
import { createRenderContext } from "../wasm.js";
import { bundleTemplateCode } from "../bundler.js";
import { compileTemplate } from "../compiler.js";

export function makeTestContext(overrides?: Partial<RenderContext>): RenderContext {
  const base = createRenderContext(0, 30, 60, 1920, 1080);
  return { ...base, ...overrides };
}

/** Bundle template code from string, then compile. Used for tests. */
export async function compileFromString(code: string) {
  const bundled = await bundleTemplateCode(code);
  return compileTemplate(bundled);
}
