//! Experimental draft — deployable template packages vs frozen replay artifacts.
//! schemaVersion 0: fields may change before the first release.

import type { JsonObject, JsonValue } from "./json.js";
import type { MediaIR } from "./media-ir.js";
import type {
  RenderOutputFormat,
  RenderRequirements,
  RuntimeProfileName,
} from "./render-capabilities.js";
import type { MediaCoordinates } from "./coordinates.js";

/**
 * Precompiled program payload inside a deployable template package.
 * Trusted application code — not sandboxed multi-tenant user content.
 * @experimental Draft contract (schemaVersion 0).
 */
export interface PackageProgram {
  /** Relative path inside the package (e.g. "program.mjs"). */
  path: string;
  /** SHA-256 hex of program bytes. */
  sha256: string;
  /** Module format. */
  format: "esm" | "iife";
  bytes: number;
}

export interface PackageAsset {
  /** Logical asset id. */
  id: string;
  /** Relative path inside the package (must not traverse). */
  path: string;
  sha256: string;
  bytes: number;
  kind: "image" | "video" | "audio" | "font" | "other";
  /** True if the original source was remote (packages should vendor; remote deny-by-default). */
  remote: boolean;
}

/**
 * Deployable template package: trusted precompiled program + Media IR + assets
 * that can accept different validated job data per request.
 * Distinct from a frozen replay artifact (which freezes resolved data for exact replay).
 * @experimental Draft contract (schemaVersion 0).
 */
export interface TemplatePackage {
  kind: "@foxworth/superimg/template-package";
  schemaVersion: 0;
  sourceId: string;
  /** Content hash over program + assets + media IR + requirements (integrity root). */
  packageHash: string;
  program: PackageProgram;
  media: MediaIR;
  assets: PackageAsset[];
  requirements: RenderRequirements;
  /** Optional JSON Schema for job data validation. */
  inputSchema?: JsonObject;
}

export interface TemplatePackageManifest {
  kind: "@foxworth/superimg/template-package-manifest";
  schemaVersion: 0;
  sourceId: string;
  packageHash: string;
  files: Array<{ path: string; sha256: string; bytes: number }>;
  requirements: RenderRequirements;
  identity: MediaCoordinates;
}

export interface OutputRequest {
  format: RenderOutputFormat;
  width?: number;
  height?: number;
  fps?: number;
  /** Optional profile hint; server still negotiates against actual capabilities. */
  profile?: RuntimeProfileName;
}

/** Reject reasons for package / request admission. */
export type PackageRejectCode =
  | "source_upload_forbidden"
  | "unknown_package"
  | "hash_mismatch"
  | "missing_hash"
  | "path_traversal"
  | "unknown_file"
  | "tampered_file"
  | "remote_asset_denied"
  | "schema_invalid"
  | "data_too_large"
  | "queue_full"
  | "unauthorized";

export interface PackageRejectError {
  code: PackageRejectCode;
  message: string;
  detail?: JsonValue;
}
