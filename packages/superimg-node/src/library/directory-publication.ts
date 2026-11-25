import { existsSync, lstatSync, renameSync, rmSync } from "node:fs";

export function publishDirectory(staging: string, finalPath: string, backup: string): void {
  let movedPrevious = false;
  try {
    if (existsSync(finalPath)) {
      if (lstatSync(finalPath).isSymbolicLink()) {
        throw new Error(`Media export destination cannot be a symlink: ${finalPath}`);
      }
      renameSync(finalPath, backup);
      movedPrevious = true;
    }
    renameSync(staging, finalPath);
    if (movedPrevious) {
      try {
        rmSync(backup, { recursive: true, force: true });
      } catch {
        // The new complete bundle is visible. A hidden backup is safer than
        // reporting publication failure after the atomic swap succeeded.
      }
    }
  } catch (error) {
    if (!existsSync(finalPath) && movedPrevious && existsSync(backup)) {
      renameSync(backup, finalPath);
    }
    throw error;
  }
}
