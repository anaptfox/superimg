import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Writes data to a file, creating any missing parent directories recursively.
 */
export function writeFileRecursive(path: string, data: string | Uint8Array) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

/** Write a complete result beside its destination, then publish it atomically. */
export function writeFileAtomic(path: string, data: string | Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.superimg-${process.pid}-${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryPath, data);
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
