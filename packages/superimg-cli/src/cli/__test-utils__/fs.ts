import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "superimg-cli-test-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
