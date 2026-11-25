import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { compileTemplate } from "@superimg/core";
import { bundleTemplateCodeWithMap } from "@superimg/core/bundler";
import { artifactAudioKey, compileMediaArtifact } from "@superimg/core/ir-node";
import type {
  AudioValue,
  AudioClip,
  DeterministicMediaDefinition,
  JsonObject,
  MediaIRAsset,
} from "@superimg/types";
import type {
  MediaArtifactCompileInteractionInput,
  MediaArtifactCompileReceipt,
  MediaCollectionSnapshot,
  MediaJsonObject,
} from "../contracts.js";
import { normalizeProjectRoot, resolveMediaSource } from "./discovery.js";
import { assertSnapshotCurrent, snapshotCollection } from "./provider.js";
import {
  compileNodeMediaSource,
  type NodeMediaAuthoringOptions,
} from "./source.js";
import {
  resolveMediaTargetPath,
  type MediaTargetRegistry,
} from "./targets.js";

export async function compileNodeMediaArtifact<Context>(args: NodeMediaAuthoringOptions & Readonly<{
  projectRoot: string;
  input: MediaArtifactCompileInteractionInput;
  context: Context;
  targets: MediaTargetRegistry<Context>;
  signal?: AbortSignal;
}>): Promise<MediaArtifactCompileReceipt> {
  const root = normalizeProjectRoot(args.projectRoot);
  throwIfAborted(args.signal);
  const source = resolveMediaSource(root, args.input.source);
  const loaded = await compileNodeMediaSource(root, source, {
    ...(args.signal === undefined ? {} : { signal: args.signal }),
    ...(args.sourceAnalysis === undefined
      ? {}
      : { sourceAnalysis: args.sourceAnalysis }),
    ...(args.authoringFacades === undefined
      ? {}
      : { authoringFacades: args.authoringFacades }),
  });
  let programCode = loaded.bundle.code;
  let compiledMedia = loaded.compiled.media;
  if (loaded.compiled.interactive) {
    if (loaded.compiled.interactive.sample === undefined) {
      throw new Error("Offline interactive compile requires explicit sample/default data");
    }
    const offline = await bundleInteractiveOfflineProgram(
      source.templatePath,
      args.authoringFacades,
    );
    const lowered = compileTemplate(offline);
    if (lowered.error || !lowered.media) {
      throw lowered.error ?? new Error("Interactive definition could not lower for offline compile");
    }
    programCode = offline.code;
    compiledMedia = lowered.media;
  }
  if (!compiledMedia) throw new Error(`Media source did not compile: ${source.relativePath}`);
  const media = compiledMedia as DeterministicMediaDefinition<JsonObject>;
  let data = args.input.data;
  let entryId = args.input.entryId;
  if (loaded.descriptor.kind === "collection") {
    let snapshot: MediaCollectionSnapshot;
    if (args.input.snapshot !== undefined) {
      assertSnapshotCurrent(args.input.snapshot, loaded.descriptor, source, root);
      snapshot = args.input.snapshot;
    } else {
      if (loaded.descriptor.entries.kind === "provider") {
        throw new Error("Provider collection artifact compilation requires an exact snapshot");
      }
      snapshot = await snapshotCollection(loaded.descriptor, source, root, {
        ...(args.signal === undefined ? {} : { signal: args.signal }),
      });
    }
    if (args.input.data !== undefined) {
      throw new Error("Collection artifacts derive data from their frozen snapshot entry");
    }
    if (entryId === undefined) {
      if (snapshot.entries.length !== 1) {
        throw new Error("Collection artifact compilation requires one entryId");
      }
      entryId = snapshot.entries[0]!.id;
    }
    const entry = snapshot.entries.find((candidate) => candidate.id === entryId);
    if (!entry) throw new Error(`Collection snapshot has no entry ${JSON.stringify(entryId)}`);
    data = entry.data;
  } else if (args.input.snapshot !== undefined || args.input.entryId !== undefined) {
    throw new Error("snapshot and entryId are only valid for collection artifacts");
  }

  const target = await args.targets.resolve({
    kind: "artifact",
    targetId: args.input.target.targetId,
    context: args.context,
  });
  const outDir = resolveMediaTargetPath(target, args.input.target.artifactId);
  const inspected = await inspectArtifactAssets(media, source.templatePath, root, args.signal);
  try {
    const artifact = await compileMediaArtifact(media, {
      outDir,
      programCode,
      ...(args.input.artifactSchemaVersion === undefined ? {} : { artifactSchemaVersion: args.input.artifactSchemaVersion }),
      sourceId: source.sourceId,
      ...(data === undefined ? {} : { data }),
      ...(entryId === undefined ? {} : { entryId }),
      ...(args.input.variantId === undefined ? {} : { variantId: args.input.variantId }),
      ...(args.input.editionId === undefined ? {} : { editionId: args.input.editionId }),
      additionalAssets: inspected.additionalAssets,
      localAssets: inspected.localAssets,
      verify: args.input.verify === true || args.input.strict === true,
      strictIds: args.input.strict === true,
      ...(args.signal === undefined ? {} : { signal: args.signal }),
    });
    const manifest = portableObject(artifact.manifest);
    return Object.freeze({
      schemaVersion: 0,
      kind: "media-artifact",
      targetId: args.input.target.targetId,
      artifactId: args.input.target.artifactId,
      artifactHash: artifact.manifest.artifactHash,
      programHash: artifact.media.hashes.programHash,
      intentHash: artifact.media.hashes.intentHash,
      markupHash: artifact.media.hashes.markupHash,
      coordinates: portableObject(artifact.media.identity),
      manifest,
    });
  } finally {
    // The complete artifact may already be atomically visible. A stale private
    // temp directory is safer than reporting a failed compile after commit.
    await inspected.dispose().catch(() => undefined);
  }
}

/** Bundle the interactive-owned lowering into one self-contained offline program. */
async function bundleInteractiveOfflineProgram(
  templatePath: string,
  authoringFacades: NodeMediaAuthoringOptions["authoringFacades"],
) {
  const source = [
    `import definition from ${JSON.stringify(templatePath)};`,
    'import { lowerInteractiveDefinition } from "@foxworth/superimg/interactive/define";',
    "export default lowerInteractiveDefinition(definition);",
  ].join("\n");
  return bundleTemplateCodeWithMap(source, {
    resolveDir: dirname(templatePath),
    sourcefile: `${templatePath}.offline.ts`,
    ...(authoringFacades === undefined ? {} : { authoringFacades }),
  });
}

type InspectedArtifactAssets = Readonly<{
  additionalAssets: MediaIRAsset[];
  localAssets: Record<string, Readonly<{ path: string; aliases: string[] }>>;
  dispose(): Promise<void>;
}>;

async function inspectArtifactAssets(
  media: DeterministicMediaDefinition<JsonObject>,
  sourcePath: string,
  projectRoot: string,
  signal?: AbortSignal,
): Promise<InspectedArtifactAssets> {
  const root = await realpath(projectRoot);
  const sourceDirectory = dirname(await realpath(sourcePath));
  const additionalAssets: MediaIRAsset[] = [];
  const localAssets: Record<string, Readonly<{ path: string; aliases: string[] }>> = {};
  let temporaryRoot: string | undefined;
  const add = async (id: string, src: string, aliases: string[] = []): Promise<void> => {
    if (remote(src) || src.startsWith("data:")) return;
    const path = src.toLocaleLowerCase("en-US").startsWith("file:")
      ? fileURLToPath(new URL(src))
      : isAbsolute(src) ? resolve(src) : resolve(sourceDirectory, src);
    throwIfAborted(signal);
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`Artifact asset must be a regular non-symlink file: ${path}`);
    }
    const canonical = await realpath(path);
    assertContained(root, canonical);
    const bytes = await readFile(canonical, signal === undefined ? undefined : { signal });
    const canonicalSource = relative(sourceDirectory, canonical).split(sep).join("/");
    additionalAssets.push({
      id,
      kind: assetKind(canonical),
      src: canonicalSource,
      remote: false,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
    });
    localAssets[id] = {
      path: canonical,
      aliases: [...new Set([
        ...(!isAbsolute(src) && !src.toLocaleLowerCase("en-US").startsWith("file:")
          ? [src]
          : []),
        canonicalSource,
        ...aliases,
      ])],
    };
  };

  try {
    for (const [name, declaration] of Object.entries(media.config?.assets ?? {})) {
      if ("url" in declaration) {
        const src = String(declaration.url);
        await add(`asset:${name}`, src, [name]);
      } else {
        temporaryRoot ??= await mkdtemp(join(tmpdir(), "superimg-artifact-assets-"));
        const hash = createHash("sha256").update(declaration.bytes).digest("hex");
        const path = join(temporaryRoot, `${hash}-${safeFilename(name)}`);
        await writeFile(path, declaration.bytes);
        localAssets[`asset:${name}`] = {
          path,
          aliases: [name, `bytes:${hash}`],
        };
      }
    }
    for (const [index, font] of (media.config?.fonts ?? []).entries()) {
      if ("src" in font && typeof font.src === "string" && !remote(font.src) && !font.src.startsWith("data:")) {
        await add(`font:${index}`, font.src);
      }
    }
    const background = media.config?.background;
    if (background !== undefined) {
      const src = typeof background === "string" ? background : background.src;
      if (!/^(?:#|rgba?\(|hsla?\()/i.test(src)) await add("background", src);
    }
    const watermark = media.config?.watermark;
    if (typeof watermark === "string") {
      await add("watermark", watermark);
    } else if (watermark?.type === "image") {
      await add("watermark", watermark.content);
    }
    const audioKeys = new Map<string, string>();
    for (const [index, clip] of flattenAudio(media.config?.audio).entries()) {
      const id = artifactAudioKey(clip, index);
      const previous = audioKeys.get(id);
      if (previous !== undefined && previous !== clip.src) throw new TypeError(`Ambiguous artifact audio binding: ${id}`);
      if (previous !== undefined) continue;
      audioKeys.set(id, clip.src);
      await add(id, clip.src);
    }
    for (const [index, stylesheet] of (media.config?.stylesheets ?? []).entries()) {
      await add(`stylesheet:${index}`, stylesheet);
    }
    const cssUrl = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    for (const [cssIndex, css] of (media.config?.inlineCss ?? []).entries()) {
      let match: RegExpExecArray | null;
      let urlIndex = 0;
      while ((match = cssUrl.exec(css))) {
        const src = match[2]!;
        if (!src.startsWith("#")) await add(`inline-css:${cssIndex}:${urlIndex++}`, src);
      }
    }
    const assetsDirectory = join(sourceDirectory, "assets");
    const directory = await lstat(assetsDirectory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (directory !== undefined) {
      if (directory.isSymbolicLink() || !directory.isDirectory()) {
        throw new Error(`Artifact assets must be a regular directory: ${assetsDirectory}`);
      }
      for (const path of await filesWithin(assetsDirectory, signal)) {
        const name = relative(assetsDirectory, path).split(sep).join("/");
        if (Object.prototype.hasOwnProperty.call(media.config?.assets ?? {}, name)) continue;
        await add(`discovered:${name}`, path, [name]);
      }
    }
    additionalAssets.sort((left, right) => left.id.localeCompare(right.id));
    return {
      additionalAssets,
      localAssets,
      async dispose() {
        if (temporaryRoot !== undefined) {
          await rm(temporaryRoot, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    if (temporaryRoot !== undefined) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
    throw error;
  }
}

async function filesWithin(root: string, signal?: AbortSignal): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      throwIfAborted(signal);
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Artifact assets cannot contain symlinks: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  await visit(root);
  return files.sort();
}

function assetKind(path: string): MediaIRAsset["kind"] {
  if (/\.(?:mp4|webm|mov)$/i.test(path)) return "video";
  if (/\.(?:mp3|wav|ogg|m4a)$/i.test(path)) return "audio";
  if (/\.(?:png|jpe?g|gif|webp|svg|avif)$/i.test(path)) return "image";
  if (/\.(?:woff2?|ttf|otf)$/i.test(path)) return "font";
  return "other";
}

function flattenAudio(
  value: AudioValue | undefined,
): AudioClip[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && "clips" in value) return value.clips;
  return [value];
}

function remote(src: string): boolean {
  return /^(?:https?:)?\/\//i.test(src);
}

function safeFilename(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "asset";
}

function assertContained(root: string, path: string): void {
  const back = relative(root, path);
  if (back === "" || (!back.startsWith(`..${sep}`) && back !== ".." && !isAbsolute(back))) return;
  throw new Error(`Artifact asset must stay inside the project root: ${path}`);
}

function portableObject(value: unknown): MediaJsonObject {
  return JSON.parse(JSON.stringify(value)) as MediaJsonObject;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError");
}
