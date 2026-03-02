//! Find the project root by walking up from cwd
//! Prefers workspace roots (pnpm, npm, lerna) over nearest package.json

import { resolve, dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

/**
 * Checks if a directory is a workspace root.
 * Detects: npm/yarn workspaces, pnpm-workspace.yaml, lerna.json
 */
function isWorkspaceRoot(dir: string): boolean {
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

/**
 * Finds the project root by walking up from cwd.
 * Prefers workspace roots over nearest package.json for monorepo support.
 *
 * @param cwd - Starting directory (defaults to process.cwd())
 * @returns The project root directory
 * @throws If no package.json is found
 */
export function findProjectRoot(cwd = process.cwd()): string {
  let dir = resolve(cwd);
  let nearestPkgJson: string | null = null;

  while (true) {
    // Check for workspace root first (takes priority)
    if (isWorkspaceRoot(dir)) {
      return dir;
    }
    // Track nearest package.json as fallback
    if (existsSync(join(dir, "package.json"))) {
      nearestPkgJson ??= dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback to nearest package.json
  if (nearestPkgJson) {
    return nearestPkgJson;
  }

  throw new Error(
    `No package.json found. Run this command from a project directory, or run 'superimg init' to create one.`
  );
}
