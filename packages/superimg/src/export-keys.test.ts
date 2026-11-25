/**
 * Published entry export keys. Parse dist text only — do not import it
 * (browser entries need a DOM).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
  exports: Record<string, unknown>;
};

/** 1–2 character minified export aliases. */
const MINIFIED_NAME = /^[a-z_$][a-z0-9_$]?$/i;

/** Public names that are intentionally 1–2 characters. */
const PUBLIC_SHORT_NAMES: Readonly<Record<string, readonly string[]>> = {
  ".": ["h"], // hyperscript
  "./film": ["r"], // rectangle
};

interface ExportTarget {
  subpath: string;
  condition: string;
  file: string;
}

function jsPaths(value: unknown): string[] {
  if (typeof value === "string") return value.endsWith(".js") ? [value] : [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const found: string[] = [];
  for (const nested of Object.values(value)) found.push(...jsPaths(nested));
  return found;
}

function exportTargets(): ExportTarget[] {
  const targets: ExportTarget[] = [];
  for (const [subpath, value] of Object.entries(pkg.exports)) {
    if (typeof value === "string") {
      if (value.endsWith(".js")) targets.push({ subpath, condition: "default", file: value });
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    for (const [condition, nested] of Object.entries(value)) {
      for (const file of [...new Set(jsPaths(nested))]) {
        targets.push({ subpath, condition, file });
      }
    }
  }
  return targets;
}

function exportedNames(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/^export \* from\s+(['"][^'"]+['"])/gm)) {
    names.push(`* from ${match[1]}`);
  }
  for (const match of source.matchAll(/^export \* as ([A-Za-z_$][\w$]*) from\s+/gm)) {
    names.push(match[1]!);
  }
  for (const block of source.matchAll(/^export \{([\s\S]*?)\}(?:\s+from\s+['"][^'"]+['"])?;/gm)) {
    for (const part of block[1]!.split(",")) {
      const item = part.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (!item) continue;
      const alias = item.match(
        /^(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/,
      );
      if (!alias) continue;
      names.push((alias[2] ?? alias[1])!);
    }
  }
  names.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return names;
}

describe("published export keys", () => {
  for (const target of exportTargets()) {
    const absolute = join(pkgRoot, target.file);
    const label = `${target.subpath} [${target.condition}]`;
    if (!existsSync(absolute)) {
      it.skip(`${label} (${target.file} dist is not built)`, () => {});
      continue;
    }
    it(`${label} exports no minified names`, () => {
      const names = exportedNames(readFileSync(absolute, "utf8"));
      const shortNames = PUBLIC_SHORT_NAMES[target.subpath] ?? PUBLIC_SHORT_NAMES["."]!;
      expect(
        names.filter((name) => MINIFIED_NAME.test(name) && !shortNames.includes(name)),
        target.file,
      ).toEqual([]);
      expect(names).toMatchSnapshot();
    });
  }
});
