//! Compiled .superimg/ artifact compile / read / integrity (Node fs).

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, dirname, basename, resolve, relative, isAbsolute, extname } from "node:path";
import type {
  CompiledMediaArtifact,
  MediaArtifactManifest,
  MediaIR,
  MediaJob,
  MediaCoordinates,
  TemplateModule,
  TemplateBundle,
  AudioClip,
} from "@superimg/types";
import { isFontDeclaration, isGoogleFontDeclaration } from "@superimg/types";
import { fontIrToken } from "../rendering/fonts.js";
import { MediaIRError } from "./pure/errors.js";
import { hashBytes, serializeMediaIR } from "./pure/serialize.js";
import { validateMediaIR } from "./pure/validate.js";
import { resolveMediaIR, type ResolveMediaIROptions } from "./resolve-media-ir.js";
import { compileTemplate } from "../rendering/compiler.js";
import { parseNativeArtifact, serializeNativeArtifact } from "./native-artifact.js";

export interface CompileMediaArtifactOptions extends ResolveMediaIROptions {
  /** Destination directory ending in `.superimg` (or path to create). */
  outDir: string;
  /** Pre-bundled program source (IIFE or ESM). */
  programCode: string;
  /** Schema 1 admits and retains prepared native module closures. Defaults to 0. */
  artifactSchemaVersion?: 0 | 1;
  /** Optional local asset files to vendor: map logical id → absolute path. */
  localAssets?: Record<
    string,
    string | { path: string; aliases?: string[] }
  >;
  fonts?: Record<string, Uint8Array | string>;
}

/** Stable binding shared by artifact publication and replay. */
export function artifactAudioKey(clip: Pick<AudioClip, "id" | "role">, index: number): string {
  return `audio:${clip.id ?? clip.role ?? "clip"}-${clip.id ? "" : index}`.replace(/-$/, "");
}

const artifactMimeTypes: Readonly<Record<string, string>> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".avi": "video/x-msvideo", ".mkv": "video/x-matroska", ".flv": "video/x-flv", ".wmv": "video/x-ms-wmv", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".aac": "audio/aac", ".m4a": "audio/mp4", ".flac": "audio/flac", ".opus": "audio/opus" };
const artifactMimeType = (path: string) => artifactMimeTypes[extname(path).toLowerCase()] ?? "application/octet-stream";

function safeJoin(root: string, rel: string): string {
  const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.includes("..") || isAbsolute(cleaned)) {
    throw new MediaIRError("path_traversal", `Illegal artifact path: ${rel}`);
  }
  const full = resolve(root, cleaned);
  const relToRoot = relative(root, full);
  if (relToRoot.startsWith("..") || isAbsolute(relToRoot)) {
    throw new MediaIRError("path_traversal", `Path escapes artifact root: ${rel}`);
  }
  return full;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MediaIRError("artifact_integrity", `${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringField(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new MediaIRError(
      "artifact_integrity",
      `${path}.${key} must be a non-empty string`,
    );
  }
  return field;
}

function finiteField(
  value: Record<string, unknown>,
  key: string,
  path: string,
): number {
  const field = value[key];
  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new MediaIRError(
      "artifact_integrity",
      `${path}.${key} must be finite`,
    );
  }
  return field;
}

function validateCoordinates(value: unknown, path: string): MediaCoordinates {
  const coordinates = record(value, path);
  const result: MediaCoordinates = {
    sourceId: stringField(coordinates, "sourceId", path),
    variantId: stringField(coordinates, "variantId", path),
    editionId: stringField(coordinates, "editionId", path),
  };
  if (coordinates.entryId !== undefined) {
    result.entryId = stringField(coordinates, "entryId", path);
  }
  return result;
}

function coordinatesEqual(left: MediaCoordinates, right: MediaCoordinates): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.entryId === right.entryId &&
    left.variantId === right.variantId &&
    left.editionId === right.editionId
  );
}

function validateArtifactManifest(value: unknown): MediaArtifactManifest {
  const manifest = record(value, "artifact.json");
  if (
    manifest.kind !== "@foxworth/superimg/artifact" ||
    (manifest.schemaVersion !== 0 && manifest.schemaVersion !== 1)
  ) {
    throw new MediaIRError("invalid_schema", "Invalid artifact manifest");
  }
  const artifactHash = stringField(
    manifest,
    "artifactHash",
    "artifact.json",
  );
  if (!/^[0-9a-f]{64}$/i.test(artifactHash)) {
    throw new MediaIRError(
      "artifact_integrity",
      "artifact.json.artifactHash must be SHA-256",
    );
  }
  if (!Array.isArray(manifest.files) || manifest.files.length < 3) {
    throw new MediaIRError(
      "artifact_integrity",
      "artifact.json.files must contain media, program, and job",
    );
  }
  const paths = new Set<string>();
  for (const [index, fileValue] of manifest.files.entries()) {
    const file = record(fileValue, `artifact.json.files[${index}]`);
    const path = stringField(file, "path", `artifact.json.files[${index}]`);
    const sha256 = stringField(
      file,
      "sha256",
      `artifact.json.files[${index}]`,
    );
    const bytes = finiteField(
      file,
      "bytes",
      `artifact.json.files[${index}]`,
    );
    if (
      paths.has(path) ||
      !/^[0-9a-f]{64}$/i.test(sha256) ||
      !Number.isInteger(bytes) ||
      bytes < 0
    ) {
      throw new MediaIRError(
        "artifact_integrity",
        `Invalid artifact file entry: ${path}`,
      );
    }
    paths.add(path);
  }
  for (const required of ["media.json", "program.mjs", "job.json"]) {
    if (!paths.has(required)) {
      throw new MediaIRError(
        "artifact_integrity",
        `artifact.json.files is missing ${required}`,
      );
    }
  }
  if (manifest.schemaVersion === 1 && !paths.has("native-modules.json")) {
    throw new MediaIRError("artifact_integrity", "Schema-1 artifact is missing native-modules.json");
  }
  if (manifest.schemaVersion === 0 && paths.has("native-modules.json")) {
    throw new MediaIRError("invalid_schema", "Schema-0 artifact cannot declare native module files");
  }
  const runtime = record(manifest.runtime, "artifact.json.runtime");
  if (
    typeof runtime.requiresNetwork !== "boolean" ||
    !["html", "svg"].includes(String(runtime.medium)) ||
    typeof runtime.animated !== "boolean"
  ) {
    throw new MediaIRError(
      "artifact_integrity",
      "Invalid artifact runtime declaration",
    );
  }
  validateCoordinates(manifest.identity, "artifact.json.identity");
  return manifest as unknown as MediaArtifactManifest;
}

function validateMediaJob(
  value: unknown,
  root: string,
  manifestPaths: Set<string>,
): MediaJob {
  const job = record(value, "job.json");
  if (job.schemaVersion !== 0) {
    throw new MediaIRError("unknown_version", "Unsupported job schemaVersion");
  }
  validateCoordinates(job.coordinates, "job.json.coordinates");
  record(job.data, "job.json.data");
  for (const key of [
    "width",
    "height",
    "fps",
    "durationSeconds",
    "totalFrames",
  ] as const) {
    finiteField(job, key, "job.json");
  }
  if (
    (job.width as number) <= 0 ||
    (job.height as number) <= 0 ||
    (job.fps as number) <= 0 ||
    (job.durationSeconds as number) < 0 ||
    !Number.isInteger(job.totalFrames) ||
    (job.totalFrames as number) < 1 ||
    !["html", "svg"].includes(String(job.medium)) ||
    typeof job.animated !== "boolean" ||
    !["frame", "animation"].includes(String(job.mode))
  ) {
    throw new MediaIRError("artifact_integrity", "Invalid job clock/runtime");
  }
  for (const key of ["fonts", "inlineCss", "stylesheets"] as const) {
    if (
      !Array.isArray(job[key]) ||
      !(job[key] as unknown[]).every((item) => typeof item === "string")
    ) {
      throw new MediaIRError(
        "artifact_integrity",
        `job.json.${key} must be a string array`,
      );
    }
  }
  for (const key of [
    "tailwind",
    "background",
    "watermark",
    "readiness",
    "audio",
  ] as const) {
    if (!(key in job)) {
      throw new MediaIRError(
        "artifact_integrity",
        `job.json.${key} is required`,
      );
    }
  }
  const assetMap = record(job.assetMap, "job.json.assetMap");
  for (const [alias, rel] of Object.entries(assetMap)) {
    if (!alias || typeof rel !== "string" || !manifestPaths.has(rel)) {
      throw new MediaIRError(
        "artifact_integrity",
        `Invalid job asset mapping: ${alias}`,
      );
    }
    safeJoin(root, rel);
  }
  if (!Array.isArray(job.resolvedAssets)) {
    throw new MediaIRError(
      "artifact_integrity",
      "job.json.resolvedAssets must be an array",
    );
  }
  const assetKeys = new Set<string>();
  for (const [index, assetValue] of job.resolvedAssets.entries()) {
    const asset = record(assetValue, `job.json.resolvedAssets[${index}]`);
    const key = stringField(
      asset,
      "key",
      `job.json.resolvedAssets[${index}]`,
    );
    const src = stringField(
      asset,
      "src",
      `job.json.resolvedAssets[${index}]`,
    );
    if (
      assetKeys.has(key) ||
      !["image", "video", "audio"].includes(String(asset.type))
    ) {
      throw new MediaIRError(
        "artifact_integrity",
        `Invalid resolved asset: ${key}`,
      );
    }
    assetKeys.add(key);
    if (!/^(?:https?:|data:)/i.test(src)) {
      if (!manifestPaths.has(src)) {
        throw new MediaIRError(
          "artifact_integrity",
          `Resolved asset is not declared in manifest: ${src}`,
        );
      }
      safeJoin(root, src);
    }
  }
  return job as unknown as MediaJob;
}

function writeAtomicDir(finalDir: string, write: (tmpDir: string) => void): void {
  const parent = dirname(finalDir);
  mkdirSync(parent, { recursive: true });
  const tmp = join(
    parent,
    `.${basename(finalDir)}.tmp-${process.pid}-${Date.now()}`,
  );
  const backup = join(
    parent,
    `.${basename(finalDir)}.bak-${process.pid}-${Date.now()}`,
  );
  let movedExisting = false;
  try {
    mkdirSync(tmp, { recursive: true });
    write(tmp);
    if (existsSync(finalDir)) {
      renameSync(finalDir, backup);
      movedExisting = true;
    }
    renameSync(tmp, finalDir);
    if (movedExisting) {
      try {
        rmSync(backup, { recursive: true, force: true });
      } catch {
        // The new artifact is already installed atomically. A stale backup is
        // safer than reporting a failed compile and attempting to roll it back.
      }
    }
  } catch (e) {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    if (movedExisting && !existsSync(finalDir) && existsSync(backup)) {
      renameSync(backup, finalDir);
    }
    throw e;
  }
}

export async function compileMediaArtifact(
  template: TemplateModule,
  options: CompileMediaArtifactOptions,
): Promise<CompiledMediaArtifact> {
  const version = options.artifactSchemaVersion ?? 0;
  if (version !== 0 && version !== 1) throw new MediaIRError("invalid_schema", "Unsupported artifact version");
  const audio = template.config?.audio;
  const clips = !audio ? [] : Array.isArray(audio) ? audio : "clips" in audio ? audio.clips : [audio];
  const audioBindings = new Map<string, string>();
  for (const [index, clip] of clips.entries()) {
    const key = artifactAudioKey(clip, index);
    const previous = audioBindings.get(key);
    if (previous !== undefined && previous !== clip.src && options.localAssets?.[key] !== undefined) throw new MediaIRError("artifact_integrity", `Ambiguous artifact audio binding: ${key}`);
    audioBindings.set(key, clip.src);
  }
  const nativeSets = template.config?.nativeModuleSets ?? [];
  const nativeJson = version === 1 ? serializeNativeArtifact(nativeSets) : undefined;
  if (nativeJson !== undefined) parseNativeArtifact(nativeJson);
  const assertArtifactCapabilities = (candidate: TemplateModule) => {
    if (version === 0 && candidate.config?.nativeModuleSets?.length) throw new MediaIRError(
      "unsupported_capability",
      "Schema-0 media artifacts cannot represent prepared native surfaces",
      { capability: "native-surface", schemaVersion: 0 },
    );
    if (version === 1) {
      const candidateSets = candidate.config?.nativeModuleSets ?? [];
      serializeNativeArtifact(candidateSets);
      if (JSON.stringify(candidateSets.map(set => set.identity).sort()) !== JSON.stringify(nativeSets.map(set => set.identity).sort())) {
        throw new MediaIRError("artifact_integrity", "Resolved native module sets do not match the prepared media");
      }
    }
  };
  assertArtifactCapabilities(template);
  // The stored program is independently readable, even when the optional IR
  // parity check is disabled. Do not publish a program whose required native
  // resources schema 0 cannot declare to an older reader.
  const fromProgram = compileTemplate(version === 1 ? { code: options.programCode, sourceFile: "program.mjs", sourceMap: { version: 3, sources: [], names: [], mappings: "" }, nativeModuleSets: nativeSets } : options.programCode);
  if (fromProgram.error || !fromProgram.media) {
    throw fromProgram.error ?? new MediaIRError("artifact_integrity", "program.mjs does not evaluate to a template");
  }
  assertArtifactCapabilities(fromProgram.media);
  const programHash = hashBytes(options.programCode);
  const { ir, template: resolved, data: resolvedData } = await resolveMediaIR(template, {
    ...options,
    programHash,
  });
  assertArtifactCapabilities(resolved);

  // When verify is on, re-resolve from the bundled program and compare hashes
  if (options.verify) {
    const { ir: programIr } = await resolveMediaIR(fromProgram.media, {
      ...options,
      programHash,
      verify: false,
    });
    if (
      programIr.hashes.intentHash !== ir.hashes.intentHash ||
      programIr.hashes.markupHash !== ir.hashes.markupHash
    ) {
      throw new MediaIRError(
        "artifact_integrity",
        "Bundled program does not reproduce Media IR (intent/markup hash mismatch)",
        {
          expected: { intent: ir.hashes.intentHash, markup: ir.hashes.markupHash },
          actual: {
            intent: programIr.hashes.intentHash,
            markup: programIr.hashes.markupHash,
          },
        },
      );
    }
  }

  const job: MediaJob = {
    schemaVersion: 0,
    coordinates: { ...ir.identity },
    // Freeze post-resolve() effective data (not raw input)
    data: resolvedData as MediaJob["data"],
    width: ir.canvas.width,
    height: ir.canvas.height,
    fps: ir.clock.fps,
    durationSeconds: ir.clock.durationSeconds,
    totalFrames: ir.clock.totalFrames,
    medium: ir.medium,
    animated: ir.animated,
    fonts: (resolved.config?.fonts ?? []).flatMap((font) =>
      isGoogleFontDeclaration(font) || isFontDeclaration(font) ? [fontIrToken(font)] : [],
    ),
    inlineCss: resolved.config?.inlineCss ?? [],
    stylesheets: resolved.config?.stylesheets ?? [],
    tailwind: (resolved.config?.tailwind ?? false) as MediaJob["tailwind"],
    background: (resolved.config?.background ?? null) as MediaJob["background"],
    watermark: (resolved.config?.watermark ?? null) as MediaJob["watermark"],
    readiness: (resolved.config?.readiness ?? null) as MediaJob["readiness"],
    audio: (resolved.config?.audio ?? null) as MediaJob["audio"],
    assetMap: {},
    resolvedAssets: [],
    mode: resolved.config?.mode ?? "frame",
  };

  let manifest!: MediaArtifactManifest;
  let finalIr = ir;

  writeAtomicDir(options.outDir, (tmp) => {
    mkdirSync(join(tmp, "assets"), { recursive: true });
    mkdirSync(join(tmp, "fonts"), { recursive: true });

    const files: MediaArtifactManifest["files"] = [];

    const mediaJson = serializeMediaIR(ir);
    writeFileSync(join(tmp, "media.json"), mediaJson, "utf8");
    files.push({
      path: "media.json",
      sha256: hashBytes(mediaJson),
      bytes: Buffer.byteLength(mediaJson),
    });

    writeFileSync(join(tmp, "program.mjs"), options.programCode, "utf8");
    files.push({
      path: "program.mjs",
      sha256: programHash,
      bytes: Buffer.byteLength(options.programCode),
    });

    if (nativeJson !== undefined) {
      writeFileSync(join(tmp, "native-modules.json"), nativeJson, "utf8");
      files.push({ path: "native-modules.json", sha256: hashBytes(nativeJson), bytes: Buffer.byteLength(nativeJson) });
    }

    if (options.localAssets) {
      for (const [id, input] of Object.entries(options.localAssets)) {
        const absPath = typeof input === "string" ? input : input.path;
        const aliases = typeof input === "string" ? [] : input.aliases ?? [];
        const buf = readFileSync(absPath);
        const h = hashBytes(buf);
        const rel = `assets/${h.slice(0, 16)}-${basename(absPath)}`;
        const existing = files.find(file => file.path === rel);
        if (existing && (existing.sha256 !== h || existing.bytes !== buf.byteLength)) throw new MediaIRError("artifact_integrity", `Artifact asset path collision: ${rel}`);
        if (!existing) {
          writeFileSync(join(tmp, rel), buf);
          files.push({ path: rel, sha256: h, bytes: buf.byteLength });
        }
        const mediaAsset = ir.assets.find((asset) => asset.id === id);
        const runtimeAliases = new Set([
          ...(mediaAsset ? [mediaAsset.src, basename(mediaAsset.src)] : []),
          ...(id.startsWith("font:") || id.startsWith("audio:") ? [id] : []),
          ...aliases,
        ]);
        for (const alias of runtimeAliases) {
          if (alias) job.assetMap[alias.replace(/\\/g, "/")] = rel;
        }
        const key = id.startsWith("asset:")
          ? id.slice("asset:".length)
          : id.startsWith("discovered:")
            ? id.slice("discovered:".length)
            : null;
        const declaration = key ? template.config?.assets?.[key] : undefined;
        const mimeType = declaration && "bytes" in declaration ? declaration.mimeType : artifactMimeType(absPath);
        const inferredKind = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : undefined;
        const declaredKind = declaration?.type ?? inferredKind;
        const kind = mediaAsset && ["image", "video", "audio"].includes(mediaAsset.kind) ? mediaAsset.kind : declaredKind;
        if (
          key &&
          (kind === "image" || kind === "video" || kind === "audio")
        ) {
          job.resolvedAssets.push({
            key,
            type: kind,
            src: rel,
          });
        }
      }
    }

    if (options.fonts) {
      for (const [name, data] of Object.entries(options.fonts)) {
        const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
        const h = hashBytes(buf);
        const rel = `fonts/${h.slice(0, 16)}-${name}`;
        writeFileSync(join(tmp, rel), buf);
        files.push({ path: rel, sha256: h, bytes: buf.byteLength });
      }
    }

    for (const mediaAsset of ir.assets) {
      const key = mediaAsset.id.startsWith("asset:")
        ? mediaAsset.id.slice("asset:".length)
        : mediaAsset.id.startsWith("discovered:")
          ? mediaAsset.id.slice("discovered:".length)
          : null;
      if (
        !key ||
        job.resolvedAssets.some((asset) => asset.key === key) ||
        !(
          mediaAsset.kind === "image" ||
          mediaAsset.kind === "video" ||
          mediaAsset.kind === "audio"
        )
      ) {
        continue;
      }
      if (mediaAsset.remote || mediaAsset.src.startsWith("data:")) {
        job.resolvedAssets.push({
          key,
          type: mediaAsset.kind,
          src: mediaAsset.src,
        });
      }
    }

    job.resolvedAssets.sort((a, b) => a.key.localeCompare(b.key));
    const jobJson = JSON.stringify(job);
    writeFileSync(join(tmp, "job.json"), jobJson, "utf8");
    files.push({
      path: "job.json",
      sha256: hashBytes(jobJson),
      bytes: Buffer.byteLength(jobJson),
    });

    files.sort((a, b) => a.path.localeCompare(b.path));
    const artifactHash = hashBytes(
      files.map((f) => `${f.path}:${f.sha256}`).join("\n"),
    );

    manifest = {
      kind: "@foxworth/superimg/artifact",
      schemaVersion: version,
      artifactHash,
      files,
      runtime: {
        requiresNetwork: ir.capabilities.portability === "network-required",
        medium: ir.medium,
        animated: ir.animated,
      },
      identity: { ...ir.identity },
    };

    const artifactJson = JSON.stringify(manifest);
    writeFileSync(join(tmp, "artifact.json"), artifactJson, "utf8");
    finalIr = ir;
  });

  return {
    path: options.outDir,
    media: finalIr,
    job,
    manifest,
  };
}

export async function compileMediaArtifactFromBundle(
  bundle: TemplateBundle,
  options: CompileMediaArtifactOptions,
): Promise<CompiledMediaArtifact> {
  const compiled = compileTemplate(bundle);
  if (compiled.error || !compiled.media) {
    throw compiled.error ?? new Error("Template compilation failed");
  }
  return compileMediaArtifact(compiled.media, {
    ...options,
    programCode: options.programCode || bundle.code,
  });
}

export async function readMediaArtifact(path: string): Promise<CompiledMediaArtifact> {
  const root = resolve(path);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new MediaIRError("artifact_integrity", `Not an artifact directory: ${path}`);
  }

  const manifestRaw = readFileSync(safeJoin(root, "artifact.json"), "utf8");
  const manifest = validateArtifactManifest(JSON.parse(manifestRaw));

  for (const entry of manifest.files) {
    const full = safeJoin(root, entry.path);
    if (!existsSync(full)) {
      throw new MediaIRError("artifact_integrity", `Missing file: ${entry.path}`);
    }
    const buf = readFileSync(full);
    if (buf.byteLength !== entry.bytes) throw new MediaIRError("artifact_integrity", `Length mismatch for ${entry.path}`);
    const h = hashBytes(buf);
    if (h !== entry.sha256) {
      throw new MediaIRError(
        "artifact_integrity",
        `Hash mismatch for ${entry.path}`,
        { expected: entry.sha256, actual: h },
      );
    }
  }

  // Recompute artifact hash
  const sorted = [...manifest.files].sort((a, b) => a.path.localeCompare(b.path));
  const expectedArtifactHash = hashBytes(
    sorted.map((f) => `${f.path}:${f.sha256}`).join("\n"),
  );
  if (expectedArtifactHash !== manifest.artifactHash) {
    throw new MediaIRError("artifact_integrity", "artifactHash mismatch");
  }
  if (manifest.schemaVersion === 1) parseNativeArtifact(readFileSync(safeJoin(root, "native-modules.json"), "utf8"));

  const media = validateMediaIR(
    JSON.parse(readFileSync(safeJoin(root, "media.json"), "utf8")),
  );
  const manifestPaths = new Set(manifest.files.map((file) => file.path));
  const job = validateMediaJob(
    JSON.parse(readFileSync(safeJoin(root, "job.json"), "utf8")),
    root,
    manifestPaths,
  );

  // Clock/canvas consistency
  if (
    !coordinatesEqual(job.coordinates, media.identity) ||
    job.width !== media.canvas.width ||
    job.height !== media.canvas.height ||
    job.fps !== media.clock.fps ||
    job.durationSeconds !== media.clock.durationSeconds ||
    job.totalFrames !== media.clock.totalFrames ||
    job.medium !== media.medium ||
    job.animated !== media.animated ||
    !coordinatesEqual(manifest.identity, media.identity) ||
    manifest.runtime.medium !== media.medium ||
    manifest.runtime.animated !== media.animated ||
    manifest.runtime.requiresNetwork !==
      (media.capabilities.portability === "network-required")
  ) {
    throw new MediaIRError(
      "clock_mismatch",
      "artifact manifest/job does not match media.json",
    );
  }
  const programEntry = manifest.files.find(
    (file) => file.path === "program.mjs",
  );
  if (programEntry?.sha256 !== media.hashes.programHash) {
    throw new MediaIRError(
      "artifact_integrity",
      "program.mjs hash does not match media.json programHash",
    );
  }

  return { path: root, media, job, manifest };
}

export function loadArtifactProgram(artifact: CompiledMediaArtifact): string {
  return readFileSync(safeJoin(artifact.path, "program.mjs"), "utf8");
}

/** Evaluate bundled program into TemplateModule (same as compileTemplate). */
export function templateFromArtifact(artifact: CompiledMediaArtifact): TemplateModule {
  const code = loadArtifactProgram(artifact);
  const nativeModuleSets = artifact.manifest.schemaVersion === 1 ? parseNativeArtifact(readFileSync(safeJoin(artifact.path, "native-modules.json"), "utf8")) : undefined;
  const result = compileTemplate(nativeModuleSets ? { code, sourceFile: "program.mjs", sourceMap: { version: 3, sources: [], names: [], mappings: "" }, nativeModuleSets } : code);
  if (result.error || !result.media) {
    throw result.error ?? new Error("Artifact program evaluation failed");
  }
  // The program may still refer to the author's original local files. Rebind
  // declared assets to the artifact's verified bytes so replay survives source
  // removal and cannot silently read a newer version of the original file.
  function verifiedBytes(path: string): Uint8Array {
    const entry = artifact.manifest.files.find(file => file.path === path);
    if (!entry) throw new MediaIRError("artifact_integrity", `Resolved asset is not declared in manifest: ${path}`);
    const bytes = readFileSync(safeJoin(artifact.path, path));
    if (bytes.byteLength !== entry.bytes || hashBytes(bytes) !== entry.sha256) throw new MediaIRError("artifact_integrity", `Resolved asset changed: ${path}`);
    return new Uint8Array(bytes);
  }
  const declarations = result.media.config?.assets;
  if (declarations) {
    const assets = { ...declarations };
    for (const asset of artifact.job.resolvedAssets) {
      const declaration = declarations[asset.key];
      if (!declaration || /^(?:https?:|data:)/i.test(asset.src)) continue;
      const bytes = verifiedBytes(asset.src);
      const mimeType = "bytes" in declaration ? declaration.mimeType : artifactMimeType(asset.src);
      assets[asset.key] = { bytes, mimeType, type: asset.type };
    }
    result.media.config = { ...result.media.config, assets };
  }
  if (result.media.config?.fonts) {
    const fonts = result.media.config.fonts.map((font, index) => {
      const path = artifact.job.assetMap[`font:${index}`];
      return path && isFontDeclaration(font) ? { ...font, src: verifiedBytes(path) } : font;
    });
    result.media.config = { ...result.media.config, fonts };
  }
  const audio = result.media.config?.audio;
  if (audio) {
    const bind = (clip: AudioClip, index: number): AudioClip => {
      const path = artifact.job.assetMap[artifactAudioKey(clip, index)];
      if (!path) return clip;
      const src = `data:${artifactMimeType(path)};base64,${Buffer.from(verifiedBytes(path)).toString("base64")}`;
      return { ...clip, src, ...(clip.source?.kind === "file" ? { source: { ...clip.source, src } } : {}) };
    };
    const rebound = Array.isArray(audio) ? audio.map(bind) : "clips" in audio ? { ...audio, clips: audio.clips.map(bind) } : bind(audio, 0);
    result.media.config = { ...result.media.config, audio: rebound };
  }
  return result.media;
}

export function assertIrMatchesRuntime(
  ir: MediaIR,
  runtime: { width: number; height: number; fps: number; totalFrames: number },
): void {
  if (
    runtime.width !== ir.canvas.width ||
    runtime.height !== ir.canvas.height ||
    runtime.fps !== ir.clock.fps ||
    runtime.totalFrames !== ir.clock.totalFrames
  ) {
    throw new MediaIRError("clock_mismatch", "Runtime clock/canvas does not match Media IR", {
      ir: { canvas: ir.canvas, clock: ir.clock },
      runtime,
    });
  }
}
