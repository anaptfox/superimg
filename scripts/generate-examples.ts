#!/usr/bin/env npx tsx
/**
 * Generate playground examples from category folders under examples/
 *
 * - Writes fingerprinted sidecars under apps/docs/public/playground/examples/{id}/
 *   (code.{hash}.ts, bundle.{hash}.iife.js)
 * - Emits slim manifests (codeUrl when bundled) in from-templates.ts + from-builtins.ts
 * - Incremental cache + bounded parallel Node rolldown bundling
 */

import * as crypto from "node:crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EXAMPLES_DIR = path.join(__dirname, "../examples");
const METADATA_PATH = path.join(EXAMPLES_DIR, "_templates.json");
const OUTPUT_FILE = path.join(
  __dirname,
  "../apps/docs/lib/video/examples/from-templates.ts",
);
const BUILTINS_OUTPUT = path.join(
  __dirname,
  "../apps/docs/lib/video/examples/from-builtins.ts",
);
const BUILTINS_SOURCE_DIR = path.join(
  __dirname,
  "../apps/docs/lib/video/examples",
);
const PUBLIC_PLAYGROUND_DIR = path.join(
  __dirname,
  "../apps/docs/public/playground",
);
const EXAMPLES_PUBLIC_DIR = path.join(PUBLIC_PLAYGROUND_DIR, "examples");
const ASSETS_PUBLIC_DIR = path.join(PUBLIC_PLAYGROUND_DIR, "assets");
const CACHE_FILE = path.join(PUBLIC_PLAYGROUND_DIR, ".build-cache.json");
const REPO_ROOT = path.join(__dirname, "..");

/**
 * Bump when the generated preview format or bundle policy changes. The value is
 * folded into every sidecar fingerprint so stale outputs cannot survive a
 * generator upgrade.
 */
const BUNDLE_CACHE_SCHEMA = 2;

const BUNDLE_CONCURRENCY = 6;

/** Editor keeps WASM live-compile for these demos even when a preview bundle exists. */
const EDITOR_WASM_DEMO_IDS = new Set([
  "code-galaxy",
  "countdown",
  "force-graph",
  "math-tunnel",
  "spinner",
  "svg-filter",
]);

const EXAMPLE_CATEGORIES = [
  "basics",
  "marketing",
  "events",
  "social",
  "interfaces",
  "data",
  "vector",
  "developer",
  "composed",
] as const;

type ExampleCategory = (typeof EXAMPLE_CATEGORIES)[number];
/** @deprecated Use ExampleCategory */
type TemplateCategory = ExampleCategory;

function assertExampleCategory(
  id: string,
  category: string,
): asserts category is ExampleCategory {
  if (!(EXAMPLE_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(
      `examples/_templates.json: "${id}" has invalid category "${category}". ` +
        `Expected one of: ${EXAMPLE_CATEGORIES.join(", ")}`,
    );
  }
}

interface TemplateMetadata {
  title: string;
  category: ExampleCategory;
  description?: string;
  liveEdit?: boolean;
}

interface PlaygroundMeta {
  liveEdit?: boolean;
  needsAssets?: boolean;
  needsBundle?: boolean;
  duration?: number;
}

interface ExampleEntry {
  id: string;
  title: string;
  category: TemplateCategory;
  code?: string;
  codeUrl?: string;
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

type BuildCache = Record<string, { hash: string; bundled: boolean }>;

const BUNDLE_PROVENANCE_PATHS = [
  path.join(REPO_ROOT, "pnpm-lock.yaml"),
  path.join(REPO_ROOT, "packages/superimg-core/dist"),
  path.join(REPO_ROOT, "packages/superimg-stdlib/dist"),
  path.join(REPO_ROOT, "packages/superimg-types/dist"),
  path.join(REPO_ROOT, "packages/superimg/dist/define.js"),
];

const BUNDLE_SOURCE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

const GENERATED_SOURCE_DIRS = new Set([
  ".next",
  ".output",
  ".turbo",
  ".vinxi",
  "build",
  "dist",
  "node_modules",
  "output",
]);

function hasRelativeImports(code: string): boolean {
  return /from\s+["'][./]/.test(code) || /import\s+["'][./]/.test(code);
}

function hasConfigAssets(code: string): boolean {
  return /\bassets\s*:\s*\{/.test(code);
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

function hashContent(parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 16);
}

function filesUnder(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return [root];
  if (!stat.isDirectory()) return [];

  return fs
    .readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => filesUnder(path.join(root, entry.name)))
    .sort();
}

function hashFiles(paths: string[], filter?: (file: string) => boolean): string {
  const hash = crypto.createHash("sha256");
  for (const file of paths.flatMap(filesUnder).sort()) {
    if (filter && !filter(file)) continue;
    hash.update(path.relative(REPO_ROOT, file));
    hash.update("\0");
    hash.update(fs.readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

const BUNDLE_PROVENANCE = hashContent([
  `schema:${BUNDLE_CACHE_SCHEMA}`,
  hashFiles(BUNDLE_PROVENANCE_PATHS),
]);

function hashExampleSources(dirPath: string): string {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!GENERATED_SOURCE_DIRS.has(entry.name)) visit(path.join(directory, entry.name));
        continue;
      }
      const file = path.join(directory, entry.name);
      if (entry.isFile() && BUNDLE_SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) {
        files.push(file);
      }
    }
  };
  visit(dirPath);
  return hashFiles(files);
}

async function bundleTemplate(entryPoint: string): Promise<string> {
  const bundler = await import("../packages/superimg-core/dist/bundler.js");
  return bundler.bundleTemplate(entryPoint, { minify: true, sourcemap: false });
}

async function bundleTemplateCode(
  code: string,
  options: { sourcefile: string; resolveDir: string },
): Promise<string> {
  const bundler = await import("../packages/superimg-core/dist/bundler.js");
  return bundler.bundleTemplateCode(code, {
    ...options,
    minify: true,
    sourcemap: false,
  });
}

/** Production preview bundles do not execute through the sourcemap-aware error
 * path. Source lives in its own code sidecar, so retaining a base64 inline map
 * only multiplies catalog transfer and repository size. */
function stripInlineSourceMap(code: string): string {
  return code.replace(
    /\n?\/\/# sourceMappingURL=data:application\/json[^\n]*\s*$/,
    "\n",
  );
}

function codeFilename(hash: string): string {
  return `code.${hash}.ts`;
}

function bundleFilename(hash: string): string {
  return `bundle.${hash}.iife.js`;
}

function sidecarUrls(
  id: string,
  hash: string,
  hasBundle = false,
): { codeUrl: string; bundledUrl?: string } {
  const codeUrl = `/playground/examples/${id}/${codeFilename(hash)}`;
  if (!hasBundle) return { codeUrl };
  return {
    codeUrl,
    bundledUrl: `/playground/examples/${id}/${bundleFilename(hash)}`,
  };
}

function pruneStaleSidecarFiles(exampleDir: string, hash: string) {
  if (!fs.existsSync(exampleDir)) return;
  const keep = new Set([codeFilename(hash), bundleFilename(hash)]);
  for (const file of fs.readdirSync(exampleDir)) {
    const isCode =
      file === "code.ts" || (file.startsWith("code.") && file.endsWith(".ts"));
    const isBundle =
      file === "bundle.iife.js" ||
      (file.startsWith("bundle.") && file.endsWith(".iife.js"));
    if ((isCode || isBundle) && !keep.has(file)) {
      fs.rmSync(path.join(exampleDir, file), { force: true });
    }
  }
}

function readCache(): BuildCache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as BuildCache;
  } catch {
    return {};
  }
}

function writeCache(cache: BuildCache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function pruneOrphanSidecars(activeIds: Set<string>, cache: BuildCache): number {
  let removed = 0;

  for (const [parent, label] of [
    [EXAMPLES_PUBLIC_DIR, "example"],
    [ASSETS_PUBLIC_DIR, "asset"],
  ] as const) {
    if (!fs.existsSync(parent)) continue;
    for (const entry of fs.readdirSync(parent)) {
      if (activeIds.has(entry)) continue;
      fs.rmSync(path.join(parent, entry), { recursive: true, force: true });
      removed++;
      console.log(`  − pruned orphan ${label} ${entry}`);
    }
  }

  for (const id of Object.keys(cache)) {
    if (!activeIds.has(id)) delete cache[id];
  }

  return removed;
}

function copyCompanionAssets(srcDir: string, exampleId: string) {
  const destDir = path.join(ASSETS_PUBLIC_DIR, exampleId);
  fs.rmSync(destDir, { recursive: true, force: true });
  const files = fs.readdirSync(srcDir);
  const skip = new Set([".DS_Store"]);

  for (const file of files) {
    if (skip.has(file)) continue;
    const src = path.join(srcDir, file);
    if (!fs.statSync(src).isFile()) continue;
    if (file.endsWith(".media.ts") || file.endsWith(".media.js")) continue;
    if (file.endsWith(".test.ts") || file.endsWith(".test.js")) continue;
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, file));
  }
}

function writeSidecar(
  id: string,
  code: string,
  contentHash: string,
  bundled?: string,
): { codeUrl: string; bundledUrl?: string } {
  const exampleDir = path.join(EXAMPLES_PUBLIC_DIR, id);
  fs.mkdirSync(exampleDir, { recursive: true });
  pruneStaleSidecarFiles(exampleDir, contentHash);
  fs.writeFileSync(path.join(exampleDir, codeFilename(contentHash)), code);

  if (bundled === undefined) return sidecarUrls(id, contentHash);

  fs.writeFileSync(
    path.join(exampleDir, bundleFilename(contentHash)),
    bundled,
  );
  return sidecarUrls(id, contentHash, true);
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    const i = index++;
    if (i >= items.length) return;
    await worker(items[i]!);
    await next();
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next()),
  );
}

async function bundleExample(
  cache: BuildCache,
  id: string,
  contentHash: string,
  bundleFn: () => Promise<string>,
  code: string,
  assetDir?: string,
): Promise<{ bundledUrl?: string; codeUrl: string }> {
  const bundlePath = path.join(
    EXAMPLES_PUBLIC_DIR,
    id,
    bundleFilename(contentHash),
  );
  const cached = cache[id];
  const bundleFileExists = fs.existsSync(bundlePath);

  if (cached?.hash === contentHash && cached.bundled && bundleFileExists) {
    writeSidecar(id, code, contentHash);
    if (assetDir) copyCompanionAssets(assetDir, id);
    return sidecarUrls(id, contentHash, true);
  }

  try {
    const bundled = stripInlineSourceMap(await bundleFn());
    const urls = writeSidecar(id, code, contentHash, bundled);
    if (assetDir) copyCompanionAssets(assetDir, id);
    cache[id] = { hash: contentHash, bundled: true };
    return urls;
  } catch (err) {
    const urls = writeSidecar(id, code, contentHash);
    if (assetDir) copyCompanionAssets(assetDir, id);
    cache[id] = { hash: contentHash, bundled: false };
    console.warn(
      `Warning: Bundle failed for ${id}: ${err instanceof Error ? err.message : err}`,
    );
    return urls;
  }
}

function formatExample(ex: ExampleEntry): string {
  const lines = [
    `  {`,
    `    id: ${JSON.stringify(ex.id)},`,
    `    title: ${JSON.stringify(ex.title)},`,
    `    category: ${JSON.stringify(ex.category)},`,
  ];
  if (ex.code !== undefined) lines.push(`    code: ${JSON.stringify(ex.code)},`);
  if (ex.codeUrl !== undefined) lines.push(`    codeUrl: ${JSON.stringify(ex.codeUrl)},`);
  if (ex.bundledUrl !== undefined) lines.push(`    bundledUrl: ${JSON.stringify(ex.bundledUrl)},`);
  if (ex.playground) lines.push(`    playground: ${JSON.stringify(ex.playground)},`);
  lines.push(`  }`);
  return lines.join("\n");
}

function writeManifest(
  filePath: string,
  exportName: string,
  examples: ExampleEntry[],
) {
  const output = `// AUTO-GENERATED by scripts/generate-examples.ts
// Do not edit directly
// Sidecar assets: apps/docs/public/playground/examples/{id}/code.{hash}.ts (+ bundle.{hash}.iife.js)

import type { EditorExample } from "./index";

export const ${exportName}: EditorExample[] = [
${examples.map(formatExample).join(",\n")}
];
`;
  fs.writeFileSync(filePath, output);
}

const rawMetadata = JSON.parse(
  fs.readFileSync(METADATA_PATH, "utf-8"),
) as Record<string, { title: string; category: string; description?: string; liveEdit?: boolean }>;
const metadata: Record<string, TemplateMetadata> = {};
for (const [id, meta] of Object.entries(rawMetadata)) {
  assertExampleCategory(id, meta.category);
  metadata[id] = meta as TemplateMetadata;
}

async function loadBuiltinModules() {
  const modules: Record<string, Record<string, string>> = {};
  const files = new Set(BUILTIN_SPECS.map((s) => s.module));

  for (const mod of files) {
    const filePath = path.join(BUILTINS_SOURCE_DIR, `${mod}.ts`);
    const url = pathToFileURL(filePath).href;
    modules[mod] = (await import(url)) as Record<string, string>;
  }
  return modules;
}

async function main() {
  fs.mkdirSync(EXAMPLES_PUBLIC_DIR, { recursive: true });
  const cache = readCache();
  const templateExamples: ExampleEntry[] = [];
  const templateJobs: Array<() => Promise<void>> = [];

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
    const complexTemplate = needsPreBundle(dirPath, code);
    const needsAssets = hasConfigAssets(code);
    const duration = parseDuration(code);
    const contentHash = hashContent([
      BUNDLE_PROVENANCE,
      code,
      path.relative(REPO_ROOT, filePath),
      JSON.stringify(meta),
      hashExampleSources(dirPath),
    ]);

    templateJobs.push(async () => {
      const urls = await bundleExample(
        cache,
        id,
        contentHash,
        () => bundleTemplate(filePath),
        code,
        dirPath,
      );

      const hasBundle = urls.bundledUrl !== undefined;
      const liveEdit =
        meta.liveEdit ??
        (EDITOR_WASM_DEMO_IDS.has(id) ? true : !hasBundle);

      const playground: PlaygroundMeta = {
        liveEdit,
        needsBundle: complexTemplate,
        needsAssets,
        ...(duration !== undefined ? { duration } : {}),
      };

      templateExamples.push({
        id,
        title: meta.title,
        category: meta.category,
        ...(hasBundle
          ? { codeUrl: urls.codeUrl, bundledUrl: urls.bundledUrl }
          : { code, codeUrl: urls.codeUrl }),
        playground,
      });
    });
  }

  await runPool(templateJobs, BUNDLE_CONCURRENCY, (job) => job());

  templateExamples.sort((a, b) => a.id.localeCompare(b.id));
  
  for (const ex of templateExamples) {
    const hasBundle = ex.bundledUrl !== undefined;
    console.log(
      `  ✓ ${ex.category}/${ex.id} → ${ex.title}${hasBundle ? " (bundled)" : " (code only)"}`,
    );
  }

  const templateIds = new Set(templateExamples.map((t) => t.id));
  const builtinModules = await loadBuiltinModules();
  const builtinExamples: ExampleEntry[] = [];
  const builtinJobs: Array<() => Promise<void>> = [];

  for (const spec of BUILTIN_SPECS) {
    if (templateIds.has(spec.id)) continue;

    const code = builtinModules[spec.module]?.[spec.export];
    if (!code) {
      console.warn(`Warning: builtin ${spec.id} export ${spec.export} missing`);
      continue;
    }

    const contentHash = hashContent([
      BUNDLE_PROVENANCE,
      code,
      spec.module,
      spec.export,
    ]);
    const duration = parseDuration(code);

    builtinJobs.push(async () => {
      const urls = await bundleExample(
        cache,
        spec.id,
        contentHash,
        () =>
          bundleTemplateCode(code, {
            sourcefile: `${spec.id}.media.ts`,
            resolveDir: BUILTINS_SOURCE_DIR,
          }),
        code,
      );

      const hasBundle = urls.bundledUrl !== undefined;
      const liveEdit = EDITOR_WASM_DEMO_IDS.has(spec.id) ? true : !hasBundle;

      builtinExamples.push({
        id: spec.id,
        title: spec.title,
        category: spec.category,
        ...(hasBundle
          ? { codeUrl: urls.codeUrl, bundledUrl: urls.bundledUrl }
          : { code, codeUrl: urls.codeUrl }),
        playground: {
          liveEdit,
          needsBundle: false,
          needsAssets: hasConfigAssets(code),
          ...(duration !== undefined ? { duration } : {}),
        },
      });
    });
  }

  await runPool(builtinJobs, BUNDLE_CONCURRENCY, (job) => job());
  builtinExamples.sort((a, b) => a.id.localeCompare(b.id));
  
  for (const ex of builtinExamples) {
    const hasBundle = ex.bundledUrl !== undefined;
    console.log(
      `  ✓ builtin/${ex.id} → ${ex.title}${hasBundle ? " (bundled)" : " (code only)"}`,
    );
  }

  const activeIds = new Set([
    ...templateExamples.map((e) => e.id),
    ...builtinExamples.map((e) => e.id),
  ]);
  const pruned = pruneOrphanSidecars(activeIds, cache);
  if (pruned > 0) {
    console.log(`Pruned ${pruned} orphan playground dir(s)`);
  }

  writeCache(cache);
  writeManifest(OUTPUT_FILE, "TEMPLATE_EXAMPLES", templateExamples);
  writeManifest(BUILTINS_OUTPUT, "BUILTIN_EXAMPLES", builtinExamples);

  console.log(`\nGenerated ${OUTPUT_FILE} with ${templateExamples.length} templates`);
  console.log(`Generated ${BUILTINS_OUTPUT} with ${builtinExamples.length} builtins`);
  console.log(`Sidecar bundles: ${EXAMPLES_PUBLIC_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
