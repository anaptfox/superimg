import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as templatePublic from "../template-public.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT_ENTRY = resolve(HERE, "../../../superimg/src/index.ts");

function specifierNames(block: string): string[] {
  return block
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith("type "))
    .map((part) => {
      const alias = part.split(/\s+as\s+/);
      return (alias[1] ?? alias[0] ?? "").trim();
    })
    .filter((name) => name.length > 0);
}

/** Value export names of a SuperImg source file, following relative `export *`. */
function valueExportNames(file: string, seen = new Set<string>()): string[] {
  const abs = resolve(file);
  if (seen.has(abs)) return [];
  seen.add(abs);
  let text = readFileSync(abs, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  text = text.replace(
    /export\s+type\s+\{[\s\S]*?\}(?:\s+from\s+["'][^"']+["'])?\s*;?/g,
    "",
  );
  const names: string[] = [];
  for (const match of text.matchAll(/export\s+\*\s+from\s+["'](\.[^"']+)["']/g)) {
    let rel = match[1] ?? "";
    if (rel.endsWith(".js")) rel = `${rel.slice(0, -3)}.ts`;
    names.push(...valueExportNames(resolve(dirname(abs), rel), seen));
  }
  for (const match of text.matchAll(/export\s+\{([\s\S]*?)\}/g)) {
    names.push(...specifierNames(match[1] ?? ""));
  }
  return names;
}

describe("template-public", () => {
  it("exports the same value names as the superimg package root", () => {
    const root = [...new Set(valueExportNames(ROOT_ENTRY))].sort();
    const declared = [
      ...new Set(valueExportNames(resolve(HERE, "../template-public.ts"))),
    ].sort();
    const runtime = Object.keys(templatePublic).sort();
    expect(declared).toEqual(root);
    expect(runtime).toEqual(root);
  });
});
