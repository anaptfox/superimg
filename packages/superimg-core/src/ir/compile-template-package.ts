//! Compile a deployable TemplatePackage from a TemplateModule + program bytes.
//! Distinct from frozen .superimg artifacts (which freeze job data).

import type {
  PackageProgram,
  TemplateModule,
  TemplatePackage,
} from "@superimg/types";
import { resolveMediaIR, type ResolveMediaIROptions } from "./resolve-media-ir.js";
import {
  buildTemplatePackage,
  validateTemplatePackage,
} from "./pure/template-package.js";
import { computeMediaIRHashes } from "./pure/serialize.js";
import { sha256Hex } from "./pure/sha256.js";
import { inspectRenderRequirements } from "./pure/negotiate.js";

export interface CompileTemplatePackageOptions extends ResolveMediaIROptions {
  sourceId: string;
  /** Pre-bundled program source (ESM or IIFE string). */
  programCode: string;
  programPath?: string;
  programFormat?: PackageProgram["format"];
  inputSchema?: TemplatePackage["inputSchema"];
  allowRemoteAssets?: boolean;
}

/**
 * Build an integrity-checked deployable {@link TemplatePackage} from a live
 * template module and its bundled program. Package accepts different job data later.
 */
export async function compileTemplatePackage(
  template: TemplateModule,
  options: CompileTemplatePackageOptions,
): Promise<TemplatePackage> {
  const { ir: media } = await resolveMediaIR(template, {
    sourceId: options.sourceId,
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.explicitOverrides !== undefined
      ? { explicitOverrides: options.explicitOverrides }
      : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    programHash: sha256Hex(options.programCode),
  });

  const programHash = sha256Hex(options.programCode);
  // Prefer caller's sourceId for package identity; recompute hashes after rewrite.
  const mediaBase = {
    ...media,
    identity: {
      ...media.identity,
      sourceId: options.sourceId,
    },
    provenance: {
      ...media.provenance,
      sourceId: options.sourceId,
      programHash,
    },
  };
  const mediaWithId = {
    ...mediaBase,
    hashes: computeMediaIRHashes(mediaBase, programHash),
  };

  const program: PackageProgram = {
    path: options.programPath ?? "program.mjs",
    sha256: programHash,
    format: options.programFormat ?? "esm",
    bytes: new TextEncoder().encode(options.programCode).byteLength,
  };

  const requirements = inspectRenderRequirements(mediaWithId);
  const pkg = buildTemplatePackage({
    sourceId: options.sourceId,
    program,
    media: mediaWithId,
    assets: [],
    requirements,
    ...(options.inputSchema !== undefined
      ? { inputSchema: options.inputSchema }
      : {}),
    ...(options.allowRemoteAssets !== undefined
      ? { allowRemoteAssets: options.allowRemoteAssets }
      : {}),
  });
  return validateTemplatePackage(pkg);
}
