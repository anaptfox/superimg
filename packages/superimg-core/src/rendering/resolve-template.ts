//! Pre-render resolve — apply define({ resolve }) once per job.

import type {
  AssetMeta,
  Duration,
  JsonObject,
  Marker,
  ResolveCue,
  ResolveMarker,
  ResolvePhaseConfig,
  ResolveResult,
  TemplateConfig,
  TemplateModule,
} from "@superimg/types";
import { ValidationError } from "@superimg/types";
import type { MediaCapabilities } from "@superimg/types";
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

function copyDeclaredMediaCapabilities(from: object, to: object): void {
  const capabilities = (from as { mediaCapabilities?: MediaCapabilities }).mediaCapabilities;
  if (capabilities?.version !== 0) return;
  Object.defineProperty(to, "mediaCapabilities", {
    value: capabilities,
    enumerable: true,
    configurable: true,
    writable: true,
  });
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
  if (raw.cues !== undefined) {
    if (!Array.isArray(raw.cues)) {
      throw new ValidationError({ field: "cues", expectedType: "array", receivedValue: raw.cues });
    }
    out.cues = raw.cues.map((cue, i) => normalizeCue(cue, i));
    const seen = new Set<string>();
    for (const cue of out.cues) {
      if (seen.has(cue.id)) {
        throw new ValidationError({
          field: "cues",
          expectedType: "one cue per script block id",
          receivedValue: cue.id,
          suggestion: `The cue id ${JSON.stringify(cue.id)} appears twice.`,
        });
      }
      seen.add(cue.id);
    }
    // A cue is also a seek target. Authored markers with the same id win.
    const marked = new Set((out.markers ?? []).map((marker) => marker.id));
    const fromCues = out.cues
      .filter((cue) => !marked.has(cue.id))
      .map((cue) => ({ id: cue.id, at: cue.start }));
    if (fromCues.length > 0) out.markers = [...(out.markers ?? []), ...fromCues];
  }
  if (raw.cueFindings !== undefined) {
    if (!Array.isArray(raw.cueFindings)) {
      throw new ValidationError({ field: "cueFindings", expectedType: "array", receivedValue: raw.cueFindings });
    }
    out.cueFindings = raw.cueFindings.map((finding, i) => {
      if (!isPlainObject(finding) || typeof finding.id !== "string" || !finding.id ||
        typeof finding.message !== "string" || !finding.message ||
        (finding.code !== undefined && typeof finding.code !== "string") ||
        (finding.severity !== undefined && finding.severity !== "error" && finding.severity !== "warning" && finding.severity !== "info")) {
        throw new ValidationError({
          field: `cueFindings[${i}]`,
          expectedType: '{ id: string; message: string; code?: string; severity?: "error" | "warning" | "info" }',
          receivedValue: finding,
        });
      }
      return {
        id: finding.id,
        message: finding.message,
        ...(finding.code !== undefined ? { code: finding.code } : {}),
        ...(finding.severity !== undefined ? { severity: finding.severity } : {}),
      };
    });
  }
  if (raw.breakdown !== undefined) {
    if (!isPlainObject(raw.breakdown)) {
      throw new ValidationError({
        field: "breakdown",
        expectedType: "Record<string, { cast: string[]; props: string[] }>",
        receivedValue: raw.breakdown,
      });
    }
    const breakdown: Record<string, { cast: string[]; props: string[] }> = {};
    for (const [shotId, entry] of Object.entries(raw.breakdown)) {
      if (
        !isPlainObject(entry) ||
        !Array.isArray(entry.cast) ||
        !entry.cast.every((v) => typeof v === "string") ||
        !Array.isArray(entry.props) ||
        !entry.props.every((v) => typeof v === "string")
      ) {
        throw new ValidationError({
          field: `breakdown.${shotId}`,
          expectedType: "{ cast: string[]; props: string[] }",
          receivedValue: entry,
        });
      }
      breakdown[shotId] = { cast: [...entry.cast], props: [...entry.props] };
    }
    out.breakdown = breakdown;
  }
  if (raw.audio !== undefined) {
    if (typeof raw.audio !== "object" || raw.audio === null) {
      throw new ValidationError({
        field: "audio",
        expectedType: "AudioClip | AudioClip[] | AudioTimeline",
        receivedValue: raw.audio,
      });
    }
    out.audio = raw.audio as NonNullable<ResolveResult["audio"]>;
  }

  return out;
}

function normalizeCueTime(field: string, value: unknown): number | string {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError({ field, expectedType: "finite seconds >= 0", receivedValue: value });
    }
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    parseDuration(value, field, 30);
    return value;
  }
  throw new ValidationError({
    field,
    expectedType: "number (seconds) or duration string",
    receivedValue: value,
  });
}

function normalizeCue(raw: unknown, index: number): ResolveCue {
  if (!isPlainObject(raw) || typeof raw.id !== "string" || raw.id === "") {
    throw new ValidationError({
      field: `cues[${index}]`,
      expectedType: "{ id: string; start; end; still? }",
      receivedValue: raw,
    });
  }
  return {
    id: raw.id,
    start: normalizeCueTime(`cues[${index}].start`, raw.start),
    end: normalizeCueTime(`cues[${index}].end`, raw.end),
    ...(raw.still !== undefined ? { still: normalizeCueTime(`cues[${index}].still`, raw.still) } : {}),
  };
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
      ...(Object.keys(baseData).length > 0
        ? { sample: baseData as NonNullable<TemplateModule["sample"]> }
        : {}),
    };
    // Spread clone drops WeakMap stamps on the template object; copy them.
    // (Stamps are also keyed by `render`, which is shared — this is belt-and-suspenders.)
    copyDeclaredMediaCapabilities(template, next);
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
  if (resolved.audio !== undefined) config.audio = resolved.audio;

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
    ...(Object.keys(data).length > 0
      ? { sample: data as NonNullable<TemplateModule["sample"]> }
      : {}),
    // Keep resolve for module identity; callers must not re-run per frame.
    resolve: template.resolve,
  };
  copyDeclaredMediaCapabilities(template, next);

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
