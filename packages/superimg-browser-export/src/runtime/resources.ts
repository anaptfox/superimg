import { prepareBrowserFontFace, assetMetadataFromFrozen, bytesDataUrl, cancellationError, fontFaceCss, isAbortError, raceSignal, resolveRuntimeFonts, type ResolvedFont } from "@superimg/core/edge";
import { verifyAndOwnBytes } from "@superimg/core/runtime";
import type {
  AssetDeclaration,
  AssetMeta,
  DeterministicMediaDefinition,
  FrozenAssetMetadata,
  FrozenFontMetadata,
  JsonObject,
  RuntimeFinding,
} from "@superimg/types";

export type RuntimeFetch = typeof globalThis.fetch;

export interface PreparedRuntimeResources {
  readonly findings: readonly RuntimeFinding[];
  readonly assets: readonly FrozenAssetMetadata[];
  readonly fonts: readonly FrozenFontMetadata[];
  readonly assetUrls: Readonly<Record<string, string>>;
  readonly assetMetadata: Readonly<Record<string, AssetMeta>>;
  readonly fontBuffers: readonly Uint8Array[];
  readonly fontCss: readonly string[];
}

export async function prepareRuntimeResources(
  media: DeterministicMediaDefinition<JsonObject>,
  fetcher: RuntimeFetch,
  signal?: AbortSignal,
  defaultFonts?: import("@superimg/types").InitOptions["defaultFonts"],
): Promise<PreparedRuntimeResources> {
  const findings: RuntimeFinding[] = [];
  const assets: FrozenAssetMetadata[] = [];
  const frozenFonts: FrozenFontMetadata[] = [];
  let frozenAssetRecords: Awaited<ReturnType<typeof freezeAsset>>[] = [];
  const fontBuffers: Uint8Array[] = [];

  for (const [name, declaration] of Object.entries(media.config?.assets ?? {})) {
    if (signal?.aborted) throw cancellationError();
    try {
      const frozen = await freezeAsset(name, declaration, fetcher, signal);
      assets.push(frozen.metadata);
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

  // Metadata operations own and validate bytes but never serialize a projection.
  let assetProjection: { urls: Readonly<Record<string, string>>; metadata: Readonly<Record<string, AssetMeta>> } | undefined;
  let fontCss: readonly string[] | undefined;
  const materializeAssets = () => {
    if (signal?.aborted) throw cancellationError();
    if (assetProjection !== undefined) return assetProjection;
    const urls: Record<string, string> = {};
    const metadata: Record<string, AssetMeta> = {};
    for (const frozen of frozenAssetRecords) {
      const url = bytesDataUrl(frozen.bytes, frozen.metadata.mimeType);
      urls[frozen.metadata.name] = url;
      metadata[frozen.metadata.name] = assetMetadataFromFrozen(frozen.metadata, url);
    }
    frozenAssetRecords = [];
    return assetProjection = { urls: Object.freeze(urls), metadata: Object.freeze(metadata) };
  };
  if (signal?.aborted) throw cancellationError();
  return Object.freeze({
    findings: Object.freeze(findings),
    assets: Object.freeze(assets),
    fonts: Object.freeze(frozenFonts),
    get assetUrls() { return materializeAssets().urls; },
    get assetMetadata() { return materializeAssets().metadata; },
    fontBuffers: Object.freeze(fontBuffers),
    get fontCss() {
      if (signal?.aborted) throw cancellationError();
      return fontCss ??= Object.freeze(frozenFonts.map((font, index) => {
        const { bytes, mimeType } = prepareBrowserFontFace(fontBuffers[index]!, font);
        return fontFaceCss({ ...font, mimeType }, bytesDataUrl(bytes, mimeType));
      }));
    },
  });
}

async function freezeAsset(name: string, declaration: AssetDeclaration, fetcher: RuntimeFetch, signal?: AbortSignal) {
  let bytes: Uint8Array;
  let mimeType: string;
  if ("bytes" in declaration) {
    bytes = declaration.bytes;
    mimeType = normalizeMimeType(declaration.mimeType);
  } else {
    const response = await raceSignal(
      fetcher(String(declaration.url), { ...(signal !== undefined ? { signal } : {}) }),
      signal,
    );
    if (!response.ok) throw new Error(`request failed with status ${response.status}`);
    bytes = new Uint8Array(await raceSignal(response.arrayBuffer(), signal));
    mimeType = normalizeMimeType(response.headers.get("content-type")?.split(";", 1)[0] ?? guessMimeType(String(declaration.url)));
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
    } satisfies FrozenAssetMetadata),
  });
}

function freezeFont(request: string, face: ResolvedFont) {
  const owned = verifyAndOwnBytes(face.data);
  return Object.freeze({
    bytes: owned.bytes,
    metadata: Object.freeze({
      request,
      family: face.family,
      weight: face.weight,
      style: face.style,
      mimeType: face.mimeType ?? "font/ttf",
      byteLength: owned.byteLength,
      sha256: owned.sha256,
    } satisfies FrozenFontMetadata),
  });
}


function normalizeMimeType(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(normalized)) throw new TypeError(`invalid MIME type ${JSON.stringify(value)}`);
  return normalized;
}

function guessMimeType(url: string): string {
  if (/\.svg(?:$|[?#])/i.test(url)) return "image/svg+xml";
  if (/\.jpe?g(?:$|[?#])/i.test(url)) return "image/jpeg";
  if (/\.webp(?:$|[?#])/i.test(url)) return "image/webp";
  if (/\.gif(?:$|[?#])/i.test(url)) return "image/gif";
  if (/\.mp4(?:$|[?#])/i.test(url)) return "video/mp4";
  if (/\.webm(?:$|[?#])/i.test(url)) return "video/webm";
  if (/\.mp3(?:$|[?#])/i.test(url)) return "audio/mpeg";
  if (/\.wav(?:$|[?#])/i.test(url)) return "audio/wav";
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
