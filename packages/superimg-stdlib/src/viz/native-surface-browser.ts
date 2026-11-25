//! Browser-side bridge for one native surface in the existing retained owner.
import type { NativeSurfaceFrame, NativeSurfaceHost, NativeSurfaceModule } from "@superimg/types";
import { createNativeSurfaceLifecycle, type NativeSurfaceLifecycle } from "./native-surface-lifecycle.js";
export { createNativeSurfaceLifecycle } from "./native-surface-lifecycle.js";

export interface RetainedNativeResources {
  retain<T extends { dispose(): void | Promise<void> }>(key: string, signature: string, create: () => T): T;
  discard(value: { dispose(): void | Promise<void> }): void;
}

interface RetainedSurface<Data> {
  readonly canvas: HTMLCanvasElement;
  readonly lifecycle: NativeSurfaceLifecycle<Data>;
  dispose(): Promise<void>;
}

/** Called once per accepted frame between the existing owner's begin/end calls. */
export async function sampleNativeSurface<Data>(options: Readonly<{
  resources: RetainedNativeResources;
  key: string;
  moduleIdentity: string;
  module: NativeSurfaceModule<Data>;
  host: NativeSurfaceHost;
  frame: NativeSurfaceFrame<Data>;
}>): Promise<HTMLCanvasElement> {
  if (!options.key || !options.moduleIdentity) throw new TypeError("Native surface requires a key and module identity");
  if (![options.host.width, options.host.height, options.host.dpr].every(value => Number.isFinite(value) && value > 0)) throw new TypeError("Native surface requires positive finite dimensions and DPR");
  if (!Number.isFinite(options.frame.seconds) || options.frame.seconds < 0) throw new TypeError("Native surface time must be finite and nonnegative");
  const assets = Object.entries(options.host.assets).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const signature = JSON.stringify([options.moduleIdentity, options.host.width, options.host.height, options.host.dpr, assets]);
  const retained = options.resources.retain<RetainedSurface<Data>>(options.key, signature, () => {
    const lifecycle = createNativeSurfaceLifecycle(options.module, options.host);
    return { canvas: options.host.canvas, lifecycle, dispose: () => lifecycle.dispose() };
  });
  if (retained.canvas !== options.host.canvas) options.host.canvas.replaceWith(retained.canvas);
  try { await retained.lifecycle.sample(options.frame); }
  catch (error) { options.resources.discard(retained); throw error; }
  return retained.canvas;
}
