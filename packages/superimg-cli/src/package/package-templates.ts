//! Content-addressed deployable template packages under .superimg/packages/<id>/<hash>/.

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, isAbsolute, resolve } from "node:path";
import { bundleTemplate } from "@superimg/core/bundler";
import {
  compileTemplate,
  compileTemplatePackage,
  sha256Hex,
  assertSafePackagePath,
  validateTemplatePackage,
} from "@superimg/core";
import type { TemplatePackage } from "@superimg/types";

export interface PackageEntry {
  name: string;
  entrypoint: string;
}

export interface PackagedTemplate {
  sourceId: string;
  packageHash: string;
  /** Path relative to packages root: <sourceId>/<hash> */
  relativePath: string;
  absolutePath: string;
  pkg: TemplatePackage;
}

export interface PackageTemplatesOptions {
  cwd: string;
  /** Root directory for packages (e.g. .superimg/packages or deploy context packages/). */
  outRoot: string;
  entries: PackageEntry[];
}

/**
 * Bundle each template, compile a TemplatePackage, and write a content-addressed tree:
 * `.superimg/packages/<sourceId>/<packageHash>/{package.json,program.mjs,media.json,...}`
 */
export async function packageTemplates(
  options: PackageTemplatesOptions,
): Promise<PackagedTemplate[]> {
  mkdirSync(options.outRoot, { recursive: true });
  const results: PackagedTemplate[] = [];

  for (const entry of options.entries) {
    const absEntry = isAbsolute(entry.entrypoint)
      ? entry.entrypoint
      : resolve(options.cwd, entry.entrypoint);
    if (!existsSync(absEntry)) {
      throw new Error(`Template not found: ${entry.entrypoint}`);
    }

    const programCode = await bundleTemplate(absEntry);
    if (!programCode || programCode.length === 0) {
      throw new Error(`bundleTemplate returned empty for ${entry.name}`);
    }

    const compiled = compileTemplate(programCode);
    if (compiled.error || !compiled.media) {
      throw compiled.error ?? new Error(`compileTemplate failed for ${entry.name}`);
    }

    const sourceId = sanitizeTemplateId(entry.name);
    const pkg = await compileTemplatePackage(compiled.media, {
      sourceId,
      programCode,
    });

    if (pkg.assets.some((a) => a.remote) || pkg.media.assets.some((a) => a.remote)) {
      throw new Error(
        `Package ${sourceId}: remote assets are not allowed; vendor all assets`,
      );
    }

    const dest = join(options.outRoot, sourceId, pkg.packageHash);
    mkdirSync(dest, { recursive: true });

    writeFileSync(join(dest, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
    writeFileSync(join(dest, "program.mjs"), programCode);
    writeFileSync(
      join(dest, "media.json"),
      `${JSON.stringify(pkg.media, null, 2)}\n`,
    );
    writeFileSync(
      join(dest, "requirements.json"),
      `${JSON.stringify(pkg.requirements, null, 2)}\n`,
    );

    const written = readFileSync(join(dest, "program.mjs"));
    if (sha256Hex(written) !== pkg.program.sha256) {
      throw new Error(`Package ${sourceId}: program hash mismatch after write`);
    }

    assertSafePackagePath(pkg.program.path, "program.path");
    for (const a of pkg.assets) {
      assertSafePackagePath(a.path, `asset ${a.id}`);
      if (isAbsolute(a.path)) {
        throw new Error(
          `Package ${sourceId}: absolute asset path forbidden: ${a.path}`,
        );
      }
    }

    results.push({
      sourceId,
      packageHash: pkg.packageHash,
      relativePath: join(sourceId, pkg.packageHash),
      absolutePath: dest,
      pkg,
    });
  }

  return results;
}

/** Load and verify a package from disk (startup / job admission). */
export function loadAndVerifyPackage(packageDir: string): TemplatePackage {
  const packageJsonPath = join(packageDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Missing package.json in ${packageDir}`);
  }
  const raw = JSON.parse(readFileSync(packageJsonPath, "utf8")) as TemplatePackage;
  const programRel = raw.program?.path ?? "program.mjs";
  assertSafePackagePath(programRel, "program.path");
  const programPath = join(packageDir, programRel);
  if (!existsSync(programPath)) {
    throw new Error(`Missing program at ${programPath}`);
  }
  const programBytes = readFileSync(programPath);
  if (sha256Hex(programBytes) !== raw.program.sha256) {
    throw new Error(`Tampered program in ${packageDir}`);
  }
  return validateTemplatePackage(raw, { expectedPackageHash: raw.packageHash });
}

export function listPackagedTemplates(packagesRoot: string): PackagedTemplate[] {
  if (!existsSync(packagesRoot)) return [];
  const out: PackagedTemplate[] = [];
  for (const sourceId of readdirSync(packagesRoot)) {
    const tdir = join(packagesRoot, sourceId);
    if (!statSync(tdir).isDirectory()) continue;
    for (const hash of readdirSync(tdir)) {
      const pdir = join(tdir, hash);
      if (!statSync(pdir).isDirectory()) continue;
      try {
        const pkg = loadAndVerifyPackage(pdir);
        out.push({
          sourceId: pkg.sourceId,
          packageHash: pkg.packageHash,
          relativePath: join(sourceId, hash),
          absolutePath: pdir,
          pkg,
        });
      } catch {
        // skip invalid packages
      }
    }
  }
  return out;
}

function sanitizeTemplateId(name: string): string {
  return (
    name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+|-+$/g, "") || "template"
  );
}
