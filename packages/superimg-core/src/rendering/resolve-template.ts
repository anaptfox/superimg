//! Pre-render resolve — apply define({ resolve }) once per job.

import type {
  AssetMeta,
  Duration,
  JsonObject,
  Marker,
  ResolveMarker,
  ResolvePhaseConfig,
  ResolveResult,
  TemplateConfig,
  TemplateModule,
} from "@superimg/types";
import { ValidationError } from "@superimg/types";
import { parseDuration } from "../shared/utils.js";

export interface ApplyTemplateResolveOptions {
  /** External data merged over template.sample */
  data?: Record<string, unknown>;
  /**
   * Applied after resolve (job/CLI wins).
   * Prefer only **explicit** operator overrides, not soft defaults.
   */
  overrides?: Partial<Pick<TemplateConfig, "duration" | "width" | "height" | "fps">>;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  signal?: AbortSignal;
}

export interface ApplyTemplateResolveResult {
  /** Template with config/sample updated from resolve (+ overrides). */
  template: TemplateModule;
  /** Normalized resolve() return value, or null when no resolve hook. */
  resolved: ResolveResult | null;
  /** Effective data for all frames (sample + external + resolve.data). */
  data: Record<string, unknown>;
}

export interface ResolvedSessionOptions {
  template: TemplateModule;
  data: Record<string, unknown>;
  durationSeconds?: number;
  fps?: number;
  width?: number;
  height?: number;
  markers: Marker[];
  resolveResult: ResolveResult | null;
}

function defaultAsset(filename: string): string {
  return filename;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function abortError(): ValidationError {
  return new ValidationError({
    field: "resolve",
    expectedType: "completed ResolveResult",
    receivedValue: "aborted",
    suggestion: "Retry the render; the previous resolve was cancelled.",
  });
}

/** Reject when signal aborts; always clean up the listener. */
export async function raceAbort<T>(
  p: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) throw abortError();

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => {
        cleanup();
        resolve(v);
      },
      (e) => {
        cleanup();
        reject(e);
      },
    );
  });
}

function assertPositiveNumber(field: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new ValidationError({
      field,
      expectedType: "finite number > 0",
      receivedValue: value,
    });
  }
  return value;
}

function assertNonNegativeDuration(field: string, value: unknown): Duration {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError({
        field,
        expectedType: "number ≥ 0 or Duration string (e.g. \"5s\")",
        receivedValue: value,
      });
    }
    return value;
  }
  if (typeof value === "string") {
    try {
      parseDuration(value, field, 30);
    } catch {
      throw new ValidationError({
        field,
        expectedType: "number ≥ 0 or Duration string (e.g. \"5s\", \"500ms\", \"30f\")",
        receivedValue: value,
      });
    }
    return value as Duration;
  }
  throw new ValidationError({
    field,
    expectedType: "number ≥ 0 or Duration string",
    receivedValue: value,
  });
}

/**
 * Validate and narrow an unknown resolve() return value.
 * Throws ValidationError with field names on bad shapes.
 */
export function normalizeResolveResult(raw: unknown): ResolveResult {
  if (!isPlainObject(raw)) {
    throw new ValidationError({
      field: "resolve",
      expectedType: "object (ResolveResult)",
      receivedValue: raw,
      suggestion: "resolve() must return an object, e.g. { duration: 5 }.",
    });
  }

  const out: ResolveResult = {};

  if (raw.duration !== undefined) {
    out.duration = assertNonNegativeDuration("duration", raw.duration);
  }
  if (raw.width !== undefined) {
    out.width = assertPositiveNumber("width", raw.width);
  }
  if (raw.height !== undefined) {
    out.height = assertPositiveNumber("height", raw.height);
  }
  if (raw.fps !== undefined) {
    out.fps = assertPositiveNumber("fps", raw.fps);
  }
  if (raw.data !== undefined) {
    if (!isPlainObject(raw.data)) {
      throw new ValidationError({
        field: "data",
        expectedType: "plain object",
        receivedValue: raw.data,
      });
    }
    out.data = raw.data as JsonObject;
  }
  if (raw.meta !== undefined) {
    if (!isPlainObject(raw.meta)) {
      throw new ValidationError({
        field: "meta",
        expectedType: "plain object",
        receivedValue: raw.meta,
      });
    }
    out.meta = raw.meta;
  }
  if (raw.phases !== undefined) {
    if (!isPlainObject(raw.phases)) {
      throw new ValidationError({
        field: "phases",
        expectedType: "Record<string, string>",
        receivedValue: raw.phases,
      });
    }
    const phases: ResolvePhaseConfig = {};
    for (const [k, v] of Object.entries(raw.phases)) {
      if (typeof v !== "string" || v.trim() === "") {
        throw new ValidationError({
          field: `phases.${k}`,
          expectedType: "non-empty string (e.g. \"15%\", \"0.6s\")",
          receivedValue: v,
        });
      }
      phases[k] = v;
    }
    out.phases = phases;
  }
  if (raw.markers !== undefined) {
    if (!Array.isArray(raw.markers)) {
      throw new ValidationError({
        field: "markers",
        expectedType: "array",
        receivedValue: raw.markers,
      });
    }
    out.markers = raw.markers.map((m, i) => normalizeMarker(m, i));
  }

  return out;
}

function normalizeMarker(raw: unknown, index: number): ResolveMarker {
  if (!isPlainObject(raw)) {
    throw new ValidationError({
      field: `markers[${index}]`,
      expectedType: "object { id, at, label? }",
      receivedValue: raw,
    });
  }
  if (typeof raw.id !== "string" || raw.id.trim() === "") {
    throw new ValidationError({
      field: `markers[${index}].id`,
      expectedType: "non-empty string",
      receivedValue: raw.id,
    });
  }
  if (typeof raw.at === "number") {
    if (!Number.isFinite(raw.at) || raw.at < 0) {
      throw new ValidationError({
        field: `markers[${index}].at`,
        expectedType: "number ≥ 0 or Duration string",
        receivedValue: raw.at,
      });
    }
  } else if (typeof raw.at === "string") {
    try {
      parseDuration(raw.at, `markers[${index}].at`, 30);
    } catch {
      throw new ValidationError({
        field: `markers[${index}].at`,
        expectedType: "number ≥ 0 or Duration string",
        receivedValue: raw.at,
      });
    }
  } else {
    throw new ValidationError({
      field: `markers[${index}].at`,
      expectedType: "number ≥ 0 or Duration string",
      receivedValue: raw.at,
    });
  }

  const marker: ResolveMarker = {
    id: raw.id,
    at: raw.at as number | string,
  };
  if (raw.label !== undefined) {
    if (typeof raw.label !== "string") {
      throw new ValidationError({
        field: `markers[${index}].label`,
        expectedType: "string",
        receivedValue: raw.label,
      });
    }
    marker.label = raw.label;
  }
  return marker;
}

function resolveMarkersToCheckpoints(
  markers: ResolveMarker[] | undefined,
  fps: number,
): Marker[] {
  if (!markers?.length) return [];
  return markers.map((m) => {
    const seconds =
      typeof m.at === "number" ? m.at : parseDuration(m.at, `marker:${m.id}`, fps);
    return {
      id: m.id,
      at: { type: "time" as const, value: seconds },
      ...(m.label !== undefined ? { label: m.label } : {}),
    };
  });
}

/**
 * Turn applyTemplateResolve output into session/player options.
 * formatDims win over resolve for width/height when provided.
 */
export function sessionOptionsFromResolve(
  applied: ApplyTemplateResolveResult,
  opts?: {
    formatDims?: { width?: number; height?: number };
    extraMarkers?: Marker[];
  },
): ResolvedSessionOptions {
  const cfg = applied.template.config;
  const fps = cfg?.fps ?? 30;
  const formatDims = opts?.formatDims ?? {};

  let durationSeconds: number | undefined;
  if (cfg?.duration != null) {
    durationSeconds = parseDuration(cfg.duration, "duration", fps);
  }

  const width =
    formatDims.width !== undefined
      ? formatDims.width
      : cfg?.width !== undefined
        ? cfg.width
        : undefined;
  const height =
    formatDims.height !== undefined
      ? formatDims.height
      : cfg?.height !== undefined
        ? cfg.height
        : undefined;

  const fromResolve = resolveMarkersToCheckpoints(applied.resolved?.markers, fps);
  const markers = [...(opts?.extraMarkers ?? []), ...fromResolve];

  return {
    template: applied.template,
    data: applied.data,
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    ...(cfg?.fps !== undefined ? { fps: cfg.fps } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    markers,
    resolveResult: applied.resolved,
  };
}

/**
 * Run `template.resolve` once and merge results into config/sample.
 *
 * Authority order: template.config → resolve() → opts.overrides.
 * Does not call resolve when the hook is absent.
 * Call once per job — not per frame.
 */
export async function applyTemplateResolve(
  template: TemplateModule,
  opts: ApplyTemplateResolveOptions = {},
): Promise<ApplyTemplateResolveResult> {
  if (opts.signal?.aborted) throw abortError();

  const assets = opts.assets ?? {};
  const asset = opts.assetResolver ?? defaultAsset;

  const baseData: Record<string, unknown> = {
    ...(template.sample ?? {}),
    ...(opts.data ?? {}),
  };

  const baseConfig: TemplateConfig = { ...(template.config ?? {}) };

  if (!template.resolve) {
    const config = opts.overrides
      ? { ...baseConfig, ...opts.overrides }
      : baseConfig;
    const next: TemplateModule = {
      ...template,
      config,
      sample: baseData as TemplateModule["sample"],
    };
    assertAnimatedHasDuration(next);
    return { template: next, resolved: null, data: baseData };
  }

  const resolveInput = {
    data: baseData as JsonObject,
    config: baseConfig,
    asset,
    assets,
    ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
  };

  const raw = await raceAbort(
    Promise.resolve(template.resolve(resolveInput)),
    opts.signal,
  );
  const resolved = normalizeResolveResult(raw);

  let config: TemplateConfig = { ...baseConfig };
  if (resolved.duration !== undefined) config.duration = resolved.duration;
  if (resolved.width !== undefined) config.width = resolved.width;
  if (resolved.height !== undefined) config.height = resolved.height;
  if (resolved.fps !== undefined) config.fps = resolved.fps;

  if (opts.overrides) {
    config = { ...config, ...opts.overrides };
  }

  const data: Record<string, unknown> = {
    ...baseData,
    ...(resolved.data ?? {}),
  };

  const next: TemplateModule = {
    ...template,
    config,
    sample: data as TemplateModule["sample"],
    // Keep resolve for module identity; callers must not re-run per frame.
    resolve: template.resolve,
  };

  assertAnimatedHasDuration(next);

  return { template: next, resolved, data };
}

function assertAnimatedHasDuration(template: TemplateModule): void {
  if (!template.animated) return;
  if (template.config?.duration != null) return;
  throw new ValidationError({
    field: "duration",
    expectedType: "number | Duration string (e.g. 5 or \"5s\")",
    receivedValue: template.config?.duration,
    suggestion:
      "Animated template has no duration after resolve. " +
      "Set config.duration or return { duration } from resolve(). " +
      "Example: resolve: async ({ data }) => ({ duration: data.words.length * 0.08 + 2 })",
  });
}
