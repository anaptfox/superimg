import { createHash } from "node:crypto";
import { builtinModules } from "node:module";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseSync } from "oxc-parser";
import type { CollectionSourceDescriptor } from "@superimg/core/source-analysis";
import { loadCollectionEntries } from "../collection/index.js";
import { snapshotDataToMediaJson, type MediaCollectionSnapshot, type MediaJsonObject } from "./snapshot.js";
import type { ResolvedMediaSource } from "./project.js";

const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
const SAFE_ENTRY_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const NODE_BUILTINS = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);
const LOCKFILES = [
  "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb",
] as const;

export type ProviderExecutionOptions = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
}>;

export async function snapshotCollection(
  descriptor: CollectionSourceDescriptor,
  source: ResolvedMediaSource,
  projectRoot: string,
  options: ProviderExecutionOptions = {},
): Promise<MediaCollectionSnapshot> {
  const providerHash = providerDigest(descriptor, projectRoot);
  const entries = await loadCollectionEntries<Record<string, unknown>>(descriptor, {
    timeoutMs: options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  const base = {
    schemaVersion: 0 as const,
    kind: "media-collection-snapshot" as const,
    source: source.relativePath,
    sourceId: source.sourceId,
    providerHash,
    entries: entries.map((entry) => ({
      id: entry.id,
      data: portableObject(entry.data),
      dataDigest: entry.dataDigest,
    })),
  };
  return Object.freeze({ ...base, snapshotDigest: hashJson(base) });
}

export function assertSnapshotCurrent(
  snapshot: MediaCollectionSnapshot,
  descriptor: CollectionSourceDescriptor,
  source: ResolvedMediaSource,
  projectRoot: string,
): void {
  if (snapshot.source !== source.relativePath || snapshot.sourceId !== source.sourceId) {
    throw new Error("Collection snapshot belongs to a different media source");
  }
  validateSnapshotEntries(snapshot);
  const { snapshotDigest, ...base } = snapshot;
  if (hashJson(base) !== snapshotDigest) {
    throw new Error("Collection snapshot digest does not match its entries");
  }
  if (providerDigest(descriptor, projectRoot) !== snapshot.providerHash) {
    throw new Error("Collection provider changed after the snapshot was created");
  }
}

function validateSnapshotEntries(snapshot: MediaCollectionSnapshot): void {
  const seen = new Map<string, string>();
  for (const entry of snapshot.entries) {
    snapshotDataToMediaJson(entry.data);
    const windowsStem = entry.id.split(".", 1)[0]?.toLocaleUpperCase("en-US") ?? "";
    if (
      entry.id !== entry.id.trim() ||
      !SAFE_ENTRY_ID.test(entry.id) ||
      /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsStem)
    ) {
      throw new Error(`Collection snapshot entry id is not path-safe: ${JSON.stringify(entry.id)}`);
    }
    const folded = entry.id.normalize("NFC").toLocaleLowerCase("en-US");
    const previous = seen.get(folded);
    if (previous !== undefined) {
      throw new Error(
        `Collection snapshot entry ids ${JSON.stringify(previous)} and ${JSON.stringify(entry.id)} collide`,
      );
    }
    seen.set(folded, entry.id);
    if (hashJson(entry.data) !== entry.dataDigest) {
      throw new Error(`Collection snapshot entry data digest does not match ${entry.id}`);
    }
  }
}

export function providerDigest(
  descriptor: CollectionSourceDescriptor,
  projectRoot: string,
): string {
  const graph = providerGraph(descriptor, projectRoot);
  return hashJson({
    projection: descriptor.entriesProjection.code,
    files: graph.files.map(fingerprint),
    dependencies: graph.dependencyFiles.map(fingerprint),
    externalModules: graph.externalModules,
    platformCapabilities: graph.platformCapabilities,
  });
}

export function hashJson(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function providerGraph(descriptor: CollectionSourceDescriptor, projectRoot: string) {
  const modules = new Set<string>();
  if (descriptor.entries.kind === "provider") modules.add(descriptor.entries.import.module);
  if (descriptor.entryId?.kind === "imported-function") {
    modules.add(descriptor.entryId.import.module);
  }
  const files = new Set<string>();
  const externalModules = new Set<string>();
  const platformCapabilities = new Set<string>();
  const visitModule = (directory: string, moduleName: string): void => {
    if (!moduleName.startsWith(".") && !isAbsolute(moduleName)) {
      if (NODE_BUILTINS.has(moduleName)) platformCapabilities.add(moduleName);
      else externalModules.add(moduleName);
      return;
    }
    const file = resolveModuleFile(directory, moduleName);
    if (!file || files.has(file)) return;
    files.add(file);
    for (const imported of staticModuleSpecifiers(readFileSync(file, "utf8"), file)) {
      visitModule(dirname(file), imported);
    }
  };
  for (const moduleName of modules) visitModule(dirname(descriptor.filename), moduleName);
  return {
    files: [...files].sort(),
    dependencyFiles: externalModules.size === 0
      ? []
      : dependencyMetadata(descriptor.filename, projectRoot),
    externalModules: [...externalModules].sort(),
    platformCapabilities: [...platformCapabilities].sort(),
  };
}

function staticModuleSpecifiers(source: string, filename: string): string[] {
  const parsed = parseSync(filename, source, { sourceType: "module" });
  const specifiers = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (
      node.type === "ImportDeclaration" ||
      node.type === "ExportNamedDeclaration" ||
      node.type === "ExportAllDeclaration" ||
      node.type === "ImportExpression"
    ) {
      const sourceNode = node.source as { value?: unknown } | undefined;
      if (typeof sourceNode?.value === "string") specifiers.add(sourceNode.value);
    }
    for (const [key, child] of Object.entries(node)) if (key !== "parent") visit(child);
  };
  visit(parsed.program);
  return [...specifiers].sort();
}

function resolveModuleFile(directory: string, moduleName: string): string | undefined {
  const base = resolve(directory, moduleName);
  const candidates = [
    base, `${base}.ts`, `${base}.mts`, `${base}.cts`, `${base}.js`, `${base}.mjs`,
    `${base}.cjs`, join(base, "index.ts"), join(base, "index.mts"),
    join(base, "index.js"), join(base, "index.mjs"),
  ];
  return candidates.find((candidate) =>
    existsSync(candidate) && lstatSync(candidate).isFile() &&
    !lstatSync(candidate).isSymbolicLink()
  );
}

function dependencyMetadata(filename: string, projectRoot: string): string[] {
  const root = realpathSync(projectRoot);
  let current = dirname(filename);
  let packageDirectory: string | undefined;
  while (inside(root, current)) {
    const manifest = join(current, "package.json");
    if (existsSync(manifest) && lstatSync(manifest).isFile()) {
      packageDirectory = current;
      break;
    }
    if (current === root) break;
    current = dirname(current);
  }
  if (!packageDirectory) {
    throw new Error("Collection package imports require a project package.json");
  }
  const metadata = new Set<string>([join(packageDirectory, "package.json")]);
  current = packageDirectory;
  while (inside(root, current)) {
    for (const lockfile of LOCKFILES) {
      const path = join(current, lockfile);
      if (existsSync(path) && lstatSync(path).isFile()) metadata.add(path);
    }
    if (current === root) break;
    current = dirname(current);
  }
  return [...metadata].sort();
}

function inside(root: string, candidate: string): boolean {
  const back = relative(root, candidate);
  return back === "" || (!back.startsWith(`..${sep}`) && back !== ".." && !isAbsolute(back));
}

function fingerprint(path: string) {
  const resolved = realpathSync(path);
  const bytes = readFileSync(resolved);
  return {
    path: resolved,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function portableObject(value: unknown): MediaJsonObject {
  // The provider worker already validates JSON before IPC. Use the same owned
  // clone as reused snapshots rather than silently normalizing a second time.
  return snapshotDataToMediaJson(value);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
    .join(",")}}`;
}
