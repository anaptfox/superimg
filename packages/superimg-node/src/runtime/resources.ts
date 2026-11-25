import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetMetadataFromFrozen,
  hashTemplateOutputs,
  cancellationError,
  fontFaceCss,
  isAbortError,
  normalizeAudioInput,
  raceSignal,
  resolveRuntimeFonts,
  type ResolvedFont,
} from "@superimg/core";
import { verifyAndOwnBytes } from "@superimg/core/runtime";
import type {
  AssetDeclaration,
  AudioValue,
  AssetMeta,
  DeterministicMediaDefinition,
  FrozenAssetMetadata,
  FrozenFontMetadata,
  RuntimeFinding,
  PreparedNativeModuleSet,
} from "@superimg/types";
import { prepareBrowserFontFace } from "@superimg/core/edge";

export type RuntimeFetch = typeof globalThis.fetch;

export interface PreparedRuntimeResources {
  readonly audio?: AudioValue;
  readonly findings: readonly RuntimeFinding[];
  readonly assets: readonly FrozenAssetMetadata[];
  readonly fonts: readonly FrozenFontMetadata[];
  readonly assetUrls: Readonly<Record<string, string>>;
  readonly assetMetadata: Readonly<Record<string, AssetMeta>>;
  readonly fontBuffers: readonly Uint8Array[];
  readonly fontCss: readonly string[];
  readonly nativeModuleSets: readonly PreparedNativeModuleSet[];
}

export async function prepareRuntimeResources(
  media: DeterministicMediaDefinition<import("@superimg/types").JsonObject>,
  fetcher: RuntimeFetch,
  signal?: AbortSignal,
  defaultFonts?: import("@superimg/types").InitOptions["defaultFonts"],
): Promise<PreparedRuntimeResources> {
  const findings: RuntimeFinding[] = [];
  let frozenAssetRecords: Awaited<ReturnType<typeof freezeAsset>>[] = [];
  const frozenAssets: FrozenAssetMetadata[] = [];
  const frozenFonts: FrozenFontMetadata[] = [];
  const fontBuffers: Uint8Array[] = [];
  const nativeModuleSets: PreparedNativeModuleSet[] = [];
  for (const moduleSet of media.config?.nativeModuleSets ?? []) {
    try {
      const outputs: PreparedNativeModuleSet["outputs"] = moduleSet.outputs.map(file => file.type === "chunk"
        ? { ...file, sourceMap: structuredClone(file.sourceMap) }
        : { ...file, source: typeof file.source === "string" ? file.source : new Uint8Array(file.source) });
      if (!/^[a-f0-9]{64}$/.test(moduleSet.identity) || hashTemplateOutputs(outputs) !== moduleSet.identity) throw new TypeError("Native module identity does not match its files");
      nativeModuleSets.push({ identity: moduleSet.identity, outputs });
    } catch (error) {
      findings.push(Object.freeze({ severity: "error", category: "asset", code: "NATIVE_MODULE_RESOLUTION_FAILED", message: errorMessage(error) }));
    }
  }

  for (const [name, declaration] of Object.entries(media.config?.assets ?? {})) {
    if (signal?.aborted) throw cancellationError();
    try {
      const frozen = await freezeAsset(name, declaration, fetcher, signal);
      frozenAssets.push(frozen.metadata);
      frozenAssetRecords.push(frozen);
    } catch (error) {
      if (isAbortError(error, signal)) throw cancellationError(error);
      findings.push(Object.freeze({
        severity: "error",
        category: "asset",
        code: "ASSET_RESOLUTION_FAILED",
        message: `Could not freeze asset ${JSON.stringify(name)}: ${errorMessage(error)}`,
      }));
    }
  }

  if (signal?.aborted) throw cancellationError();
  try {
    const resolved = await resolveRuntimeFonts(media.config?.fonts, {
      format: "web",
      fetch: fetcher,
      ...(signal !== undefined ? { signal } : {}),
      ...(defaultFonts !== undefined ? { defaultFonts } : {}),
    });
    for (const error of resolved.errors) {
      findings.push(Object.freeze({
        severity: "error",
        category: "font",
        code: error.code,
        message: error.message,
      }));
    }
    for (const warning of resolved.warnings) {
      findings.push(Object.freeze({
        severity: "warning",
        category: "font",
        code: warning.code,
        message: warning.message,
      }));
    }
    for (const face of resolved.faces) {
      const frozen = freezeFont(face.request ?? face.family, face);
      frozenFonts.push(frozen.metadata);
      fontBuffers.push(frozen.bytes);
    }
  } catch (error) {
    if (isAbortError(error, signal)) throw cancellationError(error);
    findings.push(Object.freeze({
      severity: "error",
      category: "font",
      code: "FONT_RESOLUTION_FAILED",
      message: `Could not freeze fonts: ${errorMessage(error)}`,
    }));
  }

  let audioTimeline: ReturnType<typeof normalizeAudioInput> | undefined;
  let audioClips: { clip: ReturnType<typeof normalizeAudioInput>["clips"][number]; frozen: Awaited<ReturnType<typeof freezeAsset>> }[] = [];
  if (media.config?.audio !== undefined) {
    const timeline = normalizeAudioInput(media.config.audio);
    // Capture authored metadata now, matching the previous eager projection.
    // Only byte serialization is deferred; callers may mutate their timeline.
    audioTimeline = { ...timeline };
    for (const [index, clip] of timeline.clips.entries()) {
      try {
        if (signal?.aborted) throw cancellationError();
        if (clip.source && clip.source.kind !== "file") throw new TypeError("Authored audio requires a file source");
        const declaration = isAbsolute(clip.src)
          ? { bytes: new Uint8Array(await raceSignal(readFile(clip.src), signal)), mimeType: guessMimeType(clip.src), type: "audio" as const }
          : { url: clip.src, type: "audio" as const };
        const frozen = await freezeAsset(`@audio/${index}`, declaration, fetcher, signal);
        frozenAssets.push(frozen.metadata);
        audioClips.push({ clip: { ...clip }, frozen });
      } catch (error) {
        if (isAbortError(error, signal)) throw cancellationError(error);
        findings.push(Object.freeze({ severity: "error", category: "asset", code: "AUDIO_RESOLUTION_FAILED", message: `Could not freeze authored audio ${index}: ${errorMessage(error)}` }));
      }
    }
  }

  let assetProjection: { urls: Readonly<Record<string, string>>; metadata: Readonly<Record<string, AssetMeta>> } | undefined;
  let fontCss: readonly string[] | undefined;
  let audio: AudioValue | undefined;
  const materializeAssets = () => {
    if (signal?.aborted) throw cancellationError();
    if (assetProjection !== undefined) return assetProjection;
    const urls: Record<string, string> = {};
    const metadata: Record<string, AssetMeta> = {};
    for (const frozen of frozenAssetRecords) {
      const url = dataUrl(frozen.bytes, frozen.metadata.mimeType);
      urls[frozen.metadata.name] = url;
      metadata[frozen.metadata.name] = assetMetadataFromFrozen(frozen.metadata, url);
    }
    frozenAssetRecords = [];
    return assetProjection = { urls: Object.freeze(urls), metadata: Object.freeze(metadata) };
  };
  if (signal?.aborted) throw cancellationError();
  const prepared: PreparedRuntimeResources = {
    findings: Object.freeze(findings),
    assets: Object.freeze(frozenAssets),
    fonts: Object.freeze(frozenFonts),
    nativeModuleSets: Object.freeze(nativeModuleSets),
    get assetUrls() { return materializeAssets().urls; },
    get assetMetadata() { return materializeAssets().metadata; },
    fontBuffers: Object.freeze(fontBuffers),
    get fontCss() {
      if (signal?.aborted) throw cancellationError();
      return fontCss ??= Object.freeze(frozenFonts.map((font, index) => {
        const { bytes, mimeType } = prepareBrowserFontFace(fontBuffers[index]!, font);
        return fontFaceCss({ ...font, mimeType }, dataUrl(bytes, mimeType));
      }));
    },
  };
  if (audioTimeline !== undefined) {
    Object.defineProperty(prepared, "audio", { enumerable: true, get() {
      if (signal?.aborted) throw cancellationError();
      if (audio !== undefined) return audio;
      audio = { ...audioTimeline!, clips: audioClips.map(({ clip, frozen }) =>
        ({ ...clip, src: dataUrl(frozen.bytes, frozen.metadata.mimeType) })) };
      audioClips = [];
      return audio;
    } });
  }
  return Object.freeze(prepared);
}

async function freezeAsset(
  name: string,
  declaration: AssetDeclaration,
  fetcher: RuntimeFetch,
  signal?: AbortSignal,
): Promise<{ readonly bytes: Uint8Array; readonly metadata: FrozenAssetMetadata }> {
  let bytes: Uint8Array;
  let mimeType: string;
  if ("bytes" in declaration) {
    bytes = declaration.bytes;
    mimeType = normalizeMimeType(declaration.mimeType);
  } else {
    const source = String(declaration.url);
    if (source.startsWith("file:")) {
      bytes = new Uint8Array(await raceSignal(readFile(fileURLToPath(source)), signal));
      mimeType = normalizeMimeType(guessMimeType(source));
    } else {
      const response = await raceSignal(fetcher(source, {
        ...(signal !== undefined ? { signal } : {}),
      }), signal);
      if (!response.ok) throw new Error(`request failed with status ${response.status}`);
      bytes = new Uint8Array(await raceSignal(response.arrayBuffer(), signal));
      mimeType = normalizeMimeType(
        response.headers.get("content-type")?.split(";", 1)[0] ?? guessMimeType(source),
      );
    }
  }
  const owned = verifyAndOwnBytes(bytes);
  return Object.freeze({
    bytes: owned.bytes,
    metadata: Object.freeze({
      name,
      kind: declaration.type ?? kindFromMimeType(mimeType),
      mimeType,
      byteLength: owned.byteLength,
      sha256: owned.sha256,
    }),
  });
}

function freezeFont(
  request: string,
  face: ResolvedFont,
): { readonly bytes: Uint8Array; readonly metadata: FrozenFontMetadata } {
  const owned = verifyAndOwnBytes(face.data);
  return Object.freeze({
    bytes: owned.bytes,
    metadata: Object.freeze({
      request,
      family: face.family,
      weight: face.weight,
      style: face.style,
      mimeType: fontMimeType(owned.bytes),
      byteLength: owned.byteLength,
      sha256: owned.sha256,
    }),
  });
}

function fontMimeType(bytes: Uint8Array): string {
  const signature = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  return signature === 0x4f54544f ? "font/otf"
    : signature === 0x74746366 ? "font/collection" : "font/ttf";
}

function dataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function normalizeMimeType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(normalized)) {
    throw new TypeError(`invalid MIME type ${JSON.stringify(value)}`);
  }
  return normalized;
}

function guessMimeType(url: string): string {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  if (/\.svg$/i.test(pathname)) return "image/svg+xml";
  if (/\.jpe?g$/i.test(pathname)) return "image/jpeg";
  if (/\.webp$/i.test(pathname)) return "image/webp";
  if (/\.gif$/i.test(pathname)) return "image/gif";
  if (/\.mp4$/i.test(pathname)) return "video/mp4";
  if (/\.webm$/i.test(pathname)) return "video/webm";
  if (/\.mp3$/i.test(pathname)) return "audio/mpeg";
  if (/\.wav$/i.test(pathname)) return "audio/wav";
  return "application/octet-stream";
}

function kindFromMimeType(mimeType: string): FrozenAssetMetadata["kind"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "other";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
