import { parseDuration, planComposition } from "@superimg/core";
import type {
  CompositionLeafSchedule,
  CompositionMedia,
  DeterministicMediaDefinition,
  EncodingOptions,
  JsonObject,
} from "@superimg/types";
import type { PreparedRuntimeResources } from "./resources.js";

const CACHE_SCHEMA_VERSION = 1 as const;

/** A host-owned, versioned identity for one qualified composition occurrence. */
export interface CompositionFrameCacheIdentity {
  readonly id: string;
  readonly version: string;
}

/**
 * Opt-in evidence for reusing an already captured composition frame.
 *
 * Identity is intentionally supplied by the host.  Render functions and
 * schedules are not content identities, and cache reuse is disabled whenever
 * an active occurrence has no identity. The host asserts that a stable `id`
 * names one occurrence material and must advance `version` whenever its
 * authored render behavior or owned input bytes change.
 */
export interface CompositionFrameCacheOptions {
  readonly schemaVersion: typeof CACHE_SCHEMA_VERSION;
  readonly runtimeVersion: string;
  readonly maxEntries?: number;
  readonly identity: (input: Readonly<{
    path: string;
    media: CompositionMedia;
  }>) => CompositionFrameCacheIdentity | undefined;
}

interface CachedFrame {
  readonly bytes: Uint8Array;
}

/** One cache decision made before a render attempt. Reuse this token at store time. */
export interface CompositionFrameCacheLookup {
  readonly key: string;
  readonly bytes?: Uint8Array;
}

export class CompositionFrameCache {
  readonly #entries = new Map<string, CachedFrame>();
  readonly #options: CompositionFrameCacheOptions | undefined;
  readonly #maxEntries: number;

  constructor(options: CompositionFrameCacheOptions | undefined) {
    this.#options = validateOptions(options);
    this.#maxEntries = this.#options?.maxEntries ?? 256;
  }

  lookup(input: CompositionFrameCacheKeyInput): CompositionFrameCacheLookup | undefined {
    const key = this.key(input);
    if (key === undefined) return undefined;
    const entry = this.#entries.get(key);
    if (entry === undefined) return Object.freeze({ key });
    // LRU refresh and defensive bytes: encoders must not mutate cache state.
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return Object.freeze({ key, bytes: Uint8Array.from(entry.bytes) });
  }

  /** Store bytes under the exact pre-render cache decision, never a fresh identity lookup. */
  store(lookup: CompositionFrameCacheLookup | undefined, bytes: Uint8Array): void {
    if (lookup === undefined) return;
    this.#entries.delete(lookup.key);
    this.#entries.set(lookup.key, Object.freeze({ bytes: Uint8Array.from(bytes) }));
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      this.#entries.delete(oldest);
    }
  }

  private key(input: CompositionFrameCacheKeyInput): string | undefined {
    const options = this.#options;
    const composition = input.definition.composition;
    if (options === undefined || composition === undefined) return undefined;
    try {
      const frame = Math.max(0, Math.min(input.authoredFrame, composition.schedule.totalFrames - 1));
      const plan = planComposition(composition.program, {
        size: composition.outputSize,
        fps: composition.schedule.fps,
        ...(composition.schedule.selectedRoutes === undefined ? {} : { routes: composition.schedule.selectedRoutes }),
      });
      const active = plan.leaves.filter((leaf) => frame >= leaf.startFrame && frame < leaf.endFrame);
      if (active.length === 0) return undefined;
      const identities = active.map((leaf) => {
        const identity = options.identity({ path: leaf.path, media: leaf.content });
        if (!validIdentity(identity)) return undefined;
        return {
          path: leaf.path,
          id: identity.id,
          version: identity.version,
          localFrame: sampledLeafFrame(leaf, frame, composition.schedule.fps),
          schedule: leafSchedule(leaf),
          data: leaf.data ?? null,
          sample: leaf.content.sample ?? null,
        };
      });
      // Each active leaf contributes pixels.  Missing evidence for one makes
      // the whole composite unsafe, even if other leaves have identities.
      if (identities.some((identity) => identity === undefined)) return undefined;
      return canonicalJson({
      schemaVersion: CACHE_SCHEMA_VERSION,
      runtimeVersion: options.runtimeVersion,
      target: { width: input.width, height: input.height },
      clock: {
        output: { fps: input.outputFps, frame: input.outputFrame },
        // Child render contexts expose the root totalFrames. A later branch
        // that changes total duration can therefore alter this frame even
        // when its active occurrence is unchanged.
        authored: { fps: input.authoredFps, frame, totalFrames: plan.totalFrames },
      },
      output: composition.outputSize,
      root: {
        css: input.definition.config?.inlineCss ?? [],
        stylesheets: input.definition.config?.stylesheets ?? [],
        tailwind: input.definition.config?.tailwind ?? null,
        mode: input.definition.config?.mode ?? "frame",
        readiness: input.definition.config?.readiness ?? null,
        background: input.definition.config?.background ?? null,
        watermark: input.definition.config?.watermark ?? null,
        assets: input.resources.assets.map(({ name, sha256, mimeType }) => ({ name, sha256, mimeType })),
        fonts: input.resources.fonts.map(({ request, family, weight, style, sha256, mimeType }) => ({ request, family, weight: weight ?? null, style: style ?? null, sha256, mimeType })),
        nativeModules: input.resources.nativeModuleSets.map(({ identity }) => identity),
      },
      render: { format: input.format, encoding: input.encoding ?? null },
      // The active leaves already carry their resolved data and qualified
      // identities. A route or entry patch in a later part can reuse this
      // frame only when root duration and resources still match.
      active: identities,
      });
    } catch {
      // Cache evidence is optional. A resolver failure or a non-canonical
      // host value must make this frame a miss, never change render behavior.
      return undefined;
    }
  }
}

export interface CompositionFrameCacheKeyInput {
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  /** Effective composition entry data when a caller has not already prepared it. */
  readonly data: JsonObject;
  readonly resources: PreparedRuntimeResources;
  readonly width: number;
  readonly height: number;
  /** Delivery clock: capture time can differ from the authored composition clock. */
  readonly outputFps: number;
  readonly outputFrame: number;
  /** Authored clock used to select active retained children. */
  readonly authoredFps: number;
  readonly authoredFrame: number;
  readonly format: string;
  readonly encoding?: Omit<EncodingOptions, "format">;
}

function sampledLeafFrame(leaf: CompositionLeafSchedule & { content: CompositionMedia }, frame: number, outputFps: number): number {
  const outputFrame = Math.min(frame - leaf.startFrame, (leaf.contentEndFrame ?? leaf.endFrame) - leaf.startFrame - 1);
  const childFps = leaf.fps ?? outputFps;
  const duration = leaf.content.config?.duration;
  const sourceFrames = leaf.fps && duration !== undefined
    ? Math.max(1, Math.round(parseDuration(duration, `${leaf.path}.duration`, childFps) * childFps))
    : leaf.totalFrames;
  return Math.min(Math.floor(outputFrame * childFps / outputFps), sourceFrames - 1);
}

function leafSchedule(leaf: CompositionLeafSchedule): Record<string, unknown> {
  return {
    startFrame: leaf.startFrame,
    endFrame: leaf.endFrame,
    totalFrames: leaf.totalFrames,
    contentEndFrame: leaf.contentEndFrame ?? null,
    width: leaf.width,
    height: leaf.height,
    fit: leaf.fit ?? null,
    placement: leaf.placement ?? null,
    placementChain: leaf.placementChain ?? null,
    variantId: leaf.variantId ?? null,
    editionId: leaf.editionId ?? null,
    fps: leaf.fps ?? null,
  };
}

function validateOptions(options: CompositionFrameCacheOptions | undefined): CompositionFrameCacheOptions | undefined {
  if (options === undefined) return undefined;
  if (options.schemaVersion !== CACHE_SCHEMA_VERSION) throw new TypeError("composition frame cache requires schemaVersion: 1");
  if (typeof options.runtimeVersion !== "string" || options.runtimeVersion.length === 0) {
    throw new TypeError("composition frame cache requires a non-empty runtimeVersion");
  }
  if (typeof options.identity !== "function") throw new TypeError("composition frame cache requires an identity resolver");
  if (options.maxEntries !== undefined && (!Number.isSafeInteger(options.maxEntries) || options.maxEntries < 1)) {
    throw new TypeError("composition frame cache maxEntries must be a positive safe integer");
  }
  return options;
}

function validIdentity(value: CompositionFrameCacheIdentity | undefined): value is CompositionFrameCacheIdentity {
  return value !== undefined && typeof value.id === "string" && value.id.length > 0 && typeof value.version === "string" && value.version.length > 0;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object") throw new TypeError("composition frame cache key must be JSON-compatible");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}
