//! Pure template-package integrity helpers (no Node fs).
//! Distinguishes deployable packages from frozen replay artifacts.

import type {
  MediaIR,
  JsonObject,
  PackageAsset,
  PackageProgram,
  RenderRequirements,
  TemplatePackage,
  TemplatePackageManifest,
} from "@superimg/types";
import { MediaIRError } from "./errors.js";
import { canonicalizeToJson } from "./canonicalize.js";
import { sha256Hex } from "./sha256.js";
import { validateMediaIR } from "./validate.js";
import { inspectRenderRequirements } from "./negotiate.js";

const TRAVERSAL = /(?:^|\/)\.\.(?:\/|$)|^\/|\\/;

export function assertSafePackagePath(rel: string, label = "path"): void {
  const cleaned = rel.replace(/\\/g, "/");
  if (!cleaned || cleaned.includes("\0") || TRAVERSAL.test(cleaned) || cleaned.startsWith("..")) {
    throw new MediaIRError(
      "path_traversal",
      `Illegal package ${label}: ${rel}`,
    );
  }
  if (cleaned.includes("://") || cleaned.includes(":")) {
    // block absolute / URL-like paths
    if (/^[a-zA-Z]:/.test(cleaned) || cleaned.includes("://")) {
      throw new MediaIRError(
        "path_traversal",
        `Illegal package ${label}: ${rel}`,
      );
    }
  }
}

function reqObject(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MediaIRError("invalid_schema", `${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function reqString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new MediaIRError("missing_field", `${path}.${key} must be non-empty string`);
  }
  return v;
}

/**
 * Content hash over the integrity-critical package fields.
 * Does not include wall-clock metadata.
 */
export function computePackageHash(input: {
  sourceId: string;
  program: PackageProgram;
  assets: PackageAsset[];
  media: MediaIR;
  requirements: RenderRequirements;
}): string {
  const payload = {
    kind: "@foxworth/superimg/template-package",
    schemaVersion: 0,
    sourceId: input.sourceId,
    program: {
      path: input.program.path,
      sha256: input.program.sha256,
      format: input.program.format,
      bytes: input.program.bytes,
    },
    assets: [...input.assets]
      .map((a) => ({
        id: a.id,
        path: a.path,
        sha256: a.sha256,
        bytes: a.bytes,
        kind: a.kind,
        remote: a.remote,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    mediaHashes: input.media.hashes,
    mediaIdentity: input.media.identity,
    requirements: input.requirements,
  };
  return sha256Hex(canonicalizeToJson(payload));
}

/**
 * Validate a deployable TemplatePackage structurally and integrity-wise.
 * Fail closed on missing hashes, traversal, remote assets (by default), hash mismatch.
 */
export function validateTemplatePackage(
  value: unknown,
  options?: {
    /** When true, allow assets marked remote (still must be vendored with hash). Default false. */
    allowRemoteAssets?: boolean;
    /** Expected package hash (e.g. from job request). */
    expectedPackageHash?: string;
  },
): TemplatePackage {
  const root = reqObject(value, "TemplatePackage");
  if (root.kind !== "@foxworth/superimg/template-package") {
    throw new MediaIRError(
      "invalid_schema",
      `Expected kind @foxworth/superimg/template-package, got ${String(root.kind)}`,
    );
  }
  if (root.schemaVersion !== 0) {
    throw new MediaIRError(
      "unknown_version",
      `Unsupported package schemaVersion ${String(root.schemaVersion)}`,
    );
  }

  const sourceId = reqString(root, "sourceId", "TemplatePackage");
  const packageHash = reqString(root, "packageHash", "TemplatePackage");
  if (!/^[a-f0-9]{64}$/i.test(packageHash)) {
    throw new MediaIRError("missing_hash", "packageHash must be sha256 hex");
  }

  const programRaw = reqObject(root.program, "program");
  const program: PackageProgram = {
    path: reqString(programRaw, "path", "program"),
    sha256: reqString(programRaw, "sha256", "program"),
    format: programRaw.format === "iife" ? "iife" : "esm",
    bytes: Number(programRaw.bytes),
  };
  assertSafePackagePath(program.path, "program.path");
  if (!/^[a-f0-9]{64}$/i.test(program.sha256)) {
    throw new MediaIRError("missing_hash", "program.sha256 must be sha256 hex");
  }
  if (!Number.isFinite(program.bytes) || program.bytes < 0) {
    throw new MediaIRError("invalid_type", "program.bytes must be finite");
  }

  if (!Array.isArray(root.assets)) {
    throw new MediaIRError("invalid_type", "assets must be an array");
  }
  const assets: PackageAsset[] = [];
  for (let i = 0; i < root.assets.length; i++) {
    const a = reqObject(root.assets[i], `assets[${i}]`);
    const asset: PackageAsset = {
      id: reqString(a, "id", `assets[${i}]`),
      path: reqString(a, "path", `assets[${i}]`),
      sha256: reqString(a, "sha256", `assets[${i}]`),
      bytes: Number(a.bytes),
      kind: (a.kind as PackageAsset["kind"]) ?? "other",
      remote: Boolean(a.remote),
    };
    assertSafePackagePath(asset.path, `assets[${i}].path`);
    if (!/^[a-f0-9]{64}$/i.test(asset.sha256)) {
      throw new MediaIRError("missing_hash", `assets[${i}].sha256 invalid`);
    }
    if (asset.remote && !options?.allowRemoteAssets) {
      throw new MediaIRError(
        "artifact_integrity",
        `Remote asset denied by default: ${asset.id}`,
        { code: "remote_asset_denied", id: asset.id },
      );
    }
    assets.push(asset);
  }

  const media = validateMediaIR(root.media);
  const requirements =
    root.requirements && typeof root.requirements === "object"
      ? (root.requirements as RenderRequirements)
      : inspectRenderRequirements(media);

  if (requirements.schemaVersion !== 0) {
    throw new MediaIRError("invalid_schema", "requirements.schemaVersion must be 0");
  }

  const expectedHash = computePackageHash({
    sourceId,
    program,
    assets,
    media,
    requirements,
  });
  if (expectedHash !== packageHash) {
    throw new MediaIRError(
      "artifact_integrity",
      "packageHash does not match package contents",
      { expected: expectedHash, actual: packageHash },
    );
  }
  if (
    options?.expectedPackageHash &&
    options.expectedPackageHash !== packageHash
  ) {
    throw new MediaIRError(
      "artifact_integrity",
      "packageHash does not match request",
      {
        expected: options.expectedPackageHash,
        actual: packageHash,
      },
    );
  }

  // Reject accidental source uploads masquerading as packages
  if (typeof root.source === "string" || typeof root.sourceCode === "string") {
    throw new MediaIRError(
      "artifact_integrity",
      "Arbitrary template source uploads are forbidden",
      { code: "source_upload_forbidden" },
    );
  }

  const pkg: TemplatePackage = {
    kind: "@foxworth/superimg/template-package",
    schemaVersion: 0,
    sourceId,
    packageHash,
    program,
    media,
    assets,
    requirements,
  };
  if (root.inputSchema && typeof root.inputSchema === "object") {
    pkg.inputSchema = root.inputSchema as JsonObject;
  }
  return pkg;
}

/**
 * Build a validated TemplatePackage from parts (computes packageHash).
 * Used by package compilers and tests.
 */
export function buildTemplatePackage(input: {
  sourceId: string;
  program: PackageProgram;
  media: MediaIR | unknown;
  assets?: PackageAsset[];
  requirements?: RenderRequirements;
  inputSchema?: TemplatePackage["inputSchema"];
  allowRemoteAssets?: boolean;
}): TemplatePackage {
  assertSafePackagePath(input.program.path, "program.path");
  for (const a of input.assets ?? []) {
    assertSafePackagePath(a.path, `asset ${a.id}`);
  }
  const media = validateMediaIR(input.media);
  const requirements =
    input.requirements ?? inspectRenderRequirements(media);
  const assets = input.assets ?? [];
  if (!input.allowRemoteAssets) {
    for (const a of assets) {
      if (a.remote) {
        throw new MediaIRError(
          "artifact_integrity",
          `Remote asset denied by default: ${a.id}`,
          { code: "remote_asset_denied" },
        );
      }
    }
  }
  const packageHash = computePackageHash({
    sourceId: input.sourceId,
    program: input.program,
    assets,
    media,
    requirements,
  });
  return {
    kind: "@foxworth/superimg/template-package",
    schemaVersion: 0,
    sourceId: input.sourceId,
    packageHash,
    program: input.program,
    media,
    assets,
    requirements,
    ...(input.inputSchema ? { inputSchema: input.inputSchema } : {}),
  };
}

/**
 * Validate a package manifest file list against declared hashes (paths only).
 * Unknown files and traversal fail closed.
 */
export function validatePackageManifestFiles(
  manifest: TemplatePackageManifest,
  presentPaths: Iterable<string>,
): void {
  if (manifest.kind !== "@foxworth/superimg/template-package-manifest") {
    throw new MediaIRError("invalid_schema", "Invalid package manifest kind");
  }
  if (manifest.schemaVersion !== 0) {
    throw new MediaIRError("unknown_version", "Unsupported manifest schemaVersion");
  }
  const expected = new Map(
    manifest.files.map((f) => {
      assertSafePackagePath(f.path, "manifest.files.path");
      return [f.path.replace(/\\/g, "/"), f];
    }),
  );
  const seen = new Set<string>();
  for (const raw of presentPaths) {
    const path = raw.replace(/\\/g, "/");
    assertSafePackagePath(path, "present path");
    if (!expected.has(path)) {
      throw new MediaIRError(
        "artifact_integrity",
        `Unknown file in package: ${path}`,
        { code: "unknown_file", path },
      );
    }
    seen.add(path);
  }
  for (const path of expected.keys()) {
    if (!seen.has(path)) {
      throw new MediaIRError(
        "artifact_integrity",
        `Missing package file: ${path}`,
        { code: "missing_file", path },
      );
    }
  }
}

/**
 * Reject job payloads that attempt source upload instead of package reference.
 */
export function assertNoSourceUpload(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const o = body as Record<string, unknown>;
  const forbidden = [
    "source",
    "sourceCode",
    "templateSource",
    "programSource",
    "programCode",
    "entryFile",
  ];
  for (const key of forbidden) {
    if (key in o && o[key] != null) {
      throw new MediaIRError(
        "artifact_integrity",
        "Arbitrary template source uploads are forbidden; use a predeployed package",
        { code: "source_upload_forbidden", field: key },
      );
    }
  }
}
