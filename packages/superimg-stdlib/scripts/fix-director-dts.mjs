#!/usr/bin/env node
//! tsdown emits the shared src/director/* dts chunk as director.d.ts (stealing
//! the entry name) and the real `@superimg/stdlib/director` entry types as
//! director2.d.ts. The JS side is NOT swapped (director.js is the entry), so we
//! swap the two d.ts files and repoint chunk imports at director2.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const entryPath = join(dist, "director.d.ts");
const chunkPath = join(dist, "director2.d.ts");

if (!existsSync(entryPath) || !existsSync(chunkPath)) process.exit(0);

const a = readFileSync(entryPath, "utf8"); // suspected chunk (mangled exports)
const b = readFileSync(chunkPath, "utf8"); // suspected entry (public names)

const isMangledChunk = (s) => /export \{[^}]* as _/.test(s);
const hasPublicEntry = (s) =>
  s.includes("createDirector") && s.includes("mergeMotion") && !isMangledChunk(s);

if (!isMangledChunk(a) || !hasPublicEntry(b)) process.exit(0);

// Every d.ts importing "./director.js" today means the mangled chunk — repoint
// to director2, where the chunk is about to live. Includes the entry itself.
for (const file of readdirSync(dist)) {
  if (!file.endsWith(".d.ts") || file === "director.d.ts") continue;
  const p = join(dist, file);
  const src = readFileSync(p, "utf8");
  const next = src.replaceAll('from "./director.js"', 'from "./director2.js"');
  if (next !== src) writeFileSync(p, next);
}

writeFileSync(
  entryPath,
  b
    .replaceAll('from "./director.js"', 'from "./director2.js"')
    .replace(/sourceMappingURL=director2\.d\.ts\.map/, "sourceMappingURL=director.d.ts.map"),
);
writeFileSync(
  chunkPath,
  a.replace(/sourceMappingURL=director\.d\.ts\.map/, "sourceMappingURL=director2.d.ts.map"),
);
console.log("[fix-director-dts] swapped director.d.ts ↔ director2.d.ts (entry ↔ chunk)");
