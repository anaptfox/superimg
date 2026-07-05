#!/usr/bin/env npx tsx
/**
 * Compile playground examples to static assets for Gumbo (or any static host).
 *
 * Output layout (under --out, default: public/playground):
 *   manifest.json
 *   examples/{id}/code.ts
 *   examples/{id}/bundle.iife.js   (when needsBundle)
 *   assets/{id}/...              (companion files from template dirs)
 *
 * Mirrors cross-template asset refs into {out}/assets/{exampleId}/ (flat filenames).
 * Gumbo dev only serves playground/assets/<known-example-id>/*.
 *
 * Env (set by gumbo [[build.hook]]):
 *   GUMBO_ROOT   — project root
 *   GUMBO_OUTDIR — bundle outdir (dist)
 *   GUMBO_MODE   — build | dev
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import {
  bundleTemplate,
  bundleTemplateCode,
} from "../packages/superimg-core/dist/bundler.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SUPERIMG_ROOT = path.resolve(SCRIPT_DIR, "..");
const EXAMPLES_DIR = path.join(SUPERIMG_ROOT, "examples");
const METADATA_PATH = path.join(EXAMPLES_DIR, "_templates.json");
const generatedFiles = new Set<string>();

type TemplateCategory =
  | "basics"
  | "marketing"
  | "events"
  | "social"
  | "interfaces"
  | "data"
  | "vector"
  | "developer"
  | "composed";

interface TemplateMetadata {
  title: string;
  category: TemplateCategory;
  description?: string;
}

interface PlaygroundMeta {
  liveEdit?: boolean;
  needsAssets?: boolean;
  needsBundle?: boolean;
  duration?: number;
}

interface CatalogEntry {
  id: string;
  title: string;
  description?: string;
  category: string;
  codeUrl: string;
  bundledUrl?: string;
  playground?: PlaygroundMeta;
}

interface BuiltinSpec {
  id: string;
  title: string;
  category: TemplateCategory;
  module: string;
  export: string;
}

/** Editor keeps WASM live-compile for these demos even when a preview bundle exists. */
const EDITOR_WASM_DEMO_IDS = new Set([
  "code-galaxy",
  "countdown",
  "force-graph",
  "math-tunnel",
  "spinner",
  "svg-filter",
]);

/** Built-in string-literal examples (not sourced from examples/<category>/). */
const BUILTIN_SPECS: BuiltinSpec[] = [
  { id: "complete-template", title: "Complete Template (config + defaults)", category: "basics", module: "basics", export: "COMPLETE_TEMPLATE" },
  { id: "hello-world", title: "Hello World", category: "basics", module: "basics", export: "HELLO_WORLD" },
  { id: "animated-text", title: "Animated Text", category: "basics", module: "basics", export: "ANIMATED_TEXT" },
  { id: "gradient", title: "Gradient Background", category: "basics", module: "basics", export: "GRADIENT" },
  { id: "product-hunt", title: "Product Hunt Launch Card", category: "marketing", module: "marketing", export: "PRODUCT_HUNT" },
  { id: "year-in-review", title: "Year in Review / Wrapped", category: "marketing", module: "marketing", export: "YEAR_IN_REVIEW" },
  { id: "countdown", title: "Countdown Timer", category: "marketing", module: "marketing", export: "COUNTDOWN" },
  { id: "logo-animation", title: "Logo Animation", category: "marketing", module: "marketing", export: "LOGO_ANIMATION" },
  { id: "personalized-video", title: "Personalized Video", category: "marketing", module: "marketing", export: "PERSONALIZED_VIDEO" },
  { id: "testimonials", title: "Testimonial Wall", category: "marketing", module: "social", export: "TESTIMONIALS" },
  { id: "weekly-schedule", title: "Weekly Schedule", category: "events", module: "social", export: "WEEKLY_SCHEDULE" },
  { id: "milestone", title: "Follower Milestone", category: "social", module: "social", export: "MILESTONE" },
  { id: "twitter-post", title: "Twitter/X Post Animation", category: "social", module: "social", export: "TWITTER_POST" },
  { id: "star-history", title: "Star History", category: "data", module: "charts", export: "STAR_HISTORY" },
  { id: "mrr", title: "MRR Counter", category: "data", module: "social", export: "MRR" },
  { id: "npm-stats", title: "NPM Downloads", category: "data", module: "charts", export: "NPM_STATS" },
  { id: "benchmark", title: "Benchmark Bars", category: "data", module: "charts", export: "BENCHMARK" },
  { id: "timeline", title: "Animated Timeline", category: "data", module: "charts", export: "TIMELINE" },
  { id: "code-typewriter", title: "Code Typewriter", category: "developer", module: "developer", export: "CODE_TYPEWRITER" },
  { id: "git-diff", title: "Git Diff", category: "developer", module: "developer", export: "GIT_DIFF" },
  { id: "terminal", title: "Terminal Session", category: "developer", module: "developer", export: "TERMINAL" },
  { id: "git-branch", title: "Git Branch", category: "developer", module: "developer", export: "GIT_BRANCH" },
  { id: "github-readme", title: "GitHub README Animation", category: "developer", module: "developer", export: "GITHUB_README" },
  { id: "changelog", title: "Changelog/Release Notes", category: "developer", module: "developer", export: "CHANGELOG" },
];

function parseArgs(argv: string[]) {
  let outDir = "public/playground";
  let gumboRoot = process.env.GUMBO_ROOT;
  let builtinsDir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) {
      outDir = argv[++i];
    } else if (arg === "--root" && argv[i + 1]) {
      gumboRoot = argv[++i];
    } else if (arg === "--builtins-dir" && argv[i + 1]) {
      builtinsDir = argv[++i];
    }
  }

  gumboRoot ??= path.resolve(SUPERIMG_ROOT, "../superimg_app");
  const resolvedOut = path.isAbsolute(outDir)
    ? outDir
    : path.join(gumboRoot, outDir);

  return { outDir: resolvedOut, gumboRoot, builtinsDir };
}

function markGenerated(filePath: string) {
  generatedFiles.add(path.resolve(filePath));
}

function writeFileIfChanged(filePath: string, contents: string) {
  markGenerated(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf-8") === contents) {
    return false;
  }
  fs.writeFileSync(filePath, contents);
  return true;
}

function copyFileIfChanged(src: string, dest: string) {
  markGenerated(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    const srcStat = fs.statSync(src);
    const destStat = fs.statSync(dest);
    if (srcStat.size === destStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
      return false;
    }
  }
  fs.copyFileSync(src, dest);
  return true;
}

function pruneStaleFiles(root: string) {
  if (!fs.existsSync(root)) return;

  function walk(dir: string): boolean {
    let hasEntries = false;
    for (const name of fs.readdirSync(dir)) {
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const childHasEntries = walk(filePath);
        if (!childHasEntries) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          hasEntries = true;
        }
        continue;
      }

      if (generatedFiles.has(path.resolve(filePath))) {
        hasEntries = true;
      } else {
        fs.rmSync(filePath, { force: true });
      }
    }
    return hasEntries;
  }

  walk(root);
}

function hasRelativeImports(code: string): boolean {
  return /from\s+["'][./]/.test(code) || /import\s+["'][./]/.test(code);
}

function hasConfigAssets(code: string): boolean {
  return /\bassets\s*:\s*\{/.test(code);
}

function normalizeAssetPath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^(\.\.\/)+/, "");
}

function collectAssetRefs(code: string): string[] {
  const match = code.match(/\bassets\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (!match) return [];

  const refs: string[] = [];
  const stringRe = /["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = stringRe.exec(match[1]))) {
    const value = m[1];
    if (value.includes("/") || value.includes(".")) {
      refs.push(value);
    }
  }
  return refs;
}

function flattenAssetPath(normalized: string): string {
  return normalized.replace(/\//g, "--");
}

function mirrorReferencedAssets(
  code: string,
  templateDir: string,
  outDir: string,
  exampleId: string,
): void {
  const destDir = path.join(outDir, "assets", exampleId);
  fs.mkdirSync(destDir, { recursive: true });
  // Marker so Gumbo dev static serving registers the example assets directory.
  const marker = path.join(destDir, "package.json");
  writeFileIfChanged(marker, JSON.stringify({ name: exampleId, private: true }, null, 2));

  for (const ref of collectAssetRefs(code)) {
    const src = path.resolve(templateDir, ref);
    const normalized = normalizeAssetPath(ref);
    const dest = path.join(destDir, flattenAssetPath(normalized));

    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      console.warn(`Warning: asset missing: ${ref} (resolved ${src})`);
      continue;
    }

    copyFileIfChanged(src, dest);
  }
}

function resolveLiveEdit(id: string, hasBundle: boolean): boolean {
  if (EDITOR_WASM_DEMO_IDS.has(id)) return true;
  return !hasBundle;
}

function parseDuration(code: string): number | undefined {
  const match = code.match(/\bduration\s*:\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}

function needsPreBundle(dirPath: string, code: string): boolean {
  if (hasRelativeImports(code)) return true;

  const files = fs.readdirSync(dirPath);
  const mediaFiles = files.filter(
    (f) => f.endsWith(".media.ts") || f.endsWith(".media.js"),
  );
  if (mediaFiles.length > 1) return true;

  const companionFiles = files.filter(
    (f) =>
      (f.endsWith(".ts") || f.endsWith(".js")) &&
      !mediaFiles.includes(f) &&
      !f.endsWith(".test.ts") &&
      !f.endsWith(".test.js"),
  );
  return companionFiles.length > 0;
}

function copyCompanionAssets(srcDir: string, destRoot: string, exampleId: string) {
  const destDir = path.join(destRoot, "assets", exampleId);
  const files = fs.readdirSync(srcDir);
  const skip = new Set([".DS_Store"]);

  for (const file of files) {
    if (skip.has(file)) continue;
    const src = path.join(srcDir, file);
    if (!fs.statSync(src).isFile()) continue;
    if (file.endsWith(".media.ts") || file.endsWith(".media.js")) continue;
    if (file.endsWith(".test.ts") || file.endsWith(".test.js")) continue;
    copyFileIfChanged(src, path.join(destDir, file));
  }
}

function writeExample(
  outDir: string,
  entry: Omit<CatalogEntry, "codeUrl" | "bundledUrl"> & {
    code: string;
    bundled?: string;
    assetDir?: string;
  },
): CatalogEntry {
  const exampleDir = path.join(outDir, "examples", entry.id);
  fs.mkdirSync(exampleDir, { recursive: true });

  const codePath = path.join(exampleDir, "code.ts");
  writeFileIfChanged(codePath, entry.code);

  const catalog: CatalogEntry = {
    id: entry.id,
    title: entry.title,
    ...(entry.description ? { description: entry.description } : {}),
    category: entry.category,
    codeUrl: `/playground/examples/${entry.id}/code.ts`,
    playground: entry.playground,
  };

  if (entry.bundled !== undefined) {
    const bundlePath = path.join(exampleDir, "bundle.iife.js");
    writeFileIfChanged(bundlePath, entry.bundled);
    catalog.bundledUrl = `/playground/examples/${entry.id}/bundle.iife.js`;
  }

  if (entry.assetDir) {
    copyCompanionAssets(entry.assetDir, outDir, entry.id);
  }

  if (entry.playground?.needsAssets) {
    ensureAssetDirMarker(outDir, entry.id);
  }

  return catalog;
}

function ensureAssetDirMarker(outDir: string, exampleId: string) {
  const marker = path.join(outDir, "assets", exampleId, ".playground");
  writeFileIfChanged(marker, exampleId);
}

async function loadBuiltinModules(builtinsDir: string) {
  const modules: Record<string, Record<string, string>> = {};
  const files = new Set(BUILTIN_SPECS.map((s) => s.module));

  for (const mod of files) {
    const filePath = path.join(builtinsDir, `${mod}.ts`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: builtin module missing: ${filePath}`);
      continue;
    }
    const url = pathToFileURL(filePath).href;
    modules[mod] = (await import(url)) as Record<string, string>;
  }

  return modules;
}

async function compileTemplates(outDir: string): Promise<CatalogEntry[]> {
  const metadata: Record<string, TemplateMetadata> = JSON.parse(
    fs.readFileSync(METADATA_PATH, "utf-8"),
  );

  const catalog: CatalogEntry[] = [];

  for (const [id, meta] of Object.entries(metadata).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const dirPath = path.join(EXAMPLES_DIR, meta.category, id);
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      console.warn(`Warning: Missing directory for ${id} at ${dirPath}, skipping`);
      continue;
    }

    const files = fs.readdirSync(dirPath);
    const templateFiles = files.filter(
      (file) => file.endsWith(".media.ts") || file.endsWith(".media.js"),
    );
    if (templateFiles.length !== 1) continue;

    const [templateFile] = templateFiles;
    const filePath = path.join(dirPath, templateFile);
    const code = fs.readFileSync(filePath, "utf-8");
    const mustBundle = needsPreBundle(dirPath, code);
    const needsAssets = hasConfigAssets(code);
    const duration = parseDuration(code);

    // Bundle when the template has companions/imports, or when the editor should
    // prefer a prebuilt IIFE over in-browser WASM (not in EDITOR_WASM_DEMO_IDS).
    const shouldBundle = mustBundle || !EDITOR_WASM_DEMO_IDS.has(id);

    let bundled: string | undefined;
    if (shouldBundle) {
      try {
        bundled = await bundleTemplate(filePath);
        console.log(`  ✓ ${meta.category}/${id} → ${meta.title} (bundled)`);
      } catch (err) {
        console.warn(
          `Warning: Bundle failed for ${id}: ${err instanceof Error ? err.message : err}`,
        );
        console.log(`  ✓ ${meta.category}/${id} → ${meta.title} (code only)`);
      }
    } else {
      console.log(`  ✓ ${meta.category}/${id} → ${meta.title}`);
    }

    if (needsAssets) {
      mirrorReferencedAssets(code, dirPath, outDir, id);
    }

    const hasBundle = bundled !== undefined;
    const playground: PlaygroundMeta = {
      liveEdit: resolveLiveEdit(id, hasBundle),
      needsBundle: mustBundle,
      needsAssets,
      ...(duration !== undefined ? { duration } : {}),
    };

    catalog.push(
      writeExample(outDir, {
        id,
        title: meta.title,
        description: meta.description,
        category: meta.category,
        code,
        bundled,
        playground,
        assetDir: dirPath,
      }),
    );
  }

  return catalog;
}

async function compileBuiltins(
  outDir: string,
  builtinsDir: string,
  templateIds: Set<string>,
): Promise<CatalogEntry[]> {
  const modules = await loadBuiltinModules(builtinsDir);
  const catalog: CatalogEntry[] = [];

  for (const spec of BUILTIN_SPECS) {
    if (templateIds.has(spec.id)) continue;

    const mod = modules[spec.module];
    const code = mod?.[spec.export];
    if (!code) {
      console.warn(`Warning: builtin ${spec.id} export ${spec.export} missing`);
      continue;
    }

    const duration = parseDuration(code);

    let bundled: string | undefined;
    try {
      bundled = await bundleTemplateCode(code);
      console.log(`  ✓ builtin/${spec.id} → ${spec.title} (bundled)`);
    } catch (err) {
      console.warn(
        `Warning: Bundle failed for builtin ${spec.id}: ${err instanceof Error ? err.message : err}`,
      );
      console.log(`  ✓ builtin/${spec.id} → ${spec.title} (code only)`);
    }

    const hasBundle = bundled !== undefined;
    const playground: PlaygroundMeta = {
      liveEdit: resolveLiveEdit(spec.id, hasBundle),
      needsBundle: false,
      needsAssets: hasConfigAssets(code),
      ...(duration !== undefined ? { duration } : {}),
    };

    catalog.push(
      writeExample(outDir, {
        id: spec.id,
        title: spec.title,
        category: spec.category,
        code,
        bundled,
        playground,
      }),
    );
  }

  return catalog;
}

async function main() {
  const { outDir, gumboRoot, builtinsDir } = parseArgs(process.argv.slice(2));
  const resolvedBuiltins =
    builtinsDir ?? path.join(gumboRoot, "src/lib/video/examples");

  console.log(`Compiling playground → ${outDir}`);
  console.log(`  GUMBO_ROOT=${gumboRoot}`);
  if (process.env.GUMBO_MODE) {
    console.log(`  GUMBO_MODE=${process.env.GUMBO_MODE}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const templateCatalog = await compileTemplates(outDir);
  const templateIds = new Set(templateCatalog.map((e) => e.id));
  const builtinCatalog = await compileBuiltins(outDir, resolvedBuiltins, templateIds);

  const categories = [
    { id: "basics", title: "Basics" },
    { id: "marketing", title: "Marketing" },
    { id: "events", title: "Events" },
    { id: "social", title: "Social" },
    { id: "interfaces", title: "Interfaces" },
    { id: "data", title: "Data" },
    { id: "vector", title: "Vector" },
    { id: "developer", title: "Developer" },
    { id: "composed", title: "Composed" },
  ];
  const examples = [...templateCatalog, ...builtinCatalog].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const manifestPath = path.join(outDir, "manifest.json");
  const manifestShape = {
    version: 1,
    categories,
    examples,
  };
  let generatedAt = new Date().toISOString();
  if (fs.existsSync(manifestPath)) {
    try {
      const previous = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
        generatedAt?: string;
      } & typeof manifestShape;
      const previousShape = {
        version: previous.version,
        categories: previous.categories,
        examples: previous.examples,
      };
      if (JSON.stringify(previousShape) === JSON.stringify(manifestShape)) {
        generatedAt = previous.generatedAt ?? generatedAt;
      }
    } catch {
      // A malformed manifest should be replaced below.
    }
  }
  const manifest = {
    ...manifestShape,
    generatedAt,
  };

  writeFileIfChanged(manifestPath, JSON.stringify(manifest, null, 2));
  pruneStaleFiles(outDir);

  console.log(
    `\nWrote ${manifest.examples.length} examples to ${outDir}/manifest.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
