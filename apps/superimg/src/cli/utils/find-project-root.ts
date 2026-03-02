//! Find the project root (nearest package.json) by walking up from cwd

import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";

/**
 * Walks up from the given directory to find the nearest package.json.
 * Returns the directory containing it.
 *
 * @param cwd - Starting directory (defaults to process.cwd())
 * @returns The project root directory
 * @throws If no package.json is found
 */
export function findProjectRoot(cwd = process.cwd()): string {
  let dir = resolve(cwd);

  while (true) {
    if (existsSync(resolve(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `No package.json found. Run this command from a project directory, or run 'superimg init' to create one.`
      );
    }
    dir = parent;
  }
}
