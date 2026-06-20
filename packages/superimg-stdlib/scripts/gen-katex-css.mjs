import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, URL } from "url";

const _require = createRequire(import.meta.url);
const cssPath = _require.resolve("katex/dist/katex.min.css");
const css = readFileSync(cssPath, "utf8");

const out = `// AUTO-GENERATED — do not edit manually.
// Run: node scripts/gen-katex-css.mjs  (happens automatically during build)
const katexCssText: string = ${JSON.stringify(css)};
export default katexCssText;
`;

const destPath = new URL("../src/viz/katex-css.generated.ts", import.meta.url);
writeFileSync(fileURLToPath(destPath), out);
console.log("Generated katex-css.generated.ts (" + css.length + " chars)");
