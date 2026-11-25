import type { CaptureMeta, CaptureResult, SnapdomPlugin } from "@zumer/snapdom";
import type { ContextResult } from "@zumer/snapdom-plugins/context-export";
import type { BrowserCaptureOptions } from "./capture.js";

export interface BrowserCaptureEvidence {
  readonly warnings: readonly { readonly code: string; readonly message: string; readonly detail?: unknown }[];
  readonly geometry: Readonly<CaptureMeta> | null;
  readonly requested: { readonly width: number; readonly height: number; readonly dpr: number; readonly scale: number; readonly region: BrowserCaptureOptions["region"] | null };
  readonly actual: { readonly width: number; readonly height: number } | null;
  readonly context: Readonly<ContextResult> | null;
  readonly timings: { readonly captureMs: number; readonly encodeMs: number; readonly totalMs: number };
}
export interface BrowserCaptureResult<T> { readonly output: T; readonly evidence: BrowserCaptureEvidence }

/** Own mutable option records before imports, capture or export can yield. */
export function snapshotCaptureOptions<T>(value: T): T {
  const seen = new WeakMap<object, unknown>();
  const copy = (item: unknown): unknown => {
    if (!item || typeof item !== "object") return item;
    if (item instanceof Date) return new Date(item.getTime());
    if (seen.has(item)) return seen.get(item);
    if (Array.isArray(item)) {
      const result: unknown[] = []; seen.set(item, result);
      for (const child of item) result.push(copy(child));
      return result;
    }
    if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) return item;
    const result: Record<string, unknown> = {}; seen.set(item, result);
    for (const [key, child] of Object.entries(item)) result[key] = copy(child);
    return result;
  };
  return copy(value) as T;
}

/** Per-capture plugin; importing ordinary capture never loads the context plugin. */
export async function contextCapturePlugins(enabled: boolean): Promise<SnapdomPlugin[]> {
  if (!enabled) return [];
  const { contextExport } = await import("@zumer/snapdom-plugins/context-export");
  return [contextExport({ format: "json", maxNodes: 800, maxTextLength: 120, geometry: true, needs: "render" })];
}

/** Called after the requested export: SnapDOM may append export-time warnings. */
export async function captureEvidence(
  result: CaptureResult,
  requestedOptions: BrowserCaptureOptions,
  timing: { start: number; captured: number; encoded: number },
  actual: BrowserCaptureEvidence["actual"],
  withContext: boolean,
): Promise<BrowserCaptureEvidence> {
  const options = snapshotCaptureOptions(requestedOptions);
  const detach = <T>(value: T): T => {
    const copy = JSON.parse(JSON.stringify(value)) as T;
    const pending: unknown[] = [copy];
    while (pending.length) {
      const item = pending.pop();
      if (item && typeof item === "object") { pending.push(...Object.values(item)); Object.freeze(item); }
    }
    return copy;
  };
  const context = withContext ? detach(await result.toContext({ format: "json", maxTextLength: 120, geometry: true })) : null;
  const warnings = (result.warnings ?? []).map(warning => {
    let detail: unknown;
    try { if (warning.detail !== undefined) detail = detach(warning.detail); } catch { /* An opaque diagnostic must not retain a live handle. */ }
    return Object.freeze({ code: warning.code, message: warning.message, ...(detail === undefined ? {} : { detail }) });
  });
  const geometry = result.meta ? detach(result.meta) : null;
  if (geometry?.clip) Object.freeze(geometry.clip);
  return Object.freeze({
    warnings: Object.freeze(warnings), geometry: geometry ? Object.freeze(geometry) : null,
    requested: Object.freeze({ width: options.width, height: options.height, dpr: options.dpr ?? 2, scale: options.scale ?? 1, region: typeof options.region === "object" ? Object.freeze({ ...options.region }) : options.region ?? null }),
    actual: actual ? Object.freeze({ ...actual }) : null, context: context ? Object.freeze(context) : null,
    timings: Object.freeze({ captureMs: timing.captured - timing.start, encodeMs: timing.encoded - timing.captured, totalMs: performance.now() - timing.start }),
  });
}
