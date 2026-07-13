import { createRequire } from "module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath, URL } from "url";

const _require = createRequire(import.meta.url);
const cssPath = _require.resolve("katex/dist/katex.min.css");
const css = readFileSync(cssPath, "utf8");

const out = `// AUTO-GENERATED — do not edit manually.
// Run: node scripts/gen-katex-css.mjs  (happens automatically during build)
const katexCssText: string = ${JSON.stringify(css)};
export default katexCssText;
`;

const destPath = new URL("../.generated/katex-css.ts", import.meta.url);
const dest = fileURLToPath(destPath);
if (process.argv.includes("--check")) {
  if (!existsSync(dest) || readFileSync(dest, "utf8") !== out) {
    throw new Error("Generated KaTeX CSS is stale; run pnpm generate");
  }
  console.log("Generated KaTeX CSS is current");
} else {
  mkdirSync(new URL("../.generated/", import.meta.url), { recursive: true });
  writeFileSync(dest, out);
  console.log("Generated katex-css.ts (" + css.length + " chars)");
}
