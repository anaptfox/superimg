import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export function loadEntries() {
  appendFileSync(join(root, "provider-count.txt"), "x");
  return JSON.parse(readFileSync(join(root, "rows.json"), "utf8"));
}
