//! Resolve package ownership and workspace roots.

import { resolve, dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

/**
 * Checks if a directory is a workspace root.
 * Detects: npm/yarn workspaces, pnpm-workspace.yaml, lerna.json
 */
export function isWorkspaceRoot(dir: string): boolean {
  const pkgPath = join(dir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.workspaces) return true;
    } catch {
      // Ignore parse errors
    }
  }
  if (existsSync(join(dir, "pnpm-workspace.yaml"))) return true;
  if (existsSync(join(dir, "lerna.json"))) return true;
  return false;
}

/** Find the nearest workspace root above a package/directory, if one exists. */
export function findWorkspaceRoot(cwd = process.cwd()): string | null {
  let dir = resolve(cwd);
  while (true) {
    if (isWorkspaceRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Finds the owning package by walking up from cwd. Workspace roots own
 * membership and lockfiles, but do not replace a package's own source root.
 *
 * @param cwd - Starting directory (defaults to process.cwd())
 * @returns The project root directory
 * @throws If no package.json is found
 */
export function findProjectRoot(cwd = process.cwd()): string {
  let dir = resolve(cwd);

  while (true) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    `No package.json found. Run this command from a project directory, or run 'superimg init' to create one.`
  );
}
