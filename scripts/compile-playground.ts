#!/usr/bin/env npx tsx
/**
 * Compile playground examples to static assets for Gumbo (or any static host).
 *
 * Output layout (under --out, default: public/playground):
 *   manifest.json
 *   examples/{id}/code.ts
 *   examples/{id}/bundle.iife.js   (when needsBundle)
 *   assets/...                   (companion files from template dirs)
 *
 * Env (set by gumbo [[build.hook]]):
 *   GUMBO_ROOT   — project root
 *   GUMBO_OUTDIR — bundle outdir (dist)
 *   GUMBO_MODE   — build | dev
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { bundleTemplate } from "../packages/superimg-core/dist/bundler.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SUPERIMG_ROOT = path.resolve(SCRIPT_DIR, "..");
const EXAMPLES_DIR = path.join(SUPERIMG_ROOT, "examples");
const METADATA_PATH = path.join(EXAMPLES_DIR, "_templates.json");

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
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, file));
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
  fs.writeFileSync(codePath, entry.code);

  const catalog: CatalogEntry = {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    codeUrl: `/playground/examples/${entry.id}/code.ts`,
    playground: entry.playground,
  };

  if (entry.bundled !== undefined) {
    const bundlePath = path.join(exampleDir, "bundle.iife.js");
    fs.writeFileSync(bundlePath, entry.bundled);
    catalog.bundledUrl = `/playground/examples/${entry.id}/bundle.iife.js`;
  }

  if (entry.assetDir) {
    copyCompanionAssets(entry.assetDir, outDir, entry.id);
  }

  return catalog;
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

    let bundled: string | undefined;
    if (mustBundle) {
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

    const playground: PlaygroundMeta = {
      liveEdit: !bundled,
      needsBundle: mustBundle,
      needsAssets,
      ...(duration !== undefined ? { duration } : {}),
    };

    catalog.push(
      writeExample(outDir, {
        id,
        title: meta.title,
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
    const playground: PlaygroundMeta = {
      liveEdit: true,
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
        playground,
      }),
    );
    console.log(`  ✓ builtin/${spec.id} → ${spec.title}`);
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

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const templateCatalog = await compileTemplates(outDir);
  const templateIds = new Set(templateCatalog.map((e) => e.id));
  const builtinCatalog = await compileBuiltins(outDir, resolvedBuiltins, templateIds);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    categories: [
      { id: "basics", title: "Basics" },
      { id: "marketing", title: "Marketing" },
      { id: "events", title: "Events" },
      { id: "social", title: "Social" },
      { id: "interfaces", title: "Interfaces" },
      { id: "data", title: "Data" },
      { id: "vector", title: "Vector" },
      { id: "developer", title: "Developer" },
      { id: "composed", title: "Composed" },
    ],
    examples: [...templateCatalog, ...builtinCatalog].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  console.log(
    `\nWrote ${manifest.examples.length} examples to ${outDir}/manifest.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});