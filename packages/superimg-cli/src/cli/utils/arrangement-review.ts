//! CLI producer fingerprint and library-owned arrangement review.
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
export { assertArrangementReviewCurrent, writeArrangementReview, type ArrangementReviewSelection } from "@foxworth/superimg-node/review/advanced";
/** Fingerprint installed CLI code/resources once for each explicit review. */
export async function arrangementProducerIdentity(version: string): Promise<string> {
  const root = dirname(fileURLToPath(import.meta.url));
  const files: string[] = [];
  async function walk(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const name = join(path, entry.name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile() && /\.(?:js|mjs|wasm|ttf|woff2?)$/i.test(entry.name)) files.push(name);
    }
  }
  await walk(root);
  files.sort();
  const hash = createHash("sha256");
  for (const file of files) hash.update(relative(root, file)).update("\0").update(await readFile(file)).update("\0");
  return `${version}:${hash.digest("hex")}`;
}
