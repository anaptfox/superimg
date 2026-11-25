import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { planNarration } from "@superimg/core";
import type { NarrationSegmentTiming, TranscriptWord } from "@superimg/types";
import type { JsonObject as MediaJsonObject } from "@superimg/types";

export type SpeechProviderId = "macos-say" | "piper" | "elevenlabs";
export interface NarrationProgressReporter {
  report(update: { subject: { kind: "stage"; stageId: string } | { kind: "item"; stageId: string; item: { itemId: string; kind: "artifact" } }; state: "started" | "succeeded" }): Promise<unknown>;
}
import { hashJson } from "./provider.js";
import { publishDirectory } from "./directory-publication.js";
import { transcriptFromCharacterAlignment } from "./narration-alignment.js";
import {
  createMacOSSayProvider,
  createSpeechHost,
  sha256,
  type SpeechProvider,
  SpeechProviderUnavailableError,
  type SpeechSynthesisArtifact,
  type SpeechSynthesisRequest,
} from "./speech/index.js";

export interface NarrationRecipe {
  schemaVersion: 1;
  provider: SpeechProviderId;
  voice: string;
  model?: string;
  settings?: SpeechSynthesisRequest["settings"];
  rateAdjustment?: { maxAttempts: number; maxRateWpm: number };
  mode: "natural" | "fixed";
  fps: number;
  segments: Array<
    NarrationSegmentTiming & { text: string; displayText?: string }
  >;
}

export interface NodeNarrationOptions {
  cacheDirectory?: string;
  /** Host configuration, never portable request data. Provider owns credentials and executables. */
  providers?: Partial<Record<SpeechProviderId, SpeechProvider>>;
  maxSegments?: number;
  /** Maximum provider requests, including bounded rate-adjustment retries. */
  maxRequests?: number;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`Unknown ${path}.${key}`);
  }
}
export function parseSpeechRequest(value: unknown): SpeechSynthesisRequest {
  const request = record(value, "speech");
  keys(
    request,
    ["text", "voice", "model", "settings", "pronunciation"],
    "speech",
  );
  if (
    typeof request.text !== "string" || !request.text.trim() ||
    typeof request.voice !== "string" || !request.voice.trim()
  ) {
    throw new TypeError("Speech text and voice must be nonempty strings");
  }
  if (
    request.model !== undefined &&
    (typeof request.model !== "string" || !request.model.trim())
  ) throw new TypeError("speech.model must be a nonempty string");
  if (request.settings !== undefined) {
    record(request.settings, "speech.settings");
  }
  if (request.pronunciation !== undefined) {
    record(request.pronunciation, "speech.pronunciation");
  }
  return request as unknown as SpeechSynthesisRequest;
}
export function parseNarrationRecipe(value: unknown): NarrationRecipe {
  const recipe = record(value, "recipe");
  keys(recipe, [
    "schemaVersion",
    "provider",
    "voice",
    "model",
    "settings",
    "rateAdjustment",
    "mode",
    "fps",
    "segments",
  ], "recipe");
  if (
    recipe.schemaVersion !== 1 ||
    !["macos-say", "piper", "elevenlabs"].includes(String(recipe.provider))
  ) {
    throw new TypeError(
      "Recipe needs schemaVersion 1 and an explicit provider",
    );
  }
  if (!Array.isArray(recipe.segments) || recipe.segments.length === 0) {
    throw new TypeError("Recipe requires segments");
  }
  if (recipe.rateAdjustment !== undefined) {
    const adjustment = record(recipe.rateAdjustment, "recipe.rateAdjustment");
    keys(adjustment, ["maxAttempts", "maxRateWpm"], "recipe.rateAdjustment");
    if (
      recipe.provider !== "macos-say" || recipe.mode !== "fixed"
    ) throw new TypeError("rateAdjustment is supported only for macos-say fixed-mode recipes");
    const initialRate = record(recipe.settings ?? {}, "recipe.settings").rateWpm;
    if (typeof initialRate !== "number" || !Number.isInteger(initialRate) || initialRate < 1 || initialRate > 10000) {
      throw new TypeError("rateAdjustment requires explicit integer settings.rateWpm from 1 through 10000");
    }
    if (
      typeof adjustment.maxAttempts !== "number" ||
      !Number.isInteger(adjustment.maxAttempts) || adjustment.maxAttempts < 1 ||
      adjustment.maxAttempts > 3
    ) throw new TypeError("rateAdjustment.maxAttempts must be an integer from 1 to 3");
    if (
      typeof adjustment.maxRateWpm !== "number" ||
      !Number.isInteger(adjustment.maxRateWpm) || adjustment.maxRateWpm < initialRate ||
      adjustment.maxRateWpm > 10000 || adjustment.maxRateWpm < 1
    ) throw new TypeError("rateAdjustment.maxRateWpm must be an integer from settings.rateWpm through 10000");
  }
  parseSpeechRequest({
    text: "validate",
    voice: recipe.voice,
    ...(recipe.model === undefined ? {} : { model: recipe.model }),
    ...(recipe.settings === undefined ? {} : { settings: recipe.settings }),
  });
  const segments = recipe.segments.map((value, index) => {
    const segment = record(value, `segments[${index}]`);
    keys(segment, [
      "id",
      "text",
      "displayText",
      "beforeSeconds",
      "afterSeconds",
      "budgetSeconds",
    ], `segments[${index}]`);
    if (
      typeof segment.text !== "string" || !segment.text.trim() ||
      typeof segment.id !== "string"
    ) throw new TypeError("Segments require id and spoken text");
    if (
      segment.displayText !== undefined &&
      typeof segment.displayText !== "string"
    ) throw new TypeError("displayText must be a string");
    return segment;
  });
  // The pure planner validates IDs, all timing fields, mode and fps before any effect.
  planNarration(
    segments.map((segment) => ({
      ...segment,
      src: "validation.wav",
      sampleRate: 48000,
      sampleFrames: 1,
    })) as never,
    { mode: recipe.mode, fps: recipe.fps } as never,
  );
  return recipe as unknown as NarrationRecipe;
}

export function createNodeNarrationService(options: NodeNarrationOptions = {}) {
  const providers = {
    "macos-say": createMacOSSayProvider(),
    ...options.providers,
  };
  const cacheDirectory = options.cacheDirectory ??
    (process.platform === "darwin"
      ? join(homedir(), "Library", "Caches", "superimg", "speech")
      : join(
        process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"),
        "superimg",
        "speech",
      ));
  const hosts = new Map<string, ReturnType<typeof createSpeechHost>>();
  function provider(id: SpeechProviderId): SpeechProvider {
    const found = providers[id];
    if (!found) {
      throw new SpeechProviderUnavailableError(
        `Configure the ${id} provider on this host before requesting speech`,
      );
    }
    return found;
  }
  async function synthesize(
    id: SpeechProviderId,
    request: SpeechSynthesisRequest,
    call: { signal?: AbortSignal; refresh?: boolean } = {},
  ) {
    let host = hosts.get(id);
    if (!host) {
      host = createSpeechHost({ provider: provider(id), cacheDirectory });
      hosts.set(id, host);
    }
    return host.synthesize(request, call);
  }
  return {
    async voices(
      id: SpeechProviderId,
      signal?: AbortSignal,
    ): Promise<MediaJsonObject> {
      try {
        return json({
          provider: id,
          available: true,
          voices: await provider(id).voices({ signal }),
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        if (
          !(error instanceof SpeechProviderUnavailableError) &&
          !(error instanceof Error && "code" in error &&
            error.code === "ENOENT")
        ) throw error;
        return {
          provider: id,
          available: false,
          voices: [],
          reason: error.message,
        };
      }
    },
    async synthesize(
      id: SpeechProviderId,
      raw: unknown,
      path: string,
      call: { signal?: AbortSignal; refresh?: boolean } = {},
    ): Promise<MediaJsonObject> {
      const result = await synthesize(id, parseSpeechRequest(raw), call);
      const manifest = {
        schemaVersion: 1,
        kind: "speech-artifact",
        asset: publicAsset("speech", result),
      };
      await publishNarrationFiles(
        path,
        [{ result }],
        "speech.json",
        manifest,
        call.signal,
      );
      return json(manifest);
    },
    async prepare(
      raw: unknown,
      path: string,
      call: {
        signal?: AbortSignal;
        refresh?: boolean;
        preview?: boolean;
        progress?: NarrationProgressReporter;
      } = {},
    ): Promise<MediaJsonObject> {
      const recipe = parseNarrationRecipe(raw);
      if (recipe.segments.length > (options.maxSegments ?? 100)) {
        throw new TypeError(
          "Narration exceeds the configured segment/request limit",
        );
      }
      const maxProviderRequests = recipe.segments.length * (1 + (recipe.rateAdjustment?.maxAttempts ?? 0));
      if (maxProviderRequests > (options.maxRequests ?? options.maxSegments ?? 100)) {
        throw new TypeError(`Narration may issue up to ${maxProviderRequests} provider requests, exceeding the configured limit`);
      }
      const recipeHash = hashJson(json(recipe));
      if (call.preview) {
        return json({
          schemaVersion: 1,
          kind: "narration-preview",
          recipeHash,
          provider: recipe.provider,
          segments: recipe.segments.map((s) => ({
            id: s.id,
            characters: s.text.length,
          })),
          measurements: "unavailable-without-preparation",
          maxRequests: maxProviderRequests,
        });
      }
      const results: SpeechSynthesisArtifact[] = [];
      for (const segment of recipe.segments) {
        call.signal?.throwIfAborted();
        const subject = {
          kind: "item",
          stageId: "speech",
          item: { itemId: segment.id, kind: "artifact" },
        } as const;
        await call.progress?.report({ subject, state: "started" });
        const result = await synthesize(recipe.provider, {
          text: segment.text,
          voice: recipe.voice,
          ...(recipe.model === undefined ? {} : { model: recipe.model }),
          ...(recipe.settings === undefined
            ? {}
            : { settings: recipe.settings }),
        }, call);
        results.push(result);
        await call.progress?.report({ subject, state: "succeeded" });
      }
      let assets = results.map((result, index) => publicAsset(recipe.segments[index]!.id, result));
      let plan = buildNarrationPlan(recipe, results, assets);
      for (let attempt = 1; recipe.rateAdjustment !== undefined && plan.findings.length > 0 && attempt <= recipe.rateAdjustment.maxAttempts; attempt++) {
        const overflowIds = new Set(plan.findings.map((finding) => finding.segmentId));
        const rate = adjustedRate(recipe.settings!.rateWpm as number, recipe.rateAdjustment.maxRateWpm, attempt, recipe.rateAdjustment.maxAttempts);
        if (rate <= (recipe.settings!.rateWpm as number)) break;
        for (let index = 0; index < recipe.segments.length; index++) {
          const segment = recipe.segments[index]!;
          if (!overflowIds.has(segment.id)) continue;
          call.signal?.throwIfAborted();
          const subject = { kind: "item", stageId: "speech", item: { itemId: segment.id, kind: "artifact" } } as const;
          await call.progress?.report({ subject, state: "started" });
          results[index] = await synthesize(recipe.provider, requestFor(recipe, segment, rate), call);
          await call.progress?.report({ subject, state: "succeeded" });
        }
        assets = results.map((result, index) => publicAsset(recipe.segments[index]!.id, result));
        plan = buildNarrationPlan(recipe, results, assets);
      }
      const manifest = {
        schemaVersion: 1,
        kind: "prepared-narration",
        recipeHash,
        recipe,
        plan,
        assets,
      };
      await publishNarrationFiles(
        path,
        results.map((result) => ({ result })),
        "narration.json",
        manifest,
        call.signal,
      );
      return json({ ...manifest, ok: plan.findings.length === 0 });
    },
  };
}

function publicAsset(id: string, result: SpeechSynthesisArtifact) {
  return {
    id,
    src: `audio/${result.sha256}.wav`,
    sha256: result.sha256,
    metadata: result.metadata,
    provenance: { ...result.provenance, effectiveRequest: result.request },
    rights: result.provenance.provider === "macos-say"
      ? "local-draft"
      : "unverified",
  };
}

function requestFor(recipe: NarrationRecipe, segment: NarrationRecipe["segments"][number], rate?: number): SpeechSynthesisRequest {
  const settings = rate === undefined
    ? recipe.settings
    : { ...(recipe.settings ?? {}), rateWpm: rate };
  return {
    text: segment.text,
    voice: recipe.voice,
    ...(recipe.model === undefined ? {} : { model: recipe.model }),
    ...(settings === undefined ? {} : { settings }),
  };
}

function adjustedRate(initial: number, maximum: number, attempt: number, attempts: number): number {
  return Math.min(maximum, Math.max(initial, Math.ceil(initial + (maximum - initial) * attempt / attempts)));
}

function buildNarrationPlan(
  recipe: NarrationRecipe,
  results: readonly SpeechSynthesisArtifact[],
  assets: readonly ReturnType<typeof publicAsset>[],
) {
  return planNarration(recipe.segments.map((segment, index) => ({
    ...segment,
    src: assets[index]!.src,
    sampleRate: results[index]!.metadata.sampleRate,
    sampleFrames: results[index]!.metadata.sampleFrames,
    ...alignedWords(results[index]!),
  })), recipe);
}
function alignedWords(
  result: SpeechSynthesisArtifact,
): { transcript?: TranscriptWord[] } {
  if (result.provenance.provider !== "elevenlabs") return {};
  const metadata = result.provenance.providerMetadata;
  const alignment = metadata?.normalizedAlignment ?? metadata?.alignment;
  if (alignment === undefined || alignment === null) return {};
  return {
    transcript: transcriptFromCharacterAlignment(
      alignment,
      result.metadata.durationSeconds,
    ),
  };
}
async function publishNarrationFiles(
  path: string,
  items: Array<{ result: SpeechSynthesisArtifact }>,
  name: string,
  manifest: unknown,
  signal?: AbortSignal,
) {
  await mkdir(dirname(path), { recursive: true });
  const staging = await mkdtemp(
    join(dirname(path), `.${basename(path)}.staging-`),
  );
  try {
    await mkdir(join(staging, "audio"));
    for (const { result } of items) {
      signal?.throwIfAborted();
      const bytes = await readFile(result.path, { signal });
      if (sha256(bytes) !== result.sha256) {
        throw new Error("Speech artifact changed before publication");
      }
      await writeFile(join(staging, "audio", `${result.sha256}.wav`), bytes, {
        signal,
      });
    }
    await writeFile(
      join(staging, name),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { signal },
    );
    signal?.throwIfAborted();
    publishDirectory(staging, path, `${path}.backup-${randomUUID()}`);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
function json(value: unknown): MediaJsonObject {
  return JSON.parse(JSON.stringify(value)) as MediaJsonObject;
}
