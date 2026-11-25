import { readFile, readdir } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const required = [
  "template-runtime.js",
  "template-runtime.d.ts",
  "browser/composition.js",
  "browser/composition.d.ts",
  "browser/player-composition.js",
  "browser/player-composition.d.ts",
  "browser/player-core.js",
  "browser/player-core.d.ts",
  "browser/source.js",
  "browser/source.d.ts",
];
for (const path of required) await readFile(new URL(path, dist));

const declarations = await readFile(new URL("template-runtime.d.ts", dist), "utf8");
if (!/export\s*\{[^}]*\bHtml\b[^}]*\}/s.test(declarations)) {
  throw new Error("@superimg/core/template-runtime declarations lost the Html export");
}

const [{ Html, source }, { sequence }, { prepareComposition }, { renderTemplateFrame }] = await Promise.all([
  import("@superimg/core/template-runtime"),
  import("@superimg/core/composition"),
  import("@superimg/core/player-composition"),
  import("@superimg/core/player-core"),
]);
if ([Html, source?.image, sequence, prepareComposition, renderTemplateFrame].some((value) => typeof value !== "function")) {
  throw new Error("@superimg/core public build entry is missing a required value export");
}

async function checkBrowserJs(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) await checkBrowserJs(path);
    else if (entry.name.endsWith(".js")) {
      const code = await readFile(path, "utf8");
      if (/\bnode:[a-z][\w/-]*\b|rolldown-runtime/.test(code)) {
        throw new Error(`Browser build contains a Node dependency: ${path.pathname}`);
      }
    }
  }
}
await checkBrowserJs(new URL("browser/", dist));
process.stdout.write("Core build entries verified\n");
