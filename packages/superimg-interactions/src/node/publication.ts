import { publishDirectory } from "@superimg/node/narration";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { ORGANIC_DESTINATIONS } from "@superimg/core/destinations";
import type { ExportBundle, ExportArtifact } from "@superimg/types";
import type {
  MediaCollectionSnapshot,
  MediaExportInteractionInput,
  MediaExportReceipt,
  MediaJsonObject,
} from "../contracts.js";
import { hashJson } from "./provider.js";

export type PublishPortableBundleOptions = Readonly<{
  bundle: ExportBundle;
  finalPath: string;
  targetId: string;
  publicationId: string;
  sourceId: string;
  request: MediaExportInteractionInput;
  snapshot?: MediaCollectionSnapshot;
  /** Optional host provenance for value-first inputs; no local paths. */
  inputIdentity?: Readonly<{ schemaVersion: 1; kind: "arrangement"; digest: string }>;
  stillSelection?: Readonly<{ requestedSeconds: number; frame: number; encodedSeconds: number; origin: string; artifacts: readonly string[] }>;
  producerVersion: string;
  signal?: AbortSignal;
  /** Host observation only; publication may have an uncertain outcome after this point. */
  onCommitStart?: () => void;
}>;

/** Consume a portable Runtime bundle and atomically publish a durable host receipt. */
export async function publishPortableBundle(
  options: PublishPortableBundleOptions,
): Promise<MediaExportReceipt> {
  const finalPath = resolve(options.finalPath);
  const parent = dirname(finalPath);
  if (finalPath === parent) throw new Error("Refusing to publish over a filesystem root");
  await mkdir(parent, { recursive: true });
  const stagingPath = await mkdtemp(join(parent, `.${basename(finalPath)}.staging-`));
  const backupPath = join(parent, `.${basename(finalPath)}.backup-${randomUUID()}`);
  const publishedPaths = new Set<string>();
  try {
    for (const artifact of options.bundle.artifacts) {
      throwIfAborted(options.signal);
      const relativePath = `media/${assertPortablePath(artifact.path)}`;
      const folded = relativePath.normalize("NFC").toLocaleLowerCase("en-US");
      if (publishedPaths.has(folded)) {
        throw new Error(`Portable bundle paths collide at ${relativePath}`);
      }
      publishedPaths.add(folded);
      const path = confinedPath(stagingPath, relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeArtifact(path, artifact, options.signal);
    }

    const manifest = portableManifest(options);
    await writeFile(
      join(stagingPath, "export.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    options.onCommitStart?.();
    publishDirectory(stagingPath, finalPath, backupPath);
    return Object.freeze({
      schemaVersion: 0,
      targetId: options.targetId,
      publicationId: options.publicationId,
      manifestDigest: hashJson(manifest),
      manifest,
    });
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

function portableManifest(options: PublishPortableBundleOptions): MediaJsonObject {
  const entries = options.snapshot?.entries.map((entry) => ({
    id: entry.id,
    dataDigest: entry.dataDigest,
  })) ?? [];
  const manifest = {
    schemaVersion: 0,
    kind: "media-export",
    sourceId: options.sourceId,
    publication: {
      targetId: options.targetId,
      publicationId: options.publicationId,
    },
    requestDigest: hashJson({
      sourceId: options.sourceId,
      targetId: options.targetId,
      publicationId: options.publicationId,
      destinations: options.request.destinations,
      entryIds: options.request.entryIds ?? [],
      variantIds: options.request.variantIds ?? [],
      editionIds: options.request.editionIds ?? [],
      stillFrame: options.request.stillFrame ?? null,
      encoding: options.request.encoding ?? null,
      snapshotDigest: options.snapshot?.snapshotDigest ?? null,
      providerHash: options.snapshot?.providerHash ?? null,
      programDigest: options.bundle.manifest.programDigest,
      ...(options.inputIdentity === undefined ? {} : { inputIdentity: options.inputIdentity }),
      ...(options.stillSelection === undefined ? {} : { stillSelection: options.stillSelection }),
    }),
    ...(options.inputIdentity === undefined ? {} : { inputIdentity: options.inputIdentity }),
    ...(options.stillSelection === undefined ? {} : { stillSelection: options.stillSelection }),
    destinationRegistryDigest: hashJson(ORGANIC_DESTINATIONS),
    ...(options.snapshot === undefined
      ? {}
      : {
          snapshotDigest: options.snapshot.snapshotDigest,
          providerHash: options.snapshot.providerHash,
        }),
    producer: { name: "superimg", version: options.producerVersion },
    entries,
    runtime: options.bundle.manifest,
    renditions: options.bundle.artifacts.map((artifact) => ({
      coordinates: {
        sourceId: options.sourceId,
        ...(artifact.coordinates.entryId === undefined
          ? {}
          : { entryId: artifact.coordinates.entryId }),
        variantId: artifact.coordinates.variantId,
        editionId: artifact.coordinates.editionId,
        renditionId: artifact.coordinates.renditionId,
      },
      path: `media/${artifact.path}`,
      mimeType: artifact.mimeType,
      bytes: artifact.byteLength,
      sha256: artifact.sha256,
    })),
  };
  return JSON.parse(JSON.stringify(manifest)) as MediaJsonObject;
}

async function writeArtifact(
  path: string,
  artifact: ExportArtifact,
  signal: AbortSignal | undefined,
): Promise<void> {
  const reader = artifact.stream().getReader();
  const file = await open(path, "wx");
  const hash = createHash("sha256");
  let byteLength = 0;
  let complete = false;
  try {
    for (;;) {
      throwIfAborted(signal);
      const next = await reader.read();
      if (next.done) break;
      if (next.value !== undefined) {
        const copy = next.value.slice();
        byteLength += copy.byteLength;
        hash.update(copy);
        let offset = 0;
        while (offset < copy.byteLength) {
          const result = await file.write(copy, offset, copy.byteLength - offset);
          if (result.bytesWritten <= 0) {
            throw new Error(`Could not write portable artifact ${artifact.path}`);
          }
          offset += result.bytesWritten;
        }
      }
    }
    const sha256 = hash.digest("hex");
    if (byteLength !== artifact.byteLength || sha256 !== artifact.sha256) {
      throw new Error(`Portable artifact bytes do not match ${artifact.path}`);
    }
    complete = true;
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    await file.close();
    if (!complete) await rm(path, { force: true });
  }
}

function assertPortablePath(path: string): string {
  if (
    !path || path.startsWith("/") || path.endsWith("/") || path.includes("\\") ||
    path.includes("\0") || path.includes(":") || path.includes("?") || path.includes("#")
  ) {
    throw new Error(`Invalid portable artifact path ${JSON.stringify(path)}`);
  }
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Portable artifact path escapes publication: ${JSON.stringify(path)}`);
  }
  return path;
}

function confinedPath(root: string, relativePath: string): string {
  const absoluteRoot = resolve(root);
  const path = resolve(absoluteRoot, relativePath);
  const back = relative(absoluteRoot, path);
  if (!back || back === ".." || back.startsWith(`..${sep}`)) {
    throw new Error(`Artifact path escapes staging: ${JSON.stringify(relativePath)}`);
  }
  return path;
}

export { publishDirectory } from "@superimg/node/narration";

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error("Media export cancelled");
}
