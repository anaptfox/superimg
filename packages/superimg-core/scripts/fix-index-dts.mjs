#!/usr/bin/env node
//! tsdown may emit the main package types as a numbered index declaration when
//! a shared chunk steals the "index" name. Prefer the complete public surface.
//!
//! Also: pure IR shared chunks produce circular `import { A as name } from "./index.js"`
//! in index.d.ts / ir.d.ts. Rolldown then fails because letter aliases are not
//! exported. Rewrite those imports into ambient declares + named exports.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const indexDts = join(dist, "index.d.ts");
const publicSurfaceMarkers = ["CheckpointResolver", "serializeMediaIR"];

if (existsSync(indexDts)) {
  const primary = readFileSync(indexDts, "utf8");
  const primaryIsComplete = publicSurfaceMarkers.every((marker) =>
    primary.includes(marker),
  );

  if (!primaryIsComplete) {
    const candidate = readdirSync(dist)
      .filter((name) => /^index\d+\.d\.ts$/.test(name))
      .map((name) => ({
        name,
        text: readFileSync(join(dist, name), "utf8"),
      }))
      .filter(({ text }) =>
        publicSurfaceMarkers.every((marker) => text.includes(marker)),
      )
      .sort((a, b) => b.text.length - a.text.length)[0];

    if (candidate) {
      writeFileSync(
        indexDts,
        candidate.text.replace(
          /sourceMappingURL=index\d+\.d\.ts\.map/,
          "sourceMappingURL=index.d.ts.map",
        ),
      );
      const candidateMap = join(dist, `${candidate.name}.map`);
      if (existsSync(candidateMap)) {
        copyFileSync(candidateMap, join(dist, "index.d.ts.map"));
      }
      console.log(
        `[fix-index-dts] promoted ${candidate.name} → index.d.ts`,
      );
    }
  }
}

/**
 * Rewrite circular mangled imports from "./index.js" into ambient declares so
 * consumers can resolve named pure-IR symbols.
 */
function fixCircularMangledImports(filePath) {
  if (!existsSync(filePath)) return false;
  let text = readFileSync(filePath, "utf8");
  const re =
    /import\s*\{([^}]+)\}\s*from\s*["']\.\/index\.js["'];?/g;
  let changed = false;
  text = text.replace(re, (full, body) => {
    const parts = String(body)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const decls = [];
    const aliasExports = [];
    for (const part of parts) {
      // Forms: "A as parseQualifiedId" or "type X as Y" or bare "Foo"
      const typeMatch = part.match(/^type\s+(\w+)\s+as\s+(\w+)$/);
      const valueMatch = part.match(/^(\w+)\s+as\s+(\w+)$/);
      if (typeMatch) {
        const [, mangled, name] = typeMatch;
        decls.push(`type ${name} = unknown;`);
        aliasExports.push(`${name} as ${mangled}`);
        continue;
      }
      if (valueMatch) {
        const [, mangled, name] = valueMatch;
        // Values may be classes or functions — use a wide callable/constructable type.
        decls.push(
          `declare const ${name}: any;`,
          `type ${name} = any;`,
        );
        aliasExports.push(`${name} as ${mangled}`);
        continue;
      }
      // Bare identifier
      const bare = part.match(/^(\w+)$/);
      if (bare) {
        const name = bare[1];
        decls.push(`declare const ${name}: any;`, `type ${name} = any;`);
      }
    }
    changed = true;
    const exportLine =
      aliasExports.length > 0
        ? `\nexport type { ${aliasExports.filter((a) => a.includes(" as ")).join(", ")} };\n// mangled value aliases for circular chunk resolution\nexport { ${aliasExports.join(", ")} };`
        : "";
    // Prefer ambient block without re-exporting type-only mangled if it causes dups
    return `// [fix-index-dts] ambient pure-IR symbols (was circular import from ./index.js)\n${decls.join("\n")}`;
  });
  if (changed) {
    writeFileSync(filePath, text);
  }
  return changed;
}

let fixed = 0;
for (const name of readdirSync(dist)) {
  if (!name.endsWith(".d.ts")) continue;
  if (fixCircularMangledImports(join(dist, name))) {
    fixed += 1;
    console.log(`[fix-index-dts] rewrote circular imports in ${name}`);
  }
}
if (fixed === 0) {
  // still ok
}
