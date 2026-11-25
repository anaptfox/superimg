import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AssetDeclaration,
  AudioClip,
  AudioValue,
  DeterministicMediaDefinition,
  FontInput,
} from "@superimg/types";

/**
 * Freeze host-relative asset references into path-free declarations before the
 * value runtime sees them. Co-located `assets/` files retain their relative
 * names so `ctx.asset(name)` resolves without exposing a source path.
 */
export async function materializeNodeMediaAssets<TData>(
  media: DeterministicMediaDefinition<TData>,
  sourcePath: string,
  projectRoot: string,
  signal?: AbortSignal,
): Promise<DeterministicMediaDefinition<TData>> {
  const root = await realpath(resolve(projectRoot));
  const canonicalSource = await realpath(resolve(sourcePath));
  assertContained(root, canonicalSource, "Media source");
  const sourceDirectory = dirname(canonicalSource);
  const declared = media.config?.assets ?? {};
  const assets: Record<string, AssetDeclaration> = {};
  const reads = new Map<string, Promise<Uint8Array>>();
  let changed = false;

  // Source hosts know the base directory; the value runtime intentionally does not.
  let fonts = media.config?.fonts;
  if (fonts !== undefined) {
    const resolvedFonts: FontInput[] = [];
    for (const font of fonts) {
      throwIfAborted(signal);
      const localPath = "kind" in font || typeof font.src !== "string"
        ? undefined
        : localAssetPath(font.src, sourceDirectory);
      if (localPath === undefined || "kind" in font) resolvedFonts.push(font);
      else {
        resolvedFonts.push({ ...font, src: await readOwnedAsset(localPath, root, reads, signal) });
        changed = true;
      }
    }
    if (changed) fonts = resolvedFonts;
  }

  for (const [name, declaration] of Object.entries(declared)) {
    throwIfAborted(signal);
    if ("bytes" in declaration) {
      assets[name] = declaration;
      continue;
    }
    const localPath = localAssetPath(declaration.url, sourceDirectory);
    if (localPath === undefined) {
      assets[name] = declaration;
      continue;
    }
    assets[name] = {
      bytes: await readOwnedAsset(localPath, root, reads, signal),
      mimeType: mimeTypeFor(localPath),
      ...(declaration.type === undefined ? {} : { type: declaration.type }),
    };
    changed = true;
  }

  let audio = media.config?.audio;
  if (audio !== undefined) {
    const materialized = await materializeAudio(
      audio,
      sourceDirectory,
      root,
      reads,
      signal,
    );
    audio = materialized.value;
    changed ||= materialized.changed;
  }

  const assetsDirectory = join(sourceDirectory, "assets");
  for (const file of await discoverCoLocatedAssets(assetsDirectory, root, signal)) {
    if (Object.prototype.hasOwnProperty.call(assets, file.name)) continue;
    assets[file.name] = {
      bytes: await readOwnedAsset(file.path, root, reads, signal),
      mimeType: mimeTypeFor(file.path),
    };
    changed = true;
  }

  if (!changed) return media;
  return Object.freeze({
    ...media,
    config: Object.freeze({
      ...(media.config ?? {}),
      assets: Object.freeze(assets),
      ...(audio === undefined ? {} : { audio }),
      ...(fonts === undefined ? {} : { fonts }),
    }),
  }) as DeterministicMediaDefinition<TData>;
}

/**
 * List existing local project files declared by a media definition (fonts,
 * explicit assets, audio clips, and co-located `assets/` files) as POSIX paths
 * relative to the media file's directory. Missing, non-regular, symlinked, or
 * out-of-project references are skipped so description remains non-fatal.
 */
export async function listNodeMediaLocalAssets<TData>(
  media: Readonly<{ config?: DeterministicMediaDefinition<TData>["config"] | undefined }>,
  sourcePath: string,
  projectRoot: string,
  signal?: AbortSignal,
): Promise<readonly string[]> {
  throwIfAborted(signal);
  const root = await realpath(resolve(projectRoot));
  const canonicalSource = await realpath(resolve(sourcePath));
  assertContained(root, canonicalSource, "Media source");
  const sourceDirectory = dirname(canonicalSource);

  const candidates = new Set<string>();
  const addCandidate = (ref: string | URL | undefined): void => {
    if (ref === undefined) return;
    const localPath = localAssetPath(ref, sourceDirectory);
    if (localPath !== undefined) candidates.add(localPath);
  };

  for (const font of media.config?.fonts ?? []) {
    if ("kind" in font || typeof font.src !== "string") continue;
    addCandidate(font.src);
  }

  for (const declaration of Object.values(media.config?.assets ?? {})) {
    if ("bytes" in declaration) continue;
    addCandidate(declaration.url);
  }

  const audio = media.config?.audio;
  if (audio !== undefined) {
    const clips = Array.isArray(audio) ? audio : "clips" in audio ? audio.clips : [audio];
    for (const clip of clips) {
      addCandidate(clip.src);
      if (clip.source?.kind === "file") addCandidate(clip.source.src);
    }
  }

  const assetsDirectory = join(sourceDirectory, "assets");
  let coLocated: readonly Readonly<{ name: string; path: string }>[] = [];
  try {
    coLocated = await discoverCoLocatedAssets(assetsDirectory, root, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    coLocated = [];
  }
  for (const file of coLocated) {
    candidates.add(file.path);
  }

  const found = new Set<string>();
  for (const candidate of candidates) {
    throwIfAborted(signal);
    const metadata = await lstat(candidate).catch(() => undefined);
    if (metadata === undefined || metadata.isSymbolicLink() || !metadata.isFile()) continue;
    const canonical = await realpath(candidate).catch(() => undefined);
    if (canonical === undefined || !isContained(root, canonical)) continue;
    const rel = relative(sourceDirectory, canonical).split(sep).join("/");
    if (!rel || rel === ".") continue;
    if (rel.split("/").some((segment) => segment === ".superimg" || segment === "node_modules")) continue;
    found.add(rel);
  }

  return Object.freeze([...found].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
}

async function materializeAudio(
  value: AudioValue,
  sourceDirectory: string,
  projectRoot: string,
  reads: Map<string, Promise<Uint8Array>>,
  signal: AbortSignal | undefined,
): Promise<{ readonly value: AudioValue; readonly changed: boolean }> {
  if (Array.isArray(value)) {
    let changed = false;
    const clips = [];
    for (const clip of value) {
      const materialized = await materializeAudioClip(clip, sourceDirectory, projectRoot, reads, signal);
      clips.push(materialized.value);
      changed ||= materialized.changed;
    }
    return { value: changed ? clips : value, changed };
  }
  if ("clips" in value) {
    let changed = false;
    const clips = [];
    for (const clip of value.clips) {
      const materialized = await materializeAudioClip(clip, sourceDirectory, projectRoot, reads, signal);
      clips.push(materialized.value);
      changed ||= materialized.changed;
    }
    return { value: changed ? { ...value, clips } : value, changed };
  }
  return materializeAudioClip(value, sourceDirectory, projectRoot, reads, signal);
}

async function materializeAudioClip(
  clip: AudioClip,
  sourceDirectory: string,
  projectRoot: string,
  reads: Map<string, Promise<Uint8Array>>,
  signal: AbortSignal | undefined,
): Promise<{ readonly value: AudioClip; readonly changed: boolean }> {
  const source = clip.source;
  if (source?.kind === "file" && !sameAudioFileReference(clip.src, source.src, sourceDirectory)) {
    throw new Error(`Audio clip${clip.id === undefined ? "" : ` "${clip.id}"`} has contradictory src and source.src file references`);
  }

  const localPath = localAssetPath(clip.src, sourceDirectory);
  if (localPath === undefined) return { value: clip, changed: false };
  const bytes = await readOwnedAsset(localPath, projectRoot, reads, signal);
  const src = bytesDataUrl(bytes, mimeTypeFor(localPath));
  const normalizedSource = source?.kind === "file" ? { ...source, src } : source;
  return {
    value: {
      ...clip,
      src,
      ...(normalizedSource === undefined ? {} : { source: normalizedSource }),
    },
    changed: true,
  };
}

function sameAudioFileReference(left: string, right: string, sourceDirectory: string): boolean {
  const leftPath = localAssetPath(left, sourceDirectory);
  const rightPath = localAssetPath(right, sourceDirectory);
  if (leftPath !== undefined || rightPath !== undefined) {
    return leftPath !== undefined && rightPath !== undefined && resolve(leftPath) === resolve(rightPath);
  }
  return left === right;
}

function bytesDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function localAssetPath(value: string | URL, sourceDirectory: string): string | undefined {
  if (value instanceof URL) {
    return value.protocol === "file:" ? fileURLToPath(value) : undefined;
  }
  if (value.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
    if (!value.toLocaleLowerCase("en-US").startsWith("file:")) return undefined;
    return fileURLToPath(new URL(value));
  }
  return resolve(sourceDirectory, value);
}

async function readOwnedAsset(
  path: string,
  projectRoot: string,
  reads: Map<string, Promise<Uint8Array>>,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`Media asset must be a regular non-symlink file: ${path}`);
  }
  const canonical = await realpath(path);
  assertContained(projectRoot, canonical, "Media asset");
  let pending = reads.get(canonical);
  if (pending === undefined) {
    pending = readFile(canonical, signal === undefined ? undefined : { signal }).then(
      (bytes) => new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice(),
    );
    reads.set(canonical, pending);
  }
  return pending;
}

async function discoverCoLocatedAssets(
  directory: string,
  projectRoot: string,
  signal: AbortSignal | undefined,
): Promise<readonly Readonly<{ name: string; path: string }>[]> {
  const rootMetadata = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (rootMetadata === undefined) return [];
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error(`Co-located media assets must be a regular directory: ${directory}`);
  }
  const root = await realpath(directory);
  assertContained(projectRoot, root, "Co-located media asset directory");
  const files: Readonly<{ name: string; path: string }>[] = [];
  const visit = async (current: string): Promise<void> => {
    throwIfAborted(signal);
    for (const entry of await readdir(current, { withFileTypes: true })) {
      throwIfAborted(signal);
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Co-located media assets cannot contain symlinks: ${path}`);
      }
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        const name = relative(root, path).split(sep).join("/");
        files.push(Object.freeze({ name, path }));
      }
    }
  };
  await visit(root);
  return files.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
}

function isContained(root: string, candidate: string): boolean {
  const back = relative(root, candidate);
  return back === "" || (!back.startsWith(`..${sep}`) && back !== ".." && !isAbsolute(back));
}

function assertContained(root: string, candidate: string, label: string): void {
  if (isContained(root, candidate)) {
    return;
  }
  throw new Error(`${label} must stay inside the project root: ${candidate}`);
}

function mimeTypeFor(path: string): string {
  switch (extname(path).toLocaleLowerCase("en-US")) {
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".mov": return "video/quicktime";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".ogg": return "audio/ogg";
    case ".m4a": return "audio/mp4";
    case ".json": return "application/json";
    default: return "application/octet-stream";
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError");
}
